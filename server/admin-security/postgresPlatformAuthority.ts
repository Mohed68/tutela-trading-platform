import type {
  AuditedPlatformRoleGrant,
  AuditedPlatformRoleRevocation,
  PlatformAuthorityMutationPort,
  PlatformAuthorityReadPort,
  PlatformPrincipalRecord,
  PlatformRoleAssignmentRecord,
} from "../platform-authority/index.js";

interface QueryResult<Row> { readonly rows: Row[]; readonly rowCount?: number | null }
interface QueryClient { query<Row = Record<string, unknown>>(sql: string, values?: readonly unknown[]): Promise<QueryResult<Row>>; release(): void }
interface QueryPool { query<Row = Record<string, unknown>>(sql: string, values?: readonly unknown[]): Promise<QueryResult<Row>>; connect(): Promise<QueryClient> }

type PrincipalRow = { id: string; user_id: string; status: string; created_at: Date };
type AssignmentRow = { id: string; principal_id: string; role: string; status: string; granted_by_principal_id: string; granted_at: Date; grant_reason: string; revoked_by_principal_id: string | null; revoked_at: Date | null; revocation_reason: string | null };

const principal = (row: PrincipalRow): PlatformPrincipalRecord => Object.freeze({ principalId: row.id, userId: row.user_id, status: row.status, createdAt: row.created_at.toISOString() });
const assignment = (row: AssignmentRow): PlatformRoleAssignmentRecord => Object.freeze({ assignmentId: row.id, principalId: row.principal_id, role: row.role, status: row.status, grantedByPrincipalId: row.granted_by_principal_id, grantedAt: row.granted_at.toISOString(), grantReason: row.grant_reason, revokedByPrincipalId: row.revoked_by_principal_id, revokedAt: row.revoked_at?.toISOString() ?? null, revocationReason: row.revocation_reason });

const assignmentColumns = `id, principal_id, role, status, granted_by_principal_id, granted_at, grant_reason, revoked_by_principal_id, revoked_at, revocation_reason`;

async function insertAudit(client: QueryClient, audit: AuditedPlatformRoleGrant["audit"]): Promise<void> {
  await client.query(
    `INSERT INTO public.security_audit_events (id, request_id, correlation_id, actor_user_id, actor_principal_id, actor_roles, effective_permission, session_assurance, action, target_type, target_id, before_value, after_value, reason, severity, occurred_at)
     VALUES ($1,$2,$3,$4,$5,
       COALESCE((SELECT jsonb_agg(role ORDER BY role) FROM public.platform_role_assignments WHERE principal_id=$5 AND status='active'),'[]'::jsonb),
       $6,$7,$8,'platform_role_assignment',$9,$10::jsonb,$11::jsonb,$12,'high',$13)`,
    [audit.auditEventId, audit.requestId, audit.correlationId, audit.actorUserId, audit.actorPrincipalId, audit.effectivePermission, audit.sessionAssurance, audit.action, audit.targetPrincipalId, JSON.stringify(audit.before), JSON.stringify(audit.after), audit.reason, audit.occurredAt],
  );
}

async function invalidateTargetSessions(client: QueryClient, principalId: string): Promise<void> {
  await client.query(
    `DELETE FROM public.sessions WHERE sess #>> '{passport,user}' =
      (SELECT user_id FROM public.platform_principals WHERE id=$1)`,
    [principalId],
  );
}

export function createPostgresPlatformAuthorityRepository(pool: QueryPool): PlatformAuthorityReadPort & PlatformAuthorityMutationPort {
  return Object.freeze({
    async findPrincipalByUserId(userId: string) { const r = await pool.query<PrincipalRow>(`SELECT id,user_id,status,created_at FROM public.platform_principals WHERE user_id=$1`, [userId]); return r.rows[0] ? principal(r.rows[0]) : undefined; },
    async findPrincipalById(id: string) { const r = await pool.query<PrincipalRow>(`SELECT id,user_id,status,created_at FROM public.platform_principals WHERE id=$1`, [id]); return r.rows[0] ? principal(r.rows[0]) : undefined; },
    async listRoleAssignments(principalId: string) { const r = await pool.query<AssignmentRow>(`SELECT ${assignmentColumns} FROM public.platform_role_assignments WHERE principal_id=$1 ORDER BY id`, [principalId]); return Object.freeze(r.rows.map(assignment)); },
    async findRoleAssignmentById(id: string) { const r = await pool.query<AssignmentRow>(`SELECT ${assignmentColumns} FROM public.platform_role_assignments WHERE id=$1`, [id]); return r.rows[0] ? assignment(r.rows[0]) : undefined; },
    async commitRoleGrant(input: AuditedPlatformRoleGrant) {
      const client = await pool.connect();
      try { await client.query("BEGIN"); await client.query(`INSERT INTO public.platform_role_assignments (id,principal_id,role,status,granted_by_principal_id,granted_at,grant_reason) VALUES ($1,$2,$3,'active',$4,$5,$6)`, [input.assignment.assignmentId,input.assignment.principalId,input.assignment.role,input.assignment.grantedByPrincipalId,input.assignment.grantedAt,input.assignment.grantReason]); await insertAudit(client, input.audit); await invalidateTargetSessions(client, input.assignment.principalId); await client.query("COMMIT"); }
      catch (error) { await client.query("ROLLBACK").catch(() => undefined); throw error; } finally { client.release(); }
    },
    async commitRoleRevocation(input: AuditedPlatformRoleRevocation) {
      const client = await pool.connect();
      try { await client.query("BEGIN"); const updated = await client.query(`UPDATE public.platform_role_assignments SET status='revoked',revoked_by_principal_id=$2,revoked_at=$3,revocation_reason=$4 WHERE id=$1 AND status='active'`, [input.after.assignmentId,input.after.revokedByPrincipalId,input.after.revokedAt,input.after.revocationReason]); if (updated.rowCount !== 1) throw new Error("PLATFORM_ROLE_REVOCATION_CONFLICT"); await insertAudit(client, input.audit); await invalidateTargetSessions(client, input.after.principalId); await client.query("COMMIT"); }
      catch (error) { await client.query("ROLLBACK").catch(() => undefined); throw error; } finally { client.release(); }
    },
  });
}
