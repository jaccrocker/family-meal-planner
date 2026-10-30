// Loads reviewed per serving amounts from the review workbook back into
// src/data/amounts.json, matching rows by meal name and ingredient.
// Usage: npx tsx scripts/import-amounts.ts "<path to Drafted Amounts.xlsx>" [--reviewed]

import ExcelJS from "exceljs";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const UNIT_IN: Record<string, string> = { "fl oz": "floz" };

async function main() {
  const [path, flag] = process.argv.slice(2);
  if (!path) throw new Error("Pass the workbook path as the first argument");
  const root = process.cwd();
  const meals = JSON.parse(readFileSync(join(root, "src/data/meals.json"), "utf8")) as { id: string; name: string }[];
  const file = join(root, "src/data/amounts.json");
  const amounts = JSON.parse(readFileSync(file, "utf8"));
  const idByName = new Map(meals.map((m) => [m.name, m.id]));

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path);
  let changed = 0;
  const reviewedMeals = new Set<string>();

  for (const sheetName of ["Dinners", "Breakfast and lunch"]) {
    wb.getWorksheet(sheetName)?.eachRow((row, n) => {
      if (n === 1) return;
      const mealId = idByName.get(String(row.getCell(1).value));
      const ingredient = String(row.getCell(2).value);
      const qty = Number(row.getCell(3).value);
      const unitRaw = String(row.getCell(4).value);
      const unit = UNIT_IN[unitRaw] ?? unitRaw;
      if (!mealId) throw new Error(`Row ${n} on ${sheetName}: unknown meal`);
      const entry = amounts.meals[mealId]?.ingredients.find((i: { ingredient: string }) => i.ingredient === ingredient);
      if (!entry) throw new Error(`Row ${n} on ${sheetName}: ${ingredient} is not in ${mealId}`);
      if (!(qty > 0)) throw new Error(`Row ${n} on ${sheetName}: amount must be above zero`);
      if (entry.qty !== qty || entry.unit !== unit) {
        entry.qty = qty;
        entry.unit = unit;
        changed++;
      }
      if (sheetName === "Dinners") reviewedMeals.add(mealId);
    });
  }

  if (flag === "--reviewed") {
    for (const id of reviewedMeals) amounts.meals[id].reviewed = true;
  }
  writeFileSync(file, JSON.stringify(amounts, null, 2) + "\n");
  console.log(`Updated ${changed} amounts; run npm test to check units still match pack sizes.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
