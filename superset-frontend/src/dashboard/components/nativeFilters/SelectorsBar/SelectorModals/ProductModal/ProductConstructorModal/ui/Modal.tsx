import {useTheme} from '@emotion/react';
import {css, styled, t} from '@superset-ui/core';
import {DataNode} from 'antd/lib/tree';
import React, {memo, useCallback, useState} from 'react';
import {RootState} from '@reduxjs/toolkit/dist/query/core/apiState';
import {LevelOption} from 'src/dashboard/reducers/customizeSlice';
import ErrorBoundary from 'src/components/ErrorBoundary';
import Icons from 'src/components/Icons';
import {StyledModal} from 'src/components/Modal';
import Footer from 'src/dashboard/components/nativeFilters/components/Footer/Footer';
import {selectorModalType, selectorName,} from 'src/dashboard/components/nativeFilters/constants';
import {useSelector} from 'react-redux';
import {ProductOption, ProductType,} from 'src/dashboard/features/selectors/types';
import {isEqual} from 'lodash';
import {formatFulldesc} from 'src/dashboard/components/nativeFilters/FilterBar/utils';
import {RatingPopover} from '../../../../RatingPopover/RatingPopover';
import {Constructor} from './Constructor';

interface ModalProps {
  className?: string;
  isOpen: boolean;
  onSave: (checkedOptions: DataNode) => Promise<void>;
  onCancel: () => void;
  modalType: 'product' | 'productAll';
  onPreview: (
    chosenItems: string[],
    chosenFilters: { [key: string]: string[] },
    treeId: string,
  ) => Promise<void>;
}

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
    padding: 0;
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

export const Modal = memo(
  ({
    isOpen,
    modalType,
    onCancel,
    onPreview,
    onSave, // className,
  }: ModalProps) => {
    const {
      options,
      dictOptions = [],
      constructorQuantity,
      chosenHierarchy,
      onlyAdvancedMode,
    } = useSelector(
      (state: any) => state.selectors.selectors[modalType] as ProductType,
    );

    const initialCheckedData = options.map(item => ({
      title: item.title,
      key: item.value,
      fullTitle: item.fullTitle,
      ids: item?.ids,
      label: item.label,
      value: item.value,
      hierarchyMode: item.hierarchyMode,
    }));

    const [checkedData, setCheckedData] = useState<ProductOption[]>(
      initialCheckedData || [],
    );
    const [itemsList, setItemsList] = useState([]);
    const [treeId, setTreeId] = useState('');
    const [chosenFilters, setChosenFilters] = useState({});
    const [chosenItems, setChosenItems] = useState<string[]>([]);
    const [filteredTreeData, setFilteredTreeData] = useState([]);

    const initialCurrentProductId = initialCheckedData[0]?.key || '0';
    const [currentProductId, setCurrentProductId] = useState(
      initialCurrentProductId,
    );

    const [expanded, setExpanded] = useState(false);
    const [saveAlertVisible, setSaveAlertVisible] = useState<boolean>(false);

    const [isDefaultSelection, setIsDefaultSelection] = useState<boolean>(true);

    const ToggleIcon = expanded
      ? Icons.FullscreenExitOutlined
      : Icons.FullscreenOutlined;

    const theme = useTheme();

    const modalTitle =
      modalType === selectorModalType.product
        ? t(selectorName.product)
        : t(selectorName.productAll);

    // last N part

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
      (value: any, options?: any) =>
        formatFulldesc(value, options || lastNOptions),
      [lastNOptions],
    );

    // useEffect(() => {
    //   setLastNOptions(isChartsLevelOnly ? chartLevel : constructorLevel);
    // }, [isChartsLevelOnly, chartLevel, constructorLevel]);

    // last N part

    const resetForm = () => {
      setCurrentProductId(initialCurrentProductId);
      setSaveAlertVisible(false);
      setCheckedData(initialCheckedData);
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

    const ratingProductsHandler = (ratedProducts: any[] = []) => {
      setCheckedData(prev => {
        const selectedKeys = prev.map(p => p.key);

        const preparedProducts = ratedProducts.filter(
          p => !selectedKeys.includes(p.key),
        );

        return [...prev, ...preparedProducts];
      });
    };

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
    const formRatingSelection = () => {
      const hierarhy = itemsList.map(el => {
        const filterKeys = Object.keys(chosenFilters);

        const findFiltered = (el: string, chosen: string) => {
          const addItems = (obj: any, needType: String, arr: any[]) => {
            if (needType === obj.type) {
              arr.push({ key: obj.key, title: obj.title });
            }
            const isInFilters = filterKeys.includes(obj.type);
            if (
              Array.isArray(obj.children) &&
              (isInFilters
                ? chosenFilters[obj.type].length
                  ? chosenFilters[obj.type]?.includes(obj.title)
                  : true
                : true)
            ) {
              obj.children.forEach((o: any) => addItems(o, el, arr));
            }
          };

          const elements: { key: string; title: string }[] = [];

          dictOptions
            .find(e => e.key === treeId)
            ?.children?.forEach(o => addItems(o, el, elements));

          if (
            elements.filter(e => chosen.includes(e.title)).length >
            elements.length / 2
          ) {
            return {
              filteredTags: elements
                .filter(e => !chosen.includes(e.title))
                .map(e => e.key),
              reversedFilter: true,
            };
          }

          return {
            filteredTags: elements
              .filter(e => chosen.includes(e.title))
              .map(e => e.key),
            reversedFilter: false,
          };
        };

        const filter = filterKeys.includes(el)
          ? findFiltered(el, chosenFilters[el])
          : { filteredTags: [], reversedFilter: true };

        return {
          name: el,
          selected: chosenItems.includes(el),
          ...filter,
        };
      });

      return {
        start_product_tag: treeId,
        hierarhy,
      };
    };

    return (
      <StyledModalWrapper
        visible={isOpen}
        maskClosable={false}
        title={modalTitle}
        expanded={expanded}
        destroyOnClose
        onCancel={handleCancel}
        onOk={() => {
          setIsDefaultSelection(false);
          onSave(checkedData as any);
        }}
        centered
        footer={
          <div
            css={css`
              display: flex;
              justify-content: space-between;
              align-items: center;
            `}
          >
            <RatingPopover
              onSubmitHandler={ratingProductsHandler}
              chosenItems={formChosenItems()}
              selectionItems={formRatingSelection()}
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
                  setIsDefaultSelection(false);
                  onPreview(chosenItems as any[], chosenFilters, treeId);
                  onSave(checkedData as any);
                }}
                canSave={
                  !isEqual(checkedData, initialCheckedData) &&
                  Boolean(checkedData.length)
                }
                saveAlertVisible={saveAlertVisible}
                onConfirmCancel={handleConfirmCancel}
              />
              <StyledExpandButtonWrapper>
                <ToggleIcon
                  iconSize="l"
                  iconColor={theme.colors.grayscale.dark2}
                  onClick={() => setExpanded(p => !p)}
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
            <Constructor
              formatTitle={formatTitle}
              quantity={constructorQuantity as number}
              modalType={modalType}
              treeData={dictOptions}
              filteredTreeData={filteredTreeData}
              setFilteredTreeData={setFilteredTreeData}
              treeId={treeId}
              setTreeId={setTreeId}
              currentProductId={currentProductId}
              setCurrentProductId={setCurrentProductId}
              checkedData={checkedData}
              setCheckedData={setCheckedData}
              itemsList={itemsList}
              setItemsList={setItemsList}
              chosenItems={chosenItems}
              setChosenItems={setChosenItems}
              chosenFilters={chosenFilters}
              setChosenFilters={setChosenFilters}
              chosenHierarchy={chosenHierarchy}
              initialCheckedData={initialCheckedData}
              lastNOptions={lastNOptions}
              isDefaultSelection={isDefaultSelection}
              onlyAdvancedMode={onlyAdvancedMode}
            />
          </StyledModalBody>
        </ErrorBoundary>
      </StyledModalWrapper>
    );
  },
);
