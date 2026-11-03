import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { mealsFor, type PlannerState } from "@/lib/planner";
import { database, type HouseholdRecord } from "@/lib/store";
import { describeChanges, reviewEmail, statusEmail, type PlanLine, type ResponseKind } from "./email";
import { sendMail } from "./mailer";

/** State of one reviewer's request. Both approved and auto_approved count as approval. */
export type RequestStatus = "pending" | "approved" | "changes" | "auto_approved";

/** Reminder timing for a household: minutes between emails and how many reminders follow the first email. */
export interface ReviewSettings {
  reminderMinutes: number;
  reminders: number;
}

/** A household person and whether their approval is required. */
export interface ReviewerSetting {
  email: string;
  required: boolean;
}

/** One reviewer's request on a review, with their answer and any proposed plan. */
export interface RequestView {
  id: number;
  email: string;
  required: boolean;
  status: RequestStatus;
  sends: number;
  lastSentAt: string | null;
  respondedAt: string | null;
  comment: string | null;
  changes: string[];
  proposedPlan: PlanLine[] | null;
}

/** A review of a week's plan with its requests. */
export interface ReviewView {
  id: number;
  weekOf: string;
  creatorEmail: string;
  creatorName: string;
  status: "open" | "closed";
  plan: PlanLine[];
  createdAt: string;
  reminderMinutes: number;
  reminders: number;
  requests: RequestView[];
  /** True when every required reviewer has approved or been auto approved. */
  ready: boolean;
}

/** Settings used when a household has not saved its own. */
export const DEFAULT_SETTINGS: ReviewSettings = { reminderMinutes: 60, reminders: 2 };

const hash = (token: string) => createHash("sha256").update(token).digest("hex");
const now = () => new Date().toISOString();

function baseUrl(): string {
  return (process.env.APP_URL ?? process.env.AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

/** Everyone in the household who can review: the owner and the other adults. */
export function householdPeople(record: HouseholdRecord): string[] {
  return [...new Set([record.ownerEmail, ...record.members].map((e) => e.toLowerCase()))];
}

/** The household's review settings, or DEFAULT_SETTINGS when none are saved. */
export function getSettings(householdId: number): ReviewSettings {
  const row = database()
    .prepare("select reminder_minutes, reminders from review_settings where household_id = ?")
    .get(householdId) as { reminder_minutes: number; reminders: number } | undefined;
  return row ? { reminderMinutes: row.reminder_minutes, reminders: row.reminders } : DEFAULT_SETTINGS;
}

/** Saves the household's review settings, replacing any earlier ones. */
export function saveSettings(householdId: number, s: ReviewSettings): void {
  database()
    .prepare(
      `insert into review_settings (household_id, reminder_minutes, reminders) values (?, ?, ?)
       on conflict(household_id) do update set reminder_minutes = excluded.reminder_minutes, reminders = excluded.reminders`,
    )
    .run(householdId, s.reminderMinutes, s.reminders);
}

/** Everyone who can review with their required flag. People without a saved flag are required. */
export function getReviewers(record: HouseholdRecord): ReviewerSetting[] {
  const rows = database()
    .prepare("select email, required from reviewers where household_id = ?")
    .all(record.id) as { email: string; required: number }[];
  const flags = new Map(rows.map((r) => [r.email, r.required === 1]));
  return householdPeople(record).map((email) => ({ email, required: flags.get(email) ?? true }));
}

/** Sets whether a person's approval is required, stored by lower case email. */
export function setReviewerRequired(householdId: number, email: string, required: boolean): void {
  database()
    .prepare(
      `insert into reviewers (household_id, email, required) values (?, ?, ?)
       on conflict(household_id, email) do update set required = excluded.required`,
    )
    .run(householdId, email.toLowerCase(), required ? 1 : 0);
}

/** The plan with meal names attached, so emails read the same even if the library changes. */
export function planLines(state: PlannerState): PlanLine[] {
  const meals = mealsFor(state);
  return state.plan.map((p) => ({ day: p.day, mealType: p.mealType, mealId: p.mealId, name: meals.get(p.mealId)?.name ?? p.mealId }));
}

interface ReviewRow {
  id: number;
  household_id: number;
  creator_email: string;
  creator_name: string;
  week_of: string;
  plan: string;
  status: "open" | "closed";
  reminder_minutes: number;
  reminders: number;
  created_at: string;
}

interface RequestRow {
  id: number;
  review_id: number;
  email: string;
  required: number;
  status: RequestStatus;
  sends: number;
  last_sent_at: string | null;
  responded_at: string | null;
  comment: string | null;
  proposed_plan: string | null;
}

function toView(r: ReviewRow): ReviewView {
  const plan = JSON.parse(r.plan) as PlanLine[];
  const requests = (
    database().prepare("select * from review_requests where review_id = ? order by email").all(r.id) as RequestRow[]
  ).map((q) => {
    const proposed = q.proposed_plan ? (JSON.parse(q.proposed_plan) as PlanLine[]) : null;
    return {
      id: q.id,
      email: q.email,
      required: q.required === 1,
      status: q.status,
      sends: q.sends,
      lastSentAt: q.last_sent_at,
      respondedAt: q.responded_at,
      comment: q.comment,
      proposedPlan: proposed,
      changes: proposed ? describeChanges(plan, proposed) : [],
    };
  });
  const ready = requests.every((q) => !q.required || q.status === "approved" || q.status === "auto_approved");
  return {
    id: r.id,
    weekOf: r.week_of,
    creatorEmail: r.creator_email,
    creatorName: r.creator_name,
    status: r.status,
    plan,
    createdAt: r.created_at,
    reminderMinutes: r.reminder_minutes,
    reminders: r.reminders,
    requests,
    ready,
  };
}

/** The household's newest review, open or closed. */
export function currentReview(householdId: number): ReviewView | undefined {
  const row = database()
    .prepare("select * from reviews where household_id = ? order by id desc limit 1")
    .get(householdId) as ReviewRow | undefined;
  return row ? toView(row) : undefined;
}

function links(token: string) {
  const base = `${baseUrl()}/r/${token}`;
  return { approveUrl: `${base}?action=approve`, editUrl: base };
}

/**
 * Starts a review of the current plan: closes any open one, then emails every
 * household person except the creator. Tokens are random, and only their hashes are stored.
 */
export async function startReview(
  record: HouseholdRecord,
  creator: { email: string; name: string },
  weekOf: string,
): Promise<ReviewView> {
  const d = database();
  const settings = getSettings(record.id);
  const reviewers = getReviewers(record).filter((r) => r.email !== creator.email.toLowerCase());
  const plan = planLines(record.state);
  d.prepare("update reviews set status = 'closed' where household_id = ? and status = 'open'").run(record.id);
  const { lastInsertRowid } = d
    .prepare(
      `insert into reviews (household_id, creator_email, creator_name, week_of, plan, status, reminder_minutes, reminders, created_at)
       values (?, ?, ?, ?, ?, 'open', ?, ?, ?)`,
    )
    .run(record.id, creator.email.toLowerCase(), creator.name, weekOf, JSON.stringify(plan), settings.reminderMinutes, settings.reminders, now());
  const reviewId = Number(lastInsertRowid);
  for (const r of reviewers) {
    const { lastInsertRowid: requestId } = d
      .prepare("insert into review_requests (review_id, email, required, sends, last_sent_at) values (?, ?, ?, 1, ?)")
      .run(reviewId, r.email, r.required ? 1 : 0, now());
    const token = issueToken(Number(requestId));
    await sendMail(
      r.email,
      reviewEmail({ creatorName: creator.name, weekOf, plan, ...links(token), reminder: 0, required: r.required }),
    );
  }
  return currentReview(record.id)!;
}

/** What a reviewer link resolves to: the review, that reviewer's request and the household id. */
export interface TokenLookup {
  review: ReviewView;
  request: RequestView;
  householdId: number;
}

function issueToken(requestId: number): string {
  const token = randomBytes(24).toString("base64url");
  database().prepare("insert into review_tokens (token_hash, request_id) values (?, ?)").run(hash(token), requestId);
  return token;
}

/** Finds the review a reviewer's link belongs to. Links stop working once a newer review starts. */
export function lookupToken(token: string): TokenLookup | undefined {
  const d = database();
  const q = d
    .prepare("select q.* from review_tokens t join review_requests q on q.id = t.request_id where t.token_hash = ?")
    .get(hash(token)) as RequestRow | undefined;
  if (!q) return undefined;
  const r = d.prepare("select * from reviews where id = ?").get(q.review_id) as ReviewRow;
  const review = toView(r);
  return { review, request: review.requests.find((x) => x.id === q.id)!, householdId: r.household_id };
}

async function notifyCreator(review: ReviewView, reviewer: string, kind: ResponseKind, comment: string | null, changes: string[]) {
  const fresh = currentReviewById(review.id);
  const pending = fresh.requests.filter((q) => q.status === "pending").length;
  await sendMail(
    review.creatorEmail,
    statusEmail({ reviewer, kind, weekOf: review.weekOf, comment, changes, pending, approveUrl: `${baseUrl()}/approve` }),
  );
}

function currentReviewById(id: number): ReviewView {
  return toView(database().prepare("select * from reviews where id = ?").get(id) as ReviewRow);
}

/** A reviewer approves, or proposes a changed plan with a comment. The creator gets an email either way. */
export async function respond(
  token: string,
  answer: { kind: "approved" } | { kind: "changes"; plan: PlanLine[]; comment: string },
): Promise<TokenLookup | { error: string }> {
  const found = lookupToken(token);
  if (!found) return { error: "This link is not valid." };
  if (found.review.status !== "open") return { error: "This plan was replaced by a newer one." };
  const d = database();
  if (answer.kind === "approved") {
    d.prepare("update review_requests set status = 'approved', responded_at = ? where id = ?").run(now(), found.request.id);
    await notifyCreator(found.review, found.request.email, "approved", null, []);
  } else {
    const comment = answer.comment.trim().slice(0, 1000);
    d.prepare(
      "update review_requests set status = 'changes', responded_at = ?, comment = ?, proposed_plan = ? where id = ?",
    ).run(now(), comment || null, JSON.stringify(answer.plan), found.request.id);
    await notifyCreator(found.review, found.request.email, "changes", comment || null, describeChanges(found.review.plan, answer.plan));
  }
  return lookupToken(token)!;
}

/** The creator settles a request in the app, for example after taking a reviewer's changes. */
export function closeReview(householdId: number): void {
  database().prepare("update reviews set status = 'closed' where household_id = ? and status = 'open'").run(householdId);
}

/**
 * Runs every minute. A reviewer who has not answered gets a reminder each
 * interval, up to the review's reminder count; once the interval after the last
 * email passes, they are approved automatically and the creator is told.
 * Each reminder carries a fresh link; earlier links keep working.
 */
export async function tick(at = new Date()): Promise<number> {
  const d = database();
  const rows = d
    .prepare(
      `select q.*, r.reminder_minutes, r.reminders from review_requests q join reviews r on r.id = q.review_id
       where r.status = 'open' and q.status = 'pending'`,
    )
    .all() as (RequestRow & { reminder_minutes: number; reminders: number })[];
  let acted = 0;
  for (const q of rows) {
    const last = q.last_sent_at ? new Date(q.last_sent_at).getTime() : 0;
    if (at.getTime() - last < q.reminder_minutes * 60_000) continue;
    const review = currentReviewById(q.review_id);
    if (q.sends <= q.reminders) {
      d.prepare("update review_requests set sends = sends + 1, last_sent_at = ? where id = ?").run(at.toISOString(), q.id);
      const token = issueToken(q.id);
      await sendMail(
        q.email,
        reviewEmail({
          creatorName: review.creatorName,
          weekOf: review.weekOf,
          plan: review.plan,
          ...links(token),
          reminder: q.sends,
          required: q.required === 1,
        }),
      );
    } else {
      d.prepare("update review_requests set status = 'auto_approved', responded_at = ? where id = ?").run(at.toISOString(), q.id);
      await notifyCreator(review, q.email, "auto_approved", null, []);
    }
    acted++;
  }
  return acted;
}
