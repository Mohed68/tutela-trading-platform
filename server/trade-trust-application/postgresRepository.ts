import type { QueryResultRow } from "pg";
import { pool } from "../db.js";
import type { LocalSubmittedEvidenceReadPort, ProviderEvidenceAssertion } from "../evidence-provider/index.js";
import type { OrganizationMembership } from "../organization-membership/index.js";
import type { OrganizationProfileRevisionContract } from "../organization-registry/index.js";
import { fingerprintOrganizationParticipationRuntimeBinding } from "../organization-participation-eligibility/postgresRuntime.js";
import type { OrganizationVerificationWorkflowStreamIdentity } from "../organization-verification/application/persistence-contract/index.js";

export interface PlatformEvidenceRecord {
  evidenceId: string;
  evidenceVersion: string;
  subjectKind: "organization" | "offer";
  subjectId: string;
  subjectVersion: string;
  assertions: readonly ProviderEvidenceAssertion[];
  submittedBy: string;
  submittedAt: string;
  provenanceReference: string;
  integrityReference: string;
  evidenceFingerprint: string;
}

export async function registerOrganizationAndOwner(input: Readonly<{
  actorUserId: string;
  profile: OrganizationProfileRevisionContract;
  profilePayload: Readonly<Record<string, unknown>>;
  membership: OrganizationMembership;
}>): Promise<"created" | "owner_exists" | "actor_invalid" | "conflict"> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`primary-organization:${input.actorUserId}`]);
    const actor = await client.query<QueryResultRow>(
      `SELECT 1 FROM public.users WHERE id=$1 AND auth_provider='local'
       AND login_enabled=true AND credential_status='active' AND role='trader' FOR SHARE`,
      [input.actorUserId],
    );
    if (actor.rowCount !== 1) { await client.query("ROLLBACK"); return "actor_invalid"; }
    const existing = await client.query(
      `SELECT 1 FROM public.organization_memberships
       WHERE user_id=$1 AND role='owner' AND status='active' LIMIT 1`,
      [input.actorUserId],
    );
    if (existing.rowCount !== 0) { await client.query("ROLLBACK"); return "owner_exists"; }
    await client.query(
      `INSERT INTO public.organization_registry_profile_revisions
       (organization_id,organization_profile_revision_id,registry_contract_version,
        contract_payload,created_at,integrity_reference)
       VALUES ($1,$2,$3,$4::jsonb,$5,$6)`,
      [input.profile.organizationId,input.profile.organizationProfileRevisionId,
       input.profile.registryContractVersion,JSON.stringify(input.profilePayload),
       input.profile.publishedAt,input.profile.organizationProfileFingerprint],
    );
    await insertMembership(client, input.membership);
    await client.query("COMMIT");
    return "created";
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    if (typeof error === "object" && error !== null && "code" in error && (error.code === "23505" || error.code === "23503")) return "conflict";
    throw error;
  } finally { client.release(); }
}

async function insertMembership(client: { query(statement: string, values?: unknown[]): Promise<unknown> }, membership: OrganizationMembership) {
  await client.query(
    `INSERT INTO public.organization_memberships
     (membership_id,user_id,organization_id,role,status,membership_version,
      effective_from,created_at,updated_at,provenance_reference,
      integrity_reference,membership_fingerprint)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [membership.membershipId,membership.userId,membership.organizationId,
     membership.role,membership.status,membership.membershipVersion,
     membership.effectiveFrom,membership.createdAt,membership.updatedAt,
     membership.provenanceReference,membership.integrityReference,
     membership.membershipFingerprint],
  );
}

export async function isActiveOwner(organizationId: string, userId: string): Promise<boolean> {
  const result = await pool.query(
    `SELECT 1 FROM public.organization_memberships WHERE organization_id=$1
     AND user_id=$2 AND role='owner' AND status='active' LIMIT 1`,
    [organizationId,userId],
  );
  return result.rowCount === 1;
}

export async function addOrganizationMembership(actorUserId: string, membership: OrganizationMembership): Promise<"created"|"forbidden"|"conflict"> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const owner = await client.query(
      `SELECT 1 FROM public.organization_memberships WHERE organization_id=$1
       AND user_id=$2 AND role='owner' AND status='active' FOR SHARE`,
      [membership.organizationId,actorUserId],
    );
    if (owner.rowCount !== 1) { await client.query("ROLLBACK"); return "forbidden"; }
    await insertMembership(client, membership);
    await client.query("COMMIT");
    return "created";
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") return "conflict";
    throw error;
  } finally { client.release(); }
}

export async function changeOrganizationMembership(actorUserId: string, membership: OrganizationMembership): Promise<"changed"|"forbidden"|"conflict"> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const owner = await client.query(
      `SELECT 1 FROM public.organization_memberships WHERE organization_id=$1
       AND user_id=$2 AND role='owner' AND status='active' FOR SHARE`,
      [membership.organizationId,actorUserId],
    );
    if (owner.rowCount !== 1) { await client.query("ROLLBACK"); return "forbidden"; }
    const result = await client.query(
      `UPDATE public.organization_memberships SET role=$3,status=$4,
       membership_version=$5,effective_from=$6,updated_at=$7,
       provenance_reference=$8,integrity_reference=$9,membership_fingerprint=$10
       WHERE membership_id=$1 AND organization_id=$2 AND membership_version=$11`,
      [membership.membershipId,membership.organizationId,membership.role,
       membership.status,membership.membershipVersion,membership.effectiveFrom,
       membership.updatedAt,membership.provenanceReference,
       membership.integrityReference,membership.membershipFingerprint,
       membership.membershipVersion-1],
    );
    if (result.rowCount !== 1) { await client.query("ROLLBACK"); return "conflict"; }
    await client.query("COMMIT"); return "changed";
  } catch { await client.query("ROLLBACK").catch(() => undefined); throw new Error("MEMBERSHIP_CHANGE_FAILED"); }
  finally { client.release(); }
}

export async function loadMembership(organizationId: string, membershipId: string): Promise<QueryResultRow | null> {
  const result = await pool.query<QueryResultRow>(
    `SELECT * FROM public.organization_memberships WHERE organization_id=$1 AND membership_id=$2`,
    [organizationId,membershipId],
  );
  return result.rows[0] ?? null;
}

export async function persistPlatformEvidence(evidence: PlatformEvidenceRecord): Promise<"created"|"conflict"> {
  try {
    await pool.query(
      `INSERT INTO public.platform_submitted_evidence
       (evidence_id,evidence_version,subject_kind,subject_id,subject_version,
        assertions,submitted_by,submitted_at,provenance_reference,
        integrity_reference,evidence_fingerprint)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11)`,
      [evidence.evidenceId,evidence.evidenceVersion,evidence.subjectKind,
       evidence.subjectId,evidence.subjectVersion,JSON.stringify(evidence.assertions),
       evidence.submittedBy,evidence.submittedAt,evidence.provenanceReference,
       evidence.integrityReference,evidence.evidenceFingerprint],
    ); return "created";
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") return "conflict";
    throw error;
  }
}

export const platformEvidenceReadPort: LocalSubmittedEvidenceReadPort = Object.freeze({
  async resolveSubmittedEvidence(input: Readonly<{subjectId:string;subjectVersion:string}>) {
    const result = await pool.query<QueryResultRow>(
      `SELECT * FROM public.platform_submitted_evidence
       WHERE subject_id=$1 AND subject_version=$2 ORDER BY submitted_at DESC LIMIT 1`,
      [input.subjectId,input.subjectVersion],
    );
    const row = result.rows[0];
    if (!row || !Array.isArray(row.assertions)) return null;
    return Object.freeze({
      evidenceId:String(row.evidence_id), evidenceVersion:String(row.evidence_version),
      subjectId:String(row.subject_id), subjectVersion:String(row.subject_version),
      assertions:Object.freeze(row.assertions.map((value: ProviderEvidenceAssertion)=>Object.freeze({...value}))),
      submittedAt:new Date(row.submitted_at).toISOString(),
      provenanceReference:String(row.provenance_reference),
      integrityReference:String(row.integrity_reference),
    });
  },
});

export async function loadOrganizationProfile(organizationId:string, profileRevisionId:string):Promise<Record<string,unknown>|null>{
  const result=await pool.query<QueryResultRow>(`SELECT contract_payload FROM public.organization_registry_profile_revisions WHERE organization_id=$1 AND organization_profile_revision_id=$2`,[organizationId,profileRevisionId]);
  const value=result.rows[0]?.contract_payload;
  return typeof value === "object" && value !== null ? value as Record<string,unknown> : null;
}

export async function loadOwnedDraft(offerId:string,userId:string):Promise<{status:string;updatedAt:string}|null>{
  const result=await pool.query<QueryResultRow>(`SELECT status::text,updated_at FROM public.offers WHERE id=$1 AND user_id=$2`,[offerId,userId]);
  const row=result.rows[0];
  return row ? {status:String(row.status),updatedAt:new Date(row.updated_at).toISOString()} : null;
}

export async function loadParticipationProfile(organizationId:string,userId:string):Promise<{profileRevisionId:string;profilePayload:Record<string,unknown>}|null>{
  const result=await pool.query<QueryResultRow>(`SELECT binding.organization_profile_revision_id,profile.contract_payload FROM public.organization_participation_runtime_bindings binding INNER JOIN public.organization_registry_profile_revisions profile ON profile.organization_id=binding.organization_id AND profile.organization_profile_revision_id=binding.organization_profile_revision_id WHERE binding.organization_id=$1 AND binding.user_id=$2`,[organizationId,userId]);
  const row=result.rows[0];return row&&typeof row.organization_profile_revision_id==="string"&&typeof row.contract_payload==="object"&&row.contract_payload!==null?{profileRevisionId:row.organization_profile_revision_id,profilePayload:row.contract_payload as Record<string,unknown>}:null;
}

export async function bindParticipationRuntime(input:Readonly<{organizationId:string;userId:string;profileRevisionId:string;streamIdentity:OrganizationVerificationWorkflowStreamIdentity}>):Promise<void>{
  const client=await pool.connect();try{await client.query("BEGIN");await client.query("SELECT pg_advisory_xact_lock(hashtext($1))",[`participation-binding:${input.organizationId}:${input.userId}`]);
  const membership=await client.query<QueryResultRow>(`SELECT membership_id FROM public.organization_memberships WHERE organization_id=$1 AND user_id=$2 AND role='owner' AND status='active'`,[input.organizationId,input.userId]);
  const membershipId=membership.rows[0]?.membership_id;if(typeof membershipId!=="string")throw new Error("ACTIVE_OWNER_MEMBERSHIP_REQUIRED");
  const existing=await client.query<{binding_version:number}>(`SELECT binding_version FROM public.organization_participation_runtime_bindings WHERE organization_id=$1 AND user_id=$2`,[input.organizationId,input.userId]);
  const bindingId=`participation-binding-${input.organizationId}-${input.userId}`,bindingVersion=(existing.rows[0]?.binding_version??0)+1,integrityReference=`participation-binding-integrity:${input.streamIdentity.streamIdentityFingerprint}`;
  const bindingFingerprint=fingerprintOrganizationParticipationRuntimeBinding({bindingId,organizationId:input.organizationId,userId:input.userId,membershipId,organizationProfileRevisionId:input.profileRevisionId,verificationStreamIdentityFingerprint:input.streamIdentity.streamIdentityFingerprint,bindingVersion,integrityReference});
  await client.query(`INSERT INTO public.organization_participation_runtime_bindings
    (binding_id,organization_id,user_id,membership_id,organization_profile_revision_id,
     registry_contract_version,verification_stream_identity_fingerprint,binding_version,
     integrity_reference,binding_fingerprint)
    VALUES ($1,$2,$3,$4,$5,'organization_registry_profile_revision.v1',$6,$7,$8,$9)
    ON CONFLICT (organization_id,user_id) DO UPDATE SET
      binding_id=EXCLUDED.binding_id,membership_id=EXCLUDED.membership_id,
      organization_profile_revision_id=EXCLUDED.organization_profile_revision_id,
      verification_stream_identity_fingerprint=EXCLUDED.verification_stream_identity_fingerprint,
      binding_version=EXCLUDED.binding_version,
      integrity_reference=EXCLUDED.integrity_reference,
      binding_fingerprint=EXCLUDED.binding_fingerprint`,
    [bindingId,input.organizationId,input.userId,membershipId,input.profileRevisionId,
     input.streamIdentity.streamIdentityFingerprint,bindingVersion,integrityReference,bindingFingerprint]);await client.query("COMMIT");
  }catch(error){await client.query("ROLLBACK").catch(()=>undefined);throw error;}finally{client.release();}
}
