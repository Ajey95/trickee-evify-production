"""supabase auth and schema hardening

Revision ID: 0007_supabase_schema_hardening
Revises: 0006_archetype_history
Create Date: 2026-05-14
"""

from alembic import op
import sqlalchemy as sa

revision = "0007_supabase_schema_hardening"
down_revision = "0006_archetype_history"
branch_labels = None
depends_on = None


def _add_column_if_missing(table: str, column: sa.Column) -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if column.name not in {col["name"] for col in inspector.get_columns(table)}:
        op.add_column(table, column)


def _create_index(name: str, table: str, columns: list[str], unique: bool = False) -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if name not in {idx["name"] for idx in inspector.get_indexes(table)}:
        op.create_index(name, table, columns, unique=unique)


def upgrade() -> None:
    _add_column_if_missing("users", sa.Column("supabase_user_id", sa.String(length=128), nullable=True))
    _add_column_if_missing("users", sa.Column("deleted_at", sa.DateTime(), nullable=True))
    with op.batch_alter_table("users") as batch_op:
        batch_op.alter_column("password_hash", existing_type=sa.String(length=255), nullable=True)
    _create_index("ix_users_supabase_user_id", "users", ["supabase_user_id"], unique=True)
    _create_index("ix_users_deleted_at", "users", ["deleted_at"])

    for table in ("fleets", "vehicles", "drivers"):
        _add_column_if_missing(table, sa.Column("updated_at", sa.DateTime(), nullable=True))
        _add_column_if_missing(table, sa.Column("deleted_at", sa.DateTime(), nullable=True))
        _create_index(f"ix_{table}_deleted_at", table, ["deleted_at"])

    for table in ("trips", "nudge_events", "order_assignment_decisions", "charging_decision_records", "alerts"):
        _add_column_if_missing(table, sa.Column("updated_at", sa.DateTime(), nullable=True))

    _add_column_if_missing("trips", sa.Column("created_at", sa.DateTime(), nullable=True))
    _create_index("ix_trips_created_at", "trips", ["created_at"])
    _create_index("ix_alerts_driver_created_at_desc", "alerts", ["driver_id", "created_at"])
    _create_index("ix_nudge_events_driver_created_at_desc", "nudge_events", ["driver_id", "created_at"])
    _create_index("ix_order_assignment_driver_created_at_desc", "order_assignment_decisions", ["assigned_driver_id", "created_at"])
    _create_index("ix_charging_decision_driver_created_at_desc", "charging_decision_records", ["driver_id", "created_at"])
    _create_index("ix_wait_events_driver_started_at_desc", "wait_events", ["driver_id", "started_at"])


def downgrade() -> None:
    for table, name in (
        ("wait_events", "ix_wait_events_driver_started_at_desc"),
        ("charging_decision_records", "ix_charging_decision_driver_created_at_desc"),
        ("order_assignment_decisions", "ix_order_assignment_driver_created_at_desc"),
        ("nudge_events", "ix_nudge_events_driver_created_at_desc"),
        ("alerts", "ix_alerts_driver_created_at_desc"),
        ("trips", "ix_trips_created_at"),
        ("drivers", "ix_drivers_deleted_at"),
        ("vehicles", "ix_vehicles_deleted_at"),
        ("fleets", "ix_fleets_deleted_at"),
        ("users", "ix_users_deleted_at"),
        ("users", "ix_users_supabase_user_id"),
    ):
        op.drop_index(name, table_name=table)

    op.drop_column("trips", "created_at")
    for table in ("alerts", "charging_decision_records", "order_assignment_decisions", "nudge_events", "trips"):
        op.drop_column(table, "updated_at")
    for table in ("drivers", "vehicles", "fleets"):
        op.drop_column(table, "deleted_at")
        op.drop_column(table, "updated_at")
    op.drop_column("users", "deleted_at")
    op.drop_column("users", "supabase_user_id")
    with op.batch_alter_table("users") as batch_op:
        batch_op.alter_column("password_hash", existing_type=sa.String(length=255), nullable=False)
