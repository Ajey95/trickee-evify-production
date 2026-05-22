"""archetype history on driver behavior snapshots

Revision ID: 0006_archetype_history
Revises: 0005_timeseries_pilot_indexes
Create Date: 2026-05-12
"""

from alembic import op
import sqlalchemy as sa

revision = "0006_archetype_history"
down_revision = "0005_timeseries_pilot_indexes"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("driver_behavior_snapshots", sa.Column("archetype_label", sa.String(length=50), nullable=True))
    op.add_column("driver_behavior_snapshots", sa.Column("archetype_confidence", sa.Float(), nullable=True))
    op.add_column("driver_behavior_snapshots", sa.Column("archetype_source", sa.String(length=50), nullable=True))
    op.add_column("driver_behavior_snapshots", sa.Column("archetype_payload", sa.JSON(), nullable=True))
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_driver_behavior_archetype_time "
        "ON driver_behavior_snapshots (driver_id, archetype_label, computed_at DESC)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_driver_behavior_archetype_time")
    op.drop_column("driver_behavior_snapshots", "archetype_payload")
    op.drop_column("driver_behavior_snapshots", "archetype_source")
    op.drop_column("driver_behavior_snapshots", "archetype_confidence")
    op.drop_column("driver_behavior_snapshots", "archetype_label")
