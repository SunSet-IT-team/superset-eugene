# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.
from __future__ import annotations

import copy
import logging
import re
from typing import Any, ClassVar, TYPE_CHECKING, TypedDict

import numpy as np
import pandas as pd
from flask_babel import gettext as _
from pandas import DateOffset

from superset import app
from superset.common.chart_data import ChartDataResultFormat
from superset.common.db_query_status import QueryStatus
from superset.common.query_actions import get_query_results
from superset.common.utils import dataframe_utils
from superset.common.utils.query_cache_manager import QueryCacheManager
from superset.common.utils.time_range_utils import (
    get_since_until_from_query_object,
    get_since_until_from_time_range,
)
from superset.connectors.sqla.models import BaseDatasource
from superset.constants import CacheRegion, TimeGrain
from superset.daos.annotation_layer import AnnotationLayerDAO
from superset.daos.chart import ChartDAO
from superset.exceptions import (
    InvalidPostProcessingError,
    QueryObjectValidationError,
    SupersetException,
    SupersetSecurityException,
)
from superset.extensions import cache_manager, security_manager
from superset.models.helpers import QueryResult
from superset.models.sql_lab import Query
from superset.utils import csv, excel
from superset.utils.cache import generate_cache_key, set_and_log_cache
from superset.utils.core import (
    DatasourceType,
    DateColumn,
    DTTM_ALIAS,
    error_msg_from_exception,
    get_base_axis_labels,
    get_column_names_from_columns,
    get_column_names_from_metrics,
    get_metric_names,
    get_x_axis_label,
    normalize_dttm_col,
    TIME_COMPARISON,
)
from superset.constants import (
    NO_SELECTOR, 
    PERIOD_MAPPING_SELECTOR,
    PERIOD_DEFINITIONS,
    COMPARISON_PERIOD_TYPES,
    PERIOD_COLUMN_NAME,
    EXCEL_EXPORT_PERIOD_COL_NAME,
    PERIOD_DATASET_ID, 
    PERIOD_DATASET_TYPE,
    FACT_ID_PREFIX,
)
from superset.utils.date_parser import get_past_or_future, normalize_time_delta
from superset.utils.pandas_postprocessing.utils import unescape_separator
from superset.views.utils import get_viz
from superset.viz import viz_types

from superset.korus_plugin.korus_export_enum import ExcelExportDictKey, ExcelExportHeaderKey
from superset.korus_plugin.korus_export_excel import df_to_excel as korus_df_to_excel
from superset.daos.datasource import DatasourceDAO
from superset.daos.exceptions import DatasourceNotFound, DatasourceTypeNotSupportedError

if TYPE_CHECKING:
    from superset.common.query_context import QueryContext
    from superset.common.query_object import QueryObject
    from superset.stats_logger import BaseStatsLogger

config = app.config
stats_logger: BaseStatsLogger = config["STATS_LOGGER"]
logger = logging.getLogger(__name__)

# Offset join column suffix used for joining offset results
OFFSET_JOIN_COLUMN_SUFFIX = "__offset_join_column_"

# This only includes time grains that may influence
# the temporal column used for joining offset results.
# Given that we don't allow time shifts smaller than a day,
# we don't need to include smaller time grains aggregations.
AGGREGATED_JOIN_GRAINS = {
    TimeGrain.WEEK,
    TimeGrain.WEEK_STARTING_SUNDAY,
    TimeGrain.WEEK_STARTING_MONDAY,
    TimeGrain.WEEK_ENDING_SATURDAY,
    TimeGrain.WEEK_ENDING_SUNDAY,
    TimeGrain.MONTH,
    TimeGrain.QUARTER,
    TimeGrain.YEAR,
}

# Right suffix used for joining offset results
R_SUFFIX = "__right_suffix"


class CachedTimeOffset(TypedDict):
    df: pd.DataFrame
    queries: list[str]
    cache_keys: list[str | None]


class QueryContextProcessor:
    """
    The query context contains the query object and additional fields necessary
    to retrieve the data payload for a given viz.
    """

    _query_context: QueryContext
    _qc_datasource: BaseDatasource

    def __init__(self, query_context: QueryContext):
        self._query_context = query_context
        self._qc_datasource = query_context.datasource

    cache_type: ClassVar[str] = "df"
    enforce_numerical_metrics: ClassVar[bool] = True

    def get_df_payload(
        self, query_obj: QueryObject, force_cached: bool | None = False
    ) -> dict[str, Any]:
        """Handles caching around the df payload retrieval"""
        cache_key = self.query_cache_key(query_obj)
        timeout = self.get_cache_timeout()
        force_query = self._query_context.force or timeout == -1
        cache = QueryCacheManager.get(
            key=cache_key,
            region=CacheRegion.DATA,
            force_query=force_query,
            force_cached=force_cached,
        )

        if query_obj and cache_key and not cache.is_loaded:
            try:
                if invalid_columns := [
                    col
                    for col in get_column_names_from_columns(query_obj.columns)
                    + get_column_names_from_metrics(query_obj.metrics or [])
                    if (
                        col not in self._qc_datasource.column_names
                        and col != DTTM_ALIAS
                    )
                ]:
                    raise QueryObjectValidationError(
                        _(
                            "Columns missing in dataset: %(invalid_columns)s",
                            invalid_columns=invalid_columns,
                        )
                    )

                query_result = self.get_query_result(query_obj)
                annotation_data = self.get_annotation_data(query_obj)
                cache.set_query_result(
                    key=cache_key,
                    query_result=query_result,
                    annotation_data=annotation_data,
                    force_query=force_query,
                    timeout=self.get_cache_timeout(),
                    datasource_uid=self._qc_datasource.uid,
                    region=CacheRegion.DATA,
                )
            except QueryObjectValidationError as ex:
                cache.error_message = str(ex)
                cache.status = QueryStatus.FAILED

        # the N-dimensional DataFrame has converted into flat DataFrame
        # by `flatten operator`, "comma" in the column is escaped by `escape_separator`
        # the result DataFrame columns should be unescaped

        label_map = {
            unescape_separator(col): [
                unescape_separator(col) for col in re.split(r"(?<!\\),\s", col)
            ]
            for col in cache.df.columns.values
        }
        # логика использования кастомных labels для JSON_DATASET
        fact_names = {
                12 : "Абс. изм. продаж в деньгах",
                16 : "Цена за упаковку", 
                17 : "Цена за единицу объёма",
                20 : "Доля, упаковки, %",
                21 : "Доля, натур. продажи, %",
                22 : "Доля, деньги, %",
                33 : "Взвешенная дистрибуция",
                34 : "Кумулятивная взвешенная дистрибуция",
                35 : "Числовая дистрибуция"
        }

        datasource = query_obj.datasource
        if hasattr(datasource, 'is_json_dataset') and datasource.is_json_dataset:
            json_structure = datasource.json_structure
            facts = json_structure.get('Facts', [])

            for key, value in label_map.items():
                if key.startswith(FACT_ID_PREFIX):
                    try:
                        fact_id = int(key.lstrip(FACT_ID_PREFIX))
                        if fact_id in facts:
                            label_map[key] = fact_names[fact_id]
                    except (ValueError, IndexError):
                        pass

        cache.df.columns = [unescape_separator(col) for col in cache.df.columns.values]

        return {
            "cache_key": cache_key,
            "cached_dttm": cache.cache_dttm,
            "cache_timeout": self.get_cache_timeout(),
            "df": cache.df,
            "applied_template_filters": cache.applied_template_filters,
            "applied_filter_columns": cache.applied_filter_columns,
            "rejected_filter_columns": cache.rejected_filter_columns,
            "annotation_data": cache.annotation_data,
            "error": cache.error_message,
            "is_cached": cache.is_cached,
            "query": cache.query,
            "status": cache.status,
            "stacktrace": cache.stacktrace,
            "rowcount": len(cache.df.index),
            "sql_rowcount": cache.sql_rowcount,
            "from_dttm": query_obj.from_dttm,
            "to_dttm": query_obj.to_dttm,
            "label_map": label_map,
        }

    def query_cache_key(self, query_obj: QueryObject, **kwargs: Any) -> str | None:
        """
        Returns a QueryObject cache key for objects in self.queries
        """
        datasource = self._qc_datasource
        extra_cache_keys = datasource.get_extra_cache_keys(query_obj.to_dict())

        cache_key = (
            query_obj.cache_key(
                datasource=datasource.uid,
                extra_cache_keys=extra_cache_keys,
                rls=security_manager.get_rls_cache_key(datasource),
                changed_on=datasource.changed_on,
                **kwargs,
            )
            if query_obj
            else None
        )
        return cache_key

    def get_query_result(self, query_object: QueryObject) -> QueryResult:
        """Returns a pandas dataframe based on the query object"""
        query_context = self._query_context
        # Here, we assume that all the queries will use the same datasource, which is
        # a valid assumption for current setting. In the long term, we may
        # support multiple queries from different data sources.

        query = ""
        if isinstance(query_context.datasource, Query):
            # todo(hugh): add logic to manage all sip68 models here
            result = query_context.datasource.exc_query(query_object.to_dict())
        else:
            result = query_context.datasource.query(query_object.to_dict())
            query = result.query + ";\n\n"

        df = result.df
        # Transform the timestamp we received from database to pandas supported
        # datetime format. If no python_date_format is specified, the pattern will
        # be considered as the default ISO date format
        # If the datetime format is unix, the parse will use the corresponding
        # parsing logic
        if not df.empty:
            df = self.normalize_df(df, query_object)

            if query_object.time_offsets:
                time_offsets = self.processing_time_offsets(df, query_object)
                df = time_offsets["df"]
                queries = time_offsets["queries"]

                query += ";\n\n".join(queries)
                query += ";\n\n"

            # Re-raising QueryObjectValidationError
            if query_object.selectors:
                for selector in query_object.selectors:
                    if selector['type_selector'] == "Fact":
                        selected_fact = selector.get("selected_fact", None)
                        if not selected_fact or selected_fact == NO_SELECTOR:
                            continue
                        sql_expression, label = query_context.datasource.get_fact_from_datasource(
                            datasource_id=selected_fact['datasource_id'],
                            datasource_type=selected_fact['datasource_type'],
                            row_id=selected_fact['row_id'],
                            column=selected_fact['column']
                        )
                        
                        if query_object.post_processing:
                            for post_process in query_object.post_processing:
                                operation = post_process.get("operation")
                                if not operation:
                                    raise InvalidPostProcessingError(
                                        _("`operation` property of post processing object undefined")
                                    )
                                elif operation == "pivot":
                                    post_process["options"]["aggregates"] = {
                                        label: {
                                            "operator": "mean"
                                        }
                                    }
                        
            try:
                df = query_object.exec_post_processing(df)
            except InvalidPostProcessingError as ex:
                raise QueryObjectValidationError(ex.message) from ex

        result.df = df
        result.query = query
        result.from_dttm = query_object.from_dttm
        result.to_dttm = query_object.to_dttm
        return result

    def normalize_df(self, df: pd.DataFrame, query_object: QueryObject) -> pd.DataFrame:
        # todo: should support "python_date_format" and "get_column" in each datasource
        def _get_timestamp_format(
            source: BaseDatasource, column: str | None
        ) -> str | None:
            column_obj = source.get_column(column)
            if (
                column_obj
                # only sqla column was supported
                and hasattr(column_obj, "python_date_format")
                and (formatter := column_obj.python_date_format)
            ):
                return str(formatter)

            return None

        datasource = self._qc_datasource
        labels = tuple(
            label
            for label in [
                *get_base_axis_labels(query_object.columns),
                query_object.granularity,
            ]
            if datasource
            # Query datasource didn't support `get_column`
            and hasattr(datasource, "get_column")
            and (col := datasource.get_column(label))
            # todo(hugh) standardize column object in Query datasource
            and (col.get("is_dttm") if isinstance(col, dict) else col.is_dttm)
        )
        dttm_cols = [
            DateColumn(
                timestamp_format=_get_timestamp_format(datasource, label),
                offset=datasource.offset,
                time_shift=query_object.time_shift,
                col_label=label,
            )
            for label in labels
            if label
        ]
        if DTTM_ALIAS in df:
            dttm_cols.append(
                DateColumn.get_legacy_time_column(
                    timestamp_format=_get_timestamp_format(
                        datasource, query_object.granularity
                    ),
                    offset=datasource.offset,
                    time_shift=query_object.time_shift,
                )
            )
        normalize_dttm_col(
            df=df,
            dttm_cols=tuple(dttm_cols),
        )

        if self.enforce_numerical_metrics:
            dataframe_utils.df_metrics_to_num(df, query_object)

        df.replace([np.inf, -np.inf], np.nan, inplace=True)

        return df

    @staticmethod
    def get_time_grain(query_object: QueryObject) -> Any | None:
        if (
            query_object.columns
            and len(query_object.columns) > 0
            and isinstance(query_object.columns[0], dict)
        ):
            # If the time grain is in the columns it will be the first one
            # and it will be of AdhocColumn type
            return query_object.columns[0].get("timeGrain")

        return query_object.extras.get("time_grain_sqla")

    # pylint: disable=too-many-arguments
    def add_offset_join_column(
        self,
        df: pd.DataFrame,
        name: str,
        time_grain: str,
        time_offset: str | None = None,
        join_column_producer: Any = None,
    ) -> None:
        """
        Adds an offset join column to the provided DataFrame.

        The function modifies the DataFrame in-place.

        :param df: pandas DataFrame to which the offset join column will be added.
        :param name: The name of the new column to be added.
        :param time_grain: The time grain used to calculate the new column.
        :param time_offset: The time offset used to calculate the new column.
        :param join_column_producer: A function to generate the join column.
        """
        if join_column_producer:
            df[name] = df.apply(lambda row: join_column_producer(row, 0), axis=1)
        else:
            df[name] = df.apply(
                lambda row: self.generate_join_column(row, 0, time_grain, time_offset),
                axis=1,
            )

    def processing_time_offsets(  # pylint: disable=too-many-locals,too-many-statements
        self,
        df: pd.DataFrame,
        query_object: QueryObject,
    ) -> CachedTimeOffset:
        query_context = self._query_context
        # ensure query_object is immutable
        query_object_clone = copy.copy(query_object)
        queries: list[str] = []
        cache_keys: list[str | None] = []
        offset_dfs: dict[str, pd.DataFrame] = {}

        outer_from_dttm, outer_to_dttm = get_since_until_from_query_object(query_object)
        if not outer_from_dttm or not outer_to_dttm:
            raise QueryObjectValidationError(
                _(
                    "An enclosed time range (both start and end) must be specified "
                    "when using a Time Comparison."
                )
            )

        time_grain = self.get_time_grain(query_object)

        if not time_grain:
            raise QueryObjectValidationError(
                _("Time Grain must be specified when using Time Shift.")
            )

        metric_names = get_metric_names(query_object.metrics)

        # use columns that are not metrics as join keys
        join_keys = [col for col in df.columns if col not in metric_names]

        for offset in query_object.time_offsets:
            try:
                # pylint: disable=line-too-long
                # Since the x-axis is also a column name for the time filter, x_axis_label will be set as granularity
                # these query object are equivalent:
                # 1) { granularity: 'dttm_col', time_range: '2020 : 2021', time_offsets: ['1 year ago']}
                # 2) { columns: [
                #        {label: 'dttm_col', sqlExpression: 'dttm_col', "columnType": "BASE_AXIS" }
                #      ],
                #      time_offsets: ['1 year ago'],
                #      filters: [{col: 'dttm_col', op: 'TEMPORAL_RANGE', val: '2020 : 2021'}],
                #    }
                query_object_clone.from_dttm = get_past_or_future(
                    offset,
                    outer_from_dttm,
                )
                query_object_clone.to_dttm = get_past_or_future(offset, outer_to_dttm)

                x_axis_label = get_x_axis_label(query_object.columns)
                query_object_clone.granularity = (
                    query_object_clone.granularity or x_axis_label
                )
            except ValueError as ex:
                raise QueryObjectValidationError(str(ex)) from ex
            # make sure subquery use main query where clause
            query_object_clone.inner_from_dttm = outer_from_dttm
            query_object_clone.inner_to_dttm = outer_to_dttm
            query_object_clone.time_offsets = []
            query_object_clone.post_processing = []
            query_object_clone.filter = [
                flt
                for flt in query_object_clone.filter
                if flt.get("col") != x_axis_label
            ]

            # `offset` is added to the hash function
            cache_key = self.query_cache_key(
                query_object_clone, time_offset=offset, time_grain=time_grain
            )
            cache = QueryCacheManager.get(
                cache_key, CacheRegion.DATA, query_context.force
            )
            # whether hit on the cache
            if cache.is_loaded:
                offset_dfs[offset] = cache.df
                queries.append(cache.query)
                cache_keys.append(cache_key)
                continue

            query_object_clone_dct = query_object_clone.to_dict()
            # rename metrics: SUM(value) => SUM(value) 1 year ago
            metrics_mapping = {
                metric: TIME_COMPARISON.join([metric, offset])
                for metric in metric_names
            }

            # When the original query has limit or offset we wont apply those
            # to the subquery so we prevent data inconsistency due to missing records
            # in the dataframes when performing the join
            if query_object.row_limit or query_object.row_offset:
                query_object_clone_dct["row_limit"] = config["ROW_LIMIT"]
                query_object_clone_dct["row_offset"] = 0

            if isinstance(self._qc_datasource, Query):
                result = self._qc_datasource.exc_query(query_object_clone_dct)
            else:
                result = self._qc_datasource.query(query_object_clone_dct)

            queries.append(result.query)
            cache_keys.append(None)

            offset_metrics_df = result.df
            if offset_metrics_df.empty:
                offset_metrics_df = pd.DataFrame(
                    {
                        col: [np.NaN]
                        for col in join_keys + list(metrics_mapping.values())
                    }
                )
            else:
                # 1. normalize df, set dttm column
                offset_metrics_df = self.normalize_df(
                    offset_metrics_df, query_object_clone
                )

                # 2. rename extra query columns
                offset_metrics_df = offset_metrics_df.rename(columns=metrics_mapping)

                # 3. set time offset for index
                index = (get_base_axis_labels(query_object.columns) or [DTTM_ALIAS])[0]
                if not dataframe_utils.is_datetime_series(offset_metrics_df.get(index)):
                    raise QueryObjectValidationError(
                        _(
                            "A time column must be specified "
                            "when using a Time Comparison."
                        )
                    )

            # cache df and query
            value = {
                "df": offset_metrics_df,
                "query": result.query,
            }
            cache.set(
                key=cache_key,
                value=value,
                timeout=self.get_cache_timeout(),
                datasource_uid=query_context.datasource.uid,
                region=CacheRegion.DATA,
            )
            offset_dfs[offset] = offset_metrics_df

        if offset_dfs:
            df = self.join_offset_dfs(
                df,
                offset_dfs,
                time_grain,
                join_keys,
            )

        return CachedTimeOffset(df=df, queries=queries, cache_keys=cache_keys)

    def join_offset_dfs(
        self,
        df: pd.DataFrame,
        offset_dfs: dict[str, pd.DataFrame],
        time_grain: str,
        join_keys: list[str],
    ) -> pd.DataFrame:
        """
        Join offset DataFrames with the main DataFrame.

        :param df: The main DataFrame.
        :param offset_dfs: A list of offset DataFrames.
        :param time_grain: The time grain used to calculate the temporal join key.
        :param join_keys: The keys to join on.
        """
        join_column_producer = config["TIME_GRAIN_JOIN_COLUMN_PRODUCERS"].get(
            time_grain
        )

        # iterate on offset_dfs, left join each with df
        for offset, offset_df in offset_dfs.items():
            # defines a column name for the offset join column
            column_name = OFFSET_JOIN_COLUMN_SUFFIX + offset

            # add offset join column to df
            self.add_offset_join_column(
                df, column_name, time_grain, offset, join_column_producer
            )

            # add offset join column to offset_df
            self.add_offset_join_column(
                offset_df, column_name, time_grain, None, join_column_producer
            )

            # the temporal column is the first column in the join keys
            # so we use the join column instead of the temporal column
            actual_join_keys = [column_name, *join_keys[1:]]

            # left join df with offset_df
            df = dataframe_utils.left_join_df(
                left_df=df,
                right_df=offset_df,
                join_keys=actual_join_keys,
                rsuffix=R_SUFFIX,
            )

            # move the temporal column to the first column in df
            col = df.pop(join_keys[0])
            df.insert(0, col.name, col)

            # removes columns created only for join purposes
            df.drop(
                list(df.filter(regex=f"{OFFSET_JOIN_COLUMN_SUFFIX}|{R_SUFFIX}")),
                axis=1,
                inplace=True,
            )
        return df

    @staticmethod
    def generate_join_column(
        row: pd.Series,
        column_index: int,
        time_grain: str,
        time_offset: str | None = None,
    ) -> str:
        value = row[column_index]

        if hasattr(value, "strftime"):
            if time_offset:
                value = value + DateOffset(**normalize_time_delta(time_offset))

            if time_grain in (
                TimeGrain.WEEK_STARTING_SUNDAY,
                TimeGrain.WEEK_ENDING_SATURDAY,
            ):
                return value.strftime("%Y-W%U")

            if time_grain in (
                TimeGrain.WEEK,
                TimeGrain.WEEK_STARTING_MONDAY,
                TimeGrain.WEEK_ENDING_SUNDAY,
            ):
                return value.strftime("%Y-W%W")

            if time_grain == TimeGrain.MONTH:
                return value.strftime("%Y-%m")

            if time_grain == TimeGrain.QUARTER:
                return value.strftime("%Y-Q") + str(value.quarter)

            if time_grain == TimeGrain.YEAR:
                return value.strftime("%Y")

        return str(value)

    def get_data(self, df: pd.DataFrame) -> str | list[dict[str, Any]]:
        if self._query_context.result_format in ChartDataResultFormat.table_like():
            include_index = not isinstance(df.index, pd.RangeIndex)
            columns = list(df.columns)
            verbose_map = self._qc_datasource.data.get("verbose_map", {})
            if verbose_map:
                df.columns = [verbose_map.get(column, column) for column in columns]

            result = None
            if self._query_context.result_format == ChartDataResultFormat.CSV:
                result = csv.df_to_escaped_csv(
                    df, index=include_index, **config["CSV_EXPORT"]
                )
            
            elif self._query_context.result_format == ChartDataResultFormat.XLSX:
                header_df = self.korus_get_excel_header_data()
                engine_options = config["EXCEL_EXPORT"][ExcelExportDictKey.ENGINE]
                result = korus_df_to_excel(df, header_df, **engine_options)

            return result or ""

        return df.to_dict(orient="records")


    def korus_get_excel_header_data(self) -> pd.DataFrame:
        def _get_period_datasource() -> BaseDatasource:
            period_datasource_id = PERIOD_DATASET_ID
            period_datasource_type = PERIOD_DATASET_TYPE
            period_datasource = None
            try:
                period_datasource = DatasourceDAO.get_datasource(
                    datasource_type = DatasourceType(period_datasource_type),
                    datasource_id = int(period_datasource_id),
                )
                period_datasource.raise_for_access()
            except ValueError:
                raise ValueError(f"Invalid datasource type: {period_datasource_type}")
            except DatasourceTypeNotSupportedError as ex:
                raise DatasourceTypeNotSupportedError(ex.message)
            except DatasourceNotFound as ex:
                raise DatasourceNotFound(ex.message)
            except SupersetSecurityException as ex:
                raise SupersetSecurityException(ex.message)
            
            return period_datasource
        
        header_options = config["EXCEL_EXPORT"][ExcelExportDictKey.HEADER]
        selectors_header_keys_upper = [
            key.upper() for key in header_options.keys() if header_options[key]["Type"] == ExcelExportHeaderKey.SELECTOR_DATE 
        ]
        export_data_header_keys_upper = [
            key.upper() for key in header_options.keys() if header_options[key]["Type"] == ExcelExportHeaderKey.EXPORTDATA
        ]
        separator_header_keys_upper = [
            key.upper() for key in header_options.keys() if header_options[key]["Type"] == ExcelExportHeaderKey.SEPARATOR
        ]
        headers = []
        period_list = []
        has_comparison_period = False

        try:
            # итерируем по списку queries, внутри итерируем по списку селекторов
            if self._query_context.queries:
                for query in self._query_context.queries:
                    selector_filters = []
                    if query.rls_restriction:
                        selector_filters = [{
                            'col' : query.rls_restriction["column"],
                            'val' : query.rls_restriction["value"]
                        }]

                    for selector in query.selectors:
                        type_selector_upper = selector["type_selector"].upper()
                        # Обрабатываем только селекторы по периодам
                        
                        if type_selector_upper in selectors_header_keys_upper:
                            header_option = header_options[type_selector_upper]

                            if header_option["Location"] in selector:
                                selector_value = selector[header_option["Location"]]
                                cleaned_selector_value = ''

                                # проверяем селекторы на наличие значений
                                if isinstance(selector_value, list) and selector_value[0] != NO_SELECTOR:
                                    cleaned_selector_value = selector_value
                                elif isinstance(selector_value, str) and selector_value != NO_SELECTOR:
                                    cleaned_selector_value = selector_value

                                if cleaned_selector_value:
                                    datasource = _get_period_datasource()

                                    if type_selector_upper == 'PERIOD':
                                        period_selector_type = selector["period_selector_type"]
                                        period_list = []
                                        period_list_export = []
                                        if period_selector_type == 'Predefined':
                                            if selector_value in PERIOD_MAPPING_SELECTOR:
                                                period_df = datasource.get_periods_by_selected_value(
                                                    selected_period = selector_value,
                                                    period_column_name = PERIOD_COLUMN_NAME.upper(),
                                                    selector_filters = selector_filters,
                                                    column_to_return = EXCEL_EXPORT_PERIOD_COL_NAME.upper()
                                                )
                                                period_list = period_df[PERIOD_COLUMN_NAME.upper()].tolist()
                                                period_list_export = period_df[EXCEL_EXPORT_PERIOD_COL_NAME.upper()].tolist()

                                        elif period_selector_type == 'Custom':
                                            period_df = datasource.get_custom_periods_by_selected_value(
                                                selected_period = selector_value,
                                                period_column_name = PERIOD_COLUMN_NAME.upper(),
                                                selector_filters = selector_filters,
                                                column_to_return = EXCEL_EXPORT_PERIOD_COL_NAME.upper()
                                            )
                                            period_list = period_df[PERIOD_COLUMN_NAME.upper()].tolist()
                                            period_list_export = period_df[EXCEL_EXPORT_PERIOD_COL_NAME.upper()].tolist()
                                        
                                        if period_list_export:
                                            period_set = set(period_list_export)
                                            if len(period_set) > 1:
                                                start_period, *_, end_period = period_list_export
                                                header_value = f"{start_period} - {end_period}"
                                            else:
                                                header_value = ", ".join(period_set)

                                            headers.append({
                                                'Name' : selector["label_selector"],
                                                'Value' : header_value,
                                                'Sort' : header_option["Sort"],
                                            })
                                    
                                    elif type_selector_upper == 'COMPARISON PERIOD':
                                        has_comparison_period = True
                                        comparison_period_value = selector_value
                                        comparison_period_selector_type = selector["comparison_period_selector_type"]
                                        comparison_period_name = selector["label_selector"]
                                        comparison_period_sort = header_option["Sort"]
                        
                    # обрабатываем сравнительный период при наличии
                    if has_comparison_period and period_list:
                        comparison_period_list_export = []

                        if comparison_period_selector_type == 'Predefined':
                            if comparison_period_value == COMPARISON_PERIOD_TYPES["ANALOGOUS"]["value"]:
                                comparison_period_df = datasource.get_comparison_periods_year_analogous(
                                    selected_periods = period_list,
                                    period_column_name = PERIOD_COLUMN_NAME.upper(),
                                    selector_filters = selector_filters,
                                    column_to_return = EXCEL_EXPORT_PERIOD_COL_NAME.upper()
                                )
                                comparison_period_list_export = comparison_period_df[EXCEL_EXPORT_PERIOD_COL_NAME.upper()].tolist()

                            elif comparison_period_value == COMPARISON_PERIOD_TYPES["PREVIOUS"]["value"]:
                                comparison_period_df = datasource.get_comparison_periods_previous(
                                    selected_periods = period_list,
                                    period_column_name = PERIOD_COLUMN_NAME.upper(),
                                    selector_filters = selector_filters,
                                    column_to_return = EXCEL_EXPORT_PERIOD_COL_NAME.upper()
                                )
                                comparison_period_list_export = comparison_period_df[EXCEL_EXPORT_PERIOD_COL_NAME.upper()].tolist() 

                        elif comparison_period_selector_type == 'Custom':
                            comparison_period_df = datasource.get_custom_periods_by_selected_value(
                                selected_period = comparison_period_value,
                                period_column_name = PERIOD_COLUMN_NAME.upper(),
                                selector_filters = selector_filters,
                                column_to_return = EXCEL_EXPORT_PERIOD_COL_NAME.upper()
                            )
                            comparison_period_list_export = comparison_period_df[EXCEL_EXPORT_PERIOD_COL_NAME.upper()].tolist()

                        if comparison_period_list_export:
                            comparison_period_set = set(comparison_period_list_export)
                            if len(comparison_period_set) > 1:
                                start_period, *_, end_period = comparison_period_list_export
                                header_value = f"{start_period} - {end_period}"
                            else:
                                header_value = ", ".join(comparison_period_set)
                            
                            headers.append({
                                'Name' : comparison_period_name,
                                'Value' : header_value,
                                'Sort' : comparison_period_sort,
                            })

                    # добавляем в заголовки название дашборда, графика, компанию и ордер
                    if query.korus_export_info:
                        for key, value in query.korus_export_info.items():
                            if key.upper() in export_data_header_keys_upper:
                                header_option = header_options[key.upper()]
                                headers.append({
                                    'Name' : header_option["Label"],
                                    'Value' : value[header_option["Location"]],
                                    'Sort' : header_option["Sort"],
                                })
                            elif key == 'selected_selectors':
                                for key_item, value_item in value.items():
                                    if value_item["items"]:
                                        header_option = header_options[key_item.upper()]
                                        headers.append({
                                            'Name' : header_option["Label"],
                                            'Value' : ", ".join(
                                                i[header_option["Location"]] for i in value_item["items"]
                                            ),
                                            'Sort' : header_option["Sort"],
                                        })
            
            # добавляем в заголовки разделители
            for header in separator_header_keys_upper:
                header_option = header_options[header]
                headers.append({
                    'Name' :header_option["Label"],
                    'Value' : "",
                    'Sort' : header_option["Sort"],
                })
        
        except Exception as err:
            import traceback
            tb = traceback.format_exc()
            error_text = f"error message: {err} , traceback: {tb}"
            headers.append({
                        'Name' : "Ошибка",
                        'Value' : error_text,
                        'Sort' : 1
            })

        header_df = pd.DataFrame(headers)
        header_df = header_df.sort_values(by='Sort')
        return header_df[['Name', 'Value']]


    def get_payload(
        self,
        cache_query_context: bool | None = False,
        force_cached: bool = False,
    ) -> dict[str, Any]:
        """Returns the query results with both metadata and data"""

        # Get all the payloads from the QueryObjects
        query_results = [
            get_query_results(
                query_obj.result_type or self._query_context.result_type,
                self._query_context,
                query_obj,
                force_cached,
            )
            for query_obj in self._query_context.queries
        ]
        return_value = {"queries": query_results}

        if cache_query_context:
            cache_key = self.cache_key()
            set_and_log_cache(
                cache_manager.cache,
                cache_key,
                {
                    "data": {
                        # setting form_data into query context cache value as well
                        # so that it can be used to reconstruct form_data field
                        # for query context object when reading from cache
                        "form_data": self._query_context.form_data,
                        **self._query_context.cache_values,
                    },
                },
                self.get_cache_timeout(),
            )
            return_value["cache_key"] = cache_key  # type: ignore

        return return_value

    def get_cache_timeout(self) -> int:
        if cache_timeout_rv := self._query_context.get_cache_timeout():
            return cache_timeout_rv
        if (
            data_cache_timeout := config["DATA_CACHE_CONFIG"].get(
                "CACHE_DEFAULT_TIMEOUT"
            )
        ) is not None:
            return data_cache_timeout
        return config["CACHE_DEFAULT_TIMEOUT"]

    def cache_key(self, **extra: Any) -> str:
        """
        The QueryContext cache key is made out of the key/values from
        self.cached_values, plus any other key/values in `extra`. It includes only data
        required to rehydrate a QueryContext object.
        """
        key_prefix = "qc-"
        cache_dict = self._query_context.cache_values.copy()
        cache_dict.update(extra)

        return generate_cache_key(cache_dict, key_prefix)

    def get_annotation_data(self, query_obj: QueryObject) -> dict[str, Any]:
        annotation_data: dict[str, Any] = self.get_native_annotation_data(query_obj)
        for annotation_layer in [
            layer
            for layer in query_obj.annotation_layers
            if layer["sourceType"] in ("line", "table")
        ]:
            name = annotation_layer["name"]
            annotation_data[name] = self.get_viz_annotation_data(
                annotation_layer, self._query_context.force
            )
        return annotation_data

    @staticmethod
    def get_native_annotation_data(query_obj: QueryObject) -> dict[str, Any]:
        annotation_data = {}
        annotation_layers = [
            layer
            for layer in query_obj.annotation_layers
            if layer["sourceType"] == "NATIVE"
        ]
        layer_ids = [layer["value"] for layer in annotation_layers]
        layer_objects = {
            layer_object.id: layer_object
            for layer_object in AnnotationLayerDAO.find_by_ids(layer_ids)
        }

        # annotations
        for layer in annotation_layers:
            layer_id = layer["value"]
            layer_name = layer["name"]
            columns = [
                "start_dttm",
                "end_dttm",
                "short_descr",
                "long_descr",
                "json_metadata",
            ]
            layer_object = layer_objects[layer_id]
            records = [
                {column: getattr(annotation, column) for column in columns}
                for annotation in layer_object.annotation
            ]
            result = {"columns": columns, "records": records}
            annotation_data[layer_name] = result
        return annotation_data

    @staticmethod
    def get_viz_annotation_data(
        annotation_layer: dict[str, Any], force: bool
    ) -> dict[str, Any]:
        # pylint: disable=import-outside-toplevel
        from superset.commands.chart.data.get_data_command import ChartDataCommand

        if not (chart := ChartDAO.find_by_id(annotation_layer["value"])):
            raise QueryObjectValidationError(_("The chart does not exist"))

        try:
            if chart.viz_type in viz_types:
                if not chart.datasource:
                    raise QueryObjectValidationError(
                        _("The chart datasource does not exist"),
                    )

                form_data = chart.form_data.copy()
                form_data.update(annotation_layer.get("overrides", {}))

                payload = get_viz(
                    datasource_type=chart.datasource.type,
                    datasource_id=chart.datasource.id,
                    form_data=form_data,
                    force=force,
                ).get_payload()

                return payload["data"]

            if not (query_context := chart.get_query_context()):
                raise QueryObjectValidationError(
                    _("The chart query context does not exist"),
                )

            if overrides := annotation_layer.get("overrides"):
                if time_grain_sqla := overrides.get("time_grain_sqla"):
                    for query_object in query_context.queries:
                        query_object.extras["time_grain_sqla"] = time_grain_sqla

                if time_range := overrides.get("time_range"):
                    from_dttm, to_dttm = get_since_until_from_time_range(time_range)

                    for query_object in query_context.queries:
                        query_object.from_dttm = from_dttm
                        query_object.to_dttm = to_dttm

            query_context.force = force
            command = ChartDataCommand(query_context)
            command.validate()
            payload = command.run()
            return {"records": payload["queries"][0]["data"]}
        except SupersetException as ex:
            raise QueryObjectValidationError(error_msg_from_exception(ex)) from ex

    def raise_for_access(self) -> None:
        """
        Raise an exception if the user cannot access the resource.

        :raises SupersetSecurityException: If the user cannot access the resource
        """
        for query in self._query_context.queries:
            query.validate()

        if self._qc_datasource.type == DatasourceType.QUERY:
            security_manager.raise_for_access(query=self._qc_datasource)
        else:
            security_manager.raise_for_access(query_context=self._query_context)
