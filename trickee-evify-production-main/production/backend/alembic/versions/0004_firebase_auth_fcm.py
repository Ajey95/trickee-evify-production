"""firebase auth and fcm

Revision ID: 0004_firebase_auth_fcm
Revises: 0003_wait_events
Create Date: 2026-04-29
"""

from alembic import op
import sqlalchemy as sa

revision = "0004_firebase_auth_fcm"
down_revision = "0003_wait_events"
branch_labels = None
depends_on = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    existing_tables = set(inspector.get_table_names())
    user_columns = {column["name"] for column in inspector.get_columns("users")} if "users" in existing_tables else set()
    if "firebase_uid" not in user_columns:
        op.add_column("users", sa.Column("firebase_uid", sa.String(length=128), nullable=True))
        op.create_index("ix_users_firebase_uid", "users", ["firebase_uid"], unique=True)
    if "auth_provider" not in user_columns:
        op.add_column("users", sa.Column("auth_provider", sa.String(length=50), nullable=False, server_default="password"))

    if "device_push_tokens" in existing_tables:
        return

    op.create_table(
        "device_push_tokens",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("token", sa.Text(), nullable=False),
        sa.Column("platform", sa.String(length=50), nullable=False),
        sa.Column("device_label", sa.String(length=255), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token"),
    )
    op.create_index("ix_device_push_tokens_user_id", "device_push_tokens", ["user_id"])
    op.create_index("ix_device_push_tokens_created_at", "device_push_tokens", ["created_at"])


def downgrade() -> None:
    op.drop_table("device_push_tokens")
    op.drop_index("ix_users_firebase_uid", table_name="users")
    op.drop_column("users", "auth_provider")
    op.drop_column("users", "firebase_uid")
