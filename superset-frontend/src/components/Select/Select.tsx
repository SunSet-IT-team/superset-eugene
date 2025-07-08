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
import {
  ensureIsArray,
  formatNumber,
  NumberFormats,
  t,
  usePrevious,
} from '@superset-ui/core';
import AntdSelect, { LabeledValue as AntdLabeledValue } from 'antd/lib/select';
import { debounce, isEqual, uniq } from 'lodash';
import React, {
  ClipboardEvent,
  forwardRef,
  ReactElement,
  RefObject,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { FAST_DEBOUNCE } from 'src/constants';
import {
  DEFAULT_SORT_COMPARATOR,
  EMPTY_OPTIONS,
  MAX_TAG_COUNT,
  TOKEN_SEPARATORS,
} from './constants';
import { customTagRender } from './CustomTag';
import {
  StyledCheckOutlined,
  StyledContainer,
  StyledHeader,
  StyledSelect,
  StyledStopOutlined,
} from './styles';
import { RawValue, SelectOptionsType, SelectProps } from './types';
import {
  dropDownRenderHelper,
  getOption,
  getSuffixIcon,
  getValue,
  handleFilterOptionHelper,
  hasCustomLabels,
  hasOption,
  isLabeledValue,
  isObject,
  mapOptions,
  mapValues,
  renderSelectOptions,
  SELECT_ALL_VALUE,
  selectAllOption,
  SELECT_FIRST_N_VALUE,
  selectFirstNOption,
  sortComparatorWithSearchHelper,
  sortSelectedFirstHelper,
  isEqual as utilsIsEqual,
} from './utils';

/**
 * This component is a customized version of the Antdesign 4.X Select component
 * https://ant.design/components/select/.
 * This Select component provides an API that is tested against all the different use cases of Superset.
 * It limits and overrides the existing Antdesign API in order to keep their usage to the minimum
 * and to enforce simplification and standardization.
 * It is divided into two macro categories, Static and Async.
 * The Static type accepts a static array of options.
 * The Async type accepts a promise that will return the options.
 * Each of the categories come with different abilities. For a comprehensive guide please refer to
 * the storybook in src/components/Select/Select.stories.tsx.
 */
const Select = forwardRef(
  (
    {
      allowClear,
      allowNewOptions = false,
      allowSelectAll = true,
      allowSelectFirstN = false,
      selectFirstNCount = 3,
      ariaLabel,
      autoClearSearchValue = false,
      filterOption = true,
      header = null,
      headerPosition = 'top',
      helperText,
      invertSelection = false,
      labelInValue = false,
      loading,
      mode = 'single',
      name,
      notFoundContent,
      onBlur,
      onChange,
      onClear,
      onDropdownVisibleChange,
      onDeselect,
      onSearch,
      onSelect,
      optionFilterProps = ['label', 'value'],
      options,
      placeholder = t('Select ...'),
      showSearch = true,
      sortComparator = DEFAULT_SORT_COMPARATOR,
      tokenSeparators = TOKEN_SEPARATORS,
      value,
      getPopupContainer,
      oneLine,
      maxTagCount: propsMaxTagCount,
      dropdownMatchSelectWidth = true,
      ...props
    }: SelectProps,
    ref: RefObject<HTMLInputElement>,
  ) => {
    const isSingleMode = mode === 'single';
    const shouldShowSearch = allowNewOptions ? true : showSearch;
    const [selectValue, setSelectValue] = useState(value);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(loading);
    const [isDropdownVisible, setIsDropdownVisible] = useState(false);
    const [maxTagCount, setMaxTagCount] = useState(
      propsMaxTagCount ?? MAX_TAG_COUNT,
    );
    const [onChangeCount, setOnChangeCount] = useState(0);
    const previousChangeCount = usePrevious(onChangeCount, 0);

    const fireOnChange = useCallback(
      () => setOnChangeCount(onChangeCount + 1),
      [onChangeCount],
    );

    useEffect(() => {
      if (oneLine) {
        setMaxTagCount(isDropdownVisible ? 0 : 1);
      }
    }, [isDropdownVisible, oneLine]);

    const mappedMode = isSingleMode ? undefined : 'multiple';

    const { Option } = AntdSelect;

    const sortSelectedFirst = useCallback(
      (a: AntdLabeledValue, b: AntdLabeledValue) =>
        sortSelectedFirstHelper(a, b, selectValue),
      [selectValue],
    );
    const sortComparatorWithSearch = useCallback(
      (a: AntdLabeledValue, b: AntdLabeledValue) =>
        sortComparatorWithSearchHelper(
          a,
          b,
          inputValue,
          sortSelectedFirst,
          sortComparator,
        ),
      [inputValue, sortComparator, sortSelectedFirst],
    );

    const initialOptions = useMemo(
      () => (Array.isArray(options) ? options.slice() : EMPTY_OPTIONS),
      [options],
    );
    const initialOptionsSorted = useMemo(
      () => initialOptions.slice().sort(sortSelectedFirst),
      [initialOptions, sortSelectedFirst],
    );

    const [selectOptions, setSelectOptions] =
      useState<SelectOptionsType>(initialOptionsSorted);

    // add selected values to options list if they are not in it
    const fullSelectOptions = useMemo(() => {
      const missingValues: SelectOptionsType = ensureIsArray(selectValue)
        .filter(opt => !hasOption(getValue(opt), selectOptions))
        .map(opt =>
          isLabeledValue(opt) ? opt : { value: opt, label: String(opt) },
        );
      const result =
        missingValues.length > 0
          ? missingValues.concat(selectOptions)
          : selectOptions;
      return result.filter(
        opt =>
          opt.value !== SELECT_ALL_VALUE && opt.value !== SELECT_FIRST_N_VALUE,
      );
    }, [selectOptions, selectValue]);

    const firstNOptions = useMemo(
      () => fullSelectOptions.slice(0, selectFirstNCount),
      [fullSelectOptions, selectFirstNCount],
    );

    const enabledOptions = useMemo(
      () => fullSelectOptions.filter(option => !option.disabled),
      [fullSelectOptions],
    );

    const selectAllEligible = useMemo(
      () =>
        fullSelectOptions.filter(
          option => hasOption(option.value, selectValue) || !option.disabled,
        ),
      [fullSelectOptions, selectValue],
    );

    const selectAllEnabled = useMemo(
      () =>
        !isSingleMode &&
        allowSelectAll &&
        selectOptions.length > 0 &&
        enabledOptions.length > 1 &&
        !inputValue,
      [
        isSingleMode,
        allowSelectAll,
        selectOptions.length,
        enabledOptions.length,
        inputValue,
      ],
    );

    const selectFirstNEnabled = useMemo(
      () =>
        !isSingleMode &&
        allowSelectFirstN &&
        selectOptions.length > 0 &&
        enabledOptions.length > 1 &&
        !inputValue,
      [
        isSingleMode,
        allowSelectFirstN,
        selectOptions.length,
        enabledOptions.length,
        inputValue,
      ],
    );

    const selectAllMode = useMemo(
      () => ensureIsArray(selectValue).length === selectAllEligible.length + 1,
      [selectValue, selectAllEligible],
    );

    const selectFirstNMode = useMemo(() => {
      const selectValues = ensureIsArray(selectValue);
      return (
        selectValues.includes(SELECT_FIRST_N_VALUE) &&
        selectValues.length === firstNOptions.length + 1 &&
        firstNOptions
          .map(opt => opt.value)
          .every(opt => selectValues.includes(opt))
      );
    }, [selectValue, firstNOptions]);

    const selectNEnabled = allowSelectFirstN
      ? selectFirstNEnabled
      : selectAllEnabled;
    const selectNMode = allowSelectFirstN ? selectFirstNMode : selectAllMode;
    const SELECT_N_VALUE = allowSelectFirstN
      ? SELECT_FIRST_N_VALUE
      : SELECT_ALL_VALUE;
    const selectNOption = allowSelectFirstN
      ? selectFirstNOption
      : selectAllOption;
    const selectNOptions = allowSelectFirstN
      ? firstNOptions
      : selectAllEligible;
    const selectNFullOptions = allowSelectFirstN
      ? fullSelectOptions
      : selectAllEligible;

    const handleOnSelect: SelectProps['onSelect'] = (selectedItem, option) => {
      if (isSingleMode) {
        // on select is fired in single value mode if the same value is selected
        const valueChanged = !utilsIsEqual(
          selectedItem,
          selectValue as RawValue | AntdLabeledValue,
          'value',
        );
        setSelectValue(selectedItem);
        if (valueChanged) {
          fireOnChange();
        }
      } else {
        setSelectValue(previousState => {
          const array = ensureIsArray(previousState);
          const value = getValue(selectedItem);
          // Tokenized values can contain duplicated values
          if (value === getValue(SELECT_N_VALUE)) {
            if (isLabeledValue(selectedItem)) {
              return [...selectNOptions, selectNOption] as AntdLabeledValue[];
            }
            return [
              SELECT_N_VALUE,
              ...selectNOptions.map(opt => opt.value),
            ] as AntdLabeledValue[];
          }
          if (!hasOption(value, array)) {
            const result = [...array, selectedItem];
            if (
              result.length === selectAllEligible.length &&
              selectAllEnabled
            ) {
              return isLabeledValue(selectedItem)
                ? ([...result, selectAllOption] as AntdLabeledValue[])
                : ([...result, SELECT_ALL_VALUE] as (string | number)[]);
            }
            return result as AntdLabeledValue[];
          }
          return previousState;
        });
        fireOnChange();
      }
      onSelect?.(selectedItem, option);
    };

    const clear = () => {
      if (isSingleMode) {
        setSelectValue(undefined);
      } else {
        setSelectValue(
          fullSelectOptions
            .filter(
              option => option.disabled && hasOption(option.value, selectValue),
            )
            .map(option =>
              labelInValue
                ? { label: option.label, value: option.value }
                : option.value,
            ),
        );
      }
      fireOnChange();
    };

    const handleOnDeselect: SelectProps['onDeselect'] = (value, option) => {
      if (Array.isArray(selectValue)) {
        if (getValue(value) === getValue(SELECT_N_VALUE)) {
          clear();
        } else {
          let array = selectValue as AntdLabeledValue[];
          array = array.filter(
            element => getValue(element) !== getValue(value),
          );
          // if this was not a new item, deselect select all option
          if (selectNMode && !option.isNewOption) {
            array = array.filter(
              element => getValue(element) !== SELECT_N_VALUE,
            );
          }
          setSelectValue(array);

          // removes new option
          if (option.isNewOption) {
            setSelectOptions(
              fullSelectOptions.filter(
                option => getValue(option.value) !== getValue(value),
              ),
            );
          }
        }
      }
      fireOnChange();
      onDeselect?.(value, option);
    };

    const handleOnSearch = debounce((search: string) => {
      const searchValue = search.trim();
      if (allowNewOptions) {
        const newOption = searchValue &&
          !hasOption(searchValue, fullSelectOptions, true) && {
            label: searchValue,
            value: searchValue,
            isNewOption: true,
          };
        const cleanSelectOptions = ensureIsArray(fullSelectOptions).filter(
          opt => !opt.isNewOption || hasOption(opt.value, selectValue),
        );
        const newOptions = newOption
          ? [newOption, ...cleanSelectOptions]
          : cleanSelectOptions;
        setSelectOptions(newOptions);
      }
      setInputValue(searchValue);
      onSearch?.(searchValue);
    }, FAST_DEBOUNCE);

    useEffect(() => () => handleOnSearch.cancel(), [handleOnSearch]);

    const handleFilterOption = (search: string, option: AntdLabeledValue) =>
      handleFilterOptionHelper(search, option, optionFilterProps, filterOption);

    const handleOnDropdownVisibleChange = (isDropdownVisible: boolean) => {
      setIsDropdownVisible(isDropdownVisible);

      // if no search input value, force sort options because it won't be sorted by
      // `filterSort`.
      if (isDropdownVisible && !inputValue && selectOptions.length > 1) {
        if (!isEqual(initialOptionsSorted, selectOptions)) {
          setSelectOptions(initialOptionsSorted);
        }
      }
      if (onDropdownVisibleChange) {
        onDropdownVisibleChange(isDropdownVisible);
      }
    };

    const dropdownRender = (
      originNode: ReactElement & { ref?: RefObject<HTMLElement> },
    ) =>
      dropDownRenderHelper(
        originNode,
        isDropdownVisible,
        isLoading,
        fullSelectOptions.length,
        helperText,
      );

    const handleClear = () => {
      clear();
      if (onClear) {
        onClear();
      }
    };

    useEffect(() => {
      // when `options` list is updated from component prop, reset states
      setSelectOptions(initialOptions);
    }, [initialOptions]);

    useEffect(() => {
      if (loading !== undefined && loading !== isLoading) {
        setIsLoading(loading);
      }
    }, [isLoading, loading]);

    useEffect(() => {
      setSelectValue(value);
    }, [value]);

    useEffect(() => {
      // if all values are selected, add select all to value
      if (
        selectAllEnabled &&
        ensureIsArray(value).length === selectAllEligible.length
      ) {
        setSelectValue(
          labelInValue
            ? ([...ensureIsArray(value), selectAllOption] as AntdLabeledValue[])
            : ([...ensureIsArray(value), SELECT_ALL_VALUE] as RawValue[]),
        );
      }
    }, [labelInValue, selectAllEligible.length, selectAllEnabled, value]);

    useEffect(() => {
      // if first N values are selected, add select first N to value
      const firstNOptionsSelected =
        firstNOptions
          .map(opt => opt.value)
          .every(opt => ensureIsArray(value).includes(opt)) &&
        ensureIsArray(value).length === firstNOptions.length;
      if (
        selectFirstNEnabled &&
        firstNOptionsSelected &&
        !ensureIsArray(value).includes(SELECT_FIRST_N_VALUE)
      ) {
        setSelectValue(
          labelInValue
            ? ([
                ...ensureIsArray(value),
                selectFirstNOption,
              ] as AntdLabeledValue[])
            : ([...ensureIsArray(value), SELECT_FIRST_N_VALUE] as RawValue[]),
        );
      }
    }, [
      labelInValue,
      firstNOptions.length,
      selectFirstNEnabled,
      selectFirstNCount,
      value,
    ]);

    useEffect(() => {
      const checkSelectN = ensureIsArray(selectValue).some(
        v => getValue(v) === SELECT_N_VALUE,
      );
      if (checkSelectN && !selectNMode) {
        const optionsToSelect = selectNOptions.map(option =>
          labelInValue ? option : option.value,
        );
        optionsToSelect.push(labelInValue ? selectNOption : SELECT_N_VALUE);
        setSelectValue(optionsToSelect);
        fireOnChange();
      }
    }, [
      selectValue,
      SELECT_N_VALUE,
      selectNMode,
      labelInValue,
      selectNOptions,
      selectNOption,
      fireOnChange,
    ]);

    const selectAllLabel = useMemo(
      () => () =>
        `${t(SELECT_ALL_VALUE)} (${formatNumber(
          NumberFormats.INTEGER,
          selectAllEligible.length,
        )})`,
      [selectAllEligible],
    );

    const selectFirstNLabel = useMemo(
      () => () =>
        `${t(SELECT_FIRST_N_VALUE)} (${formatNumber(
          NumberFormats.INTEGER,
          Math.min(selectFirstNCount, selectAllEligible.length),
        )})`,
      [selectFirstNCount, selectAllEligible],
    );

    const handleOnBlur = (event: React.FocusEvent<HTMLElement>) => {
      setInputValue('');
      onBlur?.(event);
    };

    const handleOnChange = useCallback(
      (values: any, options: any) => {
        // intercept onChange call to handle the select all case
        // if the "select all" option is selected, we want to send all options to the onChange,
        // otherwise we want to remove
        let newValues = values;
        let newOptions = options;
        if (!isSingleMode) {
          if (
            ensureIsArray(newValues).some(
              val => getValue(val) === SELECT_N_VALUE,
            )
          ) {
            // send all options to onchange if all are not currently there
            if (!selectNMode) {
              newValues = mapValues(selectNOptions, labelInValue);
              newOptions = mapOptions(selectNFullOptions);
            } else {
              newValues = ensureIsArray(values).filter(
                (val: any) => getValue(val) !== SELECT_N_VALUE,
              );
            }
          } else if (
            ensureIsArray(values).length === selectAllEligible.length &&
            selectNMode
          ) {
            const array = selectAllEligible.filter(
              option => hasOption(option.value, selectValue) && option.disabled,
            );
            newValues = mapValues(array, labelInValue);
            newOptions = mapOptions(array);
          }
        }

        onChange?.(newValues, newOptions);
      },
      [
        isSingleMode,
        onChange,
        selectAllEligible,
        selectNMode,
        SELECT_N_VALUE,
        selectNOptions,
        labelInValue,
        selectNFullOptions,
        selectValue,
      ],
    );

    useEffect(() => {
      if (onChangeCount !== previousChangeCount) {
        const array = ensureIsArray(selectValue);
        const set = new Set(array.map(getValue));
        const options = mapOptions(
          fullSelectOptions.filter(opt => set.has(opt.value)),
        );
        if (isSingleMode) {
          handleOnChange(selectValue, selectValue ? options[0] : undefined);
        } else {
          handleOnChange(array, options);
        }
      }
    }, [
      fullSelectOptions,
      handleOnChange,
      isSingleMode,
      onChange,
      onChangeCount,
      previousChangeCount,
      selectValue,
    ]);

    const shouldRenderChildrenOptions = useMemo(
      () => selectNEnabled || hasCustomLabels(options),
      [selectNEnabled, options],
    );

    const omittedCount = useMemo(() => {
      const num_selected = ensureIsArray(selectValue).length;
      const num_shown = maxTagCount as number;
      return (
        num_selected -
        num_shown -
        (selectNMode ? 1 : 0) -
        (num_selected === 4 ? 1 : 0)
      );
    }, [maxTagCount, selectNMode, selectValue]);

    const customMaxTagPlaceholder = () =>
      `+ ${omittedCount > 0 ? omittedCount : 1} ...`;

    let actualMaxTagCount = maxTagCount;
    if (
      actualMaxTagCount !== 'responsive' &&
      omittedCount === -1 &&
      selectNMode
    ) {
      actualMaxTagCount += 1;
    }

    const getPastedTextValue = useCallback(
      (text: string) => {
        const option = getOption(text, fullSelectOptions, true);
        if (!option && !allowNewOptions) {
          return undefined;
        }
        if (labelInValue) {
          const value: AntdLabeledValue = {
            label: text,
            value: text,
          };
          if (option) {
            value.label = isObject(option) ? option.label : option;
            value.value = isObject(option) ? option.value! : option;
          }
          return value;
        }
        return option ? (isObject(option) ? option.value! : option) : text;
      },
      [allowNewOptions, fullSelectOptions, labelInValue],
    );

    const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
      const pastedText = e.clipboardData.getData('text');
      if (isSingleMode) {
        const value = getPastedTextValue(pastedText);
        if (value) {
          setSelectValue(value);
        }
      } else {
        const token = tokenSeparators.find(token => pastedText.includes(token));
        const array = token ? uniq(pastedText.split(token)) : [pastedText];
        const values = array
          .map(item => getPastedTextValue(item))
          .filter(item => item !== undefined);
        if (labelInValue) {
          setSelectValue(previous => [
            ...((previous || []) as AntdLabeledValue[]),
            ...(values as AntdLabeledValue[]),
          ]);
        } else {
          setSelectValue(previous => [
            ...((previous || []) as string[]),
            ...(values as string[]),
          ]);
        }
      }
      fireOnChange();
    };

    return (
      <StyledContainer headerPosition={headerPosition}>
        {header && (
          <StyledHeader headerPosition={headerPosition}>{header}</StyledHeader>
        )}
        <StyledSelect
          allowClear={!isLoading && allowClear}
          aria-label={ariaLabel || name}
          autoClearSearchValue={autoClearSearchValue}
          dropdownRender={dropdownRender}
          filterOption={handleFilterOption}
          filterSort={sortComparatorWithSearch}
          dropdownMatchSelectWidth={dropdownMatchSelectWidth}
          getPopupContainer={
            getPopupContainer || (triggerNode => triggerNode.parentNode)
          }
          headerPosition={headerPosition}
          labelInValue={labelInValue}
          maxTagCount={actualMaxTagCount}
          maxTagPlaceholder={customMaxTagPlaceholder}
          mode={mappedMode}
          notFoundContent={isLoading ? t('Loading...') : notFoundContent}
          onBlur={handleOnBlur}
          onDeselect={handleOnDeselect}
          onDropdownVisibleChange={handleOnDropdownVisibleChange}
          // @ts-ignore
          onPaste={onPaste}
          onPopupScroll={undefined}
          onSearch={shouldShowSearch ? handleOnSearch : undefined}
          onSelect={handleOnSelect}
          onClear={handleClear}
          placeholder={placeholder}
          showSearch={shouldShowSearch}
          showArrow
          tokenSeparators={tokenSeparators}
          value={selectValue}
          suffixIcon={getSuffixIcon(
            isLoading,
            shouldShowSearch,
            isDropdownVisible,
          )}
          menuItemSelectedIcon={
            invertSelection ? (
              <StyledStopOutlined iconSize="m" aria-label="stop" />
            ) : (
              <StyledCheckOutlined iconSize="m" aria-label="check" />
            )
          }
          options={shouldRenderChildrenOptions ? undefined : fullSelectOptions}
          oneLine={oneLine}
          tagRender={customTagRender}
          {...props}
          ref={ref}
        >
          {selectAllEnabled && (
            <Option
              id="select-all"
              className="select-all"
              key={SELECT_ALL_VALUE}
              value={SELECT_ALL_VALUE}
            >
              {selectAllLabel()}
            </Option>
          )}
          {selectFirstNEnabled && (
            <Option
              id="select-first-n"
              className="select-all"
              key={SELECT_FIRST_N_VALUE}
              value={SELECT_FIRST_N_VALUE}
            >
              {selectFirstNLabel()}
            </Option>
          )}
          {shouldRenderChildrenOptions &&
            renderSelectOptions(fullSelectOptions)}
        </StyledSelect>
      </StyledContainer>
    );
  },
);

export default Select;
