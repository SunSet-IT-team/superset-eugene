import { useDispatch } from 'react-redux';
import { Dispatch, SetStateAction, useCallback } from 'react';
import {
  SliceKey,
  OptionType,
  selectEntityAndSetOrder,
  resetEntityFilter,
} from '../../../dashboard/reducers/ordersSlice';
import { ORDERS_STORAGE_KEYS } from '../../../constants';

const getStorageKey = (key: SliceKey) => {
  switch (key) {
    case 'companies': {
      return ORDERS_STORAGE_KEYS.companies;
    }
    case 'orders': {
      return ORDERS_STORAGE_KEYS.orders;
    }
    default:
      return '';
  }
};

export function useEntitySelectHandler(key: SliceKey) {
  const dispatch = useDispatch();

  return useCallback(
    (_: string, option: OptionType) => {
      dispatch(selectEntityAndSetOrder({ key, option }));
      try {
        const storageKey = getStorageKey(key);
        localStorage.setItem(`${storageKey}`, JSON.stringify(option));
      } catch (e) {
        console.warn('Failed to save selected value in localStorage:', e);
      }
    },
    [dispatch, key],
  );
}

export const useDropdownVisibleChange = (
  key: SliceKey,
  setter: Dispatch<SetStateAction<string>>,
) => {
  const dispatch = useDispatch();

  return useCallback(
    (open: boolean) => {
      if (!open) {
        dispatch(resetEntityFilter({ key }));
        setter('');
      }
    },
    [dispatch, key, setter],
  );
};

export const useSearchChange = <T>(setter: Dispatch<SetStateAction<T>>) =>
  useCallback((value: T) => setter(value), [setter]);
