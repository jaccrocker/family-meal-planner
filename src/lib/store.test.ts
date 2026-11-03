import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), "fmp-store-")), "test.db");

describe("household adoption on Google id", () => {
  let store: typeof import("@/lib/store");
  let planner: typeof import("@/lib/planner");

  beforeAll(async () => {
    store = await import("@/lib/store");
    planner = await import("@/lib/planner");
  });

  const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  const ownerSub = (id: number) =>
    (store.database().prepare("select owner_sub from households where id = ?").get(id) as { owner_sub: string }).owner_sub;

  it("adopts the newest legacy household for the same email", () => {
    const older = store.createHousehold(uuid(1), "a@example.test", planner.DEMO_STATE);
    const newer = store.createHousehold(uuid(2), "a@example.test", planner.DEMO_STATE);
    const found = store.findHousehold("111111111111111111111", "a@example.test")!;
    expect(found.id).toBe(newer.id);
    expect(found.isOwner).toBe(true);
    expect(ownerSub(newer.id)).toBe("111111111111111111111");
    expect(ownerSub(older.id)).toBe(uuid(1));
  });

  it("does not adopt when the Google id already owns a household", () => {
    const legacy = store.createHousehold(uuid(3), "b@example.test", planner.DEMO_STATE);
    const mine = store.createHousehold("222222222222222222222", "b@example.test", planner.DEMO_STATE);
    expect(store.findHousehold("222222222222222222222", "b@example.test")!.id).toBe(mine.id);
    expect(ownerSub(legacy.id)).toBe(uuid(3));
  });

  it("never adopts non-UUID subs such as test fixtures", () => {
    const fixture = store.createHousehold("e2e-review-fixture-01", "c@example.test", planner.DEMO_STATE);
    expect(store.findHousehold("333333333333333333333", "c@example.test")).toBeUndefined();
    expect(ownerSub(fixture.id)).toBe("e2e-review-fixture-01");
  });

  it("does not adopt for a non-Google sub", () => {
    const legacy = store.createHousehold(uuid(4), "d@example.test", planner.DEMO_STATE);
    expect(store.findHousehold("sub-d", "d@example.test")).toBeUndefined();
    expect(ownerSub(legacy.id)).toBe(uuid(4));
  });
});
