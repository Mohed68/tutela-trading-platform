# Current System Baseline — Admin sequence

Status is evidence-based. “Planned” never means implemented or activated.

| Capability | Status | Repository evidence |
| --- | --- | --- |
| D4 Demo Pilot Ready | **IMPLEMENTED** | Demo sequence through `997b35f`; isolated simulation remains non-binding production authority. |
| A0 Admin Discovery & Security Audit | **AUDITED / CONFIRMED** | Findings captured by the A0.1 containment record and the A1.0 architectural constraints. |
| A0.1 critical legacy route containment | **IMPLEMENTED** | `f7bfec4`; unsafe legacy mutations contained. |
| A1.0 Admin Control Plane Blueprint | **APPROVED_ARCHITECTURE** | `e45b1c4`; authoritative locked Blueprint. |
| A1.1 Platform Authority Core | **IMPLEMENTED** | `23645af`; server-only authority contracts and policy. |
| A1.2a Privileged Session Assurance | **IMPLEMENTED** | Server-owned authentication, MFA, and recent-step-up assurance. |
| A1.2b Real TOTP MFA | **IMPLEMENTED** | `f9f589d`; encrypted TOTP credentials, replay protection, recovery codes, and bounded lockout. |
| A1.2c Privileged MFA Enforcement | **IMPLEMENTED** | `8c8f7e4`; central Admin action-assurance policy and session invalidation. |
| A1.3 Security Audit & Safe Data Plane | **IMPLEMENTED** | `84eb578`; atomic Security Audit and purpose-built safe Admin DTOs. |
| A1.4 Controlled Admin Activation | **IMPLEMENTED / PRODUCTION ACTIVE** | Durable ownership, encrypted MFA, recent step-up and secure Control Plane. |
| A1.5 Current operational baseline | **IMPLEMENTED** | Safe Organization/User and Current V2 Trade Operations projections plus active VRE workbenches. |
| A1.6–A1.7 future domains | **NOT ACTIVATED** | Documents, shipping, settlement and disputes remain future architecture. |

## A1.4 controlled activation update

Durable Platform Ownership, locked first-owner bootstrap, normal succession, and the final-owner invariant are implemented by migration 0020. No Owner is auto-created and legacy or Organization roles supply no ownership authority. MFA enrollment and the minimal secure Control Plane are the activation boundary; broader operations remain outside this baseline.
