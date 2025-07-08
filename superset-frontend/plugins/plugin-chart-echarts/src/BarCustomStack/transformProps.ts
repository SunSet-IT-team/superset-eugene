/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
/* eslint-disable camelcase */
import {
  extractExtraMetrics,
  getOriginalSeries,
  getTimeOffset,
  isDerivedSeries,
  SortSeriesType,
} from '@superset-ui/chart-controls';
import {
  AdhocColumn,
  AnnotationLayer,
  AxisType,
  buildCustomFormatters,
  CategoricalColorNamespace,
  CurrencyFormatter,
  ensureIsArray,
  findInCols,
  formatFulldesc,
  GenericDataType,
  getCustomFormatter,
  getMetricLabel,
  getNumberFormatter,
  getXAxisCategoryFormatter,
  getXAxisLabel,
  isDefined,
  isEventAnnotationLayer,
  isFormulaAnnotationLayer,
  isIntervalAnnotationLayer,
  isPhysicalColumn,
  isTimeseriesAnnotationLayer,
  sortByOrder,
  sortBySelector,
  t,
  TimeseriesChartDataResponseResult,
} from '@superset-ui/core';
import { EChartsCoreOption, SeriesOption } from 'echarts';
import { LineStyleOption } from 'echarts/types/src/util/types';
import { invert } from 'lodash';
import {
  StackControlsValue,
  TIMEGRAIN_TO_TIMESTAMP,
  TIMESERIES_CONSTANTS,
} from '../constants';
import { defaultGrid, defaultYAxis } from '../defaults';
import { ForecastSeriesEnum, ForecastValue, Refs } from '../types';
import {
  extractAnnotationLabels,
  getAnnotationData,
} from '../utils/annotation';
import { parseAxisBound } from '../utils/controls';
import { convertInteger } from '../utils/convertInteger';
import {
  extractForecastSeriesContext,
  extractForecastSeriesContexts,
  extractForecastValuesFromTooltipParams,
  formatForecastTooltipSeries,
  rebaseForecastDatum,
} from '../utils/forecast';
import {
  getPercentFormatter,
  getTooltipTimeFormatter,
  getXAxisFormatter,
  getYAxisFormatter,
} from '../utils/formatters';
import {
  calculateLowerLogTick,
  dedupSeries,
  extractDataTotalValues,
  extractSeries,
  extractShowValueIndexes,
  getAdvancedLegendProps,
  getAxisType,
  getColtypesMapping,
  getMinAndMaxFromBounds,
} from '../utils/series';
import { getDefaultTooltip } from '../utils/tooltip';
import { DEFAULT_FORM_DATA } from './constants';
import {
  getBaselineSeriesForStream,
  getPadding,
  transformEventAnnotation,
  transformFormulaAnnotation,
  transformIntervalAnnotation,
  transformSeries,
  transformTimeseriesAnnotation,
} from '../Timeseries/transformers';
import {
  EchartsTimeseriesChartProps,
  EchartsTimeseriesFormData,
  OrientationType,
  TimeseriesChartTransformedProps,
} from '../types';

const rightSideRemoveSeaprator = '|<--|';

export default function transformProps(
  chartProps: EchartsTimeseriesChartProps,
): TimeseriesChartTransformedProps {
  const {
    width,
    height,
    filterState,
    legendState,
    formData,
    hooks,
    queriesData,
    datasource,
    theme,
    inContextMenu,
    emitCrossFilters,
    selectedSelectors = {
      selectedMarkets: [],
      selectedProducts: [],
    },
  } = chartProps;

  let focusedSeries: string | null = null;

  const {
    verboseMap = {},
    columnFormats = {},
    currencyFormats = {},
  } = datasource;
  const [queryData] = queriesData;
  const { data = [], label_map = {} } =
    queryData as TimeseriesChartDataResponseResult;

  const dataTypes = getColtypesMapping(queryData);
  const annotationData = getAnnotationData(chartProps);

  const {
    area,
    annotationLayers,
    colorScheme,
    contributionMode,
    forecastEnabled,
    groupby,
    showFullXaxis: showXaxis,
    showYaxis,
    legendOrientation,
    legendType,
    legendFontSize = 12,
    legendMargin,
    logAxis,
    markerEnabled,
    markerSize,
    metrics,
    minorSplitLine,
    minorTicks,
    onlyTotal,
    opacity,
    orientation,
    percentageThreshold,
    richTooltip,
    seriesType,
    showLegend,
    showValue,
    sliceId,
    sortSeriesType,
    sortSeriesAscending,
    sortSubSeriesAscending,
    timeGrainSqla,
    timeCompare,
    stack,
    tooltipTimeFormat,
    tooltipSortByMetric,
    truncateXAxis,
    truncateYAxis,
    xAxis: xAxisOrig,
    xAxisBounds,
    xAxisForceCategorical,
    xAxisLabelRotation,
    xAxisSort,
    xAxisSortAsc,
    xAxisSortSeries,
    xAxisSortSeriesAscending,
    xAxisTimeFormat,
    xAxisTitle,
    xAxisTitleMargin,
    yAxisBounds,
    yAxisFormat,
    currencyFormat,
    yAxisTitle,
    yAxisTitleMargin,
    yAxisTitlePosition,
    zoomable,
    stackByDimension,
    showPercent,
    stackDimension,
    stackDimensionSubstitute,
    dimensionSubstitute,
  }: EchartsTimeseriesFormData = { ...DEFAULT_FORM_DATA, ...formData };
  const refs: Refs = {};

  const { chartLevel } = formData.customizeOptions?.lastNOptions || {
    chartLevel: undefined,
  };

  const substituteColumn =
    typeof formData.xAxisSubstitute === 'string'
      ? formData.xAxisSubstitute
      : undefined;

  const groupBy = ensureIsArray(groupby);
  const labelMap = Object.entries(label_map).reduce((acc, entry) => {
    if (
      entry[1].length > groupBy.length &&
      Array.isArray(timeCompare) &&
      timeCompare.includes(entry[1][0])
    ) {
      entry[1].shift();
    }
    return { ...acc, [entry[0]]: entry[1] };
  }, {});
  const colorScale = CategoricalColorNamespace.getScale(colorScheme as string);
  const rebasedData = rebaseForecastDatum(data, verboseMap);
  let xAxisLabel = getXAxisLabel(chartProps.rawFormData) as string;
  const yAxisLabel = String(formData.groupby?.[0]);
  if (
    isPhysicalColumn(chartProps.rawFormData?.x_axis) &&
    isDefined(verboseMap[xAxisLabel])
  ) {
    xAxisLabel = verboseMap[xAxisLabel];
  }
  const isHorizontal = orientation === OrientationType.Horizontal;
  const { totalStackedValues, thresholdValues } = extractDataTotalValues(
    rebasedData,
    {
      stack,
      percentageThreshold,
      xAxisCol: xAxisLabel,
      legendState,
    },
  );
  const extraMetricLabels = extractExtraMetrics(chartProps.rawFormData).map(
    getMetricLabel,
  );

  const isMultiSeries = groupBy.length || metrics?.length > 1;

  const selectorsMap = {
    prod_name: selectedSelectors ? selectedSelectors.selectedProducts : [],
    mkt_name: selectedSelectors ? selectedSelectors.selectedMarkets : [],
  };

  const getKeyLabel = (key: string | AdhocColumn) => {
    if (typeof key === 'string') {
      return key;
    }
    if ('label' in key && typeof key.label === 'string') {
      return key.label;
    }
    return null;
  };

  const getSelectedSelectors = (key: string | AdhocColumn) => {
    const label = getKeyLabel(key);
    return label ? selectorsMap[label] : [];
  };

  const getSelectedSelectorsByXAxis = () => getSelectedSelectors(xAxisLabel);

  const getSelectedSelectorsByGroup = () => {
    const key = groupBy.find(k => {
      const label = getKeyLabel(k);
      return label ? selectorsMap[label] : [];
    });
    return key ? getSelectedSelectors(key) : [];
  };

  const [rawSeries, sortedTotalValues, minPositiveValue] = extractSeries(
    rebasedData,
    {
      fillNeighborValue: stack && !forecastEnabled ? 0 : undefined,
      xAxis: substituteColumn ? substituteColumn : xAxisLabel,
      yAxis: yAxisLabel,
      extraMetricLabels,
      stack,
      totalStackedValues,
      isHorizontal,
      xAxisSort,
      xAxisSortAsc: isMultiSeries ? undefined : xAxisSortAsc,
      sortSeriesType,
      sortSeriesAscending,
      xAxisSortSeries: isMultiSeries ? xAxisSortSeries : undefined,
      xAxisSortSeriesAscending: isMultiSeries
        ? xAxisSortSeriesAscending
        : undefined,
    },
    getSelectedSelectorsByXAxis(),
    getSelectedSelectorsByGroup(),
  );

  const showValueIndexes = extractShowValueIndexes(rawSeries, {
    stack,
    onlyTotal,
    isHorizontal,
    legendState,
  });
  const seriesContexts = extractForecastSeriesContexts(
    Object.values(rawSeries).map(series => series.name as string),
  );
  const isAreaExpand = stack === StackControlsValue.Expand;
  const xAxisDataType = dataTypes?.[xAxisLabel] ?? dataTypes?.[xAxisOrig];

  const xAxisType = getAxisType(stack, xAxisForceCategorical, xAxisDataType);
  const series: SeriesOption[] = [];

  const forcePercentFormatter = Boolean(contributionMode || isAreaExpand);
  const percentFormatter = getPercentFormatter(yAxisFormat);
  const defaultFormatter = currencyFormat?.symbol
    ? new CurrencyFormatter({ d3Format: yAxisFormat, currency: currencyFormat })
    : getNumberFormatter(yAxisFormat);
  const customFormatters = buildCustomFormatters(
    metrics,
    currencyFormats,
    columnFormats,
    yAxisFormat,
    currencyFormat,
  );

  const array = ensureIsArray(chartProps.rawFormData?.time_compare);
  const inverted = invert(verboseMap);

  const offsetLineWidths = {};

  rawSeries.forEach(entry => {
    const derivedSeries = isDerivedSeries(entry, chartProps.rawFormData);
    const lineStyle: LineStyleOption = {};
    if (derivedSeries) {
      const offset = getTimeOffset(
        entry,
        ensureIsArray(chartProps.rawFormData?.time_compare),
      )!;
      if (!offsetLineWidths[offset]) {
        offsetLineWidths[offset] = Object.keys(offsetLineWidths).length + 1;
      }
      lineStyle.type = 'dashed';
      lineStyle.width = offsetLineWidths[offset];
    }

    const entryName = String(entry.name || '');
    const seriesName = inverted[entryName] || entryName;
    const colorScaleKey = getOriginalSeries(seriesName, array);

    const transformedSeries = transformSeries(
      entry,
      colorScale,
      colorScaleKey,
      {
        area,
        connectNulls: derivedSeries,
        filterState,
        seriesContexts,
        markerEnabled,
        markerSize,
        areaOpacity: opacity,
        seriesType,
        legendState,
        stack,
        formatter: forcePercentFormatter
          ? percentFormatter
          : getCustomFormatter(
              customFormatters,
              metrics,
              labelMap?.[seriesName]?.[0],
            ) ?? defaultFormatter,
        showValue,
        onlyTotal,
        totalStackedValues: sortedTotalValues,
        showValueIndexes,
        thresholdValues,
        richTooltip,
        sliceId,
        isHorizontal,
        lineStyle,
      },
    );

    if (transformedSeries) {
      if (stack === StackControlsValue.Stream) {
        // bug in Echarts - `stackStrategy: 'all'` doesn't work with nulls, so we cast them to 0
        series.push({
          ...transformedSeries,
          data: (transformedSeries.data as any).map(
            (row: [string | number, number]) => [row[0], row[1] ?? 0],
          ),
        });
      } else {
        series.push(transformedSeries);
      }
    }
  });

  if (stack === StackControlsValue.Stream) {
    const baselineSeries = getBaselineSeriesForStream(
      series.map(entry => entry.data) as [string | number, number][][],
      seriesType,
    );

    series.unshift(baselineSeries);
  }
  const selectedValues = (filterState.selectedValues || []).reduce(
    (acc: Record<string, number>, selectedValue: string) => {
      const index = series.findIndex(({ name }) => name === selectedValue);
      return {
        ...acc,
        [index]: selectedValue,
      };
    },
    {},
  );

  annotationLayers
    .filter((layer: AnnotationLayer) => layer.show)
    .forEach((layer: AnnotationLayer) => {
      if (isFormulaAnnotationLayer(layer))
        series.push(
          transformFormulaAnnotation(
            layer,
            data,
            xAxisLabel,
            xAxisType,
            colorScale,
            sliceId,
          ),
        );
      else if (isIntervalAnnotationLayer(layer)) {
        series.push(
          ...transformIntervalAnnotation(
            layer,
            data,
            annotationData,
            colorScale,
            theme,
            sliceId,
          ),
        );
      } else if (isEventAnnotationLayer(layer)) {
        series.push(
          ...transformEventAnnotation(
            layer,
            data,
            annotationData,
            colorScale,
            theme,
            sliceId,
          ),
        );
      } else if (isTimeseriesAnnotationLayer(layer)) {
        series.push(
          ...transformTimeseriesAnnotation(
            layer,
            markerSize,
            data,
            annotationData,
            colorScale,
            sliceId,
          ),
        );
      }
    });

  // axis bounds need to be parsed to replace incompatible values with undefined
  const [xAxisMin, xAxisMax] = (xAxisBounds || []).map(parseAxisBound);
  let [yAxisMin, yAxisMax] = (yAxisBounds || []).map(parseAxisBound);

  // default to 0-100% range when doing row-level contribution chart
  if ((contributionMode === 'row' || isAreaExpand) && stack) {
    if (yAxisMin === undefined) yAxisMin = 0;
    if (yAxisMax === undefined) yAxisMax = 1;
  } else if (
    logAxis &&
    yAxisMin === undefined &&
    minPositiveValue !== undefined
  ) {
    yAxisMin = calculateLowerLogTick(minPositiveValue);
  }

  const tooltipFormatter =
    xAxisDataType === GenericDataType.Temporal
      ? getTooltipTimeFormatter(tooltipTimeFormat)
      : getXAxisCategoryFormatter(true, chartLevel);
  const xAxisFormatter =
    xAxisDataType === GenericDataType.Temporal
      ? getXAxisFormatter(xAxisTimeFormat)
      : getXAxisCategoryFormatter(true, chartLevel);

  const formattedValue = value => {
    const result = xAxisFormatter?.(value);
    if (typeof result === 'string') {
      return result.length > 80 ? `${result.slice(0, 80)}...` : result;
    }
    return result;
  };

  const {
    setDataMask = () => {},
    setControlValue = () => {},
    onContextMenu,
    onLegendStateChanged,
  } = hooks;

  const addYAxisLabelOffset = !!yAxisTitle;
  const addXAxisLabelOffset = !!xAxisTitle;
  const padding = getPadding(
    showLegend,
    legendOrientation,
    addYAxisLabelOffset,
    zoomable,
    legendMargin,
    addXAxisLabelOffset,
    yAxisTitlePosition,
    convertInteger(yAxisTitleMargin),
    convertInteger(xAxisTitleMargin),
    isHorizontal,
  );

  const legendData = rawSeries
    .filter(
      entry =>
        extractForecastSeriesContext(entry.name || '').type ===
        ForecastSeriesEnum.Observation,
    )
    .map(entry => entry.name || '')
    .concat(extractAnnotationLabels(annotationLayers, annotationData));

  const xAxisData = substituteColumn
    ? series[0]?.data?.map(r => (isHorizontal ? r[1] : r[0]))
    : undefined;

  let xAxis: any = {
    show: showXaxis,
    data: xAxisData,
    type: xAxisType,
    name: xAxisTitle,
    nameGap: convertInteger(xAxisTitleMargin),
    nameLocation: 'middle',
    axisLabel: {
      hideOverlap: true,
      formatter: formattedValue,
      rotate: xAxisLabelRotation,
    },
    minorTick: { show: minorTicks },
    minInterval:
      xAxisType === AxisType.Time && timeGrainSqla
        ? TIMEGRAIN_TO_TIMESTAMP[timeGrainSqla]
        : 0,
    ...getMinAndMaxFromBounds(
      xAxisType,
      truncateXAxis,
      xAxisMin,
      xAxisMax,
      seriesType,
    ),
  };

  let yAxis: any = {
    show: showYaxis,
    ...defaultYAxis,
    type: logAxis ? AxisType.Log : AxisType.Value,
    min: showPercent ? 0 : yAxisMin,
    max: showPercent ? 100 : yAxisMax,
    minorTick: { show: minorTicks },
    minorSplitLine: { show: minorSplitLine },
    axisLabel: {
      formatter: showPercent
        ? v => `${v} %`
        : getYAxisFormatter(
            metrics,
            forcePercentFormatter,
            customFormatters,
            defaultFormatter,
            yAxisFormat,
          ),
    },
    scale: truncateYAxis,
    name: yAxisTitle,
    nameGap: convertInteger(yAxisTitleMargin),
    nameLocation: yAxisTitlePosition === 'Left' ? 'middle' : 'end',
  };

  if (isHorizontal) {
    [xAxis, yAxis] = [yAxis, xAxis];
    [padding.bottom, padding.left] = [padding.left, padding.bottom];
  }

  const useGroup =
    stackByDimension &&
    stackDimension &&
    chartProps.rawFormData.groupby &&
    [2, 3, 4].includes(chartProps.rawFormData.groupby?.length);

  //вспомогательная функция для формирования разбитых по осям Х данных
  const formSeriesData = (
    rawDataInfo: {
      x: string;
      dim: string;
    }[],
    serNames: any[],
  ) =>
    serNames.map((ser, serIdx) => {
      const isSerArray = Array.isArray(ser);

      return {
        id: isSerArray
          ? ser.join(rightSideRemoveSeaprator) +
            rightSideRemoveSeaprator +
            serIdx
          : ser + rightSideRemoveSeaprator + serIdx,
        name: isSerArray ? ser.join(rightSideRemoveSeaprator) : ser,
        type: 'bar',
        label: {
          show: showValue,
          formatter: v => {
            const value = v.value?.[1];

            if (typeof value == 'number') {
              if (value === 0) return '';

              return !showPercent ? value.toFixed(1) : `${value.toFixed(1)} %`;
            }
            return v.value;
          },
        },
        stack: 'one',
        data: rawDataInfo.map((info, order) => {
          let dataRecord = {};

          if (substituteColumn) {
            const index = order % data.length;

            dataRecord = data[index] || {};
          } else {
            dataRecord =
              data.find(
                r =>
                  r[substituteColumn ? substituteColumn : xAxisOrig] === info.x,
              ) || {};
          }

          const key =
            Object.keys(dataRecord).filter(key => {
              //TODO fix
              const subs = info.dim.split(rightSideRemoveSeaprator);
              const sers = isSerArray ? ser : [ser];

              return [...sers, ...subs].every(s => key.includes(s));
            }) || '';

          let v = key.length
            ? key.length === 1
              ? dataRecord[key]
              : key.reduce((pv, cv) => pv + (dataRecord[cv] || 0), 0)
            : undefined;

          return [order, v];
        }),
      };
    });

  //вспомогательная функция сортировки тиков оси Х
  const formXAxisOrder = (
    xAxisUnsorted: string[],
    series: {
      id: any;
      name: any;
      type: string;
      label: {
        show: boolean;
        formatter: (v: any) => any;
      };
      stack: string;
      data: any[][];
    }[],
    unsortedRawDataInfo: {
      x: string;
      dim: any;
    }[],
  ) => {
    if (xAxisSortSeries === 'max') {
      return xAxisUnsorted
        .map(tick => {
          const tickIndexes: number[] = [];

          unsortedRawDataInfo.map(
            (el, i) => el.dim === tick && tickIndexes.push(i),
          );

          const value = Math.max(
            ...series
              .map(s =>
                s.data
                  .filter((_, ind) => tickIndexes.includes(ind))
                  .map(r => r[1]),
              )
              .flat(),
          );

          return {
            name: tick,
            value,
          };
        })
        .sort((a, b) => a.value - b.value)
        .map(e => e.name);
    }
    if (xAxisSortSeries === 'min') {
      return xAxisUnsorted
        .map(tick => {
          const tickIndexes: number[] = [];

          unsortedRawDataInfo.map(
            (el, i) => el.dim === tick && tickIndexes.push(i),
          );

          const value = Math.min(
            ...series
              .map(s =>
                s.data
                  .filter((_, ind) => tickIndexes.includes(ind))
                  .map(r => r[1]),
              )
              .flat(),
          );

          return {
            name: tick,
            value,
          };
        })
        .sort((a, b) => b.value - a.value)
        .map(e => e.name);
    }
    if (xAxisSortSeries === 'sum') {
      return xAxisUnsorted
        .map(tick => {
          const tickIndexes: number[] = [];

          unsortedRawDataInfo.map(
            (el, i) => el.dim === tick && tickIndexes.push(i),
          );

          const value = series
            .map(s =>
              s.data
                .filter((_, ind) => tickIndexes.includes(ind))
                .map(r => r[1])
                .reduce((pv, cv) => pv + cv, 0),
            )
            .reduce((pv, cv) => pv + cv, 0);

          return {
            name: tick,
            value,
          };
        })
        .sort((a, b) => a.value - b.value)
        .map(e => e.name);
    }
    if (xAxisSortSeries === 'avg') {
      return xAxisUnsorted
        .map(tick => {
          const tickIndexes: number[] = [];

          unsortedRawDataInfo.map(
            (el, i) => el.dim === tick && tickIndexes.push(i),
          );

          const value =
            series
              .map(s =>
                s.data
                  .filter((_, ind) => tickIndexes.includes(ind))
                  .map(r => r[1])
                  .reduce((pv, cv) => pv + cv, 0),
              )
              .reduce((pv, cv) => pv + cv, 0) / tickIndexes.length;

          return {
            name: tick,
            value,
          };
        })
        .sort((a, b) => a.value - b.value)
        .map(e => e.name);
    }
    if (xAxisSortSeries === 'name') {
      const res = findInCols(
        xAxisUnsorted.map(s => ({
          name: s,
          copyName: formatFulldesc(s.name, { type: 'short' }),
        })),
        selectorsMap,
      ).map(s => s?.name);

      return res;

      // return sortBySelector(xAxisUnsorted, selectorsMap);
    }

    return xAxisUnsorted;
  };

  const formSeries = (series?: SeriesOption[]) => {
    if (useGroup) {
      const groupBy = chartProps.rawFormData.groupby || [];

      const idxSelectedDimension = +groupBy.indexOf(stackDimension);
      const idxStackDimensionSubstitute = +groupBy.indexOf(
        stackDimensionSubstitute,
      );
      const idxDimensionSubstitute = +groupBy.indexOf(dimensionSubstitute);
      const idxNotSelectedDimension = +groupBy.indexOf(
        groupBy?.filter(
          (el, i) =>
            ![
              idxSelectedDimension,
              idxDimensionSubstitute,
              idxStackDimensionSubstitute,
            ].includes(i),
        )[0],
      );

      const idx = [];

      // eslint-disable-next-line no-restricted-syntax
      for (const s of series) {
        if (s.id) {
          const columnsArr = labelMap[s.id];
          idx.push({
            id: s.id,
            key: columnsArr[idxSelectedDimension],
            stackDimSub: columnsArr[idxStackDimensionSubstitute],
            dimSub: columnsArr[idxDimensionSubstitute],
          });
        }
      }

      const serNames = [
        ...new Set(
          series
            ?.map(s => {
              if (s.id) {
                const columnsArr = labelMap[s.id];

                const hasSubCol = idxDimensionSubstitute !== -1;

                return hasSubCol
                  ? [
                      columnsArr[idxNotSelectedDimension],
                      columnsArr[idxDimensionSubstitute],
                    ]
                  : columnsArr[idxNotSelectedDimension];
              }
              return '';
            })
            .map(e => JSON.stringify(e)),
        ),
      ].map(e => JSON.parse(e));

      const unsortedNewSeriesDim = [
        ...new Set(
          idx.map(i =>
            stackDimensionSubstitute
              ? `${i.key}${rightSideRemoveSeaprator}${i.stackDimSub}`
              : i.key,
          ),
        ),
      ].sort((a, b) => +a - +b);

      const labels = sortBySelector(
        data.map(d => d[substituteColumn ? substituteColumn : xAxisOrig]),
        selectorsMap,
      );
      const xAxisLabels = sortSubSeriesAscending ? labels : labels.reverse();

      const unsortedRawDataInfo = unsortedNewSeriesDim
        .map(s => xAxisLabels.map(x => ({ x: x, dim: s })))
        .flat();

      const xAxisOrder = xAxisSortSeriesAscending
        ? formXAxisOrder(
            unsortedNewSeriesDim,
            formSeriesData(unsortedRawDataInfo, serNames),
            unsortedRawDataInfo,
          )
        : formXAxisOrder(
            unsortedNewSeriesDim,
            formSeriesData(unsortedRawDataInfo, serNames),
            unsortedRawDataInfo,
          ).reverse();

      const newSeriesDim = xAxisOrder;

      const newXAxis = [
        {
          show: showXaxis,
          nameLocation: 'middle',
          type: 'category',
          axisLabel: {
            hideOverlap: true,
            formatter: formattedValue,
            rotate: xAxisLabelRotation,
          },

          data: newSeriesDim.map(s => xAxisLabels).flat(),
        },
        {
          show: showXaxis,
          position: 'bottom',
          offset: 30,
          type: 'category',
          axisLabel: {
            hideOverlap: true,
            formatter: formattedValue,
            rotate: xAxisLabelRotation,
          },
          axisLine: {
            show: false,
          },
          axisTick: {
            show: false,
          },
          data: newSeriesDim,
        },
      ];

      const rawDataInfo = newSeriesDim
        .map(s => xAxisLabels.map(x => ({ x: x, dim: s })))
        .flat();

      const unsortedSeries = formSeriesData(rawDataInfo, serNames);

      const seriesOrder = () => {
        // console.log('series order', sortSeriesType);

        if (sortSeriesType === 'max') {
          return unsortedSeries
            .map(s => ({
              name: s.name,
              value: Math.max(...s.data.map(d => d[1])),
            }))
            .sort((a, b) => a.value - b.value)
            .map(s => s.name);
        }
        if (sortSeriesType === 'min') {
          return unsortedSeries
            .map(s => ({
              name: s.name,
              value: Math.min(...s.data.map(d => d[1])),
            }))
            .sort((a, b) => b.value - a.value)
            .map(s => s.name);
        }
        if (sortSeriesType === 'sum') {
          return unsortedSeries
            .map(s => ({
              name: s.name,
              value: s.data.reduce((pv, cv) => pv + cv[1], 0),
            }))
            .sort((a, b) => a.value - b.value)
            .map(s => s.name);
        }
        if (sortSeriesType === 'avg') {
          return unsortedSeries
            .map(s => ({
              name: s.name,
              value: s.data.reduce((pv, cv) => pv + cv[1], 0) / s.data.length,
            }))
            .sort((a, b) => a.value - b.value)
            .map(s => s.name);
        }
        if (sortSeriesType === 'name') {
          const res = findInCols(
            unsortedSeries.map(s => ({
              ...s,
              copyName: formatFulldesc(s.name, { type: 'short' }),
            })),
            selectorsMap,
          ).map(s => s?.name);

          // return sortBySelector(
          //   unsortedSeries.map(s => s.name),
          //   selectorsMap,
          // );
          return res;
          // .reverse();
        }

        return unsortedSeries.map(s => s.name);
      };

      const seriesOrders = sortSeriesAscending
        ? seriesOrder()
        : seriesOrder().reverse();

      // console.log('final series order', seriesOrders);

      const newSeries = unsortedSeries
        .map(s => ({ ...s, order: seriesOrders.indexOf(s.name) }))
        .sort((a, b) => a.order - b.order);

      if (showPercent) {
        const percentedSeries = newSeries.map(ser => ({
          ...ser,
          data: ser.data.map((record, recordIndex) => {
            const value = record[1];
            const sum = newSeries.reduce((pv, cv) => {
              return pv + (cv.data[recordIndex][1] || 0);
            }, 0);

            if (typeof sum === 'number') {
              return [record[0], (value / sum) * 100];
            }

            return [record[0], 0];
          }),
        }));

        return {
          series: percentedSeries,
          xAxis: newXAxis,
          dataMap: rawDataInfo,
        };
      }

      return {
        series: newSeries,
        xAxis: newXAxis,
        dataMap: rawDataInfo,
      };
    }
    return { series, xAxis, dataMap: undefined };
  };

  const { xAxis: newXaxis, series: newSeries, dataMap } = formSeries(series);

  const echartOptions: EChartsCoreOption = {
    useUTC: true,
    grid: {
      ...defaultGrid,
      ...padding,
    },
    xAxis: newXaxis,
    yAxis,
    tooltip: {
      ...getDefaultTooltip(refs),
      show: !inContextMenu,
      trigger: richTooltip ? 'axis' : 'item',
      formatter: (params: any) => {
        const [xIndex, yIndex] = isHorizontal ? [1, 0] : [0, 1];
        const xValue: number = richTooltip
          ? params[0].value[xIndex]
          : params.value[xIndex];
        const forecastValue: any[] = richTooltip ? params : [params];

        if (richTooltip && tooltipSortByMetric) {
          forecastValue.sort((a, b) => b.data[yIndex] - a.data[yIndex]);
        }

        const rows: string[] = [];
        const forecastValues: Record<string, ForecastValue> =
          extractForecastValuesFromTooltipParams(forecastValue, isHorizontal);

        Object.keys(forecastValues).forEach(key => {
          const value = forecastValues[key];
          if (value.observation === 0 && stack) {
            return;
          }
          // if there are no dimensions, key is a verbose name of a metric,
          // otherwise it is a comma separated string where the first part is metric name
          const formatterKey =
            groupBy.length === 0 ? inverted[key] : labelMap[key]?.[0];
          const content = formatForecastTooltipSeries({
            ...value,
            seriesName: getXAxisCategoryFormatter(true, chartLevel)(key),
            formatter: forcePercentFormatter
              ? percentFormatter
              : getCustomFormatter(customFormatters, metrics, formatterKey) ??
                defaultFormatter,
          });
          const contentStyle =
            key === focusedSeries ? 'font-weight: 700' : 'opacity: 0.7';
          rows.push(
            `<span style="${contentStyle}">${content} ${
              showPercent ? '%' : ''
            }</span>`,
          );
        });
        // if (stack) {
        //   rows.reverse();
        // }
        rows.unshift(
          `${
            useGroup
              ? `${getXAxisCategoryFormatter(
                  true,
                  chartLevel,
                )?.(dataMap?.[+xValue]?.dim)} ${getXAxisCategoryFormatter(
                  true,
                  chartLevel,
                )?.(dataMap?.[+xValue]?.x)}`
              : tooltipFormatter(xValue)
          }`,
        );
        return rows.join('<br />');
      },
    },
    legend: {
      ...getAdvancedLegendProps(
        legendType,
        legendFontSize,
        legendOrientation,
        showLegend,
        theme,
        zoomable,
        legendState,
      ),
      padding: [5, 0, 0, 0],
      data: useGroup
        ? newSeries?.map(s => s.name)
        : // .reverse()
          (legendData as string[]),
      formatter: value => {
        const val = getXAxisCategoryFormatter(true, chartLevel)(value);
        return val.length > 80 ? `${val.slice(0, 80)}...` : val;
      },
    },
    series: substituteColumn
      ? newSeries
          ?.filter(s => s.name !== substituteColumn)
          .map(s => ({
            ...s,
            data: s.data.map((r, i) => (isHorizontal ? [r[0], i] : [i, r[1]])),
          }))
      : newSeries,
    // series: dedupSeries(series),
    toolbox: {
      show: zoomable,
      top: TIMESERIES_CONSTANTS.toolboxTop,
      right: TIMESERIES_CONSTANTS.toolboxRight,
      feature: {
        dataZoom: {
          ...(stack ? { yAxisIndex: false } : {}), // disable y-axis zoom for stacked charts
          title: {
            zoom: t('zoom area'),
            back: t('restore zoom'),
          },
        },
      },
    },
    dataZoom: zoomable
      ? [
          {
            type: 'slider',
            start: TIMESERIES_CONSTANTS.dataZoomStart,
            end: TIMESERIES_CONSTANTS.dataZoomEnd,
            bottom: TIMESERIES_CONSTANTS.zoomBottom,
            yAxisIndex: isHorizontal ? 0 : undefined,
          },
        ]
      : [],
  };

  const onFocusedSeries = (seriesName: string | null) => {
    focusedSeries = seriesName;
  };

  return {
    echartOptions,
    emitCrossFilters,
    formData,
    groupby: groupBy,
    height,
    labelMap,
    selectedValues,
    setDataMask,
    setControlValue,
    width,
    legendData,
    onContextMenu,
    onLegendStateChanged,
    onFocusedSeries,
    xValueFormatter: tooltipFormatter,
    xAxis: {
      label: xAxisLabel,
      type: xAxisType,
    },
    refs,
    coltypeMapping: dataTypes,
  };
}

// как работчают подстановочные
// по Х - как обычно
// Dimension to stack by substitute - разворачивет вторую ось Х по тому что в нее выберешь
// Dimension substitut - нужно выбрать если используешь 4 измерения (тоесть выбираешь 4тое чтобы доразвернуть 3е) и чтобы показывались названия точно из 3го нужно выбрать 4е в селекторе
