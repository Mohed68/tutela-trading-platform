# Admin recovery documentation index

This directory is the reading map for the TUTELA Admin Control Plane recovery
and controlled implementation sequence.

## Authority order

1. [Phase A1.0 Admin Control Plane Blueprint](phase-a1-0-admin-control-plane-blueprint.md)
   — approved and locked Admin product/architecture authority.
2. [Phase A1.1 Platform Authority Core](phase-a1-1-platform-authority-core.md)
   — implemented but dormant authority-core contract.
3. [Current System Baseline](current-system-baseline.md) — concise status; it
   never promotes planning to implementation.
4. [Admin Decision Register](admin-decision-register.md) — concise evolution
   record pointing back to the Blueprint.

The Organization Verification, Trust, Activity Eligibility, Participation
Eligibility, Offer Verification, and Publication Eligibility architecture
documents remain canonical for their own domains. Admin documentation does not
supersede or manufacture those authorities.

## Core terms

- **Admin Control Plane:** governed operational and platform-administration
  surface defined by A1.0, not a generic superuser dashboard.
- **Platform Owner:** highest governed platform authority, represented in the
  future by ownership assignment rather than a role or boolean.
- **Platform Principal:** server-resolved platform identity referencing a real
  authenticated User.
- **Platform Role:** named bundle of typed Platform Permissions.
- **Permission:** atomic server-side capability checked before a command.
- **Privileged Command:** explicit, reasoned, scoped, audited mutation request.
- **Break-Glass:** exceptional Platform Owner emergency command path requiring
  recent assurance and high-severity audit.
- **Admin Read Model:** permission-specific safe DTO, never a raw entity join.
- **Security Audit Event:** separate, append-only evidence for privileged action.
