# Delta A Organization Authority Decision

Status: implemented prospectively by migration `0026_delta_a_organization_authority`.

## Durable authority separations

TUTELA preserves these independent concepts:

- a verified email is an identity attribute, not Organization membership;
- a verified Organization domain is governed evidence, not ownership, capability or signing authority;
- membership is not an operational capability;
- operational capability is not a signing mandate;
- a Signing Mandate determines what a person may sign;
- a Signing Policy determines what signatures a transaction requires;
- an Action Center item is a work-queue projection, not authority;
- Seller and Buyer remain the only parties to the Commodity Sale Contract;
- Platform Terms and a Commercial Fee Schedule govern the separate Organization/User relationship with TUTELA;
- an external integrity anchor may evidence hash publication only and is not legal, delivery, title, settlement, conformity, customs or contract-validity truth;
- AI output remains a non-authoritative candidate and cannot perform any authority mutation.

## Organization resolution and membership

After verified email, the server extracts a normalized domain and resolves Organization candidates from verified domains, legal identity, jurisdiction and registration identifiers. Outcomes are explicit (`MATCHED`, `POSSIBLE_MATCH`, `NO_MATCH`, `MULTIPLE_MATCHES`, `CLAIM_REQUIRED`, `MEMBERSHIP_EXISTS`, `MEMBERSHIP_PENDING`). Candidate or fuzzy matches never create membership.

Duplicate creation is blocked when an existing Organization has the same legal name and jurisdiction or a matching registration identifier. A new Organization creator receives Owner only for that newly created Organization under the existing registration transaction.

The default membership policy is explicit compatibility behavior: `APPROVAL_REQUIRED`. `VERIFIED_DOMAIN_AUTO_JOIN` creates only an ordinary `member` and only when the account email is verified, its normalized domain is governed `VERIFIED`, the policy is active and no conflict/risk condition blocks the flow. Domain requests start `PENDING`; engineering does not manufacture verification.

Invitations bind an exact normalized email, expire, store only a token digest, are one-time/replay-safe, and create basic Member only. Invitation tokens are accepted in request bodies and must never be logged.

## Capability, mandate and policy

Capabilities are explicit Organization-scoped grants. Sensitive capability and mandate mutations require recent MFA step-up. Existing active Owners retain established Organization governance authority, but Owner, job title and email domain are never treated as a signing mandate.

Signing Mandates bind Organization, active membership, user, actions, contract types, optional commodities, optional maximum value/currency, validity interval and individual/joint eligibility. Revocation is a separate immutable record. If an Organization has any Delta A mandates, signing requires an applicable live mandate. Organizations without Delta A mandates retain their explicit historical `mvp_contract_signing_authorities` under the named `COMPATIBILITY_SINGLE` policy.

Value-band and joint-signature policy shapes are versioned. The V1 signature ledger contains one immutable slot per party. A configured joint requirement therefore fails closed with `signing_policy_unsatisfied`; it cannot be reduced to one signature or bypassed. Activation of a multi-slot ledger requires a separate future bounded migration.

## Platform and commercial rights

The schema provides versioned Platform Terms, acceptance records, Commercial Fee Schedules, Fee Entitlements and relationship provenance. It seeds no legal text, active terms, fee schedule, percentage, fixed amount, protection duration, remedy or jurisdiction. `ACTIVE` records require an explicit approved authority reference. Fee entitlement requires an active governed schedule and a unique governed trigger; no payment, wallet, escrow or collection authority exists.

Contract snapshots have nullable structural references to an applicable Platform Terms version and Commercial Fee Schedule. Existing history is not backfilled. A null reference makes no legal or fee claim, and these references do not make TUTELA a sale-contract party.

Data-rights categories are recorded conceptually as Company Data, Transaction Data, Uploaded Evidence, Derived/Analytical Data, Platform Metadata and AI Candidate Outputs. This classification does not weaken privacy or confidentiality and does not claim TUTELA ownership of the parties' executed agreement.

## Historical truth and deployment

Migration 0026 is additive. It does not backfill or reinterpret memberships, verification decisions, trust snapshots, signing authorities, snapshots, signatures or commercial terms. Deployment must use the migration journal, verify predecessor 0025, preserve business-row counts and deploy code only after the production migration succeeds.
