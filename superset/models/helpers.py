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
# pylint: disable=too-many-lines
"""a collection of model-related helper classes and functions"""
import builtins
import dataclasses
import json
import logging
import re
import uuid
from collections import defaultdict
from collections.abc import Hashable
from datetime import datetime, timedelta
from json.decoder import JSONDecodeError
from typing import Any, cast, NamedTuple, Optional, TYPE_CHECKING, Union
from dateutil.relativedelta import relativedelta

import dateutil.parser
import humanize
import numpy as np
import pandas as pd
import pytz
import sqlalchemy as sa
import sqlparse
import yaml
from flask import escape, g, Markup
from flask_appbuilder import Model
from flask_appbuilder.models.decorators import renders
from flask_appbuilder.models.mixins import AuditMixin
from flask_appbuilder.security.sqla.models import User
from flask_babel import lazy_gettext as _
from jinja2.exceptions import TemplateError
from sqlalchemy import and_, Column, or_, UniqueConstraint, column
from sqlalchemy.exc import MultipleResultsFound
from sqlalchemy.ext.declarative import declared_attr
from sqlalchemy.orm import Mapper, validates
from sqlalchemy.sql.elements import ColumnElement, literal_column, TextClause, \
    ColumnClause
from sqlalchemy.sql.expression import Label, Select, TextAsFrom
from sqlalchemy.sql.selectable import Alias, TableClause
from sqlalchemy_utils import UUIDType

from superset import app, db, is_feature_enabled, security_manager
from superset.advanced_data_type.types import AdvancedDataTypeResponse
from superset.common.db_query_status import QueryStatus
from superset.common.utils.time_range_utils import get_since_until_from_time_range
from superset.constants import (
    EMPTY_STRING,
    NULL_STRING,
    PERIOD_DEFINITIONS,
    NO_SELECTOR,
    SELECTOR_COLUMNS,
    PERIOD_MAPPING_SELECTOR,
    COMPARISON_PERIOD_DEFINITIONS_M,
    COMPARISON_PERIOD_DEFINITIONS_W,
    COMPARISON_PERIOD_TYPES,
    PERIOD_COLUMN_NAME,
    MARKET_COLUMN,
    PRODUCT_COLUMN,
    SQL_RULE_COLUMN,
    ID_COLUMN,
    TARGET_COLUMN_FOR_RULE,
    MKT_NAME_COLUMN,
    PROD_NAME_COLUMN,
    PROD_LEVEL_NAME_COLUMN,
    MKT_DISPLAY_ORDER_COLUMN,
    PROD_DISPLAY_ORDER_COLUMN,
    ANALOGOUS_PERIOD_MONTHS,
    ANALOGOUS_PERIOD_WEEKS,
    PER_TAG_COLUMN,
    MONTH_MAP,
    FACTS_COLUMNS_MAPPING, TARGET_DATASOURCE_COLUMNS
)
from superset.utils.core import apply_max_row_limit, DatasourceType
from superset.db_engine_specs.base import TimestampExpression
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import (
    AdvancedDataTypeResponseError,
    ColumnNotFoundException,
    QueryClauseValidationException,
    QueryObjectValidationError,
    SupersetSecurityException,
)
from superset.extensions import feature_flag_manager
from superset.jinja_context import BaseTemplateProcessor
from superset.sql_parse import (
    has_table_query,
    insert_rls_in_predicate,
    ParsedQuery,
    sanitize_clause,
)
from superset.superset_typing import (
    AdhocMetric,
    Column as ColumnTyping,
    FilterValue,
    FilterValues,
    Metric,
    OrderBy,
    QueryObjectDict,
)
from superset.utils import core as utils
from superset.utils.core import (
    GenericDataType,
    get_column_name,
    get_non_base_axis_columns,
    get_user_id,
    is_adhoc_column,
    MediumText,
    remove_duplicates,
    flatten_and_unique,
)
from superset.utils.dates import datetime_to_epoch

if TYPE_CHECKING:
    from superset.connectors.sqla.models import SqlMetric, TableColumn
    from superset.db_engine_specs import BaseEngineSpec
    from superset.models.core import Database, Engine


config = app.config
logger = logging.getLogger(__name__)

VIRTUAL_TABLE_ALIAS = "virtual_table"
SERIES_LIMIT_SUBQ_ALIAS = "series_limit"
ADVANCED_DATA_TYPES = config["ADVANCED_DATA_TYPES"]


def validate_adhoc_subquery(
    sql: str,
    database_id: int,
    default_schema: str,
) -> str:
    """
    Check if adhoc SQL contains sub-queries or nested sub-queries with table.

    If sub-queries are allowed, the adhoc SQL is modified to insert any applicable RLS
    predicates to it.

    :param sql: adhoc sql expression
    :raise SupersetSecurityException if sql contains sub-queries or
    nested sub-queries with table
    """
    statements = []
    for statement in sqlparse.parse(sql):
        if has_table_query(statement):
            if not is_feature_enabled("ALLOW_ADHOC_SUBQUERY"):
                raise SupersetSecurityException(
                    SupersetError(
                        error_type=SupersetErrorType.ADHOC_SUBQUERY_NOT_ALLOWED_ERROR,
                        message=_("Custom SQL fields cannot contain sub-queries."),
                        level=ErrorLevel.ERROR,
                    )
                )
            statement = insert_rls_in_predicate(statement, database_id, default_schema)
        statements.append(statement)

    return ";\n".join(str(statement) for statement in statements)


def json_to_dict(json_str: str) -> dict[Any, Any]:
    if json_str:
        val = re.sub(",[ \t\r\n]+}", "}", json_str)
        val = re.sub(",[ \t\r\n]+\\]", "]", val)
        return json.loads(val)

    return {}


def convert_uuids(obj: Any) -> Any:
    """
    Convert UUID objects to str so we can use yaml.safe_dump
    """
    if isinstance(obj, uuid.UUID):
        return str(obj)

    if isinstance(obj, list):
        return [convert_uuids(el) for el in obj]

    if isinstance(obj, dict):
        return {k: convert_uuids(v) for k, v in obj.items()}

    return obj


class ImportExportMixin:
    uuid = sa.Column(
        UUIDType(binary=True), primary_key=False, unique=True, default=uuid.uuid4
    )

    export_parent: Optional[str] = None
    # The name of the attribute
    # with the SQL Alchemy back reference

    export_children: list[str] = []
    # List of (str) names of attributes
    # with the SQL Alchemy forward references

    export_fields: list[str] = []
    # The names of the attributes
    # that are available for import and export

    extra_import_fields: list[str] = []
    # Additional fields that should be imported,
    # even though they were not exported

    __mapper__: Mapper

    @classmethod
    def _unique_constraints(cls) -> list[set[str]]:
        """Get all (single column and multi column) unique constraints"""
        unique = [
            {c.name for c in u.columns}
            for u in cls.__table_args__  # type: ignore
            if isinstance(u, UniqueConstraint)
        ]
        unique.extend(
            {c.name} for c in cls.__table__.columns if c.unique  # type: ignore
        )
        return unique

    @classmethod
    def parent_foreign_key_mappings(cls) -> dict[str, str]:
        """Get a mapping of foreign name to the local name of foreign keys"""
        parent_rel = cls.__mapper__.relationships.get(cls.export_parent)
        if parent_rel:
            return {l.name: r.name for (l, r) in parent_rel.local_remote_pairs}
        return {}

    @classmethod
    def export_schema(
        cls, recursive: bool = True, include_parent_ref: bool = False
    ) -> dict[str, Any]:
        """Export schema as a dictionary"""
        parent_excludes = set()
        if not include_parent_ref:
            parent_ref = cls.__mapper__.relationships.get(cls.export_parent)
            if parent_ref:
                parent_excludes = {column.name for column in parent_ref.local_columns}

        def formatter(column: sa.Column) -> str:
            return (
                f"{str(column.type)} Default ({column.default.arg})"
                if column.default
                else str(column.type)
            )

        schema: dict[str, Any] = {
            column.name: formatter(column)
            for column in cls.__table__.columns  # type: ignore
            if (column.name in cls.export_fields and column.name not in parent_excludes)
        }
        if recursive:
            for column in cls.export_children:
                child_class = cls.__mapper__.relationships[column].argument.class_
                schema[column] = [
                    child_class.export_schema(
                        recursive=recursive, include_parent_ref=include_parent_ref
                    )
                ]
        return schema

    @classmethod
    def import_from_dict(
        # pylint: disable=too-many-arguments,too-many-branches,too-many-locals
        cls,
        dict_rep: dict[Any, Any],
        parent: Optional[Any] = None,
        recursive: bool = True,
        sync: Optional[list[str]] = None,
        allow_reparenting: bool = False,
    ) -> Any:
        """Import obj from a dictionary"""
        if sync is None:
            sync = []
        parent_refs = cls.parent_foreign_key_mappings()
        export_fields = (
            set(cls.export_fields)
            | set(cls.extra_import_fields)
            | set(parent_refs.keys())
            | {"uuid"}
        )
        new_children = {c: dict_rep[c] for c in cls.export_children if c in dict_rep}
        unique_constraints = cls._unique_constraints()

        filters = []  # Using these filters to check if obj already exists

        # Remove fields that should not get imported
        for k in list(dict_rep):
            if k not in export_fields and k not in parent_refs:
                del dict_rep[k]

        if not parent:
            if cls.export_parent:
                for prnt in parent_refs.keys():
                    if prnt not in dict_rep:
                        raise RuntimeError(f"{cls.__name__}: Missing field {prnt}")
        else:
            # Set foreign keys to parent obj
            for k, v in parent_refs.items():
                dict_rep[k] = getattr(parent, v)

        if not allow_reparenting:
            # Add filter for parent obj
            filters.extend(
                [getattr(cls, k) == dict_rep.get(k) for k in parent_refs.keys()]
            )

        # Add filter for unique constraints
        ucs = [
            and_(
                *[
                    getattr(cls, k) == dict_rep.get(k)
                    for k in cs
                    if dict_rep.get(k) is not None
                ]
            )
            for cs in unique_constraints
        ]
        filters.append(or_(*ucs))

        # Check if object already exists in DB, break if more than one is found
        try:
            obj_query = db.session.query(cls).filter(and_(*filters))
            obj = obj_query.one_or_none()
        except MultipleResultsFound as ex:
            logger.error(
                "Error importing %s \n %s \n %s",
                cls.__name__,
                str(obj_query),
                yaml.safe_dump(dict_rep),
                exc_info=True,
            )
            raise ex

        if not obj:
            is_new_obj = True
            # Create new DB object
            obj = cls(**dict_rep)
            logger.info("Importing new %s %s", obj.__tablename__, str(obj))
            if cls.export_parent and parent:
                setattr(obj, cls.export_parent, parent)
            db.session.add(obj)
        else:
            is_new_obj = False
            logger.info("Updating %s %s", obj.__tablename__, str(obj))
            # Update columns
            for k, v in dict_rep.items():
                setattr(obj, k, v)

        # Recursively create children
        if recursive:
            for child in cls.export_children:
                argument = cls.__mapper__.relationships[child].argument
                child_class = (
                    argument.class_ if hasattr(argument, "class_") else argument
                )
                added = []
                for c_obj in new_children.get(child, []):
                    added.append(
                        child_class.import_from_dict(
                            dict_rep=c_obj, parent=obj, sync=sync
                        )
                    )
                # If children should get synced, delete the ones that did not
                # get updated.
                if child in sync and not is_new_obj:
                    back_refs = child_class.parent_foreign_key_mappings()
                    delete_filters = [
                        getattr(child_class, k) == getattr(obj, back_refs.get(k))
                        for k in back_refs.keys()
                    ]
                    to_delete = set(
                        db.session.query(child_class).filter(and_(*delete_filters))
                    ).difference(set(added))
                    for o in to_delete:
                        logger.info("Deleting %s %s", child, str(obj))
                        db.session.delete(o)

        return obj

    def export_to_dict(
        self,
        recursive: bool = True,
        include_parent_ref: bool = False,
        include_defaults: bool = False,
        export_uuids: bool = False,
    ) -> dict[Any, Any]:
        """Export obj to dictionary"""
        export_fields = set(self.export_fields)
        if export_uuids:
            export_fields.add("uuid")
            if "id" in export_fields:
                export_fields.remove("id")

        cls = self.__class__
        parent_excludes = set()
        if recursive and not include_parent_ref:
            parent_ref = cls.__mapper__.relationships.get(cls.export_parent)
            if parent_ref:
                parent_excludes = {c.name for c in parent_ref.local_columns}
        dict_rep = {
            c.name: getattr(self, c.name)
            for c in cls.__table__.columns  # type: ignore
            if (
                c.name in export_fields
                and c.name not in parent_excludes
                and (
                    include_defaults
                    or (
                        getattr(self, c.name) is not None
                        and (not c.default or getattr(self, c.name) != c.default.arg)
                    )
                )
            )
        }

        # sort according to export_fields using DSU (decorate, sort, undecorate)
        order = {field: i for i, field in enumerate(self.export_fields)}
        decorated_keys = [(order.get(k, len(order)), k) for k in dict_rep]
        decorated_keys.sort()
        dict_rep = {k: dict_rep[k] for _, k in decorated_keys}

        if recursive:
            for cld in self.export_children:
                # sorting to make lists of children stable
                dict_rep[cld] = sorted(
                    [
                        child.export_to_dict(
                            recursive=recursive,
                            include_parent_ref=include_parent_ref,
                            include_defaults=include_defaults,
                        )
                        for child in getattr(self, cld)
                    ],
                    key=lambda k: sorted(str(k.items())),
                )

        return convert_uuids(dict_rep)

    def override(self, obj: Any) -> None:
        """Overrides the plain fields of the dashboard."""
        for field in obj.__class__.export_fields:
            setattr(self, field, getattr(obj, field))

    def copy(self) -> Any:
        """Creates a copy of the dashboard without relationships."""
        new_obj = self.__class__()
        new_obj.override(self)
        return new_obj

    def alter_params(self, **kwargs: Any) -> None:
        params = self.params_dict
        params.update(kwargs)
        self.params = json.dumps(params)

    def remove_params(self, param_to_remove: str) -> None:
        params = self.params_dict
        params.pop(param_to_remove, None)
        self.params = json.dumps(params)

    def reset_ownership(self) -> None:
        """object will belong to the user the current user"""
        # make sure the object doesn't have relations to a user
        # it will be filled by appbuilder on save
        self.created_by = None
        self.changed_by = None
        # flask global context might not exist (in cli or tests for example)
        self.owners = []
        if g and hasattr(g, "user"):
            self.owners = [g.user]

    @property
    def params_dict(self) -> dict[Any, Any]:
        return json_to_dict(self.params)

    @property
    def template_params_dict(self) -> dict[Any, Any]:
        return json_to_dict(self.template_params)  # type: ignore


def _user(user: User) -> str:
    if not user:
        return ""
    return escape(user)


class AuditMixinNullable(AuditMixin):
    """Altering the AuditMixin to use nullable fields

    Allows creating objects programmatically outside of CRUD
    """

    created_on = sa.Column(sa.DateTime, default=datetime.now, nullable=True)
    changed_on = sa.Column(
        sa.DateTime, default=datetime.now, onupdate=datetime.now, nullable=True
    )

    @declared_attr
    def created_by_fk(self) -> sa.Column:  # pylint: disable=arguments-renamed
        return sa.Column(
            sa.Integer,
            sa.ForeignKey("ab_user.id"),
            default=get_user_id,
            nullable=True,
        )

    @declared_attr
    def changed_by_fk(self) -> sa.Column:  # pylint: disable=arguments-renamed
        return sa.Column(
            sa.Integer,
            sa.ForeignKey("ab_user.id"),
            default=get_user_id,
            onupdate=get_user_id,
            nullable=True,
        )

    @property
    def created_by_name(self) -> str:
        if self.created_by:
            return escape(f"{self.created_by}")
        return ""

    @property
    def changed_by_name(self) -> str:
        if self.changed_by:
            return escape(f"{self.changed_by}")
        return ""

    @renders("created_by")
    def creator(self) -> Union[Markup, str]:
        return _user(self.created_by)

    @property
    def changed_by_(self) -> Union[Markup, str]:
        return _user(self.changed_by)

    @renders("changed_on")
    def changed_on_(self) -> Markup:
        return Markup(f'<span class="no-wrap">{self.changed_on}</span>')

    @renders("changed_on")
    def changed_on_delta_humanized(self) -> str:
        return self.changed_on_humanized

    @renders("changed_on")
    def changed_on_dttm(self) -> float:
        return datetime_to_epoch(self.changed_on)

    @renders("created_on")
    def created_on_delta_humanized(self) -> str:
        return self.created_on_humanized

    @renders("changed_on")
    def changed_on_utc(self) -> str:
        # Convert naive datetime to UTC
        return self.changed_on.astimezone(pytz.utc).strftime("%Y-%m-%dT%H:%M:%S.%f%z")

    @property
    def changed_on_humanized(self) -> str:
        return humanize.naturaltime(datetime.now() - self.changed_on)

    @property
    def created_on_humanized(self) -> str:
        return humanize.naturaltime(datetime.now() - self.created_on)

    @renders("changed_on")
    def modified(self) -> Markup:
        return Markup(f'<span class="no-wrap">{self.changed_on_humanized}</span>')


class QueryResult:  # pylint: disable=too-few-public-methods
    """Object returned by the query interface"""

    def __init__(  # pylint: disable=too-many-arguments
        self,
        df: pd.DataFrame,
        query: str,
        duration: timedelta,
        applied_template_filters: Optional[list[str]] = None,
        applied_filter_columns: Optional[list[ColumnTyping]] = None,
        rejected_filter_columns: Optional[list[ColumnTyping]] = None,
        status: str = QueryStatus.SUCCESS,
        error_message: Optional[str] = None,
        errors: Optional[list[dict[str, Any]]] = None,
        from_dttm: Optional[datetime] = None,
        to_dttm: Optional[datetime] = None,
    ) -> None:
        self.df = df
        self.query = query
        self.duration = duration
        self.applied_template_filters = applied_template_filters or []
        self.applied_filter_columns = applied_filter_columns or []
        self.rejected_filter_columns = rejected_filter_columns or []
        self.status = status
        self.error_message = error_message
        self.errors = errors or []
        self.from_dttm = from_dttm
        self.to_dttm = to_dttm
        self.sql_rowcount = len(self.df.index) if not self.df.empty else 0


class ExtraJSONMixin:
    """Mixin to add an `extra` column (JSON) and utility methods"""

    extra_json = sa.Column(MediumText(), default="{}")

    @property
    def extra(self) -> dict[str, Any]:
        try:
            return json.loads(self.extra_json or "{}") or {}
        except (TypeError, JSONDecodeError) as exc:
            logger.error(
                "Unable to load an extra json: %r. Leaving empty.", exc, exc_info=True
            )
            return {}

    @extra.setter
    def extra(self, extras: dict[str, Any]) -> None:
        self.extra_json = json.dumps(extras)

    def set_extra_json_key(self, key: str, value: Any) -> None:
        extra = self.extra
        extra[key] = value
        self.extra_json = json.dumps(extra)

    @validates("extra_json")
    def ensure_extra_json_is_not_none(
        self,
        _: str,
        value: Optional[dict[str, Any]],
    ) -> Any:
        if value is None:
            return "{}"
        return value


class CertificationMixin:
    """Mixin to add extra certification fields"""

    extra = sa.Column(sa.Text, default="{}")

    def get_extra_dict(self) -> dict[str, Any]:
        try:
            return json.loads(self.extra)
        except (TypeError, json.JSONDecodeError):
            return {}

    @property
    def is_certified(self) -> bool:
        return bool(self.get_extra_dict().get("certification"))

    @property
    def certified_by(self) -> Optional[str]:
        return self.get_extra_dict().get("certification", {}).get("certified_by")

    @property
    def certification_details(self) -> Optional[str]:
        return self.get_extra_dict().get("certification", {}).get("details")

    @property
    def warning_markdown(self) -> Optional[str]:
        return self.get_extra_dict().get("warning_markdown")


def clone_model(
    target: Model,
    ignore: Optional[list[str]] = None,
    keep_relations: Optional[list[str]] = None,
    **kwargs: Any,
) -> Model:
    """
    Clone a SQLAlchemy model. By default will only clone naive column attributes.
    To include relationship attributes, use `keep_relations`.
    """
    ignore = ignore or []

    table = target.__table__
    primary_keys = table.primary_key.columns.keys()
    data = {
        attr: getattr(target, attr)
        for attr in list(table.columns.keys()) + (keep_relations or [])
        if attr not in primary_keys and attr not in ignore
    }
    data.update(kwargs)

    return target.__class__(**data)


# todo(hugh): centralize where this code lives
class QueryStringExtended(NamedTuple):
    applied_template_filters: Optional[list[str]]
    applied_filter_columns: list[ColumnTyping]
    rejected_filter_columns: list[ColumnTyping]
    labels_expected: list[str]
    prequeries: list[str]
    sql: str


class SqlaQuery(NamedTuple):
    applied_template_filters: list[str]
    applied_filter_columns: list[ColumnTyping]
    rejected_filter_columns: list[ColumnTyping]
    cte: Optional[str]
    extra_cache_keys: list[Any]
    labels_expected: list[str]
    prequeries: list[str]
    sqla_query: Select


class ExploreMixin:  # pylint: disable=too-many-public-methods
    """
    Allows any flask_appbuilder.Model (Query, Table, etc.)
    to be used to power a chart inside /explore
    """

    sqla_aggregations = {
        "COUNT_DISTINCT": lambda column_name: sa.func.COUNT(sa.distinct(column_name)),
        "COUNT": sa.func.COUNT,
        "SUM": sa.func.SUM,
        "AVG": sa.func.AVG,
        "MIN": sa.func.MIN,
        "MAX": sa.func.MAX,
    }
    fetch_values_predicate = None

    @property
    def type(self) -> str:
        raise NotImplementedError()

    @property
    def db_extra(self) -> Optional[dict[str, Any]]:
        raise NotImplementedError()

    def query(self, query_obj: QueryObjectDict) -> QueryResult:
        raise NotImplementedError()

    @property
    def database_id(self) -> int:
        raise NotImplementedError()

    @property
    def owners_data(self) -> list[Any]:
        raise NotImplementedError()

    @property
    def metrics(self) -> list[Any]:
        return []

    @property
    def uid(self) -> str:
        raise NotImplementedError()

    @property
    def is_rls_supported(self) -> bool:
        raise NotImplementedError()

    @property
    def cache_timeout(self) -> int:
        raise NotImplementedError()

    @property
    def column_names(self) -> list[str]:
        raise NotImplementedError()

    @property
    def offset(self) -> int:
        raise NotImplementedError()

    @property
    def main_dttm_col(self) -> Optional[str]:
        raise NotImplementedError()

    @property
    def always_filter_main_dttm(self) -> Optional[bool]:
        return False

    @property
    def dttm_cols(self) -> list[str]:
        raise NotImplementedError()

    @property
    def db_engine_spec(self) -> builtins.type["BaseEngineSpec"]:
        raise NotImplementedError()

    @property
    def database(self) -> "Database":
        raise NotImplementedError()

    @property
    def schema(self) -> str:
        raise NotImplementedError()

    @property
    def sql(self) -> str:
        raise NotImplementedError()

    @property
    def columns(self) -> list[Any]:
        raise NotImplementedError()

    def get_extra_cache_keys(self, query_obj: dict[str, Any]) -> list[Hashable]:
        raise NotImplementedError()

    def get_template_processor(self, **kwargs: Any) -> BaseTemplateProcessor:
        raise NotImplementedError()

    def get_fetch_values_predicate(
        self,
        template_processor: Optional[  # pylint: disable=unused-argument
            BaseTemplateProcessor
        ] = None,
    ) -> TextClause:
        return self.fetch_values_predicate

    def get_sqla_row_level_filters(
        self,
        template_processor: BaseTemplateProcessor,
    ) -> list[TextClause]:
        """
        Return the appropriate row level security filters for this table and the
        current user. A custom username can be passed when the user is not present in the
        Flask global namespace.

        :param template_processor: The template processor to apply to the filters.
        :returns: A list of SQL clauses to be ANDed together.
        """
        all_filters: list[TextClause] = []
        filter_groups: dict[Union[int, str], list[TextClause]] = defaultdict(list)
        try:
            for filter_ in security_manager.get_rls_filters(self):
                clause = self.text(
                    f"({template_processor.process_template(filter_.clause)})"
                )
                if filter_.group_key:
                    filter_groups[filter_.group_key].append(clause)
                else:
                    all_filters.append(clause)

            if is_feature_enabled("EMBEDDED_SUPERSET"):
                for rule in security_manager.get_guest_rls_filters(self):
                    clause = self.text(
                        f"({template_processor.process_template(rule['clause'])})"
                    )
                    all_filters.append(clause)

            grouped_filters = [or_(*clauses) for clauses in filter_groups.values()]
            all_filters.extend(grouped_filters)
            return all_filters
        except TemplateError as ex:
            raise QueryObjectValidationError(
                _(
                    "Error in jinja expression in RLS filters: %(msg)s",
                    msg=ex.message,
                )
            ) from ex

    def _process_sql_expression(
        self,
        expression: Optional[str],
        database_id: int,
        schema: str,
        template_processor: Optional[BaseTemplateProcessor],
    ) -> Optional[str]:
        if template_processor and expression:
            expression = template_processor.process_template(expression)
        if expression:
            expression = validate_adhoc_subquery(
                expression,
                database_id,
                schema,
            )
            try:
                expression = sanitize_clause(expression)
            except QueryClauseValidationException as ex:
                raise QueryObjectValidationError(ex.message) from ex
        return expression

    def make_sqla_column_compatible(
        self, sqla_col: ColumnElement, label: Optional[str] = None
    ) -> ColumnElement:
        """Takes a sqlalchemy column object and adds label info if supported by engine.
        :param sqla_col: sqlalchemy column instance
        :param label: alias/label that column is expected to have
        :return: either a sql alchemy column or label instance if supported by engine
        """
        label_expected = label or sqla_col.name
        db_engine_spec = self.db_engine_spec
        # add quotes to tables
        if db_engine_spec.get_allows_alias_in_select(self.database):
            label = db_engine_spec.make_label_compatible(label_expected)
            sqla_col = sqla_col.label(label)
        sqla_col.key = label_expected
        return sqla_col

    def mutate_query_from_config(self, sql: str) -> str:
        """Apply config's SQL_QUERY_MUTATOR

        Typically adds comments to the query with context"""
        if sql_query_mutator := config["SQL_QUERY_MUTATOR"]:
            sql = sql_query_mutator(
                sql,
                security_manager=security_manager,
                database=self.database,
            )
        return sql

    @staticmethod
    def _apply_cte(sql: str, cte: Optional[str]) -> str:
        """
        Append a CTE before the SELECT statement if defined

        :param sql: SELECT statement
        :param cte: CTE statement
        :return:
        """
        if cte:
            sql = f"{cte}\n{sql}"
        return sql

    def get_query_str_extended(
        self, query_obj: QueryObjectDict, mutate: bool = True
    ) -> QueryStringExtended:
        sqlaq = self.get_sqla_query(**query_obj)
        sql = self.database.compile_sqla_query(sqlaq.sqla_query)
        sql = self._apply_cte(sql, sqlaq.cte)
        sql = sqlparse.format(sql, reindent=True)
        if mutate:
            sql = self.mutate_query_from_config(sql)
        return QueryStringExtended(
            applied_template_filters=sqlaq.applied_template_filters,
            applied_filter_columns=sqlaq.applied_filter_columns,
            rejected_filter_columns=sqlaq.rejected_filter_columns,
            labels_expected=sqlaq.labels_expected,
            prequeries=sqlaq.prequeries,
            sql=sql,
        )

    def _normalize_prequery_result_type(
        self,
        row: pd.Series,
        dimension: str,
        columns_by_name: dict[str, "TableColumn"],
    ) -> Union[str, int, float, bool, str]:
        """
        Convert a prequery result type to its equivalent Python type.

        Some databases like Druid will return timestamps as strings, but do not perform
        automatic casting when comparing these strings to a timestamp. For cases like
        this we convert the value via the appropriate SQL transform.

        :param row: A prequery record
        :param dimension: The dimension name
        :param columns_by_name: The mapping of columns by name
        :return: equivalent primitive python type
        """

        value = row[dimension]

        if isinstance(value, np.generic):
            value = value.item()

        column_ = columns_by_name[dimension]
        db_extra: dict[str, Any] = self.database.get_extra()

        if isinstance(column_, dict):
            if (
                column_.get("type")
                and column_.get("is_temporal")
                and isinstance(value, str)
            ):
                sql = self.db_engine_spec.convert_dttm(
                    column_.get("type"), dateutil.parser.parse(value), db_extra=None
                )

                if sql:
                    value = self.db_engine_spec.get_text_clause(sql)
        else:
            if column_.type and column_.is_temporal and isinstance(value, str):
                sql = self.db_engine_spec.convert_dttm(
                    column_.type, dateutil.parser.parse(value), db_extra=db_extra
                )

                if sql:
                    value = self.text(sql)
        return value

    def make_orderby_compatible(
        self, select_exprs: list[ColumnElement], orderby_exprs: list[ColumnElement]
    ) -> None:
        """
        If needed, make sure aliases for selected columns are not used in
        `ORDER BY`.

        In some databases (e.g. Presto), `ORDER BY` clause is not able to
        automatically pick the source column if a `SELECT` clause alias is named
        the same as a source column. In this case, we update the SELECT alias to
        another name to avoid the conflict.
        """
        if self.db_engine_spec.allows_alias_to_source_column:
            return

        def is_alias_used_in_orderby(col: ColumnElement) -> bool:
            if not isinstance(col, Label):
                return False
            regexp = re.compile(f"\\(.*\\b{re.escape(col.name)}\\b.*\\)", re.IGNORECASE)
            return any(regexp.search(str(x)) for x in orderby_exprs)

        # Iterate through selected columns, if column alias appears in orderby
        # use another `alias`. The final output columns will still use the
        # original names, because they are updated by `labels_expected` after
        # querying.
        for col in select_exprs:
            if is_alias_used_in_orderby(col):
                col.name = f"{col.name}__"

    def exc_query(self, qry: Any) -> QueryResult:
        qry_start_dttm = datetime.now()
        query_str_ext = self.get_query_str_extended(qry)
        sql = query_str_ext.sql
        status = QueryStatus.SUCCESS
        errors = None
        error_message = None

        def assign_column_label(df: pd.DataFrame) -> Optional[pd.DataFrame]:
            """
            Some engines change the case or generate bespoke column names, either by
            default or due to lack of support for aliasing. This function ensures that
            the column names in the DataFrame correspond to what is expected by
            the viz components.
            Sometimes a query may also contain only order by columns that are not used
            as metrics or groupby columns, but need to present in the SQL `select`,
            filtering by `labels_expected` make sure we only return columns users want.
            :param df: Original DataFrame returned by the engine
            :return: Mutated DataFrame
            """
            labels_expected = query_str_ext.labels_expected
            if df is not None and not df.empty:
                if len(df.columns) < len(labels_expected):
                    raise QueryObjectValidationError(
                        _("Db engine did not return all queried columns")
                    )
                if len(df.columns) > len(labels_expected):
                    df = df.iloc[:, 0 : len(labels_expected)]
                df.columns = labels_expected
            return df

        try:
            df = self.database.get_df(sql, self.schema, mutator=assign_column_label)
        except Exception as ex:  # pylint: disable=broad-except
            df = pd.DataFrame()
            status = QueryStatus.FAILED
            logger.warning(
                "Query %s on schema %s failed", sql, self.schema, exc_info=True
            )
            db_engine_spec = self.db_engine_spec
            errors = [
                dataclasses.asdict(error) for error in db_engine_spec.extract_errors(ex)
            ]
            error_message = utils.error_msg_from_exception(ex)

        return QueryResult(
            applied_template_filters=query_str_ext.applied_template_filters,
            applied_filter_columns=query_str_ext.applied_filter_columns,
            rejected_filter_columns=query_str_ext.rejected_filter_columns,
            status=status,
            df=df,
            duration=datetime.now() - qry_start_dttm,
            query=sql,
            errors=errors,
            error_message=error_message,
        )

    def get_rendered_sql(
        self, template_processor: Optional[BaseTemplateProcessor] = None
    ) -> str:
        """
        Render sql with template engine (Jinja).
        """

        sql = self.sql
        if template_processor:
            try:
                sql = template_processor.process_template(sql)
            except TemplateError as ex:
                raise QueryObjectValidationError(
                    _(
                        "Error while rendering virtual dataset query: %(msg)s",
                        msg=ex.message,
                    )
                ) from ex
        sql = sqlparse.format(sql.strip("\t\r\n; "), strip_comments=True)
        if not sql:
            raise QueryObjectValidationError(_("Virtual dataset query cannot be empty"))
        if len(sqlparse.split(sql)) > 1:
            raise QueryObjectValidationError(
                _("Virtual dataset query cannot consist of multiple statements")
            )
        return sql

    def text(self, clause: str) -> TextClause:
        return self.db_engine_spec.get_text_clause(clause)

    def get_from_clause(
        self, template_processor: Optional[BaseTemplateProcessor] = None
    ) -> tuple[Union[TableClause, Alias], Optional[str]]:
        """
        Return where to select the columns and metrics from. Either a physical table
        or a virtual table with it's own subquery. If the FROM is referencing a
        CTE, the CTE is returned as the second value in the return tuple.
        """

        from_sql = self.get_rendered_sql(template_processor)
        parsed_query = ParsedQuery(from_sql, engine=self.db_engine_spec.engine)
        if not (
            parsed_query.is_unknown()
            or self.db_engine_spec.is_readonly_query(parsed_query)
        ):
            raise QueryObjectValidationError(
                _("Virtual dataset query must be read-only")
            )

        cte = self.db_engine_spec.get_cte_query(from_sql)
        from_clause = (
            sa.table(self.db_engine_spec.cte_alias)
            if cte
            else TextAsFrom(self.text(from_sql), []).alias(VIRTUAL_TABLE_ALIAS)
        )

        return from_clause, cte

    def adhoc_metric_to_sqla(
        self,
        metric: AdhocMetric,
        columns_by_name: dict[str, "TableColumn"],  # pylint: disable=unused-argument
        template_processor: Optional[BaseTemplateProcessor] = None,
    ) -> ColumnElement:
        """
        Turn an adhoc metric into a sqlalchemy column.

        :param dict metric: Adhoc metric definition
        :param dict columns_by_name: Columns for the current table
        :param template_processor: template_processor instance
        :returns: The metric defined as a sqlalchemy column
        :rtype: sqlalchemy.sql.column
        """
        expression_type = metric.get("expressionType")
        label = utils.get_metric_name(metric)

        if expression_type == utils.AdhocMetricExpressionType.SIMPLE:
            metric_column = metric.get("column") or {}
            column_name = cast(str, metric_column.get("column_name"))
            sqla_column = sa.column(column_name)
            sqla_metric = self.sqla_aggregations[metric["aggregate"]](sqla_column)
        elif expression_type == utils.AdhocMetricExpressionType.SQL:
            expression = self._process_sql_expression(
                expression=metric["sqlExpression"],
                database_id=self.database_id,
                schema=self.schema,
                template_processor=template_processor,
            )
            sqla_metric = literal_column(expression)
        else:
            raise QueryObjectValidationError("Adhoc metric expressionType is invalid")

        return self.make_sqla_column_compatible(sqla_metric, label)

    @property
    def template_params_dict(self) -> dict[Any, Any]:
        return {}

    @staticmethod
    def filter_values_handler(  # pylint: disable=too-many-arguments
        values: Optional[FilterValues],
        operator: str,
        target_generic_type: utils.GenericDataType,
        target_native_type: Optional[str] = None,
        is_list_target: bool = False,
        db_engine_spec: Optional[
            builtins.type["BaseEngineSpec"]
        ] = None,  # fix(hughhh): Optional[Type[BaseEngineSpec]]
        db_extra: Optional[dict[str, Any]] = None,
    ) -> Optional[FilterValues]:
        if values is None:
            return None

        def handle_single_value(value: Optional[FilterValue]) -> Optional[FilterValue]:
            if operator == utils.FilterOperator.TEMPORAL_RANGE:
                return value
            if (
                isinstance(value, (float, int))
                and target_generic_type == utils.GenericDataType.TEMPORAL
                and target_native_type is not None
                and db_engine_spec is not None
            ):
                value = db_engine_spec.convert_dttm(
                    target_type=target_native_type,
                    dttm=datetime.utcfromtimestamp(value / 1000),
                    db_extra=db_extra,
                )
                value = literal_column(value)
            if isinstance(value, str):
                value = value.strip("\t\n")

                if (
                    target_generic_type == utils.GenericDataType.NUMERIC
                    and operator
                    not in {
                        utils.FilterOperator.ILIKE,
                        utils.FilterOperator.LIKE,
                    }
                ):
                    # For backwards compatibility and edge cases
                    # where a column data type might have changed
                    return utils.cast_to_num(value)
                if value == NULL_STRING:
                    return None
                if value == EMPTY_STRING:
                    return ""
            if target_generic_type == utils.GenericDataType.BOOLEAN:
                return utils.cast_to_boolean(value)
            return value

        if isinstance(values, (list, tuple)):
            values = [handle_single_value(v) for v in values]  # type: ignore
        else:
            values = handle_single_value(values)
        if is_list_target and not isinstance(values, (tuple, list)):
            values = [values]  # type: ignore
        elif not is_list_target and isinstance(values, (tuple, list)):
            values = values[0] if values else None
        return values

    def get_query_str(self, query_obj: QueryObjectDict) -> str:
        query_str_ext = self.get_query_str_extended(query_obj)
        all_queries = query_str_ext.prequeries + [query_str_ext.sql]
        return ";\n\n".join(all_queries) + ";"

    def _get_series_orderby(
        self,
        series_limit_metric: Metric,
        metrics_by_name: dict[str, "SqlMetric"],
        columns_by_name: dict[str, "TableColumn"],
        template_processor: Optional[BaseTemplateProcessor] = None,
    ) -> Column:
        if utils.is_adhoc_metric(series_limit_metric):
            assert isinstance(series_limit_metric, dict)
            ob = self.adhoc_metric_to_sqla(series_limit_metric, columns_by_name)
        elif (
            isinstance(series_limit_metric, str)
            and series_limit_metric in metrics_by_name
        ):
            ob = metrics_by_name[series_limit_metric].get_sqla_col(
                template_processor=template_processor
            )
        else:
            raise QueryObjectValidationError(
                _("Metric '%(metric)s' does not exist", metric=series_limit_metric)
            )
        return ob

    def adhoc_column_to_sqla(
        self,
        col: "AdhocColumn",  # type: ignore
        force_type_check: bool = False,
        template_processor: Optional[BaseTemplateProcessor] = None,
    ) -> ColumnElement:
        raise NotImplementedError()

    def _get_top_groups(
        self,
        df: pd.DataFrame,
        dimensions: list[str],
        groupby_exprs: dict[str, Any],
        columns_by_name: dict[str, "TableColumn"],
    ) -> ColumnElement:
        groups = []
        for _unused, row in df.iterrows():
            group = []
            for dimension in dimensions:
                value = self._normalize_prequery_result_type(
                    row,
                    dimension,
                    columns_by_name,
                )

                group.append(groupby_exprs[dimension] == value)
            groups.append(and_(*group))

        return or_(*groups)

    def dttm_sql_literal(self, dttm: datetime, col: "TableColumn") -> str:
        """Convert datetime object to a SQL expression string"""

        sql = (
            self.db_engine_spec.convert_dttm(col.type, dttm, db_extra=self.db_extra)
            if col.type
            else None
        )

        if sql:
            return sql

        tf = col.python_date_format

        # Fallback to the default format (if defined).
        if not tf and self.db_extra:
            tf = self.db_extra.get("python_date_format_by_column_name", {}).get(
                col.column_name
            )

        if tf:
            if tf in {"epoch_ms", "epoch_s"}:
                seconds_since_epoch = int(dttm.timestamp())
                if tf == "epoch_s":
                    return str(seconds_since_epoch)
                return str(seconds_since_epoch * 1000)
            return f"'{dttm.strftime(tf)}'"

        return f"""'{dttm.strftime("%Y-%m-%d %H:%M:%S.%f")}'"""

    def get_time_filter(  # pylint: disable=too-many-arguments
        self,
        time_col: "TableColumn",
        start_dttm: Optional[sa.DateTime],
        end_dttm: Optional[sa.DateTime],
        time_grain: Optional[str] = None,
        label: Optional[str] = "__time",
        template_processor: Optional[BaseTemplateProcessor] = None,
    ) -> ColumnElement:
        col = (
            time_col.get_timestamp_expression(
                time_grain=time_grain,
                label=label,
                template_processor=template_processor,
            )
            if time_grain
            else self.convert_tbl_column_to_sqla_col(
                time_col, label=label, template_processor=template_processor
            )
        )

        l = []
        if start_dttm:
            l.append(
                col
                >= self.db_engine_spec.get_text_clause(
                    self.dttm_sql_literal(start_dttm, time_col)
                )
            )
        if end_dttm:
            l.append(
                col
                < self.db_engine_spec.get_text_clause(
                    self.dttm_sql_literal(end_dttm, time_col)
                )
            )
        return and_(*l)

    def process_period_data(
            self,
            period_data: list[str],
            period_type: str
    ) -> list[utils.SelectorOptions]:
        """
        Process a column containing period values and determine available periods.

        :param period_column: The name of the column containing period values.
        :param data: DataFrame containing the period column.
        :param period_type: The type of period ('W' for weekly, 'R' for monthly).
        :return: A list of SelectorOptions with available periods.
        """
        # Extract and sort unique periods
        periods = sorted(set(filter(None, map(self.parse_timestamp, period_data))))

        if not periods:
            return []

        # Determine the earliest and latest periods
        earliest_period = min(periods)
        latest_period = max(periods)

        options = self.compute_period_availability(
            earliest_period=earliest_period,
            latest_period=latest_period,
            period_type=period_type
        )
        return [utils.SelectorOptions(**opt) for opt in options]

    def compute_period_availability(
            self,
            earliest_period: datetime,
            latest_period: datetime,
            period_type: str
    ) -> list[dict]:
        """
        Compute available period options based on earliest and latest periods.

        :param earliest_period: The earliest available period.
        :param latest_period: The latest available period.
        :param period_type: The type of period ('W' for weekly, 'R' for monthly).
        :return: A list of dictionaries with period options and their availability.
        :raises ValueError: If period_type is invalid.
        """

        if period_type not in ["W", "R"]:
            raise ValueError(f"Invalid period_type: {period_type}. Must be 'W' or 'R'.")
        
        unit = "weeks" if period_type == "W" else "months" # единицы измерения периода
        options = []
        for key, definition in PERIOD_DEFINITIONS.items():

            if definition["unit"] != unit:
                continue # например, если period_type == "R", то пропускаем все, кроме unit = "months"

            offset = definition["offset"] # сколько месяцев/недель отсчитывать от последнего периода
            
            if offset is not None:
                cutoff_date = latest_period - relativedelta(**{unit: offset})
            else:  # YTD
                cutoff_date = datetime(latest_period.year, 1, 1)

            available = earliest_period <= cutoff_date
            options.append({
                "value": key,
                "label": definition["label"],
                "available": available
            })

        return options

    def convert_period(self, period: str) -> str:
        """
        Convert period from 'X YYYY MM' format to 'YYYYXMM' format
        
        Examples:
        'M 2024 09' -> '2024M09'
        'W 2024 02' -> '2024W02'
        
        Args:
            period (str): Input period string
        
        Returns:
            str: Converted period string
        """
        # Split the period string
        parts = period.split()
        
        # Ensure the input is in the expected format
        if len(parts) != 3:
            raise ValueError(f"Invalid period format: '{period}'. Expected format: 'X YYYY WW' (e.g., 'W 2023 01')")
        
        # Rearrange to desired format
        return f"{parts[1]}{parts[0]}{parts[2]}"
    
    def generate_period_selector(
        self,
        column_names: list[str],
        limit: int = None,
        denormalize_columns: bool = False,
        rls_restriction: dict = None,
    ) -> utils.Selector:
        """
        Generate a selector based on periods from a specified column.

        :param period_column: The name of the column containing period values.
        :param column_names: List of column names to fetch.
        :param rls_restriction: Dictionary containing rls_restriction.
        :return: A Selector object.
        """
        
        df = self.data_for_columns_upper(
            column_names=column_names,
            limit=limit,
            denormalize_columns=denormalize_columns,
        )

        if df is None or df.empty:
            raise ValueError(f"No data returned for columns: {column_names}")

        df_filtered = df
        
        # ограничение доступа к данным селекторов по order_id при наличии rls_restriction
        if rls_restriction and isinstance(rls_restriction, dict):
            try:
                # Получаем значения для ограничения доступа к данным селекторов по order_id
                rls_column = rls_restriction["column"]
                rls_value = rls_restriction["value"]

                if rls_column and rls_value:
                    # Проверяем, есть ли колонка order_id в датасете
                    if rls_column.upper() not in df.columns:
                        raise ValueError(f"Column {rls_column.upper()} not found in dataset for Period selector")
                    
                    # есть ли значения order_id в списке ордеров датасета
                    valid_values = df[rls_column.upper()].drop_duplicates().tolist()
                    if rls_value not in valid_values:
                        raise ValueError(f"Value '{rls_value}' not found in column {rls_column.upper()} of a Period dataset. Valid values are: {valid_values}")
        
                    # Фильтруем данные по order_id
                    df_filtered = df[df[rls_column.upper()] == rls_value]

            except (IndexError, KeyError, TypeError) as e:
                raise ValueError(f"Invalid RLS configuration: {str(e)}")

        # Получаем тип периода из первой строки
        try:
            period_type = df_filtered[PER_TAG_COLUMN].iloc[0][0]  # например, 'W' из 'W2020015'
        except (IndexError, KeyError, TypeError) as e:
            raise ValueError(f"Unable to determine period type from column {PER_TAG_COLUMN}: {e}")
        
        options = self.process_period_data(
            df_filtered[PERIOD_COLUMN_NAME.upper()].to_list(),
            period_type=period_type
        )

        selected_period = "last_week" if period_type == "W" else "last_month"

        # sort periods by date in ascending order
        df_filtered["parsed_date"] = df_filtered[PERIOD_COLUMN_NAME.upper()].apply(self.parse_timestamp)
        df_filtered = df_filtered.sort_values(by="parsed_date")

        periods = df_filtered[PERIOD_COLUMN_NAME.upper()].dropna().unique().tolist()

        # приводим периоды к формату 'YYYYXMM'
        converted_periods = [self.convert_period(period) for period in periods]

        return utils.Selector(
            type_selector="Period",
            label_selector="Период",
            selected_period=selected_period,
            avaliable_periods=options or [],
            period_type=period_type,
            custom_periods=converted_periods,
            rls_restriction=rls_restriction # на время, чтобы понимать, какой одер принимается из сессии
        )

    def data_for_columns_upper(
        self,
        column_names: list[str],
        limit: int = None,
        denormalize_columns: bool = False,
        filters: dict = None,
        order_by: str = None,            
        order_ascending: bool = True,
    ) -> pd.DataFrame:
        """
        Fetch values for multiple columns and return a DataFrame.

        :param column_names: List of column names to fetch.
        :param limit: Maximum number of rows to fetch.
        :param denormalize_columns: Whether to denormalize column names.
        :param filters: dict {column: value} — фильтры для выборки.
        :param order_by: Имя столбца для сортировки.
        :param order_ascending: True — сортировка по возрастанию, False — по убыванию.
        :return: A DataFrame with values for the specified columns.
        """
        db_dialect = self.database.get_dialect()

        # Denormalize column names if required
        column_names_ = [
            (
                self.database.db_engine_spec.denormalize_name(db_dialect, col)
                if denormalize_columns else col
            ).upper()
            for col in column_names
        ]

        # Build a map of available columns (uppercase for consistency)
        cols = {col.column_name.upper(): col for col in self.columns}

        # Validate and retrieve the target columns
        target_cols = [cols[col_name] for col_name in column_names_ if col_name in cols]
        if len(target_cols) != len(column_names):
            missing = set(column_names) - set(cols.keys())
            raise ValueError(f"Columns not found in dataset: {missing}")

        tp = self.get_template_processor()
        tbl, cte = self.get_from_clause(tp)

        # Build the SQLAlchemy query
        qry = (
            sa.select([
                target_col.get_sqla_col(template_processor=tp).label(col_name)
                for target_col, col_name in zip(target_cols, column_names_)
            ])
            .select_from(tbl)
        )
        if filters:
            for col, val in filters.items():
                colname = column(col)
                if isinstance(val, (list, tuple, set)):
                    qry = qry.where(colname.in_(val))
                else:
                    qry = qry.where(colname == val)

        if order_by:
            colname = column(order_by)
            if order_ascending:
                qry = qry.order_by(colname.asc())
            else:
                qry = qry.order_by(colname.desc())

        if limit:
            qry = qry.limit(limit)

        if self.fetch_values_predicate:
            qry = qry.where(self.get_fetch_values_predicate(template_processor=tp))

        with self.database.get_sqla_engine_with_context() as engine:
            sql = str(qry.compile(engine, compile_kwargs={"literal_binds": True}))
            sql = self._apply_cte(sql, cte)
            sql = self.mutate_query_from_config(sql)
            # print(sql)
            # Handle dialect-specific SQL adjustments
            if engine.dialect.identifier_preparer._double_percents:
                sql = sql.replace("%%", "%")

            # Execute the query and fetch the results
            df = pd.read_sql_query(sql=sql, con=engine)

            # Replace NaN with None to ensure JSON serializability
            df = df.replace({np.nan: None})

            return df

    def generate_comparison_period_selector(
        self,
        column_names: list[str],
        limit: int = None,
        denormalize_columns: bool = False,
        rls_restriction: dict = None,
    ) -> utils.Selector:
        """
        Generate a selector based on market data from specified columns.

        :param column_names: List of column names to fetch.
        :param limit: Maximum number of rows to fetch.
        :param denormalize_columns: Whether to denormalize column names.
        :param rls_restriction: Dictionary containing rls_restriction.
        :return: A Selector object.
        """
        df = self.data_for_columns_upper(
            column_names=column_names,
            limit=limit,
            denormalize_columns=denormalize_columns
        )

        if df is None or df.empty: #comp_p change
            raise ValueError(f"No data returned for columns: {column_names}")
        
        df_filtered = df

        if rls_restriction and isinstance(rls_restriction, dict):
            try:
                # Получаем значения для ограничения доступа к данным селекторов по order_id
                rls_column = rls_restriction.get("column")
                rls_value = rls_restriction.get("value")

                if rls_column and rls_value:
                    # Проверяем, есть ли значение в списке уникальных значений
                    # есть ли колонка order_id в датасете
                    if rls_column.upper() not in df.columns:
                        raise ValueError(f"Column {rls_column.upper()} not found in dataset for Comparison_period selector")
                    
                    # есть ли значения order_id в списке ордеров датасета
                    valid_values = df[rls_column.upper()].drop_duplicates().tolist()
                    
                    if rls_value not in valid_values:
                        raise ValueError(f"Value '{rls_value}' not found in column {rls_column.upper()} of a Comparison_period dataset. Valid values are: {valid_values}")

                    # Фильтруем данные по order_id
                    df_filtered = df[df[rls_column.upper()] == rls_value]

            except (IndexError, KeyError, TypeError) as e:
                raise ValueError(f"Invalid RLS configuration: {str(e)}")
       
        # Получаем тип периода из первой строки
        try: #comp_p change
            period_type = df_filtered[PER_TAG_COLUMN].iloc[0][0]  # например, 'W' из 'W2020015'
        except (IndexError, KeyError, TypeError) as e:
            raise ValueError(f"Unable to determine period type from column {PER_TAG_COLUMN}: {e}")
        
        if period_type == "W":
            ANALOGOUS_PERIOD = ANALOGOUS_PERIOD_WEEKS
            COMPARISON_PERIOD_DEFINITIONS = COMPARISON_PERIOD_DEFINITIONS_W
            time_unit = "weeks"
        else:
            ANALOGOUS_PERIOD = ANALOGOUS_PERIOD_MONTHS
            COMPARISON_PERIOD_DEFINITIONS = COMPARISON_PERIOD_DEFINITIONS_M
            time_unit = "months"
        
        # список дат в формате: [Timestamp('2023-10-01 00:00:00'), Timestamp('2023-11-01 00:00:00')...]
        periods = sorted(set(filter(None, map(self.parse_timestamp, df_filtered[PERIOD_COLUMN_NAME.upper()].to_list()))))

        # минимальная и максимальная даты в списке
        earliest_period = min(periods)
        latest_period = max(periods)

        # словарь с датами для проверки
        date_checks = {}
        for period_key, offset in COMPARISON_PERIOD_DEFINITIONS.items():
            if period_key != "YTD":
                # определяем аргументы отступа для расчета начала периода для relativedelta
                kwargs_base = {time_unit: offset}
                kwargs_previous = {time_unit: offset + (offset + 1)}
                kwargs_analogous = {time_unit: offset + ANALOGOUS_PERIOD}

                date_checks[offset] = {
                    'base': latest_period - relativedelta(**kwargs_base), # начало периода
                    'previous': latest_period - relativedelta(**kwargs_previous), # начало предыдущего периода
                    'analogous': latest_period - relativedelta(**kwargs_analogous) # начало аналогичного периода
                }
            else:
                # вычисляем начало года
                ytd_start = datetime(latest_period.year, 1, 1)
                
                if period_type == "W":
                    time_passed = (latest_period - ytd_start).days // 7 # сколько недель прошло в текущем году
                    kwargs_previous = {"weeks": time_passed + 1} # начало предыдущего периода
                    kwargs_analogous = {"weeks": ANALOGOUS_PERIOD} # начало аналогичного периода
                else:
                    time_passed = latest_period.month - ytd_start.month # сколько месяцев прошло в текущем году
                    kwargs_previous = {"months": time_passed + 1} # начало предыдущего периода
                    kwargs_analogous = {"months": ANALOGOUS_PERIOD} # начало аналогичного периода
                
                # вычисляем начало предыдущего периода
                previous_start = ytd_start - relativedelta(**kwargs_previous)
                
                # записываем в словарь
                date_checks["YTD"] = {
                    'base': ytd_start, # начало текущего года
                    'previous': previous_start, # начало предыдущего периода
                    'analogous': ytd_start - relativedelta(**kwargs_analogous) # начало аналогичного периода
                }
                

        avaliable_comparison_period = []
        for key, offset in COMPARISON_PERIOD_DEFINITIONS.items():
            if key != "YTD":
                dates = date_checks[offset]
            else:
                dates = date_checks["YTD"]
                
                if period_type == "W":
                    key = f'{key}_week'
                else:
                    key = f'{key}_month'
                
            # если "Период" больше или равен минимальной дате, то добавляем в список
            if dates['base'] >= earliest_period:
                avaliable_comparison_period.append({
                    "period": key,
                    "comparisons": [
                        {
                            **COMPARISON_PERIOD_TYPES['ANALOGOUS'],
                            "available": earliest_period <= dates['analogous']
                        },
                        {
                            **COMPARISON_PERIOD_TYPES['PREVIOUS'],
                            "available": earliest_period <= dates['previous']
                        }
                    ]
                })

        return utils.Selector(
            type_selector="Comparison_period",
            label_selector="Период Сравнения",
            selected_comparison_period = "analogous_period_last_year",
            available_comparison_period=avaliable_comparison_period
        )

    def generate_market_selector(
        self,
        column_names: list[str],
        limit: int = None,
        denormalize_columns: bool = False,
        rls_restriction: dict = None,
    ) -> utils.Selector:
        """
        Generate a data for two market selectors based on market data from specified columns.

        :param column_names: List of column names to fetch.
        :param limit: Maximum number of rows to fetch.
        :param denormalize_columns: Whether to denormalize column names.
        :param rls_restriction: Dictionary containing rls_restriction.
        :return: A Selector object.
        """

        # Получаем данные для заданных колонок и сортируем по display_order
        df_market = self.data_for_columns_upper(
            column_names=column_names,
            limit=limit,
            denormalize_columns=denormalize_columns,
        )

        df_market_filtered = df_market

        if rls_restriction and isinstance(rls_restriction, dict):
            try:
                rls_column = rls_restriction.get("column")
                rls_value = rls_restriction.get("value")

                if rls_column and rls_value:
                    # есть ли колонка order_id в датасете
                    if rls_column.upper() not in df_market.columns:
                        raise ValueError(f"Column {rls_column.upper()} not found in dataset for Market selector")
                    
                    # есть ли значения order_id в списке ордеров датасета
                    valid_values = df_market[rls_column.upper()].drop_duplicates().tolist()
                    
                    if rls_value not in valid_values:
                        raise ValueError(f"Value '{rls_value}' not found in column {rls_column.upper()} of a Market dataset. Valid values are: {valid_values}")

                    # Фильтруем данные по order_id
                    df_market_filtered = df_market[df_market[rls_column.upper()] == rls_value]

            except (IndexError, KeyError, TypeError) as e:
                raise ValueError(f"Invalid RLS configuration: {str(e)}")
        
        OUTPUT_COLUMNS = [col for col in df_market_filtered.columns if col != MKT_DISPLAY_ORDER_COLUMN and col != rls_column.upper()]

        # Удаляем дубликаты по всем колонкам Рынка, кроме mkt_name
        df_market_no_dupes = df_market_filtered.drop_duplicates(
            subset=[col for col in df_market_filtered.columns if col != MKT_NAME_COLUMN and col != rls_column.upper()]
        )

        # Выбираем строки с 3 наименьшими display_order
        nsmallest = df_market_no_dupes.nsmallest(3, MKT_DISPLAY_ORDER_COLUMN)

        # Выбираем строку со вторым и третьим наименьшими display_order
        selected_rows = nsmallest.iloc[1:3]

        # Выбираем строку с наименьшим display_order
        selected_row_100 = nsmallest.iloc[0]

        # Преобразовываем в список словарей
        selected_markets = selected_rows[OUTPUT_COLUMNS].to_dict(orient='records')

        selected_markets_100 = selected_row_100[OUTPUT_COLUMNS].to_dict()
        
        available_markets = df_market_no_dupes[OUTPUT_COLUMNS].to_dict(orient='records')

        # Формируем селекторы
        market_selector = utils.Selector(
            type_selector="Market",
            label_selector="Рынок",
            selected_markets=selected_markets,
            available_markets=available_markets,
        )
        
        market_100_selector = utils.Selector(
            type_selector="100_Market",
            label_selector="100% Рынок",
            selected_markets_100=selected_markets_100,
            available_markets_100=available_markets,
        )

        return market_selector, market_100_selector
    
    def generate_raiting_product(
        self,
        column_names: list[str],
        count_product: int,
        fact: str,                        # 'U' | 'E' | 'V' ('box' | 'money' | 'kgl')
        indicator: str,                   # 'asc' | 'desc' ('best' | 'worst')
        selected_market: str,
        selected_period: list[str],
        selected_product_hierarchy: str,
        rls_restriction: dict = None,
        denormalize_columns: bool = False,
    ) -> list[dict]:
        """
        Generate product rating based on filters and sorting.

        :param column_names: List of column names to fetch.
        :param count_product: Number of products to return.
        :param fact: Metric by which to sort ('U', 'E', 'V').
        :param indicator: Sort order ('best'|'worst').
        :param selected_market: mkt_tag value to filter.
        :param selected_period: per_tag value to filter.
        :param selected_product_hierarchy: prod_tag value to filter.
        :param rls_restriction: Dictionary with RLS restriction.
        :param denormalize_columns: Whether to denormalize column names.
        :return: List of dicts for top products.
        """

        # Получение колонки факта
        fact_col = FACTS_COLUMNS_MAPPING[fact]

        # # Формирование колонк для результата
        # column_names_new = ["PROD_TAG", "FULLDESC", fact_col]

        # Фильтры
        filters = {}
        if rls_restriction and isinstance(rls_restriction, dict):
            rls_column = rls_restriction.get("column")
            rls_value = rls_restriction.get("value")
            if rls_column and rls_value:
                filters[rls_column] = rls_value
        filters["per_tag"] = selected_period if selected_period else []
        filters["mkt_tag"] = selected_market if selected_market else []
        filters["prod_tag"] = selected_product_hierarchy \
            if selected_product_hierarchy else []

        # Сортировка
        ascending = indicator == "worst"

        tp = self.get_template_processor()
        tbl, cte = self.get_from_clause(tp)
        res_columns: list = [
            column(col)
            for col in TARGET_DATASOURCE_COLUMNS['TARGET']
        ]
        filter_columns: list  = [
            column(col)
            for col in TARGET_DATASOURCE_COLUMNS['FILTERS']
        ]
        agg_columns: list = [
            column(col)
            for col in TARGET_DATASOURCE_COLUMNS['RATED']
            if col == fact_col
        ]
        if len(tbl.c) == 0:
            tbl_schema = tbl.schema
            tbl = sa.table(tbl.name, * res_columns + filter_columns + agg_columns)
            tbl.schema = tbl_schema
        qry = sa.select(* [ col.label(col.name.upper()) for col in res_columns]) \
            .select_from(tbl)
        # print(filters)
        for col, val in filters.items():
            if isinstance(val, (list, tuple, set)):
                qry = qry.where(getattr(tbl.c, col).in_(val))
            else:
                qry = qry.where(getattr(tbl.c, col) == val)
        final_order = sa.func.sum(agg_columns[0])
        qry = qry \
            .group_by(*res_columns) \
            .order_by(final_order.asc() if ascending else final_order.desc()) \
            .limit(count_product)

        result = []
        with self.database.get_sqla_engine_with_context() as engine, \
            engine.connect() as conn:
            # print(" SQL ", str(qry.compile(engine, compile_kwargs={"literal_binds": True})))
            res = conn.execute(qry)
            for row in res:
                result.append({
                    "prod_tag": row["PROD_TAG"],
                    "prod_name": row["FULLDESC"]
                })
            # print(" RESULT ", result)

        return result

    def generate_product_selector(
        self,
        column_names: list[str],
        limit: int = None,
        denormalize_columns: bool = False,
        rls_restriction: dict = None,
    ) -> utils.Selector:
        """
        Generate two selectors based on product data from specified columns.

        :param column_names: List of column names to fetch.
        :param limit: Maximum number of rows to fetch.
        :param denormalize_columns: Whether to denormalize column names.
        :param rls_restriction: Dictionary containing rls_restriction.
        :return: A Selector object.
        """
        # Получаем данные для заданных колонок
        df_product = self.data_for_columns_upper(
            column_names=column_names,
            limit=limit,
            denormalize_columns=denormalize_columns,
        )

        df_product_filtered = df_product

        if rls_restriction and isinstance(rls_restriction, dict):
            try:
                rls_column = rls_restriction.get("column")
                rls_value = rls_restriction.get("value")

                if rls_column and rls_value:
                    # есть ли колонка order_id в датасете
                    if rls_column.upper() not in df_product.columns:
                        raise ValueError(f"Column {rls_column.upper()} not found in dataset for Product selector")
                    
                    # есть ли значения order_id в списке ордеров датасета
                    valid_values = df_product[rls_column.upper()].drop_duplicates().tolist()    

                    if rls_value not in valid_values:
                        raise ValueError(f"Value '{rls_value}' not found in column {rls_column.upper()} of a Product dataset. Valid values are: {valid_values}")
                    
                    # Фильтруем данные по order_id
                    df_product_filtered = df_product[df_product[rls_column.upper()] == rls_value]

            except (IndexError, KeyError, TypeError) as e:
                raise ValueError(f"Invalid RLS configuration: {str(e)}")

        # Определяем список колонок для селектора, которые передадутся на фронт
        OUTPUT_COLUMNS = [col for col in df_product_filtered.columns if col != PROD_DISPLAY_ORDER_COLUMN and col != rls_column.upper()]

        # Удаляем дубликаты по всем колонкам Продукта, кроме prod_name и prod_level_name
        columns_to_exclude = [PROD_NAME_COLUMN, PROD_LEVEL_NAME_COLUMN, rls_column.upper()]

        df_product_no_dupes = df_product_filtered.drop_duplicates(
            subset=[col for col in df_product_filtered.columns if col not in columns_to_exclude]
        )
        # Выбираем строки с 3 наименьшими display_order
        nsmallest = df_product_no_dupes.nsmallest(3, PROD_DISPLAY_ORDER_COLUMN)

        # Выбираем строку со вторым и третьим наименьшими display_order
        selected_rows = nsmallest.iloc[1:3]

        # Выбираем строку с наименьшим display_order
        selected_row_100 = nsmallest.iloc[0]
        
        # Преобразовываем в список словарей
        selected_products = selected_rows[OUTPUT_COLUMNS].to_dict(orient='records')

        selected_products_100 = selected_row_100[OUTPUT_COLUMNS].to_dict()

        available_products = df_product_no_dupes[OUTPUT_COLUMNS].to_dict(orient='records')

        # Формируем селекторы
        product_selector = utils.Selector(
            type_selector="Product",
            label_selector="Продукт",
            selected_products=selected_products, # Подставляем вторую и третью строки из БД
            available_products=available_products,
        )

        product_100_selector = utils.Selector(
            type_selector="100_Product",
            label_selector="100% Продукт",
            selected_products_100=selected_products_100, # Подставляем первую строку из БД
            available_products_100=available_products,
        )
        
        return product_selector, product_100_selector

    def generate_product_raiting(
        self,
        column_names: list[str],
        prod_level_names: list[str],
        limit: int = None,
        denormalize_columns: bool = False,
        rls_restriction: dict = None,
    ) -> utils.Selector:
        """
        Generate two selectors based on product data from specified columns.

        :param column_names: List of column names to fetch.
        :param limit: Maximum number of rows to fetch.
        :param denormalize_columns: Whether to denormalize column names.
        :param rls_restriction: Dictionary containing rls_restriction.
        :return: A Selector object.
        """
        # Получаем данные для заданных колонок
        df_product = self.data_for_columns_upper(
            column_names=column_names,
            limit=limit,
            denormalize_columns=denormalize_columns,
        )

        df_product_filtered = df_product

        if rls_restriction and isinstance(rls_restriction, dict):
            try:
                rls_column = rls_restriction.get("column")
                rls_value = rls_restriction.get("value")

                if rls_column and rls_value:
                    # есть ли колонка order_id в датасете
                    if rls_column.upper() not in df_product.columns:
                        raise ValueError(f"Column {rls_column.upper()} not found in dataset for Product selector")
                    
                    # есть ли значения order_id в списке ордеров датасета
                    valid_values = df_product[rls_column.upper()].drop_duplicates().tolist()    

                    if rls_value not in valid_values:
                        raise ValueError(f"Value '{rls_value}' not found in column {rls_column.upper()} of a Product dataset. Valid values are: {valid_values}")
                    
                    # Фильтруем данные по order_id
                    df_product_filtered = df_product[df_product[rls_column.upper()] == rls_value]

            except (IndexError, KeyError, TypeError) as e:
                raise ValueError(f"Invalid RLS configuration: {str(e)}")

        # Определяем список колонок для селектора, которые передадутся на фронт
        OUTPUT_COLUMNS = [col for col in df_product_filtered.columns if col != PROD_DISPLAY_ORDER_COLUMN and col != rls_column.upper()]

        # Удаляем дубликаты по всем колонкам Продукта, кроме prod_name и prod_level_name
        columns_to_exclude = [PROD_NAME_COLUMN, PROD_LEVEL_NAME_COLUMN, rls_column.upper()]

        df_product_no_dupes = df_product_filtered.drop_duplicates(
            subset=[col for col in df_product_filtered.columns if col not in columns_to_exclude]
        )

        # Оставляем только строки с нужными prod_level_name
        mask = df_product_no_dupes[PROD_LEVEL_NAME_COLUMN].isin(prod_level_names)
        filtered = df_product_no_dupes[mask]

        # Берём prod_tag из этих строк (уникальные, без NaN)
        prod_tags = []
        if 'PROD_TAG' in filtered.columns:
            prod_tags = filtered['PROD_TAG'].dropna().unique().tolist()

        return prod_tags

    def values_for_column(
        self,
        column_name: str,
        limit: int = 10000,
        denormalize_column: bool = False,
    ) -> list[Any]:
        # denormalize column name before querying for values
        # unless disabled in the dataset configuration
        db_dialect = self.database.get_dialect()
        column_name_ = (
            self.database.db_engine_spec.denormalize_name(db_dialect, column_name)
            if denormalize_column
            else column_name
        )
        cols = {col.column_name: col for col in self.columns}
        target_col = cols[column_name_]
        tp = self.get_template_processor()
        tbl, cte = self.get_from_clause(tp)

        qry = (
            sa.select(
                # The alias (label) here is important because some dialects will
                # automatically add a random alias to the projection because of the
                # call to DISTINCT; others will uppercase the column names. This
                # gives us a deterministic column name in the dataframe.
                [target_col.get_sqla_col(template_processor=tp).label("column_values")]
            )
            .select_from(tbl)
            .distinct()
        )
        if limit:
            qry = qry.limit(limit)

        if self.fetch_values_predicate:
            qry = qry.where(self.get_fetch_values_predicate(template_processor=tp))

        with self.database.get_sqla_engine_with_context() as engine:
            sql = str(qry.compile(engine, compile_kwargs={"literal_binds": True}))
            sql = self._apply_cte(sql, cte)
            sql = self.mutate_query_from_config(sql)

            # pylint: disable=protected-access
            if engine.dialect.identifier_preparer._double_percents:
                sql = sql.replace("%%", "%")

            df = pd.read_sql_query(sql=sql, con=engine)
            # replace NaN with None to ensure it can be serialized to JSON
            df = df.replace({np.nan: None})
            return df["column_values"].to_list()

    def get_timestamp_expression(
        self,
        column: dict[str, Any],
        time_grain: Optional[str],
        label: Optional[str] = None,
        template_processor: Optional[BaseTemplateProcessor] = None,
    ) -> Union[TimestampExpression, Label]:
        """
        Return a SQLAlchemy Core element representation of self to be used in a query.

        :param column: column object
        :param time_grain: Optional time grain, e.g. P1Y
        :param label: alias/label that column is expected to have
        :param template_processor: template processor
        :return: A TimeExpression object wrapped in a Label if supported by db
        """
        label = label or utils.DTTM_ALIAS
        column_spec = self.db_engine_spec.get_column_spec(column.get("type"))
        type_ = column_spec.sqla_type if column_spec else sa.DateTime
        col = sa.column(column.get("column_name"), type_=type_)

        if template_processor:
            expression = template_processor.process_template(column["column_name"])
            col = sa.literal_column(expression, type_=type_)

        time_expr = self.db_engine_spec.get_timestamp_expr(col, None, time_grain)
        return self.make_sqla_column_compatible(time_expr, label)

    def convert_tbl_column_to_sqla_col(
        self,
        tbl_column: "TableColumn",
        label: Optional[str] = None,
        template_processor: Optional[BaseTemplateProcessor] = None,
    ) -> Column:
        label = label or tbl_column.column_name
        db_engine_spec = self.db_engine_spec
        column_spec = db_engine_spec.get_column_spec(self.type, db_extra=self.db_extra)
        type_ = column_spec.sqla_type if column_spec else None
        if expression := tbl_column.expression:
            if template_processor:
                expression = template_processor.process_template(expression)
            col = literal_column(expression, type_=type_)
        else:
            col = sa.column(tbl_column.column_name, type_=type_)
        col = self.make_sqla_column_compatible(col, label)
        return col
    
    
    def get_comparison_periods_year_analogous(
        self,
        selected_periods,
        period_column_name: str,
        selector_filters: Optional[list[dict]] = None,
        column_to_return: Optional[str] = None
    ) -> list[str]:
        """
        Получает периоды для аналогичного периода прошлого года, если они есть в датасете.

        :param selected_periods: Список выбранных периодов (например, ['M 2024 08', 'M 2024 09']).
        :param period_column_name: Название столбца с периодами в датасете.
        :param selector_filters: Список фильтров для применения к данным.
        :param column_to_return: название колонки которую нужно вернуть вместо period_column_name
        :return: Список периодов за прошлый год, которые есть в датасете.
        """

        if not selected_periods:
            return []
        
        comparison_dates = []
    
        for period in selected_periods:
            parts = period.split()
            date_identifier = parts[0]  # 'W' or 'M'
            year = int(parts[1])
            date_number = parts[2]
            
            previous_year = year - 1
            comparison_dates.append(f"{date_identifier} {previous_year} {date_number}")
        
        columns = [period_column_name]

        if column_to_return:
            columns.append(column_to_return.upper())
        
        if selector_filters:
            rls_column = selector_filters[0]["col"]
            rls_value = selector_filters[0]["val"]
            columns.append(rls_column.upper())

        df = self.data_for_columns_upper(column_names=columns)

        if df is None or df.empty:
            raise ValueError(f"No data returned for columns: {period_column_name}")
        
        if selector_filters:
            # Check if column exists and value is valid
            try:
                if rls_column.upper() not in df.columns:
                    raise ValueError(f"Column {rls_column.upper()} not found in dataset for Period selector")
                
                valid_values = df[rls_column.upper()].drop_duplicates().tolist()
                
                if rls_value not in valid_values:
                    raise ValueError(f"Value '{rls_value}' not found in column {rls_column.upper()} of a Period dataset. Valid values are: {valid_values}")
                    
            except (IndexError, KeyError, TypeError) as e:
                raise ValueError(f"Invalid RLS configuration: {str(e)}")

            # Filter by RLS value
            df = df[df[rls_column.upper()] == rls_value]

        available_dates = set(df[period_column_name])
        valid_comparison_dates = [date for date in comparison_dates if date in available_dates]

        if len(valid_comparison_dates) == 0:
            raise ValueError(f"No analogous period dates for {selected_periods} in a dataset")
        
        df["parsed_date"] = df[period_column_name].apply(self.parse_timestamp)

        filtered_df = df[
            df[period_column_name].isin(valid_comparison_dates)
        ]

        # .sort_values(by="parsed_date")
        if column_to_return:
            filtered_df.sort_values(by="parsed_date")
            return filtered_df[[period_column_name, column_to_return]]
        else:
            return filtered_df[period_column_name].sort_values().to_list()
    

    def get_comparison_periods_previous(
        self, 
        selected_periods, 
        period_column_name: str,
        selector_filters: Optional[list[dict]] = None,
        column_to_return: Optional[str] = None
    ):
        """
        Получает предыдущий аналогичный период относительно переданных дат.
        
        :param selected_periods: список периодов вида ['M 2024 08', 'M 2024 09']
        :param period_column_name: название колонки с периодами в датасете
        :param selector_filters: Список фильтров для применения к данным.
        :param column_to_return: название колонки которую нужно вернуть вместо period_column_name
        :return: список доступных периодов за предыдущий аналогичный интервал
        """
        
        if not selected_periods:
            return []
        
        granularity = selected_periods[0][0]

        selected_dates = [self.parse_timestamp(p) for p in set(selected_periods)]

        if len(selected_dates) == 1:
            if granularity in ['M', 'R']:
                start_prev_period = selected_dates[0] - pd.DateOffset(months=1)
                end_prev_period = start_prev_period
            elif granularity == 'W':
                start_prev_period = None
                end_prev_period = None
            else:
                raise ValueError(f"Unknown granularity: {granularity}")
        
        else:
            min_selected_date = min(selected_dates)
            max_selected_date = max(selected_dates)
            time_delta = max_selected_date - min_selected_date
            
            if granularity in ['M', 'R']:
                start_prev_period = min_selected_date - pd.DateOffset(months=(time_delta.days // 30 + 1))
                end_prev_period = max_selected_date - pd.DateOffset(months=(time_delta.days // 30 + 1))
            elif granularity == 'W':
                start_prev_period = min_selected_date - pd.Timedelta(weeks=time_delta.days // 7 + 1)
                end_prev_period = max_selected_date - pd.Timedelta(weeks=time_delta.days // 7 + 1)
            else:
                raise ValueError(f"Unknown granularity: {granularity}")

        columns = [period_column_name]

        if column_to_return:
            columns.append(column_to_return)

        if selector_filters:
            rls_column = selector_filters[0]["col"]        
            rls_value = selector_filters[0]["val"]
            columns.append(rls_column.upper())

        df = self.data_for_columns_upper(column_names=columns)

        if df is None or df.empty:
            raise ValueError(f"No data returned for columns: {period_column_name}")
        
        if selector_filters:
            # Check if column exists and value is valid
            try:
                if rls_column.upper() not in df.columns:
                    raise ValueError(f"Column {rls_column.upper()} not found in dataset for Period selector")
                
                valid_values = df[rls_column.upper()].drop_duplicates().tolist()
                
                if rls_value not in valid_values:
                    raise ValueError(f"Value '{rls_value}' not found in column {rls_column.upper()} of a Period dataset. Valid values are: {valid_values}")
                    
            except (IndexError, KeyError, TypeError) as e:
                raise ValueError(f"Invalid RLS configuration: {str(e)}")

            # Filter by RLS value
            df = df[df[rls_column.upper()] == rls_value]

        df["parsed_date"] = df[period_column_name].apply(self.parse_timestamp)

        if len(selected_periods) == 1 and granularity == 'W':
            df_sorted = df.drop_duplicates(subset=period_column_name).sort_values(by="parsed_date")
            
            # находим индекс выбранного периода
            periods_list = df_sorted[period_column_name].tolist()
            current_idx = periods_list.index(selected_periods[0])
            
            if current_idx > 0:
                return [periods_list[current_idx - 1]]
            else:
                return [] #raise ValueError(f"No previous period for {selected_periods[0]}")

        else:
            prev_periods_df = df[(df["parsed_date"] >= start_prev_period) & (df["parsed_date"] <= end_prev_period)]

        # sort_values(by="parsed_date")
        if column_to_return:
            prev_periods_df.sort_values(by="parsed_date")
            return prev_periods_df[[period_column_name, column_to_return]]
        else:
            return prev_periods_df[period_column_name].sort_values().tolist()


    def get_period_tags_by_selected_value(
        self,
        selected_value: str,
        order_id_filter: int
    ) -> list[str]:
        """
        Returns list of period tags for selected value, using order_id as a filter
        Using table structure like the table `period_order`
        """

        is_YTD: bool = False
        if selected_value not in PERIOD_MAPPING_SELECTOR:
            raise ValueError(f"Unsupported period value: {selected_value}")
        if selected_value in ('YTD_week', 'YTD_month'):
            period_type = 'week' if selected_value == 'YTD_week' else 'month'
            period_count = 0
            is_YTD = True
        else:
            period_params = PERIOD_MAPPING_SELECTOR.get(selected_value, {})
            period_type = period_params.get("period_type")
            period_count = period_params.get("period_count")

        tp = self.get_template_processor()
        tbl, cte = self.get_from_clause(tp)
        table_columns: list = [column(col) \
            for col in SELECTOR_COLUMNS['Period_order']] + \
                [column('order_id')] + \
                [column(col) for col in SELECTOR_COLUMNS['Period_order names']]
        tbl1 = sa.table(tbl.name, *table_columns)
        tbl1.schema = tbl.schema
        group_and_sel_cols: list[ColumnClause] = [
            getattr(tbl1.c, SELECTOR_COLUMNS['Period_order'][0])
        ]
        start_period_letter: str = 'W' if period_type == 'week' else 'R'
        qry = sa.select(group_and_sel_cols) \
            .select_from(tbl1) \
            .where(tbl1.c.order_id == order_id_filter) \
            .group_by(*group_and_sel_cols) \
            .order_by(*[g.desc() for g in group_and_sel_cols])
        if is_YTD:
            subq = sa.select(sa.func.left(tbl1.c.per_tag, 5)) \
                .select_from(tbl1) \
                .where(tbl1.c.order_id == order_id_filter) \
                .where(sa.func.left(tbl1.c.per_tag, 1) == start_period_letter) \
                .order_by(tbl1.c.per_tag.desc()) \
                .limit(1) \
                .scalar_subquery()
            qry = qry.where(sa.func.left(tbl1.c.per_tag, 5) == subq)
        else:
            qry = qry.where(sa.func.left(tbl1.c.per_tag, 1) == start_period_letter) \
                .limit(period_count)

        engine: Engine
        res_tags: list[str] = []
        with self.database.get_sqla_engine_with_context() as engine, \
                engine.connect() as conn:
            # print(' PERIOD SQL ', str(qry.compile(engine, compile_kwargs={"literal_binds": True})))
            res = conn.execute(qry)
            for row in res:
                res_tags.append(row[SELECTOR_COLUMNS['Period_order'][0]])
            # print(' PERIODS ', res_tags)
        return res_tags


    def get_periods_by_selected_value(
        self,
        selected_period: str,
        period_column_name: str,
        selector_filters: Optional[list[dict]] = None,
        column_to_return: Optional[str] = None
    ) -> list:
        """
        Returns periods based on predefined period selections.
        
        :param selected_period: Key from PERIOD_MAPPING_SELECTOR (e.g. 'last_4_weeks')
        :param period_column_name: Column with period identifiers
        :param selector_filters: List of filters to apply to the data
        :param column_to_return: Column name to return instead of period_column_name
        :return: List of periods matching the selected criteria
        """

        period_params = PERIOD_MAPPING_SELECTOR.get(selected_period, {})
        period_type = period_params.get("period_type")
        period_count = period_params.get("period_count")

        columns = [period_column_name]

        if column_to_return:
            columns.append(column_to_return.upper())

        if selector_filters:
            rls_column = selector_filters[0]["col"]        
            rls_value = selector_filters[0]["val"]
            columns.append(rls_column.upper())

        df = self.data_for_columns_upper(column_names=columns)
        #for r in df:
        #    print(r)
        if selector_filters:
            # Проверяем, есть ли значение в списке уникальных значений
            try:
                # есть ли колонка order_id в датасете
                if rls_column.upper() not in df.columns:
                    raise ValueError(f"Column {rls_column.upper()} not found in dataset for Period selector")
                
                # есть ли значения order_id в списке ордеров датасета
                valid_values = df[rls_column.upper()].drop_duplicates().tolist()
                
                if rls_value not in valid_values:
                    raise ValueError(f"Value '{rls_value}' not found in column {rls_column.upper()} of a Period dataset. Valid values are: {valid_values}")
                
            except (IndexError, KeyError, TypeError) as e:
                raise ValueError(f"Invalid RLS configuration: {str(e)}")

            # Фильтруем данные по order_id
            df = df[df[rls_column.upper()] == rls_value]

        df["parsed_date"] = df[period_column_name].apply(self.parse_timestamp)

        filtered_sorted_df = self.filter_period(df, period_type, period_count)

        if column_to_return:
            return filtered_sorted_df[[period_column_name, column_to_return]]
        else:
            return filtered_sorted_df[period_column_name].to_list()


    def get_custom_periods_by_selected_value(
        self,
        selected_period: str,
        period_column_name: str,
        selector_filters: Optional[list[dict]] = None,
        column_to_return: Optional[str] = None
    ) -> list:
        """
        Returns periods within specified date range.
        
        :param selected_period: Period range (e.g. 'M 2024 01:M 2024 12')
        :param period_column_name: Column with period identifiers
        :param selector_filters: List of filters to apply to the data
        :param column_to_return: Column name to return instead of period_column_name
        :return: List of periods within selected range
        """
        min_per_name, max_per_name = self.parse_period_name(selected_period)

        columns = [period_column_name]

        if column_to_return:
            columns.append(column_to_return.upper())

        if selector_filters:
            rls_column = selector_filters[0]["col"]        
            rls_value = selector_filters[0]["val"]
            columns.append(rls_column.upper())

        df = self.data_for_columns_upper(column_names=columns)

        if selector_filters:
            # Проверяем, есть ли значение в списке уникальных значений
            try:
                # есть ли колонка order_id в датасете
                if rls_column.upper() not in df.columns:
                    raise ValueError(f"Column {rls_column.upper()} not found in dataset for Period selector")
                
                # есть ли значения order_id в списке ордеров датасета
                valid_values = df[rls_column.upper()].drop_duplicates().tolist()
                
                if rls_value not in valid_values:
                    raise ValueError(f"Value '{rls_value}' not found in column {rls_column.upper()} of a Period dataset. Valid values are: {valid_values}")
                
            except (IndexError, KeyError, TypeError) as e:
                raise ValueError(f"Invalid RLS configuration: {str(e)}")
            
            # Фильтруем данные по order_id
            df = df[df[rls_column.upper()] == rls_value]
        
        df["parsed_date"] = df[period_column_name].apply(self.parse_timestamp)

        min_date, max_date = self.parse_timestamp(min_per_name), self.parse_timestamp(max_per_name)

        filtered_df = df[(df["parsed_date"] >= min_date) & (df["parsed_date"] <= max_date)]

        if column_to_return:
            filtered_df.sort_values(by="parsed_date")
            return filtered_df[[period_column_name, column_to_return]]
        else:
            return filtered_df[period_column_name].to_list()
        
 
    def parse_timestamp(
        self,
        timestamp
    ) -> pd.Timestamp:
        """Parses a timestamp string into a pandas Timestamp object."""
        if timestamp is None:
            raise ValueError(f"None timestamp received: '{timestamp}', type: {type(timestamp)}")
        
        if not timestamp:
            raise ValueError(f"Invalid timestamp received: {timestamp}")

        granularity = timestamp[0]
        
        year = int(timestamp[2:6])
        value = int(timestamp[7:])
        
        if granularity == 'W':
            return pd.to_datetime(f'{year}-W{value}-1', format='%G-W%V-%u')
        elif granularity in {'M', 'R'}:
            return pd.Timestamp(year=year, month=value, day=1)
        else:
            raise ValueError(f"Unknown granularity: {granularity}")
            

    def parse_period_name(self, selected_value: str) -> tuple[str, str]:
        """
        Converts human-readable period names to standardized format.
        
        :param selected_value: Period range string in format 'M 2024 01:M 2024 12' or 'W 2024 01:W 2024 52'
        :return: Tuple of formatted start and end periods in a per_name column format
        """
        try:
            # Split the input into start and end periods
            min_per_name, max_per_name = selected_value.split(':')
            return min_per_name, max_per_name
        except ValueError:
            raise ValueError(f"Invalid period format: '{selected_value}'. Expected format: 'M 2024 01:M 2024 12'")


    def filter_period(
        self, 
        df: pd.DataFrame, 
        period_type: str, 
        period_count: int
    ) -> pd.DataFrame:
        """
        Filters the DataFrame based on the given period type and count.
        
        :param df: Input DataFrame
        :param period_type: Type of period ('week', 'month', 'YTD')
        :param period_count: Number of periods to filter
        :return: Filtered DataFrame
        """
        last_date = df["parsed_date"].max()

        if period_type == 'week':
            threshold = last_date - pd.Timedelta(weeks=period_count)
        elif period_type == 'month':
            threshold = last_date - pd.DateOffset(months=period_count)
        elif period_type == 'YTD':
            start_of_year = pd.Timestamp(year=last_date.year, month=1, day=1)
            return df[
                (df["parsed_date"] >= start_of_year) & 
                (df["parsed_date"] <= last_date)
            ].sort_values(by="parsed_date")
        else:
            raise ValueError(f"Invalid period type: '{period_type}', {df.head()}. Use 'week', 'month', or 'YTD'.")

        # should work because YTD returns earlier and here we have only week and month period_type
        return df[
            (df["parsed_date"] > threshold)
        ].sort_values(by="parsed_date")


    def get_period_values(
            self,
            selector: utils.Selector,
            period_column_name: str,
            from_table: TableClause
    ) -> list[str]:
        """
        Processes the `selector` parameters and adds the appropriate conditions to the SQL query.

        :param selector: dict with selector configuration.
        :param period_column_name: Name of the column in the table.
        :param from_table: Table object for SQL query.
        :return: List of unique filtered period values.
        """

        selected_value = selector.get("selected_period")
        options = selector.get("avaliable_periods", [])
        period_selector_type = selector.get("period_selector_type")

        # Validate selected value
        if not any(option["value"] == selected_value and option["available"] for option in options):
            logger.info(f"Invalid selection in '{selector['label_selector']}': '{selected_value}' is not available.")

        period_params = PERIOD_MAPPING_SELECTOR.get(selected_value, {})

        # Extract filter parameters
        if period_selector_type == 'Custom':
            period_type = period_selector_type 
        else: 
            period_type = period_params.get("period_type")

        # Generate SQL query and fetch data
        selector_query = sa.select(Column(period_column_name)).select_from(from_table)
        compiled_query = self.database.compile_sqla_query(selector_query)

        df = self.database.get_df(compiled_query)

        # Parse and filter data
        if df is None or df.empty:
            raise ValueError(f"No data returned for dataset with Period selector. Empty query result: {compiled_query}")
        
        if period_column_name not in df.columns:
            raise ValueError(f"Column '{period_column_name}' not found in DataFrame")

        df["parsed_date"] = df[period_column_name].apply(self.parse_timestamp)

        # Обработка кастомных периодов
        if period_type == 'Custom':
            try:
                min_per_name, max_per_name = self.parse_period_name(selected_value)
                min_date = self.parse_timestamp(min_per_name)
                max_date = self.parse_timestamp(max_per_name)
                
                filtered_df = df[
                    (df["parsed_date"] >= min_date) &
                    (df["parsed_date"] <= max_date)
                ].sort_values(by="parsed_date", ascending=True)
            except Exception as e:
                raise ValueError(f"Error processing custom period '{selected_value}': {str(e)}")
        else: # обработка не кастомных периодов 
            period_count = period_params.get("period_count")
            filtered_df = self.filter_period(df, period_type, period_count)

        # Return unique period values
        unique_values = filtered_df[period_column_name].unique().tolist()

        return unique_values


    def get_fact_from_datasource(
            self,
            datasource_id: int,
            datasource_type: str,
            row_id: int,
            column: str
    ):
        from superset.daos.datasource import DatasourceDAO
        from superset.daos.exceptions import DatasourceNotFound, DatasourceTypeNotSupportedError
        try:
            datasource = DatasourceDAO.get_datasource(
                DatasourceType(datasource_type), datasource_id
            )
            datasource.raise_for_access()
        except ValueError:
            raise ValueError(f"Invalid datasource type: {datasource_type}")
        except DatasourceTypeNotSupportedError as ex:
            raise DatasourceTypeNotSupportedError(ex.message)
        except DatasourceNotFound as ex:
            raise DatasourceNotFound(ex.message)
        except SupersetSecurityException as ex:
            raise SupersetSecurityException(ex.message)

        denormalize_columns = not datasource.normalize_columns
        columns_to_extract = [
                    ID_COLUMN,
                    TARGET_COLUMN_FOR_RULE,
                    SQL_RULE_COLUMN,
                    column
                    ]

        def get_fact_df(
                datasource: DatasourceDAO,
                columns_to_extract: list[str],
                denormalize_columns: bool = False,
        ):
            columns_upper = [col.upper() for col in columns_to_extract]
            db_dialect = datasource.database.get_dialect()

            # Denormalize column names if required
            column_names_ = [
                datasource.database.db_engine_spec.denormalize_name(db_dialect, col)
                if denormalize_columns else col
                for col in columns_upper
            ]

            # Build a map of available columns (uppercase for consistency)
            cols = {col.column_name.upper(): col for col in datasource.columns}

            # Validate and retrieve the target columns
            target_cols = [cols[col_name] for col_name in column_names_ if col_name in cols]
            if len(target_cols) != len(columns_upper):
                missing = set(columns_upper) - set(cols.keys())
                raise ValueError(f"Columns not found in dataset: {missing}")

            tp = datasource.get_template_processor()
            tbl, cte = datasource.get_from_clause(tp)

            # Build the SQLAlchemy query
            qry = (
                sa.select([
                    target_col.get_sqla_col(template_processor=tp).label(col_name)
                    for target_col, col_name in zip(target_cols, columns_to_extract)
                ])
                .select_from(tbl)
            )

            if datasource.fetch_values_predicate:
                qry = qry.where(datasource.get_fetch_values_predicate(template_processor=tp))

            with datasource.database.get_sqla_engine_with_context() as engine:
                sql = str(qry.compile(engine, compile_kwargs={"literal_binds": True}))
                sql = datasource._apply_cte(sql, cte)
                sql = datasource.mutate_query_from_config(sql)

                # Handle dialect-specific SQL adjustments
                if engine.dialect.identifier_preparer._double_percents:
                    sql = sql.replace("%%", "%")

                # Execute the query and fetch the results
                df = pd.read_sql_query(sql=sql, con=engine)

                # Replace NaN with None to ensure JSON serializability
                df = df.replace({np.nan: None})

                return df

        def escape_columns_in_formula(formula):
            try:
                def replacer(match):
                    return match.group(1) + '\"' + match.group(2) + '\"' + match.group(3)
                pattern = r'(\b\w+\()([A-Za-z0-9_]+)(\))'
                return re.sub(pattern, replacer, formula)
            except:
                raise ValueError(f"Incorrect value in SQL RULE COLUMN for FACT selector")

        df_fact = get_fact_df(
            datasource=datasource,
            columns_to_extract=columns_to_extract,
            denormalize_columns=denormalize_columns
        )

        sql_expression_col = df_fact.loc[df_fact[ID_COLUMN] == row_id, SQL_RULE_COLUMN].iloc[0]
        sql_expression = escape_columns_in_formula(sql_expression_col)

        label = df_fact.loc[df_fact[ID_COLUMN] == row_id, column].iloc[0]

        return sql_expression, label


    def get_sqla_query(  # pylint: disable=too-many-arguments,too-many-locals,too-many-branches,too-many-statements
        self,
        apply_fetch_values_predicate: bool = False,
        columns: Optional[list[Column]] = None,
        extras: Optional[dict[str, Any]] = None,
        filter: Optional[  # pylint: disable=redefined-builtin
            list[utils.QueryObjectFilterClause]
        ] = None,
        selectors: Optional[
            list[utils.Selector]
        ] = None,
        korus_export_info: Optional[utils.KorusExportInfo] = None,
        rls_restriction: Optional[list[dict]] = None,
        from_dttm: Optional[datetime] = None,
        granularity: Optional[str] = None,
        groupby: Optional[list[Column]] = None,
        inner_from_dttm: Optional[datetime] = None,
        inner_to_dttm: Optional[datetime] = None,
        is_rowcount: bool = False,
        is_timeseries: bool = True,
        metrics: Optional[list[Metric]] = None,
        orderby: Optional[list[OrderBy]] = None,
        order_desc: bool = True,
        to_dttm: Optional[datetime] = None,
        series_columns: Optional[list[Column]] = None,
        series_limit: Optional[int] = None,
        series_limit_metric: Optional[Metric] = None,
        row_limit: Optional[int] = None,
        row_offset: Optional[int] = None,
        timeseries_limit: Optional[int] = None,
        timeseries_limit_metric: Optional[Metric] = None,
        time_shift: Optional[str] = None,
    ) -> SqlaQuery:
        """Querying any sqla table from this common interface"""
        if granularity not in self.dttm_cols and granularity is not None:
            granularity = self.main_dttm_col

        extras = extras or {}
        time_grain = extras.get("time_grain_sqla")

        template_kwargs = {
            "columns": columns,
            "from_dttm": from_dttm.isoformat() if from_dttm else None,
            "groupby": groupby,
            "metrics": metrics,
            "row_limit": row_limit,
            "row_offset": row_offset,
            "time_column": granularity,
            "time_grain": time_grain,
            "to_dttm": to_dttm.isoformat() if to_dttm else None,
            "table_columns": [col.column_name for col in self.columns],
            "filter": filter,
        }
        columns = columns or []
        groupby = groupby or []
        rejected_adhoc_filters_columns: list[Union[str, ColumnTyping]] = []
        applied_adhoc_filters_columns: list[Union[str, ColumnTyping]] = []
        db_engine_spec = self.db_engine_spec
        series_column_labels = [
            db_engine_spec.make_label_compatible(column)
            for column in utils.get_column_names(
                columns=series_columns or [],
            )
        ]
        # deprecated, to be removed in 2.0
        if is_timeseries and timeseries_limit:
            series_limit = timeseries_limit
        series_limit_metric = series_limit_metric or timeseries_limit_metric
        template_kwargs.update(self.template_params_dict)
        extra_cache_keys: list[Any] = []
        template_kwargs["extra_cache_keys"] = extra_cache_keys
        removed_filters: list[str] = []
        applied_template_filters: list[str] = []
        template_kwargs["removed_filters"] = removed_filters
        template_kwargs["applied_filters"] = applied_template_filters
        template_processor = self.get_template_processor(**template_kwargs)
        prequeries: list[str] = []
        orderby = orderby or []
        need_groupby = bool(metrics is not None or groupby)
        metrics = metrics or []

        # For backward compatibility
        if granularity not in self.dttm_cols and granularity is not None:
            granularity = self.main_dttm_col

        columns_by_name: dict[str, "TableColumn"] = {
            col.column_name: col for col in self.columns
        }

        metrics_by_name: dict[str, "SqlMetric"] = {
            m.metric_name: m for m in self.metrics
        }

        if not granularity and is_timeseries:
            raise QueryObjectValidationError(
                _(
                    "Datetime column not provided as part table configuration "
                    "and is required by this type of chart"
                )
            )
        if not metrics and not columns and not groupby:
            raise QueryObjectValidationError(_("Empty query?"))

        for selector in selectors:
            if selector['type_selector'] == "Fact":
                selected_fact = selector.get("selected_fact", None)
                if not selected_fact or selected_fact == NO_SELECTOR:
                    continue
                sql_expression, label = self.get_fact_from_datasource(
                    datasource_id=selected_fact['datasource_id'],
                    datasource_type=selected_fact['datasource_type'],
                    row_id=selected_fact['row_id'],
                    column=selected_fact['column']
                )
                if metrics:
                    metrics = []
                    metrics.append(
                        AdhocMetric(
                            aggregate=None,
                            column=None,
                            expressionType="SQL",
                            hasCustomLabel=True,
                            label=label,
                            sqlExpression=sql_expression
                        )
                    )
                    orderby = []
                    orderby.append(
                        tuple(
                            [
                                AdhocMetric(
                                    aggregate=None,
                                    column=None,
                                    expressionType="SQL",
                                    hasCustomLabel=True,
                                    label=label,
                                    sqlExpression=sql_expression
                                ),
                                False
                            ]
                        )
                    )
                else:
                    raise ValueError(f"impossible to apply a fact selector, because the original chart has more or less one FACT")

        metrics_exprs: list[ColumnElement] = []
        for metric in metrics:
            if utils.is_adhoc_metric(metric):
                assert isinstance(metric, dict)
                metrics_exprs.append(
                    self.adhoc_metric_to_sqla(
                        metric=metric,
                        columns_by_name=columns_by_name,
                        template_processor=template_processor,
                    )
                )
            elif isinstance(metric, str) and metric in metrics_by_name:
                metrics_exprs.append(
                    metrics_by_name[metric].get_sqla_col(
                        template_processor=template_processor
                    )
                )
            else:
                raise QueryObjectValidationError(
                    _("Metric '%(metric)s' does not exist", metric=metric)
                )

        if metrics_exprs:
            main_metric_expr = metrics_exprs[0]
        else:
            main_metric_expr, label = literal_column("COUNT(*)"), "ccount"
            main_metric_expr = self.make_sqla_column_compatible(main_metric_expr, label)

        # To ensure correct handling of the ORDER BY labeling we need to reference the
        # metric instance if defined in the SELECT clause.
        # use the key of the ColumnClause for the expected label
        metrics_exprs_by_label = {m.key: m for m in metrics_exprs}
        metrics_exprs_by_expr = {str(m): m for m in metrics_exprs}

        # Since orderby may use adhoc metrics, too; we need to process them first
        orderby_exprs: list[ColumnElement] = []
        for orig_col, ascending in orderby:
            col: Union[AdhocMetric, ColumnElement] = orig_col
            if isinstance(col, dict):
                col = cast(AdhocMetric, col)
                if col.get("sqlExpression"):
                    col["sqlExpression"] = self._process_sql_expression(
                        expression=col["sqlExpression"],
                        database_id=self.database_id,
                        schema=self.schema,
                        template_processor=template_processor,
                    )
                if utils.is_adhoc_metric(col):
                    # add adhoc sort by column to columns_by_name if not exists
                    col = self.adhoc_metric_to_sqla(col, columns_by_name)
                    # if the adhoc metric has been defined before
                    # use the existing instance.
                    col = metrics_exprs_by_expr.get(str(col), col)
                    need_groupby = True
            elif col in columns_by_name:
                col = self.convert_tbl_column_to_sqla_col(
                    columns_by_name[col], template_processor=template_processor
                )
            elif col in metrics_exprs_by_label:
                col = metrics_exprs_by_label[col]
                need_groupby = True
            elif col in metrics_by_name:
                col = metrics_by_name[col].get_sqla_col(
                    template_processor=template_processor
                )
                need_groupby = True

            if isinstance(col, ColumnElement):
                orderby_exprs.append(col)
            else:
                # Could not convert a column reference to valid ColumnElement
                raise QueryObjectValidationError(
                    _("Unknown column used in orderby: %(col)s", col=orig_col)
                )

        select_exprs: list[Union[Column, Label]] = []
        groupby_all_columns = {}
        groupby_series_columns = {}

        # filter out the pseudo column  __timestamp from columns
        columns = [col for col in columns if col != utils.DTTM_ALIAS]
        dttm_col = columns_by_name.get(granularity) if granularity else None

        if need_groupby:
            # dedup columns while preserving order
            columns = groupby or columns
            for selected in columns:
                if isinstance(selected, str):
                    # if groupby field/expr equals granularity field/expr
                    if selected == granularity:
                        table_col = columns_by_name[selected]
                        outer = table_col.get_timestamp_expression(
                            time_grain=time_grain,
                            label=selected,
                            template_processor=template_processor,
                        )
                    # if groupby field equals a selected column
                    elif selected in columns_by_name:
                        outer = self.convert_tbl_column_to_sqla_col(
                            columns_by_name[selected],
                            template_processor=template_processor,
                        )
                    else:
                        selected = validate_adhoc_subquery(
                            selected,
                            self.database_id,
                            self.schema,
                        )
                        outer = literal_column(f"({selected})")
                        outer = self.make_sqla_column_compatible(outer, selected)
                else:
                    outer = self.adhoc_column_to_sqla(
                        col=selected, template_processor=template_processor
                    )
                groupby_all_columns[outer.name] = outer
                if (
                    is_timeseries and not series_column_labels
                ) or outer.name in series_column_labels:
                    groupby_series_columns[outer.name] = outer
                select_exprs.append(outer)
        elif columns:
            for selected in columns:
                if is_adhoc_column(selected):
                    _sql = selected["sqlExpression"]
                    _column_label = selected["label"]
                elif isinstance(selected, str):
                    _sql = selected
                    _column_label = selected

                selected = validate_adhoc_subquery(
                    _sql,
                    self.database_id,
                    self.schema,
                )

                select_exprs.append(
                    self.convert_tbl_column_to_sqla_col(
                        columns_by_name[selected], template_processor=template_processor
                    )
                    if isinstance(selected, str) and selected in columns_by_name
                    else self.make_sqla_column_compatible(
                        literal_column(selected), _column_label
                    )
                )
            metrics_exprs = []

        if granularity:
            if granularity not in columns_by_name or not dttm_col:
                raise QueryObjectValidationError(
                    _(
                        'Time column "%(col)s" does not exist in dataset',
                        col=granularity,
                    )
                )
            time_filters = []

            if is_timeseries:
                timestamp = dttm_col.get_timestamp_expression(
                    time_grain=time_grain, template_processor=template_processor
                )
                # always put timestamp as the first column
                select_exprs.insert(0, timestamp)
                groupby_all_columns[timestamp.name] = timestamp

            # Use main dttm column to support index with secondary dttm columns.
            if (
                self.always_filter_main_dttm
                and self.main_dttm_col in self.dttm_cols
                and self.main_dttm_col != dttm_col.column_name
            ):
                time_filters.append(
                    self.get_time_filter(
                        time_col=columns_by_name[self.main_dttm_col],
                        start_dttm=from_dttm,
                        end_dttm=to_dttm,
                        template_processor=template_processor,
                    )
                )

            time_filter_column = self.get_time_filter(
                time_col=dttm_col,
                start_dttm=from_dttm,
                end_dttm=to_dttm,
                template_processor=template_processor,
            )
            time_filters.append(time_filter_column)

        # Always remove duplicates by column name, as sometimes `metrics_exprs`
        # can have the same name as a groupby column (e.g. when users use
        # raw columns as custom SQL adhoc metric).
        select_exprs = remove_duplicates(
            select_exprs + metrics_exprs, key=lambda x: x.name
        )

        # Expected output columns
        labels_expected = [c.key for c in select_exprs]

        # Order by columns are "hidden" columns, some databases require them
        # always be present in SELECT if an aggregation function is used
        if not db_engine_spec.allows_hidden_orderby_agg:
            select_exprs = remove_duplicates(select_exprs + orderby_exprs)

        qry = sa.select(select_exprs)

        tbl, cte = self.get_from_clause(template_processor)

        if groupby_all_columns:
            qry = qry.group_by(*groupby_all_columns.values())

        where_clause_and = []
        having_clause_and = []

        for flt in filter:  # type: ignore
            if not all(flt.get(s) for s in ["col", "op"]):
                continue
            flt_col = flt["col"]
            val = flt.get("val")
            flt_grain = flt.get("grain")
            op = flt["op"].upper()
            col_obj: Optional["TableColumn"] = None
            sqla_col: Optional[Column] = None
            if flt_col == utils.DTTM_ALIAS and is_timeseries and dttm_col:
                col_obj = dttm_col
            elif is_adhoc_column(flt_col):
                try:
                    sqla_col = self.adhoc_column_to_sqla(flt_col, force_type_check=True)
                    applied_adhoc_filters_columns.append(flt_col)
                except ColumnNotFoundException:
                    rejected_adhoc_filters_columns.append(flt_col)
                    continue
            else:
                col_obj = columns_by_name.get(cast(str, flt_col))
            filter_grain = flt.get("grain")

            if get_column_name(flt_col) in removed_filters:
                # Skip generating SQLA filter when the jinja template handles it.
                continue

            if col_obj or sqla_col is not None:
                if sqla_col is not None:
                    pass
                elif col_obj and filter_grain:
                    sqla_col = col_obj.get_timestamp_expression(
                        time_grain=filter_grain, template_processor=template_processor
                    )
                elif col_obj:
                    sqla_col = self.convert_tbl_column_to_sqla_col(
                        tbl_column=col_obj, template_processor=template_processor
                    )
                col_type = col_obj.type if col_obj else None
                col_spec = db_engine_spec.get_column_spec(native_type=col_type)
                is_list_target = op in (
                    utils.FilterOperator.IN.value,
                    utils.FilterOperator.NOT_IN.value,
                )

                col_advanced_data_type = col_obj.advanced_data_type if col_obj else ""

                if col_spec and not col_advanced_data_type:
                    target_generic_type = col_spec.generic_type
                else:
                    target_generic_type = GenericDataType.STRING
                eq = self.filter_values_handler(
                    values=val,
                    operator=op,
                    target_generic_type=target_generic_type,
                    target_native_type=col_type,
                    is_list_target=is_list_target,
                    db_engine_spec=db_engine_spec,
                )
                if (
                    col_advanced_data_type != ""
                    and feature_flag_manager.is_feature_enabled(
                        "ENABLE_ADVANCED_DATA_TYPES"
                    )
                    and col_advanced_data_type in ADVANCED_DATA_TYPES
                ):
                    values = eq if is_list_target else [eq]  # type: ignore
                    bus_resp: AdvancedDataTypeResponse = ADVANCED_DATA_TYPES[
                        col_advanced_data_type
                    ].translate_type(
                        {
                            "type": col_advanced_data_type,
                            "values": values,
                        }
                    )
                    if bus_resp["error_message"]:
                        raise AdvancedDataTypeResponseError(
                            _(bus_resp["error_message"])
                        )

                    where_clause_and.append(
                        ADVANCED_DATA_TYPES[col_advanced_data_type].translate_filter(
                            sqla_col, op, bus_resp["values"]
                        )
                    )
                elif is_list_target:
                    assert isinstance(eq, (tuple, list))
                    if len(eq) == 0:
                        raise QueryObjectValidationError(
                            _("Filter value list cannot be empty")
                        )
                    if len(eq) > len(
                        eq_without_none := [x for x in eq if x is not None]
                    ):
                        is_null_cond = sqla_col.is_(None)
                        if eq:
                            cond = or_(is_null_cond, sqla_col.in_(eq_without_none))
                        else:
                            cond = is_null_cond
                    else:
                        cond = sqla_col.in_(eq)
                    if op == utils.FilterOperator.NOT_IN.value:
                        cond = ~cond
                    where_clause_and.append(cond)
                elif op == utils.FilterOperator.IS_NULL.value:
                    where_clause_and.append(sqla_col.is_(None))
                elif op == utils.FilterOperator.IS_NOT_NULL.value:
                    where_clause_and.append(sqla_col.isnot(None))
                elif op == utils.FilterOperator.IS_TRUE.value:
                    where_clause_and.append(sqla_col.is_(True))
                elif op == utils.FilterOperator.IS_FALSE.value:
                    where_clause_and.append(sqla_col.is_(False))
                else:
                    if (
                        op
                        not in {
                            utils.FilterOperator.EQUALS.value,
                            utils.FilterOperator.NOT_EQUALS.value,
                        }
                        and eq is None
                    ):
                        raise QueryObjectValidationError(
                            _(
                                "Must specify a value for filters "
                                "with comparison operators"
                            )
                        )
                    if op == utils.FilterOperator.EQUALS.value:
                        where_clause_and.append(sqla_col == eq)
                    elif op == utils.FilterOperator.NOT_EQUALS.value:
                        where_clause_and.append(sqla_col != eq)
                    elif op == utils.FilterOperator.GREATER_THAN.value:
                        where_clause_and.append(sqla_col > eq)
                    elif op == utils.FilterOperator.LESS_THAN.value:
                        where_clause_and.append(sqla_col < eq)
                    elif op == utils.FilterOperator.GREATER_THAN_OR_EQUALS.value:
                        where_clause_and.append(sqla_col >= eq)
                    elif op == utils.FilterOperator.LESS_THAN_OR_EQUALS.value:
                        where_clause_and.append(sqla_col <= eq)
                    elif op in {
                        utils.FilterOperator.ILIKE.value,
                        utils.FilterOperator.LIKE.value,
                    }:
                        if target_generic_type != GenericDataType.STRING:
                            sqla_col = sa.cast(sqla_col, sa.String)

                        if op == utils.FilterOperator.LIKE.value:
                            where_clause_and.append(sqla_col.like(eq))
                        else:
                            where_clause_and.append(sqla_col.ilike(eq))
                    elif (
                        op == utils.FilterOperator.TEMPORAL_RANGE.value
                        and isinstance(eq, str)
                        and col_obj is not None
                    ):
                        _since, _until = get_since_until_from_time_range(
                            time_range=eq,
                            time_shift=time_shift,
                            extras=extras,
                        )
                        where_clause_and.append(
                            self.get_time_filter(
                                time_col=col_obj,
                                start_dttm=_since,
                                end_dttm=_until,
                                time_grain=flt_grain,
                                label=sqla_col.key,
                                template_processor=template_processor,
                            )
                        )
                    else:
                        raise QueryObjectValidationError(
                            _("Invalid filter operation type: %(op)s", op=op)
                        )
        where_clause_and += self.get_sqla_row_level_filters(template_processor)

        #TODO: figure out GenericDataType.STRING
        for selector in selectors:
            if selector['type_selector'] == "Period":
                selected_period = selector.get("selected_period", None)
                if not selected_period or selected_period == NO_SELECTOR:
                    continue
                if PERIOD_COLUMN_NAME in columns_by_name:
                    period_col_obj = columns_by_name.get(cast(str, PERIOD_COLUMN_NAME))
                    period_col_type = period_col_obj.type if period_col_obj else None
                    period_col = self.convert_tbl_column_to_sqla_col(
                        tbl_column=period_col_obj, template_processor=template_processor
                    )
                    period_op = utils.FilterOperator.IN.value
                    period_target_generic_type = GenericDataType.STRING
                    period_is_list_target = period_op in (
                        utils.FilterOperator.IN.value,
                        utils.FilterOperator.NOT_IN.value,
                    )
                    period_values = self.get_period_values(
                        selector=selector,
                        period_column_name=PERIOD_COLUMN_NAME,
                        from_table=tbl,
                    )
                    temp_eq = self.filter_values_handler(
                        values=period_values,
                        operator=period_op,
                        target_generic_type=period_target_generic_type,
                        target_native_type=period_col_type,
                        is_list_target=period_is_list_target,
                        db_engine_spec=db_engine_spec,
                    )
                    where_clause_and.append(period_col.in_(temp_eq))
                # попробуем не выводить ошибку, если нужного столбца для селектора нет (мы же юзаем джинджу)
                #else:
                #    raise QueryObjectValidationError(
                #            _(f'Invalid selector option: period column "{PERIOD_COLUMN_NAME}" does not exsist in selected datasource')
                #        )
            if selector['type_selector'] == "Market":
                selected_markets = selector.get("selected_markets", [])
                if not selected_markets or selected_markets[0] == NO_SELECTOR:
                    continue
                market_col_obj = columns_by_name.get(cast(str, MARKET_COLUMN))
                market_col_type = market_col_obj.type if market_col_obj else None
                market_col = self.convert_tbl_column_to_sqla_col(
                        tbl_column=market_col_obj, template_processor=template_processor
                )
                market_op = utils.FilterOperator.IN.value
                market_target_generic_type = GenericDataType.STRING
                market_is_list_target = market_op in (
                    utils.FilterOperator.IN.value,
                    utils.FilterOperator.NOT_IN.value,
                )
                temp_eq = self.filter_values_handler(
                    values=selected_markets,
                    operator=market_op,
                    target_generic_type=market_target_generic_type,
                    target_native_type=market_col_type,
                    is_list_target=market_is_list_target,
                    db_engine_spec=db_engine_spec,
                )
                where_clause_and.append(market_col.in_(temp_eq))

            if selector['type_selector'] == "Product":
                selected_products = selector.get("selected_products", [])
                if not selected_products or selected_products[0] == NO_SELECTOR:
                    continue
                # process list of lists in selected_products
                selected_products = flatten_and_unique(selected_products)
                
                product_col_obj = columns_by_name.get(cast(str, PRODUCT_COLUMN))
                product_col_type = product_col_obj.type if product_col_obj else None
                product_col = self.convert_tbl_column_to_sqla_col(
                        tbl_column=product_col_obj, template_processor=template_processor
                )
                product_op = utils.FilterOperator.IN.value
                product_target_generic_type = GenericDataType.STRING
                product_is_list_target = product_op in (
                    utils.FilterOperator.IN.value,
                    utils.FilterOperator.NOT_IN.value,
                )
                temp_eq = self.filter_values_handler(
                    values=selected_products,
                    operator=product_op,
                    target_generic_type=product_target_generic_type,
                    target_native_type=product_col_type,
                    is_list_target=product_is_list_target,
                    db_engine_spec=db_engine_spec,
                )
                where_clause_and.append(product_col.in_(temp_eq))

        if extras:
            where = extras.get("where")
            if where:
                try:
                    where = template_processor.process_template(f"({where})")
                except TemplateError as ex:
                    raise QueryObjectValidationError(
                        _(
                            "Error in jinja expression in WHERE clause: %(msg)s",
                            msg=ex.message,
                        )
                    ) from ex
                where = self._process_sql_expression(
                    expression=where,
                    database_id=self.database_id,
                    schema=self.schema,
                    template_processor=template_processor,
                )
                where_clause_and += [self.text(where)]
            having = extras.get("having")
            if having:
                try:
                    having = template_processor.process_template(f"({having})")
                except TemplateError as ex:
                    raise QueryObjectValidationError(
                        _(
                            "Error in jinja expression in HAVING clause: %(msg)s",
                            msg=ex.message,
                        )
                    ) from ex
                having = self._process_sql_expression(
                    expression=having,
                    database_id=self.database_id,
                    schema=self.schema,
                    template_processor=template_processor,
                )
                having_clause_and += [self.text(having)]

        if apply_fetch_values_predicate and self.fetch_values_predicate:
            qry = qry.where(
                self.get_fetch_values_predicate(template_processor=template_processor)
            )
        if granularity:
            qry = qry.where(and_(*(time_filters + where_clause_and)))
        else:
            qry = qry.where(and_(*where_clause_and))
        qry = qry.having(and_(*having_clause_and))

        self.make_orderby_compatible(select_exprs, orderby_exprs)

        for col, (orig_col, ascending) in zip(orderby_exprs, orderby):
            if not db_engine_spec.allows_alias_in_orderby and isinstance(col, Label):
                # if engine does not allow using SELECT alias in ORDER BY
                # revert to the underlying column
                col = col.element

            if (
                db_engine_spec.get_allows_alias_in_select(self.database)
                and db_engine_spec.allows_hidden_cc_in_orderby
                and col.name in [select_col.name for select_col in select_exprs]
            ):
                with self.database.get_sqla_engine_with_context() as engine:
                    quote = engine.dialect.identifier_preparer.quote
                    col = literal_column(quote(col.name))
            direction = sa.asc if ascending else sa.desc
            qry = qry.order_by(direction(col))

        if row_limit:
            qry = qry.limit(row_limit)
        if row_offset:
            qry = qry.offset(row_offset)

        if series_limit and groupby_series_columns:
            if db_engine_spec.allows_joins and db_engine_spec.allows_subqueries:
                # some sql dialects require for order by expressions
                # to also be in the select clause -- others, e.g. vertica,
                # require a unique inner alias
                inner_main_metric_expr = self.make_sqla_column_compatible(
                    main_metric_expr, "mme_inner__"
                )
                inner_groupby_exprs = []
                inner_select_exprs = []
                for gby_name, gby_obj in groupby_series_columns.items():
                    inner = self.make_sqla_column_compatible(gby_obj, gby_name + "__")
                    inner_groupby_exprs.append(inner)
                    inner_select_exprs.append(inner)

                inner_select_exprs += [inner_main_metric_expr]
                subq = sa.select(inner_select_exprs).select_from(tbl)
                inner_time_filter = []

                if dttm_col and not db_engine_spec.time_groupby_inline:
                    inner_time_filter = [
                        self.get_time_filter(
                            time_col=dttm_col,
                            start_dttm=inner_from_dttm or from_dttm,
                            end_dttm=inner_to_dttm or to_dttm,
                            template_processor=template_processor,
                        )
                    ]
                subq = subq.where(and_(*(where_clause_and + inner_time_filter)))
                subq = subq.group_by(*inner_groupby_exprs)

                ob = inner_main_metric_expr
                if series_limit_metric:
                    ob = self._get_series_orderby(
                        series_limit_metric=series_limit_metric,
                        metrics_by_name=metrics_by_name,
                        columns_by_name=columns_by_name,
                        template_processor=template_processor,
                    )
                direction = sa.desc if order_desc else sa.asc
                subq = subq.order_by(direction(ob))
                subq = subq.limit(series_limit)

                on_clause = []
                for gby_name, gby_obj in groupby_series_columns.items():
                    # in this case the column name, not the alias, needs to be
                    # conditionally mutated, as it refers to the column alias in
                    # the inner query
                    col_name = db_engine_spec.make_label_compatible(gby_name + "__")
                    on_clause.append(gby_obj == sa.column(col_name))

                tbl = tbl.join(subq.alias(SERIES_LIMIT_SUBQ_ALIAS), and_(*on_clause))
            else:
                if series_limit_metric:
                    orderby = [
                        (
                            self._get_series_orderby(
                                series_limit_metric=series_limit_metric,
                                metrics_by_name=metrics_by_name,
                                columns_by_name=columns_by_name,
                                template_processor=template_processor,
                            ),
                            not order_desc,
                        )
                    ]

                # run prequery to get top groups
                prequery_obj = {
                    "is_timeseries": False,
                    "row_limit": series_limit,
                    "metrics": metrics,
                    "granularity": granularity,
                    "groupby": groupby,
                    "from_dttm": inner_from_dttm or from_dttm,
                    "to_dttm": inner_to_dttm or to_dttm,
                    "filter": filter,
                    "orderby": orderby,
                    "extras": extras,
                    "columns": get_non_base_axis_columns(columns),
                    "order_desc": True,
                }

                result = self.query(prequery_obj)
                prequeries.append(result.query)
                dimensions = [
                    c
                    for c in result.df.columns
                    if c not in metrics and c in groupby_series_columns
                ]
                top_groups = self._get_top_groups(
                    result.df, dimensions, groupby_series_columns, columns_by_name
                )
                qry = qry.where(top_groups)

        qry = qry.select_from(tbl)

        if is_rowcount:
            if not db_engine_spec.allows_subqueries:
                raise QueryObjectValidationError(
                    _("Database does not support subqueries")
                )
            label = "rowcount"
            col = self.make_sqla_column_compatible(literal_column("COUNT(*)"), label)
            qry = sa.select([col]).select_from(qry.alias("rowcount_qry"))
            labels_expected = [label]

        filter_columns = [flt.get("col") for flt in filter] if filter else []
        rejected_filter_columns = [
            col
            for col in filter_columns
            if col
            and not is_adhoc_column(col)
            and col not in self.column_names
            and col not in applied_template_filters
        ] + rejected_adhoc_filters_columns

        applied_filter_columns = [
            col
            for col in filter_columns
            if col
            and not is_adhoc_column(col)
            and (col in self.column_names or col in applied_template_filters)
        ] + applied_adhoc_filters_columns

        return SqlaQuery(
            applied_template_filters=applied_template_filters,
            cte=cte,
            applied_filter_columns=applied_filter_columns,
            rejected_filter_columns=rejected_filter_columns,
            extra_cache_keys=extra_cache_keys,
            labels_expected=labels_expected,
            sqla_query=qry,
            prequeries=prequeries,
        )
