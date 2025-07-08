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
  ChartProps,
  ChartDataResponseResult,
  QueryFormData,
} from '@superset-ui/core';
import {
  LegendFormData,
  BaseTransformedProps,
  CrossFilterTransformedProps,
} from '../types';

export type EchartsBubbleFormData = QueryFormData &
  LegendFormData & {
    series?: string;
    entity: string;
    xAxisFormat: string;
    yAXisFormat: string;
    logXAxis: boolean;
    logYAxis: boolean;
    xAxisBounds: [number | undefined | null, number | undefined | null];
    yAxisBounds: [number | undefined | null, number | undefined | null];
    xAxisLabel?: string;
    colorScheme?: string;
    defaultValue?: string[] | null;
    dateFormat: string;
    emitFilter: boolean;
    tooltipFormat: string;
    x: string;
    y: string;
  };

export interface EchartsBubbleChartProps
  extends ChartProps<EchartsBubbleFormData> {
  formData: EchartsBubbleFormData;
  queriesData: ChartDataResponseResult[];
}

export type customLegend = {
  legendData: {
    showLegend: boolean;
    size: string,
    yAxisValue: string,
    xAxisValue: string,
  }
}
export type customHeadersForSwot = {
  headersData: {
    showSwotHeaders: boolean,
    textTooltipForHeader1: string,
    textTooltipForHeader2: string,
    textTooltipForHeader3: string,
    textTooltipForHeader4: string,
    showDataZoomX: boolean,
    showDataZoomY: boolean,
  }
}

export type BubbleChartTransformedProps =
  BaseTransformedProps<EchartsBubbleFormData> & CrossFilterTransformedProps & customLegend & customHeadersForSwot;

export type IQuadrant = {
  id: number;
  title: string;
  position: 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';
  tooltip: string;
};
