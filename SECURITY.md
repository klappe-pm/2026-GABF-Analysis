# Security Policy

GABF Analysis is a static site and a set of build scripts. It has no server, no accounts, and no user data, but a vulnerability can still matter: a script that runs an untrusted input, a dependency with a known issue, a workflow that could be abused, or a secret that should not be in the repository.

## Supported Versions

Only the `main` branch and the site published from it at https://klappe-pm.github.io/GABF-Analysis/ are supported.

## Reporting Vulnerabilities

Please don't open a public issue with details of a vulnerability.

1. Preferred: report it privately through GitHub at https://github.com/klappe-pm/GABF-Analysis/security/, open a short public issue titled "Security contact request" with no details, and the maintainer will arrange a private channel.

Include what you found, where (file, workflow, or page), how to reproduce it, and the impact you expect. This project is maintained on a best effort basis; reports are acknowledged and confirmed issues are fixed as quickly as practical.

## No Secrets Policy

- No credential, token, or private key is ever committed. Environment files (`.env`, `.env.*`) and `settings.local.json` are ignored by git; a `.env.example` with placeholder values is the only allowed form.
- Workflows use only the built in `GITHUB_TOKEN`, with explicitly declared permissions; the site build needs no other secret.
- If you find a secret in this repository or its history, report it privately as above. It will be treated as exposed: rotated first, then removed from history.
