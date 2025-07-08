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
import React, { useCallback, useState } from 'react';
import { RootState } from 'src/dashboard/types';
import { useDispatch, useSelector } from 'react-redux';
import Button from 'src/components/Button';
import { styled } from '@superset-ui/core';
import {
  updateComparisonPeriodOptions,
  updateOptions,
  updateSelectorByKey,
} from 'src/dashboard/features/selectors/selectorsSlice';
import {
  periodGranularity,
  selectorModalType,
} from 'src/dashboard/components/nativeFilters/constants';
import PeriodConfigModal from '../PeriodConfigModal/PeriodConfigModal';
import { checkDefaultPeriodAvailability } from '../../utils';

export interface FCBProps {
  modalType: 'period' | 'comparisonPeriod';
  onClick?: () => void;
  children?: React.ReactNode;
}

const HeaderButton = styled(Button)`
  padding: 0;
  height: min-content;
  color: ${({ theme }) => theme.colors.grayscale.dark1};
  text-transform: capitalize;
  font-size: 14px;
  &:hover,
  :focus {
    color: ${({ theme }) => theme.colors.grayscale.dark1};
    border: none;
    box-shadow: none;
    outline: none;
  }
  :disabled {
    svg {
      color: ${({ theme }) => theme.colors.grayscale.light1};
    }
    color: ${({ theme }) => theme.colors.grayscale.light1};
  }
`;

export const PeriodConfigurationLink: React.FC<FCBProps> = ({
  modalType,
  onClick,
  children,
}) => {
  const dispatch = useDispatch();
  const [isOpen, setOpen] = useState(false);

  const isComparisonPeriod = modalType === selectorModalType.comparisonPeriod;
  const { selectedOptions, periodType, availablePeriods } = useSelector(
    (state: RootState) => state.selectors.selectors.period,
  );

  const { value: periodValue } = selectedOptions || { value: '' };

  const isWeekMode = periodType === periodGranularity.week;

  const close = useCallback(() => {
    setOpen(false);
  }, [setOpen]);

  const submit = useCallback(
    (period: { label: string; value: string }) => {
      if (isComparisonPeriod) {
        dispatch(
          updateComparisonPeriodOptions({
            periodValue,
            option: { ...period, isCustom: true },
          }),
        );
        dispatch(
          updateSelectorByKey({
            key: modalType,
            updates: {
              isValueCustom: true,
              selectedOptions: period,
            },
          }),
        );
      } else {
        const defaultComparisonOptions = [
          {
            value: 'analogous_period_last_year',
            label: 'Аналогичный период прошлого года',
            isNotActive: !checkDefaultPeriodAvailability(
              availablePeriods,
              isWeekMode,
              period.value,
              'analogous_period_last_year',
            ),
          },
          {
            value: 'previous_period',
            label: 'Предыдущий период',
            isNotActive: !checkDefaultPeriodAvailability(
              availablePeriods,
              isWeekMode,
              period.value,
              'previous_period',
            ),
          },
        ];
        dispatch(
          updateOptions({
            key: modalType,
            option: { ...period, isCustom: true },
          }),
        );
        defaultComparisonOptions.forEach(option => {
          dispatch(
            updateComparisonPeriodOptions({
              periodValue: period.value,
              option,
            }),
          );
        });
        dispatch(
          updateSelectorByKey({
            key: modalType,
            updates: {
              selectedOptions: period,
              isValueCustom: true,
            },
          }),
        );
        const updateOption = defaultComparisonOptions.filter(
          option => !option.isNotActive,
        )[0];
        dispatch(
          updateSelectorByKey({
            key: 'comparisonPeriod',
            updates: {
              options: defaultComparisonOptions,
              selectedOptions: updateOption || undefined,
              isValueCustom: false,
            },
          }),
        );
      }
      close();
    },
    [
      isComparisonPeriod,
      close,
      dispatch,
      periodValue,
      modalType,
      availablePeriods,
      isWeekMode,
    ],
  );

  const handleClick = useCallback(() => {
    setOpen(true);
    if (onClick) {
      onClick();
    }
  }, [setOpen, onClick]);

  return (
    <>
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
      <HeaderButton
        buttonStyle="link"
        buttonSize="small"
        onClick={handleClick}
        disabled={isComparisonPeriod && !periodValue}
      >
        {children}
      </HeaderButton>
      <PeriodConfigModal
        periodValue={periodValue}
        availablePeriods={availablePeriods}
        isComparisonPeriod={isComparisonPeriod}
        isWeekMode={isWeekMode}
        isOpen={isOpen}
        onSave={submit}
        onCancel={close}
      />
    </>
  );
};

export default React.memo(PeriodConfigurationLink);
