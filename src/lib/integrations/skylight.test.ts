import { describe, expect, it } from "vitest";
import { cartFor, DEMO_STATE } from "@/lib/planner";
import { skylightPhrases, speakable } from "./skylight";

describe("Skylight phrases", () => {
  it("spells out small counts and strips punctuation", () => {
    expect(speakable({ name: "Bell peppers", packs: 2, pack: { size: 1, unit: "each", label: "each" } })).toBe("two bell peppers");
    expect(speakable({ name: "Half & Half", packs: 1, pack: { size: 1, unit: "each", label: "pint" } })).toBe("half half");
  });

  it("makes one phrase per cart line", () => {
    const lines = cartFor(DEMO_STATE).lines;
    const phrases = skylightPhrases(lines);
    expect(phrases).toHaveLength(lines.length);
    expect(phrases[0].phrase).toMatch(/^Alexa, tell Skylight to add .+ to my grocery list$/);
  });
});
