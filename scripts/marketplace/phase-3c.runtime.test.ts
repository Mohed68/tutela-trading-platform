import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import test from "node:test";
import { Client } from "pg";
import {
  applicationSchemaFingerprint,
  requireRawDatabaseUrl,
  verifyRecoveryMarker,
} from "../migrations/rehearsal-lib.js";

const EXPECTED_FINGERPRINT =
  "1654ed34b5a19cef9edc6fe3e996553e59c370f311207a89348811f969e3def8";
const PORT = "5056";
const BASE_URL = `http://127.0.0.1:${PORT}`;
const TABLES = [
  "neon_auth.users_sync",
  "public.activity_logs",
  "public.commodities",
  "public.contracts",
  "public.offers",
  "public.partner_relations",
  "public.sessions",
  "public.users",
  "public.verification_documents",
  "public.offer_verifications",
  "public.performance_insights_reports",
] as const;

function quoteIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

async function readSafetyState(client: Client) {
  await client.query("BEGIN READ ONLY");
  try {
    await verifyRecoveryMarker(client);
    const fingerprint = await applicationSchemaFingerprint(client);
    const counts: Record<string, string> = {};
    for (const name of TABLES) {
      const [schema, table] = name.split(".");
      counts[name] = (
        await client.query<{ count: string }>(
          `SELECT count(*)::text AS count
           FROM ${quoteIdentifier(schema)}.${quoteIdentifier(table)}`,
        )
      ).rows[0].count;
    }
    await client.query("ROLLBACK");
    return { fingerprint, counts };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  }
}

async function waitForServer(
  child: ReturnType<typeof spawn>,
): Promise<void> {
  const deadline = Date.now() + 45_000;
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
  "controlled runtime returns a safe empty marketplace without writes",
  { skip: !process.env.DATABASE_URL, timeout: 75_000 },
  async () => {
    let step = "initialize";
    const client = new Client({
      connectionString: requireRawDatabaseUrl(process.env.DATABASE_URL),
    });
    const child = spawn(
      process.execPath,
      ["--import", "tsx", "scripts/start-recovery.ts"],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          TUTELA_RECOVERY_PORT: PORT,
        },
        windowsHide: true,
        stdio: ["ignore", "ignore", "ignore"],
      },
    );

    try {
      step = "connect";
      await client.connect();
      step = "baseline";
      const before = await readSafetyState(client);
      assert.equal(before.fingerprint, EXPECTED_FINGERPRINT);

      step = "startup";
      await waitForServer(child);

      step = "list";
      const listResponse = await fetch(`${BASE_URL}/api/offers`);
      assert.equal(listResponse.status, 200);
      assert.deepEqual(await listResponse.json(), {
        offers: [],
        totalCount: 0,
        publicationPolicy:
          "verified_offer_and_verified_seller_organization",
      });

      step = "summary";
      const summaryResponse = await fetch(
        `${BASE_URL}/api/offers/summary`,
      );
      assert.equal(summaryResponse.status, 200);
      assert.deepEqual(await summaryResponse.json(), {
        activeOffers: 0,
        publishedOffers: 0,
        marketValueUsd: 0,
        avgPrice: null,
        avgPriceCount: 0,
        avgPriceCoverage: { used: 0, skipped: 0 },
        median: null,
        p25: null,
        p75: null,
      });

      step = "options";
      const optionsResponse = await fetch(
        `${BASE_URL}/api/offers/options`,
      );
      assert.equal(optionsResponse.status, 200);
      assert.deepEqual(await optionsResponse.json(), {
        commodities: [],
      });

      step = "search";
      const searchResponse = await fetch(
        `${BASE_URL}/api/offers/search?q=commodity`,
      );
      assert.equal(searchResponse.status, 200);
      assert.deepEqual(await searchResponse.json(), {
        offers: [],
        totalCount: 0,
        publicationPolicy:
          "verified_offer_and_verified_seller_organization",
      });

      step = "write_guard";
      const writeResponse = await fetch(`${BASE_URL}/api/offers`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      assert.equal(writeResponse.status, 503);

      step = "shutdown";
      await stopServer(child);
      step = "post_state";
      const after = await readSafetyState(client);
      assert.deepEqual(after, before);
    } catch (error) {
      const code =
        error && typeof error === "object" && "code" in error
          ? String(error.code).replace(/[^A-Z0-9_-]/gi, "")
          : "ASSERTION_OR_RUNTIME_FAILURE";
      throw new Error(`PHASE_3C_RUNTIME_${step.toUpperCase()}_${code}`);
    } finally {
      await stopServer(child);
      await client.end().catch(() => undefined);
    }
  },
);
