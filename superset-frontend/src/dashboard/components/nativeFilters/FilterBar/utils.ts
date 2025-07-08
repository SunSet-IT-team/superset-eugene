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

import { areObjectsEqual } from 'src/reduxUtils';
import { DataMaskStateWithId, Filter, FilterState } from '@superset-ui/core';
import { testWithId } from 'src/utils/testUtils';
import { RootState } from 'src/dashboard/types';
import { useSelector } from 'react-redux';
import { updateSelectorByKey } from 'src/dashboard/features/selectors/selectorsSlice';
import { periodGranularity, selectorType } from '../constants';
import {
  AvailableMarketsType,
  AvailableProductsType,
  MarketHierarchyType,
  MarketType,
} from './types';
import { LevelOption } from 'src/dashboard/reducers/customizeSlice';

export const getOnlyExtraFormData = (data: DataMaskStateWithId) =>
  Object.values(data).reduce(
    (prev, next) => ({ ...prev, [next.id]: next.extraFormData }),
    {},
  );

export const checkIsMissingRequiredValue = (
  filter: Filter,
  filterState?: FilterState,
) => {
  const value = filterState?.value;
  // TODO: this property should be unhardcoded
  return (
    filter.controlValues?.enableEmptyFilter &&
    (value === null || value === undefined)
  );
};

export const checkIsApplyDisabled = (
  dataMaskSelected: DataMaskStateWithId,
  dataMaskApplied: DataMaskStateWithId,
  filters: Filter[],
) => {
  const dataSelectedValues = Object.values(dataMaskSelected);
  const dataAppliedValues = Object.values(dataMaskApplied);
  return (
    areObjectsEqual(
      getOnlyExtraFormData(dataMaskSelected),
      getOnlyExtraFormData(dataMaskApplied),
      { ignoreUndefined: true },
    ) ||
    dataSelectedValues.length !== dataAppliedValues.length ||
    filters.some(filter =>
      checkIsMissingRequiredValue(
        filter,
        dataMaskSelected?.[filter?.id]?.filterState,
      ),
    )
  );
};

export const useChartsVerboseMaps = () =>
  useSelector<RootState, { [chartId: string]: Record<string, string> }>(
    state => {
      const { charts, datasources } = state;

      return Object.keys(state.charts).reduce((chartsVerboseMaps, chartId) => {
        const chartDatasource =
          datasources[charts[chartId]?.form_data?.datasource];
        return {
          ...chartsVerboseMaps,
          [chartId]: chartDatasource ? chartDatasource.verbose_map : {},
        };
      }, {});
    },
  );

export const FILTER_BAR_TEST_ID = 'filter-bar';
export const getFilterBarTestId = testWithId(FILTER_BAR_TEST_ID);

export const transformMarkets = (availableMarkets: AvailableMarketsType[]) => {
  const nodeMap = new Map();
  const roots: MarketHierarchyType[] = [];

  availableMarkets.sort((a, b) => a.MKT_LEVEL - b.MKT_LEVEL);

  availableMarkets.forEach(({ MKT_NAME, MKT_TAG, MKT_PARENT_TAG }) => {
    const newNode: MarketHierarchyType = nodeMap.get(MKT_TAG) || {
      title: MKT_NAME,
      key: MKT_TAG,
      children: [],
    };
    nodeMap.set(MKT_TAG, newNode);

    const parent: MarketHierarchyType = nodeMap.get(MKT_PARENT_TAG);

    if (MKT_PARENT_TAG && parent) {
      parent.children.push(newNode);
      nodeMap.set(MKT_PARENT_TAG, parent);
    } else {
      roots.push(newNode);
    }
  });

  return roots;
};

function sortProductsById(data, idName) {
  return [...data].sort((a, b) => a[idName] - b[idName]);
}

export const transformHierarchy = data => {
  const sortedData = sortProductsById(data, 'PROD_LEVEL');

  const map = {};
  sortedData.forEach(item => {
    map[item.PROD_TAG] = {
      type: item.PROD_LEVEL_NAME,
      key: item.PROD_TAG,
      title: item.PROD_NAME,
      parent: item.PROD_PARENT_TAG,
      children: [],
      fullTitle: item.PROD_NAME,
      hierarchyMode: 'advanced',
      //добавил уровень
      level: item.PROD_LEVEL,
    };
  });

  // Создаём результат
  const result = [];

  // Формируем иерархию
  sortedData.forEach(item => {
    const { PROD_PARENT_TAG, PROD_TAG } = item;
    const current = map[PROD_TAG];
    const parent = map[PROD_PARENT_TAG];

    if (PROD_PARENT_TAG && parent) {
      // Если есть родитель, добавляем текущий элемент в его children
      parent.children.push(current);
      current.fullTitle = parent.parent
        ? `${parent.fullTitle} ${current.title}`
        : `${current.title}`;
    } else {
      // Если нет родителя, добавляем элемент в корень
      // проверяем чтобы уровень был равен 1
      current.level === 1 && result.push(current);
    }
    if (current.type === 'ITEM') {
      current.fullTitle = current.title;
    }
  });

  return result;
};

export const buildChosenHierarchyObject = (selectedProduct, data) => {
  const chosenItems = [];
  let currentProduct = selectedProduct[0];

  // Поднимаемся вверх по иерархии, собирая все PROD_LEVEL_NAME
  while (currentProduct) {
    chosenItems.unshift(currentProduct); // Добавляем текущий уровень в начало массива
    if (!currentProduct.PROD_PARENT_TAG) break; // Если текущий элемент - корень, выходим
    currentProduct = data.find(
      item => item.PROD_TAG === currentProduct.PROD_PARENT_TAG,
    );
  }

  if (!chosenItems.length) {
    return {
      value: data[0].PROD_TAG,
      chosenItems: [],
    };
  }

  // Формируем объект результата
  return {
    value: chosenItems[0].PROD_TAG, // Такое же значение для value
    chosenItems: chosenItems.slice(1).map(el => el.PROD_LEVEL_NAME), // Остальные уровни, начиная с дочернего
  };
};

export const findObjectsByKey = (hierarchy, targetKey) => {
  const result = [];

  function search(node) {
    if (targetKey.includes(node.key)) {
      result.push(node);
    }
    if (node.children?.length > 0) {
      node.children.forEach(search);
    }
  }

  hierarchy.forEach(search);
  return result;
};

export const handlePeriodSelector = (el, dispatch) => {
  const availablePeriods =
    el.period_type === periodGranularity.week
      ? el.custom_periods
      : el.custom_periods?.map(date => date.replace('M', '-'));

  const options = el.avaliable_periods.map(option => ({
    ...option,
    isNotActive: !option.available,
  }));

  const selectedOption = options.find(
    option => option.value === (el.selected_period || 'last_month'),
  );

  dispatch(
    updateSelectorByKey({
      key: 'period',
      updates: {
        name: el.type_selector,
        options,
        selectedOptions: selectedOption,
        initialSelectedOptions: selectedOption,
        periodType: el.period_type || null,
        availablePeriods: availablePeriods || [],
      },
    }),
  );
};

export const handleComparisonPeriodSelector = (response, el, dispatch) => {
  const currentPeriod = response.find(
    el => el.type_selector === selectorType.period,
  )?.selected_period;
  const dictionary = {};
  el.available_comparison_period.forEach(item => {
    dictionary[item.period] = item.comparisons.map((option: any) => ({
      label: option.label,
      value: option.value,
      isNotActive: !option.available,
    }));
  });
  const options = dictionary[currentPeriod || 'last_month'];
  const selectedOption = options?.filter(
    option =>
      !option.isNotActive && option.value === el.selected_comparison_period,
  )[0];
  dispatch(
    updateSelectorByKey({
      key: 'comparisonPeriod',
      updates: {
        dictOptions: dictionary,
        options: options || [],
        selectedOptions: selectedOption,
        initialSelectedOptions: selectedOption,
      },
    }),
  );
};

export const handleMarketSelector = (el, dispatch, quantity) => {
  const defaultSelectedMarkets: MarketType[] = (
    el.selected_markets?.map((mkt: AvailableMarketsType) => ({
      ...mkt,
      value: mkt.MKT_TAG,
      label: mkt.MKT_NAME,
    })) || []
  ).slice(0, quantity);

  dispatch(
    updateSelectorByKey({
      key: 'market',
      updates: {
        dictOptions: transformMarkets(el.available_markets),
        options: defaultSelectedMarkets,
        selectedOptions: defaultSelectedMarkets,
        initialSelectedOptions: defaultSelectedMarkets,
      },
    }),
  );
};

export const handleMarketAllSelector = (el, dispatch) => {
  const default100SelectedMarkets = {
    ...el.selected_markets_100,
    value: el.selected_markets_100.MKT_TAG,
    label: el.selected_markets_100.MKT_NAME,
  };

  dispatch(
    updateSelectorByKey({
      key: 'marketAll',
      updates: {
        dictOptions: transformMarkets(el.available_markets_100),
        options: [default100SelectedMarkets],
        selectedOptions: [default100SelectedMarkets],
        initialSelectedOptions: [default100SelectedMarkets],
      },
    }),
  );
};

export const handleProductSelector = (
  el,
  dispatch,
  quantity,
  chosenHierarchy,
) => {
  const transformedHierarchy = transformHierarchy(el.available_products);
  const defaultSelectedProducts = (
    el.selected_products?.length
      ? findObjectsByKey(
          transformedHierarchy,
          el.selected_products.map(
            (prd: AvailableProductsType) => prd.PROD_TAG,
          ),
        ).map(el => ({
          label: `${el.title} ${el.key}`,
          value: el.key,
          title: el.title,
          fullTitle: el.fullTitle,
          hierarchyMode: 'advanced',
        }))
      : []
  ).slice(0, quantity);

  dispatch(
    updateSelectorByKey({
      key: 'product',
      updates: {
        selectedOptions: defaultSelectedProducts,
        initialSelectedOptions: defaultSelectedProducts,
        chosenHierarchy: {
          ...chosenHierarchy,
          ...buildChosenHierarchyObject(
            el.selected_products,
            el.available_products,
          ),
        },
        dictOptions: transformedHierarchy,
        options: defaultSelectedProducts,
      },
    }),
  );
};

export const handleProductAllSelector = (
  el,
  dispatch,
  quantity,
  chosenHierarchy,
) => {
  const transformedHierarchy = transformHierarchy(el.available_products_100);

  const selectedProducts100 = [el.selected_products_100];

  const defaultSelectedProducts = (
    selectedProducts100?.length
      ? findObjectsByKey(
          transformedHierarchy,
          selectedProducts100.map((prd: AvailableProductsType) => prd.PROD_TAG),
        ).map(el => ({
          label: `${el.title} ${el.key}`,
          value: el.key,
          title: el.title,
          fullTitle: el.fullTitle,
          hierarchyMode: 'advanced',
        }))
      : []
  ).slice(0, quantity);

  dispatch(
    updateSelectorByKey({
      key: 'productAll',
      updates: {
        initialSelectedOptions: defaultSelectedProducts,
        selectedOptions: defaultSelectedProducts,
        chosenHierarchy: {
          ...chosenHierarchy,
          ...buildChosenHierarchyObject(
            selectedProducts100,
            el.available_products_100,
          ),
        },
        dictOptions: transformedHierarchy,
        options: defaultSelectedProducts,
      },
    }),
  );
};

//TODO: delete duplicate
export function formatFulldesc(
  unFormattedValue: string,
  options?: LevelOption,
) {
  if (typeof unFormattedValue !== 'string') return unFormattedValue;

  let value = unFormattedValue;

  if (unFormattedValue.split('|<--|').length) {
    value = unFormattedValue.split('|<--|')[0];
  }

  if (typeof value !== 'string') return value;

  const separator = localStorage.getItem('sep_func_separator') || '|-|';
  const joiner = localStorage.getItem('sep_func_joiner') || ' ';
  const storageLevels = localStorage.getItem('sep_func_level')
    ? +localStorage.getItem('sep_func_level')
    : 1;

  const splitedValues = value.toString().split(separator);

  if (!options || options.type === 'full') return splitedValues.join(joiner);

  if (options.type === 'short') return splitedValues[splitedValues.length - 1];
  if (options.type === 'custom')
    return splitedValues
      .reverse()
      .filter((_, i) => i < (options.customLevel || storageLevels))
      .reverse()
      .join(joiner);

  return value;
}
