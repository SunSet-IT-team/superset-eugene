import logging
from typing import Any

from flask_appbuilder.models.filters import BaseFilter
from sqlalchemy.orm import Query, Session
from sqlalchemy.sql import or_, and_, not_
from superset import appbuilder, security_manager
from flask import current_app, request, g

from superset.models.dashboard import Dashboard, User
from superset.korus_plugin.custom_models import (
    Order,
    assoc_user_company,
    assoc_dashboard_order,
)
from superset.korus_plugin.api import KorusCurrentUserRestApi

import prison

logger = logging.getLogger(__name__)

def test_lambda() -> list:
    return []

class DashboardKorusAccessFilter(BaseFilter):
    def apply(self, query: Query, value: Any) -> Query:
        if not g.user or not g.user.is_authenticated:
            return query.filter(False)
        if security_manager.is_admin():
            return query
        rison_string = request.args.get('q')
        if rison_string:
            param: dict = prison.loads(rison_string)
            user_id: int = g.user.id
            is_admin: bool = security_manager.is_admin()
            order_id: int

            sess: Session = appbuilder.get_session
            if 'order_id' not in param.keys() or param['order_id'] is None:
                # найти дефолтный ордер
                order_query: Query = (
                    sess.query(Order.id)
                    .join(assoc_user_company,
                          Order.id_company == assoc_user_company.c.id_company)
                    .filter(or_(assoc_user_company.c.id_user == user_id,
                                is_admin))
                )
                res = order_query.first()
                if res:
                    order_id = res.id
                else:
                    order_id = 0
            else:
                order_id = param['order_id']
                """
                if not KorusCurrentUserRestApi.save_order_in_session(order_id,
                                                                     user_id,
                                                                     is_admin):
                    raise ValueError(f"Передан некорректный order_id: {order_id}")
                app_session['order_id'] = order_id
                """

            # logger.warning("ORDER_ID: " + str(order_id))
            subquery: Query = (
                sess.query(assoc_user_company)
                .join(Order, Order.id_company ==
                      assoc_user_company.c.id_company)
                .join(
                    assoc_dashboard_order,
                    Order.id == assoc_dashboard_order.c.id_order
                )
                .where(
                    assoc_dashboard_order.c.id_dashboard == Dashboard.id,
                    or_(assoc_user_company.c.id_user == user_id, is_admin),
                    Order.id == order_id
                )
                .exists()
            )
            filtered_query: Query = query.filter(
                or_(
                    subquery,
                    and_(
                        Dashboard.owners.any(User.id == user_id),
                        not_(Dashboard.published)
                    )
                )
            )
            # w = query.filter(subquery).statement.compile(
            #      dialect=appbuilder.get_session.bind.dialect,
            #      compile_kwargs={"literal_binds": True})
            # logger.warning(str(w))
            sess.close()
            return filtered_query
        return query
