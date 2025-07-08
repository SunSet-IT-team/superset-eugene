import React, { useEffect, useMemo, useState } from 'react';
import { styled } from '@superset-ui/core';
import { useDispatch, useSelector } from 'react-redux';
import {
  getFilteredCompanies,
  getFilteredOrders,
  getUserCompanies,
  getUserOrders,
  OptionType,
} from '../../dashboard/reducers/ordersSlice';
import { RootState } from '../../views/store';
import { OrderLabel } from './components';
import { SmartSelect } from './components/SmartSelect';
import {
  useDropdownVisibleChange,
  useEntitySelectHandler,
  useSearchChange,
} from './utils/hooks';
import { useDebounceValue } from '../../hooks/useDebounceValue';
import { useIsRouteActive } from '../../hooks/useIsRouteActive';

const Wrapper = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.gridUnit * 3}px;

  .ant-select-selector {
    border: 0 transparent !important;
  }

  .ant-select-item {
    align-items: center;
  }

  .ant-select-item-option-content {
    overflow: visible;
    white-space: break-spaces;
  }

  .ant-select-focused .ant-select-selector {
    box-shadow: none !important;
  }
`;

export const OrdersSelection = () => {
  const isWelcomePage = useIsRouteActive('/welcome');
  const ORDER_SELECT_WIDTH = 450;

  const dispatch = useDispatch();
  const {
    companies: {
      filteredOptions: filteredCompaniesOptions,
      selectedValue: selectedCompany,
      allOptions: allCompaniesOptions,
    },
    orders: {
      filteredOptions: filteredOrdersOptions,
      selectedValue: selectedOrder,
      allOptions: allOrdersOptions,
    },
  } = useSelector((state: RootState) => state.orders);

  const [companyQuery, setCompanyQuery] = useState('');
  const [orderQuery, setOrderQuery] = useState('');

  const debouncedCompanyQuery = useDebounceValue(companyQuery, 500);
  const debouncedOrderQuery = useDebounceValue(orderQuery, 500);

  const onSelectCompany = useEntitySelectHandler('companies');
  const onSelectOrder = useEntitySelectHandler('orders');

  const onCloseOrdersDropdown = useDropdownVisibleChange(
    'orders',
    setOrderQuery,
  );
  const onCloseCompaniesDropdown = useDropdownVisibleChange(
    'companies',
    setCompanyQuery,
  );

  const onSearchCompany = useSearchChange(setCompanyQuery);
  const onSearchOrder = useSearchChange(setOrderQuery);

  useEffect(() => {
    dispatch(getUserCompanies());
  }, [dispatch]);

  useEffect(() => {
    if (debouncedCompanyQuery) {
      dispatch(getFilteredCompanies(debouncedCompanyQuery));
    }
  }, [debouncedCompanyQuery, dispatch]);

  useEffect(() => {
    if (selectedCompany) {
      dispatch(getUserOrders(selectedCompany.id));
    }
  }, [dispatch, selectedCompany]);

  useEffect(() => {
    if (selectedCompany && debouncedOrderQuery) {
      dispatch(
        getFilteredOrders({
          companyId: selectedCompany.id,
          query: debouncedOrderQuery,
        }),
      );
    }
  }, [debouncedOrderQuery, selectedCompany, dispatch]);

  const ordersOptionsToDisplay = debouncedOrderQuery
    ? filteredOrdersOptions
    : allOrdersOptions;
  const companiesOptionsToDisplay = debouncedCompanyQuery
    ? filteredCompaniesOptions
    : allCompaniesOptions;

  const optionsForOrders = useMemo(
    () =>
      ordersOptionsToDisplay.map((option: OptionType) => ({
        id: option.id,
        value: option.value,
        children: option.label,
        label: option.isOnHold ? <OrderLabel {...option} /> : option.label,
      })),
    [ordersOptionsToDisplay],
  );

  return (
    <Wrapper>
      <SmartSelect
        options={optionsForOrders}
        allOptions={allOrdersOptions}
        onChange={onSelectOrder}
        selectedOption={selectedOrder}
        optionLabelProp="children"
        maxWidth={ORDER_SELECT_WIDTH}
        onSearchChange={onSearchOrder}
        searchValue={orderQuery}
        onDropdownVisibleChange={onCloseOrdersDropdown}
        canShowSelect={isWelcomePage}
      />
      <SmartSelect
        options={companiesOptionsToDisplay}
        allOptions={allCompaniesOptions}
        onChange={onSelectCompany}
        selectedOption={selectedCompany}
        onSearchChange={onSearchCompany}
        searchValue={companyQuery}
        onDropdownVisibleChange={onCloseCompaniesDropdown}
        canShowSelect={isWelcomePage}
        isBold
      />
    </Wrapper>
  );
};
