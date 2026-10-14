// Types for method.mjs, the build time data of the Method page.
export type CoverageRow = { year: number; status: 'complete' | 'partial' | 'draft' | 'pending'; medals: number; sources: string[] };

export type MethodValues = {
  first_year: number;
  last_year: number;
  complete_range: string;
  latest_year: number;
  data_year: number | null;
  direct_revenue_per_barrel: string;
  distributed_revenue_per_barrel: string;
  taproom_margin_range: string;
  self_margin_range: string;
  distributor_margin_range: string;
};

export function methodModel(): { coverage: CoverageRow[]; values: MethodValues };
