import React, {Dispatch, SetStateAction} from 'react';
import {styled, useTheme} from '@superset-ui/core';
import {isEqual} from 'lodash';
import {DataNode} from 'antd/es/tree';
import {SelectAllCheckbox} from './SelectAllCheckbox';
import {ClearAllButton} from './ClearAllButton';
import {FilterItem} from './FilterItem';
import {HierarchySelector} from './HierarchySelector';

const StyledItemsContainer = styled.div`
  display: flex;
  height: 100%;
  flex-direction: column;
  overflow-y: auto;
`;

interface AdvancedHierarchyProps {
  formatTitle: (value: any, options?: any) => any;
  treeId: string;
  itemsList: string[];
  chosenItems: string[];
  setChosenItems: Dispatch<SetStateAction<string[]>>;
  chosenFilters: Record<string, string[]>;
  setChosenFilters: Dispatch<SetStateAction<Record<string, string[]>>>;
  isSelectVisible: Record<string, boolean>;
  hierarchyItems: {
    label: React.ReactNode;
    key: string | number;
    value: string | number;
    items: string[];
  }[];
  handleHierarchyChange: (
    value: string,
    options: DataNode & { items: string[] },
  ) => void;
  handleSelectAllHierarchyChange: () => void;
  chosenHierarchyInfo: {
    allCount: number;
    checkedCount: number;
  };
  handleFilterClear: () => void;
  toggleIsSelectVisible: (key: string) => void;
  getFilteredOptions: (item: string) => string[];
}

const AdvancedHierarchy = ({
  formatTitle,
  treeId,
  itemsList,
  chosenItems,
  setChosenItems,
  chosenFilters,
  setChosenFilters,
  isSelectVisible,
  hierarchyItems,
  chosenHierarchyInfo,
  handleHierarchyChange,
  handleSelectAllHierarchyChange,
  handleFilterClear,
  toggleIsSelectVisible,
  getFilteredOptions,
}: AdvancedHierarchyProps) => {
  const theme = useTheme();
  return (
    <div
      style={{
        height: '100%',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        margin: theme.gridUnit * 2,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          width: '100%',
          gap: theme.gridUnit * 2,
          zIndex: 1,
          boxShadow: `0 ${theme.gridUnit * 2}px ${theme.gridUnit * 2}px ${
            theme.colors.grayscale.light5
          }`,
          paddingBottom: theme.gridUnit * 0.5,
          borderBottom: `solid ${theme.gridUnit}px ${theme.colors.grayscale.light5}`,
        }}
      >
        <SelectAllCheckbox
          itemsList={itemsList}
          chosenItems={chosenItems}
          onChange={handleSelectAllHierarchyChange}
        />
        <div style={{ color: theme.colors.grayscale.light1 }}>
          {chosenHierarchyInfo.checkedCount}/{chosenHierarchyInfo.allCount}
        </div>
        <HierarchySelector
          formatTitle={formatTitle}
          value={treeId}
          onChange={handleHierarchyChange}
          hierarchyItems={hierarchyItems}
        />
        <ClearAllButton
          filtersActive={
            !isEqual(
              Object.values(chosenFilters).filter(val => val.length !== 0),
              [],
            )
          }
          onClick={handleFilterClear}
        />
      </div>

      <StyledItemsContainer>
        {itemsList?.map((item, index) => (
          <FilterItem
            key={item}
            formatTitle={formatTitle}
            item={item}
            index={index}
            isActive={chosenItems.includes(item)}
            onToggle={() => {
              setChosenItems(prev => {
                const updated = prev.includes(item)
                  ? prev.filter(i => i !== item)
                  : [...prev, item];
                return updated.sort(
                  (a, b) => itemsList.indexOf(a) - itemsList.indexOf(b),
                );
              });
            }}
            filterVisible={isSelectVisible[item]}
            toggleFilterVisible={toggleIsSelectVisible}
            filterCount={chosenFilters[item]?.length}
            getFilteredOptions={getFilteredOptions}
            selectedFilters={chosenFilters[item]}
            onFilterChange={(item: string, value: string[]) =>
              setChosenFilters(prev => ({ ...prev, [item]: value }))
            }
          />
        ))}
      </StyledItemsContainer>
    </div>
  );
};

export default AdvancedHierarchy;
