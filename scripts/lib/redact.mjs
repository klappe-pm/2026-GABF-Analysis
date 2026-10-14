// Token-shaped value scan for captured content (captured-content-redaction).
// Every page, response or text a scraper captures passes through redact() before it is cached or
// written to a profile. A match is replaced with [REDACTED:<kind>]. The shapes mirror the detector
// the owner's configuration defines (cloud and API key prefixes, JWTs, PEM blocks, bearer tokens and
// quoted key/token/secret/password assignments).

const SHAPES = [
  ['private_key_block', /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|$)/gi],
  ['aws_access_key', /AKIA[0-9A-Z]{16}/g],
  ['github_fine_grained_pat', /github_pat_[A-Za-z0-9_]{20,}/g],
  ['github_token', /gh[pousr]_[A-Za-z0-9]{20,}/g],
  ['slack_token', /xox[baprs]-[A-Za-z0-9-]{10,}/g],
  ['sk_style_key', /\bsk-[A-Za-z0-9_-]{20,}/g],
  ['google_api_key', /AIza[0-9A-Za-z_-]{20,}/g],
  ['jwt', /eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}/g],
  ['bearer_token', /Bearer\s+[A-Za-z0-9._~+/=-]{20,}/gi],
  ['generic_assignment', /[A-Za-z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD)[A-Za-z0-9_]*\s*[=:]\s*(?:['"][A-Za-z0-9_./+=-]{16,}['"])/gi],
];

export function redact(text) {
  let out = String(text ?? '');
  const kinds = [];
  for (const [kind, re] of SHAPES) {
    re.lastIndex = 0;
    out = out.replace(re, () => { kinds.push(kind); return `[REDACTED:${kind}]`; });
  }
  return { text: out, kinds };
}

export const hasTokenShape = (text) => redact(text).kinds.length > 0;
