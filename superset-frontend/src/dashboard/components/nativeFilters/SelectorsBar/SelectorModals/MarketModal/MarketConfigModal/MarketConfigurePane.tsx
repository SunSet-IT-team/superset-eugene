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
import {styled, t} from '@superset-ui/core';
import React from 'react';
import type {DataNode} from 'antd/es/tree';
import MarketTitlePane from './MarketTitlePane';
import {SelectionInfoType} from './types';

interface Props {
  children?: React.ReactNode;
  onChange: (activeKey: string) => void;
  onRemove: (id: string) => void;
  currentMarketId: string;
  checkedData: DataNode;
  clearAll: () => void;
  onRearrange: (dragIndex: number, targetIndex: number) => void;
  selectionInfo?: SelectionInfoType;
  maxQuantity: number;
}

const Container = styled.div`
  display: flex;
  height: 100%;
  width: 100%;
`;

const ContentHolder = styled.div`
  width: 50%;
  display: flex;
  flex-direction: column;
  overflow-x: auto;
  border-right: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
`;

const TitlesContainer = styled.div`
  width: 50%;
`;

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

const MarketConfigurePane: React.FC<Props> = ({
                                                onChange,
                                                onRemove,
                                                children,
                                                currentMarketId,
                                                checkedData,
                                                clearAll,
                                                onRearrange,
                                                selectionInfo,
                                                maxQuantity,
                                              }) => (
  <Container>
    <ContentHolder>
      <StyledTabTitle>{t('Hierarchy')}</StyledTabTitle>
      {children}
    </ContentHolder>
    <TitlesContainer>
      <MarketTitlePane
        currentMarketId={currentMarketId}
        onChange={onChange}
        onRemove={(id: string) => onRemove(id)}
        checkedData={checkedData}
        clearAll={clearAll}
        onRearrange={onRearrange}
        selectionInfo={selectionInfo}
        maxQuantity={maxQuantity}
      />
    </TitlesContainer>
  </Container>
);

export default MarketConfigurePane;
