import { DAYS, type Day, type MealType } from "@/lib/engine/types";
import { firstOpenDay, mealsFor, type PlannerState } from "@/lib/planner";

/**
 * Voice commands from the Alexa skill, applied to a household's plan. Pure:
 * takes the state and a command, returns the new state and what Alexa says.
 */
export type VoiceCommand =
  | { action: "add"; meal: string; day?: string; mealType?: string }
  | { action: "move"; fromDay: string; toDay: string; mealType?: string }
  | { action: "remove"; day: string; mealType?: string }
  | { action: "whats"; day?: string; mealType?: string };

/** Outcome of a voice command: the resulting state, what Alexa says, and whether the plan changed. */
export interface VoiceResult {
  state: PlannerState;
  speech: string;
  changed: boolean;
}

const DAY_WORDS: Record<string, Day> = {
  monday: "Mon", mon: "Mon", tuesday: "Tue", tue: "Tue", wednesday: "Wed", wed: "Wed", thursday: "Thu", thu: "Thu",
  friday: "Fri", fri: "Fri", saturday: "Sat", sat: "Sat", sunday: "Sun", sun: "Sun",
};
const DAY_NAMES: Record<Day, string> = {
  Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday", Fri: "Friday", Sat: "Saturday", Sun: "Sunday",
};

/** Maps a spoken weekday (full or short name, any case) to a Day, or undefined if unrecognized. */
export function parseDay(word?: string): Day | undefined {
  return word ? DAY_WORDS[word.trim().toLowerCase()] : undefined;
}

/** Maps a spoken meal word (for example breakfast, lunch, supper) to a MealType, or undefined. */
export function parseMealType(word?: string): MealType | undefined {
  const w = word?.trim().toLowerCase();
  if (!w) return undefined;
  if (w.startsWith("break")) return "Breakfast";
  if (w.startsWith("lunch")) return "Lunch";
  if (w.startsWith("dinner") || w.startsWith("supper")) return "Dinner";
  return undefined;
}

const words = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !["with", "and", "the", "a", "of", "in"].includes(w));

/** Best library match for a spoken meal name, or undefined when nothing is close. */
export function matchMeal(state: PlannerState, spoken: string, type?: MealType) {
  const said = words(spoken);
  if (said.length === 0) return undefined;
  let best: { id: string; name: string; type: MealType; score: number } | undefined;
  for (const m of mealsFor(state).values()) {
    if (m.leftoverOf || (type && m.type !== type)) continue;
    const name = words(m.name);
    const hits = said.filter((w) => name.some((n) => n === w || n.startsWith(w) || w.startsWith(n))).length;
    const score = hits / said.length + hits / name.length / 2 + (m.name.toLowerCase().includes(spoken.toLowerCase().trim()) ? 1 : 0);
    if (hits > 0 && (!best || score > best.score)) best = { id: m.id, name: m.name, type: m.type, score };
  }
  return best && best.score >= 0.75 ? best : undefined;
}

function nameOf(state: PlannerState, id: string): string {
  return mealsFor(state).get(id)?.name ?? "that meal";
}

/**
 * Applies a voice command to the plan. Add replaces any meal in that slot; move swaps
 * with a meal already on the target day; remove clears a slot; whats reads the plan back.
 * Meal type defaults to dinner for move, remove and whats. Unclear commands leave the
 * state unchanged and return a question or an apology to speak.
 */
export function applyVoice(state: PlannerState, cmd: VoiceCommand): VoiceResult {
  const keep = (speech: string): VoiceResult => ({ state, speech, changed: false });
  const type = parseMealType("mealType" in cmd ? cmd.mealType : undefined);

  if (cmd.action === "add") {
    const meal = matchMeal(state, cmd.meal, type);
    if (!meal) return keep(`I couldn't find ${cmd.meal} in your meals.`);
    const slot = type ?? meal.type;
    const day = parseDay(cmd.day) ?? firstOpenDay(state.plan, slot);
    const replaced = state.plan.find((p) => p.day === day && p.mealType === slot);
    const plan = [...state.plan.filter((p) => !(p.day === day && p.mealType === slot)), { day, mealType: slot, mealId: meal.id }];
    const was = replaced ? `, replacing ${nameOf(state, replaced.mealId)}` : "";
    return { state: { ...state, plan }, speech: `Added ${meal.name} for ${DAY_NAMES[day]} ${slot.toLowerCase()}${was}.`, changed: true };
  }

  if (cmd.action === "move") {
    const from = parseDay(cmd.fromDay);
    const to = parseDay(cmd.toDay);
    const slot = type ?? "Dinner";
    if (!from || !to) return keep("Which days should I move it between?");
    const entry = state.plan.find((p) => p.day === from && p.mealType === slot);
    if (!entry) return keep(`There's no ${slot.toLowerCase()} planned on ${DAY_NAMES[from]}.`);
    const there = state.plan.find((p) => p.day === to && p.mealType === slot);
    // Moving onto a planned day swaps the two meals.
    const plan = state.plan
      .filter((p) => p !== entry && p !== there)
      .concat({ ...entry, day: to }, ...(there ? [{ ...there, day: from }] : []));
    const swap = there ? ` and ${nameOf(state, there.mealId)} to ${DAY_NAMES[from]}` : "";
    return {
      state: { ...state, plan },
      speech: `Moved ${nameOf(state, entry.mealId)} to ${DAY_NAMES[to]}${swap}.`,
      changed: true,
    };
  }

  if (cmd.action === "remove") {
    const day = parseDay(cmd.day);
    const slot = type ?? "Dinner";
    if (!day) return keep("Which day should I clear?");
    const entry = state.plan.find((p) => p.day === day && p.mealType === slot);
    if (!entry) return keep(`Nothing is planned for ${DAY_NAMES[day]} ${slot.toLowerCase()}.`);
    return {
      state: { ...state, plan: state.plan.filter((p) => p !== entry) },
      speech: `Removed ${nameOf(state, entry.mealId)} from ${DAY_NAMES[day]}.`,
      changed: true,
    };
  }

  const day = parseDay(cmd.day);
  const slot = type ?? "Dinner";
  const days = day ? [day] : [...DAYS];
  const said = days
    .map((d) => {
      const e = state.plan.find((p) => p.day === d && p.mealType === slot);
      return e ? `${DAY_NAMES[d]}, ${nameOf(state, e.mealId)}` : day ? `${DAY_NAMES[d]}, nothing yet` : null;
    })
    .filter(Boolean);
  return keep(said.length ? `${slot} plan: ${said.join("; ")}.` : `No ${slot.toLowerCase()}s planned yet.`);
}
