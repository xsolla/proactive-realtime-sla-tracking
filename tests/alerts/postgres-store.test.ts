import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createPostgresAlertStore, lockKey, type AlertKey } from "@/alerts";
import { listAlertState } from "@/data";
import { createTestDatabase, type TestDatabase } from "../support/database";

const KEY: AlertKey = { partnerSlug: "scopely", scopeId: "scope-1", period: "2026-10" };

describe("lockKey", () => {
  it("has no NUL byte, which Postgres text cannot hold", () => {
    expect(lockKey(KEY)).not.toContain("\0");
    expect(lockKey(KEY)).toBe('["scopely","scope-1","2026-10"]');
  });

  it("keeps keys whose parts would collide under a plain separator apart", () => {
    expect(lockKey({ partnerSlug: "a|b", scopeId: "c", period: "p" })).not.toBe(
      lockKey({ partnerSlug: "a", scopeId: "b|c", period: "p" }),
    );
  });
});

describe("createPostgresAlertStore", () => {
  let test: TestDatabase;
  beforeEach(async () => {
    test = await createTestDatabase();
  });
  afterEach(async () => {
    await test.close();
  });

  it("takes the lock, reads no prior status, and commits the first transition", async () => {
    const store = createPostgresAlertStore(test.db);
    const at = new Date("2026-10-23T20:00:00Z");

    const seen = await store.exclusive(KEY, async (ctx) => {
      expect(await ctx.commit({ status: "breached", alerted: true, at })).toBe(true);
      return ctx.seen;
    });

    expect(seen).toBeNull();
    const rows = await listAlertState(test.db);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ ...KEY, lastStatus: "breached", alertCount: 1 });
  });
});
