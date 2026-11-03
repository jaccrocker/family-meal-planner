import amountsJson from "@/data/amounts.json";
import catalogJson from "@/data/catalog.json";
import mealsJson from "@/data/meals.json";
import type { CatalogItem, IngredientAmount, Meal, MealType } from "./types";

interface RawMeal {
  id: string;
  type: string;
  name: string;
  description: string;
  ingredients: { name: string; category: string }[];
  leftoverOf?: string;
  noGroceries?: boolean;
}

interface AmountsFile {
  status: string;
  meals: Record<string, { reviewed: boolean; ingredients: IngredientAmount[] }>;
}

/** Every catalog item, loaded from the data file. */
export const CATALOG: CatalogItem[] = catalogJson as CatalogItem[];
/** Catalog items keyed by item id. */
export const CATALOG_BY_ID = new Map(CATALOG.map((c) => [c.id, c]));

const amounts = amountsJson as unknown as AmountsFile;

/** The preloaded library: spreadsheet meals joined with their per serving amounts. */
export const LIBRARY: Meal[] = (mealsJson as RawMeal[]).map((m) => ({
  id: m.id,
  type: m.type as MealType,
  name: m.name,
  description: m.description,
  ingredients: amounts.meals[m.id]?.ingredients ?? [],
  ...(m.leftoverOf ? { leftoverOf: m.leftoverOf } : {}),
  ...(m.noGroceries ? { noGroceries: true } : {}),
}));

/** Library meals keyed by meal id. */
export const LIBRARY_BY_ID = new Map(LIBRARY.map((m) => [m.id, m]));

/** Ingredient names as the spreadsheet lists them, for display. */
export const LISTED_INGREDIENTS = new Map(
  (mealsJson as RawMeal[]).map((m) => [m.id, m.ingredients.map((i) => i.name)]),
);

/** The status text recorded in the per serving amounts data file. */
export const AMOUNTS_STATUS = amounts.status;

/** Ids of catalog items marked as staples, the default pantry for a new household. */
export const DEFAULT_STAPLES = CATALOG.filter((c) => c.staple).map((c) => c.id);

const ALIAS = new Map<string, string>();
for (const c of CATALOG) {
  ALIAS.set(c.id, c.id);
  ALIAS.set(c.name.toLowerCase(), c.id);
  for (const a of c.aliases) ALIAS.set(a.toLowerCase(), c.id);
}

/** Maps a free text ingredient name to a catalog item, if one matches. */
export function matchCatalog(name: string): CatalogItem | undefined {
  const n = name.trim().toLowerCase();
  const direct = ALIAS.get(n) ?? ALIAS.get(n.replace(/s$/, "")) ?? ALIAS.get(`${n}s`);
  return direct ? CATALOG_BY_ID.get(direct) : undefined;
}
