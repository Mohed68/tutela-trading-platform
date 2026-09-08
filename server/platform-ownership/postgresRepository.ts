import type { PlatformOwnershipAssignment } from "./contracts.js";
import type { PlatformOwnershipMutationPort, PlatformOwnershipReadPort } from "./ports.js";

interface Result<Row> { rows: Row[]; rowCount?: number | null }
interface Client { query<Row = Record<string, unknown>>(sql: string, values?: readonly unknown[]): Promise<Result<Row>>; release(): void }
export interface OwnershipPool { query<Row = Record<string, unknown>>(sql: string, values?: readonly unknown[]): Promise<Result<Row>>; connect(): Promise<Client> }
export interface ControlledOwnerIdentityCorrectionInput {
  readonly fromUserId: string;
  readonly toUserId: string;
  readonly reason: string;
  readonly targetPrincipalId: string;
  readonly targetAssignmentId: string;
  readonly auditEventId: string;
  readonly requestId: string;
  readonly correlationId: string;
  readonly occurredAt: string;
}
type Row = { id: string; principal_id: string; status: "active" | "revoked"; authority_source: "initial_bootstrap" | "owner_succession" | "initial_owner_correction"; granted_by_principal_id: string | null; granted_at: Date; grant_reason: string; revoked_by_principal_id: string | null; revoked_at: Date | null; revocation_reason: string | null; version: number };
const columns = `id,principal_id,status,authority_source,granted_by_principal_id,granted_at,grant_reason,revoked_by_principal_id,revoked_at,revocation_reason,version`;
const map = (row: Row): PlatformOwnershipAssignment => Object.freeze({ assignmentId: row.id, principalId: row.principal_id, status: row.status, authoritySource: row.authority_source, grantedByPrincipalId: row.granted_by_principal_id, grantedAt: row.granted_at.toISOString(), grantReason: row.grant_reason, revokedByPrincipalId: row.revoked_by_principal_id, revokedAt: row.revoked_at?.toISOString() ?? null, revocationReason: row.revocation_reason, version: row.version });

async function audit(client: Client, input: { id: string; requestId: string; correlationId: string; actorUserId: string; actorPrincipalId: string; assurance: string; effectivePermission?: "platform.roles.grant" | "platform.roles.revoke"; action: string; targetId: string; before: unknown; after: unknown; reason: string; occurredAt: string }) {
  await client.query(`INSERT INTO public.security_audit_events (id,request_id,correlation_id,actor_user_id,actor_principal_id,actor_roles,effective_permission,session_assurance,action,target_type,target_id,before_value,after_value,reason,severity,occurred_at) VALUES ($1,$2,$3,$4,$5,COALESCE((SELECT jsonb_agg('PLATFORM_OWNER'::text)),'[]'::jsonb),$6,$7,$8,'platform_ownership_assignment',$9,$10::jsonb,$11::jsonb,$12,'critical',$13)`, [input.id,input.requestId,input.correlationId,input.actorUserId,input.actorPrincipalId,input.effectivePermission ?? (input.action === "platform_ownership_revoked" ? "platform.roles.revoke" : "platform.roles.grant"),input.assurance,input.action,input.targetId,JSON.stringify(input.before),JSON.stringify(input.after),input.reason,input.occurredAt]);
}

export function createPostgresPlatformOwnershipRepository(pool: OwnershipPool): PlatformOwnershipReadPort & PlatformOwnershipMutationPort & {
  bootstrapFirstOwner(input: { targetUserId: string; principalId: string; assignmentId: string; auditEventId: string; operatorIdentity: string; reason: string; occurredAt: string }): Promise<"created" | "already_completed">;
  correctInitialOwnerIdentity(input: ControlledOwnerIdentityCorrectionInput): Promise<"completed" | "already_completed">;
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
    async correctInitialOwnerIdentity(input: ControlledOwnerIdentityCorrectionInput) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query("SELECT pg_advisory_xact_lock(846221401)");

        const prior = await client.query<{ before_value: Record<string, unknown>; after_value: Record<string, unknown> }>(
          `SELECT before_value,after_value FROM public.security_audit_events
           WHERE action='PLATFORM_OWNER_IDENTITY_CORRECTION' FOR UPDATE`,
        );
        if (prior.rows.length > 0) {
          if (prior.rows.length !== 1) throw new Error("OWNER_CORRECTION_AUDIT_CONFLICT");
          const before = prior.rows[0]?.before_value;
          const after = prior.rows[0]?.after_value;
          const active = await client.query<{ user_id: string }>(
            `SELECT principal.user_id FROM public.platform_ownership_assignments assignment
             JOIN public.platform_principals principal ON principal.id=assignment.principal_id
             WHERE assignment.status='active' FOR UPDATE`,
          );
          if (
            before?.fromUserId === input.fromUserId &&
            after?.toUserId === input.toUserId &&
            active.rows.length === 1 &&
            active.rows[0]?.user_id === input.toUserId
          ) {
            await client.query("COMMIT");
            return "already_completed";
          }
          throw new Error("OWNER_CORRECTION_ALREADY_COMPLETED");
        }

        const active = await client.query<{ assignment_id: string; principal_id: string; user_id: string }>(
          `SELECT assignment.id AS assignment_id,assignment.principal_id,principal.user_id
           FROM public.platform_ownership_assignments assignment
           JOIN public.platform_principals principal ON principal.id=assignment.principal_id
           WHERE assignment.status='active' FOR UPDATE`,
        );
        if (active.rows.length !== 1 || active.rows[0]?.user_id !== input.fromUserId) {
          throw new Error("CURRENT_OWNER_MISMATCH");
        }
        const oldOwner = active.rows[0];
        const bootstrap = await client.query(
          `SELECT 1 FROM public.platform_ownership_bootstrap_events
           WHERE assignment_id=$1 AND target_user_id=$2 AND target_principal_id=$3
             AND execution_context='server_cli' AND severity='critical' FOR UPDATE`,
          [oldOwner.assignment_id, input.fromUserId, oldOwner.principal_id],
        );
        if (bootstrap.rowCount !== 1) throw new Error("INITIAL_OWNER_BOOTSTRAP_PROVENANCE_REQUIRED");

        const identities = await client.query<{
          id: string; auth_provider: string; login_enabled: boolean;
          credential_status: string; email_verified: boolean; password_present: boolean;
        }>(
          `SELECT id,auth_provider,login_enabled,credential_status,
                  email_verified_at IS NOT NULL AS email_verified,
                  password_hash IS NOT NULL AS password_present
           FROM public.users WHERE id=ANY($1::varchar[]) FOR UPDATE`,
          [[input.fromUserId, input.toUserId]],
        );
        if (identities.rows.length !== 2) throw new Error("OWNER_CORRECTION_IDENTITY_AMBIGUOUS");
        const target = identities.rows.find((row) => row.id === input.toUserId);
        if (
          !target || target.auth_provider !== "local" || !target.login_enabled ||
          target.credential_status !== "active" || !target.email_verified || !target.password_present
        ) throw new Error("CORRECTION_TARGET_INELIGIBLE");
        const mfa = await client.query(
          `SELECT 1 FROM public.user_mfa_credentials
           WHERE user_id=$1 AND status='active' FOR UPDATE`,
          [input.toUserId],
        );
        if (mfa.rowCount !== 1) throw new Error("CORRECTION_TARGET_ACTIVE_MFA_REQUIRED");

        const existingPrincipal = await client.query<{ id: string }>(
          "SELECT id FROM public.platform_principals WHERE user_id=$1 FOR UPDATE",
          [input.toUserId],
        );
        const targetPrincipalId = existingPrincipal.rows[0]?.id ?? input.targetPrincipalId;
        if (existingPrincipal.rows[0]) {
          await client.query("UPDATE public.platform_principals SET status='active',updated_at=$2 WHERE id=$1", [targetPrincipalId, input.occurredAt]);
        } else {
          await client.query(
            "INSERT INTO public.platform_principals(id,user_id,status,created_at,updated_at) VALUES($1,$2,'active',$3,$3)",
            [targetPrincipalId, input.toUserId, input.occurredAt],
          );
        }
        const targetOwnership = await client.query(
          "SELECT 1 FROM public.platform_ownership_assignments WHERE principal_id=$1 AND status='active'",
          [targetPrincipalId],
        );
        if (targetOwnership.rowCount !== 0) throw new Error("CORRECTION_TARGET_OWNERSHIP_CONFLICT");
        await client.query(
          `INSERT INTO public.platform_ownership_assignments
           (id,principal_id,status,authority_source,granted_by_principal_id,granted_at,grant_reason)
           VALUES($1,$2,'active','initial_owner_correction',NULL,$3,$4)`,
          [input.targetAssignmentId, targetPrincipalId, input.occurredAt, input.reason],
        );
        const intermediate = await client.query<{ count: number }>(
          "SELECT count(*)::int AS count FROM public.platform_ownership_assignments WHERE status='active'",
        );
        if (intermediate.rows[0]?.count !== 2) throw new Error("OWNER_CORRECTION_INTERMEDIATE_INVARIANT_FAILED");
        const revoked = await client.query(
          `UPDATE public.platform_ownership_assignments
           SET status='revoked',revoked_by_principal_id=NULL,revoked_at=$2,
               revocation_reason=$3,revocation_authority_source='controlled_recovery',version=version+1
           WHERE id=$1 AND status='active'`,
          [oldOwner.assignment_id, input.occurredAt, input.reason],
        );
        if (revoked.rowCount !== 1) throw new Error("OWNER_CORRECTION_REVOCATION_CONFLICT");
        const final = await client.query<{ user_id: string }>(
          `SELECT principal.user_id FROM public.platform_ownership_assignments assignment
           JOIN public.platform_principals principal ON principal.id=assignment.principal_id
           WHERE assignment.status='active' FOR UPDATE`,
        );
        if (final.rows.length !== 1 || final.rows[0]?.user_id !== input.toUserId) {
          throw new Error("OWNER_CORRECTION_FINAL_INVARIANT_FAILED");
        }
        await client.query(
          `INSERT INTO public.security_audit_events
           (id,request_id,correlation_id,actor_user_id,actor_principal_id,actor_roles,
            effective_permission,session_assurance,action,target_type,target_id,
            before_value,after_value,reason,severity,occurred_at)
           VALUES($1,$2,$3,NULL,NULL,$4::jsonb,'platform.owner.identity_correction',
            'controlled_recovery','PLATFORM_OWNER_IDENTITY_CORRECTION',
            'platform_ownership_identity',$5,$6::jsonb,$7::jsonb,$8,'critical',$9)`,
          [
            input.auditEventId, input.requestId, input.correlationId,
            JSON.stringify(["CONTROLLED_RECOVERY_AUTHORITY"]), targetPrincipalId,
            JSON.stringify({ fromUserId: input.fromUserId, fromPrincipalId: oldOwner.principal_id, fromAssignmentId: oldOwner.assignment_id, activeOwnerCount: 1 }),
            JSON.stringify({ toUserId: input.toUserId, toPrincipalId: targetPrincipalId, toAssignmentId: input.targetAssignmentId, activeOwnerCount: 1 }),
            input.reason, input.occurredAt,
          ],
        );
        await client.query("DELETE FROM public.sessions WHERE sess #>> '{passport,user}'=$1", [input.fromUserId]);
        await client.query("COMMIT");
        return "completed";
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    },
    async commitOwnershipGrant(input: Parameters<PlatformOwnershipMutationPort["commitOwnershipGrant"]>[0]) {
      const client = await pool.connect(); try { await client.query("BEGIN"); await client.query(`SELECT pg_advisory_xact_lock(846221401)`); const target = await client.query(`SELECT id FROM public.platform_principals WHERE id=$1 AND status='active' FOR UPDATE`, [input.assignment.principalId]); if (target.rowCount !== 1) throw new Error("ACTIVE_TARGET_PRINCIPAL_REQUIRED"); await client.query(`INSERT INTO public.platform_ownership_assignments(id,principal_id,status,authority_source,granted_by_principal_id,granted_at,grant_reason) VALUES($1,$2,'active','owner_succession',$3,$4,$5)`, [input.assignment.assignmentId,input.assignment.principalId,input.assignment.grantedByPrincipalId,input.assignment.grantedAt,input.assignment.grantReason]); await audit(client,{id:input.auditEventId,requestId:input.requestId,correlationId:input.correlationId,actorUserId:input.actorUserId,actorPrincipalId:input.assignment.grantedByPrincipalId!,assurance:input.sessionAssurance,action:"platform_ownership_granted",targetId:input.assignment.principalId,before:{active:false},after:{active:true,assignmentId:input.assignment.assignmentId},reason:input.assignment.grantReason,occurredAt:input.occurredAt}); await client.query(`DELETE FROM public.sessions WHERE sess #>> '{passport,user}'=(SELECT user_id FROM public.platform_principals WHERE id=$1)`,[input.assignment.principalId]); await client.query("COMMIT"); } catch(error){await client.query("ROLLBACK").catch(()=>undefined);throw error;} finally{client.release();}
    },
    async commitOwnershipRevocation(input: Parameters<PlatformOwnershipMutationPort["commitOwnershipRevocation"]>[0]) {
      const client = await pool.connect(); try { await client.query("BEGIN"); await client.query(`SELECT pg_advisory_xact_lock(846221401)`); const active=await client.query<{id:string}>(`SELECT id FROM public.platform_ownership_assignments WHERE status='active' FOR UPDATE`); if(active.rows.length <= 1) throw new Error("FINAL_PLATFORM_OWNER"); const updated=await client.query(`UPDATE public.platform_ownership_assignments SET status='revoked',revoked_by_principal_id=$2,revoked_at=$3,revocation_reason=$4,version=version+1 WHERE id=$1 AND status='active'`,[input.after.assignmentId,input.after.revokedByPrincipalId,input.after.revokedAt,input.after.revocationReason]);if(updated.rowCount!==1)throw new Error("OWNERSHIP_REVOCATION_CONFLICT");await audit(client,{id:input.auditEventId,requestId:input.requestId,correlationId:input.correlationId,actorUserId:input.actorUserId,actorPrincipalId:input.after.revokedByPrincipalId!,assurance:input.sessionAssurance,action:"platform_ownership_revoked",targetId:input.after.principalId,before:{active:true,assignmentId:input.before.assignmentId},after:{active:false,assignmentId:input.after.assignmentId},reason:input.after.revocationReason!,occurredAt:input.occurredAt});await client.query(`DELETE FROM public.sessions WHERE sess #>> '{passport,user}'=(SELECT user_id FROM public.platform_principals WHERE id=$1)`,[input.after.principalId]);await client.query("COMMIT");}catch(error){await client.query("ROLLBACK").catch(()=>undefined);throw error;}finally{client.release();}
    },
  });
}
