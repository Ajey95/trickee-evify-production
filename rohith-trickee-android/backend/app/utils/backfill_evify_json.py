from __future__ import annotations

import argparse
import json
from datetime import datetime
from pathlib import Path
from typing import Any, Iterator
from uuid import uuid4

from sqlalchemy import desc, insert, select

from app.database import SessionLocal
from app.models import Driver, Fleet, Telemetry, Vehicle
from app.services.evify_adapter import normalize_evify_payload
from app.services.physics import compute_derived_fields


def _iter_json_files(path: Path):
    if path.is_file():
        yield path
    else:
        yield from sorted(path.rglob("*.json"))


def _stream_payloads(path: Path) -> Iterator[dict[str, Any]]:
    """Yield top-level JSON objects without loading the full file into memory."""
    decoder = json.JSONDecoder()
    buffer = ""
    in_array = False
    started = False

    with path.open("r", encoding="utf-8") as handle:
        while True:
            chunk = handle.read(1024 * 1024)
            if not chunk and not buffer.strip():
                break
            buffer += chunk

            while True:
                buffer = buffer.lstrip()
                if not buffer:
                    break
                if not started:
                    started = True
                    if buffer[0] == "[":
                        in_array = True
                        buffer = buffer[1:]
                        continue

                buffer = buffer.lstrip()
                if in_array:
                    if buffer.startswith(","):
                        buffer = buffer[1:]
                        continue
                    if buffer.startswith("]"):
                        return

                try:
                    item, idx = decoder.raw_decode(buffer)
                except json.JSONDecodeError:
                    if not chunk:
                        raise
                    break

                buffer = buffer[idx:]
                if isinstance(item, dict):
                    yield item
                if not in_array:
                    return


def _default_fleet_id(db) -> str:
    fleet = db.scalar(select(Fleet).order_by(Fleet.created_at))
    if fleet:
        return fleet.id
    fleet = Fleet(name="Evify Surat Fleet", city="Surat")
    db.add(fleet)
    db.commit()
    return fleet.id


def _load_vehicle_cache(db) -> dict[str, str]:
    return {vehicle.vehicle_code: vehicle.id for vehicle in db.scalars(select(Vehicle)).all()}


def _load_driver_cache(db) -> dict[str, str]:
    return {driver.driver_code: driver.id for driver in db.scalars(select(Driver)).all()}


def _get_or_create_vehicle(db, cache: dict[str, str], fleet_id: str, vehicle_code: str) -> str:
    if vehicle_code in cache:
        return cache[vehicle_code]
    vehicle = Vehicle(fleet_id=fleet_id, vehicle_code=vehicle_code)
    db.add(vehicle)
    db.flush()
    cache[vehicle_code] = vehicle.id
    return vehicle.id


def _get_or_create_driver(db, cache: dict[str, str], fleet_id: str, driver_code: str | None) -> str | None:
    if not driver_code:
        return None
    driver_code = str(driver_code)
    if driver_code in cache:
        return cache[driver_code]
    driver = Driver(
        fleet_id=fleet_id,
        driver_code=driver_code,
        full_name=f"Evify Driver {driver_code}",
        style_label="Moderate",
    )
    db.add(driver)
    db.flush()
    cache[driver_code] = driver.id
    return driver.id


def _existing_times_for_vehicle(db, vehicle_id: str) -> set[datetime]:
    rows = db.execute(select(Telemetry.recorded_at).where(Telemetry.vehicle_id == vehicle_id)).all()
    return {row[0] for row in rows}


def _latest_temp_by_vehicle(db) -> dict[str, float]:
    temps: dict[str, float] = {}
    vehicle_ids = db.scalars(select(Vehicle.id)).all()
    for vehicle_id in vehicle_ids:
        latest = db.scalar(
            select(Telemetry)
            .where(Telemetry.vehicle_id == vehicle_id)
            .order_by(desc(Telemetry.recorded_at))
            .limit(1)
        )
        if latest:
            temps[vehicle_id] = latest.temp_max
    return temps


def _flush_rows(db, rows: list[dict], *, dry_run: bool) -> int:
    if not rows:
        return 0
    if not dry_run:
        db.execute(insert(Telemetry), rows)
        db.commit()
    count = len(rows)
    rows.clear()
    return count


def main() -> None:
    parser = argparse.ArgumentParser(description="Fast historical Evify JSON backfill into Trickee telemetry.")
    parser.add_argument("path", help="Path to a JSON file or folder containing Evify JSON exports.")
    parser.add_argument("--batch-size", type=int, default=5000)
    parser.add_argument("--limit", type=int, default=0, help="Optional max rows to import for smoke tests.")
    parser.add_argument("--dry-run", action="store_true", help="Parse and count rows without inserting.")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        fleet_id = _default_fleet_id(db)
        vehicle_cache = _load_vehicle_cache(db)
        driver_cache = _load_driver_cache(db)
        latest_temp = _latest_temp_by_vehicle(db)
        existing_times_by_vehicle: dict[str, set[datetime]] = {}

        total_seen = 0
        total_inserted = 0
        total_duplicates = 0
        total_invalid = 0
        pending: list[dict] = []

        for file_path in _iter_json_files(Path(args.path)):
            file_seen = 0
            file_inserted = 0
            file_duplicates = 0

            for payload in _stream_payloads(file_path):
                try:
                    normalized = normalize_evify_payload(payload)
                except Exception:
                    total_invalid += 1
                    continue
                if not normalized.get("vehicle_code"):
                    total_invalid += 1
                    continue

                if args.limit and total_inserted >= args.limit:
                    break

                total_seen += 1
                file_seen += 1
                vehicle_id = _get_or_create_vehicle(db, vehicle_cache, fleet_id, str(normalized["vehicle_code"]))
                driver_id = _get_or_create_driver(db, driver_cache, fleet_id, normalized.get("driver_code"))

                if vehicle_id not in existing_times_by_vehicle:
                    existing_times_by_vehicle[vehicle_id] = _existing_times_for_vehicle(db, vehicle_id)
                existing_times = existing_times_by_vehicle[vehicle_id]
                recorded_at = normalized["recorded_at"]
                if recorded_at in existing_times:
                    total_duplicates += 1
                    file_duplicates += 1
                    continue

                prev_temp = latest_temp.get(vehicle_id)
                derived = compute_derived_fields(
                    soc=normalized["soc"],
                    battery_voltage=normalized["battery_voltage"],
                    current=normalized["current"],
                    temp_max=normalized["temp_max"],
                    prev_temp_max=prev_temp,
                    cycle_count=normalized["cycle_count"],
                    soh=normalized["soh"],
                    recorded_at=recorded_at,
                )
                latest_temp[vehicle_id] = normalized["temp_max"]
                existing_times.add(recorded_at)

                pending.append(
                    {
                        "id": str(uuid4()),
                        "vehicle_id": vehicle_id,
                        "driver_id": driver_id,
                        "created_at": datetime.utcnow(),
                        **{k: v for k, v in normalized.items() if k not in {"vehicle_code", "driver_code"}},
                        **derived,
                    }
                )
                if len(pending) >= args.batch_size:
                    flushed = _flush_rows(db, pending, dry_run=args.dry_run)
                    total_inserted += flushed
                    file_inserted += flushed
                    print(f"Committed {total_inserted:,} rows...", flush=True)

            flushed = _flush_rows(db, pending, dry_run=args.dry_run)
            total_inserted += flushed
            file_inserted += flushed
            print(
                f"{file_path.name}: seen {file_seen:,}, inserted {file_inserted:,}, duplicates {file_duplicates:,}",
                flush=True,
            )

            if args.limit and total_inserted >= args.limit:
                break

        if not args.dry_run:
            db.commit()
        print("Evify backfill complete", flush=True)
        print(f"Rows seen: {total_seen:,}", flush=True)
        print(f"Rows inserted: {total_inserted:,}", flush=True)
        print(f"Duplicates skipped: {total_duplicates:,}", flush=True)
        print(f"Invalid skipped: {total_invalid:,}", flush=True)
    finally:
        db.close()


if __name__ == "__main__":
    main()
