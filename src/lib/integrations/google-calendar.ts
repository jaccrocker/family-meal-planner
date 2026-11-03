import "server-only";
import { database } from "@/lib/store";
import { diffEvents, eventFor, type CalendarEvent, type MealSlot, type SyncPlan } from "./calendar";
import { open, seal } from "./secret-box";

/**
 * Google Calendar for the family calendar named by CALENDAR_NAME (default
 * "Home"). A separate consent from sign in, asking only to read the
 * calendar list and edit events, so plain sign in needs no extra scopes.
 */
export const SCOPES = [
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
  "https://www.googleapis.com/auth/calendar.events",
  "openid",
  "email",
];

/** Name of the family calendar to sync to, from CALENDAR_NAME. */
export const calendarName = () => process.env.CALENDAR_NAME ?? "Home";
/** Time zone for written events, from CALENDAR_TZ. */
export const calendarTimeZone = () => process.env.CALENDAR_TZ ?? "America/Los_Angeles";
const base = () => (process.env.APP_URL ?? process.env.AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
/** The OAuth callback URL, built from APP_URL or AUTH_URL. */
export const redirectUri = () => `${base()}/api/calendar/callback`;

/** The Google consent URL that requests offline access, with the given value passed back as state. */
export function authUrl(state: string): string {
  const q = new URLSearchParams({
    client_id: process.env.AUTH_GOOGLE_ID ?? "",
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
}

async function tokenRequest(body: Record<string, string>) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.AUTH_GOOGLE_ID ?? "",
      client_secret: process.env.AUTH_GOOGLE_SECRET ?? "",
      ...body,
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Google token ${res.status}: ${json.error ?? "error"}`);
  return json as { access_token: string; refresh_token?: string; id_token?: string };
}

async function api<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`https://www.googleapis.com/calendar/v3${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (res.status === 204 || res.status === 410) return undefined as T;
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Google Calendar ${res.status}: ${json.error?.message ?? "error"}`);
  return json as T;
}

/** Finds the family calendar by name among calendars this account can edit. Never creates one. */
async function findCalendar(token: string): Promise<{ id: string; summary: string } | undefined> {
  const list = await api<{ items: { id: string; summary: string; accessRole: string }[] }>(
    token,
    "/users/me/calendarList?minAccessRole=writer",
  );
  return list.items.find((c) => c.summary.trim().toLowerCase() === calendarName().toLowerCase());
}

/** A household's stored calendar connection. calendarId is null until the family calendar is found. */
export interface CalendarLink {
  googleEmail: string;
  calendarId: string | null;
  calendarName: string | null;
  connectedAt: string;
  lastSyncAt: string | null;
}

/** The household's calendar connection, or undefined when none exists. The refresh token is not returned. */
export function getLink(householdId: number): CalendarLink | undefined {
  const r = database().prepare("select * from calendar_links where household_id = ?").get(householdId) as
    | { google_email: string; calendar_id: string | null; calendar_name: string | null; connected_at: string; last_sync_at: string | null }
    | undefined;
  return r
    ? { googleEmail: r.google_email, calendarId: r.calendar_id, calendarName: r.calendar_name, connectedAt: r.connected_at, lastSyncAt: r.last_sync_at }
    : undefined;
}

function emailFromIdToken(idToken?: string): string {
  try {
    return JSON.parse(Buffer.from((idToken ?? "").split(".")[1], "base64url").toString()).email ?? "unknown";
  } catch {
    return "unknown";
  }
}

/** Finishes consent: keeps the sealed refresh token and looks up the family calendar. */
export async function connect(householdId: number, code: string): Promise<CalendarLink> {
  const t = await tokenRequest({ code, grant_type: "authorization_code", redirect_uri: redirectUri() });
  if (!t.refresh_token) throw new Error("Google did not return a refresh token; remove the app's access and connect again");
  const cal = await findCalendar(t.access_token);
  database()
    .prepare(
      `insert into calendar_links (household_id, google_email, refresh_token, calendar_id, calendar_name, connected_at)
       values (?, ?, ?, ?, ?, ?)
       on conflict(household_id) do update set google_email = excluded.google_email, refresh_token = excluded.refresh_token,
         calendar_id = excluded.calendar_id, calendar_name = excluded.calendar_name, connected_at = excluded.connected_at`,
    )
    .run(householdId, emailFromIdToken(t.id_token), seal(t.refresh_token), cal?.id ?? null, cal?.summary ?? null, new Date().toISOString());
  return getLink(householdId)!;
}

/** Deletes the household's calendar connection and its stored token. */
export function disconnect(householdId: number): void {
  database().prepare("delete from calendar_links where household_id = ?").run(householdId);
}

async function accessToken(householdId: number): Promise<{ token: string; calendarId: string }> {
  const r = database().prepare("select refresh_token, calendar_id from calendar_links where household_id = ?").get(householdId) as
    | { refresh_token: string; calendar_id: string | null }
    | undefined;
  if (!r) throw new Error("Google Calendar is not connected");
  const t = await tokenRequest({ refresh_token: open(r.refresh_token), grant_type: "refresh_token" });
  let calendarId = r.calendar_id;
  if (!calendarId) {
    const cal = await findCalendar(t.access_token);
    if (!cal) throw new Error(`No calendar named ${calendarName()} that this account can edit`);
    calendarId = cal.id;
    database().prepare("update calendar_links set calendar_id = ?, calendar_name = ? where household_id = ?").run(cal.id, cal.summary, householdId);
  }
  return { token: t.access_token, calendarId };
}

/** Outcome of a sync: event labels grouped by the action taken or planned, and whether changes were applied. */
export interface SyncResult {
  calendarName: string | null;
  plan: { create: string[]; update: string[]; remove: string[] };
  applied: boolean;
}

const names = (p: SyncPlan) => ({
  create: p.create.map((e) => `${e.start.dateTime.slice(0, 10)} ${e.summary}`),
  update: p.update.map((e) => `${e.start.dateTime.slice(0, 10)} ${e.summary}`),
  remove: p.remove.map((e) => e.summary),
});

/**
 * Brings the family calendar in line with the week's plan. With dryRun, only
 * reports what would change. Only events tagged with this household are read or changed.
 */
export async function syncWeek(householdId: number, weekStart: string, slots: MealSlot[], dryRun: boolean): Promise<SyncResult> {
  const { token, calendarId } = await accessToken(householdId);
  const cal = encodeURIComponent(calendarId);
  const [y, m, d] = weekStart.split("-").map(Number);
  const timeMin = new Date(Date.UTC(y, m - 1, d - 1)).toISOString();
  const timeMax = new Date(Date.UTC(y, m - 1, d + 8)).toISOString();
  const q = new URLSearchParams({ timeMin, timeMax, singleEvents: "true", privateExtendedProperty: `fmp=${householdId}`, maxResults: "100" });
  const existing = (await api<{ items: CalendarEvent[] }>(token, `/calendars/${cal}/events?${q}`)).items.filter((e) =>
    e.extendedProperties?.private?.fmpKey?.includes(`:${weekStart}:`),
  );
  const desired = slots.map((s) => eventFor(householdId, weekStart, s, { timeZone: calendarTimeZone(), link: base() }));
  const plan = diffEvents(existing, desired);
  if (!dryRun) {
    for (const e of plan.create) await api(token, `/calendars/${cal}/events`, { method: "POST", body: JSON.stringify(e) });
    for (const e of plan.update)
      await api(token, `/calendars/${cal}/events/${encodeURIComponent(e.id!)}`, { method: "PUT", body: JSON.stringify(e) });
    for (const e of plan.remove) await api(token, `/calendars/${cal}/events/${encodeURIComponent(e.id)}`, { method: "DELETE" });
    database().prepare("update calendar_links set last_sync_at = ? where household_id = ?").run(new Date().toISOString(), householdId);
  }
  return { calendarName: getLink(householdId)?.calendarName ?? null, plan: names(plan), applied: !dryRun };
}
