import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import connectPgSimple from "connect-pg-simple";
import session, { type SessionData } from "express-session";
import {
  createAuthIntegrationTestPool,
  requireTestDatabase,
  verifyAuthTestDatabaseBaseline,
} from "./test-database.js";

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
  "explicit test PostgreSQL persists, expires, and destroys an isolated auth session",
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
    const sid = `a1-2-auth-test:${crypto.randomUUID()}`;

    try {
      await verifyAuthTestDatabaseBaseline(pool);
      const before = await pool.query<{ count: string }>(
        "SELECT count(*)::text AS count FROM public.sessions WHERE sid <> $1",
        [sid],
      );

      const expiry = new Date(Date.now() + 60_000);
      const authenticatedUserId = `a1-2-user:${crypto.randomUUID()}`;
      const value = {
        cookie: {
          originalMaxAge: 60_000,
          expires: expiry,
          secure: false,
          httpOnly: true,
          path: "/",
          sameSite: "lax",
        },
        passport: { user: authenticatedUserId },
      } as SessionData;

      await storeSet(store, sid, value);
      const persisted = await storeGet(store, sid);
      assert.equal(persisted?.passport?.user, authenticatedUserId);

      await pool.query(
        "UPDATE public.sessions SET expire = now() - interval '1 minute' WHERE sid = $1",
        [sid],
      );
      assert.equal((await storeGet(store, sid)) == null, true);

      await storeDestroy(store, sid);
      const removed = await pool.query<{ count: string }>(
        "SELECT count(*)::text AS count FROM public.sessions WHERE sid = $1",
        [sid],
      );
      assert.equal(removed.rows[0].count, "0");

      const after = await pool.query<{ count: string }>(
        "SELECT count(*)::text AS count FROM public.sessions WHERE sid <> $1",
        [sid],
      );
      assert.equal(after.rows[0].count, before.rows[0].count);
    } finally {
      await pool
        .query("DELETE FROM public.sessions WHERE sid = $1", [sid])
        .catch(() => undefined);
      await pool.end().catch(() => undefined);
    }
  },
);
