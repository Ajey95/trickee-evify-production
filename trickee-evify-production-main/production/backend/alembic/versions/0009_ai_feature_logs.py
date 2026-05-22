"""AI feature logs and profile snapshots

Revision ID: 0009_ai_feature_logs
Revises: 0008_security_rls
Create Date: 2026-05-17
"""

from alembic import op
import sqlalchemy as sa


revision = "0009_ai_feature_logs"
down_revision = "0008_security_rls"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "ai_interaction_logs",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id"), nullable=True, index=True),
        sa.Column("driver_id", sa.String(length=36), sa.ForeignKey("drivers.id"), nullable=True, index=True),
        sa.Column("vehicle_id", sa.String(length=36), sa.ForeignKey("vehicles.id"), nullable=True, index=True),
        sa.Column("fleet_id", sa.String(length=36), sa.ForeignKey("fleets.id"), nullable=True, index=True),
        sa.Column("feature", sa.String(length=80), nullable=False, index=True),
        sa.Column("prompt_version", sa.String(length=40), nullable=False, server_default="v1"),
        sa.Column("model_name", sa.String(length=120), nullable=True),
        sa.Column("tool_calls", sa.JSON(), nullable=True),
        sa.Column("token_usage", sa.JSON(), nullable=True),
        sa.Column("latency_ms", sa.Integer(), nullable=True),
        sa.Column("fallback_used", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("success", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("error_message", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now(), index=True),
    )
    op.create_table(
        "tool_call_logs",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id"), nullable=True, index=True),
        sa.Column("driver_id", sa.String(length=36), sa.ForeignKey("drivers.id"), nullable=True, index=True),
        sa.Column("vehicle_id", sa.String(length=36), sa.ForeignKey("vehicles.id"), nullable=True, index=True),
        sa.Column("fleet_id", sa.String(length=36), sa.ForeignKey("fleets.id"), nullable=True, index=True),
        sa.Column("feature", sa.String(length=80), nullable=False, index=True),
        sa.Column("tool_name", sa.String(length=120), nullable=False, index=True),
        sa.Column("input_summary", sa.JSON(), nullable=True),
        sa.Column("output_summary", sa.JSON(), nullable=True),
        sa.Column("success", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("fallback_used", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("latency_ms", sa.Integer(), nullable=True),
        sa.Column("error_message", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now(), index=True),
    )
    op.create_table(
        "notification_personalization_logs",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id"), nullable=True, index=True),
        sa.Column("driver_id", sa.String(length=36), sa.ForeignKey("drivers.id"), nullable=True, index=True),
        sa.Column("vehicle_id", sa.String(length=36), sa.ForeignKey("vehicles.id"), nullable=True, index=True),
        sa.Column("alert_type", sa.String(length=50), nullable=False, index=True),
        sa.Column("severity", sa.String(length=30), nullable=False),
        sa.Column("action", sa.String(length=255), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("tone", sa.String(length=30), nullable=False),
        sa.Column("send", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("fallback_used", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("raw_data_summary", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now(), index=True),
    )
    op.create_table(
        "assistant_messages",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id"), nullable=True, index=True),
        sa.Column("driver_id", sa.String(length=36), sa.ForeignKey("drivers.id"), nullable=True, index=True),
        sa.Column("vehicle_id", sa.String(length=36), sa.ForeignKey("vehicles.id"), nullable=True, index=True),
        sa.Column("channel", sa.String(length=30), nullable=False, server_default="app"),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("response", sa.Text(), nullable=False),
        sa.Column("intent", sa.String(length=80), nullable=False, index=True),
        sa.Column("tool_calls", sa.JSON(), nullable=True),
        sa.Column("confidence", sa.Float(), nullable=False, server_default="0"),
        sa.Column("escalated", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now(), index=True),
    )
    op.create_table(
        "driver_profile_snapshots",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("driver_id", sa.String(length=36), sa.ForeignKey("drivers.id"), nullable=False, index=True),
        sa.Column("profile", sa.JSON(), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=False, server_default="0"),
        sa.Column("source", sa.String(length=50), nullable=False, server_default="rolling_metrics"),
        sa.Column("created_by_user_id", sa.String(length=36), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now(), index=True),
    )
    op.create_table(
        "driver_coaching_events",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("driver_id", sa.String(length=36), sa.ForeignKey("drivers.id"), nullable=False, index=True),
        sa.Column("vehicle_id", sa.String(length=36), sa.ForeignKey("vehicles.id"), nullable=True, index=True),
        sa.Column("trip_id", sa.String(length=36), sa.ForeignKey("trips.id"), nullable=True, index=True),
        sa.Column("mode", sa.String(length=20), nullable=False, server_default="trip"),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("metrics", sa.JSON(), nullable=True),
        sa.Column("tips", sa.JSON(), nullable=True),
        sa.Column("tone", sa.String(length=30), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now(), index=True),
    )
    op.create_table(
        "fleet_summary_logs",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("fleet_id", sa.String(length=36), sa.ForeignKey("fleets.id"), nullable=True, index=True),
        sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id"), nullable=True, index=True),
        sa.Column("summary_type", sa.String(length=30), nullable=False, server_default="realtime"),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("risks", sa.JSON(), nullable=True),
        sa.Column("suggested_actions", sa.JSON(), nullable=True),
        sa.Column("vehicles_flagged", sa.JSON(), nullable=True),
        sa.Column("fallback_used", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now(), index=True),
    )


def downgrade() -> None:
    for table in (
        "fleet_summary_logs",
        "driver_coaching_events",
        "driver_profile_snapshots",
        "assistant_messages",
        "notification_personalization_logs",
        "tool_call_logs",
        "ai_interaction_logs",
    ):
        op.drop_table(table)
