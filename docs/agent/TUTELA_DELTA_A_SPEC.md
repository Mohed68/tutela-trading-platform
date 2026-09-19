# TUTELA Delta A Specification
## Organization Identity, Membership & Signing UX
## + Platform Rights & Commercial Protection

### Accepted starting Production baseline
`96f7dca22b7b01a238dfdf9464ca71f9838d844c`

Expected latest migration at task start:
`0025_contract_engine_v1_1`

Accepted starting state:
- Contract Engine V1.1 complete
- Production contract presentation accepted
- governed Intelligence Foundation complete
- Production deployed and clean
- Controlled Real Production Pilot technically ready
- no external repository changes are expected after the accepted V1.1 report

Use **Baseline Integrity Preflight only**. Do not repeat the previous full repository audit unless drift is detected.

---

# A. Objective

Close the remaining organization-level UX/authority gap before the Commodity & Trade Reference Registry phase.

Build:
1. organization discovery/resolution and membership UX,
2. scoped signing mandates and signing-policy routing,
3. user-specific Action Center,
4. TUTELA Platform Terms / commercial-rights technical foundation,
5. blockchain-ready integrity-anchor extension point.

This is a delta. Preserve existing Contract V1.1 and Intelligence Foundation unless bounded integration changes are required.

---

# B. Registration and Organization Resolution

Keep initial registration simple:
- first name
- last name
- business email
- password

After verified email:
`Verify Email → Extract Domain → Organization Resolution → Join / Claim / Create → Membership Resolution`

Create a server-authoritative Organization Resolution capability with explicit outcomes such as:
- MATCHED
- POSSIBLE_MATCH
- NO_MATCH
- MULTIPLE_MATCHES
- CLAIM_REQUIRED
- MEMBERSHIP_EXISTS
- MEMBERSHIP_PENDING

Resolution may use:
- verified normalized email domain
- existing organization records
- verified organization domains
- legal name
- jurisdiction
- registration identifiers
- aliases/trading names where already supported

A fuzzy/candidate match cannot silently create membership or ownership.

Prevent obvious duplicate organization creation.

Do not make a user Owner merely because they typed a company name.

---

# C. Verified Organization Domains

Add a governed Verified Domain model capable of storing:
- organization
- normalized domain
- status
- verification method
- verification provenance
- verifiedAt / validFrom
- revokedAt
- reason
- audit/fingerprint where appropriate

Statuses:
- UNVERIFIED
- PENDING
- VERIFIED
- REVOKED

Support architecture for safe verification methods such as:
- DNS challenge
- controlled email challenge
- authorized internal review
- independent provider/source

Do not fake DNS/provider confirmation.

If real external verification cannot be activated safely now, implement the authority model and pending/manual workflow without manufacturing VERIFIED.

---

# D. Join / Claim / Create

If one authoritative organization match exists, show a business-friendly confirmation:
- organization legal/display name
- jurisdiction
- appropriate verified/trust indication
- `Join this organization`
- `This is not my company`

If only a possible match exists, label it as candidate and use governed resolution.

If no match exists:
- Search organization
- Register new organization

Do not force an existing-company employee to recreate company legal data.

---

# E. Membership Policy and Invitations

Add Organization Membership Policy with at least:
- APPROVAL_REQUIRED
- VERIFIED_DOMAIN_AUTO_JOIN

`VERIFIED_DOMAIN_AUTO_JOIN` may create only basic MEMBER when:
- email is verified
- domain is VERIFIED for the organization
- organization policy allows auto-join
- no conflict/risk state blocks it

Never auto-grant sensitive authority.

Add governed invitation flow:
- authorized inviter only
- exact email binding
- expiry
- one-time/replay-safe redemption
- organization binding
- duplicate-membership safety
- no token leakage in logs

---

# F. Organization Workspace

Add a production-grade Organization area, using existing UI conventions.

Suggested sections:
- Overview
- Company Profile
- Verification
- Team
- Roles & Permissions
- Signing Authority
- Signing Policy
- Verified Domains
- Audit Activity

The interface should be understandable to normal B2B users and should not look like a developer/admin debug panel.

Show the current organization clearly in the application shell/header.

Do not imply multi-organization switching unless safely supported; design so it can be added later.

---

# G. Team, Roles and Capabilities

Strengthen organization-level capabilities without using Platform Admin authority.

Keep distinct:
- membership
- operational role
- capability
- signing mandate

Where consistent with current workflows, support capabilities such as:
- CREATE_OFFER
- MANAGE_OFFERS
- PREPARE_CONTRACT
- APPROVE_COMMERCIAL_TERMS
- MANAGE_MEMBERS
- MANAGE_SIGNING_POLICY
- GRANT_SIGNING_MANDATE

Reuse existing canonical services/capabilities when equivalents already exist. Do not build a parallel authority system.

---

# H. Signing Mandates

Evolve current binary signing authority additively into scoped Signing Mandates.

Preserve historical authority records.

A mandate should be able to express:
- organization
- user
- active membership binding
- action/contract type scope
- commodity scope where configured
- maximum transaction value
- currency/value semantics
- validFrom / validUntil
- individual/joint-signature eligibility
- grantor / grantedAt
- revokedAt / reason
- status
- immutable/auditable fingerprint

A title such as CEO is never sufficient by itself.

Signing still requires existing governed gates such as:
- active membership
- correct contract party/organization
- exact snapshot/version/hash
- explicit consent
- recent MFA step-up
- applicable security/VRE gates

---

# I. Signing Policy and Routing

Separate:
- Signing Mandate = what a person may sign
- Signing Policy = what signatures a transaction requires

Support configurable policy shapes that can represent value bands and joint-signature requirements.

Do not hard-code example thresholds as TUTELA business truth.

If no advanced policy is configured, preserve safe existing behavior through an explicit compatibility/default policy.

Target:
`Content Ready + Party Approvals + Signing Policy + Active Mandates → Required Signature Slots → Eligible Signers → Signature Tasks`

If no signer satisfies policy, fail closed with a clear reason.

If a mandate expires/revokes or membership becomes inactive:
- immediately make signer ineligible
- re-evaluate policy
- re-route pending task if another valid signer exists
- otherwise block safely
- do not mutate contract terms/snapshot merely because routing changed

---

# J. Signature UX and Action Center

Transaction operator:
- sees readiness and approval status
- sees that authorized signature is required
- sees assigned/required signer state
- does not see a misleading Sign action when ineligible

Authorized signer:
- sees a focused action task
- contract reference
- counterparty
- commodity
- value
- delivery
- prepared by
- readiness/approval status
- own mandate eligibility
- Review Contract
- Sign
- Return for Revision

Signer must not edit contract terms directly.

Changed terms create a new governed contract snapshot/version and invalidate prior approval/signature state as required.

Create user-specific Action Center for:
- contract signature tasks
- membership approvals
- invitation acceptance
- domain verification actions
- returned-for-revision contract
- organization authority tasks

Tasks are projections/work queues, not authority.

---

# K. TUTELA Platform Rights & Commercial Protection

Do not convert the Seller-Buyer sale contract into a three-party sale agreement.

Keep:
- Seller ↔ Buyer = Commodity Sale Contract
- Organization/User ↔ TUTELA = Platform Terms + Commercial Fee Schedule

## Platform Terms foundation

Create versioned Platform Terms authority structure:
- version
- effective date
- status
- acceptance requirement
- acceptance actor
- organization/user binding
- accepted version
- timestamp
- audit record

Statuses at minimum:
- DRAFT
- PENDING_LEGAL_REVIEW
- ACTIVE
- SUPERSEDED
- WITHDRAWN

Engineering must not mark substantive new legal text ACTIVE without approved legal/product authority.

## Commercial Fee Schedule

Create versioned plan/schedule structure capable of:
- organization/plan
- fee type
- payer
- calculation basis
- percentage or fixed amount
- currency where relevant
- trigger
- due timing
- tax/VAT treatment
- effective dates
- status/version
- provenance

Extensible fee types may include:
- SUBSCRIPTION
- TRANSACTION_FEE
- SERVICE_FEE
- LOGISTICS_SERVICE
- INSPECTION_SERVICE
- FINANCE_REFERRAL

Do not invent current commercial rates.

## Fee Entitlement

Create a governed Fee Entitlement concept that records why a fee became due:
- organization
- related transaction/service
- fee schedule version
- triggering event
- deterministic calculation inputs
- amount if deterministically available
- tax handling
- status
- timestamp
- provenance

Do not implement fund movement, wallet, escrow, or payment collection.

## Sale Contract link

Add only a restrained structural/reference link from the Sale Contract to applicable Platform Terms/Fee Schedule where appropriate.

If wording is not legally approved:
- implement version/reference structure
- mark wording pending legal/product approval
- do not claim legal approval

Do not degrade Contract V1.1 presentation.

## Anti-circumvention foundation

Build technical provenance needed for later legal protection:
- TUTELA introduction/match/facilitation provenance
- protected relationship reference
- applicable fee schedule
- protection period fields
- related transactions
- affiliate/related-party placeholders only where safely modeled

Do not invent final legal enforcement terms, durations, damages, remedies or jurisdiction language.

## IP and data-rights foundation

Preserve TUTELA rights in platform/template/engine technology while not claiming ownership of the parties' executed agreement.

Support conceptual data categories:
- Company Data
- Transaction Data
- Uploaded Evidence
- Derived/Analytical Data
- Platform Metadata
- AI Candidate Outputs

Do not weaken privacy/confidentiality.

---

# L. Blockchain-ready Integrity Extension

Add only a bounded future extension point.

Do not:
- activate blockchain
- publish data
- add user-facing blockchain marketing
- add a dependency unless genuinely required

Model future external integrity anchors such as:
- anchorType
- network
- networkId
- transactionReference
- anchoredHash
- anchorTimestamp
- anchorVersion
- confirmationStatus

Potential future anchored material:
- opaque contract reference
- snapshot hash
- executed artifact hash
- execution timestamp
- anchor version
- optional Merkle/event root

Never treat blockchain anchoring as legal truth, title, settlement, delivery, goods existence, conformity, customs truth, or contract validity by itself.

---

# M. AI in Delta A

The existing Intelligence Foundation may assist with:
- organization-match candidates
- duplicate candidates
- exception explanations
- user guidance

AI cannot:
- create membership
- verify domain by assertion
- grant role/capability/mandate
- satisfy signing policy
- create fee entitlement
- activate Platform Terms
- create anti-circumvention legal truth

Do not expand this delta into Commodity Intelligence or the Commodity Registry.

---

# N. Delta-specific negative tests

At minimum prove:
- verified email alone cannot create membership
- domain match alone cannot grant Owner or Signatory
- revoked domain cannot auto-join
- unauthorized invitation fails
- wrong-email / expired / replayed invitation fails
- ordinary member cannot grant sensitive capability or mandate
- inactive membership cannot sign
- expired/revoked/out-of-scope mandate cannot sign
- joint-signature requirement cannot be bypassed
- routing cannot bypass server authority
- stale contract snapshot cannot sign
- returned-for-revision state cannot retain invalid approvals
- tenant/cross-organization isolation holds
- Platform Terms cannot silently activate
- Fee Schedule mutation is authority-gated
- Fee Entitlement cannot exist without governed trigger
- blockchain anchor cannot claim confirmation without real receipt
- AI candidate cannot create organization/signing/fee authority

---

# O. Deferred / out of scope

Do not implement:
- Commodity & Trade Reference Registry
- New Product Intake
- Smart Offer Engine
- full V3 Deal Workspace
- payment/escrow
- blockchain activation
- final anti-circumvention legal enforcement language
- unrestricted public launch

---

# P. Completion statuses

Final report must explicitly state:

- ORGANIZATION IDENTITY & MEMBERSHIP UX: COMPLETE / NOT COMPLETE
- SIGNING MANDATE & ROUTING: COMPLETE / NOT COMPLETE
- ACTION CENTER: COMPLETE / NOT COMPLETE
- PLATFORM RIGHTS FOUNDATION: COMPLETE / NOT COMPLETE
- COMMERCIAL FEE ARCHITECTURE: COMPLETE / NOT COMPLETE
- BLOCKCHAIN INTEGRITY EXTENSION: COMPLETE / NOT COMPLETE
- READY / NOT READY TO START COMMODITY & TRADE REFERENCE REGISTRY
- READY / NOT READY FOR CONTROLLED REAL PRODUCTION PILOT
