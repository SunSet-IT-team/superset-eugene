import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { SupersetClient } from '@superset-ui/core';
import rison from 'rison';
import { getFromStorage } from './utils/utils';
import { ORDERS_STORAGE_KEYS } from '../../constants';

export type OptionType = {
  id: number;
  label: string;
  value: number;
  isOnHold?: boolean;
};
type ILookupItem = { id: number; name: string; on_hold?: boolean };
export type SliceKey = 'orders' | 'companies';

type CommonEntityState = {
  filteredOptions: OptionType[];
  selectedValue: OptionType | null;
  loaded: boolean;
  allOptions: OptionType[];
};

export type OrdersStateType = Record<SliceKey, CommonEntityState>;

const initialState: OrdersStateType = {
  orders: {
    filteredOptions: [],
    allOptions: [],
    selectedValue: null,
    loaded: false,
  },
  companies: {
    filteredOptions: [],
    allOptions: [],
    selectedValue: null,
    loaded: false,
  },
};

const mapToOptionType = (option: ILookupItem): OptionType => ({
  id: option.id,
  label: option.name,
  value: option.id,
  isOnHold: option.on_hold,
});

export const getUserCompanies = createAsyncThunk<{
  options: OptionType[];
  selected: OptionType | null;
}>('companies/getUserCompanies', async () => {
  try {
    const res = await SupersetClient.get({
      endpoint: `/api/v1/me/companies/`,
    });
    const options = res.json.result.companies.map(mapToOptionType);
    const selected = getFromStorage<OptionType>(
      ORDERS_STORAGE_KEYS.companies,
      options[0] ?? null,
    );
    return { options, selected };
  } catch {
    return { options: [], selected: null };
  }
});

export const getUserOrders = createAsyncThunk<
  { options: OptionType[]; selected: OptionType | null },
  number
>('orders/getUserOrders', async companyId => {
  try {
    const params = { company_id: companyId };
    const res = await SupersetClient.get({
      endpoint: `/api/v1/me/orders/?q=${rison.encode(params)}`,
    });
    const options = res.json.result.orders.map(mapToOptionType);
    const selected = options[0] ?? null;
    return { options, selected };
  } catch {
    return { options: [], selected: null };
  }
});

export const getFilteredCompanies = createAsyncThunk<
  { options: OptionType[] },
  string
>('companies/getFilteredCompanies', async (query = '') => {
  try {
    const res = await SupersetClient.get({
      endpoint: `/api/v1/me/companies/?s=${query}`,
    });
    const options = res.json.result.companies.map(mapToOptionType);
    return { options };
  } catch {
    return { options: [] };
  }
});

export const getFilteredOrders = createAsyncThunk<
  { options: OptionType[] },
  { companyId: number; query?: string }
>('orders/getFilteredOrders', async ({ companyId, query = '' }) => {
  try {
    const params = { company_id: companyId, s: query };
    const res = await SupersetClient.get({
      endpoint: `/api/v1/me/orders/?q=${rison.encode(params)}`,
    });
    const options = res.json.result.orders.map(mapToOptionType);
    return { options };
  } catch {
    return { options: [], selected: null };
  }
});

export const ordersSlice = createSlice({
  name: 'ordersSlice',
  initialState,
  reducers: {
    updateEntity: <K extends SliceKey>(
      state: OrdersStateType,
      action: PayloadAction<{ key: K; option: OptionType }>,
    ) => {
      const { key, option } = action.payload;
      state[key].selectedValue = option;
    },
    resetEntityFilter: <K extends SliceKey>(
      state: OrdersStateType,
      action: PayloadAction<{ key: K }>,
    ) => {
      const { key } = action.payload;
      state[key].filteredOptions = state[key].allOptions;
    },
  },
  extraReducers: builder => {
    builder.addCase(getUserCompanies.fulfilled, (state, action) => {
      state.companies.filteredOptions = action.payload.options;
      state.companies.allOptions = action.payload.options;
      state.companies.selectedValue = action.payload.selected;
      state.companies.loaded = true;
    });
    builder.addCase(getFilteredCompanies.fulfilled, (state, action) => {
      state.companies.filteredOptions = action.payload.options;
      state.companies.loaded = true;
    });

    builder.addCase(getUserOrders.fulfilled, (state, action) => {
      state.orders.filteredOptions = action.payload.options;
      state.orders.allOptions = action.payload.options;
      state.orders.selectedValue = action.payload.selected;
      state.orders.loaded = true;
    });
    builder.addCase(getFilteredOrders.fulfilled, (state, action) => {
      state.orders.filteredOptions = action.payload.options;
      state.orders.loaded = true;
    });
    builder.addCase(getFilteredOrders.rejected, state => {
      state.orders.loaded = true;
    });
    builder.addCase(getUserOrders.rejected, state => {
      state.orders.loaded = true;
    });
  },
});

export const { updateEntity, resetEntityFilter } = ordersSlice.actions;

export const selectEntityAndSetOrder = createAsyncThunk<
  void,
  { key: SliceKey; option: OptionType }
>('orders/selectEntityAndSetOrder', async ({ key, option }, { dispatch }) => {
  dispatch(updateEntity({ key, option }));
});

export default ordersSlice.reducer;
