import { SupersetTheme } from '@superset-ui/core';
import { LegendOrientation, LegendType } from '../types';
import { defaultLegendPadding } from '../defaults';

type EstimateArgs = {
  names: string[];
  orientation: LegendOrientation;
  type: LegendType; // plain | scroll
  show: boolean;
  theme?: SupersetTheme;
  containerWidth: number;
  itemGap?: number;
  symbolWidth?: number;
  maxRows?: number;
};

const approxTextWidth = (text: string, fontSize: number) => {
  const avg = Number.isFinite(fontSize) ? fontSize * 0.58 : 7;
  return Math.ceil(String(text).length * avg);
};

export function estimateLegendRows({
  names,
  orientation,
  type,
  show,
  theme,
  containerWidth,
  itemGap = 8,
  symbolWidth = 12,
  maxRows,
}: EstimateArgs): number {
  if (!show || !names?.length || !containerWidth) return 0;

  const isTopOrBottom =
    orientation === LegendOrientation.Top ||
    orientation === LegendOrientation.Bottom;

  if (!isTopOrBottom || type === LegendType.Scroll) return 1;

  const fontSize =
    (theme as any)?.typography?.sizes?.s ??
    (theme as any)?.typography?.sizes?.m ??
    12;

  let rows = 1;
  let lineWidth = 0;

  for (const label of names) {
    const w = symbolWidth + 4 + approxTextWidth(label, Number(fontSize));
    const need = (lineWidth === 0 ? 0 : itemGap) + w;
    if (lineWidth + need <= containerWidth) {
      lineWidth += need;
    } else {
      rows += 1;
      lineWidth = w;
    }
  }

  if (maxRows && rows > maxRows) rows = maxRows;
  return Math.max(rows, 1);
}

type AutoMarginArgs = {
  rows: number;
  orientation: LegendOrientation;
  type: LegendType;
  perRowStep?: number;
  basePaddingMap?: typeof defaultLegendPadding;
};

/**
 * Plain:   итог = max(rows,1) * (perRowStep || defaultPadding)
 * Scroll:  итог = defaultPadding
 */
export function computeAutoLegendMargin({
  rows,
  orientation,
  type,
  perRowStep,
  basePaddingMap = defaultLegendPadding,
}: AutoMarginArgs): number {
  const base = basePaddingMap[orientation] ?? 0;

  if (type === LegendType.Scroll) {
    return base;
  }

  const step = Number.isFinite(perRowStep as number)
    ? (perRowStep as number)
    : base;

  return Math.max(rows, 1) * step;
}

type FitArgs = {
  names: string[];
  orientation: LegendOrientation; // ожидаем Top/Bottom
  containerWidth: number; // доступная ширина под легенду
  theme?: SupersetTheme;
  itemGap?: number; // расстояние между айтемами
  symbolWidth?: number; // ширина маркера
  maxRows?: number; // максимум строк
  offset?: number; // стартовый оффсет (сколько имён пропустить)
};

export function fitLegendToRows(
  names: string[],
  {
    orientation,
    containerWidth,
    theme,
    itemGap = 8,
    symbolWidth = 12,
    maxRows = 3,
    offset = 0,
  }: FitArgs,
) {
  const isTopOrBottom = orientation === 'top' || orientation === 'bottom';
  if (!isTopOrBottom || !containerWidth || !names?.length) {
    return {
      visible: names.slice(0, Math.max(0, names.length)),
      rowsUsed: 1,
      hiddenCount: 0,
      hasPrev: false,
      hasNext: false,
      prevOffset: 0,
      nextOffset: 0,
      cutIndex: names.length,
    };
  }

  const fontSize =
    (theme as any)?.typography?.sizes?.s ??
    (theme as any)?.typography?.sizes?.m ??
    12;

  let rowsUsed = 1;
  let lineWidth = 0;
  const visible: string[] = [];

  // «сдвигаем» начало
  const start = Math.min(Math.max(0, offset), names.length);
  let i = start;

  // стартовый индекс каждой строки (для вычисления prevOffset)
  const rowStarts: number[] = [start];

  for (; i < names.length; i += 1) {
    const label = names[i];
    const w = symbolWidth + 4 + approxTextWidth(label, Number(fontSize));
    const need = (lineWidth === 0 ? 0 : itemGap) + w;

    if (lineWidth + need <= containerWidth) {
      lineWidth += need;
      visible.push(label);
    } else {
      // новая строка
      rowsUsed += 1;
      if (rowsUsed > maxRows) break;
      lineWidth = w;
      visible.push(label);
      rowStarts.push(i);
    }
  }

  const cutIndex = i; // сколько реально «потребили» с учётом оффсета
  const hasNext = cutIndex < names.length;
  const hasPrev = start > 0;

  // prevOffset — начало предыдущей «страницы» (строк)
  let prevOffset = 0;
  if (hasPrev) {
    // находим начало строки, которая предшествовала текущему start
    // для этого пробежимся заново от 0 до start, считая переносы
    let rows = 1;
    let widthAcc = 0;
    let lastRowStart = 0;

    for (let k = 0; k < start; k += 1) {
      const lb = names[k];
      const w2 = symbolWidth + 4 + approxTextWidth(lb, Number(fontSize));
      const need2 = (widthAcc === 0 ? 0 : itemGap) + w2;

      if (widthAcc + need2 <= containerWidth) {
        widthAcc += need2;
      } else {
        rows += 1;
        widthAcc = w2;
        lastRowStart = k;
        if (rows > (maxRows ?? 3)) {
          // отступаем целиком «страницу» назад
          // начало предыдущей страницы = старт строки, которая начинается за (maxRows) до текущей
          // для простоты — отмотать ровно на maxRows строк (если возможно)
          // найдём старт строки за maxRows до текущей
          let rowsBack = maxRows - 1;
          let seek = lastRowStart;
          widthAcc = 0;
          // идём назад по строкам
          for (let z = seek - 1; z >= 0 && rowsBack > 0; z -= 1) {
            const w3 =
              symbolWidth + 4 + approxTextWidth(names[z], Number(fontSize));
            const need3 = (widthAcc === 0 ? 0 : itemGap) + w3;
            if (widthAcc + need3 <= containerWidth) {
              widthAcc += need3;
            } else {
              rowsBack -= 1;
              seek = z + 1;
              widthAcc = w3;
            }
            if (z === 0) seek = 0;
          }
          prevOffset = seek;
          break;
        }
      }
    }
    if (prevOffset === 0 && start > 0) {
      // если не нашли сложным способом — просто листаем на старт предыдущей строки
      prevOffset = lastRowStart;
    }
  }

  const nextOffset = hasNext ? cutIndex : start;

  const hiddenCount = names.length - visible.length - start;

  return {
    visible,
    rowsUsed,
    hiddenCount: Math.max(0, hiddenCount),
    hasPrev,
    hasNext,
    prevOffset,
    nextOffset,
    cutIndex,
  };
}
