// Builds src/data/meals.json from the Preloaded Meals spreadsheet.
// Usage: npx tsx scripts/import-meals.ts "<path to Preloaded Meals.xlsx>"
//
// The spreadsheet lists each meal's ingredients but no amounts. Amounts per
// serving live in src/data/amounts.json and pack sizes in src/data/catalog.json,
// both reviewed by hand, so re-running this script never changes quantities.

import ExcelJS from "exceljs";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

type MealType = "Breakfast" | "Lunch" | "Dinner";

interface RawMeal {
  id: string;
  type: MealType;
  name: string;
  description: string;
  instructions: string;
  ingredients: { name: string; category: string }[];
}

// Leftover lunches cook extra servings of a dinner instead of adding groceries.
const LEFTOVER_OF: Record<string, string> = {
  M08: "M19",
  M09: "M20",
  M10: "M21",
  M11: "M26",
  M12: "M27",
  M13: "M28",
  M14: "M31",
  M15: "M33",
};
const NO_GROCERIES = new Set(["M32"]); // Takeout/Delivery Night

function text(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object" && "result" in v) return String(v.result ?? "");
  return String(v).trim();
}

async function main() {
  const path = process.argv[2];
  if (!path) throw new Error("Pass the spreadsheet path as the first argument");
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path);

  const meals = new Map<string, RawMeal>();
  wb.getWorksheet("Meals")!.eachRow((row, n) => {
    if (n === 1) return;
    const id = text(row.getCell(1).value);
    if (!id) return;
    meals.set(id, {
      id,
      type: text(row.getCell(2).value) as MealType,
      name: text(row.getCell(3).value),
      description: text(row.getCell(4).value),
      instructions: text(row.getCell(7).value),
      ingredients: [],
    });
  });

  wb.getWorksheet("Meal Ingredients")!.eachRow((row, n) => {
    if (n === 1) return;
    const meal = meals.get(text(row.getCell(1).value));
    if (!meal) return;
    meal.ingredients.push({
      name: text(row.getCell(4).value).toLowerCase(),
      category: text(row.getCell(5).value),
    });
  });

  const out = [...meals.values()].map((m) => ({
    ...m,
    ...(LEFTOVER_OF[m.id] ? { leftoverOf: LEFTOVER_OF[m.id] } : {}),
    ...(NO_GROCERIES.has(m.id) ? { noGroceries: true } : {}),
  }));

  const file = join(process.cwd(), "src/data/meals.json");
  writeFileSync(file, JSON.stringify(out, null, 2) + "\n");
  const rows = out.reduce((s, m) => s + m.ingredients.length, 0);
  console.log(`Wrote ${out.length} meals and ${rows} ingredient rows to ${file}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
