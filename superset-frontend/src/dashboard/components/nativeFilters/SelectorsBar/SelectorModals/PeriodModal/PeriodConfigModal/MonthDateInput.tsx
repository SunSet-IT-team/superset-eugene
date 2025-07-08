import React from 'react';
import {DatePicker} from 'src/components/DatePicker';
import {PickerLocale} from 'antd/lib/date-picker/generatePicker';
import {t} from '@superset-ui/core';
import {Theme} from '@emotion/react';
import moment from 'moment';

interface Props {
  title: string;
  subTitle?: string;
  inputValue: Date | null;
  onChange: (value: Date) => void;
  disableDate: (current: any) => boolean;
  theme: Theme;
  locale: PickerLocale;
  currentYear?: number;
}

function MonthDateInput({
  title,
  subTitle,
  inputValue,
  onChange,
  disableDate,
  theme,
  locale,
  currentYear = moment().isoWeekYear(),
}: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <label
        htmlFor={`${title}Picker`}
        style={{
          fontSize: `${theme.typography.sizes.m}px`,
          color: `${theme.colors.grayscale.dark1}`,
        }}
      >
        {subTitle ? `${t(title)} (${t(subTitle)})` : `${t(title)}`}
      </label>
      <DatePicker
        id={`${title}Picker`}
        style={{ width: `${theme.gridUnit * 60}px` }}
        picker="month"
        locale={locale}
        value={inputValue}
        onChange={value => onChange(value)}
        format="MMMM YYYY"
        disabledDate={disableDate}
        defaultPickerValue={moment(`${currentYear}`)}
      />
    </div>
  );
}

export default React.memo(MonthDateInput);
