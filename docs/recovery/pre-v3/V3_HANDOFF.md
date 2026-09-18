# V3 Authoritative Handoff

## Start here

Begin the next conversation at **V3-0 Architecture Freeze**. Do not infer V3 implementation from roadmap text. Read this file, then `CURRENT_SYSTEM_BASELINE.md`, `WORKFLOW_ATLAS.md`, `STATE_MACHINE_CATALOG.md`, `DECISION_REGISTER.md`, `RISK_ASSUMPTION_REGISTER.md`, `PRE_V3_SYSTEM_ACCEPTANCE_REPORT.md`, and the existing VRE Policy V2 decision.

## Release identity and infrastructure

- Starting Pre-V3 production HEAD: `6ae0d39672afe9c96ca78edf39b056cec026af31`.
- Final release HEAD: the Git commit containing this handoff, synchronized to `origin/architecture/phase-7a-organization-trust` and the production checkout; use `git rev-parse HEAD` as the exact immutable identifier.
- Production: AWS Lightsail `TUTELA-PRODUCTION-01`, `ubuntu@3.127.250.220`.
- Checkout/service: `/home/ubuntu/tutela-trading-platform`, `tutela.service`.
- Current database migration point: `0023_pre_v3_closure`.
- Test authority: isolated `TEST_DATABASE_URL`; production data is never fixture data.

## Frozen authorities

Identity/session, Platform Principal/Role/Ownership, Organization Registry/Membership, Evidence, Policy V2 Verification engine, Replay, Trust derivation, Participation Eligibility, offer verification, Publication Eligibility and Current V2 trading-flow fingerprints are authoritative. UI/localStorage/demo/legacy KYB flags are not.

Policy V2 is prospective. Organization self-attestation is Evidence only. Approval requires an independent authorized human reviewer or an independently confirmed trusted provider only where an explicit future policy permits it. Reviewers produce Review Artifacts; only the engine produces Verification, and only the deriver produces Trust. V1 history is preserved until a legitimate re-evaluation trigger.

Enforcement is separate from Verification/Trust. The explicit latest USER/ORGANIZATION action is consumed by current offer create/edit/submit, order create/accept and Contract create commands. It never rewrites prior facts.

## Current production capability

The supported commercial flow is SELL offer only:

Organization trusted/eligible → draft → version-bound evidence metadata → submitted frozen revision → offer verification → publication eligibility → Marketplace → buyer Order → seller acceptance → immutable Current V2 Contract draft.

Password recovery, TOTP MFA/replay prevention, recent privileged step-up, Platform Owner, Security Audit, VRE operations, safe Admin Organizations/Users and Current V2 Trade Operations are current capabilities.

## V3 architecture-change decisions still open

- Trade Intent model, including legitimate BUY semantics;
- Deal aggregate and negotiation ownership;
- Terms Lock and concurrency/version contract;
- inventory reservation/netting and availability authority;
- Contract signing/binding and conditions precedent;
- protected document/evidence repository and disclosure policy;
- payment/settlement, shipping/fulfilment and claims/disputes;
- independent automated provider trust policy and provider lifecycle;
- any dual-control expansion for ownership or critical enforcement.

These are architecture decisions, not gaps to patch into V2. Preserve all frozen authority chains and append-only history while designing them.

## MVP closure baseline added before V3

V3 must migrate rather than overwrite the bounded `mvp_contract_*` history introduced by migration `0024`. Current V2 now owns immutable terms snapshots, readiness, signing grants, bilateral exact-version signatures, executed artifact integrity and lightweight evidence/delivery/settlement/closeout. V3 still owns generic Trade Intent/Deal/negotiation, reservation/netting, amendments, protected document storage, provider verification, financial settlement orchestration, logistics and full claims/disputes. Preserve executed contract hashes and event provenance during any future aggregate migration.
