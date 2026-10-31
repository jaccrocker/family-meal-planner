import type { CartLine } from "@/lib/engine/types";

/**
 * Instacart Developer Platform: one shopping list page per week.
 * POST /idp/v1/products/products_link returns a products_link_url that the
 * household opens with the family cart turned on. Nothing here checks out.
 */

const HOSTS = {
  development: "https://connect.dev.instacart.tools",
  production: "https://connect.instacart.com",
} as const;

export interface InstacartLineItem {
  name: string;
  line_item_measurements: { quantity: number; unit: string }[];
  filters?: { brand_filters?: string[]; health_filters?: string[] };
}

export interface ShoppingListRequest {
  title: string;
  link_type: "shopping_list";
  expires_in: number;
  instructions: string[];
  line_items: InstacartLineItem[];
  landing_page_configuration?: { partner_linkback_url: string };
}

const INSTACART_UNIT: Record<CartLine["unit"], string> = {
  oz: "ounce",
  lb: "pound",
  g: "gram",
  kg: "kilogram",
  floz: "fl oz",
  tsp: "teaspoon",
  tbsp: "tablespoon",
  cup: "cup",
  ml: "milliliter",
  l: "liter",
  each: "each",
};

export function lineItem(line: CartLine): InstacartLineItem {
  // The selected retailer's pack can differ from our estimate. Send the need
  // in ingredient units first; a pack count handles products missing weight
  // metadata. Counted multipacks need whole item counts, never fractional each.
  return {
    name: line.name,
    line_item_measurements: line.unit === "each"
      ? [{ quantity: line.packs * line.pack.size, unit: "each" }]
      : [
          { quantity: line.needed, unit: INSTACART_UNIT[line.unit] },
          { quantity: line.packs, unit: "package" },
        ],
  };
}

export function buildShoppingList(
  lines: CartLine[],
  opts: { title: string; linkback?: string },
): ShoppingListRequest {
  return {
    title: opts.title,
    link_type: "shopping_list",
    expires_in: 7,
    instructions: [
      "Turn on Shop with family cart before adding these items.",
      "Quantities are scaled for the household. Review the selected products and quantities; store pack sizes can differ from the planner's estimates.",
    ],
    line_items: lines.map(lineItem),
    ...(opts.linkback ? { landing_page_configuration: { partner_linkback_url: opts.linkback } } : {}),
  };
}

export function instacartConfigured(): boolean {
  return Boolean(process.env.INSTACART_API_KEY);
}

export async function createShoppingList(body: ShoppingListRequest): Promise<string> {
  const env = process.env.INSTACART_ENV === "production" ? "production" : "development";
  const res = await fetch(`${HOSTS[env]}/idp/v1/products/products_link`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.INSTACART_API_KEY}`,
    },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as { products_link_url?: string };
  if (!res.ok || !json.products_link_url) {
    throw new Error(`Instacart returned ${res.status}: ${JSON.stringify(json).slice(0, 300)}`);
  }
  return json.products_link_url;
}

/** Plain text list for the keyless fallback: copy, open Instacart, add by hand. */
export function listAsText(lines: CartLine[], title: string): string {
  const body = lines.map((l) => `- ${l.displayText}`).join("\n");
  return `${title}\n${body}\n`;
}
