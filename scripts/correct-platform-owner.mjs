import { randomUUID } from "node:crypto";
import pg from "pg";
import { createPostgresPlatformOwnershipRepository } from "../server/platform-ownership/postgresRepository.ts";

const values = process.argv.slice(2);
const argument = (name) => {
  const index = values.indexOf(name);
  return index >= 0 ? values[index + 1]?.trim() : undefined;
};
const fromUserId = argument("--from-user-id");
const toUserId = argument("--to-user-id");
const reason = argument("--reason");
const confirmed = argument("--confirm") === "true";
if (!confirmed) throw new Error("EXPLICIT_OWNER_CORRECTION_CONFIRMATION_REQUIRED");
if (!fromUserId || !toUserId || fromUserId === toUserId || !reason || reason.length < 20) throw new Error("OWNER_CORRECTION_ARGUMENTS_INVALID");
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL_REQUIRED");

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
try {
  const result = await createPostgresPlatformOwnershipRepository(pool).correctInitialOwnerIdentity({
    fromUserId,
    toUserId,
    reason,
    targetPrincipalId: randomUUID(),
    targetAssignmentId: randomUUID(),
    auditEventId: randomUUID(),
    requestId: randomUUID(),
    correlationId: randomUUID(),
    occurredAt: new Date().toISOString(),
  });
  console.log(result === "completed" ? "Controlled Platform Owner identity correction completed." : "Controlled Platform Owner identity correction was already completed for this exact identity pair.");
} catch (error) {
  console.error("Controlled Platform Owner identity correction refused:", error instanceof Error ? error.message : "UNKNOWN_ERROR");
  process.exitCode = 1;
} finally {
  await pool.end();
}
