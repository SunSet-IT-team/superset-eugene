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
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScatterSeriesOption } from 'echarts';
import { extent } from 'd3-array';
import { styled, t } from '@superset-ui/core';
import { BubbleChartTransformedProps } from './types';
import Echart from '../components/Echart';
import { BubbleLegend } from './components/BubbleLegend/BubbleLegend';
import { Quadrant } from './components/Quadrant/Quadrant';
import { MINIMUM_BUBBLE_SIZE } from './constants';
import { SelectItem } from './components/SelectItem/SelectItem';

const SelectsWrapper = styled('div')`
  display: flex;
  justify-content: center;
`;

export default function EchartsBubble(props: BubbleChartTransformedProps) {
  const {
    height,
    width,
    echartOptions,
    refs,
    legendData,
    headersData,
    formData,
  } = props;

  const ref = useRef<any>(null);
  const [legendHeight, setLegendHeight] = useState(0);
  const [maxBubbleSize, setMaxBubbleSize] = useState<number>(
    +formData.maxBubbleSize,
  );
  const [rowLimit, setRowLimit] = useState<number>(+formData.rowLimit);

  useEffect(() => {
    if (ref.current) {
      setLegendHeight(ref.current.clientHeight * 2);
    }
  }, [ref.current]);

  const {
    showSwotHeaders,
    textTooltipForHeader1,
    textTooltipForHeader3,
    textTooltipForHeader2,
    textTooltipForHeader4,

    showDataZoomX,
    showDataZoomY,
  } = headersData;

  const handleMaxSizeChange = (newSize: number) => {
    setMaxBubbleSize(newSize);
  };

  const handleRowLimitChange = (newRowLimit: number) => {
    setRowLimit(newRowLimit);
  };

  function normalizeSymbolSize(
    nodes: ScatterSeriesOption[],
    maxBubbleValue: number,
  ) {
    const [bubbleMinValue, bubbleMaxValue] = extent(nodes, x => x.data![0][2]);
    const nodeSpread = bubbleMaxValue - bubbleMinValue;
    const slicedNodes = nodes.slice(0, rowLimit);
    return slicedNodes.map(node => ({
      ...node,
      symbolSize:
        (((node.data![0][2] - bubbleMinValue) / nodeSpread) *
          (maxBubbleValue * 2) || 0) + MINIMUM_BUBBLE_SIZE,
    }));
  }

  const updatedChartOptions = useMemo(
    () => ({
      ...echartOptions,
      // @ts-ignore
      series: normalizeSymbolSize(echartOptions.series, maxBubbleSize),
    }),
    [maxBubbleSize, rowLimit, echartOptions],
  );

  const slicedChartOptions = {
    ...echartOptions,
    // @ts-ignore
    series: echartOptions.series.slice(0, formData.rowLimit),
  };

  const showSelect = window.location.pathname.includes('dashboard');
  const SELECTS_HEIGHT = 42;

  const chartHeight = showSelect
    ? height - legendHeight - SELECTS_HEIGHT
    : height - legendHeight;

  const chartWidth = showDataZoomY ? width - 30 : width;

  return (
    <div>
      {showSelect && (
        <SelectsWrapper>
          <SelectItem
            title={t('Max bubble size')}
            options={[
              { value: 5, label: '5' },
              { value: 10, label: '10' },
              { value: 15, label: '15' },
              { value: 25, label: '25' },
              { value: 50, label: '50' },
              { value: 75, label: '75' },
              { value: 100, label: '100' },
            ]}
            onSelect={handleMaxSizeChange}
            value={maxBubbleSize}
          />

          <SelectItem
            title={t('Total bubble limit')}
            options={[
              { value: 5, label: '5' },
              { value: 10, label: '10' },
              { value: 25, label: '25' },
              { value: 50, label: '50' },
              { value: 100, label: '100' },
              { value: 250, label: '250' },
              { value: 500, label: '500' },
            ]}
            onSelect={handleRowLimitChange}
            value={rowLimit}
          />
        </SelectsWrapper>
      )}

      <div style={{ position: 'relative' }}>
        {/* {showSwotHeaders && (
          <Quadrant
            showDataZoomX={showDataZoomX}
            showDataZoomY={showDataZoomY}
            title="Возможности"
            position="topLeft"
            tooltip={textTooltipForHeader1}
          />
        )}
        {showSwotHeaders && (
          <Quadrant
            showDataZoomX={showDataZoomX}
            showDataZoomY={showDataZoomY}
            title="Сильные стороны"
            position="topRight"
            tooltip={textTooltipForHeader2}
          />
        )}
        {showSwotHeaders && (
          <Quadrant
            showDataZoomX={showDataZoomX}
            showDataZoomY={showDataZoomY}
            title="Слабые стороны"
            position="bottomLeft"
            tooltip={textTooltipForHeader4}
          />
        )}
        {showSwotHeaders && (
          <Quadrant
            showDataZoomX={showDataZoomX}
            showDataZoomY={showDataZoomY}
            title="Угрозы"
            position="bottomRight"
            tooltip={textTooltipForHeader3}
          />
        )} */}
        <Echart
          height={chartHeight}
          width={chartWidth}
          echartOptions={showSelect ? updatedChartOptions : slicedChartOptions}
          refs={refs}
        />
      </div>

      {legendData.showLegend && <BubbleLegend ref={ref} data={legendData} />}
    </div>
  );
}
