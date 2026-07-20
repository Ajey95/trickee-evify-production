from pathlib import Path

from alembic.config import Config
from alembic.script import ScriptDirectory


def test_alembic_revision_ids_fit_default_version_column():
    backend_dir = Path(__file__).resolve().parents[1]
    config = Config(str(backend_dir / "alembic.ini"))
    config.set_main_option("script_location", str(backend_dir / "alembic"))
    revisions = ScriptDirectory.from_config(config).walk_revisions()

    oversized = [revision.revision for revision in revisions if len(revision.revision) > 32]

    assert oversized == []
