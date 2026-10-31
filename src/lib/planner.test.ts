import { describe, expect, it } from "vitest";
import { cartFor, DEMO_STATE, firstOpenDay, nextOpenDay, type PlannerState } from "@/lib/planner";

const dinner = (day: PlannerState["plan"][number]["day"], mealId = "x") => ({ day, mealType: "Dinner" as const, mealId });

describe("nextOpenDay", () => {
  it("moves to the next day without that meal type", () => {
    expect(nextOpenDay([dinner("Mon")], "Mon", "Dinner")).toBe("Tue");
  });

  it("skips days that already have that meal type", () => {
    expect(nextOpenDay([dinner("Mon"), dinner("Tue")], "Mon", "Dinner")).toBe("Wed");
  });

  it("ignores other meal types on the next day", () => {
    const plan = [dinner("Mon"), { day: "Tue" as const, mealType: "Lunch" as const, mealId: "y" }];
    expect(nextOpenDay(plan, "Mon", "Dinner")).toBe("Tue");
  });

  it("wraps around the week", () => {
    expect(nextOpenDay([dinner("Sun"), dinner("Mon")], "Sun", "Dinner")).toBe("Tue");
  });

  it("stays put when every day is filled", () => {
    const full = (["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const).map((d) => dinner(d));
    expect(nextOpenDay(full, "Thu", "Dinner")).toBe("Thu");
  });
});

describe("firstOpenDay", () => {
  it("finds the first unplanned day", () => {
    expect(firstOpenDay([dinner("Mon")], "Dinner")).toBe("Tue");
    expect(firstOpenDay([], "Dinner")).toBe("Mon");
  });
});

describe("partial weeks", () => {
  it("builds a cart when only some days are planned", () => {
    const state: PlannerState = { ...DEMO_STATE, plan: DEMO_STATE.plan.slice(0, 1) };
    expect(state.plan.length).toBe(1);
    expect(cartFor(state).lines.length).toBeGreaterThan(0);
  });
});
