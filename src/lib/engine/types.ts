/** Measurement units: weight (oz, lb, g, kg), volume (floz, tsp, tbsp, cup, ml, l) and count (each). */
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

/** The meal slots of a day. */
export type MealType = "Breakfast" | "Lunch" | "Dinner";

/** Days of the planning week, Monday first. */
export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
/** A day of the planning week. */
export type Day = (typeof DAYS)[number];

/** Grocery store section for an item. */
export type Category =
  | "Produce"
  | "Meat & Seafood"
  | "Dairy & Eggs"
  | "Bakery"
  | "Frozen"
  | "Pantry"
  | "Other";

/** Order in which sections appear on the cart. */
export const CATEGORY_ORDER: Category[] = [
  "Produce",
  "Meat & Seafood",
  "Dairy & Eggs",
  "Bakery",
  "Frozen",
  "Pantry",
  "Other",
];

/** A store package: its size in the given unit and a label to display, such as "16 oz". */
export interface Pack {
  size: number;
  unit: Unit;
  label: string;
}

/** A purchasable grocery item. Aliases are other names used to match ingredient text; staple marks a default pantry staple. */
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

/** A meal and its ingredients, each for one adult portion. */
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

/** Portion size for each age band, relative to one adult. */
export interface Multipliers {
  adult: number;
  kid4to10: number;
  kid11to18: number;
}

/** Head counts by age band with their portion multipliers and pantry staples. */
export interface Household {
  adults: number;
  kids4to10: number;
  kids11to18: number;
  multipliers: Multipliers;
  /** Catalog item ids the household keeps on hand; they stay out of the cart. */
  staples: string[];
}

/** One meal planned for a day and meal type. */
export interface PlanEntry {
  day: Day;
  mealType: MealType;
  mealId: string;
  /** Replaces the household's weighted servings for this one meal. */
  servingsOverride?: number;
}

/** One meal's contribution to a cart line, kept so the amount can be explained. */
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

/** One item to buy with the amount needed, the packs to buy and how that amount was reached. */
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

/** The computed cart for a plan. */
export interface CartResult {
  servings: number;
  lines: CartLine[];
  /** Items the meals use that stay home because they are pantry staples. */
  staples: { item: string; name: string }[];
  /** Plan entries that add nothing, with the reason. */
  notes: string[];
}
