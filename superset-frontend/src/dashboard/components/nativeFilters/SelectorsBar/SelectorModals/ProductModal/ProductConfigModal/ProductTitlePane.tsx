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
import React, { useRef } from 'react';
import { styled, t, useTheme } from '@superset-ui/core';
import type { DataNode } from 'antd/es/tree';
import Icons from 'src/components/Icons';
import SelectorTitleContainer from '../../components/SelectorTitleContainer/SelectorTitleContainer';
import { SelectionInfoType } from '../../types';

interface Props {
  onRemove: (id: string) => void;
  onChange: (id: string) => void;
  formatTitle: (title: string) => string;
  currentProductId: string;
  checkedData: Array<DataNode & { fullTitle: string }>;
  clearAll: () => void;
  maxQuantity: number;
  onRearrange: (dragIndex: number, targetIndex: number) => void;
  selectionInfo?: SelectionInfoType;
}

const StyledTabTitle = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  border-bottom: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
  ${({ theme }) => `
  color: ${theme.colors.grayscale.dark1};
  font-size: ${theme.typography.sizes.m}px;
  font-weight: 600;
  padding: ${theme.gridUnit * 3}px;
`}
`;

const TextContainer = styled.div`
  height: 100%;
  width: 100%;
  display: flex;
  justify-content: center;
  margin-left: 40px;
`;

const TabsContainer = styled.div`
  height: 100%;
  display: flex;
  flex-direction: column;
`;

const StyledTrashIconDisabled = styled(Icons.Trash)`
  color: ${({ theme }) => theme.colors.grayscale.light3};
  margin-right: ${({ theme }) => theme.gridUnit * 3}px;
`;

const StyledTrashIconActive = styled(Icons.Trash)`
  color: ${({ theme }) => theme.colors.grayscale.base};
  margin-right: ${({ theme }) => theme.gridUnit * 3}px;
`;

const SelectionContainer = styled.div`
  font-weight: 400;
  color: ${({ theme }) => theme.colors.grayscale.dark1};
  margin-right: 40px;
`;

const ProductTitlePane: React.FC<Props> = ({
  onChange,
  onRemove,
  currentProductId,
  checkedData,
  clearAll,
  maxQuantity,
  onRearrange,
  formatTitle,
  selectionInfo = null,
}) => {
  const productContainerRef = useRef<HTMLDivElement>(null);
  const theme = useTheme();

  return (
    <TabsContainer>
      <StyledTabTitle>
        <TextContainer>{t('Selection')}</TextContainer>
        {selectionInfo && (
          <SelectionContainer>
            {selectionInfo.selectedDataCount}/{selectionInfo.maxQuantity}
          </SelectionContainer>
        )}
        {checkedData.length > 0 ? (
          <StyledTrashIconActive
            iconSize="xl"
            onClick={event => {
              event.stopPropagation();
              clearAll();
            }}
            alt="ClearAll"
          />
        ) : (
          <StyledTrashIconDisabled iconSize="xl" />
        )}
      </StyledTabTitle>
      <div
        css={{
          height: '100%',
          overflowY: 'auto',
          marginTop: theme.gridUnit * 2,
        }}
      >
        <SelectorTitleContainer
          ref={productContainerRef}
          currentSelectorId={currentProductId}
          onChange={onChange}
          onRemove={onRemove}
          formatTitle={formatTitle}
          checkedData={checkedData}
          maxQuantity={maxQuantity}
          onRearrange={onRearrange}
          type="product"
        />
      </div>
    </TabsContainer>
  );
};

export default ProductTitlePane;
