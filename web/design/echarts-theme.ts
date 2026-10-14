// The chart theme for Apache ECharts, read from Material's custom properties each time a chart draws,
// so a chart redrawn after the settings load picks up the new scheme.

// A distinct mark per series, so color is never the only code. Circles are kept for medals.
export const SERIES_SYMBOLS = ['rect', 'triangle', 'diamond', 'emptyRect', 'emptyTriangle'] as const;

// The five chart series colors from settings.md (Series 1 color to Series 5 color).
export const SERIES_COUNT = 5;
export const seriesVar = (i: number) => `--app-color-series-${(i % SERIES_COUNT) + 1}`;

export function readTheme(el: Element) {
  const css = getComputedStyle(el);
  const v = (name: string) => css.getPropertyValue(name).trim();
  const px = (name: string) => parseFloat(v(name)) * parseFloat(getComputedStyle(document.documentElement).fontSize);
  return {
    series: Array.from({ length: SERIES_COUNT }, (_, i) => v(seriesVar(i))),
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

export function baseOption(el: Element) {
  const t = readTheme(el);
  const axisLabel = { color: t.onSurfaceVariant, fontFamily: t.family, fontSize: t.small };
  return {
    theme: t,
    option: {
      color: t.series,
      backgroundColor: 'transparent',
      animation: false,
      textStyle: { fontFamily: t.family, color: t.onSurface },
      grid: { left: 8, right: 16, top: 16, bottom: 8, containLabel: true },
      xAxis: { type: 'category' as const, axisLine: { lineStyle: { color: t.outline } }, axisTick: { lineStyle: { color: t.outlineVariant } }, axisLabel, splitLine: { show: false } },
      yAxis: { type: 'value' as const, axisLine: { show: false }, axisTick: { show: false }, axisLabel, splitLine: { lineStyle: { color: t.outlineVariant, width: 1 } } },
      tooltip: {
        trigger: 'axis' as const,
        backgroundColor: t.container,
        borderWidth: 0,
        borderRadius: t.radius,
        padding: 8,
        textStyle: { color: t.onContainer, fontFamily: t.family, fontSize: t.medium },
        axisPointer: { type: 'line' as const, lineStyle: { color: t.outline, width: 1 } },
      },
    },
  };
}
