"""Private Alexa skill for Family Meal Planner: add, move, clear and read back meals.

Speech comes back from the planner's /api/voice endpoint;
the skill itself holds no meal logic. Nothing about the household is logged.

Config, from env vars or the Alexa hosted S3 object Config/meal-planner.json
(which must also say "enabled": true):
  FMP_URL                 https://meals.example.com
  FMP_VOICE_TOKEN         the planner's VOICE_API_TOKEN
  CF_ACCESS_CLIENT_ID     Cloudflare Access service token, when Access fronts the app
  CF_ACCESS_CLIENT_SECRET
"""
import json
import os
import urllib.error
import urllib.request

HELP = (
    "You can say, add chicken fajitas on Tuesday, move Monday to Wednesday, "
    "clear Friday, or what's for dinner."
)
REPROMPT = "What would you like to change?"
KEYS = ("FMP_URL", "FMP_VOICE_TOKEN", "CF_ACCESS_CLIENT_ID", "CF_ACCESS_CLIENT_SECRET")


def respond(text, end=False):
    response = {"outputSpeech": {"type": "PlainText", "text": text}, "shouldEndSession": end}
    if not end:
        response["reprompt"] = {"outputSpeech": {"type": "PlainText", "text": REPROMPT}}
    return {"version": "1.0", "sessionAttributes": {}, "response": response}


def load_config():
    config = {k: os.environ.get(k, "").strip() for k in KEYS}
    if config["FMP_URL"] and config["FMP_VOICE_TOKEN"]:
        return config
    bucket = os.environ.get("S3_PERSISTENCE_BUCKET")
    region = os.environ.get("S3_PERSISTENCE_REGION")
    if not bucket or not region:
        return config
    import boto3
    from botocore.config import Config

    client = boto3.client(
        "s3", region_name=region, config=Config(connect_timeout=0.5, read_timeout=0.5, retries={"total_max_attempts": 1})
    )
    try:
        result = client.get_object(Bucket=bucket, Key="Config/meal-planner.json")
        with result["Body"] as body:
            stored = json.loads(body.read(8192))
    except Exception:  # noqa: BLE001 - any storage failure means not configured
        return config
    # Activation is explicit, as in the house assistant.
    if stored.get("enabled") is not True:
        return config
    return {k: str(stored.get(k, "")).strip() for k in KEYS}


def slot_value(intent, name):
    slot = (intent.get("slots") or {}).get(name) or {}
    resolved = (slot.get("resolutions") or {}).get("resolutionsPerAuthority") or []
    for authority in resolved:
        if authority.get("status", {}).get("code") == "ER_SUCCESS_MATCH":
            return authority["values"][0]["value"]["name"]
    return slot.get("value")


def command_for(intent):
    name = intent.get("name")
    v = lambda n: slot_value(intent, n)  # noqa: E731
    if name == "AddMealIntent":
        return {"action": "add", "meal": v("meal") or "", "day": v("day"), "mealType": v("mealType")}
    if name == "MoveMealIntent":
        return {"action": "move", "fromDay": v("fromDay") or "", "toDay": v("toDay") or "", "mealType": v("mealType")}
    if name == "RemoveMealIntent":
        return {"action": "remove", "day": v("day") or "", "mealType": v("mealType")}
    if name == "WhatsPlannedIntent":
        return {"action": "whats", "day": v("day"), "mealType": v("mealType")}
    return None


def call_planner(command, config):
    body = {k: val for k, val in command.items() if val}
    headers = {"Authorization": "Bearer " + config["FMP_VOICE_TOKEN"], "Content-Type": "application/json"}
    if config.get("CF_ACCESS_CLIENT_ID"):
        headers["CF-Access-Client-Id"] = config["CF_ACCESS_CLIENT_ID"]
        headers["CF-Access-Client-Secret"] = config["CF_ACCESS_CLIENT_SECRET"]
    request = urllib.request.Request(
        config["FMP_URL"].rstrip("/") + "/api/voice", data=json.dumps(body).encode("utf-8"), headers=headers, method="POST"
    )
    try:
        with urllib.request.urlopen(request, timeout=4.5) as response:
            return json.load(response).get("speech") or "Done."
    except urllib.error.HTTPError as error:
        try:
            return json.load(error).get("speech") or "The meal planner said no to that."
        except Exception:  # noqa: BLE001
            return "The meal planner is not answering right now."
    except (urllib.error.URLError, TimeoutError):
        return "The meal planner is not answering right now."


def lambda_handler(event, context):
    request = event.get("request", {})
    kind = request.get("type")
    if kind == "LaunchRequest":
        return respond("Meal planner here. " + HELP)
    if kind == "SessionEndedRequest":
        return {"version": "1.0", "response": {}}
    if kind != "IntentRequest":
        return respond(HELP)
    intent = request.get("intent", {})
    name = intent.get("name")
    if name in ("AMAZON.StopIntent", "AMAZON.CancelIntent", "AMAZON.NavigateHomeIntent"):
        return respond("Okay.", end=True)
    if name == "AMAZON.HelpIntent":
        return respond(HELP)
    command = command_for(intent)
    if command is None:
        return respond("Sorry, I can add, move, clear or read meals. " + HELP)
    config = load_config()
    if not config["FMP_URL"] or not config["FMP_VOICE_TOKEN"]:
        return respond("The meal planner is not set up yet.", end=True)
    return respond(call_planner(command, config), end=True)
