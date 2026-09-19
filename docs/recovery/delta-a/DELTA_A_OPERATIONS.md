# Delta A Operations and Verification

## Migration

Test rehearsal:

```text
npm run db:migrate:delta-a:test
```

Production (explicit target only, with `DATABASE_URL` supplied outside the repository):

```text
npm run db:migrate:delta-a
```

The runner requires migration `0025_contract_engine_v1_1`, takes the shared migration advisory lock, journals the checksum and Git revision, and verifies that existing user, Organization, contract snapshot and signature counts do not change.

## Required gates

```text
npm run test:delta-a
npm run test:organization-membership
npm run test:production-trade-trust-runtime
npm run test:mvp-closure
npm run test:mfa
npm run check
npm run build
```

## Production smoke

Verify without creating authority or legal/commercial truth:

1. `/api/health` returns `ok` over HTTPS.
2. An unauthenticated request to `/api/action-center` and an Organization workspace endpoint is rejected.
3. The public application serves the new bundle and the login page remains reachable.
4. The migration journal has one successful 0026 row with the deployed checksum.
5. Delta A tables exist, while Platform Terms, Commercial Fee Schedules, Fee Entitlements and external anchors remain empty unless separately authorized data already exists.
6. The service is active and recent logs contain no startup/schema/runtime error.

Do not create a VERIFIED domain, ACTIVE Platform Terms, ACTIVE fee schedule, Fee Entitlement or CONFIRMED external anchor as a smoke-test fixture.
