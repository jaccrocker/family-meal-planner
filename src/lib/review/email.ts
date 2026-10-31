import { DAYS, type Day, type MealType } from "@/lib/engine/types";

/** One planned meal as reviewers see it: names are captured when the review starts. */
export interface PlanLine {
  day: Day;
  mealType: MealType;
  mealId: string;
  name: string;
}

export interface Email {
  subject: string;
  text: string;
  html: string;
}

const TYPES: MealType[] = ["Breakfast", "Lunch", "Dinner"];
const DAY_NAMES: Record<Day, string> = {
  Mon: "Monday",
  Tue: "Tuesday",
  Wed: "Wednesday",
  Thu: "Thursday",
  Fri: "Friday",
  Sat: "Saturday",
  Sun: "Sunday",
};

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Days in week order, each with its meals in breakfast, lunch, dinner order. Empty days are kept. */
export function planByDay(plan: PlanLine[]): { day: Day; meals: PlanLine[] }[] {
  return DAYS.map((day) => ({
    day,
    meals: TYPES.flatMap((t) => plan.filter((p) => p.day === day && p.mealType === t)),
  }));
}

function planText(plan: PlanLine[]): string {
  return planByDay(plan)
    .map(({ day, meals }) =>
      meals.length
        ? `${DAY_NAMES[day]}: ${meals.map((m) => (m.mealType === "Dinner" ? m.name : `${m.mealType}: ${m.name}`)).join("; ")}`
        : `${DAY_NAMES[day]}: nothing planned`,
    )
    .join("\n");
}

function planHtml(plan: PlanLine[]): string {
  const rows = planByDay(plan)
    .map(
      ({ day, meals }) => `<tr>
  <td style="padding:10px 12px;border-top:1px solid #e5e7eb;font-weight:600;vertical-align:top;width:110px">${DAY_NAMES[day]}</td>
  <td style="padding:10px 12px;border-top:1px solid #e5e7eb;color:${meals.length ? "#111827" : "#9ca3af"}">${
    meals.length
      ? meals
          .map((m) => `<div><span style="color:#6b7280;font-size:12px">${m.mealType}</span>&nbsp; ${esc(m.name)}</div>`)
          .join("")
      : "Nothing planned"
  }</td>
</tr>`,
    )
    .join("\n");
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:15px">${rows}</table>`;
}

function shell(body: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f4f5f2;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111827">
<div style="max-width:560px;margin:0 auto;padding:24px 16px">
<div style="font-weight:700;color:#0f6e56;font-size:18px;margin-bottom:12px">Family Meal Planner</div>
<div style="background:#ffffff;border-radius:14px;padding:20px">${body}</div>
</div></body></html>`;
}

const button = (href: string, label: string, primary: boolean) =>
  `<a href="${esc(href)}" style="display:inline-block;padding:11px 18px;border-radius:10px;text-decoration:none;font-weight:600;${
    primary ? "background:#0f6e56;color:#ffffff" : "background:#ffffff;color:#0f6e56;border:1px solid #0f6e56"
  }">${label}</a>`;

export interface ReviewEmailInput {
  creatorName: string;
  weekOf: string;
  plan: PlanLine[];
  approveUrl: string;
  editUrl: string;
  /** 0 for the first email, then 1, 2 for reminders. */
  reminder: number;
  required: boolean;
}

/** The plan email a household member gets, with one click approve and a link to propose changes. */
export function reviewEmail(i: ReviewEmailInput): Email {
  const prefix = i.reminder > 0 ? "Reminder: " : "";
  const subject = `${prefix}Approve the meal plan for the week of ${i.weekOf}`;
  const ask = i.required
    ? "Your approval is needed before the groceries are ordered."
    : "Your review is optional; the plan can go ahead without it.";
  const text = `${i.creatorName} planned meals for the week of ${i.weekOf}. ${ask}

${planText(i.plan)}

Approve: ${i.approveUrl}
Suggest changes: ${i.editUrl}
`;
  const html = shell(`<p style="margin:0 0 6px;font-size:17px;font-weight:600">${esc(i.creatorName)} planned meals for the week of ${esc(i.weekOf)}</p>
<p style="margin:0 0 16px;color:#4b5563">${ask}</p>
${planHtml(i.plan)}
<div style="margin-top:20px">${button(i.approveUrl, "Approve", true)}&nbsp;&nbsp;${button(i.editUrl, "Suggest changes", false)}</div>`);
  return { subject, text, html };
}

export type ResponseKind = "approved" | "changes" | "auto_approved";

export interface StatusEmailInput {
  reviewer: string;
  kind: ResponseKind;
  weekOf: string;
  comment?: string | null;
  changes?: string[];
  pending: number;
  approveUrl: string;
}

/** The note to the plan's creator each time a reviewer answers or is auto approved. */
export function statusEmail(i: StatusEmailInput): Email {
  const what =
    i.kind === "approved"
      ? `${i.reviewer} approved the meal plan`
      : i.kind === "changes"
        ? `${i.reviewer} suggested changes to the meal plan`
        : `${i.reviewer} did not answer, so the meal plan was approved for them`;
  const subject = `${what} for the week of ${i.weekOf}`;
  const left =
    i.pending === 0 ? "Every reviewer has answered. You can review the cart and shop." : `${i.pending} still to answer.`;
  const changes = i.changes?.length ? i.changes : [];
  const text = `${what}.
${changes.map((c) => `- ${c}`).join("\n")}${i.comment ? `\nComment: ${i.comment}` : ""}

${left}
Open the plan: ${i.approveUrl}
`;
  const html = shell(`<p style="margin:0 0 12px;font-size:17px;font-weight:600">${esc(what)}</p>
${changes.length ? `<ul style="margin:0 0 12px;padding-left:20px">${changes.map((c) => `<li>${esc(c)}</li>`).join("")}</ul>` : ""}
${i.comment ? `<p style="margin:0 0 12px;padding:10px 12px;background:#f4f5f2;border-radius:8px">${esc(i.comment)}</p>` : ""}
<p style="margin:0 0 16px;color:#4b5563">${esc(left)}</p>
${button(i.approveUrl, "Open the plan", true)}`);
  return { subject, text, html };
}

/** Plain words for what a reviewer changed, like "Tuesday dinner: Tacos instead of Pasta". */
export function describeChanges(before: PlanLine[], after: PlanLine[]): string[] {
  const key = (p: { day: Day; mealType: MealType }) => `${p.day}|${p.mealType}`;
  const was = new Map(before.map((p) => [key(p), p]));
  const now = new Map(after.map((p) => [key(p), p]));
  const out: string[] = [];
  for (const day of DAYS)
    for (const t of TYPES) {
      const k = `${day}|${t}`;
      const a = was.get(k);
      const b = now.get(k);
      const slot = `${DAY_NAMES[day]} ${t.toLowerCase()}`;
      if (a && !b) out.push(`${slot}: remove ${a.name}`);
      else if (!a && b) out.push(`${slot}: add ${b.name}`);
      else if (a && b && a.mealId !== b.mealId) out.push(`${slot}: ${b.name} instead of ${a.name}`);
    }
  return out;
}
