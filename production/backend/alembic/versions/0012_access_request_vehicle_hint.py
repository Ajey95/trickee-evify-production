"""access request vehicle hint

Revision ID: 0012_access_request_vehicle_hint
Revises: 0011_ingest_scale
Create Date: 2026-05-26
"""

from alembic import op
import sqlalchemy as sa

revision = "0012_access_request_vehicle_hint"
down_revision = "0011_ingest_scale"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("access_requests", sa.Column("requested_vehicle_id", sa.String(length=36), nullable=True))
    op.create_index("ix_access_requests_requested_vehicle_id", "access_requests", ["requested_vehicle_id"])


def downgrade() -> None:
    op.drop_index("ix_access_requests_requested_vehicle_id", table_name="access_requests")
    op.drop_column("access_requests", "requested_vehicle_id")
