// The chart theme for Apache ECharts, read from Material's custom properties each time a chart draws,
// so a chart redrawn after the settings load picks up the new scheme. chart-presets.ts turns it into
// option defaults.

export { SERIES_SYMBOLS } from './chart-presets';

// The five chart series colors from settings.md (Series 1 color to Series 5 color).
export const SERIES_COUNT = 5;
export const seriesVar = (i: number) => `--app-color-series-${(i % SERIES_COUNT) + 1}`;
// The medal colors from settings.md (Gold, Silver, and Bronze medal color).
export const medalVar = (m: 'gold' | 'silver' | 'bronze') => `--app-color-${m}`;

export function readTheme(el: Element) {
  const css = getComputedStyle(el);
  const v = (name: string) => css.getPropertyValue(name).trim();
  const px = (name: string) => parseFloat(v(name)) * parseFloat(getComputedStyle(document.documentElement).fontSize);
  return {
    series: Array.from({ length: SERIES_COUNT }, (_, i) => v(seriesVar(i))),
    gold: v(medalVar('gold')),
    silver: v(medalVar('silver')),
    bronze: v(medalVar('bronze')),
    surface: v('--md-sys-color-surface'),
    onSurface: v('--md-sys-color-on-surface'),
    onSurfaceVariant: v('--md-sys-color-on-surface-variant'),
    outline: v('--md-sys-color-outline'),
    outlineVariant: v('--md-sys-color-outline-variant'),
    container: v('--md-sys-color-inverse-surface'),
    onContainer: v('--md-sys-color-inverse-on-surface'),
    family: v('--md-sys-typescale-body-small-font') || css.fontFamily,
    small: px('--md-sys-typescale-body-small-size'),
    medium: px('--md-sys-typescale-body-medium-size'),
    radius: parseFloat(v('--md-sys-shape-corner-extra-small')) || 0,
  };
}

export type ChartTheme = ReturnType<typeof readTheme>;
