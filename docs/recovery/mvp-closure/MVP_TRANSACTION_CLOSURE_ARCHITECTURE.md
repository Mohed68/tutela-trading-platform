# MVP Transaction Closure Architecture

## Scope and authority freeze

This release closes one bounded Current-V2 physical commodity transaction without introducing V3 Deal or Trade Intent concepts.

| Fact | Canonical authority | Never authority |
| --- | --- | --- |
| accepted commercial source | accepted Order snapshot and fingerprints | browser form, PDF |
| contract terms | immutable `mvp_contract_snapshots` version | rendered document |
| readiness | server policy `mvp-contract-readiness/v1` | UI percentage |
| contract generation | deterministic rendering of the current snapshot | free-form client content |
| terms approval | bilateral exact-snapshot approvals | Admin |
| signature | authenticated active member with explicit signing grant, recent step-up, consent, exact version/snapshot/document hash | frontend flag, general membership, Admin |
| executed contract | both signatures plus immutable executed artifact/hash | one signature or preview |
| execution evidence | append-only asserted metadata/reference | proof of truth |
| settlement | Seller-authorized confirmation after delivery; recording only | payment movement or bank truth |
| closeout | state policy after executed, delivery, settlement and no dispute | destructive archive |

The authority chain is `accepted Order → versioned snapshot → readiness → bilateral approval → preview hash → governed signatures → executed artifact → execution events`. A PDF is always a projection of domain authority and never creates authority by itself.

## Lifecycle

The persisted states are `CONTRACT_PREPARATION → AWAITING_SELLER_SIGNATURE → AWAITING_BUYER_SIGNATURE → EXECUTED → EXECUTION_STARTED → DOCUMENTS_SUBMITTED → DELIVERY_CONFIRMED → SETTLEMENT_CONFIRMED → TRADE_CLOSED`, with `DISPUTED` as a blocking exceptional state. `CONTRACT_READY` and approvals are immutable events; readiness is also stored with the snapshot. Invalid transitions fail closed. Executed/closed projections and all event, signature, artifact, evidence and dispute rows are database-guarded against mutation/deletion.

Before execution, saving material terms creates a new snapshot/version and therefore invalidates prior approvals/signature eligibility. After execution, terms are not editable. Formal amendments are deferred.

## Authorization and isolation

Every read/mutation resolves the authenticated user against the canonical Contract parties and an active Organization Membership. User and Organization identity are derived on the server. Signing additionally requires a narrow Organization signing-authority grant created by an active owner under recent step-up. Seller signs first; Buyer signs the same version second. Admin has inspection-only safe projections and cannot sign, approve terms, confirm delivery or confirm settlement for a party.

`FOR UPDATE` locks serialize contract transitions and signatures. Seller acceptance locks the Offer and compares accepted allocation plus the candidate quantity with authoritative availability. Duplicate signature, execution-start and closeout commands are idempotent; stale versions, snapshots and preview hashes are rejected.

## Persistence and migration

Migration `0024_mvp_transaction_closure` is additive. It introduces signing authorities, transaction projections, immutable snapshots, approvals, artifacts, signatures, events, evidence and disputes, plus mutation guards. It neither rewrites historical Orders/Contracts nor synthesizes signatures or closed trades. Forward-only rollback means disabling new routes while preserving history; dropping executed evidence is prohibited.

## External legal/trade references

- [ICC Incoterms® 2020 rules](https://library.iccwbo.org/content/tfb/BOOKS/BK_0049/BK_0049.htm)
- [ICC Incoterms Q&A: title is separate; state rule, place and version](https://library.iccwbo.org/clp/clp-incoterms-qa-2020.htm?AGENT=ICC_HQ)
- [ICC Arbitration Rules](https://iccwbo.org/dispute-resolution/dispute-resolution-services/arbitration/rules-procedure/2021-arbitration-rules/) and [standard clause guidance](https://2go.iccwbo.org/explore-our-products/standard-icc-arbitration-clause-in-english.html)
- [ICC Force Majeure and Hardship Clauses](https://iccwbo.org/news-publications/icc-rules-guidelines/icc-force-majeure-and-hardship-clauses/)
- [UNCITRAL CISG](https://uncitral.un.org/en/texts/salegoods/conventions/sale_of_goods/cisg)
- [Saudi Electronic Transactions Law](https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/6f509360-2c39-4358-ae2a-a9a700f2ed16/1)

TUTELA uses original wording, records consent/identity/authority/time/integrity, and does not claim an ICC model contract or qualified PKI signature. Jurisdiction-, sanctions-, tax-, commodity- and enforceability-specific counsel review remains required before broader rollout.

