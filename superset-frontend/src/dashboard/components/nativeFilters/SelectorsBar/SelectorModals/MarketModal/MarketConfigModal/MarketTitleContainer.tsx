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
import React, { forwardRef } from 'react';
import { styled, t } from '@superset-ui/core';
import Icons from 'src/components/Icons';
import type { DataNode } from 'antd/es/tree';
import DraggableFilter from '../../../../FiltersConfigModal/DraggableFilter';

export const MarketTitle = styled.div`
  ${({ theme }) => `
      display: flex;
      align-items: center;
      padding: ${theme.gridUnit * 2}px;
      width: 100%;
      border-radius: ${theme.borderRadius}px;
      cursor: pointer;
      &.active {
        color: ${theme.colors.grayscale.dark1};
        border-radius: ${theme.borderRadius}px;
        background-color: ${theme.colors.secondary.light4};
        span, .anticon {
          color: ${theme.colors.grayscale.dark1};
        }
      }
      &:hover {
        color: ${theme.colors.primary.light1};
        span, .anticon {
          color: ${theme.colors.primary.light1};
        }
      }
      &.errored div, &.errored .warning {
        color: ${theme.colors.error.base};
      }
  `}
`;

const StyledTrashIcon = styled(Icons.Trash)`
  color: ${({ theme }) => theme.colors.grayscale.light3};
`;

const StyledInfoIcon = styled(Icons.Info)`
  color: ${({ theme }) => theme.colors.grayscale.light1};
`;

const StyledWarning = styled.span`
  color: ${({ theme }) => theme.colors.warning.base};
`;

const StyledBottomWarning = styled.span`
  width: 100%;
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.gridUnit}px;
  color: ${({ theme }) => theme.colors.grayscale.light1};
`;

const Container = styled.div`
  height: 100%;
  overflow-y: auto;
`;

interface Props {
  onChange: (id: string) => void;
  currentMarketId: string;
  onRemove: (id: string) => void;
  checkedData: DataNode[];
  onRearrange: (dragIndex: number, targetIndex: number) => void;
}

const MarketTitleContainer = forwardRef<HTMLDivElement, Props>(
  ({ onChange, onRemove, currentMarketId, checkedData, onRearrange }, ref) => {
    const renderComponent = (item: DataNode) => {
      const { key: id, title } = item;
      const isActive = currentMarketId === id;
      const classNames = [];
      if (isActive) {
        classNames.push('active');
      }
      return (
        <MarketTitle
          role="tab"
          key={`market-title-tab-${id}`}
          onClick={() => onChange(id)}
          className={classNames.join(' ')}
        >
          <div css={{ display: 'flex', width: '100%' }}>
            <div
              css={{
                alignItems: 'center',
                display: 'flex',
                wordBreak: 'break-all',
              }}
            >
              {title}
            </div>
          </div>
          <div css={{ alignSelf: 'flex-start', marginLeft: 'auto' }}>
            <StyledTrashIcon
              iconSize="xl"
              onClick={event => {
                event.stopPropagation();
                onRemove(id);
              }}
              alt="RemoveMarket"
            />
          </div>
        </MarketTitle>
      );
    };

    const renderMarketsGroups = () => {
      const items: React.ReactNode[] = [];
      checkedData.forEach((item, index) => {
        items.push(
          <DraggableFilter
            key={index}
            onRearrange={onRearrange}
            index={index}
            filterIds={[`${item.key}`]}
          >
            {renderComponent(item)}
          </DraggableFilter>,
        );
      });
      return items;
    };

    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <Container ref={ref}>
          {checkedData.length ? (
            renderMarketsGroups()
          ) : (
            <StyledWarning>{`! ${t(
              'Choose at least one market from hierarchy',
            )}`}</StyledWarning>
          )}
        </Container>
        <StyledBottomWarning>
          <StyledInfoIcon iconSize="l" />
          min: 1, max: 30
        </StyledBottomWarning>
      </div>
    );
  },
);

export default MarketTitleContainer;
