import {ReactNode} from 'react';
import type {DataNode} from 'antd/es/tree';

interface MarketOption {
  label: string;
  value: string;
}

export interface ProductOption {
  children?: string | string[];
  key?: string;
  label: string;
  value: string;
  title: string;
  fullTitle: string;
  hierarchyMode: 'basic' | 'advanced';
  ids?: string[];
}

export interface ProductDictOption extends DataNode {
  type: string;
  parent: string;
  fullTitle: string;
  hierarchyMode: 'basic' | 'advanced';
  ids?: string[];
  children: ProductDictOption[];
}

interface PeriodOption {
  label: string;
  value: string | boolean | number;
  isNotActive?: boolean;
  isCustom?: boolean;
}

interface FactOption {
  label: string;
  value: string | boolean | number;
}

export type SelectorOption =
  | MarketOption
  | ProductOption
  | PeriodOption
  | FactOption
  | undefined;

interface Param {
  name: string;
  initialSelectedOptions: SelectorOption | SelectorOption[];
  selectedOptions: SelectorOption | SelectorOption[];
  isActive: boolean;
  dashboardQuantity: number | null;
  constructorQuantity?: number | null;
}

interface MarketType extends Param {
  settingsModal?: ReactNode;
  options: MarketOption[];
  dictOptions: DataNode[];
  settingsModalType: string;
}

export interface ProductType extends Param {
  options: ProductOption[];
  settingsModal?: ReactNode;
  dictOptions: ProductDictOption[];
  settingsModalType: string;
  onlyAdvancedMode: boolean;
  chosenHierarchy: {
    value: string;
    chosenItems: string[];
    chosenFilters: { [key: string]: string[] };
  };
}

interface PeriodType extends Param {
  settingsModal?: ReactNode;
  settingsModalType: string;
  isValueCustom?: boolean;
  periodType: string | null;
  availablePeriods: string[];
  options: PeriodOption[];
}

interface ComparisonPeriodType extends Param {
  settingsModal?: ReactNode;
  settingsModalType: string;
  isValueCustom?: boolean;
  options: PeriodOption[];
  dictOptions: {
    [key: string]: PeriodOption[];
  };
}

interface FactsType extends Param {
  settingsModal?: ReactNode;
  options: FactOption[];
  dictOptions: {
    label: string;
    value: string | boolean | number;
    isNotActive?: boolean;
  }[];
  selectedDict: {
    datasource_name: string;
    datasource_type: string;
    datasource_id: string;
    column: string;
    row_id: number | null;
    options_ids: { id: number; name: string }[];
  };
}

export interface InitialState {
  selectors: {
    market: MarketType;
    marketAll: MarketType;
    product: ProductType;
    productAll: ProductType;
    period: PeriodType;
    comparisonPeriod: ComparisonPeriodType;
    facts: FactsType;
  };
  initialSelectorsToGet: string[];
  selectorsToGet: string[];
  selectorsInfoLoaded: boolean;
  requiresChartUpdate: boolean;
}
