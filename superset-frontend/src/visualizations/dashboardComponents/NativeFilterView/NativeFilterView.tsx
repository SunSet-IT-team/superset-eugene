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

import React, { useEffect, useState } from 'react';
import { styled } from '@superset-ui/core';
import Filter, { FilterProps } from './Filter';

const NativeFilterViewDiv = styled.div`
  width: 100%;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-row-gap: 0.5em;
  grid-column-gap: 1em;
`;

// TODO: POC only component can be removed after PR approved

const NativeFilterView = ({ dashboardData }: { dashboardData: any }) => {
  const { nativeFilters, dataMask } = dashboardData;

  const filters: FilterProps[] = [];
  Object.keys(nativeFilters?.filters).forEach(key => {
    filters.push({
      id: key,
      name: nativeFilters?.filters[key].name,
      label:
        nativeFilters?.filters[key]?.filterType !== 'filter_time'
          ? dataMask[key]?.filterState?.label
          : dataMask[key]?.filterState?.value,
      type: nativeFilters?.filters[key].filterType,
    });
  });

  const [listFilters, setFilters] = useState<React.JSX.Element[]>([]);

  useEffect(() => {
    const listFilter = filters
      .filter(filter => filter?.label)
      .map(filter => (
        <Filter
          id={filter.id}
          name={filter.name}
          key={filter.id}
          label={filter.label}
          type={filter.type}
        />
      ));

    setFilters(listFilter);
  }, [dataMask, nativeFilters]);

  return <NativeFilterViewDiv>{listFilters}</NativeFilterViewDiv>;
};

export default NativeFilterView;
