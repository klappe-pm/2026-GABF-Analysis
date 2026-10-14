# Security Policy

GABF Analysis is a static site and a set of build scripts. It has no server, no accounts, and no user data, but a vulnerability can still matter: a script that runs untrusted input, a dependency with a known issue, a workflow that could be abused, or a secret that should not be in the repository.

## Supported versions

Only the `main` branch and the site published from it at https://klappe-pm.github.io/GABF-Analysis/ are supported.

## Reporting a vulnerability

Please do not open a public issue with details of a vulnerability.

1. Preferred: report it privately through GitHub at https://github.com/klappe-pm/GABF-Analysis/security/advisories/new.
2. If that page is not available, open a short public issue titled "Security contact request" with no details, and the maintainer will arrange a private channel.

Include what you found, where (file, workflow, or page), how to reproduce it, and the impact you expect. You can expect an acknowledgement within a week and a fix or a decision within thirty days for confirmed issues.

## No secrets policy

- No credential, token, or private key is ever committed. Environment files, local settings, and credentials are ignored by git, and placeholder examples are the only allowed form.
- Workflows use the built in `GITHUB_TOKEN` with the narrowest permissions they need; the site build needs no secret at all.
- If you find a secret in this repository or its history, report it privately as above. It will be treated as exposed: rotated first, then removed from history.
