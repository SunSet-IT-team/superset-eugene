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
"""Add Korus custom models

Revision ID: a8f5b2c3d4e6
Revises: 17fcea065655
Create Date: 2025-01-20 15:30:00.000000

"""

# revision identifiers, used by Alembic.
revision = 'a8f5b2c3d4e6'
down_revision = '17fcea065655'

from alembic import op
import sqlalchemy as sa


def upgrade():
    # Create companies table
    op.create_table(
        'companies',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(), nullable=False, unique=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name')
    )
    
    # Create orders table
    op.create_table(
        'orders',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(), nullable=False, unique=True),
        sa.Column('is_actual', sa.Boolean(), nullable=False),
        sa.Column('id_company', sa.Integer(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['id_company'], ['companies.id']),
        sa.UniqueConstraint('name')
    )
    
    # Create ext_int_users table
    op.create_table(
        'ext_int_users',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('is_external', sa.Boolean(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['id'], ['ab_user.id'])
    )
    
    # Create lnk_user_company association table
    op.create_table(
        'lnk_user_company',
        sa.Column('id_user', sa.Integer(), nullable=False),
        sa.Column('id_company', sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint('id_user', 'id_company'),
        sa.ForeignKeyConstraint(['id_user'], ['ab_user.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['id_company'], ['companies.id'], ondelete='CASCADE')
    )
    
    # Create lnk_dashboard_orders association table
    op.create_table(
        'lnk_dashboard_orders',
        sa.Column('id_dashboard', sa.Integer(), nullable=False),
        sa.Column('id_order', sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint('id_dashboard', 'id_order'),
        sa.ForeignKeyConstraint(['id_dashboard'], ['dashboards.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['id_order'], ['orders.id'], ondelete='CASCADE')
    )


def downgrade():
    # Drop tables in reverse order to avoid foreign key conflicts
    op.drop_table('lnk_dashboard_orders')
    op.drop_table('lnk_user_company')
    op.drop_table('ext_int_users')
    op.drop_table('orders')
    op.drop_table('companies') 