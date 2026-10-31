import { describe, expect, it } from "vitest";
import { buildShoppingList, lineItem } from "./instacart";
import { cartFor, DEMO_STATE } from "./planner";

const cart = cartFor(DEMO_STATE);
const line = (id: string) => cart.lines.find((item) => item.item === id)!;

describe("Instacart quantities", () => {
  it("sends required chicken weight so the retailer rounds its own pack size once", () => {
    expect(lineItem(line("chicken-breast")).line_item_measurements).toEqual([
      { quantity: 56.95, unit: "ounce" },
      { quantity: 2, unit: "package" },
    ]);
  });

  it("sends tortilla counts rather than package counts interpreted as individual tortillas", () => {
    const item = lineItem(line("tortillas"));
    expect(item).not.toHaveProperty("display_text");
    expect(item.line_item_measurements).toEqual([
      { quantity: 20, unit: "each" },
    ]);
  });

  it("sends required volume and individual produce counts", () => {
    expect(lineItem(line("heavy-cream")).line_item_measurements).toEqual([
      { quantity: 6.7, unit: "fl oz" },
      { quantity: 1, unit: "package" },
    ]);
    expect(lineItem(line("bell-pepper")).line_item_measurements).toEqual([
      { quantity: 7, unit: "each" },
    ]);
  });

  it("retains a pack fallback for salmon products sold as each without weight metadata", () => {
    expect(lineItem(line("salmon")).line_item_measurements).toEqual([
      { quantity: 20.1, unit: "ounce" },
      { quantity: 3, unit: "package" },
    ]);
  });

  it("preserves every grocery identity without duplicates or pantry staples", () => {
    const request = buildShoppingList(cart.lines, { title: "Test week" });
    expect(request.line_items).toHaveLength(19);
    expect(request.line_items.map((item) => item.name)).toEqual(cart.lines.map((item) => item.name));
    expect(new Set(request.line_items.map((item) => item.name)).size).toBe(19);
    expect(request.line_items.some((item) => item.name === "olive oil")).toBe(false);
  });
});
