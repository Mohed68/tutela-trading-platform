import assert from "node:assert/strict";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import test from "node:test";
import { Client, type QueryResultRow } from "pg";
import type { DashboardOverviewDto } from "../../shared/dashboard.js";
import {
  applicationSchemaFingerprint,
  requireRawDatabaseUrl,
  verifyRecoveryMarker,
} from "../migrations/rehearsal-lib.js";
import {
  readRecoveryCredentialInput,
  verifyRecoveryUserState,
} from "../auth/recovery-user-lib.js";

const EXPECTED_FINGERPRINT =
  "d309afaee7935df8b4e91e42f9f6f6c6e9c646b810640e1683e0512e6777bdbe";
const PORT = "5059";
const BASE_URL = `http://127.0.0.1:${PORT}`;
const LEGACY_USER_COUNT = 4;
const LEGACY_OFFER_COUNT = 9;
const PUBLICATION_POLICY =
  "verified_offer_and_verified_seller_organization";
const BLOCKED_LEGACY_DASHBOARD_ROUTES = [
  "/api/dashboard/metrics",
  "/api/dashboard/activity",
  "/api/recommendations/personalized",
  "/api/auth/kyb-status",
  "/api/auth/plan",
] as const;
const SENSITIVE_KEYS = new Set([
  "email",
  "password",
  "passwordHash",
  "password_hash",
  "phone",
  "phoneNumber",
  "address",
  "providerId",
  "sessionId",
  "cookie",
  "documentPath",
  "s3Key",
  "moderationNotes",
  "rejectionReason",
  "financialRating",
  "creditRating",
  "riskScore",
]);
const serverDiagnostics = new WeakMap<
  ReturnType<typeof spawn>,
  {
    databaseVerified: boolean;
    listening: boolean;
    startupFailure: boolean;
  }
>();

interface LegacyIdentity extends QueryResultRow {
  id: string;
  email: string | null;
}

function stableHash(value: unknown): string {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(value))
    .digest("hex");
}

async function tableSnapshot(
  client: Client,
  table: "users" | "offers" | "tutela_migration_journal",
  where = "",
): Promise<string> {
  const orderColumn =
    table === "tutela_migration_journal" ? "migration_identifier" : "id";
  const rows = (
    await client.query<QueryResultRow>(
      `SELECT to_jsonb(source) AS record
       FROM public.${table} AS source
       ${where}
       ORDER BY source.${orderColumn}`,
    )
  ).rows.map((row) => row.record);
  return stableHash(rows);
}

async function publicTableCounts(
  client: Client,
): Promise<Record<string, string>> {
  const tables = (
    await client.query<{ table_name: string }>(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `)
  ).rows;
  const counts: Record<string, string> = {};
  for (const { table_name: tableName } of tables) {
    const quoted = `"${tableName.replaceAll('"', '""')}"`;
    counts[tableName] = (
      await client.query<{ count: string }>(
        `SELECT count(*)::text AS count FROM public.${quoted}`,
      )
    ).rows[0].count;
  }
  return counts;
}

async function readSafetyState(client: Client) {
  await client.query("BEGIN READ ONLY");
  try {
    await verifyRecoveryMarker(client);
    const fingerprint = await applicationSchemaFingerprint(client);
    const counts = await publicTableCounts(client);
    const legacyUsers = (
      await client.query<LegacyIdentity>(`
        SELECT id, email
        FROM public.users
        WHERE recovery_provenance IS NULL
        ORDER BY id
      `)
    ).rows;
    const legacyUserSnapshot = await tableSnapshot(
      client,
      "users",
      "WHERE source.recovery_provenance IS NULL",
    );
    const offerSnapshot = await tableSnapshot(client, "offers");
    const journalSnapshot = await tableSnapshot(
      client,
      "tutela_migration_journal",
    );
    await verifyRecoveryUserState(client);
    await client.query("ROLLBACK");
    return {
      fingerprint,
      counts,
      legacyUsers,
      legacyUserSnapshot,
      offerSnapshot,
      journalSnapshot,
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  }
}

async function waitForServer(
  child: ReturnType<typeof spawn>,
): Promise<void> {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error("SERVER_EXITED_EARLY");
    }
    try {
      const response = await fetch(`${BASE_URL}/api/health`, {
        signal: AbortSignal.timeout(2_000),
      });
      if (response.ok) return;
    } catch {
      // The bounded startup window is still active.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  const diagnostics = serverDiagnostics.get(child);
  throw new Error(
    [
      "SERVER_DID_NOT_START",
      diagnostics?.databaseVerified ? "DATABASE_VERIFIED" : "DATABASE_PENDING",
      diagnostics?.listening ? "LISTENING" : "NOT_LISTENING",
      diagnostics?.startupFailure ? "STARTUP_FAILURE" : "NO_FAILURE_SIGNAL",
    ].join("_"),
  );
}

async function stopServer(
  child: ReturnType<typeof spawn> | null,
): Promise<void> {
  if (!child || child.exitCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, 5_000)),
  ]);
  if (child.exitCode === null) child.kill("SIGKILL");
}

function startServer(): ReturnType<typeof spawn> {
  const child = spawn(process.execPath, ["dist/index.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: "test",
      TUTELA_RECOVERY_MODE: "true",
      DEMO_AUTH_BYPASS: "false",
      DEMO_MODE: "false",
      AUTO_VERIFY_DEMO: "false",
      RENDER: "",
      OPENAI_API_KEY: "",
      STRIPE_SECRET_KEY: "",
      SENTRY_DSN: "",
      VITE_SENTRY_DSN: "",
      GOOGLE_APPLICATION_CREDENTIALS: "",
      PORT,
    },
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const diagnostics = {
    databaseVerified: false,
    listening: false,
    startupFailure: false,
  };
  serverDiagnostics.set(child, diagnostics);
  const inspectOutput = (chunk: Buffer | string) => {
    const output = chunk.toString();
    if (output.includes("database connectivity and required schema verified")) {
      diagnostics.databaseVerified = true;
    }
    if (output.includes("serving on port")) {
      diagnostics.listening = true;
    }
    if (output.includes("TUTELA failed to start")) {
      diagnostics.startupFailure = true;
    }
  };
  child.stdout?.on("data", inspectOutput);
  child.stderr?.on("data", inspectOutput);
  return child;
}

function cookieFrom(response: Response): string {
  const setCookie = response.headers.get("set-cookie");
  assert.ok(setCookie);
  return setCookie.split(";", 1)[0];
}

async function get(path: string, cookie?: string): Promise<Response> {
  return fetch(`${BASE_URL}${path}`, {
    headers: cookie ? { cookie } : undefined,
  });
}

function assertNoSensitiveKeys(value: unknown): void {
  if (Array.isArray(value)) {
    value.forEach(assertNoSensitiveKeys);
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, nested] of Object.entries(value)) {
    assert.equal(SENSITIVE_KEYS.has(key), false, `sensitive key: ${key}`);
    assertNoSensitiveKeys(nested);
  }
}

async function cleanupSessions(client: Client): Promise<void> {
  await client.query("DELETE FROM public.sessions");
}

async function readDatabaseSafetyState() {
  const client = new Client({
    connectionString: requireRawDatabaseUrl(process.env.DATABASE_URL),
  });
  try {
    await client.connect();
    return await readSafetyState(client);
  } finally {
    await client.end().catch(() => undefined);
  }
}

async function cleanupTestSessions(): Promise<void> {
  const client = new Client({
    connectionString: requireRawDatabaseUrl(process.env.DATABASE_URL),
  });
  try {
    await client.connect();
    await cleanupSessions(client);
  } finally {
    await client.end().catch(() => undefined);
  }
}

test(
  "authenticated dashboard is scoped, fail-closed, restart-safe, and read-only",
  { timeout: 600_000 },
  async () => {
    const credential = readRecoveryCredentialInput(process.env);
    let child: ReturnType<typeof spawn> | null = null;
    let step = "initialize";

    try {
      step = "preflight";
      const before = await readDatabaseSafetyState();
      assert.equal(before.fingerprint, EXPECTED_FINGERPRINT);
      assert.equal(before.legacyUsers.length, LEGACY_USER_COUNT);
      assert.equal(before.counts.users, "5");
      assert.equal(before.counts.offers, String(LEGACY_OFFER_COUNT));
      assert.equal(before.counts.sessions, "0");

      step = "startup";
      child = startServer();
      await waitForServer(child);

      step = "anonymous";
      const anonymous = await get("/api/dashboard/overview");
      assert.equal(anonymous.status, 401);

      step = "login";
      const login = await fetch(`${BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: credential.email,
          password: credential.password,
        }),
      });
      assert.equal(login.status, 200);
      const cookie = cookieFrom(login);

      step = "shell";
      const shell = await get("/dashboard", cookie);
      assert.equal(shell.status, 200);
      assert.match(shell.headers.get("content-type") ?? "", /text\/html/);

      step = "overview";
      const response = await get("/api/dashboard/overview", cookie);
      assert.equal(response.status, 200);
      const overview = (await response.json()) as DashboardOverviewDto;
      assert.deepEqual(overview.myOffers, {
        state: "empty",
        data: { count: 0 },
      });
      assert.deepEqual(overview.publicMarketplace, {
        state: "empty",
        data: {
          publishedOffers: 0,
          publicationPolicy: PUBLICATION_POLICY,
        },
      });
      assert.deepEqual(overview.contracts, {
        state: "unavailable",
        data: null,
      });
      assert.deepEqual(overview.kyb, {
        state: "unavailable",
        data: null,
      });
      assert.equal(overview.account.data?.role, "trader");
      assert.equal(overview.account.data?.authenticated, true);
      assertNoSensitiveKeys(overview);

      const serializedOverview = JSON.stringify(overview);
      for (const legacy of before.legacyUsers) {
        assert.doesNotMatch(serializedOverview, new RegExp(legacy.id, "i"));
        if (legacy.email) {
          assert.equal(
            serializedOverview.toLowerCase().includes(
              legacy.email.toLowerCase(),
            ),
            false,
          );
        }
      }

      step = "ownership_override";
      const overridden = await get(
        `/api/dashboard/overview?userId=${encodeURIComponent(before.legacyUsers[0].id)}`,
        cookie,
      );
      assert.equal(overridden.status, 200);
      const overriddenOverview =
        (await overridden.json()) as DashboardOverviewDto;
      assert.deepEqual(overriddenOverview.myOffers, overview.myOffers);
      assert.deepEqual(overriddenOverview.account, overview.account);

      step = "legacy_dashboard_routes";
      for (const path of BLOCKED_LEGACY_DASHBOARD_ROUTES) {
        const blocked = await get(path, cookie);
        assert.equal(blocked.status, 503);
        const body = await blocked.text();
        assert.doesNotMatch(
          body,
          /postgres|database_url|password|select\s|relation\s/i,
        );
      }

      step = "marketplace";
      const marketplace = await get("/api/offers/summary", cookie);
      assert.equal(marketplace.status, 200);
      assert.equal((await marketplace.json()).publishedOffers, 0);

      step = "restart";
      await stopServer(child);
      child = startServer();
      await waitForServer(child);
      const afterRestart = await get("/api/dashboard/overview", cookie);
      assert.equal(afterRestart.status, 200);
      assert.equal(
        ((await afterRestart.json()) as DashboardOverviewDto).session.state,
        "available",
      );

      step = "logout";
      const logout = await fetch(`${BASE_URL}/api/auth/logout`, {
        method: "POST",
        headers: { cookie },
      });
      assert.equal(logout.status, 200);
      assert.equal((await logout.json()).success, true);
      const revoked = await get("/api/dashboard/overview", cookie);
      assert.equal(revoked.status, 401);

      step = "stop";
      await stopServer(child);
      child = null;

      step = "final_state";
      const after = await readDatabaseSafetyState();
      assert.equal(after.fingerprint, before.fingerprint);
      assert.equal(after.legacyUserSnapshot, before.legacyUserSnapshot);
      assert.equal(after.offerSnapshot, before.offerSnapshot);
      assert.equal(after.journalSnapshot, before.journalSnapshot);
      assert.deepEqual(after.counts, before.counts);
      assert.equal(after.counts.sessions, "0");
    } catch (error) {
      const safeMessage =
        error instanceof Error &&
        error.message.startsWith("SERVER_DID_NOT_START_")
          ? error.message
          : null;
      const code = safeMessage ??
        (error && typeof error === "object" && "code" in error
          ? String(error.code).replace(/[^A-Z0-9_-]/gi, "")
          : "ASSERTION_FAILURE");
      throw new Error(`DASHBOARD_RUNTIME_${step}_${code}`);
    } finally {
      await stopServer(child);
      await cleanupTestSessions().catch(() => undefined);
    }
  },
);
