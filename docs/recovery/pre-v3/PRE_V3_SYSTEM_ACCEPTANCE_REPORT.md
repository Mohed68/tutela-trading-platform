# Pre-V3 System Acceptance Report

## Release identity

- Starting/audited production HEAD: `6ae0d39672afe9c96ca78edf39b056cec026af31`
- Release branch: `architecture/phase-7a-organization-trust`
- Final deployed HEAD: the Git commit containing this acceptance package and reported in the deployment record/final delivery response.
- Database migration point: `0023_pre_v3_closure`
- Production target: AWS Lightsail `TUTELA-PRODUCTION-01`, `/home/ubuntu/tutela-trading-platform`, `tutela.service`.

## Acceptance matrix

| Capability | Evidence and result |
| --- | --- |
| Identity lifecycle | Real TEST database registration, one-time email activation, password authentication and session/Auth regression suites. Unauthorized access remains denied. |
| Password recovery | Non-enumerating request; canonical-email delivery; 60-minute digest-only token; 60-second account-serialized cooldown; strong password; single consumption; all sessions revoked; MFA credential bit-for-bit preserved; append-only security event. |
| MFA/step-up | Grouped 3+3 six-digit accessible input across enrollment/challenge/privileged step-up. Server verification, replay prevention, bounded time policy and safe failure text retained. |
| Browser authority | Route decisions use server identity/Organization/Admin authority. Legacy session helpers fail closed. Demo storage cannot produce production authority. |
| Organization | Registry profile and owner Membership are canonical. Ambiguous active Organization contexts fail closed. |
| Verification Policy V2 | Self-attestation produced review state, never approval/trust. Independent member/submitter review was rejected. Independent Review Artifact, canonical re-evaluation, Replay and Trust produced `trusted`. V1 history remains unchanged. |
| Participation | Runtime bindings and current Trust/Membership inputs produced eligibility. Missing/untrusted state failed closed. |
| Offer | SELL draft create/edit, version-bound evidence metadata, frozen submission, real verification engine and coordinator were executed. Editing the submitted revision failed. New BUY is disabled. |
| Publication/Marketplace | The real publication policy returned the approved SELL offer. Unpublished/unverified offers failed ordering. No frontend flag publishes an offer. |
| Order | Buyer identity/Organization, participation, enforcement, seller publication, current fingerprint, expiry and decimal quantity checks executed. Unauthorized buyer and invalid quantity were denied. |
| Seller acceptance | Wrong seller, stale/expired offer and repeated acceptance fail. Correct current seller succeeds after authority rechecks. |
| Contract | A participant created one immutable draft from the accepted Order snapshot. Non-participant and duplicate creation failed. Reads rebuild terms from the Order snapshot and validate fingerprints. |
| Enforcement | Actual append-only cases/decisions tested NORMAL, MONITORED, explicit RESTRICTED, SUSPENDED, BLOCKED and TERMINATED for ORGANIZATION plus BLOCKED/NORMAL for USER. Historical Order/Contract and Verification/Trust remained readable and unchanged. |
| Admin | Safe Users/Organizations projections and Current V2 Offers/Orders/Contracts projection are `ACTIVE_BASELINE`. VRE commands retain permissions, MFA/recent-step-up and atomic Security Audit. |
| Legacy/future containment | Legacy offer creation and KYB authority routes return 410 where appropriate. Future negotiation/payment/logistics/partner/analytics routes are hidden or marked NOT YET ACTIVATED. Production demo/simulation controls are not mounted. |

## Deterministic TEST_DATABASE simulation

Five isolated actors were used: seller owner, buyer owner, independent reviewer, authorized Admin and unauthorized ordinary user. The scenario executes production application services and SQL against `TEST_DATABASE_URL`. A surrounding transaction/savepoint adapter rolls fixtures back; it does not fabricate decisions, eligibility, fingerprints or engine results.

Happy path: register/verify both owners → create Organizations/Memberships → evidence → self-verification review state → independent Review Artifact → Policy V2 decision/Replay/Trust/participation → SELL draft/edit/evidence/submit/frozen revision → real offer engine/coordinator → marketplace publication → buyer Order → seller acceptance → immutable Contract draft.

Negative coverage includes self-review, unauthorized evidence, untrusted participation, unpublished offer, wrong buyer Organization actor, invalid quantity, wrong seller, repeated/stale/expired acceptance, non-participant/duplicate Contract, matching and nonmatching RESTRICTED actions, MONITORED allow, SUSPENDED/BLOCKED/TERMINATED deny, USER/ORGANIZATION scoping, read/history retention and Enforcement non-interference with Trust.

## Migration and data safety

Migration 0023 is additive and formally reviewed in [MIGRATION_0023_REVIEW.md](MIGRATION_0023_REVIEW.md). The TEST migration was applied and re-verified before production. The production procedure requires a fresh `pg_dump` before migration, protected row-count comparison, migration checksum/journal validation, and no fixtures or business writes.

## Release gates

The acceptance run comprises Auth/MFA integration and frontend tests; Organization Registry/Membership; Policy V2/Trust/Participation; offer verification/publication; trading flow; VRE/Admin/Security Audit; the full TEST_DATABASE journey; password recovery integration; `npm run check`; and `npm run build`. Exact pass output and deployed commit are retained in the release task/final delivery response.

## Known limitations intentionally deferred

- no V3 Trade Intent, Deal, Terms Lock or negotiation;
- no inventory reservation/netting across Orders;
- no Contract signing/binding, conditions precedent, payment, settlement, shipping or disputes;
- no protected binary evidence/document repository;
- no automated independent provider policy beyond the current explicit human review path;
- no new BUY workflow; historical BUY facts remain readable;
- no broad analytics/partner domain activation.

## Verdict

Acceptance is granted only after all listed gates, push, one production deployment, backup/migration and post-deploy smoke checks pass. The final delivery response records that operational verdict.

## MVP transaction-closure addendum

The bounded pre-V3 baseline now includes server-authoritative Contract Terms Snapshots/readiness, Urea 46% profile, bilateral terms approval, Organization signing grants, seller-then-buyer governed signatures, immutable preview/executed PDFs and a lightweight evidence/delivery/settlement/closeout lifecycle. See `../mvp-closure/`. This supersedes the earlier limitation that no Contract signing or execution existed; protected binary evidence storage, money movement and advanced fulfilment/claims remain excluded.
