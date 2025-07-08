import React, { useMemo } from 'react';
import { styled, t } from '@superset-ui/core';
import { Select } from '../../../components';
import { OptionType } from '../../../dashboard/reducers/ordersSlice';
import { Input } from '../../../components/Input';
import Icons from '../../../components/Icons';
import { SingleValue } from './SingleValue';

const DropdownMenu = styled.div`
  .ant-select-item-option-state {
    display: none;
  }
`;

const Wrapper = styled.div<{ maxWidth?: number }>`
  max-width: ${({ maxWidth }) => maxWidth}px;
  width: 100%;
  display: flex;
  align-items: center;
`;

const StyledSearchIcon = styled(Icons.Search)`
  color: ${({ theme }) => theme.colors.grayscale.base};
`;

const StyledInputWrapper = styled.div`
  margin: 0 5px 5px;
`;

const StyledSelect = styled(Select)<{ isBold?: boolean }>`
  .ant-select-selection-item {
    font-weight: ${({ isBold }) => (isBold ? 'bold' : 'normal')};
  }
`;

type PropsType = {
  options: OptionType[];
  allOptions: OptionType[];
  onChange: (_: string, option: OptionType) => void;
  selectedOption: OptionType | null;
  maxWidth?: number;
  optionLabelProp?: string;
  onSearchChange: (value: string) => void;
  onDropdownVisibleChange?: (open: boolean) => void;
  searchValue: string;
  canShowSelect?: boolean;
  isBold?: boolean;
};

export const SmartSelect = ({
  options,
  allOptions,
  onChange,
  selectedOption,
  maxWidth = 250,
  optionLabelProp = 'label',
  onSearchChange,
  onDropdownVisibleChange,
  searchValue = '',
  canShowSelect = false,
  isBold = false,
}: PropsType) => {
  const mergedOptions = useMemo(() => {
    const exists = options.some(opt => opt.value === selectedOption?.value);
    if (exists || !selectedOption) return options;

    // Если selectedOption отсутствует в options (например, из-за поиска),
    // добавляем его вручную (с display: 'none'), чтобы он корректно отображался как выбранный.
    return [
      {
        ...selectedOption,
        style: { display: 'none' },
      },
      ...options,
    ];
  }, [options, selectedOption]);

  if (!selectedOption) return null;

  if (
    !canShowSelect ||
    (allOptions.length === 1 && selectedOption.id === allOptions[0].id)
  ) {
    return (
      <Wrapper maxWidth={maxWidth}>
        <SingleValue
          value={selectedOption.label || ''}
          isOnHold={selectedOption.isOnHold}
          isBold={isBold}
        />
      </Wrapper>
    );
  }

  return (
    <Wrapper maxWidth={maxWidth}>
      <StyledSelect
        isBold={isBold}
        mode="single"
        value={selectedOption?.value || ''}
        onChange={onChange}
        options={mergedOptions}
        placeholder={t('Select a field')}
        dropdownMatchSelectWidth={200}
        showSearch={false}
        optionLabelProp={optionLabelProp}
        onDropdownVisibleChange={onDropdownVisibleChange}
        dropdownRender={menu => (
          <DropdownMenu>
            <StyledInputWrapper>
              <Input
                value={searchValue}
                placeholder={t('Search...')}
                prefix={<StyledSearchIcon />}
                onChange={e => onSearchChange(e.target.value)}
              />
            </StyledInputWrapper>
            {menu}
          </DropdownMenu>
        )}
      />
    </Wrapper>
  );
};
