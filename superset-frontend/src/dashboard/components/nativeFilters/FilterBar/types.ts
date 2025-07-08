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
  DataMask,
  DataMaskStateWithId,
  Divider,
  Filter,
} from '@superset-ui/core';
import { ReactNode } from 'react';
import { FilterBarOrientation } from 'src/dashboard/types';
import { DataNode } from 'antd/es/tree';

interface CommonFiltersBarProps {
  filterActions: ReactNode;
  selectorActions: ReactNode;
  customizeActions: ReactNode;
  canEdit: boolean;
  dataMaskSelected: DataMaskStateWithId;
  filterValues: (Filter | Divider)[];
  isInitialized: boolean;
  onSelectionChange: (
    filter: Pick<Filter, 'id'> & Partial<Filter>,
    dataMask: Partial<DataMask>,
  ) => void;
}

interface VerticalBarConfig {
  filtersOpen: boolean;
  selectorsOpen: boolean;
  customizerOpen: boolean;
  height: number | string;
  offset: number;
  toggleFiltersBar: any;
  toggleSelectorsBar: any;
  toggleCustomizerBar: any;
  width: number;
  selectors: any;
  updateSelected: () => void;
}

export interface FiltersBarProps {
  hidden?: boolean;
  orientation: FilterBarOrientation;
  verticalConfig?: VerticalBarConfig;
}

export type HorizontalBarProps = CommonFiltersBarProps & {
  dashboardId: number;
};

export type VerticalBarProps = Omit<FiltersBarProps, 'orientation'> &
  CommonFiltersBarProps &
  VerticalBarConfig;

export type AvailableMarketsType = {
  MKT_LEVEL: number;
  MKT_NAME: string;
  MKT_PARENT_TAG: string;
  MKT_TAG: string;
};

export type AvailableProductsType = {
  PROD_LEVEL: number;
  PROD_LEVEL_NAME: string;
  PROD_PARENT_TAG: string;
  PROD_TAG: string;
  PROD_NAME: string;
};

export type MarketHierarchyType = DataNode & {
  children: Array<MarketHierarchyType>;
};

export type AvailablePeriodsType = {
  available: boolean;
  value: string;
  label: string;
};

export type MarketType = AvailableMarketsType & {
  value: string;
  label: string;
};

type PeriodSelector = {
  label_selector: string;
  avaliable_periods?: AvailablePeriodsType[];
  selected_period: string | null;
  type_selector: 'Period';
  selected?: boolean;
};

type MarketSelector = {
  label_selector: string;
  available_markets?: AvailableMarketsType[];
  selected_markets?: AvailableMarketsType[];
  type_selector: 'Market';
  selected?: boolean;
  max_selection?: number;
};

type ProductSelector = {
  label_selector: string;
  available_products?: AvailableProductsType[];
  selected_products?: AvailableProductsType[];
  type_selector: 'Product';
  selected?: boolean;
  max_selection: number;
};

type FactsSelector = {
  label_selector: string;
  selected_facts?: AvailableProductsType[];
  type_selector: 'Facts';
  selected?: boolean;
  datasource_name: string;
  datasource_type: string;
  datasource_id: number | string;
  column_name: string;
};

export type SelectorsApiType = (
  | PeriodSelector
  | MarketSelector
  | ProductSelector
  | FactsSelector
)[];
