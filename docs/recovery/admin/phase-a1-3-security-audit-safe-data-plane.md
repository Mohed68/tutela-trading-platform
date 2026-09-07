# Phase A1.3 — Security Audit and Safe Admin Data Plane

Platform principals and role assignments now have additive, independent persistence. Migration 0019 deliberately creates no principal, role, owner, or bootstrap grant and does not translate legacy `users.adminRole`.

Sensitive Platform role mutations use one database transaction for assignment state and the independent security audit event. The audit binds actor principal, roles, permission, assurance, action, target, before/after, reason, request/correlation identity, request metadata, severity, and time. Audit failure rolls the authority mutation back.

Admin reads use explicit allow-list DTOs. Password hashes, MFA secrets/ciphertext, recovery hashes, provider/session internals, legacy platform flags, raw joined users, and unrestricted KYB records are excluded. Sensitive audit/verification queue reads are recorded. Unsafe legacy KYB decision, offer moderation, and account toggle mutations remain isolated and return `410` until each is connected to an authoritative application service and atomic audit boundary.
