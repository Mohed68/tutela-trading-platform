# Phase A1.0 — Admin Control Plane Blueprint

## Status and purpose

**TUTELA ADMIN CONTROL PLANE** is TUTELA's operational and governance control plane. It is not a generic superuser dashboard and it is not a back door to domain truth. This blueprint is the architectural contract for the Admin phases that follow it. It defines durable module boundaries, authority rules, and activation criteria; it does not activate an Admin capability.

Platform administrators may carry out legitimate operational commands, but may not bypass a domain authority or fabricate canonical truth. For example, an authorized administrator may change permitted Organization profile data, manage a business contact, restrict trading, revoke sessions, manage platform staff, moderate marketplace content, request re-verification, invalidate evidence through its legitimate authority, or open an enforcement case. An administrator may not directly set Trust, Eligibility, or canonical Verified state; fabricate Evidence; or silently rewrite historical transactions.

This document is documentation only. It introduces no RBAC implementation, migration, production behavior, Admin activation, deployment, or bootstrap.

## Existing architectural findings that constrain this blueprint

This contract incorporates the following prior findings as binding:

- **A0.1 Critical legacy route containment:** browser state, including `localStorage`, is presentation-only and cannot be authority. Retired legacy routes cannot be restored as an Admin shortcut. The old Admin route is visually spoofable, `/admin/companies` has a HIGH / FIX BEFORE USE raw DTO, and `is2FAEnabled` is not proof of session-level MFA satisfaction.
- **Canonical Organization Verification:** verification is `Evidence → Review Artifact/Application Service → Policy/Decision → Replay → Trust`. Decision, Replay, and Trust are domain-owned evidence and derived state, not administrative flags.
- **Trust and Eligibility separation:** Organization Trust, Activity Eligibility, Organization Participation Eligibility, Offer Verification, and Offer Publication Eligibility are distinct authorities. In particular, Publication Eligibility is derived from Participation Eligibility, Offer Lifecycle, and Offer Verification; it is not an Admin-editable field.
- **A1.1 Platform Authority Core:** the dormant typed Platform Principal, active role-assignment, permission-resolution, reason, correlation, and atomic-audit contracts are the intended starting point for implementation. `users.adminRole`, organization memberships, client claims, and local storage do not create new Platform authority.

## Platform Owner

**Platform Owner** is the highest platform authority concept. It has full legitimate operational control, authority to grant or revoke Platform Admin, platform configuration access, Security & Audit access, and Break-Glass authority. It remains bound by canonical domain invariants, MFA/session assurance, mandatory reasons for sensitive actions, audit evidence, and the ban on silent historical rewriting.

The A1.1 representation recommendation is a dedicated, non-role **Platform Principal ownership assignment**: a durable ownership relation attached to a Platform Principal, with an explicit active-owner invariant. It is cleaner than a special Platform Role because roles remain revocable permission bundles, and cleaner than an unconstrained boolean attribute because ownership can carry provenance, lifecycle, assurance, and audit rules. It should grant a defined owner policy bundle through the same authorization resolver, without making permission checks depend on a scattered special case.

The future persistence model must prevent revocation, suspension, or removal of the final active Platform Owner in the same transaction that changes ownership. Bootstrap, successor nomination, recovery, and quorum policy remain an implementation decision for A1.1/A1.2 and require auditable provenance.

## Permanent module map and maturity

Every item below is a first-class v1 architecture domain, whether or not the underlying business capability is active.

| Module | Baseline maturity and truthful presentation |
| --- | --- |
| Overview | `ACTIVE_BASELINE`: permission-filtered operational summaries only. |
| Organizations & Users | `ACTIVE_BASELINE`: safe visibility and future controlled organization, user, membership, and authority operations. |
| Verification | `DEFINED`: canonical verification queue/read models and legitimate review commands when activated. |
| Risk | `DEFINED`: risk signals and assessments, not enforcement. |
| Enforcement | `DEFINED`: evidence- and decision-based cases and restrictions. |
| Trade Operations — Marketplace, Offers, RFQs, Trade Deals, Orders, Contracts | Existing Offer/Order/Contract visibility is an `ACTIVE_BASELINE`; RFQs and Trade Deals remain `DEFINED`. |
| Documents | `DEFINED`: shared cross-domain document read/authority contract. |
| Shipping & Fulfilment | `DEFINED`: shipment-event baseline, later provider-integrated fulfilment. |
| Settlement & Finance | `DEFINED`: external settlement state, later bank/escrow/provider integration. |
| Claims & Disputes | `DEFINED`: case baseline, later commercial dispute workflow. |
| Support | `DEFINED`: account support and controlled remediation. |
| Platform Administration — Staff, Roles, Permissions, Commodity Catalog, Policies, Platform Configuration | Roles/permissions are `ACTIVE_BASELINE` only as dormant A1.1 contracts; all UI and operational activation is deferred. |
| Security & Audit | `DEFINED`: privileged-session and separate security-audit data plane. |

The only maturity states are:

- `DEFINED`: module identity, boundary, and future contract exist; the UI must say it is unavailable or omit it from ordinary navigation.
- `ACTIVE_BASELINE`: a limited, permission-scoped capability exists and the UI represents only that capability.
- `FULL`: the promised domain workflow and integrations are operational.

No navigation, overview count, action, or label may imply `FULL` functionality for a `DEFINED` or `ACTIVE_BASELINE` module.

## Standard module contract

Each Admin module must register module identity, permissions namespace, navigation, routes, commands, queries, safe DTO/read models, domain/Admin events, audit policy, and maturity state. A module may register only its truthful maturity. This registry is the extension seam for future product domains and prevents a monolithic `server/routes.ts` or giant `AdminDashboard`.

Routes are adapters, not authority. Commands are application boundaries; queries use explicit safe read models. A module's event registration may project domain events but may never make a UI event authoritative.

## Authority and permission model

`Authenticated User → Platform Principal → active Role Assignment → atomic Permissions → Scope/Context Policy → Command Authorization`

The following are non-negotiable:

- Authenticated User is not a Platform Principal.
- Organization Role is not a Platform Role.
- Platform Role is not a Permission.
- Frontend visibility is not backend authority.
- Permission resolution is deny-by-default and server-side; malformed or unsupported authority fails closed.

Base Platform roles are permission bundles, not identities or wildcards: `PLATFORM_ADMIN`, `VERIFICATION_REVIEWER`, `OPERATIONS`, and `SUPPORT`. Platform Owner is a separate concept. Permissions remain atomic, typed, and named by domain capability. Context policy must be designed to later constrain an otherwise valid permission by region, jurisdiction, commodity, case type, and risk tier without redesigning RBAC. Scope checks are evaluated with the command's target/context, never inferred from a screen or client-supplied role.

## Full-control model: authorized commands, never database editing

Full operational control means access to authorized, validated application commands. It does not mean unrestricted SQL or raw-entity editing.

| Area | Future command capabilities |
| --- | --- |
| Organizations | View safe data; edit permitted legal/display profile fields; manage business/additional/primary contacts; issue status and trading restrictions; initiate re-verification; view membership and authority context. |
| Users | Account support, session revocation, credential remediation, and association review. |
| Platform | Staff, role/permission assignment, commodity catalog, configuration, operational policies, and owner-governed administration. |
| Trade | Marketplace/Offer moderation, operational exceptions, and case handling. |

Representative commands are `ChangeOrganizationContact`, `SuspendOrganization`, `RestrictOrganizationTrading`, `RevokeUserSessions`, `GrantPlatformRole`, `RevokePlatformRole`, `ModerateOffer`, `RequestReverification`, `InvalidateEvidence`, `OpenEnforcementCase`, and `ResolveOperationalException`.

Every privileged state-changing command must carry and enforce: actor principal, resolved permission, resource and scope, mandatory reason when the policy requires it, session/MFA requirement, audit policy, emitted domain or Admin event, and typed result. The command handler must validate domain preconditions, bind the audit record atomically with the mutation, and return a safe result rather than a raw persistence entity.

## Organization and verification boundaries

Organizations & Users is a first-class Admin domain. Future controlled editing may include legal/display profile fields, business contact email, additional contacts, primary contact, status, trading restrictions, re-verification, and membership/authority visibility.

The following are distinct facts and must never be silently rewritten together:

- login email;
- business contact email;
- corporate-domain affiliation;
- authorized representative; and
- verified legal relationship.

Verification operations remain canonical: `Evidence → Review Artifact → Application Service → Policy/Decision → Replay → Trust`. The UI must not offer “Mark Trusted”, “Force Verified”, or “Set Eligibility” actions. Evidence invalidation, replacement requests, or re-verification must be legitimate domain commands that preserve evidence and decision history.

## Risk, enforcement, and operational exceptions

Risk is a separate assessment domain for organization, transaction, jurisdiction, commodity, document, anomaly, and provider-alert signals. `Risk Signal ≠ Enforcement Action`: a signal can inform review but cannot itself restrict an account or fabricate a decision.

Enforcement is a distinct, case/evidence/decision/audit-based domain. Its future state vocabulary accommodates `NORMAL`, `MONITORED`, `RESTRICTED`, `SUSPENDED`, `BLOCKED`, and `TERMINATED`, across `USER`, `ORGANIZATION`, `RELATIONSHIP`, `TRADE_ACTIVITY`, `TRANSACTION`, and `PLATFORM_WIDE` scopes. Operational exceptions are explicit cases with a bounded scope, authority, expiry or review policy, and audit trail; they cannot erase prior truth.

## Trade, Documents, Shipping, Settlement, and Claims contracts

Trade Operations permanently separates Marketplace, Offers, RFQs, Trade Deals, Orders, and Contracts. The present baseline exposes only existing safe Offer/Order/Contract capabilities. Trade Deals may evolve independently through `RFQ → Proposal → Negotiation → Agreed Terms → Transaction → Contract` without restructuring Admin.

Documents is a shared first-class domain for verification, offers, trade deals, inspection, shipping, settlement, and claims. Its future contract covers provenance, linked entities, assurance, discrepancies, legitimate invalidation, replacement requests, and lifecycle; it does not introduce document-management functionality now.

Shipping owns fulfilment events and provider integration. Settlement owns payment, trade-finance, and external settlement state. Claims owns commercial exceptions, disputes, and cases. Provider-specific connectors remain outside core authority logic and submit evidence/events through bounded adapters.

## Break-Glass

Break-Glass is a Platform Owner emergency capability, not a routine privilege. It may authorize tightly scoped commands such as `EmergencySuspendOrganization`, `EmergencyRevokeSessions`, and `EmergencyRestrictTrading`. Each use requires recent step-up MFA, an explicit reason, the precise affected scope, a high-severity Security Audit record, and follow-up review/remediation case when appropriate. It cannot delete history, create domain truth, or bypass immutable evidence/decision rules.

## Read models, realtime, security, and audit

Admin queries return purpose-built, permission-scoped safe DTOs/read models, for example `VerificationCaseSummary`, never raw joined User, Organization, or Evidence entities. A read model exposes only fields required by its permission and use case; highly sensitive evidence may require both an additional permission and recent step-up assurance.

The target realtime topology is:

`Domain transaction → Domain Event / Transactional Outbox → Admin read model or event stream → SSE → Admin UI`

Admin commands use HTTPS. SSE is the initial one-way notification/state-change transport; WebSockets are deferred until bidirectional collaboration requires them. Realtime messages are never authority: canonical database/domain state is authoritative and must be rechecked by every command.

Privileged session assurance has three distinct concepts: normal authenticated session, MFA-assured session, and recent step-up session. Owner changes, role grants/revocations, sensitive evidence access, Break-Glass, and security configuration require policy-appropriate stronger/recent assurance.

Every privileged mutation creates separate Security/Admin Audit evidence, distinct from normal business activity logging. The target record includes actor principal; resolved role/permissions; session assurance; action; target; before and after values subject to sensitive-data policy; reason; timestamp; request ID; correlation ID; IP; and user agent. Audit evidence must be append-only, access-controlled, and atomically bound to its command mutation.

## Delivery roadmap and open design question

1. **A1.0** — Admin Product & Architecture Contract (this blueprint).
2. **A1.1** — Platform Authority Core.
3. **A1.2** — Privileged Session Security / MFA / Step-up.
4. **A1.3** — Security Audit + Safe DTO / Admin Data Plane.
5. **A1.4** — Realtime Foundation: event/outbox contract and SSE.
6. **A1.5** — Modular Admin Shell: navigation, permission-aware modules, overview.
7. **A1.6** — Platform Administration: Platform Owner, staff, roles, permissions, configuration.
8. **A1.7** — Organizations, Operations & Support Baseline.
9. Then activate Verification, Risk, and Enforcement (VRE), followed progressively by Trade Deals, Documents, Shipping, Settlement, and Claims.

**Unresolved architecture question:** before persistence and bootstrap are implemented, the owner must approve the exact Platform Owner succession and emergency recovery governance (for example, whether a two-owner quorum or an externally controlled recovery procedure is required). This blueprint recommends the ownership-assignment model but intentionally does not choose its operational governance or bootstrap authority.

## A1.0 validation statement

This blueprint is consistent with A0/A0.1 containment and the canonical Organization Verification, Trust, and Eligibility boundaries described above. It deliberately adds no code path, schema, migration, route, UI activation, production mutation, deployment, or external change.
