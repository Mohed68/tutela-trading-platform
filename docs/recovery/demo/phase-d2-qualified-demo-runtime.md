# Phase D2 — Qualified Demo Application Runtime

## Runtime boundary

`DemoSimulationApplicationService` depends only on explicit ports for access
grants, sessions, analytics, clock, identifiers, verification tokens, and email
delivery. D2 composes those ports with process-local in-memory stores. Redis or
KeyDB can replace the adapters without changing application behavior.

No production User, Organization, Membership, Evidence, Verification, Trust,
Eligibility, Offer, Order, or Contract repository is used by the demo runtime.
Express session data stores only the verified demo grant ID and current demo
session ID; it does not create a production identity.

## Access and email verification

`POST /api/demo/access/request` validates a business email with the existing
public-domain policy and returns an anti-enumerating response. A 256-bit random
token is delivered through the shared Resend transport, while only its SHA-256
digest remains in the demo access store. The token is single-use and expires in
24 hours.

`GET|POST /api/demo/access/verify` consumes the token and creates a verified
demo-only access grant. The grant lasts seven days and has
`productionAuthority: false`. Delivery failures remove the pending grant and
fail safely without logging the token or address.

## Session and state

`POST /api/demo/sessions` requires a verified, unexpired grant. It creates one
session per grant with a 90-minute TTL. The session store owns mission progress,
demo orders, simulated acceptances, and non-binding contracts. Expired sessions
fail closed; reset restores empty runtime state while keeping the access grant.

## Isolated API

- `POST /api/demo/access/request`
- `GET|POST /api/demo/access/verify`
- `POST /api/demo/sessions`
- `GET /api/demo/session`
- `POST /api/demo/session/reset`
- `GET /api/demo/offers`
- `GET /api/demo/offers/:offerId`
- `GET /api/demo/offers/:offerId/evidence`
- `GET /api/demo/organizations/:organizationId`
- `GET /api/demo/missions`
- `GET /api/demo/missions/:missionId`
- `POST /api/demo/missions/:missionId/start`
- `POST /api/demo/orders`
- `POST /api/demo/orders/:orderId/accept`
- `POST /api/demo/orders/:orderId/contract`
- `GET /api/demo/contracts/:contractId`

The server advances mission steps only after the matching organization, offer,
evidence, order, acceptance, or contract action. There is no endpoint that
accepts an arbitrary completed step.

## Production boundary

Production Order, Contract, Organization membership, Organization evidence,
Organization Verification, Offer evidence, and trade-participation routes now
reject `demo:*` identifiers before invoking their application service or
repository. The change is limited to identifier rejection and does not alter
production authority semantics.

## Analytics

The application emits only the approved demo event vocabulary through
`DemoAnalyticsPort`. The production composition uses a no-op adapter in D2, so
no event enters `activity_logs`. Tests use an isolated in-memory adapter.

## D2 operational limit

In-memory grants and sessions are intentionally process-local. A server restart
invalidates active demo verification/session state. Durable isolated storage is
deferred to a later phase; the frontend must handle `session_required` by
returning the user to qualified demo access.
