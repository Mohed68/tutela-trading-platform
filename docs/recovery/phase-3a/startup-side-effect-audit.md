# Phase 3A startup-side-effect audit

Status: pre-startup audit completed

## Startup sequence

`server/index.ts` performs the following work:

1. validates controlled-recovery mode;
2. initializes optional Sentry monitoring;
3. constructs the Express application and middleware;
4. runs read-only database/schema health queries;
5. registers session, Passport, application, and admin routes;
6. installs Vite middleware in development or static assets otherwise;
7. binds the HTTP server;
8. registers graceful-shutdown handlers.

No schema push, migration execution, reset, administrator creation, webhook
worker, scheduler, payment call, blockchain call, or email call occurs directly
in `server/index.ts`.

## Startup effects found

| Component | Observed behavior | Recovery treatment |
|---|---|---|
| Demo seed timer in `registerRoutes` | One second after route registration it queried offers and could clear commodities, offers, and demo users before reseeding. Its error fallback repeated the destructive clear/seed attempt. | Disabled only when `TUTELA_RECOVERY_MODE=true`. Existing behavior outside recovery mode is unchanged. |
| PostgreSQL session store | Session-store housekeeping may periodically delete expired sessions. | Automatic pruning is disabled in recovery mode. `saveUninitialized=false` prevents anonymous probes from creating sessions. |
| Sentry server monitoring | A configured DSN initializes an external monitoring client at startup. | Disabled in recovery mode regardless of DSN presence. |
| Client Sentry monitoring | A configured `VITE_SENTRY_DSN` initializes browser monitoring when the shell loads. | The recovery launcher clears this variable in its child process only. |
| OpenAI clients | Three feature services previously constructed OpenAI clients during module import and could prevent core startup when configuration was missing. | Clients are now created only when an AI feature is invoked. AI is unavailable in recovery mode. |
| Stripe | The client is constructed only when a key exists. No request occurs until the checkout POST route is invoked. | Checkout and every non-approved API route are blocked by the recovery guard. |
| Object storage | A client object is constructed at import. Network access occurs only inside storage routes. | Storage routes are blocked by the recovery guard. |
| Blockchain | Current implementation is an in-process simulation called only from contract routes. | Contract routes are blocked by the recovery guard. |
| Neon/Drizzle | Startup opens database connections for schema health checks and sessions. | Health checks are read-only. Session pruning is disabled. |
| Vite | Development middleware loads and transforms local frontend assets. | Allowed; Replit-only Vite plugins remain conditional on `REPL_ID`. |

## Recovery-mode boundary

Recovery mode is explicit, defaults off, and is rejected when
`NODE_ENV=production` or a Render environment is detected. The dedicated local
launcher:

- loads `.env` through Node's environment-file support;
- forces only its child process to development mode;
- enables the recovery guard;
- disables demo/bypass flags;
- disables browser monitoring;
- uses port 5055 unless `TUTELA_RECOVERY_PORT` is supplied.

Only these API reads are permitted:

- `GET` or `HEAD /api/health`
- `GET` or `HEAD /api/commodities`
- `GET` or `HEAD /api/offers`
- `GET` or `HEAD /api/auth/user`

Static/frontend requests remain available. Every other `/api` or `/admin`
request receives HTTP 503 before session, route, payment, AI, blockchain,
storage, seed, reset, or business logic can run.

## Legacy authentication boundary

The legacy database lacks the local-authentication columns required by the
current model. Normal startup still fails closed. Recovery mode permits only
the read-only characterization server to continue after reporting the missing
authentication contract. Authentication mutations remain blocked.

## Risks retained outside recovery mode

The default startup seed and the unauthenticated seed/clear routes are existing
high-risk behavior. They were not redesigned or removed because Phase 3A must
not silently change production defaults or delete features. They require a
separate approval before production readiness.

The application error middleware and several feature handlers also log raw
third-party/database error objects. Controlled probes avoid those integrations;
systematic runtime log sanitization remains a later hardening task.
