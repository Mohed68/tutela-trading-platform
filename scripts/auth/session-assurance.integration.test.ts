import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import connectPgSimple from "connect-pg-simple";
import session, { type SessionData } from "express-session";
import {
  DEFAULT_PRIVILEGED_SESSION_POLICY,
  getSessionAssurance,
  hasMfaAssurance,
  hasRecentStepUp,
  markAuthenticated,
  markMfaSatisfied,
  markStepUpSatisfied,
  type SessionAssuranceClock,
} from "../../server/session-assurance/index.js";
import {
  createAuthIntegrationTestPool,
  requireTestDatabase,
  verifyAuthTestDatabaseBaseline,
} from "./test-database.js";

function clock(at: Date): SessionAssuranceClock {
  return Object.freeze({ now: () => new Date(at) });
}

function storeSet(
  store: session.Store,
  sid: string,
  value: SessionData,
): Promise<void> {
  return new Promise((resolve, reject) => {
    store.set(sid, value, (error) => (error ? reject(error) : resolve()));
  });
}

function storeGet(
  store: session.Store,
  sid: string,
): Promise<SessionData | null | undefined> {
  return new Promise((resolve, reject) => {
    store.get(sid, (error, value) => (error ? reject(error) : resolve(value)));
  });
}

function storeDestroy(store: session.Store, sid: string): Promise<void> {
  return new Promise((resolve, reject) => {
    store.destroy(sid, (error) => (error ? reject(error) : resolve()));
  });
}

test(
  "privileged assurance persists only in its controlled PostgreSQL session",
  { timeout: 30_000 },
  async () => {
    const identity = requireTestDatabase();
    const pool = createAuthIntegrationTestPool(identity);
    const PgStore = connectPgSimple(session);
    const store = new PgStore({
      pool,
      tableName: "sessions",
      createTableIfMissing: false,
      pruneSessionInterval: false,
    });
    const firstSid = `a1-2a-assurance:${crypto.randomUUID()}`;
    const secondSid = `a1-2a-assurance:${crypto.randomUUID()}`;
    const userId = `a1-2a-user:${crypto.randomUUID()}`;
    const authenticatedAt = new Date("2026-09-02T10:00:00.000Z");
    const mfaAt = new Date("2026-09-02T10:01:00.000Z");
    const stepUpAt = new Date("2026-09-02T10:02:00.000Z");
    const testClock = clock(stepUpAt);

    try {
      await verifyAuthTestDatabaseBaseline(pool);
      const before = await pool.query<{ count: string }>(
        "SELECT count(*)::text AS count FROM public.sessions WHERE sid <> ALL($1::text[])",
        [[firstSid, secondSid]],
      );

      const first = {
        cookie: { expires: new Date(Date.now() + 60_000) },
        passport: { user: userId },
      } as SessionData;
      markAuthenticated(first, authenticatedAt, testClock);
      markMfaSatisfied(first, mfaAt, testClock);
      markStepUpSatisfied(first, stepUpAt, testClock);

      const second = {
        cookie: { expires: new Date(Date.now() + 60_000) },
        passport: { user: userId },
      } as SessionData;
      markAuthenticated(second, authenticatedAt, testClock);

      await storeSet(store, firstSid, first);
      await storeSet(store, secondSid, second);
      const persistedFirst = await storeGet(store, firstSid);
      const persistedSecond = await storeGet(store, secondSid);
      assert.ok(persistedFirst);
      assert.ok(persistedSecond);
      assert.equal(hasMfaAssurance(persistedFirst, testClock), true);
      assert.equal(
        hasRecentStepUp(
          persistedFirst,
          DEFAULT_PRIVILEGED_SESSION_POLICY,
          testClock,
        ),
        true,
      );
      assert.equal(getSessionAssurance(persistedSecond, undefined, testClock)?.level, "authenticated");
      assert.equal(hasMfaAssurance(persistedSecond, testClock), false);

      await storeDestroy(store, firstSid);
      assert.equal((await storeGet(store, firstSid)) == null, true);
      assert.equal(getSessionAssurance(persistedSecond, undefined, testClock)?.level, "authenticated");

      const after = await pool.query<{ count: string }>(
        "SELECT count(*)::text AS count FROM public.sessions WHERE sid <> ALL($1::text[])",
        [[firstSid, secondSid]],
      );
      assert.equal(after.rows[0].count, before.rows[0].count);
    } finally {
      await pool
        .query("DELETE FROM public.sessions WHERE sid = ANY($1::text[])", [
          [firstSid, secondSid],
        ])
        .catch(() => undefined);
      await pool.end().catch(() => undefined);
    }
  },
);
