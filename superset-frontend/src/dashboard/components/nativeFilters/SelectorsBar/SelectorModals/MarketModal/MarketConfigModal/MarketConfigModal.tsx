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
import {isEqual} from 'lodash';
import {css, styled, t, useTheme} from '@superset-ui/core';
import {useSelector} from 'react-redux';
import {Tree} from 'src/components/Tree';
import Icons from 'src/components/Icons';
import ErrorBoundary from 'src/components/ErrorBoundary';
import {StyledModal} from 'src/components/Modal';
import useEffectEvent from 'src/hooks/useEffectEvent';
import type {DataNode, TreeProps} from 'antd/es/tree';
import Footer from 'src/dashboard/components/nativeFilters/components/Footer/Footer';
import {selectorModalType, selectorName,} from 'src/dashboard/components/nativeFilters/constants';
import MarketConfigurePane from './MarketConfigurePane';
import {getTextFromElement} from '../../utils';
import {SelectionInfoType} from '../../types';

const MODAL_MARGIN = 16;
const MIN_WIDTH = 880;

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

export interface MarketConfigModalProps {
  isOpen: boolean;
  onSave: (checkedOptions: DataNode) => Promise<void>;
  onCancel: () => void;
  modalType: 'market' | 'marketAll';
}

function MarketConfigModal({
  modalType,
  isOpen,
  onSave,
  onCancel,
}: MarketConfigModalProps) {
  const { options, dictOptions: treeData } = useSelector(
    (state) => state.selectors.selectors[modalType],
  );
  const { constructorQuantity } = useSelector(
    state => state.selectors.selectors.market,
  );
  const initialCheckedData = options.map(item => ({
    title: item.label,
    key: item.value,
  }));

  const maxQuantity = useMemo(
    () => (modalType === selectorModalType.market ? constructorQuantity : 30),
    [constructorQuantity, modalType],
  );

  const [checkedData, setCheckedData] = useState([]);
  const initialCurrentMarketId = checkedData.length ? checkedData[0].key : '0';
  const [currentMarketId, setCurrentMarketId] = useState(
    initialCurrentMarketId,
  );

  useEffect(() => {
    if (options.length) {
      setCheckedData(
        options.map(item => ({
          title: item.label,
          key: item.value,
        })),
      );
    }
  }, [options]);

  const theme = useTheme();

  const [saveAlertVisible, setSaveAlertVisible] = useState<boolean>(false);

  const handleCheck: TreeProps['onCheck'] = (_, info) => {
    if (info.checked && checkedData.length === maxQuantity) {
      return;
    }
    let checkedNodes;
    if (info.checked) {
      checkedNodes = [
        ...checkedData,
        { title: getTextFromElement(info.node.title), key: info.node.key },
      ];
    } else {
      checkedNodes = checkedData.filter(node => node.key !== info.node.key);
    }

    setCheckedData(checkedNodes);
    setCurrentMarketId(checkedNodes[0].key);
  };

  const handleRearrange = (dragIndex: number, targetIndex: number) => {
    const newOrderedCheckedData = [...checkedData];
    const removed = newOrderedCheckedData.splice(dragIndex, 1)[0];
    newOrderedCheckedData.splice(targetIndex, 0, removed);
    setCheckedData(newOrderedCheckedData);
  };

  const getKeys = (data: DataNode[]) => data.map(element => element.key);

  const handleTitleTabChange = (marketId: string) => {
    setCurrentMarketId(marketId);
  };

  const handleRemoveItem = deletedId => {
    setCheckedData(currentData =>
      currentData.filter(node => node.key !== deletedId),
    );
  };

  const handleClearAllItems = () => {
    setCheckedData([]);
  };

  const resetForm = () => {
    setCurrentMarketId(initialCurrentMarketId);
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

  const handleSelectAllChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    allKeys: DataNode[],
    searchValue = '',
  ) => {
    const searchedData = allKeys.filter(
      item => item.title?.toLowerCase().includes(searchValue.toLowerCase()),
    );

    const filteredData = searchedData.filter(
      item =>
        !checkedData.some(
          key => key.key === item.key && key.title === item.title,
        ),
    );

    setCheckedData(prev => {
      if (e.target.checked) {
        if (checkedData.length === maxQuantity || filteredData.length === 0) {
          return prev.filter(
            item =>
              !searchedData.some(
                key => key.key === item.key && key.title === item.title,
              ),
          );
        }

        const newSelections = [...prev, ...filteredData];
        return newSelections.slice(0, maxQuantity);
      }

      return prev.filter(
        item =>
          !searchedData.some(
            key => key.key === item.key && key.title === item.title,
          ),
      );
    });
  };

  const marketTree = useMemo(
    () => (
      <div
        style={{
          height: 'auto',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          margin: theme.gridUnit * 2,
        }}
      >
        <Tree
          initialData={treeData}
          handleCheck={handleCheck}
          checkedKeys={checkedData.length ? getKeys(checkedData) : []}
          handleSelectAllChange={handleSelectAllChange}
          withSearch
          checkable
          checkStrictly
          withCount
          withSelectAll
          withToggle
        />
      </div>
    ),
    [treeData, checkedData],
  );

  const modalTitle =
    modalType === selectorModalType.market
      ? t(selectorName.market)
      : t(selectorName.marketAll);

  const selectionInfo: SelectionInfoType = {
    selectedDataCount: checkedData.length,
    maxQuantity,
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
            justify-content: flex-end;
            align-items: flex-end;
          `}
        >
          <Footer
            applyTitle="Apply"
            onDismiss={() => setSaveAlertVisible(false)}
            onCancel={handleCancel}
            handleSave={handleSave}
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
      }
    >
      <ErrorBoundary>
        <StyledModalBody expanded={expanded}>
          <MarketConfigurePane
            onRemove={handleRemoveItem}
            onChange={handleTitleTabChange}
            currentMarketId={currentMarketId}
            checkedData={checkedData}
            clearAll={handleClearAllItems}
            onRearrange={handleRearrange}
            selectionInfo={selectionInfo}
            maxQuantity={maxQuantity}
          >
            {marketTree}
          </MarketConfigurePane>
        </StyledModalBody>
      </ErrorBoundary>
    </StyledModalWrapper>
  );
}

export default React.memo(MarketConfigModal);
