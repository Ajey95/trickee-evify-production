"""access request queue

Revision ID: 0010_access_requests
Revises: 0009_ai_feature_logs
Create Date: 2026-05-18
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision = "0010_access_requests"
down_revision = "0009_ai_feature_logs"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "access_requests",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("supabase_user_id", sa.String(length=128), nullable=True),
        sa.Column("full_name", sa.String(length=255), nullable=False),
        sa.Column("company", sa.String(length=255), nullable=True),
        sa.Column("requested_role", sa.String(length=50), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("reviewed_by_user_id", sa.String(length=36), nullable=True),
        sa.Column("review_note", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["reviewed_by_user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
    )
    op.create_index(op.f("ix_access_requests_created_at"), "access_requests", ["created_at"], unique=False)
    op.create_index(op.f("ix_access_requests_email"), "access_requests", ["email"], unique=False)
    op.create_index(op.f("ix_access_requests_status"), "access_requests", ["status"], unique=False)
    op.create_index(op.f("ix_access_requests_supabase_user_id"), "access_requests", ["supabase_user_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_access_requests_supabase_user_id"), table_name="access_requests")
    op.drop_index(op.f("ix_access_requests_status"), table_name="access_requests")
    op.drop_index(op.f("ix_access_requests_email"), table_name="access_requests")
    op.drop_index(op.f("ix_access_requests_created_at"), table_name="access_requests")
    op.drop_table("access_requests")
