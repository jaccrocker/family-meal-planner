import { describe, expect, it } from "vitest";
import { nextMondayISO } from "@/lib/planner";
import { dateFor, diffEvents, eventFor } from "./calendar";

const tz = "America/Los_Angeles";

describe("calendar sync pieces", () => {
  it("puts each weekday on the right date of a Monday week", () => {
    expect(dateFor("2026-11-02", "Mon")).toBe("2026-11-02");
    expect(dateFor("2026-11-02", "Sun")).toBe("2026-11-08");
    expect(dateFor("2026-12-28", "Fri")).toBe("2027-01-01");
  });

  it("finds next Monday", () => {
    expect(nextMondayISO(new Date(2026, 9, 31))).toBe("2026-11-02");
    expect(nextMondayISO(new Date(2026, 10, 2))).toBe("2026-11-09");
  });

  it("writes local wall times with the time zone, not UTC", () => {
    const e = eventFor(7, "2026-11-02", { day: "Tue", mealType: "Dinner", mealId: "M20", name: "Pasta" }, { timeZone: tz });
    expect(e.summary).toBe("Dinner: Pasta");
    expect(e.start).toEqual({ dateTime: "2026-11-03T18:00:00", timeZone: tz });
    expect(e.extendedProperties.private.fmpKey).toBe("7:2026-11-02:Tue:Dinner");
  });

  it("creates, updates and removes only what changed", () => {
    const mk = (day: "Mon" | "Tue" | "Wed", name: string, id?: string) => ({
      ...eventFor(1, "2026-11-02", { day, mealType: "Dinner", mealId: name, name }, { timeZone: tz }),
      ...(id ? { id } : {}),
    });
    const existing = [mk("Mon", "Fajitas", "a"), mk("Tue", "Pasta", "b")];
    const desired = [mk("Mon", "Fajitas"), mk("Tue", "Salmon"), mk("Wed", "Peppers")];
    const plan = diffEvents(existing, desired);
    expect(plan.create.map((e) => e.summary)).toEqual(["Dinner: Peppers"]);
    expect(plan.update.map((e) => [e.id, e.summary])).toEqual([["b", "Dinner: Salmon"]]);
    expect(diffEvents(existing, [mk("Mon", "Fajitas")]).remove).toEqual([{ id: "b", summary: "Dinner: Pasta" }]);
  });
});
