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

/* eslint-disable no-param-reassign */
import {
  DataMask,
  DataMaskStateWithId,
  DataMaskWithId,
  Filter,
  isNativeFilter,
  SLOW_DEBOUNCE,
  styled,
  SupersetClient,
  t,
  usePrevious,
  useTheme,
} from '@superset-ui/core';
import {debounce, isEmpty, isEqual} from 'lodash';
import React, {createContext, useCallback, useEffect, useRef, useState,} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import {useHistory} from 'react-router-dom';
import {URL_PARAMS} from 'src/constants';
import {FilterBarOrientation, RootState} from 'src/dashboard/types';
import {clearDataMask, updateDataMask} from 'src/dataMask/actions';
import {getInitialDataMask} from 'src/dataMask/reducer';
import {useTabId} from 'src/hooks/useTabId';
import {logEvent} from 'src/logger/actions';
import {LOG_ACTIONS_CHANGE_DASHBOARD_FILTER} from 'src/logger/LogUtils';
import {UserWithPermissionsAndRoles} from 'src/types/bootstrapTypes';
import {getUrlParam} from 'src/utils/urlUtils';
import {useImmer} from 'use-immer';
import {InitialState, SelectorOption,} from 'src/dashboard/features/selectors/types';
import {
  setRequiresChartUpdate,
  updateInitialSelectedOptions,
  updateSelectedOptions,
  updateSelectorByKey,
} from 'src/dashboard/features/selectors/selectorsSlice';
import {triggerQuery} from 'src/components/Chart/chartAction';
import {message} from 'antd';
import {useSelectFiltersInScope} from '../state';
import FilterActionButtons from './FilterActionButtons';
import Horizontal from './Horizontal';
import {createFilterKey, updateFilterKey} from './keyValue';
import {useFilters, useFilterUpdates, useInitialization, useNativeFiltersDataMask,} from './state';
import {FiltersBarProps} from './types';
import {
  checkIsApplyDisabled,
  handleComparisonPeriodSelector,
  handleMarketAllSelector,
  handleMarketSelector,
  handlePeriodSelector,
  handleProductAllSelector,
  handleProductSelector,
} from './utils';
import Vertical from './Vertical';
import SelectorsActionButtons from './SelectorsActionButtons';
import {selectorType} from '../constants';
import {applyTempConfig, clearTempConfig,} from 'src/dashboard/reducers/customizeSlice';

// FilterBar is just being hidden as it must still
// render fully due to encapsulated logics
const HiddenFilterBar = styled.div`
  display: none;
`;

const EXCLUDED_URL_PARAMS: string[] = [
  URL_PARAMS.nativeFilters.name,
  URL_PARAMS.permalinkKey.name,
];

const publishDataMask = debounce(
  async (
    history,
    dashboardId,
    updateKey,
    dataMaskSelected: DataMaskStateWithId,
    tabId,
  ) => {
    const { location } = history;
    const { search } = location;
    const previousParams = new URLSearchParams(search);
    const newParams = new URLSearchParams();
    let dataMaskKey: string | null;
    previousParams.forEach((value, key) => {
      if (!EXCLUDED_URL_PARAMS.includes(key)) {
        newParams.append(key, value);
      }
    });

    const nativeFiltersCacheKey = getUrlParam(URL_PARAMS.nativeFiltersKey);
    const dataMask = JSON.stringify(dataMaskSelected);
    if (
      updateKey &&
      nativeFiltersCacheKey &&
      (await updateFilterKey(
        dashboardId,
        dataMask,
        nativeFiltersCacheKey,
        tabId,
      ))
    ) {
      dataMaskKey = nativeFiltersCacheKey;
    } else {
      dataMaskKey = await createFilterKey(dashboardId, dataMask, tabId);
    }
    if (dataMaskKey) {
      newParams.set(URL_PARAMS.nativeFiltersKey.name, dataMaskKey);
    }

    // pathname could be updated somewhere else through window.history
    // keep react router history in sync with window history
    // replace params only when current page is /superset/dashboard
    // this prevents a race condition between updating filters and navigating to Explore
    if (window.location.pathname.includes('/superset/dashboard')) {
      history.location.pathname = window.location.pathname;
      history.replace({
        search: newParams.toString(),
      });
    }
  },
  SLOW_DEBOUNCE,
);

export const FilterBarScrollContext = createContext(false);
const FilterBar: React.FC<FiltersBarProps> = ({
  orientation = FilterBarOrientation.Vertical,
  verticalConfig,
  hidden = false,
}) => {
  const theme = useTheme();
  const history = useHistory();
  const dataMaskApplied: DataMaskStateWithId = useNativeFiltersDataMask();
  const [dataMaskSelected, setDataMaskSelected] =
    useImmer<DataMaskStateWithId>(dataMaskApplied);
  const dispatch = useDispatch();
  const [updateKey, setUpdateKey] = useState(0);
  const tabId = useTabId();
  const filters = useFilters();
  const previousFilters = usePrevious(filters);
  const filterValues = Object.values(filters);
  const nativeFilterValues = filterValues.filter(isNativeFilter);
  const dashboardId = useSelector<any, number>(
    ({ dashboardInfo }) => dashboardInfo?.id,
  );
  const previousDashboardId = usePrevious(dashboardId);
  const canEdit = useSelector<RootState, boolean>(
    ({ dashboardInfo }) => dashboardInfo.dash_edit_perm,
  );
    const { lastNOptions, tempLastNOptions } = useSelector<RootState>(
    state => state.customizeOptions,
  );
  const user: UserWithPermissionsAndRoles = useSelector<
    RootState,
    UserWithPermissionsAndRoles
  >(state => state.user);

  const {
    selectors,
    selectorsToGet,
    selectorsInfoLoaded,
    requiresChartUpdate,
    initialSelectorsToGet,
  }: InitialState = useSelector((state: RootState) => state.selectors);

  const {
    orders: { loaded: isOrderLoaded, selectedValue: selectedOrder },
  } = useSelector((state: RootState) => state.orders);

  const { options_ids } = selectors.facts.selectedDict;

  const charts = useSelector(state => state.charts);
  const chartsIds = Object.keys(charts);

  const selectorsError = () => {
    message.error({
      content: t(
        'Selectors are temporarily unavailable. Please try again later or contact support',
      ),
      duration: 5,
      style: {
        color: theme.colors.error.dark1,
      },
    });
  };

  const resetComparisonPeriod = (value: string) => {
    const updateOptions = selectors.comparisonPeriod.dictOptions[value];
    const updateOption = updateOptions?.filter(
      option => !option.isNotActive,
    )[0];
    dispatch(
      updateSelectorByKey({
        key: 'comparisonPeriod',
        updates: {
          options: updateOptions || [],
          selectedOptions: updateOption || undefined,
          isValueCustom: !!updateOption?.isCustom,
        },
      }),
    );
  };

  const updateCustomFlag = (key: string, option?: SelectorOption) => {
    dispatch(
      updateSelectorByKey({
        key,
        updates: {
          isValueCustom: !!option?.isCustom,
        },
      }),
    );
  };

  const updateSelected = (
    key: string,
    options: SelectorOption | SelectorOption[],
  ) => {
    dispatch(
      updateSelectedOptions({
        key,
        options,
      }),
    );
    if (key === 'period') {
      resetComparisonPeriod(options?.value.toString());
      updateCustomFlag(key, options);
    }
    if (key === 'comparisonPeriod') {
      updateCustomFlag(key, options);
    }
  };

  const waitForChartData = async chartId =>
    new Promise((resolve, reject) => {
      const interval = setInterval(() => {
        const chart = charts[chartId];
        if (!chart) {
          clearInterval(interval);
          reject(new Error(`Chart with ID ${chartId} is not available.`));
        }
        if (chart.form_data || chart.latestQueryFormData) {
          clearInterval(interval);
          resolve(chart);
        }
      }, 100);
    });

  const getDefaultSelectors = async selectorsToGet => {
    const chartId = chartsIds[0];
    const chart = await waitForChartData(chartId);

    if (!chart) {
      throw new Error(`Chart with ID ${chartId} is not available.`);
    }

    const rlsRestriction = selectedOrder
      ? { column: 'order_id', value: selectedOrder.value }
      : {};

    return SupersetClient.post({
      endpoint: '/api/v1/chart/check_selectors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        selectors: selectorsToGet,
        rls_restriction: rlsRestriction,
      }),
    });
  };

  const updateSelectorsFromResponse = selectorsData => {
    selectorsData.forEach((el: any) => {
      if (el.type_selector === selectorType.period) {
        handlePeriodSelector(el, dispatch);
      }
      if (el.type_selector === selectorType.comparisonPeriod) {
        handleComparisonPeriodSelector(selectorsData, el, dispatch);
      }
      if (el.type_selector === selectorType.market) {
        handleMarketSelector(el, dispatch, selectors.market.dashboardQuantity);
      }
      if (el.type_selector === selectorType.marketAll) {
        handleMarketAllSelector(el, dispatch);
      }

      if (el.type_selector === selectorType.product) {
        const { dashboardQuantity } = selectors.product;
        const { chosenHierarchy } = selectors.product;
        handleProductSelector(el, dispatch, dashboardQuantity, chosenHierarchy);
      }
      if (el.type_selector === selectorType.productAll) {
        const { dashboardQuantity } = selectors.product;
        const { chosenHierarchy } = selectors.productAll;
        handleProductAllSelector(el, dispatch, dashboardQuantity, chosenHierarchy);
      }
    });
  };

  const loadAndSetSelectors = async selectorsToGet => {
    try {
      const res = await getDefaultSelectors(selectorsToGet);
      updateSelectorsFromResponse(res.json.selectors);
      chartsIds.forEach(id => dispatch(triggerQuery(true, id)));
    } catch (error) {
      selectorsError();
    }
  };

  useEffect(() => {
    const requiresSelectorsUpdate =
      charts?.[chartsIds[0]] &&
      selectorsInfoLoaded &&
      selectorsToGet.length > 0;

    if (requiresSelectorsUpdate && isOrderLoaded) {
      loadAndSetSelectors(selectorsToGet);
    }
    if (!requiresSelectorsUpdate && requiresChartUpdate) {
      chartsIds.forEach(id => {
        dispatch(triggerQuery(true, id));
      });
      dispatch(setRequiresChartUpdate(false));
    }
    if (selectorsInfoLoaded && initialSelectorsToGet.length === 0) {
      chartsIds.forEach(id => {
        dispatch(triggerQuery(true, id));
      });
    }
  }, [selectorsToGet, selectorsInfoLoaded, requiresChartUpdate, isOrderLoaded]);

  const [filtersInScope] = useSelectFiltersInScope(nativeFilterValues);

  const dataMaskSelectedRef = useRef(dataMaskSelected);
  dataMaskSelectedRef.current = dataMaskSelected;
  const handleFilterSelectionChange = useCallback(
    (
      filter: Pick<Filter, 'id'> & Partial<Filter>,
      dataMask: Partial<DataMask>,
    ) => {
      setDataMaskSelected(draft => {
        // force instant updating on initialization for filters with `requiredFirst` is true or instant filters
        if (
          // filterState.value === undefined - means that value not initialized
          dataMask.filterState?.value !== undefined &&
          dataMaskSelectedRef.current[filter.id]?.filterState?.value ===
            undefined &&
          filter.requiredFirst
        ) {
          dispatch(updateDataMask(filter.id, dataMask));
        }
        draft[filter.id] = {
          ...(getInitialDataMask(filter.id) as DataMaskWithId),
          ...dataMask,
        };
      });
    },
    [dispatch, setDataMaskSelected],
  );

  useEffect(() => {
    if (previousFilters && dashboardId === previousDashboardId) {
      const updates = {};
      Object.values(filters).forEach(currentFilter => {
        const previousFilter = previousFilters?.[currentFilter.id];
        if (!previousFilter) {
          return;
        }
        const currentType = currentFilter.filterType;
        const currentTargets = currentFilter.targets;
        const currentDataMask = currentFilter.defaultDataMask;
        const previousType = previousFilter?.filterType;
        const previousTargets = previousFilter?.targets;
        const previousDataMask = previousFilter?.defaultDataMask;
        const typeChanged = currentType !== previousType;
        const targetsChanged = !isEqual(currentTargets, previousTargets);
        const dataMaskChanged = !isEqual(currentDataMask, previousDataMask);

        if (typeChanged || targetsChanged || dataMaskChanged) {
          updates[currentFilter.id] = getInitialDataMask(currentFilter.id);
        }
      });

      if (!isEmpty(updates)) {
        setDataMaskSelected(draft => ({ ...draft, ...updates }));
        Object.keys(updates).forEach(key => dispatch(clearDataMask(key)));
      }
    }
  }, [
    JSON.stringify(filters),
    JSON.stringify(previousFilters),
    previousDashboardId,
  ]);

  const dataMaskAppliedText = JSON.stringify(dataMaskApplied);

  useEffect(() => {
    setDataMaskSelected(() => dataMaskApplied);
  }, [dataMaskAppliedText, setDataMaskSelected]);

  useEffect(() => {
    // embedded users can't persist filter combinations
    if (user?.userId) {
      publishDataMask(history, dashboardId, updateKey, dataMaskApplied, tabId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dashboardId, dataMaskAppliedText, history, updateKey, tabId]);

  const handleFilterApply = useCallback(() => {
    dispatch(logEvent(LOG_ACTIONS_CHANGE_DASHBOARD_FILTER, {}));
    const filterIds = Object.keys(dataMaskSelected);
    setUpdateKey(1);
    filterIds.forEach(filterId => {
      if (dataMaskSelected[filterId]) {
        dispatch(updateDataMask(filterId, dataMaskSelected[filterId]));
      }
    });
  }, [dataMaskSelected, dispatch]);

  const handleFilterClearAll = useCallback(() => {
    const clearDataMaskIds: string[] = [];
    let dispatchAllowed = false;
    filtersInScope.filter(isNativeFilter).forEach(filter => {
      const { id } = filter;
      if (dataMaskSelected[id]) {
        if (filter.controlValues?.enableEmptyFilter) {
          dispatchAllowed = false;
        }
        clearDataMaskIds.push(id);
        setDataMaskSelected(draft => {
          if (draft[id].filterState?.value !== undefined) {
            draft[id].filterState!.value = undefined;
          }
        });
      }
    });
    if (dispatchAllowed) {
      clearDataMaskIds.forEach(id => dispatch(clearDataMask(id)));
    }
  }, [dataMaskSelected, dispatch, filtersInScope, setDataMaskSelected]);

  useFilterUpdates(dataMaskSelected, setDataMaskSelected);
  const isFilterApplyDisabled = checkIsApplyDisabled(
    dataMaskSelected,
    dataMaskApplied,
    filtersInScope.filter(isNativeFilter),
  );
  const isInitialized = useInitialization();

  const handleSelectorApply = useCallback(() => {
    dispatch(
      updateInitialSelectedOptions({
        key: 'period',
        options: selectors.period.selectedOptions,
      }),
    );
    dispatch(
      updateInitialSelectedOptions({
        key: 'comparisonPeriod',
        options: selectors.comparisonPeriod.selectedOptions,
      }),
    );
    dispatch(
      updateInitialSelectedOptions({
        key: 'market',
        options: selectors.market.selectedOptions,
      }),
    );
    dispatch(
      updateInitialSelectedOptions({
        key: 'marketAll',
        options: selectors.marketAll.selectedOptions,
      }),
    );
    dispatch(
      updateInitialSelectedOptions({
        key: 'product',
        options: selectors.product.selectedOptions,
      }),
    );
    dispatch(
      updateInitialSelectedOptions({
        key: 'productAll',
        options: selectors.productAll.selectedOptions,
      }),
    );
    if (selectors.facts.isActive) {
      const { selectedDict } = selectors.facts;
      dispatch(
        updateSelectorByKey({
          key: 'facts',
          updates: {
            initialSelectedOptions: selectors.facts.selectedOptions,
            selectedDict: {
              ...selectedDict,
              row_id: options_ids.find(
                el => el.name === selectors.facts.selectedOptions?.value,
              )?.id,
            },
          },
        }),
      );
    }
    chartsIds.forEach(id => {
      dispatch(triggerQuery(true, id));
    });
  }, [selectors]);

    const handleCustomizeOptionsApply = () => {
    dispatch(applyTempConfig());
    requestAnimationFrame(() =>
      chartsIds.forEach(id => {
        dispatch(triggerQuery(true, id));
      }),
    );
  };

  const handleSelectorClearAll = useCallback(() => {
    Object.keys(selectors).forEach(key => {
      updateSelected(key, selectors[key].initialSelectedOptions);
    });
  }, [selectors]);

  const isSelectorsValueChanged = () =>
    Object.keys(selectors).some(
      key =>
        !isEqual(
          selectors[key].selectedOptions,
          selectors[key].initialSelectedOptions,
        ),
    );

  const isSelectorApplyDisabled =
    !isSelectorsValueChanged() ||
    Object.values(selectors).some(
      selector =>
        selector.isActive &&
        (!selector.selectedOptions ||
          (Array.isArray(selector.selectedOptions) &&
            selector.selectedOptions.length === 0) ||
          (typeof selector.selectedOptions === 'object' &&
            Object.keys(selector.selectedOptions).length === 0)),
    );

  const filterActions = (
    <FilterActionButtons
      filterBarOrientation={orientation}
      width={verticalConfig?.width}
      onApply={handleFilterApply}
      onClearAll={handleFilterClearAll}
      dataMaskSelected={dataMaskSelected}
      dataMaskApplied={dataMaskApplied}
      isApplyDisabled={isFilterApplyDisabled}
    />
  );

  const selectorActions = (
    <SelectorsActionButtons
      filterBarOrientation={orientation}
      width={verticalConfig?.width}
      onApply={handleSelectorApply}
      onClearAll={handleSelectorClearAll}
      isApplyDisabled={isSelectorApplyDisabled}
      valueChanged={isSelectorsValueChanged()}
    />
  );
    const customizeActions = (
    <SelectorsActionButtons
      filterBarOrientation={orientation}
      width={verticalConfig?.width}
      onApply={handleCustomizeOptionsApply}
      onClearAll={() => dispatch(clearTempConfig())}
      isApplyDisabled={
        JSON.stringify(lastNOptions) === JSON.stringify(tempLastNOptions)
      }
      valueChanged={
        JSON.stringify(lastNOptions) !== JSON.stringify(tempLastNOptions)
      }
    />
  );

  const filterBarComponent =
    orientation === FilterBarOrientation.Horizontal ? (
      <Horizontal
        actions={filterActions}
        canEdit={canEdit}
        dashboardId={dashboardId}
        dataMaskSelected={dataMaskSelected}
        filterValues={filterValues}
        isInitialized={isInitialized}
        onSelectionChange={handleFilterSelectionChange}
      />
    ) : verticalConfig ? (
      <Vertical
        filterActions={filterActions}
        selectorActions={selectorActions}
        customizeActions={customizeActions}
        canEdit={canEdit}
        dataMaskSelected={dataMaskSelected}
        filtersOpen={verticalConfig.filtersOpen}
        selectorsOpen={verticalConfig.selectorsOpen}
        customizerOpen={verticalConfig.customizerOpen}
        filterValues={filterValues}
        isInitialized={isInitialized}
        height={verticalConfig.height}
        offset={verticalConfig.offset}
        onSelectionChange={handleFilterSelectionChange}
        toggleFiltersBar={verticalConfig.toggleFiltersBar}
        toggleSelectorsBar={verticalConfig.toggleSelectorsBar}
        toggleCustomizerBar={verticalConfig.toggleCustomizerBar}
        width={verticalConfig.width}
        selectors={selectors}
        updateSelected={updateSelected}
      />
    ) : null;

  return hidden ? (
    <HiddenFilterBar>{filterBarComponent}</HiddenFilterBar>
  ) : (
    filterBarComponent
  );
};
export default React.memo(FilterBar);
