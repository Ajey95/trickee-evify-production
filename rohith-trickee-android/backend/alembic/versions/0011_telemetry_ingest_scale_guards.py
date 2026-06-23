"""telemetry ingest scale guards

Revision ID: 0011_ingest_scale
Revises: 0010_access_requests
Create Date: 2026-05-22
"""

from alembic import op

revision = "0011_ingest_scale"
down_revision = "0010_access_requests"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Keep one telemetry row per vehicle/timestamp. This protects the pilot
    # bulk-ingest path when devices retry the same payload or concurrent
    # requests race before the application-level duplicate check sees a row.
    op.execute(
        """
        DELETE FROM telemetry existing
        USING telemetry duplicate
        WHERE existing.vehicle_id = duplicate.vehicle_id
          AND existing.recorded_at = duplicate.recorded_at
          AND existing.ctid < duplicate.ctid
        """
    )
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS ux_telemetry_vehicle_recorded_at "
        "ON telemetry (vehicle_id, recorded_at)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ux_telemetry_vehicle_recorded_at")
