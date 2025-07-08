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
import React, {useMemo, useState} from 'react';
import {css, styled, t} from '@superset-ui/core';
import {AntdForm} from 'src/components';
import ErrorBoundary from 'src/components/ErrorBoundary';
import {StyledModal} from 'src/components/Modal';
import {RootState} from 'src/dashboard/types';
import {InitialState} from 'src/dashboard/features/selectors/types';
import {useDispatch, useSelector} from 'react-redux';
import {
  setRequiresChartUpdate,
  updateInitialSelectorsToGet,
  updateSelectorByKey,
  updateSelectorsToGet,
} from 'src/dashboard/features/selectors/selectorsSlice';
import {setSelectorsConfiguration} from 'src/dashboard/actions/nativeFilters';
import SelectorsConfigForm from './SelectorsConfigForm/SelectorsConfigForm';
import Footer from '../components/Footer/Footer';
import {selectorLabel, selectorType} from '../constants';
import {getFactIds} from './utils';

const MODAL_MARGIN = 16;
const MIN_WIDTH = 560;

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
  height: ${({ theme }) => theme.gridUnit * 148}px;
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

export interface SelectorsConfigModalProps {
  isOpen: boolean;
  close: () => void;
}

function SelectorsConfigModal({ isOpen, close }: SelectorsConfigModalProps) {
  const { selectors, initialSelectorsToGet }: InitialState = useSelector(
    (state: RootState) => state.selectors,
  );
  const { selectedDict } = selectors.facts;

  const dashboardInfo = useSelector((state: RootState) => state.dashboardInfo);

  const dispatch = useDispatch();

  const [form] = AntdForm.useForm();

  const initialValues = {
    market: {
      dashboardQuantity: selectors.market.dashboardQuantity,
      constructorQuantity: selectors.market.constructorQuantity,
      isActive: selectors.market.isActive,
    },
    marketAll: {
      isActive: selectors.marketAll.isActive,
    },
    product: {
      dashboardQuantity: selectors.market.dashboardQuantity,
      constructorQuantity: selectors.market.constructorQuantity,
      onlyAdvancedMode: selectors.product.onlyAdvancedMode,
      isActive: selectors.product.isActive,
    },
    productAll: {
      onlyAdvancedMode: selectors.product.onlyAdvancedMode,
      isActive: selectors.productAll.isActive,
    },
    period: {
      isActive: selectors.period.isActive,
    },
    comparisonPeriod: {
      isActive: selectors.comparisonPeriod.isActive,
    },
    facts: {
      options: selectors.facts.options?.map(fact => fact.value),
      isActive: selectors.facts.isActive,
    },
  };

  const [factsDictOptions, setFactsDictOptions] = useState(
    selectors.facts.dictOptions,
  );

  const [saveAlertVisible, setSaveAlertVisible] = useState<boolean>(false);

  const [hasError, setHasError] = useState(false);

  const resetForm = () => {
    form.setFieldsValue(initialValues);
    setSaveAlertVisible(false);
  };

  const handleSave = async () => {
    const updateInfo = form.getFieldsValue();
    let ids = [];
    let requiresChartUpdate = false;
    const selectorsConfig = [];
    const selectorsToGet = [];

    if (updateInfo.facts.isActive) {
      ids = await getFactIds(
        updateInfo.facts.options,
        selectedDict.datasource_id,
        selectedDict.datasource_type,
        selectedDict.column,
      );
    }

    Object.entries(updateInfo).forEach(([key, selector]) => {
      const selectorOptions = selectors[key].options;

      const updateOptions =
        ['product', 'market'].indexOf(key) > -1
          ? Array.isArray(selectorOptions)
            ? selectorOptions?.slice(0, selector.constructorQuantity)
            : [selectorOptions?.slice(0, selector.constructorQuantity)]
          : selectorOptions;
      const { selectedOptions } = selectors[key];
      const updateSelectedOptions =
        ['product', 'market'].indexOf(key) > -1
          ? Array.isArray(selectedOptions)
            ? selectedOptions?.slice(0, selector.dashboardQuantity)
            : [selectedOptions].slice(0, selector.dashboardQuantity)
          : selectedOptions;

      const configObject = {
        type_selector: selectorType[key],
        label_selector: selectorLabel[key],
        selected: selector.isActive,
        max_selection: selector.dashboardQuantity,
      };
      if (key === 'facts') {
        configObject.selected_facts = updateInfo.facts.options;
        configObject.datasource_name = selectedDict.datasource_name;
        configObject.datasource_type = selectedDict.datasource_type;
        configObject.datasource_id = selectedDict.datasource_id;
        configObject.column_name = selectedDict.column;
      }

      if (selector.isActive !== selectors[key].isActive) {
        requiresChartUpdate = true;
      }

      selectorsConfig.push(configObject);

      if (
        selector.isActive &&
        key !== 'facts' &&
        !initialSelectorsToGet.includes(selectorType[key])
      ) {
        selectorsToGet.push(selectorType[key]);
      }

      dispatch(
        updateSelectorByKey({
          key,
          updates: {
            ...selector,
            selectedOptions: updateSelectedOptions,
            initialSelectedOptions: updateSelectedOptions,
            options: updateOptions,
            ...(['product', 'productAll'].indexOf(key) > -1 && {
              onlyAdvancedMode:
                updateInfo.product.onlyAdvancedMode ||
                updateInfo.productAll.onlyAdvancedMode,
            }),
          },
        }),
      );
    });
    dispatch(
      updateSelectorByKey({
        key: 'facts',
        updates: {
          options: updateInfo.facts.options?.map(element => ({
            label: element,
            value: element,
          })),
          selectedDict: {
            ...selectedDict,
            options_ids: ids,
          },
        },
      }),
    );

    dispatch(updateSelectorsToGet(selectorsToGet));
    dispatch(setRequiresChartUpdate(requiresChartUpdate));
    dispatch(
      updateInitialSelectorsToGet([
        ...initialSelectorsToGet,
        ...selectorsToGet,
      ]),
    );

    await setSelectorsConfiguration(selectorsConfig, dashboardInfo, dispatch);

    close();
  };

  const handleConfirmCancel = () => {
    resetForm();
    close();
  };

  const handleCancel = () => {
    if (form.isFieldsTouched()) {
      setSaveAlertVisible(true);
    } else {
      handleConfirmCancel();
    }
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
        <SelectorsConfigForm
          expanded={false}
          form={form}
          setHasError={setHasError}
          factsDictOptions={factsDictOptions}
          setFactsDictOptions={setFactsDictOptions}
        />
      </div>
    ),
    [form, factsDictOptions],
  );

  return (
    <StyledModalWrapper
      visible={isOpen}
      maskClosable={false}
      title={t('Add and edit selectors')}
      destroyOnClose
      onCancel={handleCancel}
      onOk={handleSave}
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
            canSave={!hasError}
            saveAlertVisible={saveAlertVisible}
            onConfirmCancel={handleConfirmCancel}
          />
        </div>
      }
    >
      <ErrorBoundary>
        <StyledModalBody>
          <StyledForm
            form={form}
            layout="vertical"
            initialValues={initialValues}
          >
            {formList}
          </StyledForm>
        </StyledModalBody>
      </ErrorBoundary>
    </StyledModalWrapper>
  );
}

export default React.memo(SelectorsConfigModal);
