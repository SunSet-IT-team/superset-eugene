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
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { isEqual } from 'lodash';
import { css, styled, t, useTheme } from '@superset-ui/core';
import Icons from 'src/components/Icons';
import ErrorBoundary from 'src/components/ErrorBoundary';
import { StyledModal } from 'src/components/Modal';
import useEffectEvent from 'src/hooks/useEffectEvent';
import { Input } from 'src/components/Input';
import Footer from 'src/dashboard/components/nativeFilters/components/Footer/Footer';
import ruLocale from 'antd/lib/date-picker/locale/ru_RU';
import enLocale from 'antd/lib/date-picker/locale/en_US';
import { PickerLocale } from 'antd/lib/date-picker/generatePicker';
import moment, { Moment } from 'moment';
import { Theme } from '@emotion/react';
import Button from 'src/components/Button';
import { selectorName } from 'src/dashboard/components/nativeFilters/constants';
import PeriodConfigurePane from './PeriodConfigurePane';
import {
  getFormattedDates,
  getLimitFromPeriodValue,
  getWeekDifference,
} from '../../utils';
import WeekDateInput from './WeekDateInput';
import MonthDateInput from './MonthDateInput';
import '../style/style.css';
import { useSelector } from 'react-redux';

const MODAL_MARGIN = 16;
const MIN_WIDTH = 620;

const StyledModalWrapper = styled(StyledModal)<{ expanded: boolean }>`
  min-width: ${MIN_WIDTH}px;
  width: ${({ expanded }) => (expanded ? '100%' : MIN_WIDTH)} !important;

  @media (max-width: ${MIN_WIDTH + MODAL_MARGIN * 2}px) {
    width: 100% !important;
    min-width: auto;
  }

  .ant-modal-body {
    padding: 0px;
  }

  ${({ expanded }) =>
    expanded &&
    css`
      height: 100%;

      .ant-modal-body {
        flex: 1 1 auto;
      }
      .ant-modal-content {
        height: 100%;
      }
    `}
`;

export const StyledModalBody = styled.div<{ expanded: boolean }>`
  display: flex;
  height: ${({ expanded }) => (expanded ? '100%' : '400px')};
  flex-direction: row;
  flex: 1;
  .filters-list {
    width: ${({ theme }) => theme.gridUnit * 50}px;
    overflow: auto;
  }
`;

export const WarningContainer = styled.div`
  margin-top: ${({ theme }) => theme.gridUnit * 2}px;
  color: ${({ theme }) => theme.colors.warning.base};
`;

export const StyledExpandButtonWrapper = styled.div`
  margin-left: ${({ theme }) => theme.gridUnit * 4}px;
`;

const DateRangeContainer = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.gridUnit * 6}px;
  justify-content: start;
`;

const SettingsContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.gridUnit * 6}px;
`;

export interface PeriodConfigModalProps {
  isOpen: boolean;
  onSave: (period: { label: string; value: string }) => Promise<void>;
  onCancel: () => void;
  isComparisonPeriod: boolean;
  isWeekMode: boolean;
  periodValue: string;
  availablePeriods: string[];
}

const PeriodNameInput = React.memo(
  ({
    name,
    setName,
    theme,
  }: {
    name: string;
    setName: (value: string) => void;
    theme: Theme;
  }) => (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: `${theme.gridUnit * 126}px`,
      }}
    >
      <label
        htmlFor="name"
        style={{
          fontSize: `${theme.typography.sizes.m}px`,
          color: `${theme.colors.grayscale.dark1}`,
        }}
      >
        {`${t('Period name')}:`}
      </label>
      <Input
        key="name"
        id="name"
        value={name}
        onChange={e => setName(e.target.value)}
      />
      <Button
        disabled={!name}
        buttonStyle="link"
        style={{
          alignSelf: 'end',
          fontWeight: 'normal',
          fontSize: theme.typography.sizes.xs,
        }}
        buttonSize="xsmall"
        onClick={() => {
          setName(null);
        }}
      >
        {t('Clear')}
      </Button>
    </div>
  ),
);

const PeriodCounter = ({
  diff,
  theme,
  counterTitle,
}: {
  diff: number;
  theme: Theme;
  counterTitle: string;
}) => (
  <div
    style={{
      fontSize: `${theme.typography.sizes.m}px`,
      color: `${theme.colors.grayscale.dark1}`,
    }}
  >
    {`${t(counterTitle)}: ${diff}`}
  </div>
);

function PeriodConfigModal({
  isComparisonPeriod,
  isWeekMode,
  periodValue,
  availablePeriods,
  isOpen,
  onSave,
  onCancel,
}: PeriodConfigModalProps) {
  const initialPeriodData: {
    fromDate: Moment | null;
    toDate: Moment | null;
    name: string;
  } = {
    fromDate: null,
    toDate: null,
    name: '',
  };

  const isRuLangActive = t('ru') === 'Русский';
  const locale = isRuLangActive ? ruLocale : enLocale;
  moment.locale(isRuLangActive ? 'ru' : 'en');

  const [fromDate, setFromDate] = useState<Moment | null>(null);
  const [toDate, setToDate] = useState<Moment | null>(null);
  const [name, setName] = useState('');
  const { options } = useSelector(
    state =>
      state?.selectors.selectors[
        isComparisonPeriod ? 'comparisonPeriod' : 'period'
      ],
  );

  const diffFormat = isWeekMode ? 'week' : 'month';
  const counterTitle = isWeekMode ? 'Weeks selected' : 'Months selected';
  const dateFormat = isWeekMode ? `W [${t('week of')}] GGGG` : 'MMMM YYYY';
  const saveFormat = isWeekMode ? '[W] GGGG WW' : '[M] YYYY MM';

  const [currentYear, setCurrentYear] = useState<number>(
    moment().isoWeekYear(),
  );

  useEffect(() => {
    const lastAvailablePeriod = availablePeriods.slice(-1);
    const lastAvailableYear = isWeekMode
      ? moment(lastAvailablePeriod).isoWeekYear()
      : moment(lastAvailablePeriod).year();
    setCurrentYear(lastAvailableYear);
  }, [availablePeriods]);

  const weekLimit = 52;
  const monthLimit = 12;
  const limit = useMemo(
    () =>
      isComparisonPeriod
        ? getLimitFromPeriodValue(weekLimit, periodValue, availablePeriods)
        : isWeekMode
          ? weekLimit
          : monthLimit,
    [
      isComparisonPeriod,
      isWeekMode,
      weekLimit,
      periodValue,
      monthLimit,
      availablePeriods,
    ],
  );

  const DateInput = useMemo(
    () =>
      ({
        title,
        subTitle = '',
        inputValue,
        onChange,
        disableDate,
        theme,
        locale,
        currentYear,
      }: {
        title: string;
        subTitle?: string;
        inputValue: Date | null;
        onChange: (value: Date) => void;
        disableDate: (current: any) => boolean;
        theme: Theme;
        locale: PickerLocale;
        currentYear?: number;
      }) => {
        if (isWeekMode) {
          return (
            <WeekDateInput
              title={title}
              subTitle={subTitle}
              inputValue={inputValue}
              onChange={onChange}
              disableDate={disableDate}
              theme={theme}
              locale={locale}
              currentYear={currentYear}
            />
          );
        }
        return (
          <MonthDateInput
            title={title}
            subTitle={subTitle}
            inputValue={inputValue}
            onChange={onChange}
            disableDate={disableDate}
            theme={theme}
            locale={locale}
            currentYear={currentYear}
          />
        );
      },
    [isWeekMode, currentYear],
  );

  const theme = useTheme();

  const [expanded, setExpanded] = useState(false);
  const toggleExpand = useEffectEvent(() => {
    setExpanded(!expanded);
  });
  const ToggleIcon = expanded
    ? Icons.FullscreenExitOutlined
    : Icons.FullscreenOutlined;

  const [saveAlertVisible, setSaveAlertVisible] = useState<boolean>(false);

  useEffect(() => {
    if (fromDate && toDate) {
      setName(`${fromDate.format(dateFormat)} - ${toDate.format(dateFormat)}`);
    }
  }, [fromDate, toDate, dateFormat]);

  const resetForm = () => {
    setFromDate(initialPeriodData.fromDate);
    setToDate(initialPeriodData.toDate);
    setName(initialPeriodData.name);
  };

  const handleSave = () => {
    const period = {
      label: name,
      value: `${fromDate.format(saveFormat)}:${toDate.format(saveFormat)}`,
      isNotActive: false,
    };
    onSave(period);
    resetForm();
  };

  const handleConfirmCancel = () => {
    setSaveAlertVisible(false);
    resetForm();
    onCancel();
  };

  const handleCancel = () => {
    if (!isEqual({ fromDate, toDate, name }, initialPeriodData)) {
      setSaveAlertVisible(true);
    } else {
      handleConfirmCancel();
    }
  };

  const setCasualFromDate = (date: Moment) => {
    if (date) {
      setCurrentYear(date.isoWeekYear());
    }
    setFromDate(date);
  };

  const setCasualToDate = (date: Moment) => {
    if (date) {
      setCurrentYear(date.isoWeekYear());
    }
    setToDate(date);
  };

  const setComparisonFromDate = useCallback(
    (date: Moment) => {
      if (date !== null) {
        setFromDate(date);
        const newToDate = date
          .clone()
          .add(limit - 1, isWeekMode ? 'weeks' : 'months');
        setToDate(newToDate);
      } else {
        setFromDate(null);
        setToDate(null);
      }
    },
    [limit, isWeekMode],
  );

  const setComparisonToDate = useCallback(
    (date: Moment) => {
      if (date !== null) {
        setToDate(date);
        const newFromDate = date
          .clone()
          .subtract(limit - 1, isWeekMode ? 'weeks' : 'months');
        setFromDate(newFromDate);
      } else {
        setFromDate(null);
        setToDate(null);
      }
    },
    [limit, isWeekMode],
  );

  const disabledToDate = current => {
    if (
      !availablePeriods.some(date => moment(date).isSame(current, diffFormat))
    ) {
      return true;
    }
    if (isComparisonPeriod) {
      const expectedFromDate = current
        .clone()
        .subtract(limit - 1, isWeekMode ? 'weeks' : 'months');
      if (
        !availablePeriods.some(date =>
          moment(date).isSame(expectedFromDate, diffFormat),
        )
      ) {
        return true;
      }
      return false;
    }
    if (!fromDate) return false;

    const [currentDate, date] = getFormattedDates(
      isWeekMode,
      current,
      fromDate,
    );
    const diff = isWeekMode
      ? getWeekDifference(weekLimit, date, currentDate)
      : currentDate.diff(date, diffFormat);
    const tooLate = diff > limit - 1;
    const tooEarly = currentDate < date;
    return tooLate || tooEarly;
  };

  const disableFromDate = current => {
    if (
      !availablePeriods.some(date => moment(date).isSame(current, diffFormat))
    ) {
      return true;
    }
    if (isComparisonPeriod) {
      const expectedToDate = current
        .clone()
        .add(limit - 1, isWeekMode ? 'weeks' : 'months');
      if (
        !availablePeriods.some(date =>
          moment(date).isSame(expectedToDate, diffFormat),
        )
      ) {
        return true;
      }
      return false;
    }
    if (!toDate) return false;

    const [currentDate, date] = getFormattedDates(isWeekMode, current, toDate);
    const diff = isWeekMode
      ? getWeekDifference(weekLimit, date, currentDate)
      : currentDate.diff(date, diffFormat);
    const tooEarly = diff < -(limit - 1);
    const tooLate = currentDate > date;
    return tooEarly || tooLate;
  };

  const countDiff = useMemo(() => {
    if (!(fromDate && toDate)) return '';
    return isWeekMode
      ? getWeekDifference(weekLimit, fromDate, toDate) + 1
      : toDate.diff(fromDate, diffFormat) + 1;
  }, [fromDate, toDate, diffFormat]);

  const alreadyUsed = options.some(
    o =>
      o.value ===
      `${fromDate?.format(saveFormat)}:${toDate?.format(saveFormat)}`,
  );

  const periodSettings = useMemo(
    () => (
      <SettingsContainer>
        <DateRangeContainer>
          <DateInput
            title="From"
            inputValue={fromDate}
            onChange={
              isComparisonPeriod ? setComparisonFromDate : setCasualFromDate
            }
            disableDate={disableFromDate}
            theme={theme}
            locale={locale}
            currentYear={currentYear}
          />
          <DateInput
            title="To"
            subTitle="incl."
            inputValue={toDate}
            onChange={
              isComparisonPeriod ? setComparisonToDate : setCasualToDate
            }
            disableDate={disabledToDate}
            theme={theme}
            locale={locale}
            currentYear={currentYear}
          />
        </DateRangeContainer>
        <PeriodNameInput name={name} setName={setName} theme={theme} />
        <PeriodCounter
          diff={countDiff}
          counterTitle={counterTitle}
          theme={theme}
        />
        {alreadyUsed && (
          <WarningContainer>{t('Period already exists!')}</WarningContainer>
        )}
      </SettingsContainer>
    ),
    [
      fromDate,
      toDate,
      name,
      countDiff,
      DateInput,
      limit,
      availablePeriods,
      currentYear,
      alreadyUsed,
    ],
  );

  const modalTitle = isComparisonPeriod
    ? t(selectorName.comparisonPeriod)
    : t(selectorName.period);

  return (
    <StyledModalWrapper
      visible={isOpen}
      maskClosable={false}
      title={modalTitle}
      expanded={expanded}
      destroyOnClose
      onCancel={handleCancel}
      onOk={handleSave}
      centered
      footer={
        <div
          css={css`
            display: flex;
            justify-content: flex-end;
            align-items: flex-end;
          `}
        >
          <Footer
            applyTitle="Apply"
            onDismiss={() => setSaveAlertVisible(false)}
            onCancel={handleCancel}
            handleSave={() => {
              handleSave();
            }}
            canSave={
              !isEqual({ fromDate, toDate, name }, initialPeriodData) &&
              !alreadyUsed &&
              fromDate &&
              toDate &&
              name
            }
            saveAlertVisible={saveAlertVisible}
            onConfirmCancel={handleConfirmCancel}
          />
          <StyledExpandButtonWrapper>
            <ToggleIcon
              iconSize="l"
              iconColor={theme.colors.grayscale.dark2}
              onClick={toggleExpand}
            />
          </StyledExpandButtonWrapper>
        </div>
      }
    >
      <ErrorBoundary>
        <StyledModalBody expanded={expanded}>
          <PeriodConfigurePane>{periodSettings}</PeriodConfigurePane>
        </StyledModalBody>
      </ErrorBoundary>
    </StyledModalWrapper>
  );
}

export default React.memo(PeriodConfigModal);
