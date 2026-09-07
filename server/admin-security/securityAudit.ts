import { randomUUID } from "node:crypto";
import type { AdminSession } from "../adminAuth.js";
import type { PlatformPermission } from "../platform-authority/index.js";

interface AuditPool { query(sql: string, values?: readonly unknown[]): Promise<unknown> }

export function createSecurityAuditWriter(pool: AuditPool) {
  return Object.freeze({
    async recordAccess(input: { admin: AdminSession; permission: PlatformPermission; action: string; targetType: string; targetId: string; reason: string; requestId: string; correlationId: string; ip?: string; userAgent?: string; severity?: "info" | "medium" | "high" | "critical" }) {
      await pool.query(
        `INSERT INTO public.security_audit_events (id,request_id,correlation_id,actor_user_id,actor_principal_id,actor_roles,effective_permission,session_assurance,action,target_type,target_id,reason,ip_address,user_agent,severity,occurred_at)
         VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
        [randomUUID(),input.requestId,input.correlationId,input.admin.userId,input.admin.principalId,JSON.stringify(input.admin.roles),input.permission,input.admin.assurance,input.action,input.targetType,input.targetId,input.reason,input.ip ?? null,input.userAgent ?? null,input.severity ?? "info",new Date().toISOString()],
      );
    },
    async listRecent(limit: number, offset: number): Promise<readonly Record<string, unknown>[]> {
      const boundedLimit = Number.isInteger(limit) ? Math.min(Math.max(limit, 1), 100) : 50;
      const boundedOffset = Number.isInteger(offset) ? Math.max(offset, 0) : 0;
      const result = await pool.query(
        `SELECT id, request_id AS "requestId", actor_principal_id AS "actorPrincipalId",
                effective_permission AS "effectivePermission", session_assurance AS "sessionAssurance",
                action, target_type AS "targetType", target_id AS "targetId", reason,
                severity, occurred_at AS "occurredAt"
         FROM public.security_audit_events ORDER BY occurred_at DESC LIMIT $1 OFFSET $2`,
        [boundedLimit, boundedOffset],
      ) as { rows: Record<string, unknown>[] };
      return Object.freeze(result.rows.map((row) => Object.freeze({ ...row })));
    },
  });
}
