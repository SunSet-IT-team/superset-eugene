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
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  BinaryQueryObjectFilterClause,
  AxisType,
  getTimeFormatter,
  getColumnLabel,
  getNumberFormatter,
  LegendState,
  ensureIsArray,
} from '@superset-ui/core';
import { ViewRootGroup } from 'echarts/types/src/util/types';
import GlobalModel from 'echarts/types/src/model/Global';
import ComponentModel from 'echarts/types/src/model/Component';
import { EchartsHandler, EventHandlers } from '../types';
import Echart from '../components/Echart';
import { TimeseriesChartTransformedProps } from './types';
import { formatSeriesName } from '../utils/series';
import { ExtraControls } from '../components/ExtraControls';

const TIMER_DURATION = 300;

export default function EchartsTimeseries({
  formData,
  height,
  width,
  echartOptions,
  groupby,
  labelMap,
  selectedValues,
  setDataMask,
  setControlValue,
  legendData = [],
  onContextMenu,
  onLegendStateChanged,
  onFocusedSeries,
  xValueFormatter,
  xAxis,
  refs,
  emitCrossFilters,
  coltypeMapping,
  legendState,
}: TimeseriesChartTransformedProps & { legendState?: any }) {
  const { stack } = formData;
  const echartRef = useRef<EchartsHandler | null>(null);
  // eslint-disable-next-line no-param-reassign
  refs.echartRef = echartRef;

  const clickTimer = useRef<ReturnType<typeof setTimeout>>();
  const extraControlRef = useRef<HTMLDivElement>(null);
  const [extraControlHeight, setExtraControlHeight] = useState(0);

  useEffect(() => {
    const updatedHeight = extraControlRef.current?.offsetHeight || 0;
    setExtraControlHeight(updatedHeight);
  }, [formData.showExtraControls]);

  const getModelInfo = (target: ViewRootGroup, globalModel: GlobalModel) => {
    let el = target;
    let model: ComponentModel | null = null;
    while (el) {
      // eslint-disable-next-line no-underscore-dangle
      const modelInfo = (el as any).__ecComponentInfo;
      if (modelInfo != null) {
        model = globalModel.getComponent(modelInfo.mainType, modelInfo.index);
        break;
      }
      // @ts-ignore
      el = (el as any).parent;
    }
    return model;
  };

  const getCrossFilterDataMask = useCallback(
    (value: string) => {
      const selected: string[] = Object.values(selectedValues);
      const values = selected.includes(value)
        ? selected.filter(v => v !== value)
        : [value];
      const groupbyValues = values.map(v => labelMap[v]);
      return {
        dataMask: {
          extraFormData: {
            filters:
              values.length === 0
                ? []
                : groupby.map((col, idx) => {
                    const val = groupbyValues.map(v => v[idx]);
                    if (val === null || val === undefined) {
                      return { col, op: 'IS NULL' as const };
                    }
                    return {
                      col,
                      op: 'IN' as const,
                      val: val as (string | number | boolean)[],
                    };
                  }),
          },
          filterState: {
            label: groupbyValues.length ? groupbyValues : undefined,
            value: groupbyValues.length ? groupbyValues : null,
            selectedValues: values.length ? values : null,
          },
        },
        isCurrentValueSelected: selected.includes(value),
      };
    },
    [groupby, labelMap, selectedValues],
  );

  const handleChange = useCallback(
    (value: string) => {
      if (!emitCrossFilters) return;
      setDataMask(getCrossFilterDataMask(value).dataMask);
    },
    [emitCrossFilters, setDataMask, getCrossFilterDataMask],
  );

  const eventHandlers: EventHandlers = {
    click: props => {
      if (clickTimer.current) clearTimeout(clickTimer.current);
      clickTimer.current = setTimeout(() => {
        const { seriesName: name } = props;
        handleChange(name);
      }, TIMER_DURATION);
    },
    mouseout: () => onFocusedSeries(null),
    mouseover: params => onFocusedSeries(params.seriesName),
    legendselectchanged: payload => onLegendStateChanged?.(payload.selected),
    legendselectall: payload => onLegendStateChanged?.(payload.selected),
    legendinverseselect: payload => onLegendStateChanged?.(payload.selected),
    contextmenu: async eventParams => {
      if (!onContextMenu) return;
      eventParams.event.stop();
      const { data, seriesName } = eventParams;
      const drillToDetailFilters: BinaryQueryObjectFilterClause[] = [];
      const drillByFilters: BinaryQueryObjectFilterClause[] = [];
      const pointerEvent = eventParams.event.event;
      const values = [
        ...(eventParams.name ? [eventParams.name] : []),
        ...(labelMap[seriesName] ?? []),
      ];
      const groupBy = ensureIsArray(formData.groupby);
      if (data && xAxis.type === AxisType.Time) {
        drillToDetailFilters.push({
          col:
            xAxis.label === '__timestamp'
              ? formData.granularitySqla
              : xAxis.label,
          grain: formData.timeGrainSqla,
          op: '==',
          val: data[0],
          formattedVal: xValueFormatter(data[0]),
        });
      }
      [
        ...(xAxis.type === AxisType.Category && data ? [xAxis.label] : []),
        ...groupBy,
      ].forEach((dimension, i) =>
        drillToDetailFilters.push({
          col: dimension,
          op: '==',
          val: values[i],
          formattedVal: String(values[i]),
        }),
      );
      groupBy.forEach((dimension, i) => {
        const val = labelMap[seriesName][i];
        drillByFilters.push({
          col: dimension,
          op: '==',
          val,
          formattedVal: formatSeriesName(values[i], {
            timeFormatter: getTimeFormatter(formData.dateFormat),
            numberFormatter: getNumberFormatter(formData.numberFormat),
            coltype: coltypeMapping?.[getColumnLabel(dimension)],
          }),
        });
      });

      onContextMenu(pointerEvent.clientX, pointerEvent.clientY, {
        drillToDetail: drillToDetailFilters,
        crossFilter: getCrossFilterDataMask(seriesName),
        drillBy: { filters: drillByFilters, groupbyFieldName: 'groupby' },
      });
    },
  };

  const zrEventHandlers: EventHandlers = {
    dblclick: params => {
      if (clickTimer.current) clearTimeout(clickTimer.current);
      const pointInPixel = [params.offsetX, params.offsetY];
      const echartInstance = echartRef.current?.getEchartInstance();
      if (echartInstance?.containPixel('grid', pointInPixel)) {
        if (!stack && (params as any).target?.type === 'ec-polygon') return;
        // @ts-ignore
        const globalModel = echartInstance.getModel();
        const model = getModelInfo((params as any).target, globalModel);
        if (model) {
          const { name } = model as any;
          const state: LegendState = legendData.reduce(
            (previous, datum) => ({ ...previous, [datum]: datum === name }),
            {},
          );
          onLegendStateChanged?.(state);
        }
      }
    },
  };

  const isThreeRows = (formData.legendType as any) === 'threeRows';
  const isTopOrBottom =
    formData.legendOrientation === 'top' ||
    formData.legendOrientation === 'bottom';
  const showLegendArrows =
    !!formData.showLegend && isThreeRows && isTopOrBottom;

  const pageOffset = Number((legendState as any)?.pageOffset ?? 0);

  const legendOption = useMemo(() => {
    const lg = (echartOptions as any)?.legend;
    if (Array.isArray(lg)) return lg[0] ?? {};
    return lg ?? {};
  }, [echartOptions]);

  const legendOptionData: any[] = useMemo(
    () => (legendOption?.data ? legendOption.data : []),
    [legendOption],
  );

  const hasMoreDown = useMemo(() => {
    if (!showLegendArrows) return false;
    return legendOptionData.some((it: any) => {
      const name = typeof it === 'string' ? it : it?.name;
      if (typeof name !== 'string') return false;
      const compact = name.replace(/\s+/g, '');
      return compact.startsWith('…+') || compact.startsWith('...+');
    });
  }, [showLegendArrows, legendOptionData]);

  const moveLegendPage = useCallback(
    (delta: number) => {
      const next = Math.max(0, pageOffset + delta);
      onLegendStateChanged?.({
        ...(legendState as any),
        pageOffset: next,
      } as any);
    },
    [onLegendStateChanged, legendState, pageOffset],
  );

  const ArrowButtons = showLegendArrows ? (
    <div
      style={{
        position: 'absolute',
        top: 0,
        right: 8,
        zIndex: 10,
        display: 'flex',
        gap: 6,
        alignItems: 'center',
        pointerEvents: 'auto',
      }}
    >
      <button
        type="button"
        onClick={() => moveLegendPage(-1)}
        title="Легенда: вверх (−1 строка)"
        style={{
          padding: '0 4px',
          border: 'none',
          background: 'transparent',
        }}
      >
        ↑
      </button>
      <button
        type="button"
        onClick={() => moveLegendPage(+1)}
        title="Легенда: вниз (+1 строка)"
        style={{
          padding: '0 4px',
          border: 'none',
          background: 'transparent',
        }}
      >
        ↓
      </button>
    </div>
  ) : null;

  return (
    <>
      <div ref={extraControlRef}>
        <ExtraControls formData={formData} setControlValue={setControlValue} />
      </div>

      <div
        style={{
          position: 'relative',
          width,
          height: height - extraControlHeight,
        }}
      >
        {ArrowButtons}

        <Echart
          ref={echartRef}
          refs={refs}
          height={height - extraControlHeight}
          width={width}
          echartOptions={echartOptions}
          eventHandlers={eventHandlers}
          zrEventHandlers={zrEventHandlers}
          selectedValues={selectedValues}
        />
      </div>
    </>
  );
}
