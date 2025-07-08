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
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { isEqual } from 'lodash';
import { css, styled, t, useTheme } from '@superset-ui/core';
import { useSelector } from 'react-redux';
import { Tree } from 'src/components/Tree';
import { RootState } from '@reduxjs/toolkit/dist/query/core/apiState';
import Icons from 'src/components/Icons';
import ErrorBoundary from 'src/components/ErrorBoundary';
import { StyledModal } from 'src/components/Modal';
import useEffectEvent from 'src/hooks/useEffectEvent';
import type { DataNode, TreeProps } from 'antd/es/tree';
import Footer from 'src/dashboard/components/nativeFilters/components/Footer/Footer';
import { StyledSelect } from 'src/components/Select/styles';
import {
  Checkbox as AntdCheckbox,
  Radio as AntdRadio,
  Select as AntdSelect,
} from 'antd';
import { Select } from 'src/components';
import { InputNumber, Input as Search } from 'src/components/Input';
import {
  selectorModalType,
  selectorName,
} from 'src/dashboard/components/nativeFilters/constants';
import ProductConfigurePane from './ProductConfigurePane';
import { getTextFromElement } from '../../utils';
import { SelectionInfoType } from '../../types';
import { RatingPopover } from '../../../RatingPopover/RatingPopover';
import { formatFulldesc } from 'src/dashboard/components/nativeFilters/FilterBar/utils';
import { LevelOption } from 'src/dashboard/reducers/customizeSlice';

const MODAL_MARGIN = 16;
const MIN_WIDTH = 1320;

const StyledModalWrapper = styled(StyledModal)<{ expanded: boolean }>`
  min-width: ${MIN_WIDTH}px;
  width: ${({ expanded }) => (expanded ? '100%' : MIN_WIDTH)} !important;

  @media (max-width: ${MIN_WIDTH + MODAL_MARGIN * 2}px) {
    width: 100% !important;
    min-width: auto;
  }

  .ant-modal-body {
    padding: 0px;
  }

  ${({ expanded }) =>
    expanded &&
    css`
      height: 100%;

      .ant-modal-body {
        flex: 1 1 auto;
      }
      .ant-modal-content {
        height: 100%;
      }
    `}
`;

export const StyledModalBody = styled.div<{ expanded: boolean }>`
  display: flex;
  height: ${({ expanded }) => (expanded ? '100%' : '550px')};
  flex-direction: row;
  flex: 1;
  .filters-list {
    width: ${({ theme }) => theme.gridUnit * 50}px;
    overflow: auto;
  }
`;

export const StyledExpandButtonWrapper = styled.div`
  margin-left: ${({ theme }) => theme.gridUnit * 4}px;
`;
export const StyledSepFunctionWrapper = styled.div`
  gap: ${({ theme }) => theme.gridUnit}px;
  display: flex;
  justify-content: end;
  margin: ${({ theme }) => theme.gridUnit}px
    ${({ theme }) => theme.gridUnit * 4}px;
`;

const StyledError = styled.div`
  display: flex;
  width: 100%;
  justify-content: center;
`;

const StyledItemsContainer = styled.div`
  display: flex;
  flex-direction: column;
`;

const StyledSearchIcon = styled(Icons.Search)`
  color: ${({ theme }) => theme.colors.grayscale.light1};
`;
const StyledFilterIcon = styled(Icons.Filter)`
  color: ${({ theme }) => theme.colors.grayscale.light1};
  cursor: pointer;
`;
const StyledCloseIcon = styled(Icons.Close)`
  color: ${({ theme }) => theme.colors.grayscale.light1};
  margin-top: ${({ theme }) => theme.gridUnit}px;
  cursor: pointer;
`;

const StyledTrashIconActive = styled(Icons.Trash)`
  color: ${({ theme }) => theme.colors.grayscale.base};
`;

const StyledTrashIconDisabled = styled(Icons.Trash)`
  color: ${({ theme }) => theme.colors.grayscale.light3};
`;

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

const Radio = styled(AntdRadio)`
  .ant-radio-inner::after {
    width: 9px;
    height: 9px;
    border-radius: 9px;
  }
`;

export interface ProductConfigModalProps {
  isOpen: boolean;
  onSave: (checkedOptions: DataNode) => Promise<void>;
  onCancel: () => void;
  modalType: 'product' | 'productAll';
  onPreview: (chosenItems: string[], treeId: string) => Promise<void>;
}

function ProductConfigModal({
  modalType,
  isOpen,
  onSave,
  onCancel,
  onPreview,
}: ProductConfigModalProps) {
  const { Option } = AntdSelect;

  const {
    options,
    dictOptions: treeData = [],
    quantity,
    chosenHierarchy,
  } = useSelector((state: RootState) => state.selectors.selectors[modalType]);

  const initialCheckedData = options.map(item => ({
    title: item.title,
    key: item.value,
    fullTitle: item.fullTitle,
    ids: item?.ids,
    hierarchyMode: item.hierarchyMode,
  }));

  const {
    value: initialTreeId,
    chosenItems: initialChosenItems,
    chosenFilters: initialChosenFilters,
  } = chosenHierarchy;
  const [treeId, setTreeId] = useState('');
  const [itemsList, setItemsList] = useState([]);
  const [chosenFilters, setChosenFilters] = useState({});
  const [chosenItems, setChosenItems] = useState([]);

  const [checkedData, setCheckedData] = useState([]);
  const initialCurrentProductId = checkedData.length ? checkedData[0].key : '0';
  const [currentProductId, setCurrentProductId] = useState(
    initialCurrentProductId,
  );

  const [mode, setMode] = useState<'basic' | 'advanced'>('advanced');

  useEffect(() => {
    if (options.length > 0) {
      setCheckedData(
        options.map(item => ({
          title: item.title,
          key: item.value,
          fullTitle: item.fullTitle,
          ids: item?.ids,
          hierarchyMode: item.hierarchyMode,
        })),
      );
    }
  }, [options]);

  const theme = useTheme();

  const [saveAlertVisible, setSaveAlertVisible] = useState<boolean>(false);

  const maxQuantity = useMemo(
    () => (modalType === selectorModalType.product ? quantity : 30),
    [quantity, modalType],
  );

  //last N part

  const { isChartsLevelOnly, chartLevel, constructorLevel } = useSelector(
    (state: RootState) => state.customizeOptions.lastNOptions,
  );

  const [lastNOptions, setLastNOptions] = useState<LevelOption>(
    // isChartsLevelOnly
    // ? chartLevel :
    //  constructorLevel,
    constructorLevel,
  );

  const formatTitle = useCallback(
    (value: any) => {
      return formatFulldesc(value, lastNOptions);
    },
    [lastNOptions],
  );

  // useEffect(() => {
  //   setLastNOptions(isChartsLevelOnly ? chartLevel : constructorLevel);
  // }, [isChartsLevelOnly, chartLevel, constructorLevel]);
  //last N part

  const handleTreeCheck: TreeProps['onCheck'] = (_, info) => {
    if (info.checked && checkedData.length === maxQuantity) {
      return;
    }
    let checkedNodes;
    if (info.checked) {
      checkedNodes = [
        ...checkedData,
        {
          title: info.node.textTitle || getTextFromElement(info.node.title),
          key: info.node.key,
          fullTitle: info.node.fullTitle,
          ids: info.node.ids,
          hierarchyMode: info.node.hierarchyMode,
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

  const ratingProductsHandler = (ratedProducts = []) => {
    setCheckedData(prev => {
      const selectedKeys = prev.map(p => p.key);

      const preparedProducts = ratedProducts.filter(
        p => !selectedKeys.includes(p.key),
      );

      return [...prev, ...preparedProducts];
    });
  };

  const getKeys = (data: DataNode[]) => data.map(element => element.key);

  const handleTitleTabChange = (productId: string) => {
    setCurrentProductId(productId);
  };

  const handleRemoveItem = deletedId => {
    setCheckedData(currentData =>
      currentData.filter(node => node.key !== deletedId),
    );
  };

  const handleClearAllItems = () => {
    setCheckedData([]);
  };

  const handleClearAllChosen = () => {
    setChosenFilters({});
    setChosenItems([]);
  };

  const resetForm = () => {
    setCurrentProductId(initialCurrentProductId);
    setSaveAlertVisible(false);
    setCheckedData(initialCheckedData);
  };

  const handleSave = () => {
    onSave(checkedData);
  };

  const handleConfirmCancel = () => {
    resetForm();
    onCancel();
  };

  const handleCancel = () => {
    if (!isEqual(checkedData, initialCheckedData)) {
      setSaveAlertVisible(true);
    } else {
      handleConfirmCancel();
    }
  };

  const [expanded, setExpanded] = useState(false);
  const toggleExpand = useEffectEvent(() => {
    setExpanded(!expanded);
  });
  const ToggleIcon = expanded
    ? Icons.FullscreenExitOutlined
    : Icons.FullscreenOutlined;

  const getHierarchyItems = (hierarchy: DataNode, hierarchyList) => {
    const { type, title, parent } = hierarchy;
    if (hierarchyList.indexOf(type) < 0 && hierarchyList.indexOf(title) < 0) {
      hierarchyList.push(parent === '' ? title : type);
    }
    if (hierarchy.children) {
      hierarchy.children.forEach(hierarchy => {
        getHierarchyItems(hierarchy, hierarchyList);
      });
    }
    return hierarchyList;
  };

  const getHierarchyFilters = (hierarchy: DataNode, filters = {}) => {
    const { type, title } = hierarchy;
    if (!filters[type]?.includes(title)) {
      filters[type] = [...(filters[type] || []), title];
    }
    if (hierarchy.children) {
      hierarchy.children.forEach(hierarchy => {
        getHierarchyFilters(hierarchy, filters);
      });
    }
    return filters;
  };

  const hierarchyItems =
    treeData?.map(obj => ({
      label: obj.title,
      key: obj.key,
      value: obj.key,
      items: getHierarchyItems(obj, []),
    })) || [];

  useEffect(() => {
    setTreeId(initialTreeId);
    setChosenItems(initialChosenItems);
    setChosenFilters(initialChosenFilters);
    const initialHierarchy = hierarchyItems.find(
      tree => tree.value === initialTreeId,
    );
    setItemsList(initialHierarchy?.items || []);
  }, [initialTreeId, initialChosenItems, initialChosenFilters]);

  const [filteredTreeData, setFilteredTreeData] = useState([]);

  function filterTree(
    treeData: DataNode[],
    selectedTreeId: string,
    selectedTypes: string[] = [],
    selectedFilters: { [key: string]: string[] } = {},
  ) {
    const mainTree = treeData.filter(node => node.key === selectedTreeId);

    const passesFiltration = node => {
      if (Object.keys(selectedFilters).length === 0) return true;
      if (!selectedFilters.hasOwnProperty(node.type)) return true;

      return Object.entries(selectedFilters).some(
        ([filterType, allowedValues]) => {
          if (
            filterType === node.type &&
            (allowedValues.length === 0 || allowedValues.includes(node.title))
          ) {
            return true;
          }
          return false;
        },
      );
    };

    const containsDeepest = node => {
      const filters = Object.entries(selectedFilters).filter(
        ([_, allowedValues]) => allowedValues.length > 0,
      );

      if (filters.length === 0) return true;

      return filters.every(([filterType, allowedValues]) => {
        if (itemsList.indexOf(filterType) < itemsList.indexOf(node.type)) {
          return true;
        }

        if (node.type === filterType) {
          return allowedValues.includes(node.title);
        }
        if (node.children.length > 0) {
          return node.children.some(containsDeepest);
        }

        return false;
      });
    };

    function filterNode(node) {
      const matchesTypeOrTitle =
        selectedTypes.includes(node.type) || selectedTypes.includes(node.title);

      const branchPassedFiltration = passesFiltration(node);
      const branchContainsDeepest = containsDeepest(node);

      if (
        branchPassedFiltration &&
        matchesTypeOrTitle &&
        branchContainsDeepest
      ) {
        const newNode = { ...node };
        if (node.children) {
          const filteredChildren = node.children
            .map(filterNode)
            .filter(Boolean)
            .flat(Infinity);

          if (filteredChildren.length > 0) {
            newNode.children = filteredChildren;
          } else {
            delete newNode.children;
          }
        }
        return newNode;
      }

      if (branchPassedFiltration && branchContainsDeepest && node.children) {
        return node.children.map(filterNode).filter(Boolean);
      }

      return null;
    }
    return mainTree.map(filterNode).flat(Infinity).filter(Boolean);
  }

  function generateKey(type: string, title: string) {
    return `${type}-${title}`.replace(/\s+/g, '-').toLowerCase();
  }

  function transformTree(filteredTree: any[], flag: 'basic' | 'advanced') {
    if (flag === 'advanced') return filteredTree;

    const map = new Map<
      string,
      {
        type: string;
        title: string;
        hierarchyMode: string;
        key: string;
        ids: string[];
      }
    >();

    filteredTree.forEach(item => {
      const identifier = `${item.type}-${item.title}`;
      const stableKey = generateKey(item.key, item.type, item.title);

      if (!map.has(identifier)) {
        map.set(identifier, {
          type: item.type,
          title: item.title,
          fullTitle: item.title,
          hierarchyMode: 'basic',
          key: stableKey,
          ids: [item.key],
        });
      } else {
        map.get(identifier)!.ids.push(item.key);
      }
    });

    return Array.from(map.values());
  }

  const handleSelectAllChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    allKeys: DataNode[],
    searchValue = '',
  ) => {
    const searchedData = allKeys.filter(
      item => item.title?.toLowerCase().includes(searchValue.toLowerCase()),
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

  const updateFilterTreeData = useCallback(() => {
    setFilteredTreeData(
      filterTree(treeData, treeId, chosenItems, chosenFilters),
    );
  }, [treeData, treeId, chosenItems, chosenFilters]);

  const clearFilterTreeData = () => {
    setFilteredTreeData(filterTree(treeData, treeId));
  };

  const handleHierarchyChange = (value, options) => {
    clearFilterTreeData();
    setChosenItems([]);
    setTreeId(value);
    setItemsList(options.items);
    setChosenFilters({});
  };

  const handleFilterClear = () => {
    setChosenFilters({});
  };

  const [selectVisible, setSelectVisible] = useState<{
    [key: string]: boolean;
  }>({});

  const toggleSelectVisible = (key: string) => {
    setSelectVisible(prevState => {
      const newState = Object.keys(prevState).reduce((acc, curr) => {
        acc[curr] = false;
        return acc;
      }, {});
      return {
        ...newState,
        [key]: !prevState[key],
      };
    });
  };

  const chosenHierarchyInfo = useMemo(
    () => ({
      allCount: itemsList.length,
      checkedCount: chosenItems.length,
    }),
    [chosenItems, itemsList],
  );

  const handleSelectAllHierarchyChange = () => {
    if (!itemsList.every(item => chosenItems.includes(item))) {
      setChosenItems(itemsList);
    } else {
      setChosenItems([]);
    }
  };

  const getFilteredOptions = (item: string) => {
    const filtersExceptCurrent = { ...chosenFilters, [item]: [] };
    return getHierarchyFilters(
      filterTree(treeData, treeId, itemsList, filtersExceptCurrent)[0],
    )[item];
  };

  const errorCase = (
    <StyledError>
      <h3>{t('No available data')}</h3>
    </StyledError>
  );

  const memoizedFilterOptionsMap = useMemo(() => {
    const optionsMap = {};
    itemsList.forEach(item => {
      optionsMap[item] = getFilteredOptions(item);
    });
    return optionsMap;
  }, [chosenFilters, itemsList]);

  const productHierarchy = useMemo(
    () => (
      <div
        style={{
          height: '100%',
          overflowY: 'auto',
          display: 'block',
          margin: theme.gridUnit * 2,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            width: '100%',
            gap: theme.gridUnit * 2,
          }}
        >
          <AntdCheckbox
            onChange={handleSelectAllHierarchyChange}
            disabled={itemsList.length === 0}
            checked={itemsList.every(item => chosenItems.includes(item))}
            indeterminate={
              chosenItems.some(chosenItem =>
                itemsList.some(item => item === chosenItem),
              ) && !itemsList.every(item => chosenItems.includes(item))
            }
          />
          <div
            style={{
              color: theme.colors.grayscale.light1,
            }}
          >
            {chosenHierarchyInfo.checkedCount}/{chosenHierarchyInfo.allCount}
          </div>
          <StyledSelect
            style={{ width: '100%', flexGrow: 1 }}
            value={treeId}
            placeholder="Select hierarchy"
            onChange={(value, options) => {
              handleHierarchyChange(value, options);
            }}
            optionLabelProp="label"
          >
            {hierarchyItems.map(el => (
              <Option
                items={el.items}
                value={el.key}
                label={formatTitle(el.label)}
              >
                <div style={{ textWrap: 'wrap' }}>
                  {formatTitle(el.label)}
                  <div
                    style={{
                      fontSize: theme.typography.sizes.xs,
                      color: theme.colors.grayscale.light1,
                      lineHeight: `${theme.typography.sizes.s}px`,
                      textWrap: 'wrap',
                    }}
                  >
                    {el.items
                      .map(e => formatTitle(e))
                      .slice(1)
                      .join(' > ')}
                  </div>
                </div>
              </Option>
            ))}
          </StyledSelect>
          {!isEqual(
            Object.values(chosenFilters).filter(val => val.length !== 0),
            [],
          ) ? (
            <StyledTrashIconActive
              iconSize="xl"
              onClick={event => {
                event.stopPropagation();
                handleFilterClear();
              }}
              alt="ClearAll"
            />
          ) : (
            <StyledTrashIconDisabled iconSize="xl" alt="ClearAll" />
          )}
        </div>
        <StyledItemsContainer>
          {itemsList?.map((item, index) => {
            const isActive = chosenItems.includes(item);
            const memoizedFilterOptions = memoizedFilterOptionsMap[item];

            return (
              <div
                key={item}
                style={{
                  marginTop: theme.gridUnit * 2,
                  marginLeft: theme.gridUnit,
                  display: 'flex',
                  gap: theme.gridUnit * 3,
                }}
              >
                <AntdCheckbox
                  checked={isActive}
                  onChange={() => {
                    setChosenItems(prev => {
                      const updated = prev.includes(item)
                        ? prev.filter(i => i !== item)
                        : [...prev, item];
                      return updated.sort(
                        (a, b) => itemsList.indexOf(a) - itemsList.indexOf(b),
                      );
                    });
                  }}
                />
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
                        onClick={() => {
                          toggleSelectVisible(item);
                        }}
                      />
                      <Badge
                        onClick={() => {
                          toggleSelectVisible(item);
                        }}
                      >
                        {chosenFilters[item]?.length || null}
                      </Badge>
                      {selectVisible[item] && (
                        <FilterContainer>
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                            }}
                          >
                            {`${item} ${t('FILTER')}`}
                            <StyledCloseIcon
                              iconSize="m"
                              onClick={() => toggleSelectVisible(item)}
                            />
                          </div>
                          <Select
                            style={{
                              marginTop: theme.gridUnit,
                            }}
                            value={chosenFilters[item]}
                            placeholder={t('Select a filter')}
                            onChange={value => {
                              setChosenFilters(prev => ({
                                ...prev,
                                [item]: value,
                              }));
                            }}
                            showSearch
                            mode="multiple"
                            allowSelectAll
                            getPopupContainer={() => document.body}
                            listHeight={150}
                            options={memoizedFilterOptions.map(el => ({
                              value: el,
                              label: formatTitle(el),
                            }))}
                          />
                        </FilterContainer>
                      )}
                    </BadgeWrapper>
                  )}
                </div>
              </div>
            );
          })}
        </StyledItemsContainer>
      </div>
    ),
    [hierarchyItems, itemsList, lastNOptions],
  );

  const basicProductHierarchy = useMemo(
    () => (
      <div
        style={{
          height: '100%',
          overflowY: 'auto',
          display: 'block',
          margin: theme.gridUnit * 2,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            width: '100%',
            gap: theme.gridUnit * 2,
          }}
        >
          <StyledSelect
            style={{ width: '100%', flexGrow: 1 }}
            value={treeId}
            placeholder="Select hierarchy"
            onChange={(value, options) => {
              handleHierarchyChange(value, options);
            }}
            optionLabelProp="label"
          >
            {hierarchyItems.map(el => (
              <Option
                items={el.items}
                value={el.key}
                label={formatTitle(el.label)}
              >
                <div style={{ textWrap: 'wrap' }}>
                  {formatTitle(el.label)}
                  <div
                    style={{
                      fontSize: theme.typography.sizes.xs,
                      color: theme.colors.grayscale.light1,
                      lineHeight: `${theme.typography.sizes.s}px`,
                      textWrap: 'wrap',
                    }}
                  >
                    {el.items
                      .map(e => formatTitle(e))
                      .slice(1)
                      .join(' > ')}
                  </div>
                </div>
              </Option>
            ))}
          </StyledSelect>
        </div>
        <StyledItemsContainer>
          {itemsList?.map((item, index) => {
            const isActive = chosenItems.includes(item);

            return (
              <div
                key={item}
                style={{
                  marginTop: theme.gridUnit * 2,
                  marginLeft: theme.gridUnit,
                  display: 'flex',
                  gap: theme.gridUnit,
                }}
              >
                <Radio
                  checked={isActive}
                  onClick={() => {
                    setChosenItems(prev =>
                      prev.includes(item)
                        ? prev.filter(i => i !== item)
                        : [item],
                    );
                  }}
                />
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                  }}
                >
                  {formatTitle(item)}
                </div>
              </div>
            );
          })}
        </StyledItemsContainer>
      </div>
    ),
    [hierarchyItems, itemsList, lastNOptions],
  );

  const [searchValue, setSearchValue] = useState('');
  const [notFound, setNotFound] = useState(false);

  const handleSearchChange = e => {
    const { value } = e.target;
    setSearchValue(value);
    setNotFound(
      filteredTreeData?.every(
        item => item.title.toLowerCase().indexOf(value.toLowerCase()) === -1,
      ),
    );
  };

  const highlightText = (text, highlight) => {
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

  const renderCheckboxes = (transformedData: DataNode[]) =>
    transformedData?.map(item => (
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
        <div>{highlightText(formatTitle(item.title), searchValue)}</div>
      </div>
    ));

  const productTree = useMemo(() => {
    const filteredData = filteredTreeData?.filter(
      item => item.title?.toLowerCase().includes(searchValue.toLowerCase()),
    );
    const transformedData = transformTree(filteredData, mode);

    return (
      <div
        style={{
          height: 'auto',
          overflowY: 'auto',
          display: 'block',
          margin: theme.gridUnit * 2,
        }}
      >
        {filteredTreeData?.some(node => node.children) ? (
          <Tree
            initialData={filteredTreeData}
            withSearch
            withCount
            withSelectAll
            withToggle
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
                    data =>
                      transformedData?.some(item => item.key === data.key),
                  ) &&
                  !transformedData?.every(
                    item => checkedData?.some(data => data.key === item.key),
                  )
                }
              />
              <div
                style={{
                  color: theme.colors.grayscale.light1,
                }}
              >
                {
                  checkedData?.filter(
                    data =>
                      transformedData?.some(item => item.key === data.key),
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
  }, [
    treeData,
    checkedData,
    filteredTreeData,
    searchValue,
    notFound,
    lastNOptions,
  ]);

  const modalTitle =
    modalType === selectorModalType.product
      ? t(selectorName.product)
      : t(selectorName.productAll);

  const handleRearrange = (dragIndex: number, targetIndex: number) => {
    const newOrderedCheckedData = [...checkedData];
    const removed = newOrderedCheckedData.splice(dragIndex, 1)[0];
    newOrderedCheckedData.splice(targetIndex, 0, removed);
    setCheckedData(newOrderedCheckedData);
  };

  const selectionInfo: SelectionInfoType = {
    selectedDataCount: checkedData.length,
    maxQuantity,
  };

  useEffect(() => {
    updateFilterTreeData();
  }, [chosenItems, chosenFilters, treeId, updateFilterTreeData, lastNOptions]);

  const emptyTree = treeData.length === 0;

  const formChosenItems = () => {
    const addKeys = (obj: any) => {
      keys.push(obj.key);
      if (Array.isArray(obj.children)) {
        obj.children.forEach((o: any) => addKeys(o));
      }
    };

    const keys: string[] = [];
    filteredTreeData.forEach(o => addKeys(o));

    return keys;
  };

  return (
    <StyledModalWrapper
      visible={isOpen}
      maskClosable={false}
      title={modalTitle}
      expanded={expanded}
      destroyOnClose
      onCancel={handleCancel}
      onOk={handleSave}
      centered
      footer={
        <div
          css={css`
            display: flex;
            justify-content: space-between;
            align-items: center;
          `}
        >
          {/* <span> </span> remove when dev */}
          <RatingPopover
            onSubmitHandler={ratingProductsHandler}
            chosenItems={formChosenItems()}
            chosenProductsCount={checkedData.length}
          />
          <div
            css={css`
              display: flex;
              justify-content: flex-end;
              align-items: flex-end;
            `}
          >
            <Footer
              applyTitle="Apply"
              onDismiss={() => setSaveAlertVisible(false)}
              onCancel={handleCancel}
              handleSave={() => {
                onPreview(chosenItems, chosenFilters, treeId);
                handleSave();
              }}
              canSave={
                !isEqual(checkedData, initialCheckedData) && checkedData.length
              }
              saveAlertVisible={saveAlertVisible}
              onConfirmCancel={handleConfirmCancel}
            />
            <StyledExpandButtonWrapper>
              <ToggleIcon
                iconSize="l"
                iconColor={theme.colors.grayscale.dark2}
                onClick={toggleExpand}
              />
            </StyledExpandButtonWrapper>
          </div>
        </div>
      }
    >
      <ErrorBoundary>
        {/* <StyledSepFunctionWrapper>
          <div style={{ width: 200 }}>
            <Select
              value={lastNOptions.type}
              onChange={v =>
                setLastNOptions(prev => ({
                  ...prev,
                  type: v,
                }))
              }
              options={[
                { value: 'custom', label: t('Custom level name') },
                { value: 'full', label: t('Full name') },
                { value: 'short', label: t('Short name') },
              ]}
              placeholder={t('Select a field')}
              allowClear
            />
          </div>
          {lastNOptions.type === 'custom' && (
            <InputNumber
              style={{ width: 150 }}
              min={1}
              max={10}
              value={lastNOptions.customLevel}
              onChange={v => {
                setLastNOptions(prev => ({
                  ...prev,
                  customLevel: v ? +v : undefined,
                }));
              }}
              placeholder={t('Select level')}
            />
          )}
        </StyledSepFunctionWrapper> */}
        <StyledModalBody expanded={expanded}>
          <ProductConfigurePane
            onRemove={handleRemoveItem}
            formatTitle={formatTitle}
            onChange={handleTitleTabChange}
            currentProductId={currentProductId}
            checkedData={checkedData}
            clearAll={handleClearAllItems}
            clearChosen={handleClearAllChosen}
            maxQuantity={maxQuantity}
            onRearrange={handleRearrange}
            selectionInfo={selectionInfo}
            mode={mode}
            setMode={setMode}
          >
            {{
              advanced_hierarchy: emptyTree ? errorCase : productHierarchy,
              basic_hierarchy: emptyTree ? errorCase : basicProductHierarchy,
              tree: emptyTree ? errorCase : productTree,
            }}
          </ProductConfigurePane>
        </StyledModalBody>
      </ErrorBoundary>
    </StyledModalWrapper>
  );
}

export default React.memo(ProductConfigModal);
