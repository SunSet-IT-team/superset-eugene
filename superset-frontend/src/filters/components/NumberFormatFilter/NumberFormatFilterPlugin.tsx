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
import { ensureIsArray, t, tn } from '@superset-ui/core';
import React, { useEffect, useState } from 'react';
import { Select } from 'src/components';
import { FormItemProps } from 'antd/lib/form';
import { D3_FORMAT_OPTIONS } from '@superset-ui/chart-controls';
import { FilterPluginStyle, StyledFormItem, StatusMessage } from '../common';
import { PluginFilterNumberFormatProps } from './types';

const DEFAULT_FORMATS_MAP = D3_FORMAT_OPTIONS.reduce(
  (agg, option) => ({
    ...agg,
    [option[0]]: option[1],
  }),
  {} as { [key in string]: string },
);

export default function PluginFilterNumberFormat(
  props: PluginFilterNumberFormatProps,
) {
  const {
    data,
    formData,
    height,
    width,
    setDataMask,
    setHoveredFilter,
    unsetHoveredFilter,
    setFocusedFilter,
    unsetFocusedFilter,
    setFilterActive,
    filterState,
    inputRef,
  } = props;
  const { defaultValue } = formData;

  const [value, setValue] = useState<string[]>(defaultValue ?? []);

  const handleChange = (values: string[] | string | undefined | null) => {
    const resultFormats: string[] = ensureIsArray<string>(values);
    const [numberFormat] = resultFormats;
    const label = numberFormat
      ? DEFAULT_FORMATS_MAP[numberFormat]
      : numberFormat;

    setValue(resultFormats);
    setDataMask({
      filterState: {
        label,
        value: resultFormats.length ? resultFormats : null,
      },
    });
  };

  useEffect(() => {
    handleChange(filterState.value ?? []);
  }, [JSON.stringify(filterState.value)]);

  const options = D3_FORMAT_OPTIONS.map(option => ({
    label: option[1],
    value: option[0],
  }));

  const placeholderText =
    (data || []).length === 0
      ? t('No data')
      : tn('%s option', '%s options', options.length, options.length);

  const formItemData: FormItemProps = {};
  if (filterState.validateMessage) {
    formItemData.extra = (
      <StatusMessage status={filterState.validateStatus}>
        {filterState.validateMessage}
      </StatusMessage>
    );
  }



  return (
    <FilterPluginStyle height={height} width={width}>
      <StyledFormItem
        validateStatus={filterState.validateStatus}
        {...formItemData}
      >
        <Select
          allowClear
          value={value}
          placeholder={placeholderText}
          // @ts-ignore
          onChange={handleChange}
          onBlur={unsetFocusedFilter}
          onFocus={setFocusedFilter}
          onMouseEnter={setHoveredFilter}
          onMouseLeave={unsetHoveredFilter}
          ref={inputRef}
          options={options}
          onDropdownVisibleChange={setFilterActive}
          allowNewOptions
        />
      </StyledFormItem>
    </FilterPluginStyle>
  );
}
