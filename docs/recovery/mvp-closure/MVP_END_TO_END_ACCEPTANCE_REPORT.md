# MVP End-to-End Acceptance Report

## Release identity

- Starting production HEAD: `009aeac6a8c1bfd7132383073a892c9a533dbc9c`
- Branch: `architecture/phase-7a-organization-trust`
- Migration: `0024_mvp_transaction_closure`
- Final commit/deployment evidence: recorded in the final release report after synchronization.

## Accepted rehearsal

The isolated TEST_DATABASE journey performs real registration/email activation, Organization creation, Policy V2 independent review, Verification/Replay/Trust/Participation, Urea 46 Offer evidence/submission/verification/publication, Buyer Order, serialized Seller acceptance, Contract creation, incomplete and complete readiness, bilateral exact-snapshot approval, signing-authority grant, recent-step-up-bound Seller and Buyer signatures, executed PDF/hash, execution start, document and settlement evidence metadata, Buyer delivery confirmation, Seller settlement confirmation and immutable `TRADE_CLOSED`. The surrounding transaction rolls back fixtures.

Negative checks cover unrelated actors, missing terms, CFR named place, mismatched currency, self-review, untrusted participation, invalid quantity, oversell boundary, duplicate/stale actions, wrong signer/party sequence, missing assurance/authority, executed edit, artifact hash, unauthorized delivery/settlement, dispute closeout block, immutable history and Enforcement restrictions.

The dedicated real-concurrency test uses two independent PostgreSQL clients. Two 70-unit acceptances race against a 100-unit Offer: exactly one commits and accepted quantity remains 70. Two concurrent Buyer second-signature attempts produce exactly one `EXECUTED` transition/event; the contender resolves idempotently, leaving exactly Seller+Buyer signatures.

## Backup restore proof

The production custom-format backup was restored—not merely catalogued—into a disposable PostgreSQL 17 cluster on `127.0.0.1:55439` outside the production database. Restore succeeded with migration journal 24, users 15, offers 11, orders 2, contracts 2 and zero orphan Contract→Order links. The backup was captured before the prior `0023` production migration, so its latest successful journal entry is correctly `0022_vre_baseline`. The disposable server was stopped and its cluster, copied dump and helper removed; `tutela.service` remained active. A fresh pre-0024 production backup is still mandatory at deployment.

## Operational acceptance conditions

Acceptance requires all focused and existing regression suites, `npm run check`, `npm run build`, an isolated restore drill, logical commits/push, exactly one production deployment, migration checksum/count validation, service/health smoke and local/origin/AWS cleanliness. Production receives no fixture Organization, signature, evidence or closed trade.

## Controlled-pilot boundary

The release is suitable only for a controlled pilot using counsel-approved configured terms and operational review. TUTELA is not a bank, escrow, payment institution, trade-finance provider, carrier, inspection authority or evidence truth oracle. The exact measured completion score and outstanding V3-only capabilities are reported after final gates.
