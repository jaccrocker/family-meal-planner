import type { CartLine } from "@/lib/engine/types";

/**
 * Voice phrases for the official Skylight Alexa skill, one per cart item, so a
 * family member can read them to an Echo and the items land on the Skylight
 * grocery list. This uses only Skylight's supported skill; Skylight has no
 * public API. Pattern borrowed from fam-meal-planner's AlexaCommandGenerator.
 */
export interface SkylightPhrase {
  item: string;
  spoken: string;
  phrase: string;
}

const NUMBERS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];

/** Words Alexa hears cleanly: lower case, no punctuation, small counts spelled out. */
export function speakable(line: Pick<CartLine, "name" | "packs" | "pack">): string {
  const name = line.name
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  const n = Math.max(1, Math.round(line.packs));
  if (n === 1) return name;
  const count = n < NUMBERS.length ? NUMBERS[n] : String(n);
  return `${count} ${name}`;
}

/**
 * One Alexa phrase per cart line, asking Skylight to add the item to the named list
 * (default "grocery list").
 */
export function skylightPhrases(lines: CartLine[], listName = "grocery list"): SkylightPhrase[] {
  const list = listName.trim().toLowerCase() || "grocery list";
  return lines.map((l) => {
    const spoken = speakable(l);
    return { item: l.item, spoken, phrase: `Alexa, tell Skylight to add ${spoken} to my ${list}` };
  });
}
