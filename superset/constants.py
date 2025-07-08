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

# ATTENTION: If you change any constants, make sure to also change utils/common.js

# string to use when None values *need* to be converted to/from strings
from enum import Enum

from superset.utils.backports import StrEnum

USER_AGENT = "Apache Superset"

NULL_STRING = "<NULL>"
EMPTY_STRING = "<empty string>"

CHANGE_ME_SECRET_KEY = "CHANGE_ME_TO_A_COMPLEX_RANDOM_SECRET"

# UUID for the examples database
EXAMPLES_DB_UUID = "a2dc77af-e654-49bb-b321-40f6b559a1ee"

PASSWORD_MASK = "X" * 10

NO_TIME_RANGE = "No filter"

QUERY_CANCEL_KEY = "cancel_query"
QUERY_EARLY_CANCEL_KEY = "early_cancel_query"

LRU_CACHE_MAX_SIZE = 256


class RouteMethod:  # pylint: disable=too-few-public-methods
    """
    Route methods are a FAB concept around ModelView and RestModelView
    classes in FAB. Derivatives can define `include_route_method` and
    `exclude_route_methods` class attribute as a set of methods that
    will or won't get exposed.

    This class is a collection of static constants to reference common
    route methods, namely the ones defined in the base classes in FAB
    """

    # ModelView specific
    ACTION = "action"
    ACTION_POST = "action_post"
    ADD = "add"
    API_CREATE = "api_create"
    API_DELETE = "api_delete"
    API_GET = "api_get"
    API_READ = "api_read"
    API_UPDATE = "api_update"
    DELETE = "delete"
    DOWNLOAD = "download"
    EDIT = "edit"
    LIST = "list"
    SHOW = "show"
    INFO = "info"

    # RestModelView specific
    EXPORT = "export"
    IMPORT = "import_"
    GET = "get"
    GET_LIST = "get_list"
    POST = "post"
    PUT = "put"
    RELATED = "related"
    DISTINCT = "distinct"

    # Commonly used sets
    API_SET = {API_CREATE, API_DELETE, API_GET, API_READ, API_UPDATE}
    CRUD_SET = {ADD, LIST, EDIT, DELETE, ACTION_POST, SHOW}
    RELATED_VIEW_SET = {ADD, LIST, EDIT, DELETE}
    REST_MODEL_VIEW_CRUD_SET = {DELETE, GET, GET_LIST, POST, PUT, INFO}


MODEL_VIEW_RW_METHOD_PERMISSION_MAP = {
    "add": "write",
    "api": "read",
    "api_column_add": "write",
    "api_column_edit": "write",
    "api_create": "write",
    "api_delete": "write",
    "api_get": "read",
    "api_read": "read",
    "api_readvalues": "read",
    "api_update": "write",
    "annotation": "read",
    "delete": "write",
    "download": "read",
    "download_dashboards": "read",
    "edit": "write",
    "list": "read",
    "muldelete": "write",
    "mulexport": "read",
    "show": "read",
    "new": "write",
    "yaml_export": "read",
    "refresh": "write",
}

MODEL_API_RW_METHOD_PERMISSION_MAP = {
    "bulk_delete": "write",
    "delete": "write",
    "distinct": "read",
    "get": "read",
    "get_list": "read",
    "info": "read",
    "post": "write",
    "put": "write",
    "related": "read",
    "related_objects": "read",
    "tables": "read",
    "schemas": "read",
    "select_star": "read",
    "table_metadata": "read",
    "table_extra_metadata": "read",
    "test_connection": "write",
    "validate_parameters": "write",
    "favorite_status": "read",
    "add_favorite": "read",
    "remove_favorite": "read",
    "thumbnail": "read",
    "import_": "write",
    "refresh": "write",
    "cache_screenshot": "read",
    "screenshot": "read",
    "data": "read",
    "data_from_cache": "read",
    "get_charts": "read",
    "get_datasets": "read",
    "function_names": "read",
    "available": "read",
    "validate_sql": "read",
    "get_data": "read",
    "samples": "read",
    "delete_ssh_tunnel": "write",
    "get_updated_since": "read",
    "stop_query": "read",
    "get_user_slices": "read",
    "schemas_access_for_file_upload": "read",
    "get_objects": "read",
    "get_all_objects": "read",
    "add_objects": "write",
    "delete_object": "write",
    "copy_dash": "write",
    "get_connection": "write",
}

EXTRA_FORM_DATA_APPEND_KEYS = {
    "adhoc_filters",
    "filters",
    "interactive_groupby",
    "interactive_highlight",
    "interactive_drilldown",
    "custom_form_data",
}

EXTRA_FORM_DATA_OVERRIDE_REGULAR_MAPPINGS = {
    "granularity_sqla": "granularity",
    "time_column": "time_column",
    "time_grain": "time_grain",
    "time_range": "time_range",
    "time_grain_sqla": "time_grain_sqla",
}

EXTRA_FORM_DATA_OVERRIDE_EXTRA_KEYS = {
    "relative_start",
    "relative_end",
}

EXTRA_FORM_DATA_OVERRIDE_KEYS = (
    set(EXTRA_FORM_DATA_OVERRIDE_REGULAR_MAPPINGS.values())
    | EXTRA_FORM_DATA_OVERRIDE_EXTRA_KEYS
)

PERIOD_MAPPING_SELECTOR = {
            "last_month": {"period_type": "month", "period_count": 1},
            "last_3_month": {"period_type": "month", "period_count": 3},
            "last_6_month": {"period_type": "month", "period_count": 6},
            "last_12_month": {"period_type": "month", "period_count": 12},
            "YTD_month": {"period_type": "YTD", "period_count": None},
            "last_week": {"period_type": "week", "period_count": 1},
            "last_4_week": {"period_type": "week", "period_count": 4},
            "last_5_week": {"period_type": "week", "period_count": 5},
            "last_12_week": {"period_type": "week", "period_count": 12},
            "last_26_week": {"period_type": "week", "period_count": 26},
            "last_52_week": {"period_type": "week", "period_count": 52},
            "YTD_week": {"period_type": "YTD", "period_count": None},
        }

MONTH_MAP = {
        'January': '01', 'February': '02', 'March': '03', 'April': '04', 
        'May': '05', 'June': '06', 'July': '07', 'August': '08', 
        'September': '09', 'October': '10', 'November': '11', 'December': '12'
    }

PERIOD_DEFINITIONS = {
        "last_month": {"label": "Последний месяц", "offset": 0, "unit": "months"},
        "last_3_month": {"label": "Последние 3 месяца", "offset": 2, "unit": "months"},
        "last_6_month": {"label": "Последние 6 месяцев", "offset": 5, "unit": "months"},
        "last_12_month": {"label": "Последние 12 месяцев", "offset": 11, "unit": "months"},
        "YTD_month": {"label": "YTD", "offset": None, "unit": "months"},
        "last_week": {"label": "Последняя неделя", "offset": 0, "unit": "weeks"},
        "last_4_week": {"label": "Последние 4 недели", "offset": 3, "unit": "weeks"},
        "last_5_week": {"label": "Последние 5 недель", "offset": 4, "unit": "weeks"},
        "last_12_week": {"label": "Последние 12 недель", "offset": 11, "unit": "weeks"},
        "last_26_week": {"label": "Последние 26 недель", "offset": 25, "unit": "weeks"},
        "last_52_week": {"label": "Последние 52 недели", "offset": 51, "unit": "weeks"},
        "YTD_week": {"label": "YTD", "offset": None, "unit": "weeks"},
    }

COMPARISON_PERIOD_DEFINITIONS_M = {
            "last_month": 0,
            "last_3_month": 2,
            "last_6_month": 5,
            "last_12_month": 11,
            "YTD": "YTD"
    }

COMPARISON_PERIOD_DEFINITIONS_W = {
                "last_week":  0,
                "last_4_week": 3,
                "last_5_week": 4,
                "last_12_week": 11,
                "last_26_week": 25,
                "last_52_week": 51,
                "YTD": "YTD"
        }

COMPARISON_PERIOD_TYPES = {
            'ANALOGOUS': {
                'value': 'analogous_period_last_year',
                'label': 'Аналогичный период прошлого года'
            },
            'PREVIOUS': {
                'value': 'previous_period',
                'label': 'Предыдущий период'
            }
    }

FACTS_COLUMNS_MAPPING = {
    "money": "V",
    "box": "U",
    "kgl": "E",
}

SELECTOR_COLUMNS = {
        "Period_order": ["per_tag"],
        "Period_order names": ["per_name"],
        "Period": ["per_name", "per_tag", "order_id"],
        "Market": ["mkt_tag", "mkt_name", "mkt_level", "mkt_parent_tag", "mkt_display_order", "order_id"],
        "100_Market": ["mkt_tag", "mkt_name", "mkt_level", "mkt_parent_tag", "mkt_display_order", "order_id"],
        "Product": ["prod_tag", "prod_name","prod_level", "prod_level_name", "prod_parent_tag", "prod_display_order", "order_id"],
        "100_Product": ["prod_tag", "prod_name","prod_level", "prod_level_name", "prod_parent_tag", "prod_display_order", "order_id"],
        "Comparison_period": ["per_name", "per_tag", "order_id"]
    } # из каких колонок будет формироваться информация для эиндопинта /check_selectors

TARGET_DATASOURCE_COLUMNS = {
    "TARGET": ["prod_tag","fulldesc"],
    "RATED": ["U","E","V"],
    "FILTERS": ["order_id","per_tag","mkt_tag"]
} # для рейтинга продуктов

SELECTOR_DATASOURCES = {
            "Period_order": 147,
            "Period": 12,
            "Comparison_period": 12,
            "Product": 54,
            "100_Product": 54,
            "Market": 11,
            "100_Market": 11
    } # datasource_id, которые будут использоваться для селекторов эндопинта /check_selectors

TARGET_DATASOURCE = {
    "TARGET": 122
} # общая таблица (datamart_postview), содержащя все данные (периоды, продукты, маркеты, факты)

BASE_FACTS = ['U', 'V', 'E', 'SGV_UNIV', 'SGV_CUM'] # базовые факты, которые будут использоваться для формирования запроса base_req для JSON датасета

PERIOD_COLUMN_NAME = "per_name" # колонка с именем периода
PER_TAG_COLUMN = "PER_TAG" # колонка с идентификаторами периода
MARKET_COLUMN = "mkt_tag" # колонка названием рынков
PRODUCT_COLUMN = "prod_tag" # колонка названием рынков
NO_SELECTOR = "No selector" # состояние селектора - не выбранно
SQL_RULE_COLUMN = "calc_rule_sql" # колонка для селектора факта содержащая формулу SQL для замены
ID_COLUMN = "id" # айди строки для целевого факта
TARGET_COLUMN_FOR_RULE = "ext_code" # колонка из внешнего источника, к которой мы применяем SQL формулу SQL_RULE_COLUMN (селектор фактов)
MKT_NAME_COLUMN = "MKT_NAME" # колонка с именем рынка
PROD_NAME_COLUMN = "PROD_NAME" # колонка с именем продукта
PROD_LEVEL_NAME_COLUMN = "PROD_LEVEL_NAME" # колонка с именем продукта
MKT_DISPLAY_ORDER_COLUMN = "MKT_DISPLAY_ORDER" # колонка с порядком сортировки рынков
PROD_DISPLAY_ORDER_COLUMN = "PROD_DISPLAY_ORDER" # колонка с порядком сортировки продуктов
ANALOGOUS_PERIOD_MONTHS = 12 # количество месяцев для аналогичного периода
ANALOGOUS_PERIOD_WEEKS = 52 # количество недель для аналогичного периода
DATASOURCE_TYPE = "table" # тип источника данных
JSON_PREFIX = "json:" # префикс для JSON датасетов
JSON_TABLE_NAME = "korus_superset_test_schema.datamart_postview" # название таблицы в JSON датасете
FACT_ID_PREFIX = "fact_" # префикс для фактов в JSON датасете

EXCEL_EXPORT_PERIOD_COL_NAME = "per_short_name"
PERIOD_DATASET_ID = 130
PERIOD_DATASET_TYPE = "table"

CHART_PREVIEW_DATA = {MARKET_COLUMN:  ["M000000000000000732600000000000001594285"], 
                      PRODUCT_COLUMN: ["P000000000000917416200000000015464272892",
                                       "P000000000000631802200000000015561999487",
                                       "P000000000000917416200000000015464267779"],
                      "selected_markets_100": ['M000000000000109278900000000000001410484'],
                      "selected_products_100": ["P000000000000668908100000000010641914974"],
                      "selected_periods": ['W 2024 01', 'W 2024 02', 'W 2024 03', 'W 2024 04', 'W 2024 05', 'W 2024 06', 'W 2024 07', 'W 2024 08', 'W 2024 09', 'W 2024 10', 'W 2024 11', 'W 2024 12', 'W 2024 13', 'W 2024 14', 'W 2024 15', 'W 2024 16', 'W 2024 17', 'W 2024 18', 'W 2024 19', 'W 2024 20', 'W 2024 21', 'W 2024 22', 'W 2024 23', 'W 2024 24', 'W 2024 25'],
                      "selected_comparison_periods": ['W 2023 01', 'W 2023 02', 'W 2023 03', 'W 2023 04', 'W 2023 05', 'W 2023 06', 'W 2023 07', 'W 2023 08', 'W 2023 09', 'W 2023 10', 'W 2023 11', 'W 2023 12', 'W 2023 13', 'W 2023 14', 'W 2023 15', 'W 2023 16', 'W 2023 17', 'W 2023 18', 'W 2023 19', 'W 2023 20', 'W 2023 21', 'W 2023 22', 'W 2023 23', 'W 2023 24', 'W 2023 25']
                    }

class TimeGrain(StrEnum):
    SECOND = "PT1S"
    FIVE_SECONDS = "PT5S"
    THIRTY_SECONDS = "PT30S"
    MINUTE = "PT1M"
    FIVE_MINUTES = "PT5M"
    TEN_MINUTES = "PT10M"
    FIFTEEN_MINUTES = "PT15M"
    THIRTY_MINUTES = "PT30M"
    HALF_HOUR = "PT0.5H"
    HOUR = "PT1H"
    SIX_HOURS = "PT6H"
    DAY = "P1D"
    WEEK = "P1W"
    WEEK_STARTING_SUNDAY = "1969-12-28T00:00:00Z/P1W"
    WEEK_STARTING_MONDAY = "1969-12-29T00:00:00Z/P1W"
    WEEK_ENDING_SATURDAY = "P1W/1970-01-03T00:00:00Z"
    WEEK_ENDING_SUNDAY = "P1W/1970-01-04T00:00:00Z"
    MONTH = "P1M"
    QUARTER = "P3M"
    QUARTER_YEAR = "P0.25Y"
    YEAR = "P1Y"


class PandasAxis(int, Enum):
    ROW = 0
    COLUMN = 1


class PandasPostprocessingCompare(StrEnum):
    DIFF = "difference"
    PCT = "percentage"
    RAT = "ratio"


class CacheRegion(StrEnum):
    DEFAULT = "default"
    DATA = "data"
    THUMBNAIL = "thumbnail"
