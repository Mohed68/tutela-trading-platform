# Migration 0023 Formal Review

Migration: `migrations/0023_pre_v3_closure.sql`
Predecessor: migration 0022
Classification: additive, no business-data rewrite.

The migration adds digest-only password reset tokens, append-only account security events and explicit Enforcement action restrictions. It broadens the existing Enforcement integration-status constraint only to add `ACTIVE_V2_COMMAND_GUARD`; historical `INACTIVE` actions remain valid and unmodified. Restriction rows and account security events use the existing immutable-history trigger function.

Safety findings:

- no destructive table operation, business seeding or inferred legacy authority;
- foreign keys bind tokens/events/actions to canonical records;
- token digests are unique lowercase SHA-256 values and plaintext is never stored;
- restriction action names are a closed Current V2 vocabulary;
- the runner requires the exact predecessor, obtains an advisory lock, records checksum/history and validates protected row counts;
- rehearsed first on `TEST_DATABASE_URL`; production requires an immediate database backup before execution.

Verdict: approved for the single Pre-V3 production deployment after all release gates pass.
