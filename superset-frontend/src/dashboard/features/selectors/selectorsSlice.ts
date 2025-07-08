/* eslint-disable no-param-reassign */
import {createSlice, PayloadAction} from '@reduxjs/toolkit';
import MarketConfigurationLink
  from 'src/dashboard/components/nativeFilters/SelectorsBar/SelectorModals/MarketModal/MarketConfigurationLink';
import ProductConfigurationLink
  from 'src/dashboard/components/nativeFilters/SelectorsBar/SelectorModals/ProductModal/ProductConfigurationLink';
import PeriodConfigurationLink
  from 'src/dashboard/components/nativeFilters/SelectorsBar/SelectorModals/PeriodModal/PeriodConfigurationLink';
import {selectorModalType, selectorName,} from 'src/dashboard/components/nativeFilters/constants';
import {InitialState, SelectorOption} from './types';

const initialState: InitialState = {
  selectors: {
    market: {
      name: selectorName.market,
      initialSelectedOptions: [],
      selectedOptions: [],
      isActive: false,
      options: [],
      dashboardQuantity: 1,
      constructorQuantity: 1,
      settingsModal: MarketConfigurationLink,
      settingsModalType: selectorModalType.market,
      dictOptions: [],
    },
    marketAll: {
      name: selectorName.marketAll,
      initialSelectedOptions: [],
      selectedOptions: [],
      isActive: false,
      options: [],
      dashboardQuantity: 1,
      settingsModal: MarketConfigurationLink,
      settingsModalType: selectorModalType.marketAll,
      dictOptions: [],
    },
    product: {
      name: selectorName.product,
      initialSelectedOptions: [],
      selectedOptions: [],
      isActive: false,
      options: [],
      dashboardQuantity: 10,
      constructorQuantity: 10,
      onlyAdvancedMode: false,
      settingsModal: ProductConfigurationLink,
      settingsModalType: selectorModalType.product,
      dictOptions: [],
      chosenHierarchy: {
        value: '',
        chosenItems: [''],
        chosenFilters: {},
      },
    },
    productAll: {
      name: selectorName.productAll,
      initialSelectedOptions: [],
      selectedOptions: [],
      isActive: false,
      options: [],
      dashboardQuantity: 1,
      onlyAdvancedMode: false,
      settingsModal: ProductConfigurationLink,
      settingsModalType: selectorModalType.productAll,
      dictOptions: [],
      chosenHierarchy: {
        value: '',
        chosenItems: [''],
        chosenFilters: {},
      },
    },
    period: {
      name: selectorName.period,
      initialSelectedOptions: [],
      selectedOptions: [],
      isValueCustom: false,
      isActive: false,
      options: [],
      dashboardQuantity: 1,
      periodType: null,
      availablePeriods: [],
      settingsModal: PeriodConfigurationLink,
      settingsModalType: selectorModalType.period,
    },
    comparisonPeriod: {
      name: selectorName.comparisonPeriod,
      initialSelectedOptions: [],
      selectedOptions: [],
      isValueCustom: false,
      isActive: false,
      options: [],
      dictOptions: {},
      dashboardQuantity: 1,
      settingsModal: PeriodConfigurationLink,
      settingsModalType: selectorModalType.comparisonPeriod,
    },
    facts: {
      name: selectorName.facts,
      initialSelectedOptions: [],
      selectedOptions: [],
      isActive: false,
      dashboardQuantity: 1,
      options: [],
      dictOptions: [],
      selectedDict: {
        datasource_name: 'bi_fact_list',
        datasource_type: '',
        datasource_id: '',
        column: 'sdesc_ru',
        row_id: null,
        options_ids: [],
      },
    },
  },
  initialSelectorsToGet: [],
  selectorsToGet: [],
  selectorsInfoLoaded: false,
  requiresChartUpdate: false,
};

export const selectorsSlice = createSlice({
  name: 'selectors',
  initialState,
  reducers: {
    updateSelectedOptions: (
      state,
      action: PayloadAction<{
        key: keyof InitialState;
        options: SelectorOption | SelectorOption[];
      }>,
    ) => {
      const { key, options } = action.payload;
      state.selectors[key].selectedOptions = options;
    },

    updateInitialSelectedOptions: (
      state,
      action: PayloadAction<{
        key: keyof InitialState;
        options: SelectorOption | SelectorOption[];
      }>,
    ) => {
      const { key, options } = action.payload;
      state.selectors[key].initialSelectedOptions = options;
    },

    updateOptions: (
      state,
      action: PayloadAction<{
        key: keyof InitialState;
        option: SelectorOption;
      }>,
    ) => {
      const { key, option } = action.payload;
      state.selectors[key].options.push(option);
    },

    updateSelectorByKey: (
      state,
      action: PayloadAction<{
        key: keyof InitialState['selectors'];
        updates: Partial<
          InitialState['selectors'][keyof InitialState['selectors']]
        >;
      }>,
    ) => {
      const { key, updates } = action.payload;
      state.selectors[key] = {
        ...state.selectors[key],
        ...updates,
      };
    },

    updateComparisonPeriodOptions: (
      state,
      action: PayloadAction<{
        periodValue: string;
        option: {
          label: string;
          value: string;
          isNotActive?: boolean;
          isCustom?: boolean;
        };
      }>,
    ) => {
      const { periodValue, option } = action.payload;
      const chosenDictOptions =
        state.selectors.comparisonPeriod.dictOptions[periodValue] || [];
      state.selectors.comparisonPeriod.dictOptions[periodValue] = [
        ...chosenDictOptions,
        option,
      ];
      state.selectors.comparisonPeriod.options.push(option);
    },

    updateInitialSelectorsToGet: (state, action: PayloadAction<string[]>) => {
      state.initialSelectorsToGet = action.payload;
    },

    updateSelectorsToGet: (state, action: PayloadAction<string[]>) => {
      state.selectorsToGet = action.payload;
    },

    setSelectorsInfoLoaded: (state, action: PayloadAction<boolean>) => {
      state.selectorsInfoLoaded = action.payload;
    },

    setRequiresChartUpdate: (state, action: PayloadAction<boolean>) => {
      state.requiresChartUpdate = action.payload;
    },

    resetAllParams: state => {
      state.selectors = initialState.selectors;
      state.initialSelectorsToGet = initialState.initialSelectorsToGet;
      state.selectorsToGet = initialState.selectorsToGet;
      state.selectorsInfoLoaded = initialState.selectorsInfoLoaded;
      state.requiresChartUpdate = initialState.requiresChartUpdate;
    },
  },
});

export const {
  updateSelectedOptions,
  updateInitialSelectedOptions,
  updateOptions,
  updateSelectorByKey,
  updateComparisonPeriodOptions,
  updateInitialSelectorsToGet,
  updateSelectorsToGet,
  setSelectorsInfoLoaded,
  setRequiresChartUpdate,
  resetAllParams,
} = selectorsSlice.actions;

export default selectorsSlice.reducer;
