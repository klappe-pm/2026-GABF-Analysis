## Summary

What changed and why, in a few lines. Link any issue this closes.

## Data changes

If this touches data, name the source for each changed value. Leave blank otherwise.

## Verification

- [ ] `npm run web:build` then `npm run verify` pass locally (prose and brand checks, single file builds, tests, validation, design checks)
- [ ] Auto-merge is on (`gh pr merge <number> --auto --merge`); the single file pages are build outputs and are not committed
- [ ] Generated files (web/out, data/enriched/) were rebuilt, not hand edited
- [ ] Every new estimate is marked (E) and traceable to a reference file or profile
- [ ] No dash used as punctuation, and one physical line per markdown paragraph
- [ ] No secrets, tokens, or credentials in the diff
