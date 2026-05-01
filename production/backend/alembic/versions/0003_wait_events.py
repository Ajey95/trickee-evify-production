"""wait events

Revision ID: 0003_wait_events
Revises: 0002_v5_v6_foundations
Create Date: 2026-04-29
"""

from alembic import op
import sqlalchemy as sa

revision = "0003_wait_events"
down_revision = "0002_v5_v6_foundations"
branch_labels = None
depends_on = None


def upgrade() -> None:
    existing_tables = set(sa.inspect(op.get_bind()).get_table_names())
    if "wait_events" in existing_tables:
        return

    op.create_table(
        "wait_events",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("vehicle_id", sa.String(length=36), nullable=False),
        sa.Column("driver_id", sa.String(length=36), nullable=True),
        sa.Column("started_at", sa.DateTime(), nullable=False),
        sa.Column("ended_at", sa.DateTime(), nullable=True),
        sa.Column("last_seen_at", sa.DateTime(), nullable=False),
        sa.Column("wait_type", sa.String(length=50), nullable=False),
        sa.Column("source", sa.String(length=50), nullable=False),
        sa.Column("ignition_on", sa.Boolean(), nullable=False),
        sa.Column("charge_plug", sa.Boolean(), nullable=False),
        sa.Column("lat", sa.Float(), nullable=True),
        sa.Column("lng", sa.Float(), nullable=True),
        sa.Column("duration_seconds", sa.Integer(), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=False),
        sa.Column("restaurant_distance_m", sa.Integer(), nullable=True),
        sa.Column("charger_distance_m", sa.Integer(), nullable=True),
        sa.Column("context", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["driver_id"], ["drivers.id"]),
        sa.ForeignKeyConstraint(["vehicle_id"], ["vehicles.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_wait_events_vehicle_id", "wait_events", ["vehicle_id"])
    op.create_index("ix_wait_events_driver_id", "wait_events", ["driver_id"])
    op.create_index("ix_wait_events_started_at", "wait_events", ["started_at"])
    op.create_index("ix_wait_events_ended_at", "wait_events", ["ended_at"])
    op.create_index("ix_wait_events_last_seen_at", "wait_events", ["last_seen_at"])
    op.create_index("ix_wait_events_wait_type", "wait_events", ["wait_type"])
    op.create_index("ix_wait_events_created_at", "wait_events", ["created_at"])


def downgrade() -> None:
    op.drop_table("wait_events")
