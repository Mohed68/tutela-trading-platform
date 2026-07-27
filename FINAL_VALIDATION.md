# Final validation gate

Run this on Windows PowerShell from the project root using a staging Neon database.

```powershell
$env:NODE_ENV="development"
$env:DATABASE_URL="<STAGING_NEON_DATABASE_URL>"
$env:SESSION_SECRET=(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")
$env:DEMO_AUTH_BYPASS="false"

npm ci --no-audit --no-fund
npm run check
npm run db:migrate:auth
npm run build
npm start
```

Then verify:

1. `GET http://localhost:5000/api/health` returns HTTP 200.
2. Create a new account at `/register`.
3. Refresh the browser and confirm the session remains active.
4. Open a protected page and confirm it loads.
5. Log out and confirm protected API requests return HTTP 401.
6. Restart the server and confirm an existing login session remains valid.
7. Confirm no response contains `passwordHash`.
8. Test an administrator account separately.
9. Stop the process and confirm graceful shutdown.

Production deployment is approved only after all steps pass without warnings or unhandled errors.
