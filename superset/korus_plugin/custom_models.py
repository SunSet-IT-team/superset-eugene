from flask_appbuilder import Model
from flask_appbuilder.security.sqla.models import User
from sqlalchemy import (Column, Integer, String, Boolean, ForeignKey, Table, Sequence,
                        UniqueConstraint)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import Load, relationship, Session


Base = declarative_base()
# Define the association table as a Model

assoc_user_company = Table(
    "lnk_user_company",
    Model.metadata,  # pylint: disable=no-member
    Column("id_user", Integer,
           ForeignKey("ab_user.id", ondelete='CASCADE'), primary_key=True, ),
    Column("id_company", Integer,
           ForeignKey("companies.id", ondelete='CASCADE'), primary_key=True)
)

assoc_dashboard_order = Table(
    'lnk_dashboard_orders',
    Model.metadata,  # pylint: disable=no-member
    Column('id_dashboard', Integer,
           ForeignKey('dashboards.id', ondelete='CASCADE'), primary_key=True),
    Column('id_order', Integer,
           ForeignKey('orders.id', ondelete='CASCADE'), primary_key=True),
)


class Company(Model):
    __tablename__ = "companies"

    id = Column(Integer, primary_key=True)
    name = Column(String, unique=True, nullable=False)

    # Relationships
    orders = relationship("Order", back_populates="company", cascade="all, delete")
    users = relationship(
        "User",
        secondary=assoc_user_company,
        backref="companies",
        cascade="all, delete"
    )

    def __repr__(self):
        return self.name


class Order(Model):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True)
    name = Column(String, unique=True, nullable=False)
    is_actual = Column(Boolean, nullable=False)
    id_company = Column(Integer, ForeignKey("companies.id"), nullable=True)

    # Relationship
    company = relationship("Company", back_populates="orders",
                           cascade="all, delete")
    dashboards = relationship(
        'Dashboard',
        secondary=assoc_dashboard_order,
        backref='dashboards',
        cascade='all, delete'
    )

    def __repr__(self):
        return self.name


class ExtIntUser(Model):
    __tablename__ = "ext_int_users"

    id = Column(Integer, ForeignKey('ab_user.id'), primary_key=True)
    is_external = Column(Boolean, nullable=True)

    user = relationship("User", backref='extint_flag', cascade='all, delete')

    def __repr__(self):
        return f"{self.user.username} external: {self.is_external}"

