"""Fixture tests for the skill, in the style of alexa-home-control's test_skill.py. Run: python3 -m unittest"""
import io
import json
import os
import unittest
from unittest import mock

import lambda_function as skill


def event(name, **slots):
    return {
        "request": {
            "type": "IntentRequest",
            "intent": {"name": name, "slots": {k: {"name": k, "value": v} for k, v in slots.items()}},
        }
    }


class FakeResponse(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False


ENV = {"FMP_URL": "https://meals.example.test", "FMP_VOICE_TOKEN": "t" * 40, "CF_ACCESS_CLIENT_ID": "id", "CF_ACCESS_CLIENT_SECRET": "s"}


class SkillTests(unittest.TestCase):
    def test_launch_offers_help(self):
        out = skill.lambda_handler({"request": {"type": "LaunchRequest"}}, None)
        self.assertIn("add chicken fajitas", out["response"]["outputSpeech"]["text"])
        self.assertFalse(out["response"]["shouldEndSession"])

    def test_add_posts_command_with_access_headers(self):
        captured = {}

        def fake_urlopen(request, timeout):
            captured["url"] = request.full_url
            captured["body"] = json.loads(request.data)
            captured["headers"] = dict(request.header_items())
            return FakeResponse(json.dumps({"speech": "Added Chicken Fajitas for Tuesday dinner."}).encode())

        with mock.patch.dict(os.environ, ENV, clear=True), mock.patch("urllib.request.urlopen", fake_urlopen):
            out = skill.lambda_handler(event("AddMealIntent", meal="chicken fajitas", day="tuesday"), None)
        self.assertEqual(captured["url"], "https://meals.example.test/api/voice")
        self.assertEqual(captured["body"], {"action": "add", "meal": "chicken fajitas", "day": "tuesday"})
        self.assertEqual(captured["headers"]["Cf-access-client-id"], "id")
        self.assertEqual(out["response"]["outputSpeech"]["text"], "Added Chicken Fajitas for Tuesday dinner.")

    def test_move_and_remove_commands(self):
        self.assertEqual(
            skill.command_for(event("MoveMealIntent", fromDay="monday", toDay="wednesday")["request"]["intent"]),
            {"action": "move", "fromDay": "monday", "toDay": "wednesday", "mealType": None},
        )
        self.assertEqual(skill.command_for(event("RemoveMealIntent", day="friday")["request"]["intent"])["action"], "remove")

    def test_not_configured(self):
        with mock.patch.dict(os.environ, {}, clear=True):
            out = skill.lambda_handler(event("WhatsPlannedIntent"), None)
        self.assertIn("not set up", out["response"]["outputSpeech"]["text"])

    def test_planner_down(self):
        import urllib.error

        def fail(request, timeout):
            raise urllib.error.URLError("down")

        with mock.patch.dict(os.environ, ENV, clear=True), mock.patch("urllib.request.urlopen", fail):
            out = skill.lambda_handler(event("WhatsPlannedIntent"), None)
        self.assertIn("not answering", out["response"]["outputSpeech"]["text"])


if __name__ == "__main__":
    unittest.main()
