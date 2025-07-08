import React, { ReactChild } from 'react';
import moment, { Moment } from 'moment';

export const getTextFromElement = (element: string | ReactChild) => {
  if (typeof element === 'string') {
    return element;
  }
  if (React.isValidElement(element)) {
    return React.Children.toArray(element.props.children)
      .map(getTextFromElement)
      .join('');
  }
  return '';
};

function correctTimeUnitFormat(timeUnit: number) {
  return timeUnit < 10 ? `0${timeUnit}` : timeUnit;
}

export const getWeekDifference = (weekLimit, from: Moment, to: Moment) => {
  const [year1, week1] = from.format(`GGGG[W]WW`).split('W').map(Number);
  const [year2, week2] = to.format(`GGGG[W]WW`).split('W').map(Number);

  const weeksDifference =
    year2 * weekLimit + week2 - (year1 * weekLimit + week1);

  return weeksDifference;
};

export const getFormattedDates = (
  isWeekMode: boolean,
  current: Moment,
  date: Moment,
) => {
  if (!isWeekMode) {
    return [
      moment(current.format('MMM YYYY')),
      moment(date.format('MMM YYYY')),
    ];
  }
  return [current, date];
};

const getWeekPeriodValue = (weekLimit: number, period: string) => {
  const [fromDate, toDate] = period.split(':');
  const [, year1, week1] = fromDate.split(' ').map(Number);
  const [, year2, week2] = toDate.split(' ').map(Number);

  const weeksDifference =
    year2 * weekLimit + week2 - (year1 * weekLimit + week1);

  return weeksDifference + 1;
};

const getMonthPeriodValue = (period: string) => {
  const [fromDate, toDate] = period.split(':');
  return moment(toDate).diff(moment(fromDate), 'month') + 1;
};

export const getLimitFromPeriodValue = (
  weekLimit: number,
  period: string,
  availablePeriods: string[],
) => {
  const regexWeek = /^W \d{4} \d{2}:W \d{4} \d{2}$/; // 'W 2025 02:W 2025 06'
  const regexMonth = /^M \d{4} \d{2}:M \d{4} \d{2}$/; // 'M 2024 01:M 2024 12'

  if (regexWeek.test(period)) {
    return getWeekPeriodValue(weekLimit, period);
  }
  if (regexMonth.test(period)) {
    return getMonthPeriodValue(period);
  }

  if (period === 'last_month') return 1;
  if (period === 'last_3_month') return 3;
  if (period === 'last_6_month') return 6;
  if (period === 'last_12_months') return 12;

  if (period === 'last_week') return 1;
  if (period === 'last_4_week') return 4;
  if (period === 'last_5_week') return 5;
  if (period === 'last_12_week') return 12;
  if (period === 'last_26_week') return 26;
  if (period === 'last_52_week') return 52;

  if (period === 'YTD_month') {
    if (Array.isArray(availablePeriods)) {
      const year = Math.max(...availablePeriods.map(p => +p.split('M')[0]));
      const months = availablePeriods
        .filter(p => +p.split('M')[0] === year)
        .map(p => +p.split('M')[1]);
      const minMonth = Math.min(...months);
      const maxMonth = Math.max(...months);
      return getMonthPeriodValue(
        `M ${year} ${
          minMonth.toString().length === 1 ? `0${minMonth}` : minMonth
        }:M ${year} ${
          maxMonth.toString().length === 1 ? `0${maxMonth}` : maxMonth
        }`,
      );
    }
    return null;
  }
  if (period === 'YTD_week') {
    if (Array.isArray(availablePeriods)) {
      const year = Math.max(...availablePeriods.map(p => +p.split('W')[0]));

      const weeks = availablePeriods
        .filter(p => +p.split('W')[0] === year)
        .map(p => +p.split('W')[1]);
      const minWeek = Math.min(...weeks);
      const maxWeek = Math.max(...weeks);
      return getWeekPeriodValue(
        weekLimit,
        `W ${year} ${
          minWeek.toString().length === 1 ? `0${minWeek}` : minWeek
        }:W ${year} ${
          maxWeek.toString().length === 1 ? `0${maxWeek}` : maxWeek
        }`,
      );
    }
    return null;
  }

  return null;
};

function parseDateValues(date: string) {
  const [, year, timeUnit] = date.split(' ').map(Number);
  return [year, timeUnit];
}

function parsePeriodValues(period: string) {
  const [fromDate, toDate] = period.split(':');
  const [startYear, startTimeUnit] = parseDateValues(fromDate);
  const [endYear, endTimeUnit] = parseDateValues(toDate);
  return { startYear, startTimeUnit, endYear, endTimeUnit };
}

const getPreviousWeekDate = (
  diff: number | null,
  weekLimit: number,
  year: number,
  week: number,
) => {
  const diffNumber = diff || 1;
  const newYear = week - diffNumber > 0 ? year : year - 1;
  const newWeek =
    week - diffNumber > 0 ? week - diffNumber : weekLimit - (diffNumber - week);
  return `${newYear}W${correctTimeUnitFormat(newWeek)}`;
};

const getPreviousMonthDate = (
  diff: number | null,
  year: number,
  week: number,
) => {
  const currentDate = moment(`${year}-${correctTimeUnitFormat(week)}`);
  const newDate = currentDate.clone().subtract(diff, 'month');

  return newDate.format('YYYY[-]MM');
};

type DefaultValue = 'analogous_period_last_year' | 'previous_period';

export const checkDefaultPeriodAvailability = (
  availablePeriods: string[], // custom_periods: ['2025W06', '2025-05', '2025W04', '2025W03'],
  isWeekMode: boolean,
  period: string, // 'W 2025 02:W 2025 06' // 'M 2024 01:M 2024 12'
  comparisonPeriod: DefaultValue,
): boolean => {
  const weekLimit = 52;
  const separator = isWeekMode ? 'W' : '-';
  const diff = getLimitFromPeriodValue(weekLimit, period, availablePeriods);
  const { startYear, startTimeUnit, endYear, endTimeUnit } =
    parsePeriodValues(period);
  let startDateToCheck;
  let endDateToCheck;

  if (comparisonPeriod === 'analogous_period_last_year') {
    startDateToCheck = `${startYear - 1}${separator}${correctTimeUnitFormat(
      startTimeUnit,
    )}`;
    endDateToCheck = `${endYear - 1}${separator}${correctTimeUnitFormat(
      endTimeUnit,
    )}`;
  }

  if (comparisonPeriod === 'previous_period') {
    startDateToCheck = isWeekMode
      ? getPreviousWeekDate(diff, weekLimit, startYear, startTimeUnit)
      : getPreviousMonthDate(diff, startYear, startTimeUnit);
    endDateToCheck = isWeekMode
      ? getPreviousWeekDate(diff, weekLimit, endYear, endTimeUnit)
      : getPreviousMonthDate(diff, endYear, endTimeUnit);
  }

  if (!startDateToCheck || !endDateToCheck) {
    return false;
  }
  const isStartDateAvailable = availablePeriods.includes(startDateToCheck);
  const isEndDateAvailable = availablePeriods.includes(endDateToCheck);

  return isStartDateAvailable && isEndDateAvailable;
};
