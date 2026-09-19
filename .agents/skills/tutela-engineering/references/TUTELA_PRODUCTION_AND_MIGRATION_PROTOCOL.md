# TUTELA Production & Migration Protocol

Use this reference only when a task changes schema or deploys Production.

## Repository / Production

Canonical repository:
`Mohed68/tutela-trading-platform`

Primary local repository:
`C:\Users\M.Emad\Desktop\TUTELA`

Production:
- AWS Lightsail: `TUTELA-PRODUCTION-01`
- region: Frankfurt / `eu-central-1`
- service manager: `systemd`
- service: `tutela.service`
- app repository: `/home/ubuntu/tutela-trading-platform`
- environment: `/etc/tutela/tutela.env`
- database: Neon PostgreSQL
- public site: `https://tutelaworld.com`
- health: `https://tutelaworld.com/api/health`

Do not use PM2.

## Git safety

- no force push
- no history rewrite
- no destructive reset used to conceal drift
- preserve clean, reviewable commits
- verify exact Production HEAD after deployment

## Migration safety

Migrations must be:
- additive where possible
- history-preserving
- formally reviewed
- rehearsed in TEST/disposable environment first

Before Production migration:
1. verify predecessor migration
2. verify target environment
3. create immediate database backup
4. validate backup/catalog
5. run migration using existing safe runner pattern
6. verify migration journal/checksum
7. verify critical row counts/integrity
8. verify no historical snapshot/signature/event rewrite

If rollback would destroy newly valid historical data, use a forward compatibility migration instead.

## Production testing

Never create fake business transactions, organizations, memberships, signatories, fees, AI records, or blockchain anchors in Production for a test.

Use smoke/read-only/auth-boundary verification.

## Post-deploy

Verify:
- exact final HEAD
- service active
- `NRestarts`
- health `200`
- auth isolation
- expected migration journal
- business row counts
- clean worktree
- no fake records
