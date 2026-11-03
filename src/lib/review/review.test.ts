import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { describeChanges, reviewEmail, type PlanLine } from "./email";

process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), "fmp-review-")), "test.db");
process.env.EMAIL_TRANSPORT = "log";
process.env.APP_URL = "https://meals.example.test";

const plan: PlanLine[] = [
  { day: "Mon", mealType: "Dinner", mealId: "M21", name: "Chicken Fajitas" },
  { day: "Tue", mealType: "Dinner", mealId: "M20", name: "Chicken Broccoli Alfredo Pasta" },
];

describe("review email", () => {
  it("lists every day, keeps empty days, and carries both links", () => {
    const e = reviewEmail({
      creatorName: "Jane",
      weekOf: "Nov 2",
      plan,
      approveUrl: "https://x/r/t?action=approve",
      editUrl: "https://x/r/t",
      reminder: 0,
      required: true,
    });
    expect(e.subject).toBe("Approve the meal plan for the week of Nov 2");
    expect(e.text).toContain("Monday: Chicken Fajitas");
    expect(e.text).toContain("Wednesday: nothing planned");
    expect(e.html).toContain("https://x/r/t?action=approve");
    expect(e.html).toContain("Suggest changes");
  });

  it("marks reminders and escapes names", () => {
    const e = reviewEmail({
      creatorName: "<b>Jane</b>",
      weekOf: "Nov 2",
      plan,
      approveUrl: "a",
      editUrl: "b",
      reminder: 2,
      required: false,
    });
    expect(e.subject.startsWith("Reminder: ")).toBe(true);
    expect(e.html).not.toContain("<b>Jane</b>");
    expect(e.text).toContain("optional");
  });

  it("describes changes in plain words", () => {
    const after: PlanLine[] = [
      { day: "Mon", mealType: "Dinner", mealId: "M27", name: "Salmon" },
      { day: "Wed", mealType: "Dinner", mealId: "M31", name: "Stuffed Peppers" },
    ];
    expect(describeChanges(plan, after)).toEqual([
      "Monday dinner: Salmon instead of Chicken Fajitas",
      "Tuesday dinner: remove Chicken Broccoli Alfredo Pasta",
      "Wednesday dinner: add Stuffed Peppers",
    ]);
  });
});

describe("review loop", () => {
  let svc: typeof import("./service");
  let store: typeof import("@/lib/store");
  let planner: typeof import("@/lib/planner");

  beforeAll(async () => {
    store = await import("@/lib/store");
    svc = await import("./service");
    planner = await import("@/lib/planner");
  });

  async function setup(ownerEmail: string, others: string[]) {
    const created = store.createHousehold(`sub-${ownerEmail}`, ownerEmail, planner.DEMO_STATE);
    for (const o of others) store.addMember(created.id, o);
    return store.findHousehold(`sub-${ownerEmail}`, ownerEmail)!;
  }

  const outbox = (to: string) =>
    store.database().prepare("select subject from outbox where to_email = ? order by id").all(to) as { subject: string }[];

  it("emails everyone but the creator, then reminds twice and auto approves after the third hour", async () => {
    const record = await setup("owner1@example.test", ["a1@example.test", "b1@example.test"]);
    svc.setReviewerRequired(record.id, "b1@example.test", false);
    const start = new Date();
    const review = await svc.startReview(record, { email: "owner1@example.test", name: "Owner" }, "Nov 2");
    expect(review.requests.map((r) => r.email)).toEqual(["a1@example.test", "b1@example.test"]);
    expect(outbox("owner1@example.test")).toHaveLength(0);
    expect(outbox("a1@example.test")).toHaveLength(1);
    expect(review.ready).toBe(false);

    const hour = (h: number) => new Date(start.getTime() + h * 60 * 60_000 + 1000);
    await svc.tick(hour(0.5));
    expect(outbox("a1@example.test")).toHaveLength(1);
    await svc.tick(hour(1));
    await svc.tick(hour(2));
    expect(outbox("a1@example.test").map((m) => m.subject.startsWith("Reminder"))).toEqual([false, true, true]);
    await svc.tick(hour(3));
    const after = svc.currentReview(record.id)!;
    expect(after.requests.every((r) => r.status === "auto_approved")).toBe(true);
    expect(after.ready).toBe(true);
    expect(outbox("owner1@example.test").length).toBe(2);
  });

  it("lets a reviewer approve or propose changes, and old links survive reminders", async () => {
    const record = await setup("owner2@example.test", ["a2@example.test"]);
    await svc.startReview(record, { email: "owner2@example.test", name: "Owner" }, "Nov 2");
    const html = store
      .database()
      .prepare("select body_text from outbox where to_email = ? order by id desc limit 1")
      .get("a2@example.test") as { body_text: string };
    const token = /\/r\/([\w-]+)\?action=approve/.exec(html.body_text)![1];
    await svc.tick(new Date(Date.now() + 61 * 60_000));
    expect(svc.lookupToken(token)).toBeDefined();

    const proposed = svc.lookupToken(token)!.review.plan.slice(1);
    const res = await svc.respond(token, { kind: "changes", plan: proposed, comment: "Skip Monday" });
    expect("error" in res).toBe(false);
    const view = svc.currentReview(record.id)!;
    expect(view.requests[0].status).toBe("changes");
    expect(view.requests[0].changes[0]).toContain("remove");
    expect(view.ready).toBe(false);

    await svc.respond(token, { kind: "approved" });
    expect(svc.currentReview(record.id)!.ready).toBe(true);
    expect(outbox("owner2@example.test").map((m) => m.subject)).toEqual([
      "a2@example.test suggested changes to the meal plan for the week of Nov 2",
      "a2@example.test approved the meal plan for the week of Nov 2",
    ]);
  });

  it("stops old links once a newer review starts", async () => {
    const record = await setup("owner3@example.test", ["a3@example.test"]);
    await svc.startReview(record, { email: "owner3@example.test", name: "Owner" }, "Nov 2");
    const row = store
      .database()
      .prepare("select body_text from outbox where to_email = ? order by id desc limit 1")
      .get("a3@example.test") as { body_text: string };
    const token = /\/r\/([\w-]+)\?/.exec(row.body_text)![1];
    await svc.startReview(record, { email: "owner3@example.test", name: "Owner" }, "Nov 2");
    const res = await svc.respond(token, { kind: "approved" });
    expect(res).toEqual({ error: "This plan was replaced by a newer one." });
  });
});

describe("household membership", () => {
  it("moves an adult who signed in early into the household that added them", async () => {
    const store = await import("@/lib/store");
    const planner = await import("@/lib/planner");
    // The adult signs in first and gets a blank household of their own.
    store.createHousehold("sub-early", "early@example.test", planner.EMPTY_STATE);
    const owner = store.createHousehold("sub-owner-m", "owner-m@example.test", planner.DEMO_STATE);
    store.addMember(owner.id, "Early@Example.test");
    const seen = store.findHousehold("sub-early", "early@example.test")!;
    expect(seen.id).toBe(owner.id);
    expect(seen.isOwner).toBe(false);
  });

  it("keeps a household the person has started planning in", async () => {
    const store = await import("@/lib/store");
    const planner = await import("@/lib/planner");
    const mine = store.createHousehold("sub-busy", "busy@example.test", planner.DEMO_STATE);
    const other = store.createHousehold("sub-other-m", "other-m@example.test", planner.DEMO_STATE);
    store.addMember(other.id, "busy@example.test");
    expect(store.findHousehold("sub-busy", "busy@example.test")!.id).toBe(mine.id);
  });
});

describe("household saves", () => {
  it("refuses a save based on an older version", async () => {
    const store = await import("@/lib/store");
    const planner = await import("@/lib/planner");
    const h = store.createHousehold("sub-version", "v@example.test", planner.DEMO_STATE);
    const v2 = store.saveState(h.id, planner.EMPTY_STATE, h.version);
    expect(v2).toBeDefined();
    expect(store.saveState(h.id, planner.DEMO_STATE, h.version)).toBeUndefined();
    expect(store.saveState(h.id, planner.DEMO_STATE, v2)).toBeDefined();
  });
});
