// Types for findings.mjs, the written findings of the analysis pages.

export type FindingBlock = { type: 'heading'; text: string } | { type: 'text'; text: string } | { type: 'gap'; missing: string[] };
export type Finding = { name: string; title: string; summary: string; blocks: FindingBlock[] };
export const FINDINGS: { name: string; reports: string[] }[];
export function findings(names?: string[]): Finding[];
export function findingsForReport(slug: string): Finding[];
