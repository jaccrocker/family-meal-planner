# Family Meal Planner Alexa skill

A private Alexa hosted skill ("Alexa, open family meal planner") that adds, moves, clears and reads back meals. It sends each command to the planner's `/api/voice` endpoint, which applies it to the household's saved plan and returns what Alexa says.

This skill uses an explicit `enabled` flag, S3 configuration, and its own fixture tests.

## What it understands

- "add chicken fajitas on Tuesday", "change Thursday dinner to stuffed peppers", "plan salmon for Friday"
- "move Monday to Wednesday" (swaps if Wednesday already has a dinner)
- "clear Friday", "remove lunch on Tuesday"
- "what's for dinner", "what's planned on Saturday"

With no day, "add" uses the first day without that meal type, the same rule as the Meals page.

## Set up

1. Planner server env: `FEATURE_ALEXA=1`, `VOICE_API_TOKEN` (48 or more random characters), `VOICE_HOUSEHOLD_EMAIL` (the household owner's Google email).
2. Cloudflare Access: create a service token for the skill and add a Service Auth policy for it on the meals application.
3. Alexa developer console: new custom skill, Alexa hosted (Python). Paste `interaction-model/en-US.json` into the JSON editor and `lambda_function.py` into the code tab. Put `FMP_URL`, `FMP_VOICE_TOKEN`, `CF_ACCESS_CLIENT_ID` and `CF_ACCESS_CLIENT_SECRET` in `Config/meal-planner.json` in the skill's S3 bucket with `"enabled": true`.
4. Test tab: enable testing in Development; add family members as beta testers to use it on their Echos.

Rebuild the interaction model when the meal library changes: `python3 integrations/alexa/build_model.py`. Run the tests with `cd integrations/alexa && python3 -m unittest`.

## Limits

Private skills cannot be started from Alexa routines. Custom skills may not run under Alexa+.
