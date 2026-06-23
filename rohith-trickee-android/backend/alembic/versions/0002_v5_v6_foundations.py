"""v5 v6 foundations

Revision ID: 0002_v5_v6_foundations
Revises: 0001_initial
Create Date: 2026-04-29
"""

from alembic import op
import sqlalchemy as sa

revision = "0002_v5_v6_foundations"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    existing_tables = set(sa.inspect(op.get_bind()).get_table_names())

    if "driver_behavior_snapshots" not in existing_tables:
        op.create_table(
        "driver_behavior_snapshots",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("driver_id", sa.String(length=36), nullable=False),
        sa.Column("computed_at", sa.DateTime(), nullable=True),
        sa.Column("window_minutes", sa.Integer(), nullable=False),
        sa.Column("sample_count", sa.Integer(), nullable=False),
        sa.Column("avg_current_30m", sa.Float(), nullable=False),
        sa.Column("avg_speed_30m", sa.Float(), nullable=False),
        sa.Column("regen_ratio_30m", sa.Float(), nullable=False),
        sa.Column("throttle_var_30m", sa.Float(), nullable=False),
        sa.Column("style_label", sa.String(length=50), nullable=False),
        sa.ForeignKeyConstraint(["driver_id"], ["drivers.id"]),
        sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_driver_behavior_snapshots_driver_id", "driver_behavior_snapshots", ["driver_id"])
        op.create_index("ix_driver_behavior_snapshots_computed_at", "driver_behavior_snapshots", ["computed_at"])

    if "nudge_events" not in existing_tables:
        op.create_table(
        "nudge_events",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("driver_id", sa.String(length=36), nullable=True),
        sa.Column("vehicle_id", sa.String(length=36), nullable=True),
        sa.Column("alert_id", sa.String(length=36), nullable=True),
        sa.Column("nudge_type", sa.String(length=50), nullable=False),
        sa.Column("channel", sa.String(length=50), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=True),
        sa.Column("status", sa.String(length=50), nullable=False),
        sa.Column("outcome", sa.String(length=50), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("acknowledged_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["alert_id"], ["alerts.id"]),
        sa.ForeignKeyConstraint(["driver_id"], ["drivers.id"]),
        sa.ForeignKeyConstraint(["vehicle_id"], ["vehicles.id"]),
        sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_nudge_events_driver_id", "nudge_events", ["driver_id"])
        op.create_index("ix_nudge_events_vehicle_id", "nudge_events", ["vehicle_id"])
        op.create_index("ix_nudge_events_alert_id", "nudge_events", ["alert_id"])
        op.create_index("ix_nudge_events_created_at", "nudge_events", ["created_at"])

    if "order_assignment_decisions" not in existing_tables:
        op.create_table(
        "order_assignment_decisions",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("fleet_id", sa.String(length=36), nullable=True),
        sa.Column("order_id", sa.String(length=100), nullable=True),
        sa.Column("assigned_driver_id", sa.String(length=100), nullable=True),
        sa.Column("strategy", sa.String(length=100), nullable=True),
        sa.Column("restaurant_wait_min", sa.Float(), nullable=True),
        sa.Column("delivery_distance_km", sa.Float(), nullable=True),
        sa.Column("required_range_km", sa.Float(), nullable=True),
        sa.Column("assignment_score", sa.Float(), nullable=True),
        sa.Column("request_payload", sa.JSON(), nullable=True),
        sa.Column("result_payload", sa.JSON(), nullable=True),
        sa.Column("outcome", sa.String(length=50), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["fleet_id"], ["fleets.id"]),
        sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_order_assignment_decisions_fleet_id", "order_assignment_decisions", ["fleet_id"])
        op.create_index("ix_order_assignment_decisions_order_id", "order_assignment_decisions", ["order_id"])
        op.create_index("ix_order_assignment_decisions_assigned_driver_id", "order_assignment_decisions", ["assigned_driver_id"])
        op.create_index("ix_order_assignment_decisions_created_at", "order_assignment_decisions", ["created_at"])

    if "charging_decision_records" not in existing_tables:
        op.create_table(
        "charging_decision_records",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("driver_id", sa.String(length=100), nullable=True),
        sa.Column("vehicle_id", sa.String(length=36), nullable=True),
        sa.Column("order_id", sa.String(length=100), nullable=True),
        sa.Column("chosen_option", sa.String(length=50), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("selected_charger", sa.JSON(), nullable=True),
        sa.Column("wait_window", sa.JSON(), nullable=True),
        sa.Column("request_payload", sa.JSON(), nullable=True),
        sa.Column("result_payload", sa.JSON(), nullable=True),
        sa.Column("outcome", sa.String(length=50), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["vehicle_id"], ["vehicles.id"]),
        sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_charging_decision_records_driver_id", "charging_decision_records", ["driver_id"])
        op.create_index("ix_charging_decision_records_vehicle_id", "charging_decision_records", ["vehicle_id"])
        op.create_index("ix_charging_decision_records_order_id", "charging_decision_records", ["order_id"])
        op.create_index("ix_charging_decision_records_created_at", "charging_decision_records", ["created_at"])


def downgrade() -> None:
    op.drop_table("charging_decision_records")
    op.drop_table("order_assignment_decisions")
    op.drop_table("nudge_events")
    op.drop_table("driver_behavior_snapshots")
