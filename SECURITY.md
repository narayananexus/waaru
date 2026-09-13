# Security Policy

## Supported versions

Security fixes are made in the current published release of `@waaru/sdk`. Upgrade to the newest published version before reporting an issue whenever possible. Prerelease APIs may change between beta versions.

## Report a vulnerability privately

Do not open a public GitHub issue for a suspected vulnerability.

When private vulnerability reporting is available for this repository, use **Security → Report a vulnerability** on GitHub. If that option is unavailable, use your authenticated Waaru support channel and clearly label the request as an SDK security report.

Include only the information needed to reproduce the problem:

- the `@waaru/sdk` version and Node.js version;
- the affected SDK method or behavior;
- a minimal reproduction using synthetic data;
- the likely impact and any known mitigations;
- a non-sensitive request ID, when relevant.

Never include API keys, access tokens, environment files, customer phone numbers, message contents, raw production requests or responses, webhook secrets, or other customer data. Revoke and replace any credential that may have been exposed.

Waaru will assess the report and coordinate disclosure or remediation as appropriate. Backend, dashboard, account-access, and hosted-service issues should also be reported privately through the authenticated Waaru support channel.
