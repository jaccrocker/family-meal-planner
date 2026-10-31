import { describe, expect, it } from "vitest";
import { toMeal, type ParsedMeal } from "./parser";

const parsed = (ingredients: ParsedMeal["ingredients"]): ParsedMeal => ({ meal: "Test meal", ingredients });

describe("toMeal ad hoc packs", () => {
  it("uses the model's typical package", () => {
    const { items } = toMeal(
      parsed([{ name: "zzz feta", qty: 2, unit: "oz", category: "Dairy & Eggs", staple: false, pack: { size: 6, unit: "oz" } }]),
      "Dinner",
    );
    expect(items[0].pack).toMatchObject({ size: 6, unit: "oz" });
  });

  it("converts the model pack to the base unit", () => {
    const { items } = toMeal(
      parsed([{ name: "zzz tomatoes", qty: 8, unit: "oz", category: "Pantry", staple: false, pack: { size: 1, unit: "lb" } }]),
      "Dinner",
    );
    expect(items[0].pack).toMatchObject({ size: 16, unit: "oz" });
  });

  it("falls back to a category default, not 1 oz", () => {
    const { items } = toMeal(
      parsed([
        { name: "zzz cheese", qty: 4, unit: "oz", category: "Dairy & Eggs", staple: false },
        { name: "zzz stock", qty: 8, unit: "floz", category: "Pantry", staple: false },
        { name: "zzz pita", qty: 4, unit: "each", category: "Bakery", staple: false },
      ]),
      "Dinner",
    );
    expect(items.map((i) => i.pack.size)).toEqual([8, 16, 1]);
  });

  it("ignores a model pack of the wrong unit family", () => {
    const { items } = toMeal(
      parsed([{ name: "zzz rice", qty: 4, unit: "oz", category: "Pantry", staple: false, pack: { size: 2, unit: "each" } }]),
      "Dinner",
    );
    expect(items[0].pack).toMatchObject({ size: 16, unit: "oz" });
  });
});
