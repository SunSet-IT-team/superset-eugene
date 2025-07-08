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
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {ResizeCallback, ResizeStartCallback} from 're-resizable';
import cx from 'classnames';
import {useSelector} from 'react-redux';
import {css} from '@superset-ui/core';
import {LayoutItem, RootState} from 'src/dashboard/types';
import AnchorLink from 'src/dashboard/components/AnchorLink';
import Chart from 'src/dashboard/containers/Chart';
import DeleteComponentButton from 'src/dashboard/components/DeleteComponentButton';
import {Draggable} from 'src/dashboard/components/dnd/DragDroppable';
import HoverMenu from 'src/dashboard/components/menu/HoverMenu';
import ResizableContainer from 'src/dashboard/components/resizable/ResizableContainer';
import getChartAndLabelComponentIdFromPath from 'src/dashboard/util/getChartAndLabelComponentIdFromPath';
import useFilterFocusHighlightStyles from 'src/dashboard/util/useFilterFocusHighlightStyles';
import {COLUMN_TYPE, ROW_TYPE} from 'src/dashboard/util/componentTypes';
import {
  GRID_BASE_UNIT,
  GRID_GUTTER_SIZE,
  GRID_MIN_COLUMN_COUNT,
  GRID_MIN_ROW_UNITS,
} from 'src/dashboard/util/constants';
import {periodValueType} from '../nativeFilters/constants';
import {formatFulldesc} from "../nativeFilters/FilterBar/utils";

export const CHART_MARGIN = 32;

interface ChartHolderProps {
  id: string;
  parentId: string;
  dashboardId: number;
  component: LayoutItem;
  parentComponent: LayoutItem;
  getComponentById?: (id?: string) => LayoutItem | undefined;
  index: number;
  depth: number;
  editMode: boolean;
  directPathLastUpdated?: number;
  fullSizeChartId: number | null;
  isComponentVisible: boolean;

  // grid related
  availableColumnCount: number;
  columnWidth: number;
  onResizeStart: ResizeStartCallback;
  onResize: ResizeCallback;
  onResizeStop: ResizeCallback;

  // dnd
  deleteComponent: (id: string, parentId: string) => void;
  updateComponents: Function;
  handleComponentDrop: (...args: unknown[]) => unknown;
  setFullSizeChartId: (chartId: number | null) => void;
  isInView: boolean;
}

const fullSizeStyle = css`
  && {
    position: fixed;
    z-index: 3000;
    left: 0;
    top: 0;
  }
`;

const ChartHolder: React.FC<ChartHolderProps> = ({
  id,
  parentId,
  component,
  parentComponent,
  index,
  depth,
  availableColumnCount,
  columnWidth,
  onResizeStart,
  onResize,
  onResizeStop,
  editMode,
  isComponentVisible,
  dashboardId,
  fullSizeChartId,
  getComponentById = () => undefined,
  deleteComponent,
  updateComponents,
  handleComponentDrop,
  setFullSizeChartId,
  isInView,
}) => {
  const { chartId } = component.meta;
  const isFullSize = fullSizeChartId === chartId;

  const focusHighlightStyles = useFilterFocusHighlightStyles(chartId);
  const dashboardState = useSelector(
    (state: RootState) => state.dashboardState,
  );
  const [extraControls, setExtraControls] = useState<Record<string, unknown>>(
    {},
  );
  const [outlinedComponentId, setOutlinedComponentId] = useState<string>();
  const [outlinedColumnName, setOutlinedColumnName] = useState<string>();
  const [currentDirectPathLastUpdated, setCurrentDirectPathLastUpdated] =
    useState(0);

  const directPathToChild = useMemo(
    () => dashboardState?.directPathToChild ?? [],
    [dashboardState],
  );

  const directPathLastUpdated = useMemo(
    () => dashboardState?.directPathLastUpdated ?? 0,
    [dashboardState],
  );

  const infoFromPath = useMemo(
    () => getChartAndLabelComponentIdFromPath(directPathToChild) as any,
    [directPathToChild],
  );

  // Calculate if the chart should be outlined
  useEffect(() => {
    const { label: columnName, chart: chartComponentId } = infoFromPath;

    if (
      directPathLastUpdated !== currentDirectPathLastUpdated &&
      component.id === chartComponentId
    ) {
      setCurrentDirectPathLastUpdated(directPathLastUpdated);
      setOutlinedComponentId(component.id);
      setOutlinedColumnName(columnName);
    }
  }, [
    component,
    currentDirectPathLastUpdated,
    directPathLastUpdated,
    infoFromPath,
  ]);

  // Remove the chart outline after a defined time
  useEffect(() => {
    let timerId: NodeJS.Timeout | undefined;
    if (outlinedComponentId) {
      timerId = setTimeout(() => {
        setOutlinedComponentId(undefined);
        setOutlinedColumnName(undefined);
      }, 2000);
    }

    return () => {
      if (timerId) {
        clearTimeout(timerId);
      }
    };
  }, [outlinedComponentId]);

  const widthMultiple = useMemo(() => {
    const columnParentWidth = getComponentById(
      parentComponent.parents?.find(parent => parent.startsWith(COLUMN_TYPE)),
    )?.meta?.width;

    let widthMultiple = component.meta.width || GRID_MIN_COLUMN_COUNT;
    if (parentComponent.type === COLUMN_TYPE) {
      widthMultiple = parentComponent.meta.width || GRID_MIN_COLUMN_COUNT;
    } else if (columnParentWidth && widthMultiple > columnParentWidth) {
      widthMultiple = columnParentWidth;
    }

    return widthMultiple;
  }, [
    component,
    getComponentById,
    parentComponent.meta.width,
    parentComponent.parents,
    parentComponent.type,
  ]);

  const { chartWidth, chartHeight } = useMemo(() => {
    let chartWidth = 0;
    let chartHeight = 0;

    if (isFullSize) {
      chartWidth = window.innerWidth - CHART_MARGIN;
      chartHeight = window.innerHeight - CHART_MARGIN;
    } else {
      chartWidth = Math.floor(
        widthMultiple * columnWidth +
          (widthMultiple - 1) * GRID_GUTTER_SIZE -
          CHART_MARGIN,
      );
      chartHeight = Math.floor(
        component.meta.height * GRID_BASE_UNIT - CHART_MARGIN,
      );
    }

    return {
      chartWidth,
      chartHeight,
    };
  }, [columnWidth, component, isFullSize, widthMultiple]);

  const handleDeleteComponent = useCallback(() => {
    deleteComponent(id, parentId);
  }, [deleteComponent, id, parentId]);

  const handleUpdateSliceName = useCallback(
    (nextName: string) => {
      updateComponents({
        [component.id]: {
          ...component,
          meta: {
            ...component.meta,
            sliceNameOverride: nextName,
          },
        },
      });
    },
    [component, updateComponents],
  );

  const handleToggleFullSize = useCallback(() => {
    setFullSizeChartId(isFullSize ? null : chartId);
  }, [chartId, isFullSize, setFullSizeChartId]);

  const handleExtraControl = useCallback((name: string, value: unknown) => {
    setExtraControls(current => ({
      ...current,
      [name]: value,
    }));
  }, []);

  const { selectors, selectorsInfoLoaded } = useSelector(
    state => state.selectors,
  );
  const customizeOptions = useSelector(
    (state: RootState) => state.customizeOptions,
  );

  const {
    orders: { selectedValue: selectedOrder },
    companies: { selectedValue: selectedCompany },
  } = useSelector((state: RootState) => state.orders);

  const { dashboard_title: dashboardTitle } = useSelector(
    (state: RootState) => state.dashboardInfo,
  );

  const isPeriodSelectorActive = selectors.period.isActive;
  const periodSelectorValue = isPeriodSelectorActive
    ? selectors.period.selectedOptions?.value || 'last_month'
    : 'No selector';
  const periodType = selectors.period.isValueCustom
    ? periodValueType.custom
    : periodValueType.predefined;
  const selectedPeriod = {
    value: periodSelectorValue,
    type: periodType,
  };

  const isMarketSelectorActive = selectors.market.isActive;
  const marketSelectorValue = isMarketSelectorActive
    ? Array.isArray(selectors.market.selectedOptions)
      ? selectors.market.selectedOptions.map(opt => opt.value)
      : selectors.market.selectedOptions?.value || 'No selector'
    : 'No selector';
  const selectedMarket = !Array.isArray(marketSelectorValue)
    ? [marketSelectorValue]
    : marketSelectorValue;

  const isProductSelectorActive = selectors.product.isActive;
  const productSelectedOptions = isProductSelectorActive
    ? selectors.product.selectedOptions
    : null;
  const selectedProducts = Array.isArray(productSelectedOptions)
    ? productSelectedOptions?.map(option =>
      option.hierarchyMode === 'basic' ? option.ids : option.value,
    )
    : productSelectedOptions
      ? [
        productSelectedOptions.hierarchyMode === 'basic'
          ? productSelectedOptions.ids
          : productSelectedOptions.value,
      ]
      : ['No selector'];

  const isComparisonPeriodSelectorActive = selectors.comparisonPeriod.isActive;
  const comparisonPeriodSelectorValue = isComparisonPeriodSelectorActive
    ? selectors.comparisonPeriod.selectedOptions?.value || ''
    : 'No selector';
  const comparisonPeriodType = selectors.comparisonPeriod.isValueCustom
    ? periodValueType.custom
    : periodValueType.predefined;
  const selectedComparisonPeriod = {
    value: comparisonPeriodSelectorValue,
    type: comparisonPeriodType,
  };

  const isMarket100SelectorActive = selectors.marketAll.isActive;
  const market100SelectorValue = isMarket100SelectorActive
    ? Array.isArray(selectors.marketAll.selectedOptions)
      ? selectors.marketAll.selectedOptions.map(opt => opt.value)
      : selectors.marketAll.selectedOptions?.value || 'No selector'
    : 'No selector';
  const selected100Markets = !Array.isArray(market100SelectorValue)
    ? [market100SelectorValue]
    : market100SelectorValue;

  const isProduct100SelectorActive = selectors.productAll.isActive;
  const product100SelectedOptions = isProduct100SelectorActive
    ? selectors.productAll.selectedOptions
    : null;
  const selected100Products = Array.isArray(product100SelectedOptions)
    ? product100SelectedOptions?.map(option =>
      option.hierarchyMode === 'basic' ? option.ids : option.value,
    )
    : product100SelectedOptions
      ? [
        product100SelectedOptions.hierarchyMode === 'basic'
          ? product100SelectedOptions.ids
          : product100SelectedOptions.value,
      ]
      : ['No selector'];

  const isFactSelectorActive = selectors.facts.isActive;

  const { datasource_type, datasource_id, row_id, column } =
    selectors.facts.selectedDict;
  const selectedFact = isFactSelectorActive
    ? {
        datasource_type: datasource_type || 'table',
        datasource_id: datasource_id || 18,
        row_id: row_id || 1,
        column: column || 'sdesc_ru',
      }
    : 'No selector';

  const selectedMarketsLabels = selectors.market.options
    .filter((el: any) => selectedMarket.includes(el.value))
    .map((el: any) => el.label);

  const selectedProductsLabels = selectors.product.options
    .filter((el: any) => selectedProducts.includes(el.value || el.ids))
    .map((el: any) => el.title || el.label);

  const selectedSelectorsForSorting = {
    selectedMarkets: selectedMarketsLabels,
    selectedProducts: selectedProductsLabels,
  };

  const activeSelectors = Object.values(selectors).filter(
    selector => selector.isActive,
  );
  const allActiveSelectorsHaveValues = activeSelectors.every(selector =>
    Array.isArray(selector.selectedOptions)
      ? selector.selectedOptions
      .map(opt => opt.value)
      .filter(val => val !== undefined).length > 0
      : selector.selectedOptions?.value !== null &&
      selector.selectedOptions?.value !== '',
  );
  const selectorsDataLoaded =
    selectorsInfoLoaded &&
    (activeSelectors.length === 0 ||
      (activeSelectors.length > 0 && allActiveSelectorsHaveValues));

  const rlsRestrictions = { column: 'order_id', value: selectedOrder?.value };

  const fullSelectedMarkets = isMarketSelectorActive
    ? Array.isArray(selectors.market.selectedOptions)
      ? selectors.market.selectedOptions.map(opt => ({
        key: opt.value,
        label: formatFulldesc(opt.label, { type: 'full' }),
      }))
      : [
        {
          key: selectors.market.selectedOptions?.value,
          label: formatFulldesc(selectors.market.selectedOptions?.label, {
            type: 'full',
          }),
        },
      ]
    : [];

  const fullSelectedProducts = Array.isArray(productSelectedOptions)
    ? productSelectedOptions?.map(opt => ({
      key: opt.value,
      label: formatFulldesc(opt.title, { type: 'full' }),
    }))
    : productSelectedOptions
      ? [
        {
          key: productSelectedOptions.value,
          label: formatFulldesc(productSelectedOptions.title, {
            type: 'full',
          }),
        },
      ]
      : [];

  const fullSelected100Markets = isMarket100SelectorActive
    ? Array.isArray(selectors.marketAll.selectedOptions)
      ? selectors.marketAll.selectedOptions.map(opt => ({
        key: opt.value,
        label: formatFulldesc(opt.label, { type: 'full' }),
      }))
      : [
        {
          key: selectors.marketAll.selectedOptions?.value,
          label: formatFulldesc(selectors.marketAll.selectedOptions?.label, {
            type: 'full',
          }),
        },
      ]
    : [];

  const fullSelected100Products = Array.isArray(product100SelectedOptions)
    ? product100SelectedOptions?.map(opt => ({
      key: opt.value,
      label: formatFulldesc(opt.title, { type: 'full' }),
    }))
    : product100SelectedOptions
      ? [
        {
          key: product100SelectedOptions.value,
          label: formatFulldesc(product100SelectedOptions.title, {
            type: 'full',
          }),
        },
      ]
      : [];

  const korusExportInfo = {
    dashboard: {
      title: dashboardTitle || '',
    },
    chart: {
      title: component.meta.sliceName || '',
    },
    company: {
      title: selectedCompany?.label || '',
    },
    order: {
      title: selectedOrder?.label || '',
    },
    selected_selectors: {
      products: {
        items: fullSelectedProducts,
      },
      products_100: {
        items: fullSelected100Products,
      },
      markets: {
        items: fullSelectedMarkets,
      },
      markets_100: {
        items: fullSelected100Markets,
      },
    },
  };

  return (
    <Draggable
      component={component}
      parentComponent={parentComponent}
      orientation={parentComponent.type === ROW_TYPE ? 'column' : 'row'}
      index={index}
      depth={depth}
      onDrop={handleComponentDrop}
      disableDragDrop={false}
      editMode={editMode}
    >
      {({ dragSourceRef }) => (
        <ResizableContainer
          id={component.id}
          adjustableWidth={parentComponent.type === ROW_TYPE}
          adjustableHeight
          widthStep={columnWidth}
          widthMultiple={widthMultiple}
          heightStep={GRID_BASE_UNIT}
          heightMultiple={component.meta.height}
          minWidthMultiple={GRID_MIN_COLUMN_COUNT}
          minHeightMultiple={GRID_MIN_ROW_UNITS}
          maxWidthMultiple={availableColumnCount + widthMultiple}
          onResizeStart={onResizeStart}
          onResize={onResize}
          onResizeStop={onResizeStop}
          editMode={editMode}
        >
          <div
            ref={dragSourceRef}
            data-test="dashboard-component-chart-holder"
            style={focusHighlightStyles}
            css={isFullSize ? fullSizeStyle : undefined}
            className={cx(
              'dashboard-component',
              'dashboard-component-chart-holder',
              // The following class is added to support custom dashboard styling via the CSS editor
              `dashboard-chart-id-${chartId}`,
              outlinedComponentId ? 'fade-in' : 'fade-out',
            )}
          >
            {!editMode && (
              <AnchorLink
                id={component.id}
                scrollIntoView={outlinedComponentId === component.id}
              />
            )}
            {!!outlinedComponentId && (
              <style>
                {`label[for=${outlinedColumnName}] + .Select .Select__control {
                    border-color: #00736a;
                    transition: border-color 1s ease-in-out;
                  }`}
              </style>
            )}
            <Chart
              componentId={component.id}
              id={component.meta.chartId}
              dashboardId={dashboardId}
              width={chartWidth}
              height={chartHeight}
              sliceName={
                component.meta.sliceNameOverride ||
                component.meta.sliceName ||
                ''
              }
              updateSliceName={handleUpdateSliceName}
              isComponentVisible={isComponentVisible}
              handleToggleFullSize={handleToggleFullSize}
              isFullSize={isFullSize}
              setControlValue={handleExtraControl}
              extraControls={extraControls}
              isInView={isInView}
              selectedPeriod={selectedPeriod}
              selectedMarket={selectedMarket}
              selected100Markets={selected100Markets}
              selectedComparisonPeriod={selectedComparisonPeriod}
              selectedProducts={selectedProducts}
              selected100Products={selected100Products}
              selectedFact={selectedFact}
              customizeOptions={customizeOptions}
              selectedSelectorsForSorting={selectedSelectorsForSorting}
              selectorsDataLoaded={selectorsDataLoaded}
              rlsRestrictions={rlsRestrictions}
              korusExportInfo={korusExportInfo}
            />
            {editMode && (
              <HoverMenu position="top">
                <div data-test="dashboard-delete-component-button">
                  <DeleteComponentButton onDelete={handleDeleteComponent} />
                </div>
              </HoverMenu>
            )}
          </div>
        </ResizableContainer>
      )}
    </Draggable>
  );
};

export default ChartHolder;
