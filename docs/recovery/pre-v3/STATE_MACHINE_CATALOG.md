# Current V2 State Machine Catalog

## Organization Verification

Evidence submitted → `manual_review` / pending independent review → Review Artifact (`confirmed`, `revision_requested`, or `rejected`) → legitimate re-evaluation → canonical decision → Replay → derived Trust. V1 decisions and Trust snapshots remain historical facts. Policy V2 applies prospectively.

## Offer

`draft → submitted → verified` for approval; `submitted → draft` for revision required. `submitted` remains when the engine cannot approve. Only the current frozen revision is coordinated. Current BUY creation/submission/publication is disabled; historical BUY records remain readable facts.

## Order and Contract

Order: `created → accepted`; unsupported transitions fail closed. Acceptance is optimistic and fingerprint-bound. Contract: accepted Order → one `draft` snapshot. Current V2 defines no signing, payment, settlement, shipping or completion state.

## Enforcement

`NORMAL`, `MONITORED`, `RESTRICTED`, `SUSPENDED`, `BLOCKED`, `TERMINATED`. Every change is a new case/decision/action with a predecessor check. `NORMAL` and `MONITORED` allow Current V2 mutations. `RESTRICTED` denies only enumerated actions. `SUSPENDED`, `BLOCKED` and `TERMINATED` deny all supported new matching trade mutations. Read/history/remediation remains available; review dates do not auto-expire actions.

Supported restricted action vocabulary: `offer.create`, `offer.edit`, `offer.submit`, `order.create`, `order.accept`, `contract.create`.
