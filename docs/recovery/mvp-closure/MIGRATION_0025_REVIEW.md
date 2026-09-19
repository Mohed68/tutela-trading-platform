# Migration 0025 Review

Migration `0025_contract_engine_v1_1` is additive in authority and non-destructive to business rows. It replaces the V1-only snapshot form check with an allow-list containing both V1 and V1.1. Historical snapshots, fingerprints, approvals, signatures, artifacts and events are not updated.

The runner requires an explicit TEST or Production target, verifies predecessor 0024, uses the migration advisory lock and journal checksum, compares snapshot/V1 counts before and after, and verifies the resulting constraint admits both versions. A Production backup is required immediately before execution.

Rollback for an unused V1.1 deployment is to restore the V1-only check after proving no V1.1 row exists. Once a V1.1 snapshot exists, rollback must preserve that history and therefore requires a follow-up compatibility migration rather than deletion or rewriting.
