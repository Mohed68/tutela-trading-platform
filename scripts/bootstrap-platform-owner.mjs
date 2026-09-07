import { randomUUID } from "node:crypto";
import pg from "pg";
import { createPostgresPlatformOwnershipRepository } from "../server/platform-ownership/postgresRepository.ts";

const args = new Map(process.argv.slice(2).map((value, index, all) => value.startsWith("--") ? [value, all[index + 1]?.startsWith("--") ? "true" : all[index + 1]] : ["", ""]));
const targetUserId = args.get("--target-user-id")?.trim();
const reason = args.get("--reason")?.trim();
const operatorIdentity = args.get("--operator-id")?.trim();
if (args.get("--confirm") !== "true") throw new Error("EXPLICIT_BOOTSTRAP_CONFIRMATION_REQUIRED");
if (!targetUserId || !reason || reason.length < 10 || !operatorIdentity) throw new Error("BOOTSTRAP_ARGUMENTS_INVALID");
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL_REQUIRED");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
try {
  const result = await createPostgresPlatformOwnershipRepository(pool).bootstrapFirstOwner({ targetUserId, principalId: randomUUID(), assignmentId: randomUUID(), auditEventId: randomUUID(), operatorIdentity, reason, occurredAt: new Date().toISOString() });
  console.log(result === "created" ? "Initial Platform Owner bootstrap completed." : "Initial Platform Owner bootstrap was already completed for this target.");
} catch (error) {
  console.error("Platform Owner bootstrap refused:", error instanceof Error ? error.message : "UNKNOWN_ERROR"); process.exitCode = 1;
} finally { await pool.end(); }
