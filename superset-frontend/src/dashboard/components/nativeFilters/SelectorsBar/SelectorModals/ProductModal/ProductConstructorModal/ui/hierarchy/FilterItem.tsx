import React from 'react';
import {styled, useTheme} from '@superset-ui/core';
import {Checkbox as AntdCheckbox} from 'antd';
import Icons from '../../../../../../../../../components/Icons';
import {FilterPanel} from './FilterPanel';

const BadgeWrapper = styled.div`
  position: relative;
  display: inline-block;
  margin-right: ${({ theme }) => theme.gridUnit * 2}px;
`;

const Badge = styled.span`
  position: absolute;
  top: ${({ theme }) => theme.gridUnit * 2}px;
  right: -${({ theme }) => theme.gridUnit * 2}px;
  background-color: ${({ theme }) => theme.colors.primary.light1};
  color: ${({ theme }) => theme.colors.grayscale.base};
  border-radius: 50%;
  padding: 0 5px;
  font-size: ${({ theme }) => theme.typography.sizes.xxs}px;
  cursor: pointer;
`;

const StyledFilterIcon = styled(Icons.Filter)`
  color: ${({ theme }) => theme.colors.grayscale.light1};
  cursor: pointer;
`;

interface FilterItemProps {
  formatTitle: (value: any, options?: any) => any;
  item: string;
  index: number;
  isActive: boolean;
  onToggle: () => void;
  filterVisible: boolean;
  toggleFilterVisible: (key: string) => void;
  filterCount: number;
  getFilteredOptions: (item: string) => string[];
  selectedFilters: string[];
  onFilterChange: (item: string, value: string[]) => void;
}

export const FilterItem = ({
  formatTitle,
  item,
  index,
  isActive,
  onToggle,
  filterVisible,
  toggleFilterVisible,
  filterCount,
  getFilteredOptions,
  selectedFilters,
  onFilterChange,
}: FilterItemProps) => {
  const theme = useTheme();
  return (
    <div
      style={{
        marginTop: theme.gridUnit * 2,
        marginLeft: theme.gridUnit,
        display: 'flex',
        gap: theme.gridUnit * 3,
      }}
    >
      <AntdCheckbox checked={isActive} onChange={onToggle} />
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
        }}
      >
        {formatTitle(item)}
        {index > 0 && (
          <BadgeWrapper>
            <StyledFilterIcon
              iconSize="l"
              onClick={() => toggleFilterVisible(item)}
            />
            <Badge onClick={() => toggleFilterVisible(item)}>
              {filterCount || null}
            </Badge>
            {filterVisible && (
              <FilterPanel
                formatTitle={formatTitle}
                item={item}
                options={getFilteredOptions(item)}
                selected={selectedFilters}
                onChange={value => onFilterChange(item, value)}
                onClose={() => toggleFilterVisible(item)}
              />
            )}
          </BadgeWrapper>
        )}
      </div>
    </div>
  );
};
