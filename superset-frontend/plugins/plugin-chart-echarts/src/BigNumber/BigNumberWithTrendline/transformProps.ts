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
import {
  extractTimegrain,
  getNumberFormatter,
  NumberFormats,
  GenericDataType,
  getMetricLabel,
  t,
  smartDateVerboseFormatter,
  TimeFormatter,
  getXAxisLabel,
  Metric,
  ValueFormatter,
  getValueFormatter,
} from '@superset-ui/core';
import { EChartsCoreOption, graphic } from 'echarts';
import {
  BigNumberVizProps,
  BigNumberDatum,
  BigNumberWithTrendlineChartProps,
  TimeSeriesDatum,
} from '../types';
import { getDateFormatter, parseMetricValue } from '../utils';
import { getDefaultTooltip } from '../../utils/tooltip';
import { Refs } from '../../types';
import { getColorFormatters } from '@superset-ui/chart-controls';

const defaultNumberFormatter = getNumberFormatter();
export function renderTooltipFactory(
  formatDate: TimeFormatter = smartDateVerboseFormatter,
  formatValue: ValueFormatter | TimeFormatter = defaultNumberFormatter,
) {
  return function renderTooltip(params: { data: TimeSeriesDatum }[]) {
    return `
      ${formatDate(params[0].data[0])}
      <br />
      <strong>
        ${
          params[0].data[1] === null ? t('N/A') : formatValue(params[0].data[1])
        }
      </strong>
    `;
  };
}

const formatPercentChange = getNumberFormatter(
  NumberFormats.PERCENT_SIGNED_1_POINT,
);

export default function transformProps(
  chartProps: BigNumberWithTrendlineChartProps,
): BigNumberVizProps {
  const {
    width,
    height,
    queriesData,
    formData,
    rawFormData,
    theme,
    hooks,
    inContextMenu,
    datasource: { currencyFormats = {}, columnFormats = {} },
  } = chartProps;
  const {
    colorPicker,
    compareLag: compareLag_,
    compareSuffix = '',
    timeFormat,
    headerFontSize,
    metric = 'value',
    showTimestamp,
    showTrendLine,
    startYAxisAtZero,
    subheader = '',
    subheaderFontSize,
    forceTimestampFormatting,
    yAxisFormat,
    currencyFormat,
    timeRangeFixed,
    conditionalFormatting,
    conditionalFormattingText,
  } = formData;
  const granularity = extractTimegrain(rawFormData);
  const {
    data = [],
    colnames = [],
    coltypes = [],
    from_dttm: fromDatetime,
    to_dttm: toDatetime,
  } = queriesData[0];
  const colorThresholdFormattersBg =
    getColorFormatters(conditionalFormatting, data, false) ?? [];
  const colorThresholdFormattersText =
    getColorFormatters(conditionalFormattingText, data, false) ?? [];

  const refs: Refs = {};
  const metricName = getMetricLabel(metric);
  const compareLag = Number(compareLag_) || 0;
  let formattedSubheader = subheader;

  const { r, g, b } = colorPicker;
  const mainColor = `rgb(${r}, ${g}, ${b})`;

  const xAxisLabel = getXAxisLabel(rawFormData) as string;
  let trendLineData: TimeSeriesDatum[] | undefined;
  let percentChange = 0;
  let bigNumber: number | null =
    data.length === 0 ? null : (data as any)[0]?.[metricName] ?? null;
  let timestamp: number | null =
    data.length === 0 ? null : (data as any)[0]?.[xAxisLabel] ?? null;
  let bigNumberFallback: TimeSeriesDatum | undefined;

  const metricColtypeIndex = colnames.findIndex(name => name === metricName);
  const metricColtype =
    metricColtypeIndex > -1 ? coltypes[metricColtypeIndex] : null;

  if (data.length > 0) {
    const sortedAsc: TimeSeriesDatum[] = (data as BigNumberDatum[])
      .map(
        d =>
          [
            d[xAxisLabel] as number | null,
            (parseMetricValue(d[metricName]) as number | null) ?? null,
          ] as [number | null, number | null],
      )
      .filter(([ts]) => ts !== null)
      .sort((a, b) => (a[0]! as number) - (b[0]! as number))
      .map(([ts, val]) => [ts as number, val] as TimeSeriesDatum);

    const cumulative: TimeSeriesDatum[] = [];
    let run = 0;
    for (const [ts, val] of sortedAsc) {
      if (val === null || val === undefined) {
        cumulative.push([ts, null]);
      } else {
        run += Number(val) || 0;
        cumulative.push([ts, run]);
      }
    }

    const lastNonNull = [...cumulative].reverse().find(d => d[1] !== null);
    bigNumber = lastNonNull ? (lastNonNull[1] as number) : null;
    timestamp = lastNonNull ? (lastNonNull[0] as number) : null;
    bigNumberFallback = lastNonNull;

    if (compareLag > 0 && cumulative.length > compareLag) {
      const lastIdx = cumulative.length - 1;
      const prevIdx = lastIdx - compareLag;
      const curr = cumulative[lastIdx][1];
      const prev = cumulative[prevIdx][1];
      if (curr !== null && prev !== null) {
        percentChange = prev
          ? (Number(curr) - Number(prev)) / Math.abs(Number(prev))
          : 0;
        formattedSubheader = `${formatPercentChange(
          percentChange,
        )} ${compareSuffix}`;
      }
    }

    trendLineData = showTrendLine ? cumulative : undefined;
  }

  let className = '';
  if (percentChange > 0) className = 'positive';
  else if (percentChange < 0) className = 'negative';

  let metricEntry: Metric | undefined;
  if (chartProps.datasource?.metrics) {
    metricEntry = chartProps.datasource.metrics.find(
      m => m.metric_name === metric,
    );
  }

  const formatTime = getDateFormatter(
    timeFormat,
    granularity,
    metricEntry?.d3format,
  );

  const numberFormatter = getValueFormatter(
    metric,
    currencyFormats,
    columnFormats,
    yAxisFormat,
    currencyFormat,
  );

  const headerFormatter =
    metricColtype === GenericDataType.Temporal ||
    metricColtype === GenericDataType.String ||
    forceTimestampFormatting
      ? formatTime
      : numberFormatter;

  if (trendLineData && timeRangeFixed && fromDatetime) {
    const toDatetimeOrToday = toDatetime ?? Date.now();
    if (
      !trendLineData[0][0] ||
      (trendLineData[0][0] as number) > (fromDatetime as number)
    ) {
      trendLineData.unshift([fromDatetime as number, null]);
    }
    if (
      !trendLineData[trendLineData.length - 1][0] ||
      (trendLineData[trendLineData.length - 1][0] as number) <
        (toDatetimeOrToday as number)
    ) {
      trendLineData.push([toDatetimeOrToday as number, null]);
    }
  }

  const echartOptions: EChartsCoreOption = trendLineData
    ? {
        series: [
          {
            data: trendLineData,
            type: 'line',
            smooth: true,
            symbol: 'circle',
            symbolSize: 10,
            showSymbol: false,
            color: mainColor,
            areaStyle: {
              color: new graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: mainColor },
                { offset: 1, color: theme.colors.grayscale.light5 },
              ]),
            },
          },
        ],
        xAxis: {
          min: trendLineData[0][0] as number,
          max: trendLineData[trendLineData.length - 1][0] as number,
          show: false,
          type: 'value',
        },
        yAxis: { scale: !startYAxisAtZero, show: false },
        grid: { left: 0, right: 0, top: 0, bottom: 0 },
        tooltip: {
          ...getDefaultTooltip(refs),
          show: !inContextMenu,
          trigger: 'axis',
          formatter: renderTooltipFactory(formatTime, headerFormatter),
        },
        aria: {
          enabled: true,
          label: { description: `Big number visualization ${subheader}` },
        },
      }
    : {};

  const { onContextMenu } = hooks;

  return {
    width,
    height,
    bigNumber,
    // @ts-ignore
    bigNumberFallback,
    className,
    headerFormatter,
    formatTime,
    formData,
    headerFontSize,
    subheaderFontSize,
    mainColor,
    showTimestamp,
    showTrendLine,
    startYAxisAtZero,
    subheader: formattedSubheader,
    timestamp,
    trendLineData,
    echartOptions,
    onContextMenu,
    xValueFormatter: formatTime,
    refs,
    colorThresholdFormattersBg,
    colorThresholdFormattersText,
  };
}
