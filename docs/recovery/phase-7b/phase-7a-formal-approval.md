# Phase 7A — Organization Verification Architecture Formal Approval

Date: 2026-07-28

Record status: **FORMALLY APPROVED**

Implementation status: Not yet authorized except through explicitly approved
Phase 7B implementation slices.

## 1. Approval Summary

The Tutela Repository Owner formally approves:

`docs/architecture/organization-verification-v2.md`

as the authoritative architecture for the Tutela Organization Verification
capability.

This approval freezes the capability boundaries, authority model, decision and
status semantics, integration contracts, evidence ownership, and history
strategy described by Version 2.

Architecture approval is not blanket implementation authorization. Every
Phase 7B implementation slice requires explicit authorization before runtime,
schema, migration, database, API, route, frontend, or production work begins.

## 2. Approved Document

| Field | Value |
|---|---|
| Document | `docs/architecture/organization-verification-v2.md` |
| Document title | Phase 7A — Organization Verification Domain Architecture Specification |
| Version | 2 |
| Approval status | **FORMALLY APPROVED** |
| Scope | Organization Verification domain architecture |
| Supersedes | Version 1 as the implementation architecture authority |

Version 1 remains preserved as historical architecture context. It is not the
authority for implementation.

## 3. Approved Commit

Approved architecture commit:

`d2400dcc5fa8824057b4e13921464d96c2da6bf3`

This hash identifies the exact Version 2 architecture reviewed and approved.
The later documentation commit that formalizes approval metadata does not
alter the approved architecture semantics.

Any future semantic change must be proposed against the approved architecture
and follow the change-control rule in Section 9.

## 4. Approval Date

Approval date: **2026-07-28**

Approving authority: **Tutela Repository Owner**

The approval was explicitly granted through the repository recovery workflow.

## 5. Final Architecture Decision

The approved model is:

- **Tutela Trust Domain** is a non-operational architectural governance
  framework.
- **Identity and Access** owns authenticated users, sessions, roles,
  membership authority, and delegated access references.
- **Organization Registry** owns Organization identity, immutable Profile
  Revisions, legal-entity relationships, and Organization Lifecycle.
- **Organization Verification** is an independent bounded context that
  evaluates one immutable Organization Verification Revision.
- **Confidential Evidence Storage** owns raw protected artifacts and their
  storage lifecycle.
- **Offer Verification** remains an independent Phase 6 capability.
- **Future Participation Eligibility** owns action-specific permission
  decisions and may consume narrow upstream outputs.

The approved Organization Verification Decision vocabulary is:

```text
approved
revision_required
manual_review
rejected
```

Only the Organization Verification Decision Engine may create these Decisions.

The approved Organization Trust Status vocabulary is:

```text
unestablished
trusted
not_trusted
expired
invalidated
```

Only the versioned Trust Status Deriver may derive these current-effective
values from authoritative append-only sources.

The governing principle is:

> Unified trust philosophy, decentralized capability authority.

## 6. Architecture-Frozen Areas

The following are architecture-frozen:

1. Tutela Trust Domain as non-operational governance.
2. Identity and Access boundary.
3. Organization Registry boundary.
4. Organization Verification boundary.
5. Confidential Evidence Storage boundary.
6. Offer Verification independence.
7. Future Participation Eligibility boundary.
8. Organization Verification Decision Engine sole Decision authority.
9. Organization Verification Workflow Coordinator workflow authority.
10. Trust Status Deriver status-derivation authority.
11. Decision vocabulary:
    - `approved`;
    - `revision_required`;
    - `manual_review`;
    - `rejected`.
12. Trust Status vocabulary:
    - `unestablished`;
    - `trusted`;
    - `not_trusted`;
    - `expired`;
    - `invalidated`.
13. Evidence ownership:
    - Confidential Evidence Storage owns raw artifacts;
    - Organization Verification owns semantic evidence use and assessments.
14. Immutable Snapshot and fingerprint strategy.
15. Append-only Verification and Trust Status history model.
16. The `OrganizationVerificationTrustStatusV1` downstream integration
    contract.
17. Legacy Organization Anti-Corruption Layer and non-authoritative legacy
    mappings.
18. Capability-specific `org_verification.*` namespaces.
19. No trust inheritance between legal Organizations.
20. Separation of Lifecycle, Submission, Process, Decision, Trust Status, and
    Participation Eligibility.

An implementation slice may add internal detail only when it preserves every
frozen area and does not invent a business policy.

## 7. Explicitly Deferred Business Policies

The following remain unresolved:

- initially supported jurisdictions;
- supported legal forms;
- required evidence matrix by organization type and jurisdiction;
- Trust Status validity duration and renewal windows;
- whether an older approved Decision remains effective during renewal;
- evidence retention and deletion periods;
- exact owner-correctable and rejection dispositions;
- deterministic rejection enablement in the initial Decision Policy;
- appeal, resubmission, and waiting-period rules;
- reviewer quorum and conflict-resolution rules;
- public Organization/status disclosure;
- Organization registration and activation authority; and
- evidence source and issuer allowlists.

These unresolved policies do not invalidate architecture approval. They may
block a specific implementation slice, production policy catalog, external
exposure, or production rollout.

No implementation slice may answer one of these questions implicitly through
a default, hard-coded rule, migration value, route behavior, seed, UI
assumption, or legacy-data inference.

## 8. Implementation Preconditions

Before any implementation slice begins:

1. the slice must be explicitly authorized;
2. its scope and stop conditions must be confirmed;
3. the repository must be at the approved predecessor commit with a clean
   worktree or documented unrelated user changes;
4. architecture-frozen areas affected by the slice must be identified;
5. applicable business-policy gates must be checked;
6. tests must be planned before capability exposure;
7. schema work must wait for the dedicated schema-design slice and formal
   schema review;
8. database work must use a confirmed disposable recovery branch and separate
   authorization;
9. no production or Render database may be accessed;
10. no legacy data may be promoted into Organization, evidence, approval, or
    trust authority;
11. Phase 6 Offer Verification regression protection must remain active; and
12. each completed slice must pass `npm run check` and `npm run build`, plus
    its slice-specific tests.

If a slice encounters an unresolved business rule, architecture ambiguity,
security boundary change, schema incompatibility, or potential mutation of
protected legacy data, it must stop and request approval.

## 9. Change-Control Rule

Any change to:

- capability or bounded-context boundaries;
- authority ownership;
- Decision vocabulary, ownership, or semantics;
- Trust Status vocabulary, ownership, or semantics;
- Organization Lifecycle ownership;
- integration contracts;
- evidence/raw-artifact ownership;
- Snapshot or fingerprint authority;
- append-only history strategy;
- Offer Verification independence;
- Participation Eligibility separation;
- legacy Anti-Corruption protections; or
- capability namespace isolation

requires a new formal architecture review before implementation.

A proposed change must:

1. identify the frozen decision it affects;
2. explain why the approved design cannot safely support the need;
3. document alternatives and regression risk;
4. update architecture traceability;
5. receive explicit formal approval; and
6. precede any code, schema, migration, or runtime change.

Implementation convenience, framework preference, or modernization is not
sufficient justification to bypass change control.

## 10. Authorization Boundary

Authorized by this record:

- formal architecture status metadata;
- this approval record;
- the Phase 7B implementation plan; and
- future implementation only when a named slice receives separate explicit
  authorization.

Not authorized by this record:

- Phase 7B-1 or any later implementation slice;
- runtime or application-source changes;
- schema or migrations;
- database access;
- routes, APIs, or frontend;
- policy-catalog creation;
- business-rule invention;
- external integrations;
- production or Render changes; or
- legacy-data reconciliation/backfill.

The next permissible action after this documentation checkpoint is to wait for
explicit authorization for:

**Phase 7B-1 — Architecture Enforcement Skeleton**
