# Pre-V3 Decision Register

| Decision | Durable outcome |
| --- | --- |
| Verification policy | Policy V2 is prospective. Independent human review or explicitly permitted independently confirmed source is required for approval. Self-attestation is Evidence only. |
| Historical truth | V1 decisions, Trust snapshots, Orders and Contracts are never rewritten due to V2 or Enforcement. |
| Browser authority | Removed. Server identity, Organization context and capability reads are authoritative. |
| BUY behavior | New Current V2 BUY drafts and publication are disabled; V3 Trade Intent is not inferred. |
| Evidence UX | Structured assertions/references are supported. The product does not claim a protected file repository. |
| Enforcement | Explicit latest USER/ORGANIZATION action is consumed at six legitimate V2 command boundaries, including an in-transaction recheck under the decision subject lock. |
| Password recovery | Non-enumerating request, canonical-email delivery, digest-only expiring token, cooldown, one-time consumption, all-session revocation and MFA preservation. |
| Contract semantics | Immutable Current V2 draft derived from the accepted Order snapshot; no simulated blockchain/payment state. |
| Future routes | Hidden from normal navigation or explicitly marked NOT YET ACTIVATED. |
