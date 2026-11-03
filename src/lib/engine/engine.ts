import { convert, formatQty } from "./units";
import {
  CATEGORY_ORDER,
  DAYS,
  type CartLine,
  type CartResult,
  type Category,
  type CatalogItem,
  type Household,
  type Meal,
  type MealType,
  type PlanEntry,
  type TraceStep,
} from "./types";

const MEAL_TYPE_ORDER: MealType[] = ["Breakfast", "Lunch", "Dinner"];

// Only these sections spoil fast enough for leftover packs to count as waste.
const PERISHABLE = new Set<Category>(["Produce", "Meat & Seafood", "Dairy & Eggs", "Bakery"]);

// Guards against float noise turning an exact 2.0 packs into 3.
const EPSILON = 1e-9;

/** Weighted head count: each age band counts at its portion multiplier. */
export function weightedServings(h: Household): number {
  return (
    h.adults * h.multipliers.adult +
    h.kids4to10 * h.multipliers.kid4to10 +
    h.kids11to18 * h.multipliers.kid11to18
  );
}

/** Whole packs to buy for a need: at least one when anything is needed, none otherwise, tolerating float noise. */
export function packsFor(needed: number, packSize: number): number {
  if (needed <= 0) return 0;
  return Math.max(1, Math.ceil(needed / packSize - EPSILON));
}

interface CookJob {
  entry: PlanEntry;
  meal: Meal;
  servings: number;
  viaLeftover?: string;
}

/** Inputs for computing a cart. */
export interface ComputeInput {
  plan: PlanEntry[];
  household: Household;
  meals: Map<string, Meal>;
  catalog: Map<string, CatalogItem>;
  /** Item ids the user removed from this week's cart, for example "already have it". */
  exclude?: string[];
}

/**
 * Computes the grocery cart for a plan. Leftover meals add servings to their source dinner,
 * no-grocery meals and unknown meals add nothing, and staples and excluded items stay out of
 * the cart. Order does not matter: the same plan in any order gives the same result.
 * @throws Error when a meal uses an item that is not in the catalog.
 */
export function computeCart(input: ComputeInput): CartResult {
  const { household, meals, catalog } = input;
  // Same plan in any order gives the same cart, notes and float sums.
  const plan = [...input.plan].sort(
    (a, b) =>
      DAYS.indexOf(a.day) - DAYS.indexOf(b.day) ||
      MEAL_TYPE_ORDER.indexOf(a.mealType) - MEAL_TYPE_ORDER.indexOf(b.mealType) ||
      a.mealId.localeCompare(b.mealId),
  );
  const exclude = new Set(input.exclude ?? []);
  const staplesSet = new Set(household.staples);
  const servings = weightedServings(household);
  const notes: string[] = [];

  const jobs: CookJob[] = [];
  for (const entry of plan) {
    const meal = meals.get(entry.mealId);
    if (!meal) {
      notes.push(`${entry.day} ${entry.mealType}: unknown meal ${entry.mealId}, skipped.`);
      continue;
    }
    const s = entry.servingsOverride ?? servings;
    if (meal.noGroceries) {
      notes.push(`${entry.day}: ${meal.name} adds nothing to the cart.`);
      continue;
    }
    if (meal.leftoverOf) {
      const source = meals.get(meal.leftoverOf);
      if (!source) {
        notes.push(`${entry.day}: ${meal.name} has no source dinner, skipped.`);
        continue;
      }
      const cooked = plan.some((p) => p.mealId === source.id);
      notes.push(
        cooked
          ? `${entry.day}: ${meal.name} adds ${round2(s)} servings to ${source.name}.`
          : `${entry.day}: ${meal.name} cooks ${round2(s)} servings of ${source.name}, which is not on this week's plan.`,
      );
      jobs.push({ entry, meal: source, servings: s, viaLeftover: meal.name });
      continue;
    }
    jobs.push({ entry, meal, servings: s });
  }

  const byItem = new Map<string, { item: CatalogItem; needed: number; trace: TraceStep[] }>();
  const stapleHits = new Map<string, string>();

  for (const job of jobs) {
    for (const ing of job.meal.ingredients) {
      const item = catalog.get(ing.item);
      if (!item) {
        throw new Error(`Meal ${job.meal.id} uses ${ing.item}, which is not in the catalog`);
      }
      if (staplesSet.has(item.id)) {
        stapleHits.set(item.id, item.name);
        continue;
      }
      if (exclude.has(item.id)) continue;

      const perServing = convert(ing.qty, ing.unit, item.pack.unit);
      const amount = perServing * job.servings;
      const acc = byItem.get(item.id) ?? { item, needed: 0, trace: [] };
      acc.needed += amount;
      acc.trace.push({
        day: job.entry.day,
        mealType: job.entry.mealType,
        mealId: job.meal.id,
        mealName: job.meal.name,
        ...(job.viaLeftover ? { viaLeftover: job.viaLeftover } : {}),
        perServing,
        perServingUnit: item.pack.unit,
        servings: job.servings,
        amount,
      });
      byItem.set(item.id, acc);
    }
  }

  const lines: CartLine[] = [...byItem.values()].map(({ item, needed, trace }) => {
    const packs = packsFor(needed, item.pack.size);
    const bought = packs * item.pack.size;
    const extra = bought - needed;
    trace.sort(
      (a, b) =>
        DAYS.indexOf(a.day) - DAYS.indexOf(b.day) ||
        MEAL_TYPE_ORDER.indexOf(a.mealType) - MEAL_TYPE_ORDER.indexOf(b.mealType) ||
        Number(Boolean(a.viaLeftover)) - Number(Boolean(b.viaLeftover)),
    );
    return {
      item: item.id,
      name: item.name,
      category: item.category,
      needed,
      unit: item.pack.unit,
      packs,
      pack: item.pack,
      extra,
      waste: PERISHABLE.has(item.category) && extra > bought / 2 + EPSILON,
      displayText: displayText(item, packs, needed),
      trace,
    };
  });

  lines.sort(
    (a, b) =>
      CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category) ||
      a.name.localeCompare(b.name),
  );

  const staples = [...stapleHits.entries()]
    .map(([item, name]) => ({ item, name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return { servings, lines, staples, notes };
}

function displayText(item: CatalogItem, packs: number, needed: number): string {
  const need = formatQty(needed, item.pack.unit);
  if (item.pack.unit === "each" && item.pack.size === 1) {
    return `${item.name}, ${packs}`;
  }
  return `${item.name}, ${packs} × ${item.pack.label} (need ${need})`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
