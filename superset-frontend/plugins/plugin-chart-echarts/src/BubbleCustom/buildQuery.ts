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
  buildQueryContext,
  ensureIsArray,
  QueryFormData,
} from '@superset-ui/core';

export default function buildQuery(formData: QueryFormData) {
  const columns = [
    ...ensureIsArray(formData.entity),
    ...ensureIsArray(formData.series),
  ];

  const { dotted_x_axis, dotted_y_axis } = formData;

  return buildQueryContext(formData, baseQueryObject => {
    const existingMetrics = baseQueryObject.metrics || [];

    const newMetrics = [dotted_x_axis, dotted_y_axis];

    // Собираем все метрики, убирая дубликаты с помощью Set
    baseQueryObject.metrics = [
      ...new Set([
        ...existingMetrics,
        ...newMetrics.filter(metric => !!metric), // Исключаем пустые значения
      ]),
    ];

    baseQueryObject.row_limit = 1000

    return [
      {
        ...baseQueryObject,
        columns,
        orderby: baseQueryObject.orderby
          ? [[baseQueryObject.orderby[0], !baseQueryObject.order_desc]]
          : undefined,
      },
    ];
  });
}
