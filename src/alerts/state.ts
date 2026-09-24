import { and, eq, sql } from "drizzle-orm";
import { slaAlertState, type Database } from "@/data";

export type AlertKey = {
  partnerSlug: string;
  scopeId: string;
  period: string;
};

export type AlertCommit = {
  status: string;
  alerted: boolean;
  at: Date;
};

export type StoredAlert = {
  status: string;
  alertCount: number;
};

export type AlertStateContext = {
  /** last_status read under this key's exclusion. Null when no row exists. */
  seen: string | null;
  /**
   * Writes only when last_status is still `seen`.
   * Returns false when another writer won the compare-and-swap.
   */
  commit: (next: AlertCommit) => Promise<boolean>;
};

export type AlertStateStore = {
  exclusive<T>(key: AlertKey, body: (ctx: AlertStateContext) => Promise<T>): Promise<T>;
};

export type MemoryAlertStore = AlertStateStore & {
  commits: number;
  read(key: AlertKey): StoredAlert | null;
  entries(): Array<AlertKey & StoredAlert>;
};

type MemoryRow = {
  status: string;
  alertCount: number;
  lastAlertedAt: Date | null;
};

/**
 * In-process stand-in for the database lock. Tests use it so two overlapping
 * runs observe one transition. Production uses createPostgresAlertStore.
 */
export function createMemoryAlertStore(): MemoryAlertStore {
  const rows = new Map<string, MemoryRow>();
  const tails = new Map<string, Promise<void>>();
  const store: MemoryAlertStore = {
    commits: 0,
    read(key) {
      const row = rows.get(keyId(key));
      if (row === undefined) {
        return null;
      }
      return { status: row.status, alertCount: row.alertCount };
    },
    entries() {
      return [...rows.entries()].map(([id, row]) => {
        const [partnerSlug = "", scopeId = "", period = ""] = id.split("\0");
        return {
          partnerSlug,
          scopeId,
          period,
          status: row.status,
          alertCount: row.alertCount,
        };
      });
    },
    async exclusive(key, body) {
      const id = keyId(key);
      const previous = tails.get(id) ?? Promise.resolve();
      let release: () => void = () => undefined;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      tails.set(
        id,
        previous.then(() => gate),
      );
      await previous;
      try {
        const seen = rows.get(id)?.status ?? null;
        return await body({
          seen,
          commit: async (next) => {
            const current = rows.get(id)?.status ?? null;
            if (current !== seen) {
              return false;
            }
            const existing = rows.get(id);
            rows.set(id, {
              status: next.status,
              alertCount: (existing?.alertCount ?? 0) + (next.alerted ? 1 : 0),
              lastAlertedAt: next.alerted ? next.at : (existing?.lastAlertedAt ?? null),
            });
            store.commits += 1;
            return true;
          },
        });
      } finally {
        release();
      }
    },
  };
  return store;
}

/**
 * Holds a transaction-scoped advisory lock across the caller's send, then
 * updates only when last_status is still the value read in this transaction.
 * The second overlapping run blocks on the lock, reads the new status, and
 * does not send.
 */
export function createPostgresAlertStore(db: Database): AlertStateStore {
  return {
    async exclusive(key, body) {
      return db.transaction(async (tx) => {
        const lockId = keyId(key);
        await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${lockId}, ${0}::bigint))`);
        const existing = await tx
          .select({ lastStatus: slaAlertState.lastStatus })
          .from(slaAlertState)
          .where(keyWhere(key));
        const seen = existing[0]?.lastStatus ?? null;
        return body({
          seen,
          commit: async (next) => {
            if (seen === null) {
              const inserted = await tx
                .insert(slaAlertState)
                .values({
                  partnerSlug: key.partnerSlug,
                  scopeId: key.scopeId,
                  period: key.period,
                  lastStatus: next.status,
                  lastAlertedAt: next.alerted ? next.at : null,
                  alertCount: next.alerted ? 1 : 0,
                  updatedAt: next.at,
                })
                .onConflictDoNothing()
                .returning({ partnerSlug: slaAlertState.partnerSlug });
              return inserted.length > 0;
            }
            const updated = await tx
              .update(slaAlertState)
              .set({
                lastStatus: next.status,
                updatedAt: next.at,
                ...(next.alerted
                  ? {
                      lastAlertedAt: next.at,
                      alertCount: sql`${slaAlertState.alertCount} + 1`,
                    }
                  : {}),
              })
              .where(and(keyWhere(key), eq(slaAlertState.lastStatus, seen)))
              .returning({ partnerSlug: slaAlertState.partnerSlug });
            return updated.length > 0;
          },
        });
      });
    },
  };
}

function keyWhere(key: AlertKey) {
  return and(
    eq(slaAlertState.partnerSlug, key.partnerSlug),
    eq(slaAlertState.scopeId, key.scopeId),
    eq(slaAlertState.period, key.period),
  );
}

function keyId(key: AlertKey): string {
  return `${key.partnerSlug}\0${key.scopeId}\0${key.period}`;
}
