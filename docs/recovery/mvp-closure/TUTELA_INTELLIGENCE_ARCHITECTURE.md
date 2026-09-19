# TUTELA Intelligence Architecture

Principle: **Autonomous by Default - Human by Exception**, within the invariant **AI != Authority**.

## Foundation

The orchestration layer supports task-specific schemas for document extraction, commodity identification, specification extraction, classification assistance, contract consistency and exception explanation. Provider/model configuration, task and prompt versions, source provenance, confidence, token metadata and outcome telemetry are explicit. Observability records metadata only and never prompt/document contents, credentials or secrets.

Malformed output and provider failure fail closed as `MALFORMED_OUTPUT` or `AI_UNAVAILABLE`. No hidden fallback manufactures validation, market facts, credit ratings or successful recommendations.

## Authority boundary

Every valid result has status `CANDIDATE` and notice `AI_CANDIDATE_NOT_CANONICAL_TRUTH`. AI may extract, normalize, compare, explain and prepare a governed workflow. It cannot create Verification, Trust, Eligibility, Enforcement, customs truth, contractual choices, signatures or mutations of executed history. Acceptance into a domain requires that domain's deterministic policy and authorized actor/provider evidence path.

## Legacy transition

The prior code offered free-form JSON calls, hard-coded models and simulated/fabricated fallback values. V1.1 introduces the governed foundation and removes fabricated recommendation/validation fallbacks. Remaining legacy insight endpoints are non-authoritative product conveniences and should migrate task-by-task onto the foundation before broader activation.

## Deferred registry

Commodity & Trade Reference Registry remains deferred: curated commodity identities, units, specification vocabularies, HS candidates by jurisdiction, required-document profiles, inspection profiles and effective-dated provenance. Registry data will be reference evidence, never automatic canonical truth.
