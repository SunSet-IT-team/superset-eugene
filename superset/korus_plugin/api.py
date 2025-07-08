import logging

from typing import Any

from flask import g, Response, request
from flask_appbuilder.api import expose, safe, rison
from flask_jwt_extended.exceptions import NoAuthorizationError
from sqlalchemy.orm import Query, Session
from sqlalchemy.sql import not_, or_, func, operators as op


import superset.korus_plugin.custom_models as ka
from superset.views.base_api import BaseSupersetApi

from .schemas import (UserCompaniesResponseSchema,
                      CompanyResponseSchema,
                      OrderResponseSchema,
                      OrdersByCompanyUserResponseSchema,
                      order_by_company_user_param_schema)

from superset import appbuilder, security_manager, db

logger = logging.getLogger(__name__)


class KorusCurrentUserRestApi(BaseSupersetApi):
    resource_name = "me"
    openapi_spec_tag = "Current User"
    openapi_spec_component_schemas = (UserCompaniesResponseSchema,
                                      CompanyResponseSchema,
                                      OrderResponseSchema,
                                      OrdersByCompanyUserResponseSchema)
    apispec_parameter_schemas = {
        "order_by_company_user_param_schema": order_by_company_user_param_schema,
    }


    @expose("/companies/", methods=("GET",))
    @safe
    def get_my_companies(self) -> Response:
        """Get the user companies corresponding to the agent making the request.
        ---
        get:
          summary: Get the user companies
          description: >-
            Gets the user companies corresponding to the agent making the request,
            or returns a 401 error if the user is unauthenticated.
          parameters:
            - in: query
              name: s
              required: false
              type: string
              default: ""
          responses:
            200:
              description: The user companies
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      result:
                        $ref: '#/components/schemas/UserCompaniesResponseSchema'
            401:
              $ref: '#/components/responses/401'
        """
        try:
            if g.user is None or g.user.is_anonymous:
                return self.response_401()
        except NoAuthorizationError:
            return self.response_401()
        roles: list[str] = [r.name for r in security_manager.get_user_roles()]
        user_id: int = g.user.id
        search: str
        if 's' in request.args.keys():
            search= request.args.get('s')
        else:
            search = ''

        sess: Session = appbuilder.get_session
        try:
            query: Query
            if 'Admin' in roles:
                query = (
                    sess.query(ka.Company.id, ka.Company.name)
                        .order_by(ka.Company.name)
                )
            else:
                query = (
                    sess.query(ka.Company.id, ka.Company.name)
                        .join(ka.assoc_user_company,
                              ka.assoc_user_company.c.id_company == ka.Company.id)
                        .filter(ka.assoc_user_company.c.id_user == user_id)
                        .order_by(ka.Company.name)
                )
            if search != '':
                query = query.filter(
                    func.position(
                        op.op(func.upper(search), 'IN', func.upper(ka.Company.name))
                    ) > 0
                )

            # w = query.statement.compile(
            #     dialect=appbuilder.get_session.bind.dialect,
            #      compile_kwargs={"literal_binds": True}
            # )
            # logger.warning(str(w))
            res = query.all()
            companies = [{'id': row.id, 'name': row.name} for row in res]
            ret = UserCompaniesResponseSchema().dump({'user_id': user_id,
                                                      'companies': companies})
            sess.commit()
            return self.response(200, result=ret)
        except Exception:
            sess.rollback()
            raise
        finally:
            sess.close()


    @expose("/orders/", methods=("GET",))
    @safe
    @rison(order_by_company_user_param_schema)
    def get_my_orders(self, **kwargs: Any) -> Response:
        """Get the user orders corresponding to the agent making the request and chosen
            company.
        ---
        get:
          summary: Get orders by company and user
          description: >-
            Get orders by chosen company for current user
          parameters:
            - in: query
              name: q
              content:
                application/json:
                  schema:
                    $ref: '#/components/schemas/order_by_company_user_param_schema'
          responses:
            200:
              description: The user orders by company
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      result:
                        $ref: '#/components/schemas/OrdersByCompanyUserResponseSchema'
            401:
              $ref: '#/components/responses/401'
        """
        try:
            if g.user is None or g.user.is_anonymous:
                return self.response_401()
        except NoAuthorizationError:
            return self.response_401()
        kwargs['rison'].setdefault('s', '')
        company_id: int = kwargs['rison']['company_id']
        search: str = kwargs['rison']['s']
        roles: list[str] = [r.name for r in security_manager.get_user_roles()]
        user_id: int = g.user.id

        sess: Session = appbuilder.get_session
        try:
            query: Query
            if 'Admin' in roles:
                query = (
                    sess.query(ka.Order.id, ka.Order.name,
                               not_(ka.Order.is_actual).label("on_hold"))
                        .filter(ka.Order.id_company == company_id)
                        .order_by(ka.Order.name)
                )
            else:
                """
                Если пользователь внешний, то не показываем ему ордера «on_hold»
                """
                query = (
                    sess.query(ka.Order.id, ka.Order.name,
                               not_(ka.Order.is_actual).label("on_hold"))
                        .join(ka.assoc_user_company, ka.Order.id_company ==
                              ka.assoc_user_company.c.id_company)
                        .join(ka.ExtIntUser, ka.ExtIntUser.id == user_id,
                              isouter=True)
                        .filter(ka.assoc_user_company.c.id_user == user_id,
                                ka.assoc_user_company.c.id_company == company_id,
                                or_(not_(func.coalesce(ka.ExtIntUser.is_external, True)),
                                    ka.Order.is_actual
                                ))
                    .order_by(ka.Order.name)
                )
            if search != '':
                query = query.filter(
                    func.position(
                        op.op(func.upper(search), 'IN', func.upper(ka.Order.name))
                    ) > 0
                )
            # w = query.statement.compile(
            #     dialect=appbuilder.get_session.bind.dialect,
            #     compile_kwargs={"literal_binds": True},
            # )
            # logger.warning(str(w))
            orders = query.all()
            orders_list: list = [{'id': row.id, 'name': row.name,
                             'on_hold': row.on_hold} for row in orders]
            ret = OrdersByCompanyUserResponseSchema().dump(
                {'user_id': user_id,
                 'company_id': company_id,
                 'orders': orders_list})
            # logger.warning(orders)
            sess.commit()
            return self.response(200, result=ret)
        except Exception:
            sess.rollback()
            raise
        finally:
            sess.close()


    @staticmethod
    def check_order4user(order_id: int, user_id: int, is_admin: bool) -> bool:
        if not isinstance(order_id, int):
            return False
        if is_admin:
            return True

        sess: Session = db.session
        res = (sess.query(ka.Order.id)
            .join(ka.assoc_user_company,
                  ka.Order.id_company == ka.assoc_user_company.c.id_company)
            .filter(ka.assoc_user_company.c.id_user == user_id,
                    ka.Order.id == order_id)
            .limit(1)
            .first()
        )
        if res and res.id != 0:
            return True
        else:
            return False
