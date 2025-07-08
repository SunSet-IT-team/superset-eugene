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
import {
DataMaskStateWithId,
DataRecordFilters,
ExtraChartControls,
PartialFilters,
} from '@superset-ui/core';
import { ChartConfiguration, ChartQueryPayload } from 'src/dashboard/types';
import { getExtraChartControls } from 'src/dashboard/components/nativeFilters/utils';
import { areObjectsEqual } from 'src/reduxUtils';
import { getAllActiveFilters } from '../activeAllDashboardFilters';

// We cache formData objects so that our connected container components don't always trigger
// render cascades. we cannot leverage the reselect library because our cache size is >1
const cachedFiltersByChart = {};
const cachedExtraChartControlsByChart = {};

export interface GetFormDataWithExtraFiltersArguments {
chartConfiguration: ChartConfiguration;
chart: ChartQueryPayload;
filters: DataRecordFilters;
colorScheme?: string;
colorNamespace?: string;
sliceId: number;
dataMask: DataMaskStateWithId;
nativeFilters: PartialFilters;
extraControls: Record<string, string | boolean | null>;
labelColors?: Record<string, string>;
sharedLabelColors?: Record<string, string>;
allSliceIds: number[];
}

// this function merge chart's formData with dashboard filters value,
// and generate a new formData which will be used in the new query.
// filters param only contains those applicable to this chart.
export default function getExtraChartControlsWithExtraFilters({
chart,
filters,
nativeFilters,
chartConfiguration,
sliceId,
dataMask,
allSliceIds,
}: GetFormDataWithExtraFiltersArguments) {
// if dashboard metadata + filters have not changed, use cache if possible
const cachedExtraChartControls = cachedExtraChartControlsByChart[sliceId];
if (
    cachedFiltersByChart[sliceId] === filters &&
    areObjectsEqual(cachedExtraChartControls?.dataMask, dataMask, {
    ignoreUndefined: true,
    })
) {
    return cachedExtraChartControls?.extraChartControls;
}
let extraChartControls: ExtraChartControls = {};
const activeFilters = getAllActiveFilters({
    chartConfiguration,
    dataMask,
    nativeFilters,
    allSliceIds,
});
const filterIdsAppliedOnChart = Object.entries(activeFilters)
    .filter(([, { scope }]) => scope.includes(chart.id))
    .map(([filterId]) => filterId);
if (filterIdsAppliedOnChart.length) {
    extraChartControls = getExtraChartControls(
    dataMask,
    filterIdsAppliedOnChart,
    );
}

cachedFiltersByChart[sliceId] = filters;
cachedExtraChartControlsByChart[sliceId] = { extraChartControls, dataMask };

return extraChartControls;
}