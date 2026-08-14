# Resend DNS follow-up

## Status

Self-service registration is intentionally unavailable until outbound email is
authorized. The application and database are healthy; Resend rejects the
verification-email request with HTTP 403 because `tutelaworld.com` has not
completed DNS verification in Resend.

This is a deployment-configuration follow-up, not a change to marketplace,
contract, verification, or authentication business rules.

## Confirmed state

- Resend account: signed in and reachable.
- Resend domain: `tutelaworld.com`.
- Resend domain status: `not started`.
- DNS authority: `ns1.aljanob.sa` / `ns2.aljanob.sa`.
- DNS administration: cPanel at `https://ns1.aljanob.sa:2083`.
- Required production sender: `Tutela <no-reply@tutelaworld.com>`.
- Render contains the mail configuration keys; their values must never be
  copied into repository files, logs, or documentation.

## Resume procedure

1. Sign in to the cPanel DNS account for `tutelaworld.com`.
2. In Resend, open **Domains** then `tutelaworld.com`.
3. Copy the current DNS records shown by Resend into cPanel exactly:
   - DKIM TXT record (`resend._domainkey`);
   - sending-subdomain MX record (`send`);
   - sending-subdomain SPF TXT record (`send`).
4. Do not replace the root-domain SPF record unless Resend explicitly requires
   it. Preserve existing MX and mail records.
5. Wait for DNS propagation, then use **Verify DNS Records** in Resend until
   the domain becomes verified.
6. Set Render `EMAIL_FROM` to exactly:
   `Tutela <no-reply@tutelaworld.com>`
7. Keep `RESEND_API_KEY` confidential and unchanged unless Resend reports that
   it is invalid or insufficiently scoped.
8. Trigger a Render deploy and register a new test account using an inbox under
   the project owner's control. Verify receipt of the message and complete the
   verification link.

## Current temporary alternative

The opt-in `temporary_direct` registration mode may be enabled while DNS
access is unavailable. It creates a local account with email verification
remaining unknown; it does not use SMTP credentials, expose verification
links, or claim that the email address is owned. Disable the mode and return
to email verification after the sender domain is verified.

## Security notes

- The sender mailbox password is not required by Resend and must not be placed
  in Render.
- Resend sends through its API; it needs a verified sending domain, not SMTP
  credentials.
- If `resend.dev` is used for testing, it can only send to the email address
  associated with the Resend account. It is not a production fallback for
  arbitrary users.
