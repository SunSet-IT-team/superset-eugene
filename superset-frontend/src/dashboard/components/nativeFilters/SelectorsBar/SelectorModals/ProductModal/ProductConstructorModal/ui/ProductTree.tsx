import React, {Dispatch, SetStateAction, useEffect, useMemo, useState} from 'react';
import {Checkbox as AntdCheckbox} from 'antd';
import {Input as Search} from 'src/components/Input';
import {Tree} from 'src/components/Tree';
import {styled, t, useTheme} from '@superset-ui/core';
import type {DataNode, TreeProps} from 'antd/es/tree';
import {ProductDictOption} from 'src/dashboard/features/selectors/types';
import Icons from '../../../../../../../../components/Icons';
import {getTextFromElement} from '../../../utils';
import {getKeys, transformTree} from '../utils';

const StyledSearchIcon = styled(Icons.Search)`
  color: ${({ theme }) => theme.colors.grayscale.light1};
`;

const StyledPaginationButton = styled.button`
  border: none;
  background: none;
  cursor: pointer;
  transition: ease-in-out 0.2s;
  ${({ theme }) => `
  padding-left: ${theme.gridUnit}px;
  padding-right: ${theme.gridUnit}px;
  border-radius: ${theme.gridUnit * 0.5}px;
  color: ${theme.colors.primary.base};
  &:hover {
    background: ${theme.colors.grayscale.light4};
  }
`}
`;

const VISIBLE_VALUE = 200;
const SHOW_MORE_VALUE = 100;

interface ProductTreeProps {
  maxQuantity: number;
  mode: 'basic' | 'advanced';
  formatTitle: (value: any, options?: any) => any;
  filteredTreeData: ProductDictOption[];
  setCurrentProductId: Dispatch<SetStateAction<string>>;
  checkedData: ProductDictOption[];
  setCheckedData: Dispatch<SetStateAction<ProductDictOption[]>>;
  chosenItems: string[];
}

const ProductTree = ({
  maxQuantity,
  mode,
  formatTitle,
  filteredTreeData,
  setCurrentProductId,
  checkedData,
  setCheckedData,
  chosenItems,
}: ProductTreeProps) => {
  const [searchValue, setSearchValue] = useState('');
  const [notFound, setNotFound] = useState(false);

  const [visibleFlatCount, setVisibleFlatCount] = useState(VISIBLE_VALUE);

  const theme = useTheme();

  useEffect(() => {
    setVisibleFlatCount(VISIBLE_VALUE);
  }, [chosenItems]);

  const handleSelectAllChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    allKeys: DataNode[],
    searchValue = '',
  ) => {
    const searchedData = allKeys.filter(
      item =>
        !item.key.toString().includes('__show_more') &&
        item.title?.toLowerCase().includes(searchValue.toLowerCase()),
    );

    const filteredData = searchedData.filter(
      item => !checkedData.some(key => key.key === item.key),
    );

    const transformedData = transformTree(filteredData, mode);

    setCheckedData(prev => {
      if (e.target.checked) {
        if (
          checkedData.length === maxQuantity ||
          transformedData.length === 0
        ) {
          return prev.filter(
            item => !searchedData.some(key => key.key === item.key),
          );
        }

        const newSelections = [...prev, ...transformedData];
        return newSelections.slice(0, maxQuantity);
      }

      return prev.filter(
        item => !searchedData.some(key => key.key === item.key),
      );
    });
  };

  const handleSearchChange = e => {
    const { value } = e.target;
    setSearchValue(value);
    setNotFound(
      filteredTreeData?.every(
        item => item.title?.toLowerCase().indexOf(value.toLowerCase()) === -1,
      ),
    );
  };

  const highlightText = (text: string, highlight: string) => {
    if (!highlight) return text;
    const parts = text.split(new RegExp(`(${highlight})`, 'gi'));
    return parts.map((part, index) =>
      part.toLowerCase() === highlight.toLowerCase() ? (
        <span key={index} style={{ color: theme.colors.primary.base }}>
          {part}
        </span>
      ) : (
        part
      ),
    );
  };

  const handleTreeCheck: TreeProps['onCheck'] = (_, info) => {
    const nodeInfo = info.node;
    if (info.checked && checkedData.length === maxQuantity) {
      return;
    }
    if (nodeInfo.key.toString().includes('__show_more')) {
      return;
    }
    let checkedNodes;

    if (info.checked) {
      checkedNodes = [
        ...checkedData,
        {
          title: nodeInfo.textTitle || getTextFromElement(nodeInfo.title),
          key: nodeInfo.key,
          fullTitle: nodeInfo.fullTitle,
          ids: nodeInfo.ids,
          hierarchyMode: nodeInfo.hierarchyMode,
        },
      ];
    } else {
      checkedNodes = checkedData.filter(node => node?.key !== info.node?.key);
    }

    setCheckedData(checkedNodes);
    setCurrentProductId(checkedNodes[0].key);
  };

  const handleCheckboxChange = (checked: boolean, item) => {
    if (checked && checkedData.length >= maxQuantity) {
      return;
    }
    setCheckedData(prev => {
      const exists = prev.some(data => data.key === item.key);

      if (exists) {
        return prev.filter(data => data.key !== item.key);
      }

      return [...prev, item];
    });
  };

  const renderCheckboxes = (transformedData: DataNode[]) => {
    const visibleData = transformedData.slice(0, visibleFlatCount);

    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
        }}
      >
        {visibleData?.map(item => (
          <div
            key={item.key}
            style={{
              marginBottom: theme.gridUnit * 2,
              display: 'flex',
              gap: theme.gridUnit * 3,
            }}
          >
            <AntdCheckbox
              checked={checkedData.some(data => data.key === item.key)}
              onChange={e => handleCheckboxChange(e.target.checked, item)}
            />
            <div>
              {highlightText(
                formatTitle(
                  item.title,
                  mode === 'basic' ? { type: 'short' } : undefined,
                ),
                searchValue,
              )}
            </div>
          </div>
        ))}
        {transformedData.length > visibleFlatCount && (
          <StyledPaginationButton
            onClick={() => setVisibleFlatCount(prev => prev + SHOW_MORE_VALUE)}
          >
            {t('Show more')}
          </StyledPaginationButton>
        )}
      </div>
    );
  };

  const transformedData = useMemo(() => {
    const filteredData = filteredTreeData?.filter(
      item =>
        !item.key.toString().includes('__show_more') &&
        item.title?.toLowerCase().includes(searchValue.toLowerCase()),
    );
    return transformTree(filteredData, mode);
  }, [filteredTreeData, searchValue, mode]);

  const showTree = filteredTreeData?.some(node => node.children);

  return (
    <div
      style={{
        height: 'auto',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        margin: theme.gridUnit * 2,
      }}
    >
      {showTree ? (
        <Tree
          initialData={filteredTreeData}
          withSearch
          withCount
          withSelectAll
          withToggle
          withPagination
          checkable
          checkStrictly
          formatTitle={formatTitle}
          handleCheck={handleTreeCheck}
          handleSelectAllChange={handleSelectAllChange}
          checkedKeys={checkedData.length ? getKeys(checkedData) : []}
        />
      ) : (
        <>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              width: '100%',
              gap: theme.gridUnit * 2,
              marginBottom: theme.gridUnit * 2,
              zIndex: 1,
              boxShadow: `0 ${theme.gridUnit * 2}px ${theme.gridUnit * 2}px ${
                theme.colors.grayscale.light5
              }`,
              borderBottom: `solid ${theme.gridUnit}px ${theme.colors.grayscale.light5}`,
            }}
          >
            <AntdCheckbox
              onChange={e =>
                handleSelectAllChange(e, filteredTreeData, searchValue)
              }
              disabled={transformedData?.length === 0}
              checked={transformedData?.every(
                item => checkedData?.some(data => data.key === item.key),
              )}
              indeterminate={
                checkedData?.some(
                  data => transformedData?.some(item => item.key === data.key),
                ) &&
                !transformedData?.every(
                  item => checkedData?.some(data => data.key === item.key),
                )
              }
            />
            <div style={{ color: theme.colors.grayscale.light1 }}>
              {
                checkedData?.filter(
                  data => transformedData?.some(item => item.key === data.key),
                )?.length
              }
              /{transformedData?.length}
            </div>
            <Search
              allowClear
              value={searchValue}
              onChange={handleSearchChange}
              placeholder={t('Search')}
              suffix={
                searchValue ? undefined : <StyledSearchIcon iconSize="l" />
              }
            />
          </div>
          {notFound && <div>{t('No results found')}</div>}
          {renderCheckboxes(transformedData)}
        </>
      )}
    </div>
  );
};

export default ProductTree;
