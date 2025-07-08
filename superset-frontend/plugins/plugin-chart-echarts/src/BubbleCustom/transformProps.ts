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
import {EChartsCoreOption, ScatterSeriesOption} from 'echarts';
import {extent} from 'd3-array';
import {
  AxisType,
  CategoricalColorNamespace,
  getMetricLabel,
  getNumberFormatter,
  getXAxisCategoryFormatter,
  NumberFormatter,
} from '@superset-ui/core';
import {isEmpty} from 'lodash';
import {EchartsBubbleChartProps, EchartsBubbleFormData} from './types';
import {DEFAULT_FORM_DATA, MINIMUM_BUBBLE_SIZE} from './constants';
import {defaultGrid} from '../defaults';
import {getMinAndMaxFromBounds} from '../utils/series';
import {Refs} from '../types';
import {parseAxisBound} from '../utils/controls';
import {getDefaultTooltip} from '../utils/tooltip';
import {getPadding} from '../Timeseries/transformers';
import {convertInteger} from '../utils/convertInteger';
import {NULL_STRING} from '../constants';

function normalizeSymbolSize(
  nodes: ScatterSeriesOption[],
  maxBubbleValue: number,
) {
  const [bubbleMinValue, bubbleMaxValue] = extent(nodes, x => x.data![0][2]);
  const nodeSpread = bubbleMaxValue - bubbleMinValue;
  nodes.forEach(node => {
    // eslint-disable-next-line no-param-reassign
    node.symbolSize =
      (((node.data![0][2] - bubbleMinValue) / nodeSpread) *
        (maxBubbleValue * 2) || 0) + MINIMUM_BUBBLE_SIZE;
  });
}

function insertLineBreaks(text: string, maxLength: number = 60): string {
  const result: string[] = [];
  let currentPosition = 0;
  const textLength = text.length;

  while (currentPosition < textLength) {
    // Определяем конечную позицию для текущего отрезка
    let endPosition = Math.min(currentPosition + maxLength, textLength);

    // Если мы не в конце строки и не на границе слова
    if (endPosition < textLength) {
      // Ищем последний пробел в текущем отрезке
      let lastSpace = text.lastIndexOf(' ', endPosition);

      // Если пробел найден и он после текущей позиции
      if (lastSpace > currentPosition) {
        endPosition = lastSpace;
      }
    }

    // Добавляем отрезок в результат
    result.push(text.substring(currentPosition, endPosition));

    // Перемещаем текущую позицию
    currentPosition = endPosition;

    // Пропускаем пробел (если разбивали по пробелу)
    if (text[currentPosition] === ' ') {
      currentPosition++;
    }

    // Добавляем <br />, если не достигли конца
    if (currentPosition < textLength) {
      result.push('<br />');
    }
  }

  return result.join('');
}

export function formatTooltip(
  params: any,
  chartLevel: any,
  xAxisLabel: string,
  yAxisLabel: string,
  sizeLabel: string,
  xAxisFormatter: NumberFormatter,
  yAxisFormatter: NumberFormatter,
  tooltipSizeFormatter: NumberFormatter,
) {
  const title = params.data[4]
    ? `${params.data[3]} </br> ${params.data[4]}`
    : params.data[3];

  return `<p>${getXAxisCategoryFormatter(true, chartLevel)(title)}</p>
        ${xAxisLabel}: ${xAxisFormatter(params.data[0])} <br/>
        ${yAxisLabel}: ${yAxisFormatter(params.data[1])} <br/>
        ${sizeLabel}: ${tooltipSizeFormatter(params.data[2])}`;
}

export default function transformProps(chartProps: EchartsBubbleChartProps) {
  const { height, width, hooks, queriesData, formData, inContextMenu } =
    chartProps;

  const { data = [] } = queriesData[0];
  const {
    x,
    y,
    size,
    entity,
    maxBubbleSize,
    colorScheme,
    series: bubbleSeries,
    xAxisLabel: bubbleXAxisTitle,
    yAxisLabel: bubbleYAxisTitle,
    xAxisBounds,
    xAxisFormat,
    yAxisFormat,
    yAxisBounds,
    logXAxis,
    logYAxis,
    xAxisTitleMargin,
    yAxisTitleMargin,
    truncateXAxis,
    truncateYAxis,
    xAxisLabelRotation,
    yAxisLabelRotation,
    tooltipSizeFormat,
    opacity,
    showLegend,
    legendOrientation,
    legendMargin,
    // legendType,

    dottedXAxis,
    dottedYAxis,
    showSwotHeaders,
    textTooltipForHeader1,
    textTooltipForHeader2,
    textTooltipForHeader3,
    textTooltipForHeader4,
    showDataZoomX,
    showDataZoomY = false,
  }: EchartsBubbleFormData = { ...DEFAULT_FORM_DATA, ...formData };

  const colorFn = CategoricalColorNamespace.getScale(colorScheme as string);

  const { chartLevel } = formData.customizeOptions?.lastNOptions || {
    chartLevel: undefined,
  };

  const legends = new Set<string>();
  const series: ScatterSeriesOption[] = [];

  const xAxisLabel: string = getMetricLabel(x);
  const yAxisLabel: string = getMetricLabel(y);
  const sizeLabel: string = getMetricLabel(size);

  const dottedXAxisLegend = dottedXAxis ? getMetricLabel(dottedXAxis) : null;
  const dottedYAxisLegend = dottedYAxis ? getMetricLabel(dottedYAxis) : null;

  const dottedXAxisValue = dottedXAxis
    ? // @ts-ignore
      (+data[0][getMetricLabel(dottedXAxis)]).toFixed(1)
    : undefined;

  const dottedYAxisValue = dottedYAxis
    ? // @ts-ignore
      (+data[0][getMetricLabel(dottedYAxis)]).toFixed(1)
    : undefined;

  const safeDottedXAxisValue =
    typeof dottedXAxisValue === 'string' || typeof dottedXAxisValue === 'number'
      ? dottedXAxisValue
      : '';

  const safeDottedYAxisValue =
    typeof dottedYAxisValue === 'string' || typeof dottedYAxisValue === 'number'
      ? dottedYAxisValue
      : '';

  const refs: Refs = {};

  const bubbleSeriesLabel =
    typeof bubbleSeries === 'object' ? bubbleSeries.label : bubbleSeries;

  const entityLabel = typeof entity === 'object' ? entity.label : entity;

  data.forEach(datum => {
    const dataName = !isEmpty(bubbleSeries)
      ? datum[bubbleSeriesLabel]
      : datum[entityLabel];
    const name = dataName ? String(dataName) : NULL_STRING;
    const bubbleSeriesValue = !isEmpty(bubbleSeries)
      ? datum[bubbleSeriesLabel]
      : null;

    series.push({
      name,
      data: [
        [
          datum[xAxisLabel],
          datum[yAxisLabel],
          datum[sizeLabel],
          datum[entityLabel],
          bubbleSeriesValue as any,
        ],
      ],
      label: {
        show: true,
        position: 'top',
        // align:'right',
        formatter(param) {
          const name = getXAxisCategoryFormatter(
            true,
            chartLevel,
          )(param.data[3])||'';
          return name.length > 80 ? `${name.slice(0, 80)}...` : name; // Название бабла
        },
      },
      type: 'scatter',
      itemStyle: { color: colorFn(name), opacity },
      markLine: {
        silent: true,
        animation: false,
        lineStyle: {
          color: 'gray',
        },
        symbol: ['none', 'none'],
        tooltip: {
          show: false,
        },
        data: [
          // Добавляем пунктирные линии по осям X и Y
          {
            xAxis: safeDottedXAxisValue,
            lineStyle: { type: 'dashed' },
            label: {
              show: true,
              position: 'insideEndBottom',
              rotate: 0,
              color: 'gray',
              formatter: () => `${dottedXAxisValue} %`,
            },
          },
          {
            yAxis: safeDottedYAxisValue,
            lineStyle: { type: 'dashed' },
            label: {
              show: true,
              position: 'insideStartTop',
              color: 'gray',
              formatter: () => `${dottedYAxisValue} п.п`,
            },
          },
        ],
      },
    });
    legends.add(name);
  });

  normalizeSymbolSize(series, maxBubbleSize);

  const xAxisFormatter = getNumberFormatter(xAxisFormat);
  const yAxisFormatter = getNumberFormatter(yAxisFormat);
  const tooltipSizeFormatter = getNumberFormatter(tooltipSizeFormat);

  const [xAxisMin, xAxisMax] = (xAxisBounds || []).map(parseAxisBound);
  const [yAxisMin, yAxisMax] = (yAxisBounds || []).map(parseAxisBound);

  const padding = getPadding(
    showLegend,
    legendOrientation,
    true,
    false,
    legendMargin,
    0,
    true,
    'Left',
    convertInteger(yAxisTitleMargin),
    convertInteger(xAxisTitleMargin),
  );

  const xAxisType = logXAxis ? AxisType.Log : AxisType.Value;

  const dataZoomOptions = [];

  const zoomSettings = {
    backgroundColor: 'rgba(220, 220, 220, 0.5)', // Светлый серый цвет фона
    fillerColor: 'rgba(200, 200, 200, 0.8)', // Цвет заливки ползунка
    borderColor: 'rgba(0, 0, 0, 0)', // Без рамки
    handleSize: '100%', // Размер "ручки" в процентах от ширины ползунка
    handleStyle: {
      color: '#ffffff', // Белый цвет "ручки"
      borderColor: 'rgba(0, 0, 0, 0)', // Без рамки
      borderWidth: 2,
      shadowBlur: 2,
      shadowColor: 'rgba(0, 0, 0, 0.1)',
      shadowOffsetX: 0,
      shadowOffsetY: 1,
    },
    handleIcon: 'path://M5 0 a5 5 0 1 1 0 12 a5 5 0 1 1 0 -12',
    moveHandleSize: 0,
    moveHandleStyle: {
      color: 'white',
      display: 'light-gray',
    },
    emphasis: {
      moveHandleStyle: {
        color: 'rgba(200, 200, 200, 0.9)',
      },
    },
  };

  // Добавляем dataZoom для оси X, если включен
  if (showDataZoomX) {
    dataZoomOptions.push(
      {
        type: 'slider',
        xAxisIndex: 0,
        filterMode: 'none',
        bottom: 20,

        height: 10,
        ...zoomSettings,
      },
      {
        type: 'inside',
        xAxisIndex: 0,
      },
    );
  }

  // Добавляем dataZoom для оси Y, если включен
  if (showDataZoomY) {
    dataZoomOptions.push(
      {
        type: 'slider',
        yAxisIndex: 0,
        filterMode: 'none',
        left: 'right',

        width: 10,
        ...zoomSettings,
      },
      {
        type: 'inside',
        yAxisIndex: 0,
      },
    );
  }

  const getGrapgicElement = (text: string, tooltip?: string) => ({
    type: 'text',
    z: 1,
    left: 'center',
    top: 'middle',
    tooltip: { formatter: () => insertLineBreaks(tooltip || text || '') },
    style: {
      backgroundColor: 'rgba(242, 242, 242, 0.5)',
      textPadding: 10,
      fill: '#000000',
      fontWeight: '700',
      // width: 200,
      textAlign: 'center',
      overflow: 'break',
      text,
      fontSize: '14px',
    },
  });

  const maxSeriesXaxisValue = Math.max(
    ...series.map(s => s.data?.map(d => d[0])).flat(),
  );
  const minSeriesXaxisValue = Math.min(
    ...series.map(s => s.data?.map(d => d[0])).flat(),
  );
  const maxSeriesYaxisValue = Math.max(
    ...series.map(s => s.data?.map(d => d[1])).flat(),
  );
  const minSeriesYaxisValue = Math.min(
    ...series.map(s => s.data?.map(d => d[1])).flat(),
  );

  const minXaxisValue = isNaN(+safeDottedXAxisValue)
    ? minSeriesXaxisValue
    : +safeDottedXAxisValue < minSeriesXaxisValue
      ? +safeDottedXAxisValue
      : minSeriesXaxisValue;
  const maxXaxisValue = isNaN(+safeDottedXAxisValue)
    ? maxSeriesXaxisValue
    : +safeDottedXAxisValue > maxSeriesXaxisValue
      ? +safeDottedXAxisValue
      : maxSeriesXaxisValue;
  const minYaxisValue = isNaN(+safeDottedYAxisValue)
    ? minSeriesYaxisValue
    : +safeDottedYAxisValue < minSeriesYaxisValue
      ? +safeDottedYAxisValue
      : minSeriesYaxisValue;
  const maxYaxisValue = isNaN(+safeDottedYAxisValue)
    ? maxSeriesYaxisValue
    : +safeDottedYAxisValue > maxSeriesYaxisValue
      ? +safeDottedYAxisValue
      : maxSeriesYaxisValue;

  const getFormatterPadding = () => {
    const valLength = yAxisFormatter(maxYaxisValue)?.toString()?.length;

    if (typeof valLength === 'number') return valLength * 9 + 10;

    return 30;
  };
  const echartOptions: EChartsCoreOption = {
    dataZoom: dataZoomOptions,
    series,
    graphic: showSwotHeaders
      ? [
          {
            type: 'group',
            left: padding.left + getFormatterPadding(),
            top: padding.top - 40,
            children: [getGrapgicElement('Возможности', textTooltipForHeader1)],
          },
          {
            type: 'group',
            right: padding.right + 20,
            top: padding.top - 40,
            children: [
              getGrapgicElement('Сильные стороны', textTooltipForHeader2),
            ],
          },
          {
            type: 'group',
            left: padding.left + getFormatterPadding(),
            bottom: padding.bottom + 40,
            children: [
              getGrapgicElement('Слабые стороны', textTooltipForHeader3),
            ],
          },
          {
            type: 'group',
            right: padding.right + 20,
            bottom: padding.bottom + 40,
            children: [getGrapgicElement('Угрозы', textTooltipForHeader4)],
          },
        ]
      : [],
    xAxis: {
      axisLabel: { formatter: xAxisFormatter },
      splitLine: {
        show: false,
      },
      nameRotate: xAxisLabelRotation,
      scale: true,
      name: bubbleXAxisTitle,
      nameLocation: 'middle',
      nameTextStyle: {
        fontWight: 'bolder',
      },
      nameGap: convertInteger(xAxisTitleMargin),
      type: xAxisType,
      ...getMinAndMaxFromBounds(xAxisType, truncateXAxis, xAxisMin, xAxisMax),
      min:
        typeof maxXaxisValue === 'number'
          ? (typeof minXaxisValue === 'number' && minXaxisValue < 0
              ? minXaxisValue
              : 0) -
            Math.abs(maxXaxisValue) * 0.1
          : xAxisMin,
      max:
        typeof maxXaxisValue === 'number'
          ? maxXaxisValue > 0
            ? maxXaxisValue * 1.1
            : maxXaxisValue * 0.9
          : xAxisMax,
      axisLine: { onZero: false },
    },
    yAxis: {
      axisLabel: { formatter: yAxisFormatter },
      splitLine: {
        show: false,
      },
      nameRotate: yAxisLabelRotation,
      scale: truncateYAxis,
      name: bubbleYAxisTitle,
      nameLocation: 'middle',
      nameTextStyle: {
        fontWight: 'bolder',
      },
      nameGap: convertInteger(yAxisTitleMargin),
      min:
        typeof maxYaxisValue === 'number'
          ? (typeof minYaxisValue === 'number' && minYaxisValue < 0
              ? minYaxisValue
              : 0) -
            Math.abs(maxYaxisValue) * 0.1
          : yAxisMin,
      max:
        typeof maxYaxisValue === 'number'
          ? maxYaxisValue > 0
            ? maxYaxisValue * 1.1
            : maxYaxisValue * 0.9
          : yAxisMax,
      type: logYAxis ? AxisType.Log : AxisType.Value,
      axisLine: { onZero: false },
    },
    // legend: {
    //   ...getLegendProps(legendType, legendOrientation, showLegend, theme),
    //   data: Array.from(legends),
    // },
    legend: {
      show: false,
    },
    tooltip: {
      show: !inContextMenu,
      ...getDefaultTooltip(refs),
      formatter: (params: any): string =>
        formatTooltip(
          params,
          chartLevel,
          xAxisLabel,
          yAxisLabel,
          sizeLabel,
          xAxisFormatter,
          yAxisFormatter,
          tooltipSizeFormatter,
        ),
    },
    grid: {
      ...defaultGrid,
      ...padding,
      bottom: padding.bottom + 15,
      // + (showDataZoomX ? 80 : 25)
      top: padding.top - 40,
      right: padding.right + 15,
    },
  };

  const { onContextMenu, setDataMask = () => {} } = hooks;

  return {
    refs,
    height,
    width,
    echartOptions,
    onContextMenu,
    setDataMask,
    formData,
    legendData: {
      showLegend,
      size: sizeLabel,
      yAxisValue: dottedYAxisLegend,
      xAxisValue: dottedXAxisLegend,
    },
    headersData: {
      showDataZoomX,
      showDataZoomY,
      showSwotHeaders,
      textTooltipForHeader1,
      textTooltipForHeader2,
      textTooltipForHeader3,
      textTooltipForHeader4,
    },
  };
}
