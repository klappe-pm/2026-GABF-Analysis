// The global filter's rules, shared with the current site: the dimensions, the URL hash and stored state,
// the filtering rule (complete years by default), and the progressive option lists. The Material app
// draws its own controls and reads every visible word from the copy documents; the rules stay in one file.
export {
  FILTERS, NOT_DEFINED, STATE_KEYS, activeChips, applyFilters, hashFor, includesPartial, isDefaultState, optionList, parseHash, pickState,
  pruneState, readStored, resolveState, scopeRows, valueLabel, writeStored,
} from '../../site/assets/filter-bar.mjs';
