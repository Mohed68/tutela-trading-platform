---
name: tutela-engineering
description: Use for engineering work in the TUTELA repository, including architecture changes, migrations, authority-sensitive workflows, production deployment, release acceptance, Contract Engine, Organization/Membership/Signing, VRE, AI governance, Commodity Registry, and V3 work. Do not use for unrelated repositories.
---

# TUTELA Engineering Skill

Use this skill for any repository-changing TUTELA engineering task.

## 1. Start from the accepted baseline, not from a fresh audit

When a task supplies an accepted baseline HEAD and states that no outside changes occurred:

1. Run only the **Baseline Integrity Preflight**:
   - `git status`
   - verify current HEAD equals the supplied baseline
   - verify expected branch
   - verify local/remote parity
   - verify clean worktree
   - verify expected latest migration is journaled
   - verify referenced canonical docs exist
2. If all checks pass, proceed directly to the delta.
3. Do **not** re-audit the entire repository, recount the tree, rediscover closed architecture, or rerun broad discovery work merely because a new delta started.
4. Inspect only dependencies touched by the requested delta.
5. If baseline drift exists, stop with `BASELINE_DRIFT` and report the exact mismatch.

A full repo/business/architecture audit is reserved for:
- explicit audit tasks,
- unexpected drift,
- major merge/history changes,
- production incident investigation,
- or V3-0 Architecture Freeze.

## 2. Load the minimum references required

Always read:
- `references/TUTELA_AUTHORITY_INVARIANTS.md`
- `references/TUTELA_AGENT_OPERATING_CONTRACT.md`

Read only when relevant:
- migration/deploy work → `references/TUTELA_PRODUCTION_AND_MIGRATION_PROTOCOL.md`
- final reporting/release closeout → `references/TUTELA_REPORTING_CONTRACT.md`
- architecture/document hierarchy questions → `references/TUTELA_CANONICAL_CONTEXT.md`

If the task names a delta specification under `docs/agent/`, treat that file as the task-specific scope. Do not expand into later deltas unless needed to preserve an invariant.

## 3. Engineering mode

Operate autonomously after scope is clear.

Ordinary implementation decisions are not stop conditions:
- file/module placement
- safe refactors
- test fixes
- UI implementation details
- additive schema design
- bounded dependency changes
- safe compatibility shims
- documentation synchronization

Prefer:
- additive, reversible changes
- existing canonical services over parallel authority
- server authority over frontend convenience
- immutable facts over editable history
- explicit reason codes over silent fallback
- deterministic policy over AI assertions

## 4. Authority-sensitive changes

Before changing any authority-sensitive workflow, identify:
- authority owner
- source facts/evidence
- policy
- canonical mutation point
- audit record
- read model / UI projection

Never let a read model, frontend state, AI result, external provider, or legacy convenience field become canonical authority by accident.

## 5. AI work

AI may extract, normalize, compare, explain, rank candidates, or prepare workflows.

AI may not directly create:
- Verification
- Trust
- Eligibility
- Enforcement
- customs truth
- contract acceptance
- signatures
- membership
- signing authority
- fee entitlement
- executed-history mutation

Malformed/unavailable AI must fail safely and must not fabricate success.

## 6. Testing

Add tests for:
- new positive path
- authority denial
- cross-tenant/cross-organization isolation
- stale/replay/concurrency behavior when relevant
- regression of existing governed workflows

Run targeted tests during implementation.

Before release, run all suites required by the delta plus:
- `npm run check`
- `npm run build`

Do not use Production DB for destructive or synthetic testing.

## 7. Documentation

Durable decisions must be written into canonical repository documentation in the same review cycle.

Do not leave new authority semantics only in code, comments, or chat.

## 8. Production

Only deploy when the task explicitly includes Production completion and all release prerequisites pass.

Follow the production/migration reference. Never:
- force-push
- rewrite Git history
- force-reset Production to hide divergence
- seed fake business records into Production
- partially deploy one coupled release

## 9. Completion

Return the standard TUTELA report defined in the reporting reference.

State clearly whether the requested delta is:
- COMPLETE
- PARTIAL
- BLOCKED

State readiness for the specifically named next phase. Do not declare a later phase ready merely because the current build passed.
