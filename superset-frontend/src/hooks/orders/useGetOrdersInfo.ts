import { useSelector } from 'react-redux';
import { useMemo } from 'react';
import { RootState } from '../../views/store';
import { OrdersInfo } from '../../types/Orders';

export const useGetOrdersInfo = (): OrdersInfo => {
  const {
    orders: { selectedValue: selectedOrder, loaded: isOrdersLoaded },
  } = useSelector((state: RootState) => state.orders);

  return useMemo(
    () => ({
      isOrdersLoaded,
      selectedOrderId: selectedOrder?.value ?? 0,
    }),
    [isOrdersLoaded, selectedOrder],
  );
};
