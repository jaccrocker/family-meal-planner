import { describe, expect, it } from "vitest";
import { DEMO_HOUSEHOLD, DEMO_PLAN } from "@/lib/demo";
import { computeCart, packsFor, weightedServings } from "./engine";
import { CATALOG, CATALOG_BY_ID, LIBRARY, LIBRARY_BY_ID, LISTED_INGREDIENTS } from "./library";
import type { Household, Meal, PlanEntry } from "./types";
import { canConvert, convert } from "./units";

const run = (plan: PlanEntry[], household: Household = DEMO_HOUSEHOLD, exclude?: string[]) =>
  computeCart({ plan, household, meals: LIBRARY_BY_ID, catalog: CATALOG_BY_ID, exclude });

const line = (result: ReturnType<typeof run>, item: string) => {
  const l = result.lines.find((x) => x.item === item);
  if (!l) throw new Error(`no line for ${item}`);
  return l;
};

describe("units", () => {
  it("converts within a family", () => {
    expect(convert(2, "lb", "oz")).toBe(32);
    expect(convert(3, "tsp", "tbsp")).toBeCloseTo(1);
    expect(convert(1, "cup", "floz")).toBe(8);
    expect(convert(1000, "g", "kg")).toBeCloseTo(1);
  });

  it("refuses to convert across families", () => {
    expect(canConvert("oz", "floz")).toBe(false);
    expect(() => convert(1, "oz", "each")).toThrow();
  });
});

describe("weighted servings", () => {
  it("weights each age band by its multiplier", () => {
    expect(weightedServings(DEMO_HOUSEHOLD)).toBeCloseTo(3.35);
  });

  it("is zero for an empty household", () => {
    expect(weightedServings({ ...DEMO_HOUSEHOLD, adults: 0, kids4to10: 0, kids11to18: 0 })).toBe(0);
  });
});

describe("pack rounding", () => {
  it("rounds up to whole packs", () => {
    expect(packsFor(57, 32)).toBe(2);
    expect(packsFor(64, 32)).toBe(2);
    expect(packsFor(64.0000000001, 32)).toBe(2);
    expect(packsFor(0.1, 32)).toBe(1);
    expect(packsFor(0, 32)).toBe(0);
  });
});

describe("library data", () => {
  it("loads all 33 meals: 6 breakfasts, 12 lunches, 15 dinners", () => {
    expect(LIBRARY).toHaveLength(33);
    const count = (t: string) => LIBRARY.filter((m) => m.type === t).length;
    expect([count("Breakfast"), count("Lunch"), count("Dinner")]).toEqual([6, 12, 15]);
  });

  it("keeps all 156 spreadsheet ingredient rows", () => {
    const rows = [...LISTED_INGREDIENTS.values()].reduce((s, l) => s + l.length, 0);
    expect(rows).toBe(156);
  });

  it("gives every cooking meal an amount for each listed ingredient", () => {
    for (const meal of LIBRARY) {
      if (meal.leftoverOf || meal.noGroceries) {
        expect(meal.ingredients).toHaveLength(0);
        continue;
      }
      const listed = new Set(LISTED_INGREDIENTS.get(meal.id));
      const amounts = new Set(meal.ingredients.map((i) => i.ingredient));
      expect(amounts, meal.name).toEqual(listed);
    }
  });

  it("uses units that convert to each item's pack unit", () => {
    for (const meal of LIBRARY) {
      for (const ing of meal.ingredients) {
        const item = CATALOG_BY_ID.get(ing.item);
        expect(item, `${meal.name}: ${ing.item}`).toBeDefined();
        expect(canConvert(ing.unit, item!.pack.unit), `${meal.name}: ${ing.ingredient}`).toBe(true);
        expect(ing.qty).toBeGreaterThan(0);
      }
    }
  });

  it("points every leftover lunch at a dinner", () => {
    const leftovers = LIBRARY.filter((m) => m.leftoverOf);
    expect(leftovers).toHaveLength(8);
    for (const m of leftovers) expect(LIBRARY_BY_ID.get(m.leftoverOf!)?.type).toBe("Dinner");
  });

  it("has positive pack sizes and unique ids", () => {
    expect(new Set(CATALOG.map((c) => c.id)).size).toBe(CATALOG.length);
    for (const c of CATALOG) expect(c.pack.size).toBeGreaterThan(0);
  });
});

describe("demo week", () => {
  const result = run(DEMO_PLAN);

  it("traces chicken breast across fajitas, the leftover lunch and alfredo", () => {
    const chicken = line(result, "chicken-breast");
    // Fajitas 6 oz x 3.35 = 20.1, leftover lunch 20.1 more, alfredo 5 oz x 3.35 = 16.75.
    expect(chicken.needed).toBeCloseTo(56.95);
    expect(chicken.packs).toBe(2);
    expect(chicken.extra).toBeCloseTo(7.05);
    expect(chicken.trace.map((t) => [t.day, t.mealName, t.viaLeftover ?? null])).toEqual([
      ["Mon", "Chicken Fajitas", null],
      ["Tue", "Chicken Fajitas", "Leftover Chicken Fajitas"],
      ["Tue", "Chicken Broccoli Alfredo Pasta", null],
    ]);
  });

  it("merges shared ingredients into one line", () => {
    const peppers = line(result, "bell-pepper");
    // 0.5 per serving on 6.7 fajita servings plus 1 per serving on 3.35 stuffed pepper servings.
    expect(peppers.needed).toBeCloseTo(6.7);
    expect(peppers.packs).toBe(7);
    expect(result.lines.filter((l) => l.item === "bell-pepper")).toHaveLength(1);
  });

  it("keeps pantry staples out of the cart", () => {
    const items = result.lines.map((l) => l.item);
    for (const s of ["butter", "garlic", "olive-oil"]) expect(items).not.toContain(s);
    expect(result.staples.map((s) => s.item)).toEqual(["garlic", "olive-oil", "butter"].sort((a, b) =>
      CATALOG_BY_ID.get(a)!.name.localeCompare(CATALOG_BY_ID.get(b)!.name),
    ));
  });

  it("adds nothing for takeout night", () => {
    expect(result.notes.some((n) => n.includes("Takeout/Delivery Night adds nothing"))).toBe(true);
  });

  it("drops an item the household already has", () => {
    const without = run(DEMO_PLAN, DEMO_HOUSEHOLD, ["lemon"]);
    expect(without.lines.map((l) => l.item)).not.toContain("lemon");
    expect(without.lines).toHaveLength(result.lines.length - 1);
  });

  it("gives the same cart for the same input", () => {
    expect(run(DEMO_PLAN)).toEqual(result);
    expect(run([...DEMO_PLAN].reverse())).toEqual(result);
  });

  it("sorts lines by store section", () => {
    const cats = result.lines.map((l) => l.category);
    expect(cats[0]).toBe("Produce");
    expect(cats.indexOf("Pantry")).toBeGreaterThan(cats.lastIndexOf("Meat & Seafood"));
  });
});

describe("edge cases", () => {
  it("cooks a leftover lunch's dinner even when that dinner is not planned", () => {
    const r = run([{ day: "Wed", mealType: "Lunch", mealId: "M12" }]);
    expect(line(r, "salmon").needed).toBeCloseTo(6 * 3.35);
    expect(r.notes[0]).toContain("not on this week's plan");
  });

  it("uses a per meal servings override", () => {
    const r = run([{ day: "Sat", mealType: "Dinner", mealId: "M30", servingsOverride: 2 }]);
    expect(line(r, "filet-mignon").needed).toBe(12);
    expect(line(r, "filet-mignon").packs).toBe(1);
  });

  it("flags lines where most of what is bought goes unused", () => {
    const r = run([{ day: "Sat", mealType: "Dinner", mealId: "M25", servingsOverride: 1 }]);
    expect(line(r, "basil").waste).toBe(true);
    expect(line(r, "italian-sausage").waste).toBe(true);
  });

  it("returns an empty cart for an empty plan", () => {
    const r = run([]);
    expect(r.lines).toEqual([]);
  });

  it("handles a typed meal that uses catalog items", () => {
    const tacos: Meal = {
      id: "custom:tacos",
      type: "Dinner",
      name: "Beef Tacos",
      description: "",
      custom: true,
      ingredients: [
        { ingredient: "ground beef", item: "ground-beef", qty: 0.25, unit: "lb" },
        { ingredient: "tortillas", item: "tortillas", qty: 2, unit: "each" },
      ],
    };
    const meals = new Map(LIBRARY_BY_ID);
    meals.set(tacos.id, tacos);
    const r = computeCart({
      plan: [{ day: "Mon", mealType: "Dinner", mealId: tacos.id }],
      household: DEMO_HOUSEHOLD,
      meals,
      catalog: CATALOG_BY_ID,
    });
    expect(line(r, "ground-beef").needed).toBeCloseTo(4 * 3.35);
    expect(line(r, "tortillas").packs).toBe(1);
  });

  it("reports an unknown meal id instead of failing", () => {
    const r = run([{ day: "Mon", mealType: "Dinner", mealId: "nope" }]);
    expect(r.lines).toEqual([]);
    expect(r.notes[0]).toContain("unknown meal");
  });
});

describe("waste flag", () => {
  it("skips shelf stable sections", () => {
    const r = run(DEMO_PLAN);
    expect(line(r, "rice").waste).toBe(false);
    expect(line(r, "heavy-cream").waste).toBe(true);
  });
});
