from marshmallow import Schema, fields
from marshmallow.fields import Boolean, Integer, String
from sqlglot.expressions import false


class CompanyResponseSchema(Schema):
    id = Integer()
    name = String()

class UserCompaniesResponseSchema(Schema):
    user_id = Integer()
    companies = fields.List(fields.Nested(CompanyResponseSchema))

order_by_company_user_param_schema = {
    "type": "object",
    "properties":{
        "company_id": {"type": "integer", "description": "ID компании выбранной ранее"},
        "s": {"type": "string", "default": "",
              "description": "Поиск по подстроке в названии компании",},
    }
}

class OrderResponseSchema(Schema):
    id = Integer()
    name = String()
    on_hold = Boolean()

class OrdersByCompanyUserResponseSchema(Schema):
    user_id = Integer()
    company_id = Integer()
    orders = fields.List(fields.Nested(OrderResponseSchema))

