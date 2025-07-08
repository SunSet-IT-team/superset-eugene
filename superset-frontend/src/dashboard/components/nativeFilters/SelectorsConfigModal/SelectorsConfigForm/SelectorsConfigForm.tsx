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
/* eslint-disable react-hooks/rules-of-hooks */

import {styled, t, useTheme} from '@superset-ui/core';
import React, {forwardRef, useEffect, useState} from 'react';
import {InputNumber} from 'src/components/Input';
import {AntdCheckbox, AntdTooltip, FormInstance, Select,} from 'src/components';
import {FormItem} from 'src/components/Form';
import {NativeFiltersForm} from '../types';
import {CollapsibleControl} from './CollapsibleControl';
import FactsConfigurationLink from '../FactsConfigurationLink';
import {selectorName} from '../../constants';

const FORM_ITEM_WIDTH = 260;

export const StyledFormItem = styled(FormItem)`
  margin: 0;
  min-width: ${({ expanded }) => (expanded ? '50%' : `${FORM_ITEM_WIDTH}px`)};
`;

export const StyledRowFormItem = styled(FormItem)<{ expanded: boolean }>`
  margin-bottom: 0;
  padding-bottom: 0;
  min-width: ${({ expanded }) => (expanded ? '50%' : `${FORM_ITEM_WIDTH}px`)};

  & .ant-form-item-label {
    padding-bottom: 0;

  .ant-form-item-control-input-content > div > div {
    height: auto;
  }

  & .ant-form-item-control-input {
    min-height: ${({ theme }) => theme.gridUnit * 10}px;
  }
`;

export const StyledLabel = styled.span`
  color: ${({ theme }) => theme.colors.grayscale.base};
  font-size: ${({ theme }) => theme.typography.sizes.s}px;
  text-transform: uppercase;
`;

const Container = styled.div`
  margin-bottom: 0;
  margin-left: 5px;
`;

const StyledTitle = styled.span`
  color: ${({ theme }) => theme.colors.grayscale.dark1};
  font-size: ${({ theme }) => theme.typography.sizes.m}px;
  font-weight: 700;
`;

const StyledContainer = styled.div`
  padding: 20px;
  .ant-tabs-nav {
    position: sticky;
    top: 0;
    background: ${({ theme }) => theme.colors.grayscale.light5};
    z-index: 1;
  }

  .ant-tabs-nav-list {
    padding: 0;
  }

  .ant-form-item-label {
    padding-bottom: 0;
  }
`;

const StyledCheckbox = styled.div`
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  min-height: ${({ theme }) => theme.gridUnit * 10}px;
  padding-top: ${({ theme }) => theme.gridUnit * 2 + 2}px;
`;

const StyledTooltip = styled(AntdTooltip)`
  margin: 0;
  padding: 0;
`;

const StyledInputContainer = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.gridUnit * 3}px;
  max-width: ${({ theme }) => theme.gridUnit * 50}px;
`;

export interface SelectorsConfigFormProps {
  form: FormInstance<NativeFiltersForm>;
  setHasError: any;
  factsDictOptions: any;
  setFactsDictOptions: any;
}

const SelectorsConfigForm = ({
  form,
  setHasError,
  factsDictOptions,
  setFactsDictOptions,
}: SelectorsConfigFormProps) => {
  const theme = useTheme();

  const [marketAll, setMarketAll] = useState();
  const [period, setPeriod] = useState();
  const [compPeriod, setCompPeriod] = useState();
  const [onlyAdvancedMode, setOnlyAdvancedMode] = useState();

  const [initialFactDictState, setInitialFactDictState] = useState({
    options: factsDictOptions,
    value: form.getFieldValue('facts').options,
  });

  const updateInitial = () => {
    setInitialFactDictState({
      options: factsDictOptions,
      value: form.getFieldValue('facts').options,
    });
  };

  useEffect(() => {
    setMarketAll(form.getFieldValue('marketAll').isActive);
    setOnlyAdvancedMode(form.getFieldValue('product').onlyAdvancedMode);
    setCompPeriod(form.getFieldValue('comparisonPeriod').isActive);
    setPeriod(form.getFieldValue('period').isActive);
  }, []);

  const handleValidation = async () => {
    try {
      await form.validateFields();
      setHasError(false);
    } catch (errorInfo) {
      setHasError(true);
    }
  };

  useEffect(() => {
    handleValidation();
  }, [factsDictOptions]);

  const isActiveChanged = (key: string, value: boolean) => {
    form.setFieldsValue({
      [key]: { ...form.getFieldValue(key), isActive: value },
    });
    setTimeout(() => {
      handleValidation();
    }, 0);
  };

  const handleInputChange = (key: string, type: string, value: number) => {
    if (type === 'dashboard') {
      form.setFieldsValue({ [key]: { dashboardQuantity: value } });
    } else if (type === 'constructor') {
      form.setFieldsValue({ [key]: { constructorQuantity: value } });
    }
  };

  const handleFactChange = options => {
    form.setFieldsValue({ facts: { options } });
  };

  const handleCheckboxChange = (key, value) => {
    if (key === 'period') {
      setPeriod(value);
      form.setFieldsValue({ [key]: { isActive: value } });
      if (!value) {
        form.setFieldsValue({ comparisonPeriod: { isActive: false } });
        setCompPeriod(false);
      }
    } else if (key === 'comparisonPeriod') {
      form.setFieldsValue({ [key]: { isActive: value } });
      setCompPeriod(value);
    } else if (key === 'marketAll') {
      form.setFieldsValue({ [key]: { isActive: value } });
      setMarketAll(value);
    } else if (key === 'onlyAdvancedMode') {
      form.setFieldsValue({
        product: { ...form.getFieldValue('product'), [key]: value },
      });
      form.setFieldsValue({
        productAll: {
          ...form.getFieldValue('productAll'),
          [key]: value,
        },
      });
      setOnlyAdvancedMode(value);
    }

    handleValidation();
  };

  return (
    <StyledContainer>
      <StyledTitle>{t('Choose selectors for dashboard')}</StyledTitle>
      <Container>
        <StyledFormItem name={['market', 'isActive']}>
          <CollapsibleControl
            initialValue={form.getFieldValue('market').isActive}
            title={t(selectorName.market)}
            onChange={checked => {
              isActiveChanged('market', checked);
            }}
          >
            <StyledLabel>{t('Maximum quantity to select')}</StyledLabel>
            <StyledInputContainer>
              <StyledRowFormItem
                expanded={form.getFieldValue('market').isActive}
                name={['market', 'dashboardQuantity']}
                label={<StyledLabel>{t('Dashboard')}</StyledLabel>}
                rules={[
                  { required: true, message: t('This field is required') },
                  {
                    type: 'number',
                    min: 1,
                    message: t('Value must be at least 1'),
                  },
                ]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  allowClear
                  placeholder={t('Specify quantity')}
                  value={form.getFieldValue('market').dashboardQuantity}
                  onChange={value => {
                    handleInputChange('market', 'dashboard', value);
                    handleValidation();
                  }}
                />
              </StyledRowFormItem>
              <StyledRowFormItem
                expanded={form.getFieldValue('market').isActive}
                name={['market', 'constructorQuantity']}
                label={<StyledLabel>{t('Constructor')}</StyledLabel>}
                rules={[
                  { required: true, message: t('This field is required') },
                  {
                    type: 'number',
                    min: 1,
                    message: t('Value must be at least 1'),
                  },
                ]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  allowClear
                  placeholder={t('Specify quantity')}
                  value={form.getFieldValue('market').constructorQuantity}
                  onChange={value => {
                    handleInputChange('market', 'constructor', value);
                    handleValidation();
                  }}
                />
              </StyledRowFormItem>
            </StyledInputContainer>
          </CollapsibleControl>
        </StyledFormItem>

        <StyledFormItem
          name={['marketAll', 'isActive']}
          valuePropName="checked"
        >
          <StyledCheckbox>
            <AntdCheckbox
              className="checkbox"
              checked={marketAll}
              onChange={e => {
                handleCheckboxChange('marketAll', e.target.checked);
              }}
            >
              {t(selectorName.marketAll)}
            </AntdCheckbox>
          </StyledCheckbox>
        </StyledFormItem>

        <StyledFormItem name={['product', 'isActive']}>
          <CollapsibleControl
            initialValue={form.getFieldValue('product').isActive}
            title={t(selectorName.product)}
            onChange={checked => {
              isActiveChanged('product', checked);
            }}
          >
            <StyledLabel>{t('Maximum quantity to select')}</StyledLabel>
            <StyledInputContainer>
              <StyledRowFormItem
                expanded={form.getFieldValue('product').isActive}
                name={['product', 'dashboardQuantity']}
                label={<StyledLabel>{t('Dashboard')}</StyledLabel>}
                rules={[
                  { required: true, message: t('This field is required') },
                  {
                    type: 'number',
                    min: 1,
                    message: t('Value must be at least 1'),
                  },
                ]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  allowClear
                  placeholder={t('Specify quantity')}
                  value={form.getFieldValue('product').dashboardQuantity}
                  onChange={value => {
                    handleInputChange('product', 'dashboard', value);
                    handleValidation();
                  }}
                />
              </StyledRowFormItem>
              <StyledRowFormItem
                expanded={form.getFieldValue('product').isActive}
                name={['product', 'constructorQuantity']}
                label={<StyledLabel>{t('Constructor')}</StyledLabel>}
                rules={[
                  { required: true, message: t('This field is required') },
                  {
                    type: 'number',
                    min: 1,
                    message: t('Value must be at least 1'),
                  },
                ]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  allowClear
                  placeholder={t('Specify quantity')}
                  value={form.getFieldValue('product').constructorQuantity}
                  onChange={value => {
                    handleInputChange('product', 'constructor', value);
                    handleValidation();
                  }}
                />
              </StyledRowFormItem>
            </StyledInputContainer>
            <StyledFormItem
              name={['product', 'onlyAdvancedMode']}
              valuePropName="checked"
            >
              <StyledCheckbox>
                <AntdCheckbox
                  className="checkbox"
                  checked={onlyAdvancedMode}
                  onChange={e => {
                    handleCheckboxChange('onlyAdvancedMode', e.target.checked);
                  }}
                >
                  {t('Only advanced constructor is available')}
                </AntdCheckbox>
              </StyledCheckbox>
            </StyledFormItem>
          </CollapsibleControl>
        </StyledFormItem>

        <StyledFormItem name={['productAll', 'isActive']}>
          <CollapsibleControl
            initialValue={form.getFieldValue('productAll').isActive}
            title={t(selectorName.productAll)}
            onChange={checked => {
              isActiveChanged('productAll', checked);
            }}
          >
            <StyledFormItem
              name={['productAll', 'onlyAdvancedMode']}
              valuePropName="checked"
            >
              <StyledCheckbox>
                <AntdCheckbox
                  className="checkbox"
                  checked={onlyAdvancedMode}
                  onChange={e => {
                    handleCheckboxChange('onlyAdvancedMode', e.target.checked);
                  }}
                >
                  {t('Only advanced constructor is available')}
                </AntdCheckbox>
              </StyledCheckbox>
            </StyledFormItem>
          </CollapsibleControl>
        </StyledFormItem>

        <StyledFormItem name={['period', 'isActive']} valuePropName="checked">
          <StyledCheckbox>
            <AntdCheckbox
              className="checkbox"
              checked={period}
              onChange={e => {
                handleCheckboxChange('period', e.target.checked);
              }}
            >
              {t(selectorName.period)}
            </AntdCheckbox>
          </StyledCheckbox>
        </StyledFormItem>

        <StyledFormItem
          name={['comparisonPeriod', 'isActive']}
          valuePropName="checked"
        >
          <StyledCheckbox>
            <StyledTooltip
              title={period ? '' : t('Not available without Period')}
              placement="top"
            >
              <AntdCheckbox
                className="checkbox"
                checked={compPeriod && period}
                style={{ paddingLeft: '0px' }}
                disabled={!period}
                onChange={e => {
                  handleCheckboxChange('comparisonPeriod', e.target.checked);
                }}
              >
                {t(selectorName.comparisonPeriod)}
              </AntdCheckbox>
            </StyledTooltip>
          </StyledCheckbox>
        </StyledFormItem>

        <StyledFormItem name={['facts', 'isActive']}>
          <CollapsibleControl
            initialValue={form.getFieldValue('facts').isActive}
            title={t('Facts')}
            onChange={checked => {
              isActiveChanged('facts', checked);
            }}
          >
            <StyledRowFormItem
              style={{ width: '350px' }}
              expanded={form.getFieldValue('facts').isActive}
              name={['facts', 'options']}
              rules={[{ required: true, message: t('This field is required') }]}
            >
              <Select
                value={form.getFieldValue('facts').options}
                mode="multiple"
                allowClear
                placeholder={t('Select facts')}
                name={['facts', 'options']}
                options={factsDictOptions}
                onChange={value => {
                  handleFactChange(value);
                  updateInitial();
                  handleValidation();
                }}
              />
            </StyledRowFormItem>
            <FactsConfigurationLink
              isEmpty={factsDictOptions.length === 0}
              setFacts={setFactsDictOptions}
              setSelectedFact={handleFactChange}
              updateInitial={updateInitial}
              initialState={initialFactDictState}
            >
              {t('Edit Facts')}
            </FactsConfigurationLink>
          </CollapsibleControl>
        </StyledFormItem>
      </Container>
    </StyledContainer>
  );
};

export default React.memo(
  forwardRef<typeof SelectorsConfigForm, SelectorsConfigFormProps>(
    SelectorsConfigForm,
  ),
);
