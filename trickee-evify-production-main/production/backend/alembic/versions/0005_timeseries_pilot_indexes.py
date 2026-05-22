"""timeseries pilot indexes

Revision ID: 0005_timeseries_pilot_indexes
Revises: 0004_firebase_auth_fcm
Create Date: 2026-04-30
"""

from alembic import op

revision = "0005_timeseries_pilot_indexes"
down_revision = "0004_firebase_auth_fcm"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Supabase PG17 does not expose TimescaleDB on this project, so these
    # indexes make the normal Postgres telemetry table pilot-ready for
    # latest-point and time-window queries.
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_partman WITH SCHEMA extensions")
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_telemetry_vehicle_recorded_at_desc "
        "ON telemetry (vehicle_id, recorded_at DESC)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_telemetry_driver_recorded_at_desc "
        "ON telemetry (driver_id, recorded_at DESC)"
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_telemetry_recorded_at_desc ON telemetry (recorded_at DESC)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_telemetry_recorded_at_brin ON telemetry USING BRIN (recorded_at)")
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_predictions_vehicle_predicted_at_desc "
        "ON predictions (vehicle_id, predicted_at DESC)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_wait_events_vehicle_started_at_desc "
        "ON wait_events (vehicle_id, started_at DESC)"
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_trips_driver_started_at_desc ON trips (driver_id, started_at DESC)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_alerts_vehicle_created_at_desc ON alerts (vehicle_id, created_at DESC)")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_alerts_vehicle_created_at_desc")
    op.execute("DROP INDEX IF EXISTS ix_trips_driver_started_at_desc")
    op.execute("DROP INDEX IF EXISTS ix_wait_events_vehicle_started_at_desc")
    op.execute("DROP INDEX IF EXISTS ix_predictions_vehicle_predicted_at_desc")
    op.execute("DROP INDEX IF EXISTS ix_telemetry_recorded_at_brin")
    op.execute("DROP INDEX IF EXISTS ix_telemetry_recorded_at_desc")
    op.execute("DROP INDEX IF EXISTS ix_telemetry_driver_recorded_at_desc")
    op.execute("DROP INDEX IF EXISTS ix_telemetry_vehicle_recorded_at_desc")
