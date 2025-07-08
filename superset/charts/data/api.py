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

import contextlib
import json
import logging
from typing import Any, TYPE_CHECKING

import simplejson
from flask import current_app, g, make_response, request, Response, session
from flask_appbuilder.api import expose, protect
from flask_babel import gettext as _
from marshmallow import ValidationError

from superset import is_feature_enabled, security_manager
from superset.async_events.async_query_manager import AsyncQueryTokenException
from superset.charts.api import ChartRestApi
from superset.charts.data.query_context_cache_loader import QueryContextCacheLoader
from superset.charts.post_processing import apply_post_process
from superset.charts.schemas import ChartDataQueryContextSchema
from superset.commands.chart.data.create_async_job_command import (
    CreateAsyncChartDataJobCommand,
)
from superset.commands.chart.data.get_data_command import ChartDataCommand
from superset.commands.chart.exceptions import (
    ChartDataCacheLoadError,
    ChartDataQueryFailedError,
)
from superset.common.chart_data import ChartDataResultFormat, ChartDataResultType
from superset.connectors.sqla.models import BaseDatasource
from superset.constants import ( 
    SELECTOR_COLUMNS, 
    TARGET_DATASOURCE_COLUMNS,
    PERIOD_MAPPING_SELECTOR, 
    PER_TAG_COLUMN,
    SELECTOR_DATASOURCES, 
    DATASOURCE_TYPE, 
    PERIOD_COLUMN_NAME, 
    MARKET_COLUMN, 
    PRODUCT_COLUMN, 
    PERIOD_MAPPING_SELECTOR, 
    COMPARISON_PERIOD_TYPES,
    DATASOURCE_TYPE, 
    TARGET_DATASOURCE
)
from superset.daos.exceptions import DatasourceNotFound
from superset.exceptions import QueryObjectValidationError
from superset.extensions import event_logger
from superset.models.sql_lab import Query
from superset.utils.core import (
    create_zip,
    DatasourceType,
    get_user_id,
    json_int_dttm_ser,
) 
from superset.utils.decorators import logs_context
from superset.views.base import CsvResponse, generate_download_headers, XlsxResponse
from superset.views.base_api import statsd_metrics

if TYPE_CHECKING:
    from superset.common.query_context import QueryContext

from flask_appbuilder.api import expose, protect, safe

from superset import app, event_logger
from superset.daos.datasource import DatasourceDAO, Datasource
from superset.daos.exceptions import DatasourceNotFound, DatasourceTypeNotSupportedError
from superset.exceptions import SupersetSecurityException
from superset.superset_typing import FlaskResponse
from superset.utils.core import apply_max_row_limit, DatasourceType, flatten_and_unique
from superset.views.base_api import statsd_metrics
from superset.views.utils import get_datasource

from sqlalchemy import ( 
    Table, Column, MetaData, String, select, and_, bindparam, inspect, text, column, literal_column
)

logger = logging.getLogger(__name__)


class ChartDataRestApi(ChartRestApi):
    include_route_methods = {"get_data", "data", "data_from_cache", "check_selectors", "raiting", "generate_sql"}

    @expose("/<int:pk>/data/", methods=("GET",))
    @protect()
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.data",
        log_to_statsd=False,
    )
    def get_data(self, pk: int) -> Response:
        """
        Take a chart ID and uses the query context stored when the chart was saved
        to return payload data response.
        ---
        get:
          summary: Return payload data response for a chart
          description: >-
            Takes a chart ID and uses the query context stored when the chart was saved
            to return payload data response.
          parameters:
          - in: path
            schema:
              type: integer
            name: pk
            description: The chart ID
          - in: query
            name: format
            description: The format in which the data should be returned
            schema:
              type: string
          - in: query
            name: type
            description: The type in which the data should be returned
            schema:
              type: string
          - in: query
            name: force
            description: Should the queries be forced to load from the source
            schema:
                type: boolean
          responses:
            200:
              description: Query result
              content:
                application/json:
                  schema:
                    $ref: "#/components/schemas/ChartDataResponseSchema"
            202:
              description: Async job details
              content:
                application/json:
                  schema:
                    $ref: "#/components/schemas/ChartDataAsyncResponseSchema"
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            500:
              $ref: '#/components/responses/500'
        """
        chart = self.datamodel.get(pk, self._base_filters)
        if not chart:
            return self.response_404()

        try:
            json_body = json.loads(chart.query_context)
        except (TypeError, json.decoder.JSONDecodeError):
            json_body = None

        if json_body is None:
            return self.response_400(
                message=_(
                    "Chart has no query context saved. Please save the chart again."
                )
            )

        # override saved query context
        json_body["result_format"] = request.args.get(
            "format", ChartDataResultFormat.JSON
        )
        json_body["result_type"] = request.args.get("type", ChartDataResultType.FULL)
        json_body["force"] = request.args.get("force")

        try:
            query_context = self._create_query_context_from_form(json_body)
            command = ChartDataCommand(query_context)
            command.validate()
        except DatasourceNotFound:
            return self.response_404()
        except QueryObjectValidationError as error:
            return self.response_400(message=error.message)
        except ValidationError as error:
            return self.response_400(
                message=_(
                    "Request is incorrect: %(error)s", error=error.normalized_messages()
                )
            )

        # TODO: support CSV, SQL query and other non-JSON types
        if (
            is_feature_enabled("GLOBAL_ASYNC_QUERIES")
            and query_context.result_format == ChartDataResultFormat.JSON
            and query_context.result_type == ChartDataResultType.FULL
        ):
            return self._run_async(json_body, command)

        try:
            form_data = json.loads(chart.params)
        except (TypeError, json.decoder.JSONDecodeError):
            form_data = {}

        return self._get_data_response(
            command=command, form_data=form_data, datasource=query_context.datasource
        )

    @expose("/data", methods=("POST",))
    @protect()
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.data",
        log_to_statsd=False,
    )
    def data(self) -> Response:
        """
        Take a query context constructed in the client and return payload
        data response for the given query
        ---
        post:
          summary: Return payload data response for the given query
          description: >-
            Takes a query context constructed in the client and returns payload data
            response for the given query.
          requestBody:
            description: >-
              A query context consists of a datasource from which to fetch data
              and one or many query objects.
            required: true
            content:
              application/json:
                schema:
                  $ref: "#/components/schemas/ChartDataQueryContextSchema"
          responses:
            200:
              description: Query result
              content:
                application/json:
                  schema:
                    $ref: "#/components/schemas/ChartDataResponseSchema"
            202:
              description: Async job details
              content:
                application/json:
                  schema:
                    $ref: "#/components/schemas/ChartDataAsyncResponseSchema"
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            500:
              $ref: '#/components/responses/500'
        """
        json_body = None
        if request.is_json:
            json_body = request.json
        elif request.form.get("form_data"):
            # CSV export submits regular form data
            with contextlib.suppress(TypeError, json.JSONDecodeError):
                json_body = json.loads(request.form["form_data"])
        if json_body is None:
            return self.response_400(message=_("Request is not JSON"))

        try:
            query_context = self._create_query_context_from_form(json_body)
            command = ChartDataCommand(query_context)
            command.validate()
        except DatasourceNotFound:
            return self.response_404()
        except QueryObjectValidationError as error:
            return self.response_400(message=error.message)
        except ValidationError as error:
            return self.response_400(
                message=_(
                    "Request is incorrect: %(error)s", error=error.normalized_messages()
                )
            )

        # TODO: support CSV, SQL query and other non-JSON types
        if (
            is_feature_enabled("GLOBAL_ASYNC_QUERIES")
            and query_context.result_format == ChartDataResultFormat.JSON
            and query_context.result_type == ChartDataResultType.FULL
        ):
            return self._run_async(json_body, command)

        form_data = json_body.get("form_data")
        return self._get_data_response(
            command, form_data=form_data, datasource=query_context.datasource
        )

    @expose("/check_selectors", methods=("POST",))
    # @protect()
    # @statsd_metrics
    # @event_logger.log_this_with_context(
    #     action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.data",
    #     log_to_statsd=False,
    # )
    @safe
    def check_selectors(self) -> FlaskResponse:
        """
        Получаем значения столбцов для заданных селекторов.
        ---
        post:
          summary: Check selectors and retrieve column values
          requestBody:
            required: true
            content:
              application/json:
                schema:
                  type: object
                  properties:
                    selectors:
                      type: array
                      items:
                        type: string
                      description: List of selectors (e.g., "Market", "100_Market", "Product", "Period")
                    rls_restriction:
                      type: object
                      properties:
                        column:
                          type: string
                          description: Column to filter by
                    datasource_id:
                      type: integer
                      description: Datasource ID (optional, overridden by predefined selector-specific datasource IDs)
                    datasource_type:
                      type: string
                      description: Type of the datasource (optional, overridden by predefined "table" datasource_type)
                  required: ["selectors", "rls_restriction"]
          responses:
            200:
              description: Values fetched for the selectors
            400:
              description: Invalid request, unsupported selector, missing parameters, invalid datasource type, or columns not found
            403:
              description: Permission denied
            404:
              description: Datasource not found
        """
        json_body = None
        if request.is_json:
            json_body = request.json
        selectors = json_body.get("selectors", [])

        if not selectors:
            return self.response(400, message="Missing selectors from request")

        if len(json_body.get("rls_restriction")) > 0:
            rls_restriction = json_body.get("rls_restriction")
        else:
            return self.response(400, message="Missing 'rls_restriction ' in check_selectors payload") # rls_restriction = {}
        
        available_values = []

        market_selectors = None # кэш для селекторов рынков
        product_selectors = None # кэш для селекторов продуктов

        for selector in selectors:
            columns = SELECTOR_COLUMNS.get(selector)
            if not columns:
                return self.response(400, message=f"Unsupported selector: {selector}")
            
            datasource = self._get_datasource_for_selectors(selector)
            if isinstance(datasource, dict):  # Error response
                return datasource

            denormalize_column = not datasource.normalize_columns

            try:
                if selector == "Period":
                    period_selector = datasource.generate_period_selector(
                        column_names=[col.upper() for col in columns],
                        denormalize_columns=denormalize_column,
                        rls_restriction=rls_restriction,
                    )
                    available_values.append(period_selector)
                elif selector == "Comparison_period":
                    comparison_period = datasource.generate_comparison_period_selector(
                        column_names=[col.upper() for col in columns],
                        denormalize_columns=denormalize_column,
                        rls_restriction=rls_restriction,
                    )
                    available_values.append(comparison_period)
                elif selector == "Market" or selector == "100_Market":
                    # если рынки и 100 рынков используют один и тот же источник данных
                    if SELECTOR_DATASOURCES.get("Market") == SELECTOR_DATASOURCES.get("100_Market"):
                        if market_selectors is None:
                            market_selector, market_100_selector = datasource.generate_market_selector(
                                column_names=[col.upper() for col in columns],
                                denormalize_columns=denormalize_column,
                                rls_restriction=rls_restriction,
                            )
                            market_selectors = (market_selector, market_100_selector)
                        available_values.append(market_selectors[0] if selector == "Market" else market_selectors[1])
                    # если рынки и 100 рынков используют разные источники данных
                    else:
                        market_selector, market_100_selector = datasource.generate_market_selector(
                            column_names=[col.upper() for col in columns],
                            denormalize_columns=denormalize_column,
                            rls_restriction=rls_restriction,
                        )
                        available_values.append(market_selector if selector == "Market" else market_100_selector)
                elif selector == "Product" or selector == "100_Product":
                    # если продукты и 100 продуктов используют один и тот же источник данных
                    if SELECTOR_DATASOURCES.get("Product") == SELECTOR_DATASOURCES.get("100_Product"):
                        if product_selectors is None:
                            product_selector, product_100_selector = datasource.generate_product_selector(
                                column_names=[col.upper() for col in columns],
                                denormalize_columns=denormalize_column,
                                rls_restriction=rls_restriction,
                            )
                            product_selectors = (product_selector, product_100_selector)
                        available_values.append(product_selectors[0] if selector == "Product" else product_selectors[1])
                    # если продукты и 100 продуктов используют разные источники данных
                    else:
                        product_selector, product_100_selector = datasource.generate_product_selector(
                            column_names=[col.upper() for col in columns],
                            denormalize_columns=denormalize_column,
                            rls_restriction=rls_restriction,
                        )
                        available_values.append(product_selector if selector == "Product" else product_100_selector)
            except ValueError as ex:
                return self.response(400, message=str(ex))
            except KeyError:
                return self.response(400, message=f"Columns {columns} do not exist for selector {selector}")

        return self.response(200, selectors=list(available_values))
    
    @expose("/raiting", methods=("POST",))
    @safe
    def raiting(self) -> FlaskResponse:
        """
        Получаем рейтинг продуктов по заданным параметрам.
        ---
        post:
          summary: Product rating according to specified parameters
          requestBody:
            required: true
            content:
              application/json:
                schema:
                  type: object
                  properties:
                    count_product:
                      type: integer
                      description: Number of products to return
                    fact:
                      type: string
                      description: Sales metric - money/box/kg ('money' | 'box' | 'kgl')
                    indicator:
                      type: string
                      description: Sorting type - best/worst ('best' | 'worst')
                    selected_market:
                      type: string
                      description: Selected market
                    selected_period:
                      type: string
                      description: Selected period
                    selected_product_hierarchy:
                      type: array
                      items:
                        type: string
                      description: Selected product hierarchies
                    rls_restriction:
                      type: object
                      properties:
                        column:
                          type: string
                          description: Column to filter RLS
                        value:
                          type: integer
                          description: Value to filter RLS
                  required: ["count_product", "fact", "indicator", "selected_market", "selected_period", "selected_product_hierarchy", "rls_restriction"]
          responses:
            200:
              description: Values fetched for the selectors
            400:
              description: Invalid request, unsupported selector, missing parameters, invalid datasource type, or columns not found
            403:
              description: Permission denied
            404:
              description: Datasource not found
        """
        json_body = None
        if request.is_json:
            json_body = request.json
        else:
            return self.response(400, message="Invalid request: JSON body required")

        # Проверка обязательных параметров
        required_fields = ["count_product", "fact", "indicator", "selected_market", "selected_period", "selected_product_hierarchy", "rls_restriction"]
        for field in required_fields:
            if field not in json_body or json_body[field] in (None, "", []):
                return self.response(400, message=f"Missing required field: {field}")

        rls_restriction = json_body.get("rls_restriction", {})
        if rls_restriction:
            if "column" not in rls_restriction:
                return self.response(400, message="Missing 'column' in rls_restriction")
            if "value" not in rls_restriction:
                return self.response(400, message="Missing 'value' in rls_restriction")
        
        count_product = int(json_body["count_product"])
        fact = json_body["fact"]
        indicator = json_body["indicator"]
        selected_market = json_body["selected_market"]
        selected_period = json_body["selected_period"]
        selected_product_hierarchy = json_body["selected_product_hierarchy"]

        # Проверка допустимых значений для fact и indicator
        allowed_fact = {"money", "box", "kgl"}
        allowed_indicator = {"best", "worst"}
        if fact not in allowed_fact:
            return self.response(400, message=f"Invalid value for 'fact': {fact}. Allowed values: {', '.join(allowed_fact)}")
        if indicator not in allowed_indicator:
            return self.response(400, message=f"Invalid value for 'indicator': {indicator}. Allowed values: {', '.join(allowed_indicator)}")

        # продукты
        # columns_product = SELECTOR_COLUMNS.get("Product")
        # if not columns_product:
        #     return self.response(400, message=f"Unsupported selector: Product")
        # datasource_id_product = SELECTOR_DATASOURCES.get("Product")
        # if not datasource_id_product:
        #     return self.response(400, message=f"Missing datasource_id_product for selector: Product")
        # datasource_type_product = DATASOURCE_TYPE
        # if not datasource_type_product:
        #     return self.response(400, message=f"Missing datasource_type_product for selector: Product")
        # try:
        #     datasource_product = DatasourceDAO.get_datasource(
        #         DatasourceType(datasource_type_product), datasource_id_product
        #     )
        #     datasource_product.raise_for_access()
        # except ValueError:
        #     return self.response(400, message=f"Invalid datasource type: {datasource_type_product}")
        # except (DatasourceTypeNotSupportedError, DatasourceNotFound) as ex:
        #     return self.response(404, message=f"Missing datasource_id for selector: Product")
        # except SupersetSecurityException as ex:
        #     return self.response(403, message=ex.message)
        # denormalize_column_product = not datasource_product.normalize_columns
        # product_tag_for_raiting = datasource_product.generate_product_raiting(
        #   column_names=[col.upper() for col in columns_product],
        #   denormalize_columns=denormalize_column_product,
        #   rls_restriction=rls_restriction,
        # )


        # Датасет
        columns = TARGET_DATASOURCE_COLUMNS.get("TARGET")
        if not columns:
                return self.response(400, message=f"Required columns are missing in the target dataset")
        datasource_id = TARGET_DATASOURCE.get("TARGET")
        if not datasource_id:
            return self.response(400, message=f"Missing datasource_id for raiting: TARGET")
        datasource_type = DATASOURCE_TYPE
        datasource: Datasource | None
        try:
            datasource = DatasourceDAO.get_datasource(
                DatasourceType(datasource_type), datasource_id
            )
            datasource.raise_for_access()

        except ValueError:
            return self.response(400, message=f"Invalid datasource type: {datasource_type}")
        except (DatasourceTypeNotSupportedError, DatasourceNotFound) as ex:
            return self.response(404, message=f"Missing datasource_id for raiting")
        except SupersetSecurityException as ex:
            return self.response(403, message=ex.message)
        denormalize_column = not datasource.normalize_columns

        if selected_period not in PERIOD_MAPPING_SELECTOR:
            return self.response(400, message=f"Used unsupported period")
        if rls_restriction['column'] != 'order_id':
            return self.response(400,
                                 message=f"Wrong rls column {rls_restriction['column']}")

        period_list: list[str] = []
        try:
            per_ds = DatasourceDAO.get_datasource(
                DatasourceType.TABLE, SELECTOR_DATASOURCES['Period_order']
            )
            per_ds.raise_for_access()
            period_list = per_ds.get_period_tags_by_selected_value(
                selected_value=selected_period,
                order_id_filter=rls_restriction['value']
            )
        except (DatasourceTypeNotSupportedError, DatasourceNotFound) as ex:
            return self.response(404, message=f"Missing datasource_id for raiting")
        except SupersetSecurityException as ex:
            return self.response(403, message=ex.message)

        product_rating = datasource.generate_raiting_product(
            column_names=columns,
            count_product=count_product,                 
            fact=fact,                        
            indicator=indicator,               
            selected_market=selected_market,          
            selected_period=period_list,
            selected_product_hierarchy=selected_product_hierarchy, 
            rls_restriction=rls_restriction,
            denormalize_columns=denormalize_column
        )
        # для теста
        product_rating = product_rating if product_rating else []

        return self.response(200, result=product_rating)

    @expose("/generate_sql", methods=['POST',])
    @safe
    def generate_sql(self) -> FlaskResponse:
        """
        post:
          summary: Generate SQL based on selector values from form_data
          requestBody:
            required: true
            content:
              application/json:
                schema:
                  type: object
                  properties:
                    queries:
                      type: array
                      items:
                        type: object
                        properties:
                          selectors:
                            type: array
        """
        try:
            json_body = request.get_json(silent=True)
                
            if json_body is None:
                return self.response(400, message="Request is not JSON")
            
            queries = json_body.get("queries", [])

            queries = [queries] if isinstance(queries, dict) else queries
            if not isinstance(queries, list):
                raise ValueError(f"Unexpected queries type: {type(queries)}")
            
            if len(queries[0]["rls_restriction"]) > 0:
                rls_restriction = queries[0]["rls_restriction"]
            else:
                return self.response(400, message="Missing 'rls_restriction ' in generate_sql payload") 

            if rls_restriction["column"] != 'order_id':
                return self.response(400, message=f"Invalid RLS column: {rls_restriction['column']}")
            
            selector_filters = [{"col": rls_restriction["column"], "val": rls_restriction["value"]}]

            COLUMN_MAPPING = {
                "Period": PERIOD_COLUMN_NAME,
                "Market": MARKET_COLUMN,
                "Product": PRODUCT_COLUMN,
            }

            all_markets = []
            all_products = []
            all_periods = []
            period_list = []

            datasource = self._get_datasource_for_selectors("Period")
            if isinstance(datasource, dict): # Если ошибка, то возвращаем ошибку
                return datasource
            
            for query in queries:
                selectors = query.get("selectors", []) if query else []

                for selector in selectors:
                    selector_type = selector.get("type_selector")

                    if selector_type == "Period":
                        period_list = self._process_period_selector(selector, datasource, selector_filters)
                        if period_list and period_list != ['No selector']:
                            all_periods.extend(period_list)
                    elif selector_type == "Comparison Period":
                        comparison_period_list = self._process_comparison_period_selector(selector, datasource, period_list, selector_filters)
                        if comparison_period_list and comparison_period_list != ['No selector']:
                            all_periods.extend(comparison_period_list)
                    elif selector_type == "Market":
                        selected_markets = selector.get("selected_markets", [])
                        if selected_markets and selected_markets != ['No selector']:
                            all_markets.extend(selected_markets)
                    elif selector_type == "100_Market":
                        selected_markets_100 = selector.get("selected_markets_100", [])
                        if selected_markets_100 and selected_markets_100 != ['No selector']:
                            all_markets.extend(selected_markets_100)
                    elif selector_type == "Product":
                        selected_products = selector.get("selected_products", [])
                        if selected_products and selected_products != ['No selector']:
                            all_products.extend(flatten_and_unique(selected_products))
                    elif selector_type == "100_Product":
                        selected_products_100 = selector.get("selected_products_100", [])
                        if selected_products_100 and selected_products_100 != ['No selector']:
                            all_products.extend(flatten_and_unique(selected_products_100))
            
            table_ref = text("korus_superset_test_schema.datamart_postview")
            where_conditions = [
                column(rls_restriction["column"]) == bindparam('rls_value', rls_restriction["value"])
            ]
            
            self._add_filter_to_query('Period', all_periods, where_conditions, COLUMN_MAPPING)
            self._add_filter_to_query('Market', all_markets, where_conditions, COLUMN_MAPPING)
            self._add_filter_to_query('Product', all_products, where_conditions, COLUMN_MAPPING)

            query = select([text("*")]).select_from(table_ref).where(and_(*where_conditions))

            final_sql = str(query.compile(compile_kwargs={"literal_binds": True}))

            return self.response(
                    200, 
                    all_periods=all_periods,
                    all_markets=all_markets,
                    all_products=all_products,
                    final_sql=final_sql
                )
        except Exception as e:
            return self.response(500, message=f"Internal error: {str(e)}")
        
    def _get_datasource_for_selectors(self, selector: str):
        """Get and validate datasource - extracted to reduce repetition."""
        datasource_id = SELECTOR_DATASOURCES.get(selector)
        if not datasource_id:
            return self.response(400, message=f"Missing datasource_id for {selector} selector")
        
        datasource_type = DATASOURCE_TYPE
        if not datasource_type:
            return self.response(400, message=f"Missing datasource_type for {selector} selector")
        
        try:
            datasource = DatasourceDAO.get_datasource(
                DatasourceType(datasource_type), datasource_id
            )
            datasource.raise_for_access()
            return datasource
        except ValueError:
            return self.response(400, message=f"Invalid datasource type: {datasource_type}")
        except (DatasourceTypeNotSupportedError, DatasourceNotFound):
            return self.response(404, message="Datasource not found")
        except SupersetSecurityException as ex:
            return self.response(403, message=ex.message)
        
    @staticmethod
    def _process_period_selector(selector, datasource, selector_filters):
        selected_period = selector.get("selected_period")
        period_selector_type = selector.get("period_selector_type")
        if selected_period and selected_period != 'No selector':
            if period_selector_type == 'Predefined':
                if selected_period in PERIOD_MAPPING_SELECTOR:
                    return datasource.get_periods_by_selected_value(
                        selected_period=selected_period,
                        period_column_name=PERIOD_COLUMN_NAME.upper(),
                        selector_filters=selector_filters
                    )
            elif period_selector_type == 'Custom':
                return datasource.get_custom_periods_by_selected_value(
                    selected_period=selected_period,
                    period_column_name=PERIOD_COLUMN_NAME.upper(),
                    selector_filters=selector_filters
                )
            else:
                raise ValueError(f"Unexpected period selector type: {period_selector_type}")
        return [] 
            
    @staticmethod
    def _process_comparison_period_selector(selector, datasource, period_list, selector_filters):
        selected_comparison_period = selector.get("selected_comparison_period")
        comparison_period_selector_type = selector.get("comparison_period_selector_type")
        if selected_comparison_period != 'No selector':
            if comparison_period_selector_type == 'Predefined':
                if selected_comparison_period == COMPARISON_PERIOD_TYPES['ANALOGOUS']['value']:
                    return datasource.get_comparison_periods_year_analogous(
                        selected_periods=period_list,
                        period_column_name=PERIOD_COLUMN_NAME.upper(),
                        selector_filters=selector_filters
                    )
                elif selected_comparison_period == COMPARISON_PERIOD_TYPES['PREVIOUS']['value']:
                    return datasource.get_comparison_periods_previous(
                        selected_periods=period_list,
                        period_column_name=PERIOD_COLUMN_NAME.upper(),
                        selector_filters=selector_filters
                    )
            elif comparison_period_selector_type == 'Custom':
                return datasource.get_custom_periods_by_selected_value(
                    selected_period=selected_comparison_period,
                    period_column_name=PERIOD_COLUMN_NAME.upper(),
                    selector_filters=selector_filters
                )
            else:
                raise ValueError(f"Unexpected comparison period selector type: {comparison_period_selector_type}")
        return []
    
    @staticmethod
    def _add_filter_to_query(column_name, values, where_conditions, column_mapping):
        if values:
            unique_values = list(set(values))
            where_conditions.append(
                column(column_mapping[column_name]).in_(bindparam(column_name.lower(), unique_values, expanding=True))
            )
            
    @expose("/data/<cache_key>", methods=("GET",))
    @protect()
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}"
        f".data_from_cache",
        log_to_statsd=False,
    )
    def data_from_cache(self, cache_key: str) -> Response:
        """
        Take a query context cache key and return payload
        data response for the given query.
        ---
        get:
          summary: Return payload data response for the given query
          description: >-
            Takes a query context cache key and returns payload data
            response for the given query.
          parameters:
          - in: path
            schema:
              type: string
            name: cache_key
          responses:
            200:
              description: Query result
              content:
                application/json:
                  schema:
                    $ref: "#/components/schemas/ChartDataResponseSchema"
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            404:
              $ref: '#/components/responses/404'
            422:
              $ref: '#/components/responses/422'
            500:
              $ref: '#/components/responses/500'
        """
        try:
            cached_data = self._load_query_context_form_from_cache(cache_key)
            # Set form_data in Flask Global as it is used as a fallback
            # for async queries with jinja context
            setattr(g, "form_data", cached_data)
            query_context = self._create_query_context_from_form(cached_data)
            command = ChartDataCommand(query_context)
            command.validate()
        except ChartDataCacheLoadError:
            return self.response_404()
        except ValidationError as error:
            return self.response_400(
                message=_("Request is incorrect: %(error)s", error=error.messages)
            )

        return self._get_data_response(command, True)

    def _run_async(
        self, form_data: dict[str, Any], command: ChartDataCommand
    ) -> Response:
        """
        Execute command as an async query.
        """
        # First, look for the chart query results in the cache.
        with contextlib.suppress(ChartDataCacheLoadError):
            result = command.run(force_cached=True)
            if result is not None:
                return self._send_chart_response(result)
        # Otherwise, kick off a background job to run the chart query.
        # Clients will either poll or be notified of query completion,
        # at which point they will call the /data/<cache_key> endpoint
        # to retrieve the results.
        async_command = CreateAsyncChartDataJobCommand()
        try:
            async_command.validate(request)
        except AsyncQueryTokenException:
            return self.response_401()

        result = async_command.run(form_data, get_user_id())
        return self.response(202, **result)

    def _send_chart_response(
        self,
        result: dict[Any, Any],
        form_data: dict[str, Any] | None = None,
        datasource: BaseDatasource | Query | None = None,
    ) -> Response:
        result_type = result["query_context"].result_type
        result_format = result["query_context"].result_format

        # Post-process the data so it matches the data presented in the chart.
        # This is needed for sending reports based on text charts that do the
        # post-processing of data, eg, the pivot table.
        if result_type == ChartDataResultType.POST_PROCESSED:
            result = apply_post_process(result, form_data, datasource)

        if result_format in ChartDataResultFormat.table_like():
            # Verify user has permission to export file
            if not security_manager.can_access("can_csv", "Superset"):
                return self.response_403()

            if not result["queries"]:
                return self.response_400(_("Empty query result"))

            is_csv_format = result_format == ChartDataResultFormat.CSV

            if len(result["queries"]) == 1:
                # return single query results
                data = result["queries"][0]["data"]
                if is_csv_format:
                    return CsvResponse(data, headers=generate_download_headers("csv"))

                return XlsxResponse(data, headers=generate_download_headers("xlsx"))

            # return multi-query results bundled as a zip file
            def _process_data(query_data: Any) -> Any:
                if result_format == ChartDataResultFormat.CSV:
                    encoding = current_app.config["CSV_EXPORT"].get("encoding", "utf-8")
                    return query_data.encode(encoding)
                return query_data

            files = {
                f"query_{idx + 1}.{result_format}": _process_data(query["data"])
                for idx, query in enumerate(result["queries"])
            }
            return Response(
                create_zip(files),
                headers=generate_download_headers("zip"),
                mimetype="application/zip",
            )

        if result_format == ChartDataResultFormat.JSON:
            response_data = simplejson.dumps(
                {"result": result["queries"]},
                default=json_int_dttm_ser,
                ignore_nan=True,
            )
            resp = make_response(response_data, 200)
            resp.headers["Content-Type"] = "application/json; charset=utf-8"
            return resp

        return self.response_400(message=f"Unsupported result_format: {result_format}")

    def _get_data_response(
        self,
        command: ChartDataCommand,
        force_cached: bool = False,
        form_data: dict[str, Any] | None = None,
        datasource: BaseDatasource | Query | None = None,
    ) -> Response:
        try:
            result = command.run(force_cached=force_cached)
        except ChartDataCacheLoadError as exc:
            return self.response_422(message=exc.message)
        except ChartDataQueryFailedError as exc:
            return self.response_400(message=exc.message)

        return self._send_chart_response(result, form_data, datasource)

    # pylint: disable=invalid-name
    def _load_query_context_form_from_cache(self, cache_key: str) -> dict[str, Any]:
        return QueryContextCacheLoader.load(cache_key)

    def _map_form_data_datasource_to_dataset_id(
        self, form_data: dict[str, Any]
    ) -> dict[str, Any]:
        return {
            "dataset_id": form_data.get("datasource", {}).get("id")
            if isinstance(form_data.get("datasource"), dict)
            and form_data.get("datasource", {}).get("type")
            == DatasourceType.TABLE.value
            else None,
            "slice_id": form_data.get("form_data", {}).get("slice_id"),
        }

    @logs_context(context_func=_map_form_data_datasource_to_dataset_id)
    def _create_query_context_from_form(
        self, form_data: dict[str, Any]
    ) -> QueryContext:
        try:
            return ChartDataQueryContextSchema().load(form_data)
        except KeyError as ex:
            raise ValidationError("Request is incorrect") from ex
        except ValidationError as error:
            raise error
