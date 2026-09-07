# Phase A1.2c — Privileged MFA Enforcement

Privileged Admin authorization is now composed centrally from an authenticated user, an authentic Platform Authority resolution, the required Platform Permission, and server-owned Session Assurance. Legacy `users.adminRole`, `users.is2FAEnabled`, and browser state are not authority.

The action policy requires authenticated assurance for ordinary queue/support reads, MFA for sensitive evidence/audit/moderation access, and recent step-up for role administration, verification decisions, catalog mutation, and account remediation.

MFA revocation requires recent step-up, revokes the active encrypted credential, and invalidates every server session for the user. The same bounded invalidation port is the integration point for later credential and role security events. Platform Owner bootstrap and persistence remain deliberately absent.
