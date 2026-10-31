import "server-only";
import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { PlannerStateSchema, type PlannerState } from "@/lib/planner";

/**
 * Household store keyed by Google account id. SQLite file for development;
 * swap this module for hosted Postgres when the public demo needs saved weeks.
 * It keeps the Google account id, email, band counts and plans, nothing more.
 */

let db: Database.Database | undefined;

/** The shared database handle, for modules that keep their own tables. */
export function database(): Database.Database {
  return open();
}

/** Tables for the household review step: settings, reviewer roles, reviews, requests and the email outbox. */
function migrateReviews(d: Database.Database) {
  d.exec(`
    create table if not exists review_settings (
      household_id integer primary key references households(id) on delete cascade,
      reminder_minutes integer not null default 60,
      reminders integer not null default 2
    );
    create table if not exists reviewers (
      household_id integer not null references households(id) on delete cascade,
      email text not null,
      required integer not null default 1,
      primary key (household_id, email)
    );
    create table if not exists reviews (
      id integer primary key,
      household_id integer not null references households(id) on delete cascade,
      creator_email text not null,
      creator_name text not null,
      week_of text not null,
      plan text not null,
      status text not null default 'open',
      reminder_minutes integer not null,
      reminders integer not null,
      created_at text not null
    );
    create table if not exists review_requests (
      id integer primary key,
      review_id integer not null references reviews(id) on delete cascade,
      email text not null,
      required integer not null,
      status text not null default 'pending',
      sends integer not null default 0,
      last_sent_at text,
      responded_at text,
      comment text,
      proposed_plan text
    );
    create table if not exists review_tokens (
      token_hash text primary key,
      request_id integer not null references review_requests(id) on delete cascade
    );
    create table if not exists calendar_links (
      household_id integer primary key references households(id) on delete cascade,
      google_email text not null,
      refresh_token text not null,
      calendar_id text,
      calendar_name text,
      connected_at text not null,
      last_sync_at text
    );
    create table if not exists outbox (
      id integer primary key,
      to_email text not null,
      subject text not null,
      body_text text not null,
      body_html text not null,
      transport text not null,
      created_at text not null,
      sent_at text,
      error text
    );
  `);
}

function open(): Database.Database {
  if (db) return db;
  const path = process.env.DATABASE_PATH ?? "data/fmp.db";
  mkdirSync(dirname(path), { recursive: true });
  db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.exec(`
    create table if not exists households (
      id integer primary key,
      owner_sub text not null unique,
      owner_email text not null,
      state text not null,
      updated_at text not null
    );
    create table if not exists members (
      household_id integer not null references households(id) on delete cascade,
      email text not null,
      primary key (household_id, email)
    );
  `);
  migrateReviews(db);
  return db;
}

export interface HouseholdRecord {
  id: number;
  ownerEmail: string;
  isOwner: boolean;
  members: string[];
  state: PlannerState;
  /** Changes on every save; writers send it back so a stale tab cannot overwrite newer changes. */
  version: string;
}

interface Row {
  id: number;
  owner_sub: string;
  owner_email: string;
  state: string;
  updated_at: string;
}

function toRecord(row: Row, sub: string): HouseholdRecord {
  const members = open()
    .prepare("select email from members where household_id = ? order by email")
    .all(row.id) as { email: string }[];
  return {
    id: row.id,
    ownerEmail: row.owner_email,
    isOwner: row.owner_sub === sub,
    members: members.map((m) => m.email),
    state: PlannerStateSchema.parse(JSON.parse(row.state)),
    version: row.updated_at,
  };
}

/**
 * The signed in person's household: one they own, or one that added their email.
 * A household they own wins, unless it is still blank (no meals planned and no
 * other adults) and someone else's household lists them. That covers an adult
 * who signed in before the owner added them, so they are not stuck in an empty
 * household of their own.
 */
export function findHousehold(sub: string, email: string): HouseholdRecord | undefined {
  const d = open();
  const own = d.prepare("select * from households where owner_sub = ?").get(sub) as Row | undefined;
  const joined = d
    .prepare(
      "select h.* from households h join members m on m.household_id = h.id where m.email = ? and h.owner_sub != ? limit 1",
    )
    .get(email.toLowerCase(), sub) as Row | undefined;
  if (own) {
    const ownRecord = toRecord(own, sub);
    const blank = ownRecord.state.plan.length === 0 && ownRecord.members.length === 0;
    if (!(blank && joined)) return ownRecord;
  }
  return joined ? toRecord(joined, sub) : undefined;
}

let lastStamp = "";

/** A save stamp that always moves forward, even for two saves in the same millisecond. */
function stamp(): string {
  let s = new Date().toISOString();
  if (s <= lastStamp) s = new Date(new Date(lastStamp).getTime() + 1).toISOString();
  lastStamp = s;
  return s;
}

export function createHousehold(sub: string, email: string, state: PlannerState): HouseholdRecord {
  open()
    .prepare("insert into households (owner_sub, owner_email, state, updated_at) values (?, ?, ?, ?)")
    .run(sub, email.toLowerCase(), JSON.stringify(state), stamp());
  return findHousehold(sub, email)!;
}

/**
 * Saves the household's state. With baseVersion, the save only lands if nobody
 * else saved since; returns the new version, or undefined on a conflict.
 */
export function saveState(id: number, state: PlannerState, baseVersion?: string): string | undefined {
  const v = stamp();
  const res =
    baseVersion === undefined
      ? open().prepare("update households set state = ?, updated_at = ? where id = ?").run(JSON.stringify(state), v, id)
      : open()
          .prepare("update households set state = ?, updated_at = ? where id = ? and updated_at = ?")
          .run(JSON.stringify(state), v, id, baseVersion);
  return res.changes === 1 ? v : undefined;
}

export function addMember(id: number, email: string): void {
  open()
    .prepare("insert or ignore into members (household_id, email) values (?, ?)")
    .run(id, email.trim().toLowerCase());
}

export function removeMember(id: number, email: string): void {
  open().prepare("delete from members where household_id = ? and email = ?").run(id, email.toLowerCase());
}

/** A household by id, for links that carry no sign in such as a reviewer's email link. */
export function householdState(id: number): PlannerState | undefined {
  const row = open().prepare("select state from households where id = ?").get(id) as { state: string } | undefined;
  return row ? PlannerStateSchema.parse(JSON.parse(row.state)) : undefined;
}

/** The household a given owner signed in with, for server to server callers such as the Alexa skill. */
export function householdByOwnerEmail(email: string): HouseholdRecord | undefined {
  const row = open().prepare("select * from households where owner_email = ?").get(email.toLowerCase()) as Row | undefined;
  return row ? toRecord(row, row.owner_sub) : undefined;
}
