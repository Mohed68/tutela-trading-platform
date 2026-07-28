# Phase 4C dashboard data-authority analysis

Date: 2026-07-28

Status: implementation boundary approved; analysis completed before runtime
changes

## Scope

Phase 4C recovers only the authenticated dashboard shell and safe read
summaries. It does not activate or infer contracts, orders, KYB, verification,
subscriptions, payments, AI, blockchain, administration, offer writes, or any
other business workflow.

The recovery account is an authenticated `trader`. Authentication alone does
not establish that it is a buyer, seller, organization delegate, verified
organization, marketplace participant, or owner of any legacy business data.

## Existing dashboard dependency trace

```text
dashboard.tsx
├── /api/dashboard/metrics
│   └── storage.getDashboardMetrics
│       ├── offers (compatible fields, but active is not publication proof)
│       ├── contracts (current model differs from legacy table)
│       └── verification_documents (current model differs from legacy table)
├── ActiveOffers
│   ├── /api/offers (public marketplace, not current-user ownership)
│   ├── /api/commodities
│   └── create/edit offer controls
├── RecentActivity
│   └── /api/dashboard/activity
│       └── audit_logs (legacy database contains activity_logs instead)
├── KybStatusCard / KybWizard
│   └── inferred default KYB state plus write-capable workflow
├── SecureDataExample
│   ├── /api/auth/kyb-status
│   ├── /api/auth/plan
│   └── preference mutation and demo fallbacks
├── AIRecommendations
│   └── /api/recommendations/personalized
└── AIInsights
    └── hard-coded presentation data
```

The existing metrics route collapses missing or incompatible information to
zero. That is unsafe because zero is an asserted business result, while the
underlying contract, verification, and financial-volume semantics are not yet
recovered.

## Authority matrix

| Dashboard module | Authoritative source | Recovery state | Reason |
|---|---|---|---|
| Account summary | authenticated Phase 4B identity projected through the allow-listed current-user DTO | available | The local authentication authority and account state are explicit |
| Session summary | active Passport session for the authenticated request | available | The server has authenticated the request; no session identifier is exposed |
| My offers | `offers.user_id`, filtered only by the authenticated session user ID | empty or available | Ownership is explicit and does not depend on buyer, seller, organization, or verification inference |
| Public marketplace | Phase 3C fail-closed publication projection | empty or available | Publication still requires both authoritative offer and seller-organization verification |
| Contracts | none approved | unavailable | Legacy/current contract schemas and lifecycle semantics are unresolved |
| Orders | none approved | unavailable | No recovered order authority or lifecycle exists |
| Activity | none approved | unavailable | Repository expects `audit_logs`; legacy database contains a structurally different `activity_logs` table |
| KYB | none approved | unavailable | Authentication and legacy `users.verified` are not KYB evidence |
| Verification | none approved | unavailable | Missing, pending, or document existence cannot be promoted to verification state |
| Subscription | none approved | unavailable | No subscription or entitlement authority is recovered |
| Performance insights | none approved | unavailable | Reports exist structurally, but generation and business semantics are outside this phase |
| AI recommendations | none approved | unavailable | External generation and inferred business recommendations are outside this phase |

## Safe dashboard contract

The recovered endpoint will return one aggregate, allow-listed dashboard DTO.
Every module has an explicit state:

- `available`: authoritative data was obtained;
- `empty`: the authoritative query completed and has no records;
- `unavailable`: the module has no approved authority in this recovery phase;
- `error`: an otherwise approved module failed independently.

Unavailable modules return `data: null`. They never return fabricated zeros,
`pending`, `unverified`, demo values, or inferred state.

The only business-table query introduced by this phase is a count of offers
whose `user_id` equals the authenticated server-side user ID. No request query
or body field can select a different user. No joined user, seller, organization,
moderation, verification, KYB, credential, or personal record is returned.

The public marketplace count reuses the Phase 3C strict fail-closed projection.
For the approved legacy dataset it remains zero because authoritative proof of
both required verification predicates is absent.

## Failure isolation

The current-user offer count and the public marketplace publication query are
independent. A failure in either optional read produces `error` only for that
module. It does not invent a value and does not prevent the authenticated
account/session summary or the neutral unavailable modules from rendering.

Authentication failure remains a whole-request HTTP 401 because there is no
safe dashboard identity without a valid server session.

## Frontend recovery boundary

The dashboard page will consume only the safe aggregate DTO. The following
legacy components remain in the repository but are isolated from the recovered
dashboard:

- `MetricsCards`;
- `ActiveOffers`;
- `RecentActivity`;
- `KybStatusCard` and `KybWizard`;
- `SecureDataExample`;
- `AIRecommendations`;
- `AIInsights`.

They are not deleted because this phase does not prove that they are unused
elsewhere. The recovered dashboard contains no create, edit, upload,
verification, subscription, payment, or AI action. It keeps only safe
navigation to the already recovered public marketplace.

## Expected approved-database result

- account: available;
- session: available;
- my offers: empty, count `0`;
- public marketplace: empty, published count `0`;
- contracts, orders, activity, KYB, verification, subscription, performance
  insights, and AI recommendations: unavailable;
- legacy users and all nine legacy offers: unchanged;
- no legacy offer is associated with the recovery trader;
- no business-table write occurs.
