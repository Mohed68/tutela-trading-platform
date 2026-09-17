# Current System Baseline — Pre-V3 closure

Status: release acceptance candidate. Starting production commit: `6ae0d39672afe9c96ca78edf39b056cec026af31`.

The Current V2 authority chain is:

`Identity → Organization Registry/Membership → submitted Evidence → Policy V2 independent Review Artifact → Verification Decision Engine → Replay → Trust Status Deriver → Participation Eligibility → Offer Verification → Publication Eligibility → Order → accepted Order → immutable Contract draft`.

The browser projects these authorities but does not create them. Local storage, demo flags, legacy KYB fields and role strings cannot produce Verification, Trust, Eligibility, publication or Admin authority. Production demo controls are disabled unless the process is explicitly non-production and `ENABLE_DEMO_RUNTIME=true`; client demo behavior additionally requires a development build and `VITE_ENABLE_DEMO_RUNTIME=true`.

## Active Current V2 capabilities

| Area | Release status | Canonical owner |
| --- | --- | --- |
| Local registration, email verification, login/session/logout | Active | Authentication storage and server session |
| Password recovery | Active | One-time digest-only token, canonical email, session revocation |
| TOTP MFA and recent privileged step-up | Active | Encrypted credential, server clock/counter and replay prevention |
| Organization Registry and Membership | Active | Append-only profile revisions and membership versions |
| Organization Verification Policy V2 | Active | Canonical engine/replay; independent confirmation required |
| Trust and Participation Eligibility | Active | Trust derivation and participation runtime binding |
| SELL offer draft/evidence/submission/verification | Active | Frozen revision and offer verification engine |
| Marketplace publication | Active | Publication Eligibility, not lifecycle/UI flags alone |
| Order, seller acceptance, Contract draft | Active | Current V2 trading-flow service and immutable fingerprints |
| Admin Organizations/Users and Trade Operations | Active baseline | Purpose-built safe read projections |
| Verification/Risk/Enforcement | Active baseline | Explicit commands, atomic audit and append-only history |
| Enforcement command consumption | Active | Matching USER/ORGANIZATION command guard |

Payment, settlement, logistics, negotiation, partner operations, signing and V3 Trade Intent/Deal/Terms Lock are not activated.
