import { z } from "zod";
import { DEMO_HOUSEHOLD, DEMO_PLAN } from "@/lib/demo";
import { computeCart } from "@/lib/engine/engine";
import { CATALOG_BY_ID, LIBRARY_BY_ID } from "@/lib/engine/library";
import { DAYS, type CartResult, type CatalogItem, type Day, type Meal, type MealType } from "@/lib/engine/types";
import { UNITS } from "@/lib/engine/units";

/** Everything a week needs, in a shape that can be stored as JSON. */

const unit = z.enum(UNITS as [string, ...string[]]);
const mealType = z.enum(["Breakfast", "Lunch", "Dinner"]);
const category = z.enum(["Produce", "Meat & Seafood", "Dairy & Eggs", "Bakery", "Frozen", "Pantry", "Other"]);

/** Validation schema for a household's saved state, with size limits on every list. */
export const PlannerStateSchema = z.object({
  household: z.object({
    adults: z.number().int().min(0).max(20),
    kids4to10: z.number().int().min(0).max(20),
    kids11to18: z.number().int().min(0).max(20),
    multipliers: z.object({
      adult: z.number().min(0).max(3),
      kid4to10: z.number().min(0).max(3),
      kid11to18: z.number().min(0).max(3),
    }),
    staples: z.array(z.string()).max(200),
  }),
  plan: z
    .array(
      z.object({
        day: z.enum(DAYS),
        mealType,
        mealId: z.string(),
        servingsOverride: z.number().min(0).max(100).optional(),
      }),
    )
    .max(21),
  exclude: z.array(z.string()).max(200),
  customMeals: z
    .array(
      z.object({
        id: z.string().startsWith("custom:"),
        type: mealType,
        name: z.string().max(120),
        description: z.string().max(300),
        custom: z.literal(true),
        ingredients: z
          .array(
            z.object({
              ingredient: z.string().max(80),
              item: z.string(),
              qty: z.number().positive(),
              unit,
            }),
          )
          .max(25),
      }),
    )
    .max(50),
  customItems: z
    .array(
      z.object({
        id: z.string().startsWith("custom:"),
        name: z.string().max(80),
        category,
        pack: z.object({ size: z.number().positive(), unit, label: z.string().max(60) }),
        aliases: z.array(z.string()).max(10),
      }),
    )
    .max(200),
});

/** A household's saved state as validated by PlannerStateSchema. */
export type PlannerState = z.infer<typeof PlannerStateSchema>;

/** The sample household with the demo week planned. */
export const DEMO_STATE: PlannerState = {
  household: DEMO_HOUSEHOLD,
  plan: DEMO_PLAN,
  exclude: [],
  customMeals: [],
  customItems: [],
};

/** A starting state for a new household: two adults and an empty plan. */
export const EMPTY_STATE: PlannerState = {
  ...DEMO_STATE,
  household: { ...DEMO_HOUSEHOLD, adults: 2, kids4to10: 0, kids11to18: 0 },
  plan: [],
};

/** The library meals plus the household's custom meals, keyed by meal id. */
export function mealsFor(state: PlannerState): Map<string, Meal> {
  const meals = new Map(LIBRARY_BY_ID);
  for (const m of state.customMeals) meals.set(m.id, m as Meal);
  return meals;
}

/** The catalog items plus the household's custom items, keyed by item id. */
export function catalogFor(state: PlannerState): Map<string, CatalogItem> {
  const catalog = new Map(CATALOG_BY_ID);
  for (const c of state.customItems) catalog.set(c.id, c as CatalogItem);
  return catalog;
}

/** Computes the grocery cart for the state's plan using its meals, items and exclusions. */
export function cartFor(state: PlannerState): CartResult {
  return computeCart({
    plan: state.plan as Parameters<typeof computeCart>[0]["plan"],
    household: state.household,
    meals: mealsFor(state),
    catalog: catalogFor(state),
    exclude: state.exclude,
  });
}

/** Monday of the week after today, as a short label like "Nov 2". */
export function nextWeekLabel(today = new Date()): string {
  const d = new Date(today);
  const daysToMonday = ((8 - d.getDay()) % 7) || 7;
  d.setDate(d.getDate() + daysToMonday);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

type PlanEntry = PlannerState["plan"][number];

/**
 * The first day after `from` (wrapping through the week) with no meal of this
 * type. Returns `from` when every other day already has one. Days may stay
 * empty; nothing requires a full week.
 */
export function nextOpenDay(plan: PlanEntry[], from: Day, type: MealType): Day {
  const start = DAYS.indexOf(from);
  for (let i = 1; i < DAYS.length; i++) {
    const d = DAYS[(start + i) % DAYS.length];
    if (!plan.some((p) => p.day === d && p.mealType === type)) return d;
  }
  return from;
}

/** The first day of the week with no meal of this type, or Monday when all are filled. */
export function firstOpenDay(plan: PlanEntry[], type: MealType): Day {
  return DAYS.find((d) => !plan.some((p) => p.day === d && p.mealType === type)) ?? DAYS[0];
}

/** Monday of the week after today as YYYY-MM-DD, the same week nextWeekLabel names. */
export function nextMondayISO(today = new Date()): string {
  const d = new Date(today);
  const daysToMonday = ((8 - d.getDay()) % 7) || 7;
  d.setDate(d.getDate() + daysToMonday);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
