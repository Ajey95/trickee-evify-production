"""mobile action button persistence

Revision ID: 0013_mobile_action_button
Revises: 0012_access_request_vehicle_hint
Create Date: 2026-05-29
"""

from alembic import op
import sqlalchemy as sa

revision = "0013_mobile_action_button"
down_revision = "0012_access_request_vehicle_hint"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "mobile_location_points",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("driver_id", sa.String(length=36), nullable=False),
        sa.Column("vehicle_id", sa.String(length=36), nullable=True),
        sa.Column("lat", sa.Float(), nullable=False),
        sa.Column("lng", sa.Float(), nullable=False),
        sa.Column("accuracy_m", sa.Float(), nullable=True),
        sa.Column("speed_mps", sa.Float(), nullable=True),
        sa.Column("heading_deg", sa.Float(), nullable=True),
        sa.Column("battery_pct", sa.Float(), nullable=True),
        sa.Column("tracking_state", sa.String(length=40), nullable=False),
        sa.Column("source", sa.String(length=40), nullable=False),
        sa.Column("idempotency_key", sa.String(length=80), nullable=True),
        sa.Column("captured_at", sa.DateTime(), nullable=False),
        sa.Column("received_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["driver_id"], ["drivers.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["vehicle_id"], ["vehicles.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("idempotency_key"),
    )
    op.create_index("ix_mobile_location_points_user_id", "mobile_location_points", ["user_id"])
    op.create_index("ix_mobile_location_points_driver_id", "mobile_location_points", ["driver_id"])
    op.create_index("ix_mobile_location_points_vehicle_id", "mobile_location_points", ["vehicle_id"])
    op.create_index("ix_mobile_location_points_tracking_state", "mobile_location_points", ["tracking_state"])
    op.create_index("ix_mobile_location_points_captured_at", "mobile_location_points", ["captured_at"])
    op.create_index("ix_mobile_location_points_received_at", "mobile_location_points", ["received_at"])

    op.create_table(
        "mobile_trip_sessions",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("driver_id", sa.String(length=36), nullable=False),
        sa.Column("vehicle_id", sa.String(length=36), nullable=True),
        sa.Column("started_at", sa.DateTime(), nullable=False),
        sa.Column("ended_at", sa.DateTime(), nullable=True),
        sa.Column("origin_lat", sa.Float(), nullable=True),
        sa.Column("origin_lng", sa.Float(), nullable=True),
        sa.Column("destination_text", sa.String(length=255), nullable=True),
        sa.Column("destination_place_id", sa.String(length=255), nullable=True),
        sa.Column("destination_lat", sa.Float(), nullable=True),
        sa.Column("destination_lng", sa.Float(), nullable=True),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=False),
        sa.Column("source", sa.String(length=40), nullable=False),
        sa.Column("idempotency_key", sa.String(length=80), nullable=True),
        sa.Column("context", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["driver_id"], ["drivers.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["vehicle_id"], ["vehicles.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("idempotency_key"),
    )
    op.create_index("ix_mobile_trip_sessions_user_id", "mobile_trip_sessions", ["user_id"])
    op.create_index("ix_mobile_trip_sessions_driver_id", "mobile_trip_sessions", ["driver_id"])
    op.create_index("ix_mobile_trip_sessions_vehicle_id", "mobile_trip_sessions", ["vehicle_id"])
    op.create_index("ix_mobile_trip_sessions_started_at", "mobile_trip_sessions", ["started_at"])
    op.create_index("ix_mobile_trip_sessions_ended_at", "mobile_trip_sessions", ["ended_at"])
    op.create_index("ix_mobile_trip_sessions_status", "mobile_trip_sessions", ["status"])
    op.create_index("ix_mobile_trip_sessions_created_at", "mobile_trip_sessions", ["created_at"])

    op.create_table(
        "mobile_wait_events",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("trip_session_id", sa.String(length=36), nullable=True),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("driver_id", sa.String(length=36), nullable=False),
        sa.Column("vehicle_id", sa.String(length=36), nullable=True),
        sa.Column("started_at", sa.DateTime(), nullable=False),
        sa.Column("ended_at", sa.DateTime(), nullable=True),
        sa.Column("lat", sa.Float(), nullable=True),
        sa.Column("lng", sa.Float(), nullable=True),
        sa.Column("wait_type", sa.String(length=50), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=False),
        sa.Column("duration_seconds", sa.Integer(), nullable=False),
        sa.Column("idempotency_key", sa.String(length=80), nullable=True),
        sa.Column("context", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["driver_id"], ["drivers.id"]),
        sa.ForeignKeyConstraint(["trip_session_id"], ["mobile_trip_sessions.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["vehicle_id"], ["vehicles.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("idempotency_key"),
    )
    op.create_index("ix_mobile_wait_events_trip_session_id", "mobile_wait_events", ["trip_session_id"])
    op.create_index("ix_mobile_wait_events_user_id", "mobile_wait_events", ["user_id"])
    op.create_index("ix_mobile_wait_events_driver_id", "mobile_wait_events", ["driver_id"])
    op.create_index("ix_mobile_wait_events_vehicle_id", "mobile_wait_events", ["vehicle_id"])
    op.create_index("ix_mobile_wait_events_started_at", "mobile_wait_events", ["started_at"])
    op.create_index("ix_mobile_wait_events_ended_at", "mobile_wait_events", ["ended_at"])
    op.create_index("ix_mobile_wait_events_created_at", "mobile_wait_events", ["created_at"])

    op.create_table(
        "mobile_charging_sessions",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("trip_session_id", sa.String(length=36), nullable=True),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("driver_id", sa.String(length=36), nullable=False),
        sa.Column("vehicle_id", sa.String(length=36), nullable=True),
        sa.Column("started_at", sa.DateTime(), nullable=False),
        sa.Column("ended_at", sa.DateTime(), nullable=True),
        sa.Column("lat", sa.Float(), nullable=True),
        sa.Column("lng", sa.Float(), nullable=True),
        sa.Column("charger_name", sa.String(length=255), nullable=True),
        sa.Column("charger_place_id", sa.String(length=255), nullable=True),
        sa.Column("soc_start", sa.Float(), nullable=True),
        sa.Column("soc_end", sa.Float(), nullable=True),
        sa.Column("confidence", sa.Float(), nullable=False),
        sa.Column("duration_seconds", sa.Integer(), nullable=False),
        sa.Column("idempotency_key", sa.String(length=80), nullable=True),
        sa.Column("context", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["driver_id"], ["drivers.id"]),
        sa.ForeignKeyConstraint(["trip_session_id"], ["mobile_trip_sessions.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["vehicle_id"], ["vehicles.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("idempotency_key"),
    )
    op.create_index("ix_mobile_charging_sessions_trip_session_id", "mobile_charging_sessions", ["trip_session_id"])
    op.create_index("ix_mobile_charging_sessions_user_id", "mobile_charging_sessions", ["user_id"])
    op.create_index("ix_mobile_charging_sessions_driver_id", "mobile_charging_sessions", ["driver_id"])
    op.create_index("ix_mobile_charging_sessions_vehicle_id", "mobile_charging_sessions", ["vehicle_id"])
    op.create_index("ix_mobile_charging_sessions_started_at", "mobile_charging_sessions", ["started_at"])
    op.create_index("ix_mobile_charging_sessions_ended_at", "mobile_charging_sessions", ["ended_at"])
    op.create_index("ix_mobile_charging_sessions_created_at", "mobile_charging_sessions", ["created_at"])

    op.create_table(
        "mobile_issue_events",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("trip_session_id", sa.String(length=36), nullable=True),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("driver_id", sa.String(length=36), nullable=False),
        sa.Column("vehicle_id", sa.String(length=36), nullable=True),
        sa.Column("issue_type", sa.String(length=60), nullable=False),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column("lat", sa.Float(), nullable=True),
        sa.Column("lng", sa.Float(), nullable=True),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("idempotency_key", sa.String(length=80), nullable=True),
        sa.Column("context", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["driver_id"], ["drivers.id"]),
        sa.ForeignKeyConstraint(["trip_session_id"], ["mobile_trip_sessions.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["vehicle_id"], ["vehicles.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("idempotency_key"),
    )
    op.create_index("ix_mobile_issue_events_trip_session_id", "mobile_issue_events", ["trip_session_id"])
    op.create_index("ix_mobile_issue_events_user_id", "mobile_issue_events", ["user_id"])
    op.create_index("ix_mobile_issue_events_driver_id", "mobile_issue_events", ["driver_id"])
    op.create_index("ix_mobile_issue_events_vehicle_id", "mobile_issue_events", ["vehicle_id"])
    op.create_index("ix_mobile_issue_events_issue_type", "mobile_issue_events", ["issue_type"])
    op.create_index("ix_mobile_issue_events_status", "mobile_issue_events", ["status"])
    op.create_index("ix_mobile_issue_events_created_at", "mobile_issue_events", ["created_at"])


def downgrade() -> None:
    for table in (
        "mobile_issue_events",
        "mobile_charging_sessions",
        "mobile_wait_events",
        "mobile_trip_sessions",
        "mobile_location_points",
    ):
        op.drop_table(table)
