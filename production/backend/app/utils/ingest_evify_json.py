from __future__ import annotations

import argparse
import json
from pathlib import Path

from app.database import SessionLocal
from app.models import Fleet
from app.services.telemetry_ingest import ingest_evify_payload


def _iter_payloads(path: Path):
    files = sorted(path.glob("*.json")) if path.is_dir() else [path]
    for file_path in files:
        with file_path.open("r", encoding="utf-8") as handle:
            data = json.load(handle)
        if isinstance(data, list):
            for item in data:
                if isinstance(item, dict):
                    yield file_path.name, item
        elif isinstance(data, dict):
            yield file_path.name, data


def main() -> None:
    parser = argparse.ArgumentParser(description="Import Evify JSON telemetry into Trickee backend DB.")
    parser.add_argument("path", help="Path to a JSON file or folder containing Evify JSON exports.")
    parser.add_argument("--batch-size", type=int, default=1000)
    args = parser.parse_args()

    db = SessionLocal()
    try:
        if not db.query(Fleet).first():
            db.add(Fleet(name="Evify Surat Fleet", city="Surat"))
            db.commit()

        ingested = 0
        skipped_or_duplicate = 0
        by_file: dict[str, int] = {}
        for file_name, payload in _iter_payloads(Path(args.path)):
            row, _ = ingest_evify_payload(db, payload, commit=False)
            if row.id:
                ingested += 1
                by_file[file_name] = by_file.get(file_name, 0) + 1
            else:
                skipped_or_duplicate += 1
            if ingested and ingested % args.batch_size == 0:
                db.commit()
                print(f"Committed {ingested:,} telemetry rows...")
        db.commit()
        print("Evify import complete")
        print(f"Rows processed/imported: {ingested:,}")
        if skipped_or_duplicate:
            print(f"Skipped/duplicates: {skipped_or_duplicate:,}")
        for file_name, count in sorted(by_file.items()):
            print(f"  {file_name}: {count:,}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
