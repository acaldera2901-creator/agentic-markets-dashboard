# Founder Access

Internal founder/admin access must not be implemented with a hardcoded client-side key.

For the production beta, founder grants should be handled with a server-side allowlist or database table:

- `client_accounts.email`
- `client_accounts.plan`
- `client_accounts.payment_status`
- `client_accounts.founder_grant`
- `client_accounts.created_by`

Temporary beta rule:

- Do not expose any founder/admin link in the customer UI.
- Do not hardcode founder keys in the frontend bundle.
- Use server-side environment variables and database writes when admin provisioning is added.

Planned hidden route:

- `/founder-access`
- protected by server-only `FOUNDER_ACCESS_KEY`
- writes account plan to the database, not localStorage

