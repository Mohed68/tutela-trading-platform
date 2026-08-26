# Phase D1 — Isolated Demo Runtime Contracts

## Decision

TUTELA's qualified interactive demo uses an isolated fixture/runtime boundary.
The canonical fixture source is `server/demo-runtime/fixtureCatalog.ts`. Its 15
offers and six organizations are synthetic, immutable, simulation-only records.

The demo does not write to production Organization, Membership, Evidence,
Verification, Trust, Eligibility, Offer, Order, or Contract repositories. Demo
authority labels are presentation states and never canonical authority.

## Identity boundary

Every demo identity uses `demo:<kind>:<value>`. `isProductionIdCandidate`
provides the defensive rejection rule for later API integration. D1 does not
change production routes. The current production trading endpoints in
`server/routes.ts` and Organization endpoints in
`server/trade-trust-application/routes.ts` accept non-empty string route IDs;
their future D2 integration must reject demo-namespaced IDs before invoking
production application services.

## Runtime contracts

- `DemoAccessGrant` records qualification separately from production identity
  and Organization Verification.
- `DemoSession` is owned by one qualified user, lasts 60–120 minutes, and owns
  mission/order/contract state.
- `DemoSessionReset` clears session orders, contracts, and mission progress and
  restores the immutable baseline.
- `DemoHeroMission` tracks deterministic, session-scoped guided progress.
- `DemoOrder`, `DemoOrderAcceptance`, and `DemoContract` always carry
  `simulation: true` and `nonBinding: true`.
- Demo contracts display `SIMULATION — NON-BINDING`.

No Redis, database, route, controller, UI, or production repository is added in
D1.

## Guided missions

1. WTI Crude Oil: complete baseline trade lifecycle.
2. Urea 46%: progressive organization trust and documentary evidence.
3. Copper Cathode: independently inspected evidence presentation.

Copper is selected instead of Base Oil for the third mission because the
current marketplace and trading vocabulary already supports the Copper flow,
requiring less future presentation branching.

## Future UX contract

The guided experience is optional. The entry copy, action labels, subtle
`Guided Scenario` badge, completion message, and completion actions are stored
in `heroMissions.ts`; D1 does not wire them into public routes or components.

## Legacy consolidation plan

The new catalog supersedes these fixture sources, but D1 does not delete or
rewire them:

- `client/src/lib/demo.ts`: retire its offer/deal constants during D2 when the
  UI consumes the isolated demo API.
- `client/src/pages/MyOffers.tsx`: retire the duplicate inline fixtures in D2.
- `client/src/lib/marketStore.ts`: replace localStorage as authority with a
  session-owned demo store in D2; presentation helpers may be reused.
- `server/seedData.ts`: keep disabled and retire from demo use; never use it to
  seed the qualified demo.

## D2 boundary

D2 may add a qualified demo application service, a server-side session store,
and `/api/demo/*` routes. It must keep production repositories out of the demo
module and add production-route rejection of demo IDs as a separate minimal
defensive integration.
