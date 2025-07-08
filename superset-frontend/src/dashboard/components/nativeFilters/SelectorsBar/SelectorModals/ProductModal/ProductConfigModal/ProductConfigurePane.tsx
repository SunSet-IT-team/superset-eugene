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
import { styled, t } from '@superset-ui/core';
import React, { useState } from 'react';
import { Resizable } from 're-resizable';
import type { DataNode } from 'antd/es/tree';
import { Popconfirm } from 'antd';
import ProductTitlePane from './ProductTitlePane';
import { SelectionInfoType } from '../../types';

interface Props {
  children?: {
    advanced_hierarchy: React.ReactNode;
    tree: React.ReactNode;
    basic_hierarchy: React.ReactNode;
  };
  onChange: (activeKey: string) => void;
  onRemove: (id: string) => void;
  currentProductId: string;
  checkedData: Array<DataNode & { fullTitle: string }>;
  clearAll: () => void;
  clearChosen: () => void;
  maxQuantity: number;
  onRearrange: (dragIndex: number, targetIndex: number) => void;
  selectionInfo?: SelectionInfoType;
  mode: 'basic' | 'advanced';
  setMode: React.Dispatch<React.SetStateAction<'basic' | 'advanced'>>;
  formatTitle: (value: string) => string;
}

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

const StyledBtnTabTitle = styled.button<{ isActive: boolean }>`
  width: 50%;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  ${({ theme, isActive }) => `
  color: ${
    isActive ? theme.colors.grayscale.dark1 : theme.colors.grayscale.base
  };
  background-color: ${theme.colors.grayscale.light5};
  &:hover {
    color: ${theme.colors.primary.base};
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

const ProductConfigurePane: React.FC<Props> = ({
  onChange,
  onRemove,
  children,
  currentProductId,
  checkedData,
  clearAll,
  clearChosen,
  maxQuantity,
  onRearrange,
  selectionInfo,
  mode,
  setMode,
  formatTitle,
}) => {
  const [firstColWidth, setFirstColWidth] = useState(33);
  const thirdColMinWidth = 25;

  const handleResizeFirst = (e, direction, ref) => {
    const newWidth = (ref.offsetWidth / window.innerWidth) * 100;
    setFirstColWidth(newWidth);
  };
  const secondColMaxWidth = Math.max(
    20,
    100 - firstColWidth - thirdColMinWidth,
  );

  const handleModeChange = (newMode: typeof mode) => () => {
    clearChosen();
    clearAll();
    setMode(newMode);
  };

  return (
    <Container>
      <Resizable
        enable={{ left: false, right: true }}
        // onResizeStop={handleResizeFirst}
        onResize={handleResizeFirst}
        minWidth="20%"
        maxWidth="50%"
        defaultSize={{
          width: '25%',
          height: '100%',
        }}
      >
        <ContentHolder>
          <StyledBtnContainer>
            <Popconfirm
              title={t('Changing mode will clear the selection')}
              onConfirm={handleModeChange('basic')}
              onCancel={() => {}}
              okText={t('Change')}
              cancelText={t('Cancel')}
              okButtonProps={{ type: 'link' }}
              cancelButtonProps={{ type: 'link', danger: true }}
            >
              <StyledBtnTabTitle
                isActive={mode === 'basic'}
                // disabled //remove when dev add when stage
              >
                {t('Basic Mode')}
              </StyledBtnTabTitle>
            </Popconfirm>
            <Popconfirm
              title={t('Changing mode will clear the selection')}
              onConfirm={handleModeChange('advanced')}
              onCancel={() => {}}
              okText={t('Change')}
              cancelText={t('Cancel')}
              okButtonProps={{ type: 'link' }}
              cancelButtonProps={{ type: 'link', danger: true }}
              // disabled //remove when dev add when stage
            >
              <StyledBtnTabTitle isActive={mode === 'advanced'}>
                {t('Advanced Mode')}
              </StyledBtnTabTitle>
            </Popconfirm>
          </StyledBtnContainer>
          {mode === 'basic'
            ? children?.basic_hierarchy
            : children?.advanced_hierarchy}
        </ContentHolder>
      </Resizable>
      <Resizable
        enable={{ left: false, right: true }}
        minWidth="20%"
        maxWidth={`${secondColMaxWidth}%`}
        defaultSize={{
          width: '37.5%',
          height: '100%',
        }}
      >
        <ContentHolder>
          <StyledTabTitle>{t('Preview')}</StyledTabTitle>
          {children?.tree}
        </ContentHolder>
      </Resizable>

      <TitlesContainer>
        <ProductTitlePane
          currentProductId={currentProductId}
          onChange={onChange}
          onRemove={(id: string) => onRemove(id)}
          checkedData={checkedData}
          clearAll={clearAll}
          maxQuantity={maxQuantity}
          onRearrange={onRearrange}
          formatTitle={formatTitle}
          selectionInfo={selectionInfo}
        />
      </TitlesContainer>
    </Container>
  );
};

export default ProductConfigurePane;
