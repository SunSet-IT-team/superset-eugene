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
import React, {useEffect, useMemo, useState} from 'react';
import {styled, t, useTheme} from '@superset-ui/core';
import {Checkbox as AntdCheckbox, Tree as AntdTree} from 'antd';
import type {DataNode} from 'antd/es/tree';
import Icons from 'src/components/Icons';
import {Input as Search} from '../Input';

export interface TreeProps {
  initialData: DataNode[];
  withSearch?: boolean;
  checkable?: boolean;
  checkStrictly?: boolean;
  formatTitle?: (value?: string) => string;
  handleCheck?: (checked: string[], info: DataNode) => void;
  checkedKeys?: DataNode[];
  handleSelectAllChange?: (
    e: React.ChangeEvent<HTMLInputElement>,
    allKeys: DataNode[],
    searchValue: string,
  ) => void;
  withCount?: boolean;
  withSelectAll?: boolean;
  withToggle?: boolean;
  withPagination?: boolean;
}
const StyledSearchIcon = styled(Icons.Search)`
  color: ${({ theme }) => theme.colors.grayscale.light1};
`;

const StyledExpandIcon = styled(Icons.ExpandAll)`
  color: ${({ theme }) => theme.colors.grayscale.light1};
  cursor: pointer;
  &:hover {
    color: ${({ theme }) => theme.colors.primary.base};
  }
`;

const StyledCollapseIcon = styled(Icons.CollapseAll)`
  color: ${({ theme }) => theme.colors.grayscale.light1};
  cursor: pointer;
  &:hover {
    color: ${({ theme }) => theme.colors.primary.base};
  }
`;

const StyledToggleContainer = styled.div`
  display: flex;
  align-items: center;
  margin-top: 3px;
`;

const StyledTree = styled(AntdTree)`
  .ant-tree-checkbox {
    margin-right: ${({ theme }) => theme.gridUnit}px;
  }
  .ant-tree-indent-unit {
    width: ${({ theme }) => theme.gridUnit * 4}px;
  }
  overflow-y: auto;
`;

const VISIBLE_VALUE = 200;
const SHOW_MORE_VALUE = 100;

export const Tree: React.FC<TreeProps> = ({
  initialData,
  withSearch = false,
  checkable = false,
  checkStrictly = false,
  withCount = false,
  withSelectAll = false,
  handleSelectAllChange,
  handleCheck,
  checkedKeys,
  formatTitle,
  withToggle = false,
  withPagination = false,
}) => {
  const theme = useTheme();

  const generateList = (
    data: TreeDataNode[],
    list: { key: string | number; title: string; fullTitle: string }[],
  ) => {
    for (let i = 0; i < data.length; i++) {
      const node = data[i];
      if (typeof node.key === 'string' && node.key.includes('__show_more')) {
        continue;
      }
      const { key, title, fullTitle } = node;
      list.push({ key, title, fullTitle });
      if (node.children) {
        generateList(node.children, list);
      }
    }
    return list;
  };
  const dataList = generateList(initialData, []);

  const getParentKey = (
    key: string | number,
    tree: TreeDataNode[],
  ): string | number => {
    let parentKey: string | number;
    for (let i = 0; i < tree.length; i++) {
      const node = tree[i];
      if (node.children) {
        if (node.children.some(item => item.key === key)) {
          parentKey = node.key;
        } else if (getParentKey(key, node.children)) {
          parentKey = getParentKey(key, node.children);
        }
      }
    }
    return parentKey!;
  };

  const [filteredData, setFilteredData] = useState([]);
  const [expandedKeys, setExpandedKeys] = useState<string | number[]>([]);
  const [searchValue, setSearchValue] = useState('');
  const [autoExpandParent, setAutoExpandParent] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [visibleCounts, setVisibleCounts] = useState<Record<string, number>>(
    {},
  );

  useEffect(() => {
    setExpandedKeys(checkedKeys);
  }, []);

  const onExpand = (newExpandedKeys: string | number[]) => {
    setExpandedKeys(newExpandedKeys);
    setAutoExpandParent(false);
  };

  const onSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNotFound(false);
    const { value } = e.target;
    const newExpandedKeys = dataList
      .map(item => {
        if (typeof item.key === 'string' && item.key.includes('__show_more')) {
          return null;
        }
        if (item.title.toLowerCase().indexOf(value.toLowerCase()) > -1) {
          return getParentKey(item.key, initialData);
        }
        return null;
      })
      .filter(
        (item, i, self): item is string | number =>
          !!(item && self.indexOf(item) === i),
      );
    if (!dataList.some(item => item.title.indexOf(value) > -1)) {
      setNotFound(true);
    }
    setExpandedKeys(newExpandedKeys);
    setSearchValue(value);
    setAutoExpandParent(true);
  };

  const paginateTreeNodes = (
    nodes: DataNode[],
    parentKey = '__root__',
  ): DataNode[] => {
    const visibleCount = visibleCounts[parentKey] ?? VISIBLE_VALUE;
    const visibleNodes = nodes.slice(0, visibleCount);

    const hasMore = nodes.length > visibleCount;

    const paginatedNodes = visibleNodes.map(node => {
      const children = node.children ?? [];

      const paginatedChildren = children.length
        ? paginateTreeNodes(children, node.key.toString())
        : [];

      return {
        ...node,
        children: paginatedChildren,
      };
    });

    if (hasMore) {
      paginatedNodes.push({
        key: `${parentKey}__show_more`,
        title: (
          <span
            onClick={e => {
              e.stopPropagation();
              setVisibleCounts(prev => ({
                ...prev,
                [parentKey]:
                  (prev[parentKey] ?? VISIBLE_VALUE) + SHOW_MORE_VALUE,
              }));
              setExpandedKeys(prev =>
                Array.from(new Set([...prev, parentKey])),
              );
            }}
            style={{
              color: theme.colors.primary.base,
              cursor: 'pointer',
            }}
          >
            {t('Show more')}
          </span>
        ),
        checkable: false,
        selectable: false,
        isLeaf: true,
      } as any);
    }
    return paginatedNodes;
  };

  const treeData = useMemo(() => {
    const filterTree = (data: DataNode[]): DataNode[] =>
      data
        .map(item => {
          if (item.key.toString().includes('__show_more')) {
            return item;
          }
          const strTitle = formatTitle
            ? formatTitle(item.title as string)
            : (item.title as string);

          const index = strTitle
            .toLowerCase()
            .indexOf(searchValue.toLowerCase());
          const beforeStr = strTitle.substring(0, index);
          const afterStr = strTitle.slice(index + searchValue.length);
          const match = strTitle.slice(index, index + searchValue.length);

          const title =
            index > -1 ? (
              <span>
                {beforeStr}
                <span
                  style={{
                    color: `${theme.colors.primary.base}`,
                    fontWeight: 'bold',
                  }}
                >
                  {match}
                </span>
                {afterStr}
              </span>
            ) : (
              <span>{strTitle}</span>
            );
          const filteredChildren = item.children
            ? filterTree(item.children)
            : [];
          if (
            index > -1 ||
            filteredChildren.filter(
              item => !item.key.toString().includes('__show_more'),
            ).length > 0
          ) {
            return {
              ...item,
              title,
              textTitle: item.title,
              children: filteredChildren,
            };
          }
          return null;
        })
        .filter(Boolean) as DataNode[];
    const filteredTree = filterTree(initialData);
    setFilteredData(filteredTree);

    if (withPagination) {
      const hasValues =
        filteredTree.filter(
          item => !item.key.toString().includes('__show_more'),
        ).length > 0;
      const paginated = paginateTreeNodes(filteredTree);
      return hasValues ? paginated : [];
    }

    return filteredTree;
  }, [searchValue, expandedKeys, initialData, visibleCounts]);

  useEffect(() => {
    setNotFound(treeData.length === 0);
  }, [treeData]);

  const onCollapseAll = () => {
    setExpandedKeys([]);
  };

  const onExpandAll = () => {
    const allKeys = dataList
      .filter(
        el => !(typeof el.key === 'string' && el.key.includes('__show_more')),
      )
      .map(el => el.key);
    setExpandedKeys(allKeys);
  };

  const countVisibleItems = (data: DataNode[]): number => {
    let count = 0;
    data.forEach(item => {
      if (typeof item.key === 'string' && item.key.includes('__show_more')) {
        return;
      }
      count += 1;
      if (item.children) {
        count += countVisibleItems(item.children);
      }
    });
    return count;
  };

  const currentTreeData = generateList(treeData, []);

  return (
    <>
      {withSearch && (
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
          {withSelectAll && (
            <AntdCheckbox
              onChange={e => handleSelectAllChange(e, dataList, searchValue)}
              disabled={currentTreeData?.length === 0}
              checked={currentTreeData?.every(item =>
                checkedKeys.includes(item.key),
              )}
              indeterminate={
                checkedKeys.some(
                  key => currentTreeData?.some(item => item.key === key),
                ) &&
                !currentTreeData?.every(item => checkedKeys.includes(item.key))
              }
            />
          )}
          {withCount && (
            <div
              style={{
                color: theme.colors.grayscale.light1,
              }}
            >
              {
                checkedKeys?.filter(
                  key => currentTreeData?.some(item => item.key === key),
                ).length
              }
              /{countVisibleItems(filteredData)}
            </div>
          )}
          {withToggle && (
            <StyledToggleContainer>
              <StyledExpandIcon iconSize="l" onClick={onExpandAll} />
              <StyledCollapseIcon iconSize="l" onClick={onCollapseAll} />
            </StyledToggleContainer>
          )}
          <Search
            allowClear
            value={searchValue}
            placeholder={t('Search')}
            onChange={onSearchChange}
            suffix={searchValue ? undefined : <StyledSearchIcon iconSize="l" />}
          />
        </div>
      )}
      {notFound && <div>{t('No results found')}</div>}
      <StyledTree
        checkable={checkable}
        checkStrictly={checkStrictly}
        onExpand={onExpand}
        expandedKeys={expandedKeys}
        autoExpandParent={autoExpandParent}
        treeData={treeData}
        onCheck={handleCheck}
        checkedKeys={checkedKeys}
      />
    </>
  );
};
