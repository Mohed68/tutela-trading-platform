import assert from "node:assert/strict";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import test from "node:test";
import { Client, type QueryResultRow } from "pg";
import type { CurrentUserDto } from "../../shared/auth.js";
import {
  applicationSchemaFingerprint,
  requireRawDatabaseUrl,
  verifyRecoveryMarker,
} from "../migrations/rehearsal-lib.js";
import {
  readRecoveryCredentialInput,
  verifyRecoveryUserState,
} from "./recovery-user-lib.js";

const EXPECTED_FINGERPRINT =
  "e79139302ae53b2dafb58a2eaf54ab47873df4a15dd3c0026ea0024d424da659";
const PORT = "5058";
const BASE_URL = `http://127.0.0.1:${PORT}`;
const GENERIC_FAILURE = { message: "Invalid email or password." };

interface LegacyUserRow extends QueryResultRow {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  profile_image_url: string | null;
  company_name: string | null;
  role: string | null;
  financial_rating: string | null;
  credit_rating: string | null;
  verified: boolean | null;
  created_at: Date | null;
  updated_at: Date | null;
  password_hash: string | null;
  auth_provider: string | null;
  last_login_at: Date | null;
  login_enabled: boolean | null;
  credential_status: string | null;
  recovery_provenance: string | null;
}

async function legacySnapshot(client: Client): Promise<string> {
  const rows = (
    await client.query<LegacyUserRow>(`
      SELECT
        id,
        email,
        first_name,
        last_name,
        profile_image_url,
        company_name,
        role,
        financial_rating::text,
        credit_rating,
        verified,
        created_at,
        updated_at,
        password_hash,
        auth_provider,
        last_login_at,
        login_enabled,
        credential_status,
        recovery_provenance
      FROM public.users
      WHERE recovery_provenance IS NULL
      ORDER BY id
    `)
  ).rows;
  assert.equal(rows.length, 4);
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(rows))
    .digest("hex");
}

async function sessionCount(client: Client): Promise<string> {
  return (
    await client.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM public.sessions",
    )
  ).rows[0].count;
}

async function waitForServer(
  child: ReturnType<typeof spawn>,
): Promise<void> {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error("RECOVERY_SERVER_EXITED_EARLY");
    }
    try {
      const response = await fetch(`${BASE_URL}/api/health`);
      if (response.ok) return;
    } catch {
      // The bounded startup window is still active.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("RECOVERY_SERVER_DID_NOT_START");
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
  return spawn(process.execPath, ["dist/index.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: "test",
      TUTELA_RECOVERY_MODE: "true",
      DEMO_AUTH_BYPASS: "false",
      DEMO_MODE: "false",
      AUTO_VERIFY_DEMO: "false",
      VITE_SENTRY_DSN: "",
      PORT,
    },
    windowsHide: true,
    stdio: ["ignore", "ignore", "ignore"],
  });
}

async function login(email: string, password: string): Promise<Response> {
  return fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
}

function cookieFrom(response: Response): string {
  const setCookie = response.headers.get("set-cookie");
  assert.ok(setCookie);
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /SameSite=Lax/i);
  assert.doesNotMatch(setCookie, /;\s*Secure/i);
  return setCookie.split(";", 1)[0];
}

async function authenticatedGet(
  path: string,
  cookie: string,
): Promise<Response> {
  return fetch(`${BASE_URL}${path}`, {
    headers: { cookie },
  });
}

test(
  "real Passport session survives restart and is revoked by logout",
  { timeout: 140_000 },
  async () => {
    const credential = readRecoveryCredentialInput(process.env);
    const client = new Client({
      connectionString: requireRawDatabaseUrl(process.env.DATABASE_URL),
    });
    let child: ReturnType<typeof spawn> | null = null;
    let step = "initialize";

    try {
      step = "connect";
      await client.connect();
      await client.query("BEGIN READ ONLY");
      await verifyRecoveryMarker(client);
      assert.equal(
        await applicationSchemaFingerprint(client),
        EXPECTED_FINGERPRINT,
      );
      await verifyRecoveryUserState(client);
      const beforeLegacy = await legacySnapshot(client);
      assert.equal(await sessionCount(client), "0");
      const legacyIdentifier = (
        await client.query<{ email: string }>(`
          SELECT email
          FROM public.users
          WHERE recovery_provenance IS NULL
            AND email IS NOT NULL
          ORDER BY id
          LIMIT 1
        `)
      ).rows[0].email;
      await client.query("ROLLBACK");

      step = "startup";
      child = startServer();
      await waitForServer(child);

      step = "anonymous";
      const anonymous = await fetch(`${BASE_URL}/api/auth/user`);
      assert.equal(anonymous.status, 401);

      step = "generic_failures";
      const unknown = await login(
        `${crypto.randomUUID()}@recovery.tutela.invalid`,
        "not-a-valid-password",
      );
      const legacy = await login(
        legacyIdentifier,
        "not-a-valid-password",
      );
      const malformed = await login("not-an-email", "x");
      for (const response of [unknown, legacy, malformed]) {
        assert.equal(response.status, 401);
        assert.deepEqual(await response.json(), GENERIC_FAILURE);
      }

      step = "registration";
      const registration = await fetch(`${BASE_URL}/api/auth/register`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      assert.equal(registration.status, 503);

      step = "valid_login";
      const valid = await login(credential.email, credential.password);
      assert.equal(valid.status, 200);
      const loginDto = (await valid.json()) as CurrentUserDto;
      assert.deepEqual(loginDto, {
        id: loginDto.id,
        displayName: "Recovery trader",
        role: "trader",
        authenticated: true,
        accountState: "active",
        organizationDisplayName: null,
        emailVerified: "unknown",
        userVerified: "unknown",
        kybState: "unknown",
        organizationVerification: "unknown",
      });
      assert.equal(Object.keys(loginDto).length, 10);
      const cookie = cookieFrom(valid);
      assert.equal(await sessionCount(client), "1");

      step = "current_user";
      const current = await authenticatedGet("/api/auth/user", cookie);
      assert.equal(current.status, 200);
      assert.deepEqual(await current.json(), loginDto);

      step = "protected_read";
      const dashboard = await authenticatedGet(
        "/api/dashboard/metrics",
        cookie,
      );
      assert.equal(dashboard.status, 200);
      assert.deepEqual(
        Object.keys((await dashboard.json()) as object).sort(),
        [
          "activeOffers",
          "pendingContracts",
          "totalVolume",
          "verificationQueue",
        ],
      );
      const shell = await authenticatedGet("/dashboard", cookie);
      assert.equal(shell.status, 200);
      assert.match(shell.headers.get("content-type") ?? "", /^text\/html/);

      step = "restart";
      await stopServer(child);
      child = startServer();
      await waitForServer(child);
      const persisted = await authenticatedGet("/api/auth/user", cookie);
      assert.equal(persisted.status, 200);
      assert.deepEqual(await persisted.json(), loginDto);
      assert.equal(await sessionCount(client), "1");

      step = "malformed_session";
      const malformedSession = await authenticatedGet(
        "/api/auth/user",
        "tutela.sid=malformed",
      );
      assert.equal(malformedSession.status, 401);

      step = "expired_session";
      const expired = await client.query(
        `
          UPDATE public.sessions
          SET expire = now() - interval '1 minute'
          WHERE expire > now()
        `,
      );
      assert.equal(expired.rowCount, 1);
      const afterExpiry = await authenticatedGet("/api/auth/user", cookie);
      assert.equal(afterExpiry.status, 401);
      await client.query("DELETE FROM public.sessions WHERE expire < now()");
      assert.equal(await sessionCount(client), "0");

      step = "login_for_logout";
      const secondLogin = await login(
        credential.email,
        credential.password,
      );
      assert.equal(secondLogin.status, 200);
      const logoutCookie = cookieFrom(secondLogin);
      assert.equal(await sessionCount(client), "1");

      step = "logout";
      const logout = await fetch(`${BASE_URL}/api/auth/logout`, {
        method: "POST",
        headers: { cookie: logoutCookie },
      });
      assert.equal(logout.status, 200);
      assert.deepEqual(await logout.json(), { success: true });
      assert.match(logout.headers.get("set-cookie") ?? "", /Max-Age=0/i);
      assert.equal(await sessionCount(client), "0");
      const afterLogout = await authenticatedGet(
        "/api/auth/user",
        logoutCookie,
      );
      assert.equal(afterLogout.status, 401);

      step = "post_state";
      await stopServer(child);
      child = null;
      await client.query("BEGIN READ ONLY");
      await verifyRecoveryMarker(client);
      await verifyRecoveryUserState(client);
      assert.equal(await legacySnapshot(client), beforeLegacy);
      assert.equal(await sessionCount(client), "0");
      const lastLoginRecorded = (
        await client.query<{ recorded: boolean }>(`
          SELECT last_login_at IS NOT NULL AS recorded
          FROM public.users
          WHERE recovery_provenance = 'tutela-recovery-test'
        `)
      ).rows[0].recorded;
      assert.equal(lastLoginRecorded, true);
      await client.query("ROLLBACK");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      const code =
        error && typeof error === "object" && "code" in error
          ? String(error.code).replace(/[^A-Z0-9_-]/gi, "")
          : "ASSERTION_OR_RUNTIME_FAILURE";
      throw new Error(`PHASE_4B_RUNTIME_${step.toUpperCase()}_${code}`);
    } finally {
      await stopServer(child);
      await client.end().catch(() => undefined);
    }
  },
);

