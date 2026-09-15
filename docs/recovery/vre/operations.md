# VRE operational contracts

Implementation baseline; activation and deployment evidence is recorded separately.

## Ownership and commands

- Verification: existing canonical workflow/application service and replay own
  decisions. `POST /admin/vre/verification/reviews` appends an independent review,
  not a decision. `POST /admin/vre/verification/reevaluate` runs the canonical
  workflow for an explicit legitimate trigger, in the same transaction as its
  security audit and new current participation binding. Historical streams remain
  untouched. The owner self-service initiation path also always selects V2.
- Risk: explicit signal, assessment and disposition commands under
  `/admin/vre/risk`. Referral is not a case and does not enforce. Current HTTP
  ingestion records manual observations only; provider, automated and explicitly
  AI-advisory provenance are reserved in the storage contract, without fictitious
  integrations or a public caller-controlled source-authority flag.
- Enforcement: `/admin/vre/enforcement/cases` opens an explicit evidence-linked
  case. `/decisions` appends the case's decision and action atomically. Optimistic
  predecessor checks plus a subject lock prevent conflicting current states.
  NORMAL lifts a previous restriction through a new case/decision; it never
  edits/deletes an old action. Review dates do not silently expire decisions.

Operational scopes are USER and ORGANIZATION with canonical subject validation.
Other approved scope names are reserved in persistence, not falsely advertised
as integrated with entity authorities that have not yet been wired.

## Permissions and assurance

VERIFICATION_REVIEWER: verification queue (authenticated), evidence (MFA),
review and re-evaluation (recent step-up). OPERATIONS: Risk read/create/assess/
dispose (MFA), Enforcement read (MFA) and case opening (recent step-up).
PLATFORM_ADMIN: Risk read, Enforcement read, case opening and decisions; decisions
require recent step-up. SUPPORT gains no VRE mutation permissions. Platform Owner
has the corresponding atomic VRE permissions but cannot bypass independence,
canonical engines, assurance or audit. No new role aliases are introduced.

## Audit and reads

Each privileged mutation writes `security_audit_events` in the same PostgreSQL
transaction, including principal, resolved permission, assurance, reason, safe
before/after state, request and correlation identifiers. Audit failure rolls back
all authoritative changes. Raw evidence inspection is separately authorized and
audited before returning the response. Lists return selected metadata, never
credentials, sessions, secrets or whole user records. Policy history summaries
come from canonical replay, not JSON flags presented as authority.

Queue limits are 100 records; Organization decision history is bounded to the
latest 20 streams. Review history shows the latest 50 artifacts. Source references
and reasons must not contain credentials or confidential document payloads.
The baseline captures submitted assertions and references, not a new confidential
document storage authority.

## Cross-domain orchestration and inactive consumers

An assessment may be explicitly linked to a same-subject Enforcement case.
Link validation does not confer decision authority. Verification failure does
not automatically create misconduct, Risk or Enforcement. AI is never a final
authority. No background punishment or legacy inference is introduced.

Downstream enforcement integration is **INACTIVE**. Recording RESTRICTED,
SUSPENDED, BLOCKED or TERMINATED does not itself disable login, trading or
publication. No eligibility/trading command currently consumes this new authority;
the UI states this explicitly. Existing canonical Verification, Trust, Eligibility,
Offers, Orders, Contracts and ownership history are not overwritten. A future
consumer must explicitly consult scoped Enforcement policy at its own legitimate
command boundary, not mutate historical truth.
