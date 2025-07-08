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
import React, { forwardRef, useRef } from 'react';
import { styled, t } from '@superset-ui/core';
import Icons from 'src/components/Icons';
import type { DataNode } from 'antd/es/tree';
import DraggableFilter from '../../../../FiltersConfigModal/DraggableFilter';
import { TruncateText } from '../../components/TruncateText/TruncateText';

export const ProductTitle = styled.div`
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
  ref: any;
  onChange: (id: string) => void;
  currentProductId: string;
  onRemove: (id: string) => void;
  checkedData: DataNode[];
  maxQuantity: number;
  onRearrange: (dragIndex: number, targetIndex: number) => void;
}

const ProductTitleContainer = forwardRef<HTMLDivElement, Props>(
  ({
     onChange,
     onRemove,
     currentProductId,
     checkedData,
     maxQuantity,
     ref,
     onRearrange,
   }) => {
    const itemRef = useRef<HTMLDivElement>(null);
    const renderComponent = (item: DataNode) => {
      const { key: id, fullTitle } = item;
      const isActive = currentProductId === id;
      const classNames = [];
      if (isActive) {
        classNames.push('active');
      }
      return (
        <ProductTitle
          role="tab"
          key={`product-title-tab-${id}`}
          onClick={() => onChange(id)}
          className={classNames.join(' ')}
        >
          <div css={{ display: 'flex', width: '100%' }} ref={itemRef}>
            <TruncateText
              text={fullTitle}
              maxWidth={(itemRef?.current?.clientWidth || 330) - 10}
            />
          </div>
          <div css={{ alignSelf: 'flex-start', marginLeft: 'auto' }}>
            <StyledTrashIcon
              iconSize="xl"
              onClick={event => {
                event.stopPropagation();
                onRemove(id);
              }}
              alt="RemoveProduct"
            />
          </div>
        </ProductTitle>
      );
    };

    const renderProductsGroups = () => {
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
            renderProductsGroups()
          ) : (
            <StyledWarning>{`! ${t(
              'Choose at least one product from hierarchy',
            )}`}</StyledWarning>
          )}
        </Container>
        <StyledBottomWarning>
          <StyledInfoIcon iconSize="l" />
          min: 1, max: {maxQuantity}
        </StyledBottomWarning>
      </div>
    );
  },
);

export default ProductTitleContainer;
