# Admin Decision Register

This register records decisions without duplicating the authoritative
[Phase A1.0 Blueprint](phase-a1-0-admin-control-plane-blueprint.md).

| Decision | Outcome |
| --- | --- |
| Legacy Admin foundation | Rejected as the future foundation; legacy access remains isolated. |
| Evolution strategy | Selective safe reuse plus a new Admin Authority Foundation. |
| Control model | Platform Owner has full governed operational control but cannot fabricate canonical domain truth. |
| Architecture shape | Modular Control Plane with standard module contracts. |
| Permanent domains | Risk, Enforcement, Trade Deals, Documents, Shipping, Settlement, and Claims remain first-class expandable domains. |
| Mutation model | Privileged mutations use explicit commands, scoped authorization, reasons, and atomic security-audit evidence. |
| Platform Owner representation | Future durable Platform Ownership Assignment attached to a Platform Principal; not a Platform Role or boolean. |
| Ownership succession | Maintain at least one active owner; grant new, confirm active, then optionally revoke old. The final active owner cannot be revoked. |
| Ownership assurance | Ownership changes require current owner authority, recent MFA, explicit reason, and high-severity audit. |
| Emergency recovery | Controlled server-side recovery/bootstrap only; no normal HTTP self-service or self-promotion. |
| Canonical authority | Platform Owner and Platform Admin cannot directly create Verification, Trust, Activity/Participation/Publication Eligibility, or Offer verification truth. |
| A1.1 adoption | Conformant design adopted with target-role policy, ownership-governance extension point, session-assurance context, and strengthened negative tests. |

Future dual control may be added to ownership changes and recovery when multiple
active owners exist. Persistence, bootstrap, MFA runtime, routes, and frontend
activation remain outside A1.1.
