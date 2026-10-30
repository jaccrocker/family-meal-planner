import type { CartLine } from "@/lib/engine/types";
import { round } from "@/lib/engine/units";

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
  display_text: string;
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

const INSTACART_UNIT: Partial<Record<CartLine["unit"], string>> = {
  oz: "ounce",
  lb: "pound",
  floz: "fl oz",
  each: "each",
};

export function lineItem(line: CartLine): InstacartLineItem {
  const measurements: { quantity: number; unit: string }[] = [];
  if (line.pack.unit === "each" && line.pack.size === 1) {
    measurements.push({ quantity: line.packs, unit: "each" });
  } else {
    measurements.push({ quantity: line.packs, unit: "package" });
    const unit = INSTACART_UNIT[line.unit];
    if (unit) measurements.push({ quantity: round(line.packs * line.pack.size), unit });
  }
  return { name: line.name, display_text: line.displayText, line_item_measurements: measurements };
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
      "Quantities are already scaled for the household and rounded to whole packs.",
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
