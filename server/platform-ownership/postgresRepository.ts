import type { PlatformOwnershipAssignment } from "./contracts.js";
import type { PlatformOwnershipMutationPort, PlatformOwnershipReadPort } from "./ports.js";

interface Result<Row> { rows: Row[]; rowCount?: number | null }
interface Client { query<Row = Record<string, unknown>>(sql: string, values?: readonly unknown[]): Promise<Result<Row>>; release(): void }
export interface OwnershipPool { query<Row = Record<string, unknown>>(sql: string, values?: readonly unknown[]): Promise<Result<Row>>; connect(): Promise<Client> }
type Row = { id: string; principal_id: string; status: "active" | "revoked"; authority_source: "initial_bootstrap" | "owner_succession"; granted_by_principal_id: string | null; granted_at: Date; grant_reason: string; revoked_by_principal_id: string | null; revoked_at: Date | null; revocation_reason: string | null; version: number };
const columns = `id,principal_id,status,authority_source,granted_by_principal_id,granted_at,grant_reason,revoked_by_principal_id,revoked_at,revocation_reason,version`;
const map = (row: Row): PlatformOwnershipAssignment => Object.freeze({ assignmentId: row.id, principalId: row.principal_id, status: row.status, authoritySource: row.authority_source, grantedByPrincipalId: row.granted_by_principal_id, grantedAt: row.granted_at.toISOString(), grantReason: row.grant_reason, revokedByPrincipalId: row.revoked_by_principal_id, revokedAt: row.revoked_at?.toISOString() ?? null, revocationReason: row.revocation_reason, version: row.version });

async function audit(client: Client, input: { id: string; requestId: string; correlationId: string; actorUserId: string; actorPrincipalId: string; assurance: string; effectivePermission?: "platform.roles.grant" | "platform.roles.revoke"; action: string; targetId: string; before: unknown; after: unknown; reason: string; occurredAt: string }) {
  await client.query(`INSERT INTO public.security_audit_events (id,request_id,correlation_id,actor_user_id,actor_principal_id,actor_roles,effective_permission,session_assurance,action,target_type,target_id,before_value,after_value,reason,severity,occurred_at) VALUES ($1,$2,$3,$4,$5,COALESCE((SELECT jsonb_agg('PLATFORM_OWNER'::text)),'[]'::jsonb),$6,$7,$8,'platform_ownership_assignment',$9,$10::jsonb,$11::jsonb,$12,'critical',$13)`, [input.id,input.requestId,input.correlationId,input.actorUserId,input.actorPrincipalId,input.effectivePermission ?? (input.action === "platform_ownership_revoked" ? "platform.roles.revoke" : "platform.roles.grant"),input.assurance,input.action,input.targetId,JSON.stringify(input.before),JSON.stringify(input.after),input.reason,input.occurredAt]);
}

export function createPostgresPlatformOwnershipRepository(pool: OwnershipPool): PlatformOwnershipReadPort & PlatformOwnershipMutationPort & {
  bootstrapFirstOwner(input: { targetUserId: string; principalId: string; assignmentId: string; auditEventId: string; operatorIdentity: string; reason: string; occurredAt: string }): Promise<"created" | "already_completed">;
} {
  return Object.freeze({
    async findPrincipalIdByUserId(userId: string) { const r = await pool.query<{ id: string }>(`SELECT id FROM public.platform_principals WHERE user_id=$1 AND status='active'`, [userId]); return r.rows[0]?.id; },
    async listOwnershipAssignments(principalId?: string) { const r = principalId ? await pool.query<Row>(`SELECT ${columns} FROM public.platform_ownership_assignments WHERE principal_id=$1 ORDER BY granted_at,id`, [principalId]) : await pool.query<Row>(`SELECT ${columns} FROM public.platform_ownership_assignments ORDER BY granted_at,id`); return Object.freeze(r.rows.map(map)); },
    async bootstrapFirstOwner(input: { targetUserId: string; principalId: string; assignmentId: string; auditEventId: string; operatorIdentity: string; reason: string; occurredAt: string }) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN"); await client.query(`SELECT pg_advisory_xact_lock(846221401)`);
        const user = await client.query<{ id: string }>(`SELECT id FROM public.users WHERE id=$1 AND auth_provider='local' AND login_enabled=true AND credential_status='active' AND email_verified_at IS NOT NULL AND password_hash IS NOT NULL FOR UPDATE`, [input.targetUserId]);
        if (user.rowCount !== 1) throw new Error("BOOTSTRAP_TARGET_INELIGIBLE");
        const owners = await client.query<{ id: string; principal_id: string }>(`SELECT id,principal_id FROM public.platform_ownership_assignments WHERE status='active' FOR UPDATE`);
        if (owners.rows.length > 0) {
          const bootstrap = owners.rows.length === 1 ? await client.query<{ target_user_id: string }>(`SELECT target_user_id FROM public.platform_ownership_bootstrap_events WHERE assignment_id=$1`, [owners.rows[0].id]) : { rows: [] };
          if (bootstrap.rows[0]?.target_user_id === input.targetUserId) { await client.query("COMMIT"); return "already_completed"; }
          throw new Error("PLATFORM_OWNER_ALREADY_EXISTS");
        }
        const existing = await client.query<{ id: string }>(`SELECT id FROM public.platform_principals WHERE user_id=$1 FOR UPDATE`, [input.targetUserId]);
        const principalId = existing.rows[0]?.id ?? input.principalId;
        if (!existing.rows[0]) await client.query(`INSERT INTO public.platform_principals(id,user_id,status,created_at,updated_at) VALUES($1,$2,'active',$3,$3)`, [principalId,input.targetUserId,input.occurredAt]);
        else await client.query(`UPDATE public.platform_principals SET status='active',updated_at=$2 WHERE id=$1`, [principalId,input.occurredAt]);
        await client.query(`INSERT INTO public.platform_ownership_assignments(id,principal_id,status,authority_source,granted_by_principal_id,granted_at,grant_reason) VALUES($1,$2,'active','initial_bootstrap',NULL,$3,$4)`, [input.assignmentId,principalId,input.occurredAt,input.reason]);
        await client.query(`INSERT INTO public.platform_ownership_bootstrap_events(id,assignment_id,target_user_id,target_principal_id,operator_identity,reason,occurred_at) VALUES($1,$2,$3,$4,$5,$6,$7)`, [input.auditEventId,input.assignmentId,input.targetUserId,principalId,input.operatorIdentity,input.reason,input.occurredAt]);
        await client.query("COMMIT"); return "created";
      } catch (error) { await client.query("ROLLBACK").catch(() => undefined); throw error; } finally { client.release(); }
    },
    async commitOwnershipGrant(input: Parameters<PlatformOwnershipMutationPort["commitOwnershipGrant"]>[0]) {
      const client = await pool.connect(); try { await client.query("BEGIN"); await client.query(`SELECT pg_advisory_xact_lock(846221401)`); const target = await client.query(`SELECT id FROM public.platform_principals WHERE id=$1 AND status='active' FOR UPDATE`, [input.assignment.principalId]); if (target.rowCount !== 1) throw new Error("ACTIVE_TARGET_PRINCIPAL_REQUIRED"); await client.query(`INSERT INTO public.platform_ownership_assignments(id,principal_id,status,authority_source,granted_by_principal_id,granted_at,grant_reason) VALUES($1,$2,'active','owner_succession',$3,$4,$5)`, [input.assignment.assignmentId,input.assignment.principalId,input.assignment.grantedByPrincipalId,input.assignment.grantedAt,input.assignment.grantReason]); await audit(client,{id:input.auditEventId,requestId:input.requestId,correlationId:input.correlationId,actorUserId:input.actorUserId,actorPrincipalId:input.assignment.grantedByPrincipalId!,assurance:input.sessionAssurance,action:"platform_ownership_granted",targetId:input.assignment.principalId,before:{active:false},after:{active:true,assignmentId:input.assignment.assignmentId},reason:input.assignment.grantReason,occurredAt:input.occurredAt}); await client.query(`DELETE FROM public.sessions WHERE sess #>> '{passport,user}'=(SELECT user_id FROM public.platform_principals WHERE id=$1)`,[input.assignment.principalId]); await client.query("COMMIT"); } catch(error){await client.query("ROLLBACK").catch(()=>undefined);throw error;} finally{client.release();}
    },
    async commitOwnershipRevocation(input: Parameters<PlatformOwnershipMutationPort["commitOwnershipRevocation"]>[0]) {
      const client = await pool.connect(); try { await client.query("BEGIN"); await client.query(`SELECT pg_advisory_xact_lock(846221401)`); const active=await client.query<{id:string}>(`SELECT id FROM public.platform_ownership_assignments WHERE status='active' FOR UPDATE`); if(active.rows.length <= 1) throw new Error("FINAL_PLATFORM_OWNER"); const updated=await client.query(`UPDATE public.platform_ownership_assignments SET status='revoked',revoked_by_principal_id=$2,revoked_at=$3,revocation_reason=$4,version=version+1 WHERE id=$1 AND status='active'`,[input.after.assignmentId,input.after.revokedByPrincipalId,input.after.revokedAt,input.after.revocationReason]);if(updated.rowCount!==1)throw new Error("OWNERSHIP_REVOCATION_CONFLICT");await audit(client,{id:input.auditEventId,requestId:input.requestId,correlationId:input.correlationId,actorUserId:input.actorUserId,actorPrincipalId:input.after.revokedByPrincipalId!,assurance:input.sessionAssurance,action:"platform_ownership_revoked",targetId:input.after.principalId,before:{active:true,assignmentId:input.before.assignmentId},after:{active:false,assignmentId:input.after.assignmentId},reason:input.after.revocationReason!,occurredAt:input.occurredAt});await client.query(`DELETE FROM public.sessions WHERE sess #>> '{passport,user}'=(SELECT user_id FROM public.platform_principals WHERE id=$1)`,[input.after.principalId]);await client.query("COMMIT");}catch(error){await client.query("ROLLBACK").catch(()=>undefined);throw error;}finally{client.release();}
    },
  });
}
