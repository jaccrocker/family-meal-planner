import OpenAI from "openai";
import { z } from "zod";
import fixtures from "@/data/parser-fixtures.json";
import { CATALOG_BY_ID, matchCatalog } from "@/lib/engine/library";
import type { CatalogItem, Category, Meal, MealType, Unit } from "@/lib/engine/types";
import { UNITS, family } from "@/lib/engine/units";

/**
 * Turns a meal typed outside the library into ingredients per adult serving.
 * The model only names ingredients and amounts; every cart quantity still
 * comes from the engine.
 */

const CATEGORIES = ["Produce", "Meat & Seafood", "Dairy & Eggs", "Bakery", "Frozen", "Pantry", "Other"] as const;

export const ParsedMealSchema = z.object({
  meal: z.string().min(1),
  /** Set when the meal is ambiguous, for example beef or chicken tacos. */
  question: z.string().min(1).optional(),
  options: z.array(z.string().min(1)).max(4).optional(),
  ingredients: z
    .array(
      z.object({
        name: z.string().min(1),
        qty: z.number().positive(),
        unit: z.enum(UNITS as [Unit, ...Unit[]]),
        category: z.enum(CATEGORIES),
        staple: z.boolean().default(false),
      }),
    )
    .max(25),
});
export type ParsedMeal = z.infer<typeof ParsedMealSchema>;

const SYSTEM = `You break a family meal into grocery ingredients for ONE adult serving.
Reply with JSON only, matching:
{"meal": string, "question"?: string, "options"?: string[], "ingredients": [{"name": string, "qty": number, "unit": one of ${UNITS.join(", ")}, "category": one of ${CATEGORIES.join(", ")}, "staple": boolean}]}
Rules:
- Use plain grocery names a shopper would search for ("chicken thighs", not "protein").
- Weigh meat, seafood, pasta, rice and cheese in oz; count produce like onions or peppers as each; liquids in floz or tbsp.
- Mark salt, pepper, oil, butter, garlic and dried herbs as staple true.
- If the meal is ambiguous in a way that changes the groceries (for example tacos could be beef or chicken), set "question" to one short question, give 2 to 4 "options", and return an empty ingredients list.
- No nutrition, diet or medical advice.`;

type FixtureMap = Record<string, unknown>;

function key(meal: string, answer?: string): string {
  const k = meal.trim().toLowerCase().replace(/\s+/g, " ");
  return answer ? `${k} | ${answer.trim().toLowerCase()}` : k;
}

export function hasModelKey(): boolean {
  return Boolean(process.env.MODEL_API_KEY);
}

/** Demo mode replays recorded model answers for a few sample meals. */
export function fixtureFor(meal: string, answer?: string): ParsedMeal | undefined {
  const raw = (fixtures as FixtureMap)[key(meal, answer)];
  return raw ? ParsedMealSchema.parse(raw) : undefined;
}

export const FIXTURE_MEALS = Object.keys(fixtures as FixtureMap).filter((k) => !k.includes("|"));

const cache = new Map<string, ParsedMeal>();

export async function parseMeal(meal: string, answer?: string): Promise<ParsedMeal> {
  const k = key(meal, answer);
  const hit = cache.get(k) ?? fixtureFor(meal, answer);
  if (hit) return hit;
  if (!hasModelKey()) {
    throw new ParseUnavailable(
      `Typed meals need a Meta Model API key. In demo mode, try: ${FIXTURE_MEALS.join(", ")}.`,
    );
  }

  const client = new OpenAI({
    apiKey: process.env.MODEL_API_KEY,
    baseURL: process.env.MODEL_API_BASE_URL ?? "https://api.meta.ai/v1",
  });
  const user = answer ? `Meal: ${meal}\nThe household answered: ${answer}` : `Meal: ${meal}`;

  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await client.chat.completions.create({
      model: process.env.MODEL_NAME ?? "muse-spark-1.3",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: user },
        ...(attempt > 0
          ? [{ role: "user" as const, content: `Your last reply did not match the schema: ${String(lastError)}. Reply with valid JSON only.` }]
          : []),
      ],
    });
    try {
      const parsed = ParsedMealSchema.parse(JSON.parse(res.choices[0]?.message?.content ?? ""));
      cache.set(k, parsed);
      return parsed;
    } catch (e) {
      lastError = e;
    }
  }
  throw new Error(`The model's answer for "${meal}" did not match the schema.`);
}

export class ParseUnavailable extends Error {}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/** Natural pack for an ingredient no catalog item matches: one of its own unit. */
function adHocItem(name: string, unit: Unit, category: Category): CatalogItem {
  const base: Record<string, Unit> = { weight: "oz", volume: "floz", count: "each" };
  const packUnit = base[family(unit)];
  return {
    id: `custom:${slug(name)}`,
    name,
    category,
    pack: { size: 1, unit: packUnit, label: packUnit === "each" ? "each" : `1 ${packUnit === "floz" ? "fl oz" : packUnit}` },
    aliases: [],
  };
}

/** Converts a parsed meal to the engine's shape, plus any catalog items it needs. */
export function toMeal(
  parsed: ParsedMeal,
  type: MealType,
): { meal: Meal; items: CatalogItem[]; staples: string[] } {
  const items: CatalogItem[] = [];
  const staples: string[] = [];
  const ingredients = parsed.ingredients.map((ing) => {
    let item = matchCatalog(ing.name);
    if (item && family(item.pack.unit) !== family(ing.unit)) item = undefined;
    if (!item) {
      item = adHocItem(ing.name, ing.unit, ing.category);
      items.push(item);
    }
    if (ing.staple && !CATALOG_BY_ID.get(item.id)?.staple) staples.push(item.id);
    return { ingredient: ing.name, item: item.id, qty: ing.qty, unit: ing.unit };
  });
  return {
    meal: {
      id: `custom:${slug(parsed.meal)}`,
      type,
      name: parsed.meal,
      description: "Typed meal, broken down by Muse Spark",
      ingredients,
      custom: true,
    },
    items,
    staples,
  };
}
