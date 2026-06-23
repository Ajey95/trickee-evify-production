"""security event audit and supabase rls baseline

Revision ID: 0008_security_rls
Revises: 0007_supabase_schema_hardening
Create Date: 2026-05-17
"""

from alembic import op
import sqlalchemy as sa

revision = "0008_security_rls"
down_revision = "0007_supabase_schema_hardening"
branch_labels = None
depends_on = None


def _table_exists(table: str) -> bool:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    return table in inspector.get_table_names()


def upgrade() -> None:
    if not _table_exists("security_events"):
        op.create_table(
            "security_events",
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.Column("user_id", sa.String(length=36), nullable=True),
            sa.Column("event_type", sa.String(length=80), nullable=False),
            sa.Column("ip_address", sa.String(length=80), nullable=True),
            sa.Column("user_agent", sa.String(length=255), nullable=True),
            sa.Column("metadata", sa.JSON(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_security_events_user_id", "security_events", ["user_id"])
        op.create_index("ix_security_events_event_type", "security_events", ["event_type"])
        op.create_index("ix_security_events_created_at", "security_events", ["created_at"])

    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return

    op.execute(
        """
        DO $$
        BEGIN
          IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth') THEN
            ALTER TABLE users ENABLE ROW LEVEL SECURITY;
            ALTER TABLE fleets ENABLE ROW LEVEL SECURITY;
            ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
            ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
            ALTER TABLE telemetry ENABLE ROW LEVEL SECURITY;
            ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;
            ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
            ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
            ALTER TABLE driver_behavior_snapshots ENABLE ROW LEVEL SECURITY;
            ALTER TABLE nudge_events ENABLE ROW LEVEL SECURITY;
            ALTER TABLE order_assignment_decisions ENABLE ROW LEVEL SECURITY;
            ALTER TABLE charging_decision_records ENABLE ROW LEVEL SECURITY;
            ALTER TABLE wait_events ENABLE ROW LEVEL SECURITY;
            ALTER TABLE device_push_tokens ENABLE ROW LEVEL SECURITY;
            ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;

            DROP POLICY IF EXISTS users_self_select ON users;
            CREATE POLICY users_self_select ON users
              FOR SELECT TO authenticated
              USING (supabase_user_id = auth.uid()::text AND deleted_at IS NULL);

            DROP POLICY IF EXISTS fleets_scoped_select ON fleets;
            CREATE POLICY fleets_scoped_select ON fleets
              FOR SELECT TO authenticated
              USING (
                deleted_at IS NULL AND EXISTS (
                  SELECT 1 FROM users u
                  WHERE u.supabase_user_id = auth.uid()::text
                    AND u.deleted_at IS NULL
                    AND u.is_active = true
                    AND (u.role = 'trickee_admin' OR u.fleet_id = fleets.id)
                )
              );

            DROP POLICY IF EXISTS drivers_scoped_select ON drivers;
            CREATE POLICY drivers_scoped_select ON drivers
              FOR SELECT TO authenticated
              USING (
                deleted_at IS NULL AND EXISTS (
                  SELECT 1 FROM users u
                  WHERE u.supabase_user_id = auth.uid()::text
                    AND u.deleted_at IS NULL
                    AND u.is_active = true
                    AND (
                      u.role = 'trickee_admin'
                      OR u.fleet_id = drivers.fleet_id
                      OR u.driver_id = drivers.id
                    )
                )
              );

            DROP POLICY IF EXISTS vehicles_scoped_select ON vehicles;
            CREATE POLICY vehicles_scoped_select ON vehicles
              FOR SELECT TO authenticated
              USING (
                deleted_at IS NULL AND EXISTS (
                  SELECT 1 FROM users u
                  WHERE u.supabase_user_id = auth.uid()::text
                    AND u.deleted_at IS NULL
                    AND u.is_active = true
                    AND (u.role = 'trickee_admin' OR u.fleet_id = vehicles.fleet_id)
                )
              );
          END IF;
        END $$;
        """
    )


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute(
            """
            DO $$
            BEGIN
              IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth') THEN
                DROP POLICY IF EXISTS vehicles_scoped_select ON vehicles;
                DROP POLICY IF EXISTS drivers_scoped_select ON drivers;
                DROP POLICY IF EXISTS fleets_scoped_select ON fleets;
                DROP POLICY IF EXISTS users_self_select ON users;
              END IF;
            END $$;
            """
        )

    if _table_exists("security_events"):
        op.drop_index("ix_security_events_created_at", table_name="security_events")
        op.drop_index("ix_security_events_event_type", table_name="security_events")
        op.drop_index("ix_security_events_user_id", table_name="security_events")
        op.drop_table("security_events")
