import React from 'react';
import {formatFulldesc, styled, t, useTheme} from '@superset-ui/core';
import {Select} from 'src/components';
import Icons from '../../../../../../../../../components/Icons';

const FilterContainer = styled.div`
  width: 200px;
  position: absolute;
  top: ${({ theme }) => theme.gridUnit * 2}px;
  right: ${({ theme }) => theme.gridUnit * 5}px;
  display: flex;
  flex-direction: column;
  background-color: ${({ theme }) => theme.colors.grayscale.light5};
  padding: ${({ theme }) => theme.gridUnit * 2}px;
  box-shadow: 4px 4px 20px ${({ theme }) => theme.colors.grayscale.light2};
  border-radius: 10px 0 10px 10px;
`;

const StyledCloseIcon = styled(Icons.Close)`
  color: ${({ theme }) => theme.colors.grayscale.light1};
  margin-top: ${({ theme }) => theme.gridUnit}px;
  cursor: pointer;
`;

interface FilterPanelProps {
  formatTitle: (value: any, options?: any) => any;
  item: string;
  options: string[];
  selected: string[];
  onChange: (value: string[]) => void;
  onClose: () => void;
}

export const FilterPanel = ({
  formatTitle,
  item,
  options,
  selected,
  onChange,
  onClose,
}: FilterPanelProps) => {
  const theme = useTheme();

  const formatTitleShort = (value: any) =>
    formatFulldesc(value, { type: 'short' });
  return (
    <FilterContainer>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        {`${item} ${t('FILTER')}`}
        <StyledCloseIcon iconSize="m" onClick={onClose} />
      </div>
      <Select
        style={{ marginTop: theme.gridUnit }}
        value={selected}
        placeholder={t('Select a filter')}
        onChange={onChange}
        showSearch
        mode="multiple"
        allowSelectAll
        getPopupContainer={() => document.body}
        listHeight={150}
        options={options.map(el => ({
          value: el,
          label: formatTitleShort(el),
        }))}
      />
    </FilterContainer>
  );
};
