import { DAYS, type Day, type MealType } from "@/lib/engine/types";

/**
 * Pure pieces of the Google Calendar sync: which date each planned meal falls
 * on, the event we would write, and what to create, update or delete. Our
 * events carry private extended properties, so on a shared family calendar the
 * sync only ever touches events it made. Ported from fam-meal-planner's
 * GoogleCalendarService, with Monday weeks and explicit local times.
 */
export interface MealSlot {
  day: Day;
  mealType: MealType;
  mealId: string;
  name: string;
}

export interface SlotTimes {
  start: string;
  end: string;
}

export const DEFAULT_TIMES: Record<MealType, SlotTimes> = {
  Breakfast: { start: "08:00", end: "08:30" },
  Lunch: { start: "12:00", end: "12:30" },
  Dinner: { start: "18:00", end: "19:00" },
};

export interface CalendarEvent {
  id?: string;
  summary: string;
  description: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  extendedProperties: { private: Record<string, string> };
}

/** The calendar date of a weekday in the week starting on the given Monday (YYYY-MM-DD). */
export function dateFor(weekStart: string, day: Day): string {
  const [y, m, d] = weekStart.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + DAYS.indexOf(day)));
  return dt.toISOString().slice(0, 10);
}

export function slotKey(householdId: number, weekStart: string, day: Day, mealType: MealType): string {
  return `${householdId}:${weekStart}:${day}:${mealType}`;
}

export function eventFor(
  householdId: number,
  weekStart: string,
  slot: MealSlot,
  opts: { timeZone: string; times?: Record<MealType, SlotTimes>; link?: string },
): CalendarEvent {
  const times = (opts.times ?? DEFAULT_TIMES)[slot.mealType];
  const date = dateFor(weekStart, slot.day);
  return {
    summary: `${slot.mealType}: ${slot.name}`,
    description: `Planned in Family Meal Planner.${opts.link ? `\n${opts.link}` : ""}`,
    start: { dateTime: `${date}T${times.start}:00`, timeZone: opts.timeZone },
    end: { dateTime: `${date}T${times.end}:00`, timeZone: opts.timeZone },
    extendedProperties: {
      private: {
        fmp: String(householdId),
        fmpKey: slotKey(householdId, weekStart, slot.day, slot.mealType),
        fmpMeal: slot.mealId,
      },
    },
  };
}

export interface SyncPlan {
  create: CalendarEvent[];
  update: CalendarEvent[];
  remove: { id: string; summary: string }[];
}

/** Compares our existing events for the week with the plan. Events without our tag are never in `existing`. */
export function diffEvents(existing: CalendarEvent[], desired: CalendarEvent[]): SyncPlan {
  const byKey = new Map(existing.map((e) => [e.extendedProperties.private.fmpKey, e]));
  const plan: SyncPlan = { create: [], update: [], remove: [] };
  const wanted = new Set<string>();
  for (const e of desired) {
    const key = e.extendedProperties.private.fmpKey;
    wanted.add(key);
    const have = byKey.get(key);
    if (!have) plan.create.push(e);
    else if (
      have.summary !== e.summary ||
      have.start.dateTime.slice(0, 16) !== e.start.dateTime.slice(0, 16) ||
      have.end.dateTime.slice(0, 16) !== e.end.dateTime.slice(0, 16)
    )
      plan.update.push({ ...e, id: have.id });
  }
  for (const e of existing)
    if (e.id && !wanted.has(e.extendedProperties.private.fmpKey)) plan.remove.push({ id: e.id, summary: e.summary });
  return plan;
}
