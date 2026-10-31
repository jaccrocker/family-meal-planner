"""Writes interaction-model/en-US.json with the meal library as the MEAL slot values.

Run from the repo root after the meal library changes:
    python3 integrations/alexa/build_model.py
"""
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
meals = json.loads((ROOT / "src/data/meals.json").read_text())
names = sorted({m["name"] for m in meals if not m["name"].lower().startswith("leftover")})


def slot(name, type_):
    return {"name": name, "type": type_}


model = {
    "interactionModel": {
        "languageModel": {
            "invocationName": "family meal planner",
            "types": [
                {"name": "MEAL", "values": [{"name": {"value": n}} for n in names]},
                {
                    "name": "MEAL_TYPE",
                    "values": [
                        {"name": {"value": "dinner", "synonyms": ["supper"]}},
                        {"name": {"value": "lunch"}},
                        {"name": {"value": "breakfast"}},
                    ],
                },
            ],
            "intents": [
                {"name": "AMAZON.CancelIntent", "samples": []},
                {"name": "AMAZON.HelpIntent", "samples": []},
                {"name": "AMAZON.StopIntent", "samples": []},
                {"name": "AMAZON.FallbackIntent", "samples": []},
                {"name": "AMAZON.NavigateHomeIntent", "samples": []},
                {
                    "name": "AddMealIntent",
                    "slots": [slot("meal", "MEAL"), slot("day", "AMAZON.DayOfWeek"), slot("mealType", "MEAL_TYPE")],
                    "samples": [
                        "add {meal}",
                        "add {meal} on {day}",
                        "add {meal} for {day}",
                        "add {meal} for {mealType} on {day}",
                        "add {meal} for {day} {mealType}",
                        "put {meal} on {day}",
                        "change {day} {mealType} to {meal}",
                        "change {day} to {meal}",
                        "make {day} {mealType} {meal}",
                        "plan {meal} for {day}",
                    ],
                },
                {
                    "name": "MoveMealIntent",
                    "slots": [slot("fromDay", "AMAZON.DayOfWeek"), slot("toDay", "AMAZON.DayOfWeek"), slot("mealType", "MEAL_TYPE")],
                    "samples": [
                        "move {fromDay} to {toDay}",
                        "move {fromDay} {mealType} to {toDay}",
                        "move {mealType} from {fromDay} to {toDay}",
                        "swap {fromDay} and {toDay}",
                    ],
                },
                {
                    "name": "RemoveMealIntent",
                    "slots": [slot("day", "AMAZON.DayOfWeek"), slot("mealType", "MEAL_TYPE")],
                    "samples": ["clear {day}", "clear {day} {mealType}", "remove {mealType} on {day}", "remove {day} {mealType}"],
                },
                {
                    "name": "WhatsPlannedIntent",
                    "slots": [slot("day", "AMAZON.DayOfWeek"), slot("mealType", "MEAL_TYPE")],
                    "samples": [
                        "what's for {mealType}",
                        "what's for {mealType} on {day}",
                        "what's planned on {day}",
                        "what's the plan",
                        "read the plan",
                    ],
                },
            ],
        }
    }
}

out = pathlib.Path(__file__).parent / "interaction-model" / "en-US.json"
out.parent.mkdir(exist_ok=True)
out.write_text(json.dumps(model, indent=2) + "\n")
print(f"wrote {out.relative_to(ROOT)} with {len(names)} meals")
