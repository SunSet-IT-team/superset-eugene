import React, {Dispatch, SetStateAction} from 'react';
import {styled, useTheme} from '@superset-ui/core';
import {DataNode} from 'antd/es/tree';
import {HierarchySelector} from './HierarchySelector';
import {BasicItem} from './BasicItem';

const StyledItemsContainer = styled.div`
  display: flex;
  height: 100%;
  flex-direction: column;
  overflow-y: auto;
`;

interface BasicHierarchyProps {
  formatTitle: (value: any, options?: any) => any;
  treeId: string;
  handleHierarchyChange: (
    value: string,
    options: DataNode & { items: string[] },
  ) => void;
  hierarchyItems: {
    label: React.ReactNode;
    key: string | number;
    value: string | number;
    items: string[];
  }[];
  itemsList: string[];
  chosenItems: string[];
  setChosenItems: Dispatch<SetStateAction<string[]>>;
}

const BasicHierarchy = ({
  formatTitle,
  treeId,
  handleHierarchyChange,
  hierarchyItems,
  itemsList,
  chosenItems,
  setChosenItems,
}: BasicHierarchyProps) => {
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
        <HierarchySelector
          formatTitle={formatTitle}
          value={treeId}
          onChange={handleHierarchyChange}
          hierarchyItems={hierarchyItems}
        />
      </div>

      <StyledItemsContainer>
        {itemsList?.map(item => (
          <BasicItem
            key={item}
            formatTitle={formatTitle}
            item={item}
            isActive={chosenItems.includes(item)}
            onSelect={() => {
              setChosenItems(prev =>
                prev.includes(item) ? prev.filter(i => i !== item) : [item],
              );
            }}
          />
        ))}
      </StyledItemsContainer>
    </div>
  );
};

export default BasicHierarchy;
