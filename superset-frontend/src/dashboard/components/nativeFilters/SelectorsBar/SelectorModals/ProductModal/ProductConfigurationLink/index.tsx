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
import React, {useCallback, useState} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import Button from 'src/components/Button';
import {styled} from '@superset-ui/core';
import type {DataNode} from 'antd/es/tree';
import {updateSelectorByKey} from 'src/dashboard/features/selectors/selectorsSlice';
import {selectorModalType} from 'src/dashboard/components/nativeFilters/constants';
import {getTextFromElement} from '../../utils';
import {ProductConstructorModal} from "../ProductConstructorModal";
import {RootState} from "../../../../../../types";

export interface FCBProps {
  modalType: 'product' | 'productAll';
  onClick?: () => void;
  children?: React.ReactNode;
}

const HeaderButton = styled(Button)`
  padding: 0;
  height: min-content;
  color: ${({ theme }) => theme.colors.grayscale.dark1};
  text-transform: capitalize;
  font-size: 14px;
  &:hover,
  :focus {
    color: ${({ theme }) => theme.colors.grayscale.dark1};
    border: none;
    box-shadow: none;
    outline: none;
  }
`;

export const ProductConfigurationLink: React.FC<FCBProps> = ({
  modalType,
  onClick,
  children,
}) => {
  const { dashboardQuantity } = useSelector(
    (state: RootState) => state.selectors.selectors[modalType],
  );
  const dispatch = useDispatch();
  const [isOpen, setOpen] = useState(false);

  const transformData = rawData =>
    rawData.map(item => ({
      label:
        item.hierarchyMode === 'basic'
          ? `${getTextFromElement(item.title)}`
          : `${getTextFromElement(item.title)} ${item.key}`,
      value: item.key,
      title: item.title,
      fullTitle: item.fullTitle,
      ids: item?.ids,
      hierarchyMode: item.hierarchyMode,
    }));

  const close = useCallback(() => {
    setOpen(false);
  }, [setOpen]);

  const submit = useCallback(
    (checkedOptions: DataNode) => {
      const updateData = transformData(checkedOptions);
      const updates = {
        options: updateData,
        ...(modalType === selectorModalType.product
          ? {
              selectedOptions: updateData.slice(0, dashboardQuantity),
            }
          : {
              selectedOptions: updateData[0],
            }),
      };
      dispatch(
        updateSelectorByKey({
          key: modalType,
          updates,
        }),
      );
      close();
    },
    [dispatch, close, dashboardQuantity],
  );

  const handlePreview = useCallback(
    (
      chosenItems: string[],
      chosenFilters: { [key: string]: string[] },
      treeId: string,
    ) => {
      dispatch(
        updateSelectorByKey({
          key: modalType,
          updates: {
            chosenHierarchy: {
              value: treeId,
              chosenItems,
              chosenFilters,
            },
          },
        }),
      );
    },
    [dispatch],
  );

  const handleClick = useCallback(() => {
    setOpen(true);
    if (onClick) {
      onClick();
    }
  }, [setOpen, onClick]);

  return (
    <>
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
      <HeaderButton buttonStyle="link" buttonSize="small" onClick={handleClick}>
        {children}
      </HeaderButton>
      <ProductConstructorModal
        modalType={modalType}
        isOpen={isOpen}
        onSave={submit}
        onCancel={close}
        onPreview={handlePreview}
      />
    </>
  );
};

export default React.memo(ProductConfigurationLink);
