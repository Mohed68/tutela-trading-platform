# Progressive Evidence-Based Trade Trust Architecture

## Version 1

Status: authoritative architecture amendment for Phase 8F.0D

Scope: contracts, boundaries, and conformance only

Runtime behavior: unchanged

## Canonical trust stack

```text
Organization
  → Organization Verification
  → Trust
  → Activity Eligibility
  → Participation Eligibility
  → Offer
  → Offer Evidence Verification
  → Publication Eligibility
  → Marketplace
  → Order
  → Contract
```

Each arrow is an integration boundary, not an authority transfer. No upstream
fact automatically manufactures a downstream decision.

## Authority questions

| Boundary | Question it owns | What it does not own |
|---|---|---|
| Organization Registry | Which legal Organization/profile revision exists? | Verification, Trust, or permission |
| Organization Verification | Does an immutable revision satisfy the recorded identity, legal-existence, and representative-association evidence policies? | Activity matching or action permission |
| Trust Status | Is the latest applicable Organization Verification decision currently trusted? | Activity or platform-action eligibility |
| Activity Eligibility | Is the Organization appropriately associated with a stated activity and optional commodity/jurisdiction context? | Trust, membership, Offer evidence, or publication |
| Participation Eligibility | May this member of this Organization perform a specified protected action? | Organization Verification, Trust, or publication |
| Offer Evidence Verification | Are the submitted Offer evidence and facts credible, internally consistent, and bound to the evaluated Offer revision? | Physical-goods guarantees or publication |
| Publication Eligibility | May this specific Offer enter the Marketplace now? | Upstream decisions or Order authority |
| Order authority | May the eligible buyer create and the authoritative seller accept this Order? | Contract or settlement |
| Contract authority | May an accepted Order produce this immutable commercial Contract binding? | Payment, escrow, blockchain, or settlement |

The existing Participation and Publication Eligibility rules remain unchanged
in Version 1. Activity Eligibility is now a separate approved boundary and
future composition input; it is not silently inferred or injected into an
existing result.

## Activity Eligibility boundary

Activity Eligibility consumes an explicit Organization ID, activity code,
context version, optional commodity classification, optional jurisdiction,
policy version, and evidence references. It owns only these outcomes:

- `eligible` — the recorded activity context matched under the exact policy;
- `ineligible` — the recorded activity context did not match;
- `requires_review` — deterministic automation cannot safely conclude.

Missing commodity context is representable. It never implies a match. Initial
architecture requires no sophisticated commodity regulation catalog and adds
no regulation rules. Future catalogs may be introduced behind the Activity
Eligibility policy port without changing Trust or Participation Eligibility.

## Evidence Provider Port

Evidence providers are upstream evidence acquisition boundaries. The generic
port supports these provider kinds without integrating any external service:

- `platform_submitted`;
- `kyb` (future KYB provider adapter);
- `inspection` (future inspection provider adapter);
- `shipping` (future shipping-evidence adapter);
- `warehouse` (future warehouse-evidence adapter).

Every successful provider resolution yields a neutral, immutable Evidence
Envelope containing subject/version binding, assertions, assurance level,
timestamp, provenance, integrity reference, and fingerprint. It contains no
Decision, Trust, Eligibility, or publication authority.

The immutable direction is:

```text
Provider Evidence → TUTELA Policy → Decision / Trust / Eligibility
```

The following direction is forbidden:

```text
Provider outcome → automatic TUTELA approval
```

Provider adapters cannot import or invoke Organization Verification Decision,
Trust Status, Activity Eligibility, Participation Eligibility, Publication
Eligibility, Order, or Contract authorities.

## No-external-provider operating path

`createLocalPlatformEvidenceProvider(...)` adapts evidence already submitted
through TUTELA. It assigns only `documentary` assurance. It does not claim that
the source confirmed the evidence and does not inspect goods. This path keeps
the architecture operable without a third-party KYB dependency.

No Sumsub, Kyckr, SGS, Bureau Veritas, Intertek, AML, PEP, sanctions, AI, or
transaction-verification integration is introduced or required.

## Offer Evidence Verification semantics

Offer Evidence Verification evaluates:

- evidence credibility;
- evidence consistency;
- evidence-to-Offer-revision subject binding.

It explicitly does not guarantee:

- physical existence of goods;
- ownership of goods;
- continued availability;
- successful delivery.

No `goods_guaranteed` state exists or is persisted. Publication means that the
current Publication Eligibility policy accepted the authoritative upstream
facts; it is not a warranty of performance or inventory.

## Progressive evidence assurance

The Evidence Envelope supports these ordered descriptive levels:

1. `documentary` — evidence submitted as a document or assertion;
2. `source_confirmed` — a future authoritative source confirmed the referenced
   fact;
3. `independently_inspected` — a future independent inspection produced the
   evidence.

These levels describe provenance assurance; they do not make decisions. The
current Publication Eligibility policy does not require all levels and is not
modified by this amendment.

Future, explicitly approved risk-based policies may require stronger assurance
for a particular activity context, commodity, jurisdiction, transaction value,
or lifecycle stage. Such policies must consume Evidence Envelopes and retain
exact policy versions. They may not mutate provider evidence or reuse an
assurance level as an automatic approval.

## Change-control boundaries

This amendment makes no changes to:

- Organization Verification decisions, workflow, persistence, or Replay;
- Trust ownership, vocabulary, or derivation;
- current Participation Eligibility rules;
- current Offer Verification rules or decisions;
- current Publication Eligibility rules;
- Marketplace filtering;
- Order or Contract authority;
- registration or deployment behavior.

Any future runtime composition that makes Activity Eligibility mandatory for a
protected action requires explicit business-policy approval and its own tests.
