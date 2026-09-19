# TUTELA Agent Operating Contract

## Objective pattern

Every task should be treated as:

**Objective + Invariants + True Stop Conditions + Reporting Contract**

Do not turn ordinary implementation choices into user checkpoints.

## Baseline handling

If an accepted HEAD is supplied and the user states no outside changes occurred:

Use Baseline Integrity Preflight only.

Do not repeat:
- full tree audit
- line/file counts
- full architecture rediscovery
- repeated security archaeology
- broad production inventory

unless drift is detected or the delta depends on an unknown area.

Perform targeted dependency inspection for the modules the delta actually touches.

## Closed decisions

Do not reopen a closed product/architecture decision unless:
1. current repository state contradicts it,
2. a new production fact contradicts it,
3. implementation exposes an unresolvable canonical conflict, or
4. the task explicitly asks to reconsider it.

## True stop conditions

Stop only for:
- unavoidable missing credential/secret or unavailable external infrastructure,
- destructive/irreversible data risk,
- inability to preserve current Production history,
- unresolved contradiction between canonical authority rules,
- legal/product choice that materially changes TUTELA's role into a regulated or materially different service,
- an explicit user approval gate required by higher-level product/legal policy.

Do not stop for ordinary:
- refactors
- schema naming
- test failures you can fix
- UI layout decisions
- implementation sequencing
- safe migration rehearsal
- dependency updates that can be validated

## Scope discipline

Finish the named delta completely.

Do not expand into the next roadmap phase merely because adjacent architecture is visible.

Bounded enabling hooks are acceptable when they avoid future rework and do not activate deferred functionality.

## Security

For dangerous authority mutations:
- verify actor authority
- require recent step-up when appropriate
- audit immutable mutation facts
- prevent cross-tenant leakage
- test replay/stale states
- fail closed

Never log:
- credentials
- invitation secrets
- document contents
- private prompts
- secret provider payloads
- sensitive verification evidence

## UX

User-facing UX should explain:
- what happened
- what is required
- who is authorized
- why an action is blocked
- what happens next

Avoid developer-state-machine jargon in normal business UI.

## Release discipline

Implementation is not complete until:
- tests pass
- check/build pass
- migration is safely rehearsed if present
- docs are synchronized
- Production is deployed/verified when requested
- final report is returned
