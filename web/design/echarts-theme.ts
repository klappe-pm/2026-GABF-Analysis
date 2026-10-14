// The chart theme for Apache ECharts, read from the design tokens at run time so charts follow the
// theme of the element they are drawn in. Square bars, square tooltips, no shadows, rules for gridlines.

const SERIES = ['series-1', 'series-2', 'series-3', 'series-4', 'series-5'];
// A distinct mark per series, so color is never the only code. Circles are kept for medals.
export const SERIES_SYMBOLS = ['rect', 'triangle', 'diamond', 'emptyRect', 'emptyTriangle'] as const;

export function readTokens(el: Element) {
  const css = getComputedStyle(el);
  const v = (name: string) => css.getPropertyValue(`--gabf-color-${name}`).trim();
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
  const size = (name: string) => parseFloat(css.getPropertyValue(`--gabf-font-size-${name}`)) * rem;
  return {
    series: SERIES.map(v),
    gold: v('gold'),
    silver: v('silver'),
    bronze: v('bronze'),
    medalStroke: v('medal-stroke'),
    ink: v('ink'),
    inkMuted: v('ink-muted'),
    rule: v('rule'),
    ruleStrong: v('rule-strong'),
    ground: v('ground'),
    family: css.fontFamily,
    micro: size('micro'),
    data: size('data'),
  };
}

export function baseOption(el: Element) {
  const t = readTokens(el);
  const axisLabel = { color: t.inkMuted, fontFamily: t.family, fontSize: t.micro };
  return {
    tokens: t,
    option: {
      color: t.series,
      backgroundColor: 'transparent',
      animation: false,
      textStyle: { fontFamily: t.family, color: t.ink },
      grid: { left: 8, right: 16, top: 16, bottom: 8, containLabel: true },
      xAxis: { type: 'category' as const, axisLine: { lineStyle: { color: t.ink } }, axisTick: { lineStyle: { color: t.ruleStrong } }, axisLabel, splitLine: { show: false } },
      yAxis: { type: 'value' as const, axisLine: { show: false }, axisTick: { show: false }, axisLabel, splitLine: { lineStyle: { color: t.rule, width: 1 } } },
      tooltip: {
        trigger: 'axis' as const,
        backgroundColor: t.ground,
        borderColor: t.ink,
        borderWidth: 1,
        borderRadius: 0,
        padding: 8,
        textStyle: { color: t.ink, fontFamily: t.family, fontSize: t.data },
        extraCssText: 'box-shadow: none; border-radius: 0;',
        axisPointer: { type: 'line' as const, lineStyle: { color: t.ruleStrong, width: 1 } },
      },
      itemStyle: { borderRadius: 0, shadowBlur: 0 },
    },
  };
}
