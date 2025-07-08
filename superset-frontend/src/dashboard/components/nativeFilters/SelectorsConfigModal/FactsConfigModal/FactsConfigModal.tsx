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
import React, { useMemo, useCallback, useState } from 'react';
import { styled, t, css } from '@superset-ui/core';
import { AntdForm } from 'src/components';
import ErrorBoundary from 'src/components/ErrorBoundary';
import { StyledModal } from 'src/components/Modal';
import { useDispatch, useSelector } from 'react-redux';
import { updateSelectorByKey } from 'src/dashboard/features/selectors/selectorsSlice';
import FactsConfigForm from './FactsConfigForm/FactsConfigForm';
import Footer from '../../components/Footer/Footer';

const MODAL_MARGIN = 16;
const MIN_WIDTH = 360;

const StyledModalWrapper = styled(StyledModal)`
  min-width: ${MIN_WIDTH}px;
  width: ${MIN_WIDTH} !important;

  @media (max-width: ${MIN_WIDTH + MODAL_MARGIN * 2}px) {
    width: 100% !important;
    min-width: auto;
  }

  .ant-modal-body {
    padding: 0px;
  }
`;

export const StyledModalBody = styled.div`
  display: flex;
  height: 400px;
  flex-direction: row;
  flex: 1;
  .filters-list {
    width: ${({ theme }) => theme.gridUnit * 50}px;
    overflow: auto;
  }
`;

export const StyledForm = styled(AntdForm)`
  width: 100%;
`;

export interface FactsConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  setFacts?: ([any]) => void;
  setSelectedFact?: (string) => void;
  initialState: any;
  updateInitial: () => void;
}

function FactsConfigModal({
  isOpen,
  onClose,
  setFacts,
  setSelectedFact,
  initialState,
  updateInitial,
}: FactsConfigModalProps) {
  const dispatch = useDispatch();

  const { selectedDict } = useSelector(
    (state: RootState) => state.selectors.selectors.facts,
  );
  const { datasource_name: initialDatasourceName, column: initialColumnName } =
    selectedDict;

  const [selectedDataset, setSelectedDataset] = useState();
  const [selectedColumn, setSelectedColumn] = useState();

  const handleCancel = () => {
    setFacts(initialState.options);
    setSelectedFact(initialState.value);

    onClose();
  };

  const saveDictionary = useCallback(() => {
    dispatch(
      updateSelectorByKey({
        key: 'facts',
        updates: {
          selectedDict: {
            datasource_name: selectedDataset.name,
            datasource_type: selectedDataset.datasource_type,
            datasource_id: selectedDataset.id,
            column: selectedColumn.name,
          },
        },
      }),
    );
  }, [dispatch, selectedDataset, selectedColumn]);

  const handleSave = async () => {
    updateInitial();
    saveDictionary();
    onClose();
  };

  const formList = useMemo(
    () => (
      <div
        style={{
          height: '100%',
          overflowY: 'auto',
          display: '',
        }}
      >
        <FactsConfigForm
          setFacts={setFacts}
          setSelectedFact={setSelectedFact}
          selectedDataset={selectedDataset}
          selectedColumn={selectedColumn}
          setSelectedDataset={setSelectedDataset}
          setSelectedColumn={setSelectedColumn}
          initialColumnName={initialColumnName}
          initialDatasourceName={initialDatasourceName}
          initialFacts={initialState.value}
        />
      </div>
    ),
    [
      setFacts,
      setSelectedFact,
      selectedDataset,
      selectedColumn,
      initialColumnName,
      initialDatasourceName,
      initialState,
    ],
  );

  return (
    <StyledModalWrapper
      visible={isOpen}
      maskClosable={false}
      title={t('Select facts for selector')}
      destroyOnClose
      onCancel={handleCancel}
      onOk={() => {}}
      centered
      data-test="filter-modal"
      footer={
        <div
          css={css`
            display: flex;
            justify-content: flex-end;
            align-items: flex-end;
          `}
        >
          <Footer
            onDismiss={() => setSaveAlertVisible(false)}
            onCancel={handleCancel}
            handleSave={handleSave}
            canSave
            saveAlertVisible={false}
          />
        </div>
      }
    >
      <ErrorBoundary>
        <StyledModalBody>
          <StyledForm layout="vertical">{formList}</StyledForm>
        </StyledModalBody>
      </ErrorBoundary>
    </StyledModalWrapper>
  );
}

export default React.memo(FactsConfigModal);
