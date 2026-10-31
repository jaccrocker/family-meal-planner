import { describe, expect, it } from "vitest";
import { DEMO_STATE, type PlannerState } from "@/lib/planner";
import { applyVoice, matchMeal } from "./voice";

const s: PlannerState = DEMO_STATE;

describe("voice commands", () => {
  it("matches spoken meal names loosely", () => {
    expect(matchMeal(s, "chicken fajitas")?.id).toBe("M21");
    expect(matchMeal(s, "alfredo")?.name).toBe("Chicken Broccoli Alfredo Pasta");
    expect(matchMeal(s, "zzz unknown")).toBeUndefined();
  });

  it("adds to a named day, replacing what was there", () => {
    const r = applyVoice(s, { action: "add", meal: "stuffed peppers", day: "monday" });
    expect(r.changed).toBe(true);
    expect(r.state.plan.find((p) => p.day === "Mon" && p.mealType === "Dinner")?.mealId).toBe("M31");
    expect(r.speech).toContain("replacing Chicken Fajitas");
  });

  it("adds to the first open day when no day is said", () => {
    const r = applyVoice(s, { action: "add", meal: "stuffed peppers" });
    expect(r.speech).toContain("Saturday dinner");
  });

  it("moves and swaps", () => {
    const r = applyVoice(s, { action: "move", fromDay: "monday", toDay: "tuesday" });
    const at = (d: string) => r.state.plan.find((p) => p.day === d && p.mealType === "Dinner")?.mealId;
    expect(at("Tue")).toBe("M21");
    expect(at("Mon")).toBe("M20");
  });

  it("removes and reads back", () => {
    const r = applyVoice(s, { action: "remove", day: "wednesday" });
    expect(r.state.plan.some((p) => p.day === "Wed" && p.mealType === "Dinner")).toBe(false);
    expect(applyVoice(s, { action: "whats", day: "monday" }).speech).toBe("Dinner plan: Monday, Chicken Fajitas.");
  });
});
