import type { Unit } from "./types";

type Family = "weight" | "volume" | "count";

// Factors to each family's base unit: ounces, fluid ounces, or items.
const TABLE: Record<Unit, { family: Family; factor: number }> = {
  oz: { family: "weight", factor: 1 },
  lb: { family: "weight", factor: 16 },
  g: { family: "weight", factor: 1 / 28.349523125 },
  kg: { family: "weight", factor: 1000 / 28.349523125 },
  floz: { family: "volume", factor: 1 },
  tsp: { family: "volume", factor: 1 / 6 },
  tbsp: { family: "volume", factor: 1 / 2 },
  cup: { family: "volume", factor: 8 },
  ml: { family: "volume", factor: 1 / 29.5735295625 },
  l: { family: "volume", factor: 1000 / 29.5735295625 },
  each: { family: "count", factor: 1 },
};

/** The family a unit belongs to: weight, volume or count. */
export function family(unit: Unit): Family {
  return TABLE[unit].family;
}

/** True when both units are in the same family. */
export function canConvert(from: Unit, to: Unit): boolean {
  return TABLE[from].family === TABLE[to].family;
}

/**
 * Converts a quantity between units of the same family.
 * @throws Error when the units are in different families.
 */
export function convert(qty: number, from: Unit, to: Unit): number {
  if (!canConvert(from, to)) {
    throw new Error(`Cannot convert ${from} to ${to}`);
  }
  return (qty * TABLE[from].factor) / TABLE[to].factor;
}

/** Rounds for display only; the engine keeps full precision. */
export function round(n: number, places = 2): number {
  const f = 10 ** places;
  return Math.round(n * f) / f;
}

const LABEL: Record<Unit, string> = {
  oz: "oz",
  lb: "lb",
  g: "g",
  kg: "kg",
  floz: "fl oz",
  tsp: "tsp",
  tbsp: "tbsp",
  cup: "cup",
  ml: "ml",
  l: "l",
  each: "",
};

/** Formats a quantity for display, rounded to two places. Ounces of 16 or more show as pounds, and count has no unit label. */
export function formatQty(qty: number, unit: Unit): string {
  if (unit === "oz" && qty >= 16) return `${round(qty / 16)} lb`;
  const label = LABEL[unit];
  return label ? `${round(qty)} ${label}` : `${round(qty)}`;
}

/** Every supported unit. */
export const UNITS = Object.keys(TABLE) as Unit[];
