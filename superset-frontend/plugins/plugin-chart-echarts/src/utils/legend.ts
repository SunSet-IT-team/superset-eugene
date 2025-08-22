import { LegendComponentOption } from 'echarts';
import { SupersetTheme, LegendState } from '@superset-ui/core';
import { LegendOrientation, LegendType } from '../types';
import { getLegendProps } from './series';

// Разбивает legend.data на 3 "строки"
export function build3RowLegend(
  keys: string[],
  base: LegendComponentOption,
  orientation: LegendOrientation,
): LegendComponentOption[] {
  const rowH = 22;
  const gap = 6;
  const rows = 3;
  const perRow = Math.ceil(keys.length / rows);

  return new Array(rows).fill(null).map((_, i) => {
    const data = keys.slice(i * perRow, (i + 1) * perRow);

    const pos: Partial<LegendComponentOption> =
      orientation === LegendOrientation.Top
        ? { top: i * (rowH + gap), left: 'center' }
        : orientation === LegendOrientation.Bottom
          ? { bottom: i * (rowH + gap), left: 'center' }
          : orientation === LegendOrientation.Left
            ? { left: 0, top: i * (rowH + gap) }
            : { right: 0, top: i * (rowH + gap) };

    return {
      ...base,
      type: 'scroll',
      orient: 'horizontal',
      height: rowH,
      itemHeight: rowH,
      itemGap: 8,
      data,
      ...pos,
    };
  });
}

/**
 * Единая точка сборки legend для всех чартов.
 * Возвращает либо один объект легенды, либо массив из 3-х для режима Limited3.
 */
export function legendOptionFor(
  keys: string[],
  legendType: LegendType,
  legendOrientation: LegendOrientation,
  showLegend: boolean,
  theme: SupersetTheme,
  zoomable = false,
  legendState?: LegendState,
): LegendComponentOption | LegendComponentOption[] {
  const echartsType =
    legendType === (LegendType as any).Limited3
      ? LegendType.Scroll
      : legendType;

  const base = getLegendProps(
    echartsType,
    legendOrientation,
    showLegend,
    theme,
    zoomable,
    legendState,
  ) as LegendComponentOption;

  if (!showLegend) return base;

  // Для 3 строк возвращаем массив из трёх легенд, иначеобычную легенду с data
  return legendType === (LegendType as any).Limited3
    ? build3RowLegend(keys, base, legendOrientation)
    : { ...base, data: keys };
}
