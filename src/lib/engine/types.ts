export type Unit =
  | "oz"
  | "lb"
  | "g"
  | "kg"
  | "tsp"
  | "tbsp"
  | "cup"
  | "floz"
  | "ml"
  | "l"
  | "each";

export type MealType = "Breakfast" | "Lunch" | "Dinner";

export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export type Day = (typeof DAYS)[number];

export type Category =
  | "Produce"
  | "Meat & Seafood"
  | "Dairy & Eggs"
  | "Bakery"
  | "Frozen"
  | "Pantry"
  | "Other";

export const CATEGORY_ORDER: Category[] = [
  "Produce",
  "Meat & Seafood",
  "Dairy & Eggs",
  "Bakery",
  "Frozen",
  "Pantry",
  "Other",
];

export interface Pack {
  size: number;
  unit: Unit;
  label: string;
}

export interface CatalogItem {
  id: string;
  name: string;
  category: Category;
  pack: Pack;
  aliases: string[];
  staple?: boolean;
}

/** One ingredient of a meal, for one adult portion. */
export interface IngredientAmount {
  ingredient: string;
  item: string;
  qty: number;
  unit: Unit;
}

export interface Meal {
  id: string;
  type: MealType;
  name: string;
  description: string;
  ingredients: IngredientAmount[];
  /** A leftover lunch cooks extra servings of this dinner instead of adding groceries. */
  leftoverOf?: string;
  /** Takeout night and similar: nothing to buy. */
  noGroceries?: boolean;
  /** Typed by the user and parsed by the model rather than loaded from the library. */
  custom?: boolean;
}

export interface Multipliers {
  adult: number;
  kid4to10: number;
  kid11to18: number;
}

export interface Household {
  adults: number;
  kids4to10: number;
  kids11to18: number;
  multipliers: Multipliers;
  /** Catalog item ids the household keeps on hand; they stay out of the cart. */
  staples: string[];
}

export interface PlanEntry {
  day: Day;
  mealType: MealType;
  mealId: string;
  /** Replaces the household's weighted servings for this one meal. */
  servingsOverride?: number;
}

export interface TraceStep {
  day: Day;
  mealType: MealType;
  mealId: string;
  mealName: string;
  /** Set when these servings come from a leftover lunch cooked with a dinner. */
  viaLeftover?: string;
  perServing: number;
  perServingUnit: Unit;
  servings: number;
  /** perServing times servings, in the cart line's unit. */
  amount: number;
}

export interface CartLine {
  item: string;
  name: string;
  category: Category;
  /** Total needed, in the pack's unit. */
  needed: number;
  unit: Unit;
  packs: number;
  pack: Pack;
  /** Amount bought beyond what the meals need, in the pack's unit. */
  extra: number;
  /** True when over half of what is bought would go unused. */
  waste: boolean;
  displayText: string;
  trace: TraceStep[];
}

export interface CartResult {
  servings: number;
  lines: CartLine[];
  /** Items the meals use that stay home because they are pantry staples. */
  staples: { item: string; name: string }[];
  /** Plan entries that add nothing, with the reason. */
  notes: string[];
}
