"""google oauth refresh sessions

Revision ID: 0014_google_oauth
Revises: 0013_mobile_action_button
Create Date: 2026-07-17
"""

from alembic import op
import sqlalchemy as sa


revision = "0014_google_oauth"
down_revision = "0013_mobile_action_button"
branch_labels = None
depends_on = None


def _columns(table_name: str) -> set[str]:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    return {column["name"] for column in inspector.get_columns(table_name)}


def _tables() -> set[str]:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    return set(inspector.get_table_names())


def upgrade():
    user_columns = _columns("users")
    if "google_sub" not in user_columns:
        op.add_column("users", sa.Column("google_sub", sa.String(length=128), nullable=True))
        op.create_index("ix_users_google_sub", "users", ["google_sub"], unique=True)

    if "refresh_sessions" not in _tables():
        op.create_table(
            "refresh_sessions",
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.Column("user_id", sa.String(length=36), nullable=False),
            sa.Column("token_hash", sa.String(length=64), nullable=False),
            sa.Column("auth_provider", sa.String(length=50), nullable=False, server_default="google"),
            sa.Column("user_agent", sa.String(length=255), nullable=True),
            sa.Column("ip_address", sa.String(length=80), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.Column("expires_at", sa.DateTime(), nullable=False),
            sa.Column("revoked_at", sa.DateTime(), nullable=True),
            sa.Column("rotated_at", sa.DateTime(), nullable=True),
            sa.Column("replaced_by_session_id", sa.String(length=36), nullable=True),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_refresh_sessions_created_at", "refresh_sessions", ["created_at"])
        op.create_index("ix_refresh_sessions_expires_at", "refresh_sessions", ["expires_at"])
        op.create_index("ix_refresh_sessions_revoked_at", "refresh_sessions", ["revoked_at"])
        op.create_index("ix_refresh_sessions_token_hash", "refresh_sessions", ["token_hash"], unique=True)
        op.create_index("ix_refresh_sessions_user_id", "refresh_sessions", ["user_id"])


def downgrade():
    if "refresh_sessions" in _tables():
        op.drop_index("ix_refresh_sessions_user_id", table_name="refresh_sessions")
        op.drop_index("ix_refresh_sessions_token_hash", table_name="refresh_sessions")
        op.drop_index("ix_refresh_sessions_revoked_at", table_name="refresh_sessions")
        op.drop_index("ix_refresh_sessions_expires_at", table_name="refresh_sessions")
        op.drop_index("ix_refresh_sessions_created_at", table_name="refresh_sessions")
        op.drop_table("refresh_sessions")

    user_columns = _columns("users")
    if "google_sub" in user_columns:
        op.drop_index("ix_users_google_sub", table_name="users")
        op.drop_column("users", "google_sub")
