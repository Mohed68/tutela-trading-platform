# Phase 3A route inventory

Classification reflects the registered server routes, not an assertion that
their backing schema currently exists.

## Approved recovery probes

| Domain | Route | Authentication | Classification |
|---|---|---|---|
| System | `GET /api/health` | Public | Safe read-only probe |
| Frontend | `GET /` | Public | Safe shell probe |
| Commodities | `GET /api/commodities` | Public | Safe read-only probe |
| Offers | `GET /api/offers` | Public unless a user filter is requested | Safe public probe with unresolved current/legacy offer and user columns |
| Authentication | `GET /api/auth/user` | Required | Safe unauthenticated-status probe; expected 401 |

All other API/admin routes are HTTP 503 in controlled recovery mode.

## Authentication, user, and dashboard

- public/redirect reads: `GET /api/login`, `GET /api/logout`;
- authentication writes: `POST /api/auth/register`,
  `POST /api/auth/login`, `POST /api/auth/logout`;
- authenticated reads: `GET /api/auth/user`,
  `GET /api/auth/kyb-status`, `GET /api/auth/plan`,
  `GET /api/dashboard/metrics`, `GET /api/dashboard/activity`;
- authenticated write: `PATCH /api/auth/preferences`;
- external AI read: `GET /api/recommendations/personalized`.

Local-authentication reads/writes depend on unresolved legacy/current user
columns. Login also updates `last_login_at`.

## Marketplace and trading

- commodity reads/writes: `GET /api/commodities`,
  `POST /api/commodities`;
- public offer reads: `GET /api/offers`, `GET /api/offers/summary`,
  `GET /api/offers/options`, `GET /api/offers/search`;
- authenticated offer read/write:
  `GET /api/offers/:id`, `POST /api/offers`,
  `PATCH /api/offers/:id/status`;
- interested offers:
  `GET /api/interested-offers`, `POST /api/interested-offers`,
  `DELETE /api/interested-offers/:offerId`,
  `GET /api/offers/:offerId/interested`;
- orders: `GET /api/orders`, `POST /api/orders`,
  `PATCH /api/orders/:id/status`;
- contracts: `GET /api/contracts`, `GET /api/contracts/:id`,
  `POST /api/contracts`, `PATCH /api/contracts/:id/status`,
  `GET /api/contracts/:id/blockchain-status`.

Offer reads depend on unresolved offer/user columns. Interested offers and
orders depend on tables absent from the approved migration state. Contract
routes cross unresolved financial/lifecycle mappings. Blockchain status is a
simulation but remains outside Phase 3A probes.

## Verification, KYB, partners, and insights

- offer/document writes:
  `POST /api/verification/upload-document`,
  `POST /api/offers/:offerId/verify`;
- KYB/document reads and writes:
  `GET /api/verification/documents`,
  `POST /api/verification/upload-url`,
  `POST /api/verification/complete-upload`,
  `GET /api/verification/documents/:documentPath(*)`,
  `GET /api/verification/pending`,
  `PATCH /api/verification/:id/status`;
- partners: `GET /api/partners`, `POST /api/partners/request`,
  `PATCH /api/partners/:id/status`;
- performance insights: `GET /api/insights/latest`,
  `POST /api/insights/generate`.

These routes are authentication-required and involve unresolved KYB,
storage-locator, user-column, activity-log, AI, or workflow contracts. They are
not probed.

## Payments, storage, seed/reset, and administration

- external payment write: `POST /api/checkout/sessions`;
- external storage read: `GET /public-objects/:filePath(*)`;
- destructive/demo:
  `POST /api/admin/seed-demo-data`,
  `GET /api/admin/force-seed-production`,
  `DELETE /api/admin/clear-demo-data`;
- authenticated admin reads:
  `GET /admin/auth/info`, `GET /admin/kyb`, `GET /admin/offers`,
  `GET /admin/insights/market`, `GET /admin/insights/compliance`,
  `GET /admin/audit`, `GET /admin/companies`;
- authenticated admin writes:
  `POST /admin/kyb/:companyId/decision`,
  `POST /admin/offers/:id/moderate`,
  `POST /admin/users/:id/toggle`.

The three seed/reset routes currently lack authentication and include a
destructive GET operation. Recovery mode blocks them before routing. Their
production disposition requires explicit security/business approval.
