from __future__ import annotations

import importlib.util
from pathlib import Path

import sqlalchemy as sa
from alembic.migration import MigrationContext
from alembic.operations import Operations


def _migration_module():
    path = Path(__file__).parents[1] / "alembic" / "versions" / "0015_account_access.py"
    spec = importlib.util.spec_from_file_location("account_access_migration", path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_account_access_migration_provisions_existing_jshah_user():
    engine = sa.create_engine("sqlite:///:memory:")
    metadata = sa.MetaData()
    users = sa.Table(
        "users",
        metadata,
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("role", sa.String(50), nullable=False),
        sa.Column("is_active", sa.Boolean, nullable=False),
        sa.Column("deleted_at", sa.DateTime, nullable=True),
        sa.Column("fleet_id", sa.String(36), nullable=True),
        sa.Column("driver_id", sa.String(36), nullable=True),
    )
    metadata.create_all(engine)

    with engine.begin() as connection:
        connection.execute(
            users.insert().values(
                id="viewer-1",
                email="jshah862@gmail.com",
                role="driver",
                is_active=False,
                fleet_id="fleet-1",
                driver_id="driver-1",
            )
        )
        migration = _migration_module()
        migration.op = Operations(MigrationContext.configure(connection))
        migration.upgrade()

        columns = {column["name"] for column in sa.inspect(connection).get_columns("users")}
        assert {"access_mode", "capabilities"}.issubset(columns)
        row = connection.execute(
            sa.text(
                "SELECT role, access_mode, capabilities, is_active, deleted_at, fleet_id, driver_id "
                "FROM users WHERE email = 'jshah862@gmail.com'"
            )
        ).mappings().one()
        assert row["role"] == "trickee_admin"
        assert row["access_mode"] == "read_only"
        assert row["capabilities"] == '["mock_sos"]'
        assert bool(row["is_active"]) is True
        assert row["deleted_at"] is None
        assert row["fleet_id"] is None
        assert row["driver_id"] is None
