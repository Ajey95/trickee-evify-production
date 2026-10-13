"""persist account access modes and capabilities

Revision ID: 0015_account_access
Revises: 0014_google_oauth
Create Date: 2026-10-13
"""

from alembic import op
import sqlalchemy as sa


revision = "0015_account_access"
down_revision = "0014_google_oauth"
branch_labels = None
depends_on = None


def _columns(table_name: str) -> set[str]:
    inspector = sa.inspect(op.get_bind())
    return {column["name"] for column in inspector.get_columns(table_name)}


def upgrade():
    columns = _columns("users")
    if "access_mode" not in columns:
        op.add_column(
            "users",
            sa.Column("access_mode", sa.String(length=30), nullable=False, server_default="full"),
        )
    if "capabilities" not in columns:
        op.add_column(
            "users",
            sa.Column("capabilities", sa.JSON(), nullable=False, server_default=sa.text("'[]'")),
        )

    # Idempotently provision the specifically approved view-only administrator.
    users = sa.table(
        "users",
        sa.column("email", sa.String),
        sa.column("role", sa.String),
        sa.column("access_mode", sa.String),
        sa.column("capabilities", sa.JSON),
        sa.column("is_active", sa.Boolean),
        sa.column("deleted_at", sa.DateTime),
        sa.column("fleet_id", sa.String),
        sa.column("driver_id", sa.String),
    )
    op.execute(
        users.update()
        .where(sa.func.lower(users.c.email) == "jshah862@gmail.com")
        .values(
            role="trickee_admin",
            access_mode="read_only",
            capabilities=["mock_sos"],
            is_active=True,
            deleted_at=None,
            fleet_id=None,
            driver_id=None,
        )
    )


def downgrade():
    columns = _columns("users")
    if "capabilities" in columns:
        op.drop_column("users", "capabilities")
    if "access_mode" in columns:
        op.drop_column("users", "access_mode")
