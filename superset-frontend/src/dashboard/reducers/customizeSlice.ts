import { createSlice, PayloadAction } from '@reduxjs/toolkit';

type LevelType = 'full' | 'short' | 'custom';

export type LevelOption = {
  type: LevelType;
  customLevel?: number;
};

export type LastNOptionsType = {
  isChartsLevelOnly: boolean;
  chartLevel: LevelOption;
  selectorLevel: LevelOption;
  constructorLevel: LevelOption;
  numberFormat?: string;
};

export type CustomizeStateType = {
  lastNOptions: LastNOptionsType;
  tempLastNOptions: LastNOptionsType;
};

const initialLastNConfig: LastNOptionsType = {
  isChartsLevelOnly: true,
  chartLevel: {
    type: 'custom',
    customLevel: 3
  },
  constructorLevel: {
    type: 'full',
  },
  selectorLevel: {
    type: 'full',
  },
  numberFormat: 'SMART_NUMBER',
};

const initialState: CustomizeStateType = {
  lastNOptions: initialLastNConfig,
  tempLastNOptions: initialLastNConfig,
};

export const customizeSlice = createSlice({
  name: 'customizeSlice',
  initialState,
  reducers: {
    applyTempConfig: (state: CustomizeStateType) => {
      state.lastNOptions = state.tempLastNOptions;
    },
    clearTempConfig: (state: CustomizeStateType) => {
      state.tempLastNOptions = initialLastNConfig;
    },
    toggleOnltChartFlag: (state: CustomizeStateType) => {
      state.tempLastNOptions.isChartsLevelOnly =
        !state.tempLastNOptions.isChartsLevelOnly;
    },
    setShowLastNLevel: (
      state: CustomizeStateType,
      action: PayloadAction<{
        key: Exclude<
          keyof typeof initialState.lastNOptions,
          'isChartsLevelOnly' | 'numberFormat'
        >;
        type: LevelType;
        customLevel?: number;
      }>,
    ) => {
      const { key, type, customLevel } = action.payload;

      state.tempLastNOptions[key] = {
        type,
        customLevel,
      };
    },
    setNumberFormat: (
      state: CustomizeStateType,
      action: PayloadAction<string>,
    ) => {
      state.tempLastNOptions.numberFormat = action.payload;
    },
  },
});

export const {
  setShowLastNLevel,
  toggleOnltChartFlag,
  applyTempConfig,
  clearTempConfig,
  setNumberFormat,
} = customizeSlice.actions;
export default customizeSlice.reducer;
