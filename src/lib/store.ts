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
  return db;
}

export interface HouseholdRecord {
  id: number;
  ownerEmail: string;
  isOwner: boolean;
  members: string[];
  state: PlannerState;
}

interface Row {
  id: number;
  owner_sub: string;
  owner_email: string;
  state: string;
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
  };
}

/** The signed in person's household: one they own, or one that added their email. */
export function findHousehold(sub: string, email: string): HouseholdRecord | undefined {
  const d = open();
  const own = d.prepare("select * from households where owner_sub = ?").get(sub) as Row | undefined;
  if (own) return toRecord(own, sub);
  const joined = d
    .prepare(
      "select h.* from households h join members m on m.household_id = h.id where m.email = ? limit 1",
    )
    .get(email.toLowerCase()) as Row | undefined;
  return joined ? toRecord(joined, sub) : undefined;
}

export function createHousehold(sub: string, email: string, state: PlannerState): HouseholdRecord {
  open()
    .prepare("insert into households (owner_sub, owner_email, state, updated_at) values (?, ?, ?, ?)")
    .run(sub, email.toLowerCase(), JSON.stringify(state), new Date().toISOString());
  return findHousehold(sub, email)!;
}

export function saveState(id: number, state: PlannerState): void {
  open()
    .prepare("update households set state = ?, updated_at = ? where id = ?")
    .run(JSON.stringify(state), new Date().toISOString(), id);
}

export function addMember(id: number, email: string): void {
  open()
    .prepare("insert or ignore into members (household_id, email) values (?, ?)")
    .run(id, email.trim().toLowerCase());
}

export function removeMember(id: number, email: string): void {
  open().prepare("delete from members where household_id = ? and email = ?").run(id, email.toLowerCase());
}
