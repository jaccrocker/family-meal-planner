import { DEFAULT_STAPLES } from "@/lib/engine/library";
import type { Household, PlanEntry } from "@/lib/engine/types";

/** The sample household and week that demo mode runs with no sign in or keys. */
export const DEMO_HOUSEHOLD: Household = {
  adults: 2,
  kids4to10: 1,
  kids11to18: 1,
  multipliers: { adult: 1, kid4to10: 0.5, kid11to18: 0.85 },
  staples: DEFAULT_STAPLES,
};

/** The sample week of meals for demo mode, using library meal ids. */
export const DEMO_PLAN: PlanEntry[] = [
  { day: "Mon", mealType: "Dinner", mealId: "M21" }, // Chicken Fajitas
  { day: "Tue", mealType: "Lunch", mealId: "M10" }, // Leftover Chicken Fajitas
  { day: "Tue", mealType: "Dinner", mealId: "M20" }, // Chicken Broccoli Alfredo Pasta
  { day: "Wed", mealType: "Dinner", mealId: "M27" }, // Salmon with Asparagus and Couscous
  { day: "Thu", mealType: "Dinner", mealId: "M31" }, // Stuffed Peppers
  { day: "Fri", mealType: "Dinner", mealId: "M32" }, // Takeout/Delivery Night
];
