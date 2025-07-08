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

import { SupersetClient, styled, t } from '@superset-ui/core';
import React, { forwardRef, useEffect, useState } from 'react';
import { Select } from 'src/components';
import { getClientErrorObject } from 'src/utils/getClientErrorObject';
import { AllDatasets, DatasetById, ColumnValues } from './types';

const StyledTitle = styled.span`
  color: ${({ theme }) => theme.colors.grayscale.base};
  font-size: ${({ theme }) => theme.typography.sizes.m}px;
  font-weight: 600;
`;

const StyledItem = styled.div`
  margin-bottom: 10px;
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

export interface FactsConfigFormProps {
  setFacts?: ([any]) => void;
  setSelectedFact?: (string) => void;
  selectedDataset: any;
  selectedColumn: any;
  setSelectedDataset: (any) => void;
  setSelectedColumn: (any) => void;
  initialColumnName?: string;
  initialDatasourceName?: string;
  initialFacts?: any[];
}
// TODO CHANGE 'fact_list' ON ACTUAL DICT DATASET NAME
const FactsConfigForm = ({
  setFacts, // setDictOptions [{label: string, value: string}]
  setSelectedFact, // setOptions [string]
  selectedDataset,
  selectedColumn,
  setSelectedColumn,
  setSelectedDataset,
  initialColumnName,
  initialDatasourceName,
  initialFacts,
}: FactsConfigFormProps) => {
  const [datasets, setDatasets] = useState([]);

  const [columns, setColumns] = useState([]);

  const [innerFacts, setInnerFacts] = useState([]);
  const [selectedInnerFact, setSelectedInnerFact] = useState(initialFacts);

  const getDatasets = async () => {
    try {
      const { json } = await SupersetClient.get({
        endpoint: `/api/v1/dataset`,
      });
      const allDatasets: AllDatasets = json;
      const mappedDatasets = allDatasets.result.map(rawDatasetInfo => ({
        datasource_type: rawDatasetInfo.datasource_type,
        id: rawDatasetInfo.id,
        name: rawDatasetInfo.table_name,
      }));

      const initialDataset = mappedDatasets.find(
        dataset => dataset.name === initialDatasourceName,
      );

      if (initialDataset) {
        setDatasets(mappedDatasets);
        return [initialDataset.id, initialDataset.datasource_type];
      }

      if (mappedDatasets) {
        setDatasets(mappedDatasets);
        return [mappedDatasets[0].id, mappedDatasets[0].datasource_type];
      }
      throw new Error("Couldn't get list of datasets");
    } catch (response) {
      const error = await getClientErrorObject(response);
      const errorMessage =
        error.error || error.statusText || error.message || 'An error occurred';
      throw new Error(errorMessage);
    }
  };

  const getColumns = async datasourceId => {
    try {
      const { json } = await SupersetClient.get({
        endpoint: `/api/v1/dataset/${datasourceId}`,
      });
      const datasetById: DatasetById = json;
      const mappedColumns = datasetById.result.columns.map(column => ({
        value: column.column_name,
        name: column.column_name,
      }));

      const initialColumn = mappedColumns.find(
        column => column.name === initialColumnName,
      );

      if (initialColumn) {
        setColumns(mappedColumns);
        return initialColumn.name;
      }

      if (mappedColumns) {
        setColumns(mappedColumns);
        return mappedColumns[0].name;
      }
    } catch (response) {
      const error = await getClientErrorObject(response);
      const errorMessage =
        error.error || error.statusText || error.message || 'An error occurred';
      throw new Error(errorMessage);
    }
  };

  const getFacts = async (datasourceId, datasourceType, columnName) => {
    try {
      const { json } = await SupersetClient.get({
        endpoint: `/api/v1/datasource/${datasourceType}/${datasourceId}/column/${columnName}/values/`,
      });

      const columnValues: ColumnValues = json;
      const rawFacts = columnValues.result;

      if (rawFacts) {
        setInnerFacts(
          rawFacts
            .filter(fact => fact !== null)
            .map(fact => ({
              value: fact,
              label: fact,
            })),
        );
        return;
      }
      throw new Error('Dataset not found');
    } catch (response) {
      const error = await getClientErrorObject(response);
      const errorMessage =
        error.error || error.statusText || error.message || 'An error occurred';
      throw new Error(errorMessage);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      const [datasourceId, datasourceType] = await getDatasets();
      const columnName = await getColumns(datasourceId);
      await getFacts(datasourceId, datasourceType, columnName);
    };

    fetchData();
  }, []);

  useEffect(() => {
    if (datasets.length > 0) {
      const initialDataset = datasets.find(
        dataset => dataset.name === initialDatasourceName,
      );
      const defaultDataset = initialDataset || datasets[0];
      setSelectedDataset(defaultDataset);
    }
  }, [datasets]);

  useEffect(() => {
    if (columns.length > 0) {
      const initialColumn = columns.find(
        column => column.name === initialColumnName,
      );
      const defaultColumn = initialColumn || columns[0];
      setSelectedColumn(defaultColumn);
    }
  }, [columns]);

  useEffect(() => {
    if (innerFacts?.length > 0) {
      const validSelectedFacts = selectedInnerFact?.filter(
        fact => innerFacts?.some(innerFact => innerFact.value === fact),
      );

      if (validSelectedFacts?.length > 0) {
        setSelectedInnerFact(validSelectedFacts);
        setSelectedFact(validSelectedFacts);
      } else {
        const defaultFact = innerFacts[0]?.value;
        setSelectedInnerFact([defaultFact]);
        setSelectedFact([defaultFact]);
      }

      setFacts(innerFacts);
    }
  }, [innerFacts]);

  const handleSelectChange = async (type, value) => {
    try {
      if (type === 'dataset') {
        const selected = datasets.find(dataset => dataset.id === value);

        if (selected && selected.id !== selectedDataset?.id) {
          setSelectedDataset(selected);
          const columnName = await getColumns(selected.id);
          getFacts(selected.id, selected.datasource_type, columnName);
        }
      } else if (type === 'column') {
        const selected = columns.find(column => column.value === value);

        if (selected) {
          setSelectedColumn(selected);
          getFacts(
            selectedDataset.id,
            selectedDataset.datasource_type,
            selected.name,
          );
        }
      } else if (type === 'fact') {
        setSelectedInnerFact(value);
        setFacts(innerFacts);
        setSelectedFact(value);
      }
    } catch (error) {
      throw new Error(error);
    }
  };

  return (
    <StyledContainer>
      <StyledItem>
        <StyledTitle>{t('Select dataset')}</StyledTitle>
        <Select
          value={selectedDataset?.id}
          placeholder={t('Select dataset')}
          name="dataset"
          options={datasets.map(dataset => ({
            value: dataset.id,
            label: dataset.name,
          }))}
          onChange={value => handleSelectChange('dataset', value)}
        />
      </StyledItem>

      <StyledItem>
        <StyledTitle>{t('Select column')}</StyledTitle>
        <Select
          value={selectedColumn?.value}
          placeholder={t('Select column')}
          name="column"
          options={columns.map(column => ({
            value: column.value,
            label: column.name,
          }))}
          onChange={value => handleSelectChange('column', value)}
        />
      </StyledItem>

      <StyledItem>
        <StyledTitle>{t('Select facts')}</StyledTitle>
        <Select
          value={selectedInnerFact}
          mode="multiple"
          placeholder={t('Select facts')}
          name="fact"
          options={innerFacts}
          onChange={value => handleSelectChange('fact', value)}
        />
      </StyledItem>
    </StyledContainer>
  );
};

export default React.memo(
  forwardRef<typeof FactsConfigForm, FiltersConfigFormProps>(FactsConfigForm),
);
