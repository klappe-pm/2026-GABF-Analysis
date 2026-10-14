// The design control plane engine lives in the agent-graph repository and is used here read only,
// by import, never copied. AGENT_GRAPH_DIR points at it; the default is the owner's checkout.
// Only the local review and design commands load it, so the public build, the tests, and the
// Pages deploy never need it.

import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const AGENT_GRAPH_DIR = resolve(process.env.AGENT_GRAPH_DIR || resolve(homedir(), 'projects/active/agent-graph'));

export async function engine(script) {
  const file = resolve(AGENT_GRAPH_DIR, 'scripts', script);
  if (!existsSync(file)) {
    throw new Error(`The design control plane engine was not found at ${file}. Clone agent-graph there or set AGENT_GRAPH_DIR to its checkout.`);
  }
  return import(pathToFileURL(file).href);
}
