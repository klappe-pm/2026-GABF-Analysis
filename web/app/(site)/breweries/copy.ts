// Copy the breweries pages share, read from the copy documents on the server and handed to the client views.
import { group } from '@/lib/content';
import type { EstimateCopy } from './estimate-text';

export function estimateCopy(): EstimateCopy {
  const templates = group('pages.brewery-detail.estimates');
  return {
    templates,
    basis: group('global.labels.estimate_basis'),
    confidence: group('global.labels.confidence'),
    types: group('global.labels.brewery_type'),
    channels: group('global.labels.distribution_channel'),
    yesNo: group('global.labels.yes_no'),
    notDefined: group('global.states.gaps').not_defined,
    metrics: {
      barrels: templates.metric_barrels,
      arr: templates.metric_arr,
      gross_margin: templates.metric_gross_margin,
      ebitda: templates.metric_ebitda,
      per_barrel: templates.metric_per_barrel,
      per_location: templates.metric_per_location,
      per_employee: templates.metric_per_employee,
    },
  };
}
