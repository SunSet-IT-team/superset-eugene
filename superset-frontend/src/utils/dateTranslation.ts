import { t, tn } from '@superset-ui/core';

export function getDateTranslation(date = ''): string {
  if (date === 'now') {
    return t('now');
  }

  let [amount, period, ago] = date.split(' ');

  if (amount.toLowerCase() === 'a' || amount.toLowerCase() === 'an') {
    amount = '1';
  }

  const periodMap = {
    year: ['%s year', '%s years'],
    years: ['%s year', '%s years'],
    month: ['%s month', '%s months'],
    months: ['%s month', '%s months'],
    week: ['%s week', '%s weeks'],
    weeks: ['%s week', '%s weeks'],
    day: ['%s day', '%s days'],
    days: ['%s day', '%s days'],
    hour: ['%s hour', '%s hours'],
    hours: ['%s hour', '%s hours'],
    minute: ['%s minute', '%s minutes'],
    minutes: ['%s minute', '%s minutes'],
    second: ['%s second', '%s seconds'],
    seconds: ['%s second', '%s seconds'],
  };

  const translation = periodMap[period];
  if (translation && amount === '1') {
    const res = `${tn(translation[0], translation[1], amount, amount)} ${t(
      ago,
    )}`;
    return res.slice(2);
  }
  if (translation) {
    return `${tn(translation[0], translation[1], amount, amount)} ${t(ago)}`;
  }

  return date;
}
