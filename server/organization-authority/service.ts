import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";

import { createOrganizationMembership } from "../organization-membership/index.js";
import { fingerprintSigningAuthority } from "../mvp-closure/domain.js";
import {
  canonicalFingerprint, domainFromVerifiedEmail, evaluateInvitation,
  mayAutoJoin, resolveOrganization, type OrganizationCapability,
} from "./domain.js";

type Result<T> = Readonly<{ ok: true; value: T }> | Readonly<{ ok: false; code: string }>;
const ok = <T>(value: T): Result<T> => ({ ok: true, value });
const fail = (code: string): Result<never> => ({ ok: false, code });
const now = () => new Date();
const digest = (value: string) => `sha256:${createHash("sha256").update(value).digest("hex")}`;

async function transaction<T>(pool: Pool, work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try { await client.query("BEGIN"); const value = await work(client); await client.query("COMMIT"); return value; }
  catch (error) { await client.query("ROLLBACK").catch(() => undefined); throw error; }
  finally { client.release(); }
}

async function account(client: Pool | PoolClient, userId: string) {
  return (await client.query<{ id: string; email: string | null; email_verified_at: Date | null }>(
    `SELECT id,email,email_verified_at FROM public.users WHERE id=$1 AND auth_provider='local' AND login_enabled=true AND credential_status='active'`, [userId],
  )).rows[0] ?? null;
}
async function activeMembership(client: Pool | PoolClient, organizationId: string, userId: string) {
  return (await client.query<{ membership_id: string; role: "owner" | "member" }>(
    `SELECT membership_id,role FROM public.organization_memberships WHERE organization_id=$1 AND user_id=$2 AND status='active'`, [organizationId, userId],
  )).rows[0] ?? null;
}
async function hasCapability(client: Pool | PoolClient, organizationId: string, userId: string, capability: OrganizationCapability) {
  const membership = await activeMembership(client, organizationId, userId);
  if (!membership) return false;
  if (membership.role === "owner") return true;
  const result = await client.query(
    `SELECT 1 FROM public.organization_capability_grants grant_record
     LEFT JOIN public.organization_capability_revocations revocation ON revocation.capability_grant_id=grant_record.capability_grant_id
     WHERE grant_record.organization_id=$1 AND grant_record.user_id=$2 AND grant_record.capability=$3
       AND revocation.revocation_id IS NULL AND (grant_record.valid_until IS NULL OR grant_record.valid_until>now()) LIMIT 1`,
    [organizationId, userId, capability],
  );
  return result.rowCount === 1;
}
async function event(client: PoolClient, organizationId: string, actorUserId: string, eventType: string, subjectReference: string, payload: unknown) {
  const occurredAt = now().toISOString();
  await client.query(
    `INSERT INTO public.organization_authority_events(event_id,organization_id,event_type,actor_user_id,subject_reference,event_payload,occurred_at,event_fingerprint)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
    [randomUUID(), organizationId, eventType, actorUserId, subjectReference, JSON.stringify(payload), occurredAt, canonicalFingerprint("organization-authority-event/v1", { organizationId, actorUserId, eventType, subjectReference, payload, occurredAt })],
  );
}
async function insertBasicMembership(client: PoolClient, organizationId: string, userId: string, provenance: string) {
  const existing = await activeMembership(client, organizationId, userId);
  if (existing) return existing.membership_id;
  const at = now().toISOString(); const membershipId = `organization-membership-${randomUUID()}`;
  const membership = createOrganizationMembership({ membershipId, userId, organizationId: organizationId as any, role: "member", status: "active", membershipVersion: 1, effectiveFrom: at, createdAt: at, updatedAt: at, provenanceReference: provenance, integrityReference: canonicalFingerprint("organization-membership-integrity/v1", { organizationId, userId, provenance, at }) });
  if (!membership.ok) throw new Error("INVALID_MEMBERSHIP");
  await client.query(
    `INSERT INTO public.organization_memberships(membership_id,user_id,organization_id,role,status,membership_version,effective_from,created_at,updated_at,provenance_reference,integrity_reference,membership_fingerprint)
     VALUES($1,$2,$3,'member','active',1,$4,$4,$4,$5,$6,$7)`,
    [membershipId, userId, organizationId, at, provenance, membership.value.integrityReference, membership.value.membershipFingerprint],
  );
  return membershipId;
}

export function createOrganizationAuthorityService(pool: Pool) {
  return Object.freeze({
    async resolve(userId: string, input: { legalName?: string; jurisdiction?: string; registrationIdentifier?: string }) {
      const user = await account(pool, userId); if (!user) return fail("actor_invalid");
      const emailDomain = domainFromVerifiedEmail(user.email ?? "", Boolean(user.email_verified_at));
      const rows = await pool.query<any>(
        `WITH latest AS (
           SELECT DISTINCT ON (organization_id) organization_id,contract_payload
           FROM public.organization_registry_profile_revisions ORDER BY organization_id,created_at DESC
         )
         SELECT latest.organization_id,
           latest.contract_payload#>>'{legal_identity_projection,legal_name}' legal_name,
           COALESCE(latest.contract_payload#>>'{legal_identity_projection,registration_jurisdiction}',latest.contract_payload->>'jurisdiction') jurisdiction,
           EXISTS(SELECT 1 FROM public.organization_verified_domains domain_record WHERE domain_record.organization_id=latest.organization_id AND domain_record.normalized_domain=$1 AND domain_record.status='VERIFIED') verified_domain_match,
           EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(latest.contract_payload#>'{legal_identity_projection,registration_identifiers}','[]'::jsonb)) identifier WHERE lower(identifier->>'value')=lower($2)) exact_identifier_match,
           CASE WHEN $3<>'' THEN lower(latest.contract_payload#>>'{legal_identity_projection,legal_name}') LIKE '%'||lower($3)||'%' OR lower($3) LIKE '%'||lower(latest.contract_payload#>>'{legal_identity_projection,legal_name}')||'%' ELSE false END possible_name_match,
           NULL::text trust_status
         FROM latest
         WHERE ($1<>'' AND EXISTS(SELECT 1 FROM public.organization_verified_domains d WHERE d.organization_id=latest.organization_id AND d.normalized_domain=$1 AND d.status='VERIFIED'))
            OR ($2<>'' AND EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(latest.contract_payload#>'{legal_identity_projection,registration_identifiers}','[]'::jsonb)) i WHERE lower(i->>'value')=lower($2)))
            OR ($3<>'' AND (lower(latest.contract_payload#>>'{legal_identity_projection,legal_name}') LIKE '%'||lower($3)||'%' OR lower($3) LIKE '%'||lower(latest.contract_payload#>>'{legal_identity_projection,legal_name}')||'%'))
         LIMIT 20`,
        [emailDomain ?? "", input.registrationIdentifier?.trim() ?? "", input.legalName?.trim() ?? ""],
      );
      const membership = (await pool.query<{ organization_id: string }>(`SELECT organization_id FROM public.organization_memberships WHERE user_id=$1 AND status='active' LIMIT 2`, [userId])).rows;
      const pending = (await pool.query<{ organization_id: string }>(`SELECT organization_id FROM public.organization_membership_requests WHERE user_id=$1 AND status='PENDING'`, [userId])).rows.map((row) => row.organization_id);
      const candidates = rows.rows.map((row: any) => ({ organizationId: row.organization_id, legalName: row.legal_name, jurisdiction: row.jurisdiction, verifiedDomainMatch: row.verified_domain_match, exactIdentifierMatch: row.exact_identifier_match, possibleNameMatch: row.possible_name_match, trustStatus: row.trust_status ?? null }));
      return ok({ ...resolveOrganization({ candidates, activeMembershipOrganizationId: membership.length === 1 ? membership[0]!.organization_id : undefined, pendingInvitationOrganizationIds: pending }), verifiedEmailDomain: emailDomain });
    },

    async join(userId: string, organizationId: string) {
      return transaction(pool, async (client) => {
        const user = await account(client, userId); if (!user?.email || !user.email_verified_at) return fail("verified_email_required");
        const currentMembership=(await client.query<{organization_id:string}>(`SELECT organization_id FROM public.organization_memberships WHERE user_id=$1 AND status='active' LIMIT 1`,[userId])).rows[0];
        if (currentMembership) return fail(currentMembership.organization_id===organizationId?"membership_exists":"organization_membership_conflict");
        const domain = domainFromVerifiedEmail(user.email, true)!;
        const verifiedDomain = (await client.query<any>(`SELECT normalized_domain,status FROM public.organization_verified_domains WHERE organization_id=$1 AND normalized_domain=$2 ORDER BY created_at DESC LIMIT 1`, [organizationId, domain])).rows[0];
        const policy = (await client.query<any>(`SELECT policy_kind FROM public.organization_membership_policies WHERE organization_id=$1 AND superseded_at IS NULL`, [organizationId])).rows[0]?.policy_kind ?? "APPROVAL_REQUIRED";
        if (verifiedDomain && mayAutoJoin({ emailVerified: true, emailDomain: domain, organizationDomain: verifiedDomain.normalized_domain, domainStatus: verifiedDomain.status, membershipPolicy: policy, conflictOrRisk: false })) {
          const membershipId = await insertBasicMembership(client, organizationId, userId, `verified-domain-auto-join:${verifiedDomain.normalized_domain}`);
          await event(client, organizationId, userId, "MEMBERSHIP_AUTO_JOINED", membershipId, { policy, domain: verifiedDomain.normalized_domain, role: "member" });
          return ok({ outcome: "JOINED", membershipId, role: "member" as const });
        }
        const requestId = randomUUID(); const requestedAt = now().toISOString();
        await client.query(
          `INSERT INTO public.organization_membership_requests(request_id,organization_id,user_id,normalized_email,resolution_basis,status,requested_at,request_fingerprint)
           VALUES($1,$2,$3,$4,$5,'PENDING',$6,$7) ON CONFLICT(organization_id,user_id) DO NOTHING`,
          [requestId, organizationId, userId, user.email.toLowerCase(), verifiedDomain ? "VERIFIED_DOMAIN" : "EXPLICIT_SELECTION", requestedAt, canonicalFingerprint("organization-membership-request/v1", { requestId, organizationId, userId, email: user.email.toLowerCase(), requestedAt })],
        );
        await event(client, organizationId, userId, "MEMBERSHIP_REQUESTED", requestId, { resolutionBasis: verifiedDomain ? "VERIFIED_DOMAIN" : "EXPLICIT_SELECTION" });
        return ok({ outcome: "MEMBERSHIP_PENDING", requestId });
      });
    },

    async workspace(userId: string, organizationId: string) {
      const viewerMembership=await activeMembership(pool, organizationId, userId);if (!viewerMembership) return fail("not_found");
      const [profile, team, membershipRequests, domains, membershipPolicy, capabilities, mandates, signingPolicy, audit] = await Promise.all([
        pool.query<any>(`SELECT contract_payload FROM public.organization_registry_profile_revisions WHERE organization_id=$1 ORDER BY created_at DESC LIMIT 1`, [organizationId]),
        pool.query<any>(`SELECT membership.membership_id,membership.user_id,membership.role,membership.status,account.email,concat_ws(' ',account.first_name,account.last_name) display_name FROM public.organization_memberships membership JOIN public.users account ON account.id=membership.user_id WHERE membership.organization_id=$1 ORDER BY membership.created_at`, [organizationId]),
        viewerMembership.role==="owner"?pool.query<any>(`SELECT request_id,user_id,normalized_email,resolution_basis,status,requested_at FROM public.organization_membership_requests WHERE organization_id=$1 AND status='PENDING' ORDER BY requested_at`, [organizationId]):Promise.resolve({rows:[]} as any),
        pool.query<any>(`SELECT domain_id,normalized_domain,status,verification_method,verified_at,revoked_at,reason FROM public.organization_verified_domains WHERE organization_id=$1 ORDER BY created_at DESC`, [organizationId]),
        pool.query<any>(`SELECT policy_id,policy_version,policy_kind,effective_from FROM public.organization_membership_policies WHERE organization_id=$1 AND superseded_at IS NULL`, [organizationId]),
        pool.query<any>(`SELECT grant_record.capability_grant_id,grant_record.user_id,grant_record.capability,grant_record.granted_at,grant_record.valid_until,(revocation.revocation_id IS NULL) active FROM public.organization_capability_grants grant_record LEFT JOIN public.organization_capability_revocations revocation ON revocation.capability_grant_id=grant_record.capability_grant_id WHERE grant_record.organization_id=$1`, [organizationId]),
        pool.query<any>(`SELECT mandate.mandate_id,mandate.user_id,mandate.action_scope,mandate.contract_type_scope,mandate.commodity_scope,mandate.maximum_transaction_value,mandate.value_currency,mandate.signature_eligibility,mandate.valid_from,mandate.valid_until,(revocation.revocation_id IS NULL) active FROM public.organization_signing_mandates mandate LEFT JOIN public.organization_signing_mandate_revocations revocation ON revocation.mandate_id=mandate.mandate_id WHERE mandate.organization_id=$1 ORDER BY mandate.granted_at DESC`, [organizationId]),
        pool.query<any>(`SELECT signing_policy_id,policy_version,policy_kind,policy_payload,effective_from FROM public.organization_signing_policies WHERE organization_id=$1 AND superseded_at IS NULL`, [organizationId]),
        pool.query<any>(`SELECT event_type,actor_user_id,subject_reference,event_payload,occurred_at FROM public.organization_authority_events WHERE organization_id=$1 ORDER BY occurred_at DESC LIMIT 50`, [organizationId]),
      ]);
      return ok({ organizationId, profile: profile.rows[0]?.contract_payload ?? null, team: team.rows, membershipRequests: membershipRequests.rows, verifiedDomains: domains.rows, membershipPolicy: membershipPolicy.rows[0] ?? { policyKind: "APPROVAL_REQUIRED", compatibilityDefault: true }, capabilityGrants: capabilities.rows, signingMandates: mandates.rows, signingPolicy: signingPolicy.rows[0] ?? { policyKind: "COMPATIBILITY_SINGLE", policyPayload: { requiredSignatures: 1 }, compatibilityDefault: true }, auditActivity: audit.rows });
    },

    async requestDomain(userId: string, organizationId: string, input: { domain: string; verificationMethod: string; reason: string }) {
      if (!await hasCapability(pool, organizationId, userId, "MANAGE_MEMBERS")) return fail("authority_required");
      return transaction(pool, async (client) => {
        const domainId = randomUUID(); const createdAt = now().toISOString();
        await client.query(`INSERT INTO public.organization_verified_domains(domain_id,organization_id,normalized_domain,status,verification_method,verification_provenance,reason,created_by_user_id,created_at,domain_fingerprint) VALUES($1,$2,$3,'PENDING',$4,'organization-request',$5,$6,$7,$8)`, [domainId, organizationId, input.domain, input.verificationMethod, input.reason, userId, createdAt, canonicalFingerprint("organization-domain-request/v1", { domainId, organizationId, domain: input.domain, method: input.verificationMethod, userId, createdAt })]);
        await event(client, organizationId, userId, "DOMAIN_VERIFICATION_REQUESTED", domainId, { domain: input.domain, verificationMethod: input.verificationMethod });
        return ok({ domainId, status: "PENDING" as const });
      });
    },

    async setMembershipPolicy(userId: string, organizationId: string, policyKind: "APPROVAL_REQUIRED" | "VERIFIED_DOMAIN_AUTO_JOIN") {
      if (!await hasCapability(pool, organizationId, userId, "MANAGE_MEMBERS")) return fail("authority_required");
      return transaction(pool, async (client) => {
        await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`membership-policy:${organizationId}`]);
        const prior = (await client.query<any>(`SELECT policy_id,policy_version FROM public.organization_membership_policies WHERE organization_id=$1 AND superseded_at IS NULL`, [organizationId])).rows[0];
        const createdAt = now().toISOString(); if (prior) await client.query(`UPDATE public.organization_membership_policies SET superseded_at=$2 WHERE policy_id=$1`, [prior.policy_id, createdAt]);
        const policyId = randomUUID(), policyVersion = (prior?.policy_version ?? 0) + 1;
        await client.query(`INSERT INTO public.organization_membership_policies(policy_id,organization_id,policy_version,policy_kind,effective_from,created_by_user_id,created_at,policy_fingerprint) VALUES($1,$2,$3,$4,$5,$6,$5,$7)`, [policyId, organizationId, policyVersion, policyKind, createdAt, userId, canonicalFingerprint("organization-membership-policy/v1", { policyId, organizationId, policyVersion, policyKind, createdAt, userId })]);
        await event(client, organizationId, userId, "MEMBERSHIP_POLICY_ACTIVATED", policyId, { policyVersion, policyKind }); return ok({ policyId, policyVersion, policyKind });
      });
    },

    async invite(userId: string, organizationId: string, email: string, expiresInHours: number) {
      if (!await hasCapability(pool, organizationId, userId, "MANAGE_MEMBERS")) return fail("authority_required");
      return transaction(pool, async (client) => {
        const invitationId = randomUUID(), token = randomBytes(32).toString("base64url"), createdAt = now(), expiresAt = new Date(createdAt.getTime() + expiresInHours * 3_600_000);
        await client.query(`INSERT INTO public.organization_membership_invitations(invitation_id,organization_id,normalized_email,token_digest,membership_role,invited_by_user_id,expires_at,reason,created_at,invitation_fingerprint) VALUES($1,$2,$3,$4,'member',$5,$6,'Authorized team invitation',$7,$8)`, [invitationId, organizationId, email, digest(token), userId, expiresAt, createdAt, canonicalFingerprint("organization-membership-invitation/v1", { invitationId, organizationId, email, userId, expiresAt: expiresAt.toISOString(), createdAt: createdAt.toISOString() })]);
        await event(client, organizationId, userId, "MEMBERSHIP_INVITATION_CREATED", invitationId, { normalizedEmail: email, expiresAt: expiresAt.toISOString(), role: "member" });
        return ok({ invitationId, token, expiresAt: expiresAt.toISOString(), role: "member" as const });
      });
    },

    async redeemInvitation(userId: string, token: string) {
      return transaction(pool, async (client) => {
        const user = await account(client, userId); if (!user?.email) return fail("actor_invalid");
        const invitation = (await client.query<any>(`SELECT * FROM public.organization_membership_invitations WHERE token_digest=$1 FOR UPDATE`, [digest(token)])).rows[0]; if (!invitation) return fail("invalid_invitation");
        const decision = evaluateInvitation({ expectedEmail: invitation.normalized_email, actualEmail: user.email, emailVerified: Boolean(user.email_verified_at), expiresAt: invitation.expires_at, now: now(), redeemedAt: invitation.redeemed_at, revokedAt: invitation.revoked_at });
        if (decision !== "ALLOW_MEMBER") return fail(decision.toLowerCase());
        const currentMembership=(await client.query<{organization_id:string}>(`SELECT organization_id FROM public.organization_memberships WHERE user_id=$1 AND status='active' LIMIT 1`,[userId])).rows[0];
        if(currentMembership)return fail(currentMembership.organization_id===invitation.organization_id?"membership_exists":"organization_membership_conflict");
        const membershipId = await insertBasicMembership(client, invitation.organization_id, userId, `membership-invitation:${invitation.invitation_id}`);
        const redeemedAt = now().toISOString(); await client.query(`UPDATE public.organization_membership_invitations SET redeemed_at=$2,redeemed_by_user_id=$3 WHERE invitation_id=$1 AND redeemed_at IS NULL AND revoked_at IS NULL`, [invitation.invitation_id, redeemedAt, userId]);
        await event(client, invitation.organization_id, userId, "MEMBERSHIP_INVITATION_REDEEMED", invitation.invitation_id, { membershipId, role: "member" });
        return ok({ organizationId: invitation.organization_id, membershipId, role: "member" as const });
      });
    },

    async decideMembership(userId: string, organizationId: string, requestId: string, decision: "APPROVED" | "REJECTED", reason: string) {
      if (!await hasCapability(pool, organizationId, userId, "MANAGE_MEMBERS")) return fail("authority_required");
      return transaction(pool, async (client) => {
        const request = (await client.query<any>(`SELECT * FROM public.organization_membership_requests WHERE request_id=$1 AND organization_id=$2 FOR UPDATE`, [requestId, organizationId])).rows[0];
        if (!request || request.status !== "PENDING") return fail("request_not_pending");
        const decidedAt = now().toISOString(); let membershipId: string | null = null;
        if (decision === "APPROVED") membershipId = await insertBasicMembership(client, organizationId, request.user_id, `approved-membership-request:${requestId}`);
        await client.query(`UPDATE public.organization_membership_requests SET status=$2,decided_at=$3,decided_by_user_id=$4,decision_reason=$5 WHERE request_id=$1`, [requestId, decision, decidedAt, userId, reason]);
        await event(client, organizationId, userId, `MEMBERSHIP_REQUEST_${decision}`, requestId, { membershipId, reason, role: decision === "APPROVED" ? "member" : null }); return ok({ requestId, decision, membershipId });
      });
    },

    async grantCapability(userId: string, organizationId: string, targetUserId: string, capability: OrganizationCapability, validUntil?: string) {
      if (!await hasCapability(pool, organizationId, userId, "MANAGE_MEMBERS")) return fail("authority_required");
      const actorMembership=await activeMembership(pool,organizationId,userId);
      if (["MANAGE_SIGNING_POLICY","GRANT_SIGNING_MANDATE"].includes(capability) && actorMembership?.role!=="owner") return fail("owner_authority_required");
      return transaction(pool, async (client) => {
        const target = await activeMembership(client, organizationId, targetUserId); if (!target) return fail("active_membership_required");
        const grantId = randomUUID(), grantedAt = now().toISOString();
        await client.query(`INSERT INTO public.organization_capability_grants(capability_grant_id,organization_id,membership_id,user_id,capability,granted_by_user_id,granted_at,valid_until,grant_fingerprint) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [grantId, organizationId, target.membership_id, targetUserId, capability, userId, grantedAt, validUntil ?? null, canonicalFingerprint("organization-capability-grant/v1", { grantId, organizationId, targetUserId, capability, userId, grantedAt, validUntil: validUntil ?? null })]);
        await event(client, organizationId, userId, "CAPABILITY_GRANTED", grantId, { targetUserId, capability, validUntil: validUntil ?? null }); return ok({ capabilityGrantId: grantId, capability });
      });
    },

    async grantMandate(userId: string, organizationId: string, input: any) {
      if (!await hasCapability(pool, organizationId, userId, "GRANT_SIGNING_MANDATE")) return fail("authority_required");
      return transaction(pool, async (client) => {
        const target = await activeMembership(client, organizationId, input.userId); if (!target) return fail("active_membership_required");
        let legacy = (await client.query<any>(`SELECT authority_id FROM public.mvp_contract_signing_authorities WHERE organization_id=$1 AND user_id=$2`, [organizationId, input.userId])).rows[0];
        const grantedAt = now().toISOString();
        if (!legacy) { const authorityId = randomUUID(); await client.query(`INSERT INTO public.mvp_contract_signing_authorities(authority_id,organization_id,user_id,membership_id,granted_by_user_id,granted_at,authority_fingerprint) VALUES($1,$2,$3,$4,$5,$6,$7)`, [authorityId, organizationId, input.userId, target.membership_id, userId, grantedAt, fingerprintSigningAuthority({ organizationId, userId: input.userId, membershipId: target.membership_id, grantedByUserId: userId, grantedAt })]); legacy = { authority_id: authorityId }; }
        const mandateId = randomUUID();
        await client.query(`INSERT INTO public.organization_signing_mandates(mandate_id,organization_id,membership_id,user_id,action_scope,contract_type_scope,commodity_scope,maximum_transaction_value,value_currency,signature_eligibility,valid_from,valid_until,granted_by_user_id,granted_at,grant_reason,mandate_fingerprint,legacy_authority_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`, [mandateId, organizationId, target.membership_id, input.userId, input.actionScope, input.contractTypeScope, input.commodityScope ?? null, input.maximumTransactionValue ?? null, input.valueCurrency ?? null, input.signatureEligibility, input.validFrom, input.validUntil ?? null, userId, grantedAt, input.reason, canonicalFingerprint("organization-signing-mandate/v1", { mandateId, organizationId, ...input, grantedByUserId: userId, grantedAt }), legacy.authority_id]);
        await event(client, organizationId, userId, "SIGNING_MANDATE_GRANTED", mandateId, { targetUserId: input.userId, actionScope: input.actionScope, contractTypeScope: input.contractTypeScope, signatureEligibility: input.signatureEligibility, validUntil: input.validUntil ?? null }); return ok({ mandateId });
      });
    },

    async revokeMandate(userId: string, organizationId: string, mandateId: string, reason: string) {
      if (!await hasCapability(pool, organizationId, userId, "GRANT_SIGNING_MANDATE")) return fail("authority_required");
      return transaction(pool, async (client) => {
        const mandate = (await client.query<any>(`SELECT mandate_id FROM public.organization_signing_mandates WHERE mandate_id=$1 AND organization_id=$2 FOR SHARE`, [mandateId, organizationId])).rows[0];
        if (!mandate) return fail("not_found");
        const existing = (await client.query(`SELECT 1 FROM public.organization_signing_mandate_revocations WHERE mandate_id=$1`, [mandateId])).rowCount;
        if (existing) return fail("mandate_revoked");
        const revocationId = randomUUID(), revokedAt = now().toISOString();
        await client.query(`INSERT INTO public.organization_signing_mandate_revocations(revocation_id,mandate_id,revoked_by_user_id,revoked_at,reason,revocation_fingerprint) VALUES($1,$2,$3,$4,$5,$6)`, [revocationId, mandateId, userId, revokedAt, reason, canonicalFingerprint("organization-signing-mandate-revocation/v1", { revocationId, mandateId, organizationId, userId, revokedAt, reason })]);
        await event(client, organizationId, userId, "SIGNING_MANDATE_REVOKED", mandateId, { revocationId, reason });
        return ok({ mandateId, status: "REVOKED" as const, revokedAt });
      });
    },

    async setSigningPolicy(userId: string, organizationId: string, input: any) {
      if (!await hasCapability(pool, organizationId, userId, "MANAGE_SIGNING_POLICY")) return fail("authority_required");
      return transaction(pool, async (client) => {
        await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`signing-policy:${organizationId}`]);
        const prior = (await client.query<any>(`SELECT signing_policy_id,policy_version FROM public.organization_signing_policies WHERE organization_id=$1 AND superseded_at IS NULL`, [organizationId])).rows[0]; const createdAt = now().toISOString();
        if (prior) await client.query(`UPDATE public.organization_signing_policies SET superseded_at=$2 WHERE signing_policy_id=$1`, [prior.signing_policy_id, createdAt]);
        const signingPolicyId = randomUUID(), policyVersion = (prior?.policy_version ?? 0) + 1;
        await client.query(`INSERT INTO public.organization_signing_policies(signing_policy_id,organization_id,policy_version,policy_kind,policy_payload,effective_from,created_by_user_id,created_at,policy_fingerprint) VALUES($1,$2,$3,$4,$5,$6,$7,$6,$8)`, [signingPolicyId, organizationId, policyVersion, input.policyKind, JSON.stringify(input.policyPayload), createdAt, userId, canonicalFingerprint("organization-signing-policy/v1", { signingPolicyId, organizationId, policyVersion, ...input, createdAt, userId })]);
        await event(client, organizationId, userId, "SIGNING_POLICY_ACTIVATED", signingPolicyId, { policyVersion, policyKind: input.policyKind }); return ok({ signingPolicyId, policyVersion });
      });
    },

    async actionCenter(userId: string) {
      const user = await account(pool, userId); if (!user) return fail("actor_invalid");
      const invitations = user.email ? (await pool.query<any>(`SELECT invitation_id,organization_id,expires_at,created_at FROM public.organization_membership_invitations WHERE normalized_email=$1 AND redeemed_at IS NULL AND revoked_at IS NULL AND expires_at>now()`, [user.email.toLowerCase()])).rows : [];
      const approvals = (await pool.query<any>(`SELECT request.request_id,request.organization_id,request.normalized_email,request.requested_at FROM public.organization_membership_requests request JOIN public.organization_memberships membership ON membership.organization_id=request.organization_id AND membership.user_id=$1 AND membership.role='owner' AND membership.status='active' WHERE request.status='PENDING'`, [userId])).rows;
      const signatureCandidates = (await pool.query<any>(`SELECT tx.contract_id,tx.current_state,tx.current_snapshot_id,snapshot.snapshot_payload,concat_ws(' ',creator.first_name,creator.last_name) prepared_by FROM public.mvp_contract_transactions tx JOIN public.mvp_contract_snapshots snapshot ON snapshot.snapshot_id=tx.current_snapshot_id JOIN public.users creator ON creator.id=snapshot.created_by_user_id JOIN public.organization_memberships membership ON membership.organization_id=CASE WHEN tx.current_state='AWAITING_SELLER_SIGNATURE' THEN tx.seller_organization_id WHEN tx.current_state='AWAITING_BUYER_SIGNATURE' THEN tx.buyer_organization_id END AND membership.user_id=$1 AND membership.status='active' WHERE tx.current_state IN ('AWAITING_SELLER_SIGNATURE','AWAITING_BUYER_SIGNATURE')`, [userId])).rows;
      const signatures:any[]=[];
      for(const candidate of signatureCandidates){
        const payload=candidate.snapshot_payload,organizationId=candidate.current_state==="AWAITING_SELLER_SIGNATURE"?payload.seller.organizationId:payload.buyer.organizationId;
        const policy=(await pool.query<any>(`SELECT policy_kind,policy_payload FROM public.organization_signing_policies WHERE organization_id=$1 AND superseded_at IS NULL`,[organizationId])).rows[0];
        if(policy?.policy_kind==="VALUE_BANDS"){
          const amount=Number(payload.price.estimatedTotal),matches=(Array.isArray(policy.policy_payload?.bands)?policy.policy_payload.bands:[]).filter((band:any)=>(band.minimumInclusive===undefined||amount>=Number(band.minimumInclusive))&&(band.maximumExclusive===undefined||amount<Number(band.maximumExclusive)));
          if(matches.length!==1||matches[0].signatureMode!=="INDIVIDUAL"||Number(matches[0].requiredSignatures)!==1)continue;
        }
        const mandateCount=Number((await pool.query<{count:string}>(`SELECT count(*)::text count FROM public.organization_signing_mandates WHERE organization_id=$1`,[organizationId])).rows[0]?.count??"0");
        const eligible=mandateCount===0
          ?(await pool.query(`SELECT 1 FROM public.mvp_contract_signing_authorities authority JOIN public.organization_memberships membership ON membership.membership_id=authority.membership_id WHERE authority.organization_id=$1 AND authority.user_id=$2 AND membership.status='active'`,[organizationId,userId])).rowCount===1
          :(await pool.query(`SELECT 1 FROM public.organization_signing_mandates mandate JOIN public.organization_memberships membership ON membership.membership_id=mandate.membership_id LEFT JOIN public.organization_signing_mandate_revocations revocation ON revocation.mandate_id=mandate.mandate_id WHERE mandate.organization_id=$1 AND mandate.user_id=$2 AND membership.status='active' AND revocation.revocation_id IS NULL AND mandate.valid_from<=now() AND (mandate.valid_until IS NULL OR mandate.valid_until>now()) AND (mandate.action_scope @> ARRAY['contract.sign']::text[] OR mandate.action_scope @> ARRAY['*']::text[]) AND (mandate.contract_type_scope @> ARRAY[$3]::text[] OR mandate.contract_type_scope @> ARRAY['*']::text[]) AND (mandate.commodity_scope IS NULL OR mandate.commodity_scope @> ARRAY[$4]::text[]) AND (mandate.maximum_transaction_value IS NULL OR (mandate.value_currency=$5 AND mandate.maximum_transaction_value >= $6::numeric)) AND mandate.signature_eligibility IN ('INDIVIDUAL','BOTH') LIMIT 1`,[organizationId,userId,payload.templateVersion,payload.commodity.name,payload.price.currency,payload.price.estimatedTotal])).rowCount===1;
        if(eligible)signatures.push({...candidate,organization_id:organizationId,mandate_eligibility:"ELIGIBLE"});
      }
      const domains = (await pool.query<any>(`SELECT domain_record.domain_id,domain_record.organization_id,domain_record.normalized_domain,domain_record.verification_method,domain_record.created_at FROM public.organization_verified_domains domain_record JOIN public.organization_memberships membership ON membership.organization_id=domain_record.organization_id AND membership.user_id=$1 AND membership.role='owner' AND membership.status='active' WHERE domain_record.status='PENDING'`, [userId])).rows;
      const items = [
        ...invitations.map((item: any) => ({ kind: "INVITATION_ACCEPTANCE", id: item.invitation_id, organizationId: item.organization_id, dueAt: item.expires_at, title: "Organization invitation", detail: "Review and accept an invitation bound to your verified email." })),
        ...approvals.map((item: any) => ({ kind: "MEMBERSHIP_APPROVAL", id: item.request_id, organizationId: item.organization_id, createdAt: item.requested_at, title: "Membership approval", detail: item.normalized_email })),
        ...signatures.map((item: any) => ({ kind: "CONTRACT_SIGNATURE", id: item.contract_id, organizationId: item.organization_id, title: "Contract signature required", contractReference: item.snapshot_payload.tutelaReference, counterparty: item.current_state === "AWAITING_SELLER_SIGNATURE" ? item.snapshot_payload.buyer.legalName : item.snapshot_payload.seller.legalName, commodity: item.snapshot_payload.commodity.name, value: item.snapshot_payload.price.estimatedTotal, currency: item.snapshot_payload.price.currency, delivery: `${item.snapshot_payload.delivery.incoterm} ${item.snapshot_payload.delivery.namedPlace}`, preparedBy:item.prepared_by, readiness: "READY", approvalStatus:"APPROVED_BY_BOTH_PARTIES",mandateEligibility:item.mandate_eligibility, action: "/contracts" })),
        ...domains.map((item: any) => ({ kind: "DOMAIN_VERIFICATION", id: item.domain_id, organizationId: item.organization_id, createdAt: item.created_at, title: "Domain verification pending", detail: `${item.normalized_domain} · ${item.verification_method}` })),
      ];
      return ok({ generatedAt: now().toISOString(), authorityNotice: "Tasks are work-queue projections and do not grant authority.", items });
    },

    async foundations(userId: string) {
      if (!await account(pool, userId)) return fail("actor_invalid");
      const [terms, schedules] = await Promise.all([
        pool.query<any>(`SELECT version_label,status,effective_at,acceptance_requirement,content_reference FROM public.platform_terms_versions WHERE status IN ('ACTIVE','PENDING_LEGAL_REVIEW') ORDER BY created_at DESC`),
        pool.query<any>(`SELECT fee_schedule_id,organization_id,plan_reference,schedule_version,fee_type,payer,calculation_basis,trigger_event,due_timing,tax_treatment,status,valid_from,valid_until FROM public.commercial_fee_schedules WHERE status='ACTIVE' ORDER BY valid_from DESC`),
      ]);
      return ok({ platformTerms: terms.rows, commercialFeeSchedules: schedules.rows, dataRightsCategories: ["COMPANY_DATA","TRANSACTION_DATA","UPLOADED_EVIDENCE","DERIVED_ANALYTICAL_DATA","PLATFORM_METADATA","AI_CANDIDATE_OUTPUTS"], notices: { saleContractParties: "Seller and Buyer only", tutelaRelationship: "Platform Terms and applicable Commercial Fee Schedule", paymentCollection: "NOT_ACTIVATED", blockchain: "NOT_ACTIVATED" } });
    },
  });
}
