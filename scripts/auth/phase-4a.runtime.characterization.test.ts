import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import test from "node:test";
import { Client } from "pg";
import {
  applicationSchemaFingerprint,
  verifyRecoveryMarker,
} from "../migrations/rehearsal-lib.js";
import { requireTestDatabase } from "./test-database.js";

const EXPECTED_FINGERPRINT =
  "1654ed34b5a19cef9edc6fe3e996553e59c370f311207a89348811f969e3def8";
const PORT = "5057";
const BASE_URL = `http://127.0.0.1:${PORT}`;

async function readIdentityState(client: Client) {
  await client.query("BEGIN READ ONLY");
  try {
    await verifyRecoveryMarker(client);
    const fingerprint = await applicationSchemaFingerprint(client);
    const users = (
      await client.query<{ count: string }>(
        "SELECT count(*)::text AS count FROM public.users",
      )
    ).rows[0].count;
    const sessions = (
      await client.query<{ count: string }>(
        "SELECT count(*)::text AS count FROM public.sessions",
      )
    ).rows[0].count;
    await client.query("ROLLBACK");
    return { fingerprint, users, sessions };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  }
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
  child: ReturnType<typeof spawn>,
): Promise<void> {
  if (child.exitCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, 5_000)),
  ]);
  if (child.exitCode === null) child.kill("SIGKILL");
}

test(
  "controlled recovery exposes only anonymous auth characterization without writes",
  { timeout: 100_000 },
  async () => {
    const testDatabase = requireTestDatabase();
    const client = new Client({
      connectionString: testDatabase.connectionString,
    });
    let child: ReturnType<typeof spawn> | null = null;
    let step = "initialize";

    try {
      step = "connect";
      await client.connect();
      step = "baseline";
      const before = await readIdentityState(client);
      assert.deepEqual(before, {
        fingerprint: EXPECTED_FINGERPRINT,
        users: "4",
        sessions: "0",
      });

      child = spawn(process.execPath, ["dist/index.js"], {
        cwd: process.cwd(),
        env: {
          ...process.env,
          DATABASE_URL: testDatabase.connectionString,
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
      step = "startup";
      await waitForServer(child);

      step = "anonymous";
      const currentUser = await fetch(`${BASE_URL}/api/auth/user`);
      assert.equal(currentUser.status, 401);
      assert.deepEqual(await currentUser.json(), { message: "Unauthorized" });

      step = "login_guard";
      const invalidLogin = await fetch(`${BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: "invalid@example.invalid",
          password: "not-a-real-credential",
        }),
      });
      assert.equal(invalidLogin.status, 503);

      step = "logout_guard";
      assert.equal(
        (await fetch(`${BASE_URL}/api/auth/logout`, { method: "POST" })).status,
        503,
      );
      assert.equal((await fetch(`${BASE_URL}/api/logout`)).status, 503);

      step = "protected_read_guard";
      assert.equal(
        (await fetch(`${BASE_URL}/api/dashboard/metrics`)).status,
        503,
      );

      step = "shells";
      const loginShell = await fetch(`${BASE_URL}/login`);
      assert.equal(loginShell.status, 200);
      assert.match(
        loginShell.headers.get("content-type") ?? "",
        /^text\/html/,
      );
      const dashboardShell = await fetch(`${BASE_URL}/dashboard`);
      assert.equal(dashboardShell.status, 200);
      assert.match(
        dashboardShell.headers.get("content-type") ?? "",
        /^text\/html/,
      );

      step = "shutdown";
      await stopServer(child);
      step = "post_state";
      assert.deepEqual(await readIdentityState(client), before);
    } catch (error) {
      const code =
        error && typeof error === "object" && "code" in error
          ? String(error.code).replace(/[^A-Z0-9_-]/gi, "")
          : "ASSERTION_OR_RUNTIME_FAILURE";
      throw new Error(
        `PHASE_4A_RUNTIME_${step.toUpperCase()}_${code}`,
      );
    } finally {
      if (child) await stopServer(child);
      await client.end().catch(() => undefined);
    }
  },
);
