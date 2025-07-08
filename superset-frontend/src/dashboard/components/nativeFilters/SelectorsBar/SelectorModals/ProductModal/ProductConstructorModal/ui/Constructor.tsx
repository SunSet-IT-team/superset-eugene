import {styled, t} from '@superset-ui/core';
import {Resizable} from 're-resizable';
import React, {Dispatch, memo, SetStateAction, useEffect, useMemo, useRef, useState,} from 'react';
import {Popconfirm} from 'antd';
import {DataNode} from 'antd/es/tree';
import {isEqual} from 'lodash';
import ProductTitlePane from '../../ProductConfigModal/ProductTitlePane';
import {calcSecondColWidth, filterTree} from '../utils';
import {SelectionInfoType} from '../../../types';
import {selectorModalType} from '../../../../../constants';
import {ProductDictOption, ProductOption,} from '../../../../../../../features/selectors/types';
import BasicHierarchy from './hierarchy/BasicHierarchy';
import AdvancedHierarchy from './hierarchy/AdvancedHierarchy';
import ProductTree from './ProductTree';
import {LevelOption} from '../../../../../../../reducers/customizeSlice';

const Container = styled.div`
  display: flex;
  height: 100%;
  width: 100%;
`;

const ContentHolder = styled.div<{
  width?: number;
}>`
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow-x: auto;
  border-right: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
`;

const TitlesContainer = styled.div`
  width: 100%;
`;

const StyledTabTitle = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  border-bottom: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
  ${({ theme }) => `
  color: ${theme.colors.grayscale.dark1};
  font-size: ${theme.typography.sizes.m}px;
  padding: ${theme.gridUnit * 3}px;
`}
`;

const StyledBtnTabTitle = styled.button<{
  isActive: boolean;
  onlyAdvancedMode?: boolean;
}>`
  width: 50%;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  ${({ theme, isActive, onlyAdvancedMode }) => `
  cursor: ${onlyAdvancedMode && !isActive ? 'not-allowed' : 'pointer'};
  color: ${
    isActive ? theme.colors.grayscale.dark1 : theme.colors.grayscale.base
  };
  background-color: ${theme.colors.grayscale.light5};
  &:hover {
    color: ${
    !isActive && !onlyAdvancedMode
      ? theme.colors.primary.base
      : theme.colors.grayscale.base
  };
  }
  font-size: ${theme.typography.sizes.m}px;
  font-weight: ${isActive ? '600' : '500'};
  padding-top: ${theme.gridUnit * 3}px;
  padding-bottom: ${theme.gridUnit * 3}px;
`}
`;

const StyledBtnContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  & :last-child {
    border-left: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
  }
  border-bottom: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
`;

const StyledError = styled.div`
  display: flex;
  width: 100%;
  justify-content: center;
`;

interface ConstructorProps {
  className?: string;
  formatTitle: (value: any, options?: any) => any;
  modalType: 'product' | 'productAll';
  quantity: number;
  treeData: ProductDictOption[];
  filteredTreeData: ProductDictOption[];
  setFilteredTreeData: Dispatch<SetStateAction<ProductDictOption[]>>;
  treeId: string;
  setTreeId: Dispatch<SetStateAction<string>>;
  currentProductId: string;
  setCurrentProductId: Dispatch<SetStateAction<string>>;
  checkedData: ProductOption[];
  setCheckedData: Dispatch<SetStateAction<ProductOption[]>>;
  itemsList: string[];
  setItemsList: Dispatch<SetStateAction<string[]>>;
  chosenItems: string[];
  setChosenItems: Dispatch<SetStateAction<string[]>>;
  chosenFilters: Record<string, string[]>;
  setChosenFilters: Dispatch<SetStateAction<Record<string, string[]>>>;
  chosenHierarchy: {
    value: string;
    chosenItems: string[];
    chosenFilters: {
      [p: string]: string[];
    };
  };
  initialCheckedData: {
    title: string;
    key: string;
    fullTitle: string;
    ids: string[] | undefined;
    label: string;
    value: string;
    hierarchyMode: 'basic' | 'advanced';
  }[];
  lastNOptions: LevelOption;
  isDefaultSelection: boolean;
  onlyAdvancedMode: boolean;
}

export const Constructor = memo(
  ({
    formatTitle,
    modalType,
    quantity,
    treeData,
    filteredTreeData,
    setFilteredTreeData,
    treeId,
    setTreeId,
    currentProductId,
    setCurrentProductId,
    checkedData,
    setCheckedData,
    itemsList,
    setItemsList,
    chosenItems,
    setChosenItems,
    chosenFilters,
    setChosenFilters,
    chosenHierarchy,
    initialCheckedData,
    lastNOptions,
    isDefaultSelection,
    onlyAdvancedMode,
   }: ConstructorProps) => {
    const {
      value: initialTreeId,
      chosenItems: initialChosenItems,
      chosenFilters: initialChosenFilters,
    } = chosenHierarchy;

    const hasInitialized = useRef(false);

    const [firstColWidth, setFirstColWidth] = useState(33);

    const [mode, setMode] = useState<'basic' | 'advanced'>('advanced');

    const [isSelectVisible, setIsSelectVisible] = useState<{
      [key: string]: boolean;
    }>({});

    useEffect(() => {
      if (!hasInitialized.current && initialCheckedData.length > 0) {
        setCheckedData(initialCheckedData);
        hasInitialized.current = true;
        const preferredMode =
          initialCheckedData[0]?.hierarchyMode ?? 'advanced';
        setMode(preferredMode);
      }
    }, [initialCheckedData]);

    useEffect(() => {
      setTreeId(initialTreeId);
      setChosenItems(initialChosenItems);
      setChosenFilters(initialChosenFilters);
      const initialHierarchy = hierarchyItems.find(
        tree => tree.value === initialTreeId,
      );
      setItemsList(initialHierarchy?.items || []);
    }, [initialTreeId, initialChosenItems, initialChosenFilters]);

    useEffect(() => {
      setFilteredTreeData(
        filterTree(treeData, treeId, itemsList, chosenItems, chosenFilters),
      );
    }, [chosenItems, chosenFilters, treeId, lastNOptions]);

    const chosenHierarchyInfo = useMemo(
      () => ({
        allCount: itemsList?.length,
        checkedCount: chosenItems?.length,
      }),
      [chosenItems, itemsList],
    );

    const handleSelectAllHierarchyChange = () => {
      if (!itemsList?.every(item => chosenItems.includes(item))) {
        setChosenItems(itemsList);
      } else {
        setChosenItems([]);
      }
    };

    const getHierarchyItems = (
      hierarchy: ProductDictOption,
      hierarchyList: string[],
    ) => {
      const { type, title, parent } = hierarchy;
      if (
        hierarchyList.indexOf(type) < 0 &&
        hierarchyList.indexOf(title as string) < 0
      ) {
        hierarchyList.push(parent === '' ? (title as string) : type);
      }
      if (hierarchy.children) {
        hierarchy.children.forEach(hierarchy => {
          getHierarchyItems(hierarchy, hierarchyList);
        });
      }
      return hierarchyList;
    };

    const getHierarchyFilters = (
      hierarchy: ProductDictOption,
      filters = {},
    ) => {
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

    const getFilteredOptions = (item: string): string[] => {
      const filtersExceptCurrent = { ...chosenFilters, [item]: [] };
      return getHierarchyFilters(
        filterTree(
          treeData,
          treeId,
          itemsList,
          itemsList,
          filtersExceptCurrent,
        )[0],
      )[item];
    };

    const toggleIsSelectVisible = (key: string) => {
      setIsSelectVisible(prevState => {
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

    const handleModeChange = (newMode: typeof mode) => () => {
      setChosenFilters({});
      setChosenItems([]);
      setCheckedData([]);
      setMode(newMode);
    };

    const hierarchyItems =
      treeData?.map(obj => ({
        label: obj.title,
        key: obj.key,
        value: obj.key,
        items: getHierarchyItems(obj, []),
      })) || [];

    const handleHierarchyChange = (
      value: string,
      options: DataNode & { items: string[] },
    ) => {
      setFilteredTreeData([]);
      setChosenItems([]);
      setTreeId(value);
      setItemsList(options.items);
      setChosenFilters({});
    };

    const handleFilterClear = () => {
      setChosenFilters({});
    };

    const handleProductTitleSelect = (productId: string) => {
      setCurrentProductId(productId);
    };

    const handleRemoveSelectedProduct = (deletedId: string) => {
      setCheckedData(currentData =>
        currentData.filter(node => node.key !== deletedId),
      );
    };

    const handleSelectedProductRearrange = (
      dragIndex: number,
      targetIndex: number,
    ) => {
      const newOrderedCheckedData = [...checkedData];
      const removed = newOrderedCheckedData.splice(dragIndex, 1)[0];
      newOrderedCheckedData.splice(targetIndex, 0, removed);
      setCheckedData(newOrderedCheckedData);
    };

    const maxQuantity = useMemo(
      () => (modalType === selectorModalType.product ? quantity : 30),
      [quantity, modalType],
    );

    const selectionInfo: SelectionInfoType = {
      selectedDataCount: checkedData.length,
      maxQuantity,
    };

    const emptyTree = treeData.length === 0;

    return (
      <Container>
        <Resizable
          enable={{ left: false, right: true }}
          // onResizeStop={handleResizeFirst}
          onResize={(e, direction, ref) => {
            const newWidth = (ref.offsetWidth / window.innerWidth) * 100;
            setFirstColWidth(newWidth);
          }}
          minWidth="20%"
          maxWidth="50%"
          defaultSize={{
            width: '25%',
            height: '100%',
          }}
        >
          <ContentHolder>
            {onlyAdvancedMode ? (
              <StyledBtnContainer>
                <StyledBtnTabTitle isActive={mode === 'basic'} onlyAdvancedMode>
                  {t('Basic Mode')}
                </StyledBtnTabTitle>

                <StyledBtnTabTitle
                  isActive={mode === 'advanced'}
                  onlyAdvancedMode
                >
                  {t('Advanced Mode')}
                </StyledBtnTabTitle>
              </StyledBtnContainer>
            ) : (
              <StyledBtnContainer>
                {(isDefaultSelection &&
                  isEqual(checkedData, initialCheckedData)) ||
                checkedData.length === 0 ? (
                  <StyledBtnTabTitle
                    isActive={mode === 'basic'}
                    onClick={handleModeChange('basic')}
                  >
                    {t('Basic Mode')}
                  </StyledBtnTabTitle>
                ) : (
                  <Popconfirm
                    title={t('Changing mode will clear the selection')}
                    onConfirm={handleModeChange('basic')}
                    onCancel={() => {}}
                    okText={t('Change')}
                    cancelText={t('Cancel')}
                    okButtonProps={{ type: 'link' }}
                    cancelButtonProps={{ type: 'link', danger: true }}
                    disabled={mode === 'basic'}
                  >
                    <StyledBtnTabTitle
                      isActive={mode === 'basic'}
                      // disabled //remove when dev add when stage
                    >
                      {t('Basic Mode')}
                    </StyledBtnTabTitle>
                  </Popconfirm>
                )}
                {isDefaultSelection && checkedData.length === 0 ? (
                  <StyledBtnTabTitle
                    isActive={mode === 'advanced'}
                    onClick={handleModeChange('advanced')}
                  >
                    {t('Advanced Mode')}
                  </StyledBtnTabTitle>
                ) : (
                  <Popconfirm
                    title={t('Changing mode will clear the selection')}
                    onConfirm={handleModeChange('advanced')}
                    onCancel={() => {}}
                    okText={t('Change')}
                    cancelText={t('Cancel')}
                    okButtonProps={{ type: 'link' }}
                    cancelButtonProps={{ type: 'link', danger: true }}
                    disabled={mode === 'advanced'}
                    // disabled //remove when dev add when stage
                  >
                    <StyledBtnTabTitle isActive={mode === 'advanced'}>
                      {t('Advanced Mode')}
                    </StyledBtnTabTitle>
                  </Popconfirm>
                )}
              </StyledBtnContainer>
            )}
            {emptyTree ? (
              <StyledError>
                <h3>{t('No available data')}</h3>
              </StyledError>
            ) : mode === 'basic' ? (
              <BasicHierarchy
                formatTitle={formatTitle}
                treeId={treeId}
                handleHierarchyChange={handleHierarchyChange}
                hierarchyItems={hierarchyItems}
                itemsList={itemsList}
                chosenItems={chosenItems}
                setChosenItems={setChosenItems}
              />
            ) : (
              <AdvancedHierarchy
                formatTitle={formatTitle}
                treeId={treeId}
                itemsList={itemsList}
                chosenItems={chosenItems}
                setChosenItems={setChosenItems}
                chosenFilters={chosenFilters}
                setChosenFilters={setChosenFilters}
                isSelectVisible={isSelectVisible}
                hierarchyItems={hierarchyItems}
                handleHierarchyChange={handleHierarchyChange}
                chosenHierarchyInfo={chosenHierarchyInfo}
                handleSelectAllHierarchyChange={handleSelectAllHierarchyChange}
                handleFilterClear={handleFilterClear}
                toggleIsSelectVisible={toggleIsSelectVisible}
                getFilteredOptions={getFilteredOptions}
              />
            )}
          </ContentHolder>
        </Resizable>
        <Resizable
          enable={{ left: false, right: true }}
          minWidth="20%"
          maxWidth={`${calcSecondColWidth(firstColWidth)}%`}
          defaultSize={{
            width: '37.5%',
            height: '100%',
          }}
        >
          <ContentHolder>
            <StyledTabTitle>{t('Preview')}</StyledTabTitle>
            <ProductTree
              maxQuantity={maxQuantity}
              mode={mode}
              formatTitle={formatTitle}
              filteredTreeData={filteredTreeData}
              setCurrentProductId={setCurrentProductId}
              checkedData={checkedData}
              setCheckedData={setCheckedData}
              chosenItems={chosenItems}
            />
          </ContentHolder>
        </Resizable>

        <TitlesContainer>
          <ProductTitlePane
            currentProductId={currentProductId}
            onChange={handleProductTitleSelect}
            onRemove={(id: string) => handleRemoveSelectedProduct(id)}
            checkedData={checkedData}
            clearAll={() => setCheckedData([])}
            maxQuantity={maxQuantity}
            onRearrange={handleSelectedProductRearrange}
            formatTitle={formatTitle}
            selectionInfo={selectionInfo}
          />
        </TitlesContainer>
      </Container>
    );
  },
);
