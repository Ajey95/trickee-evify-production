"""Seed demo past trips for the pilot drivers so the mobile Past Trips screen
has realistic data. Idempotent: skips drivers that already have trips."""
import os
from datetime import datetime, timedelta

os.environ.setdefault("DATABASE_URL", "sqlite:///./trickee.local.db")
os.environ.setdefault("LEGACY_AUTH_ENABLED", "true")
os.environ.setdefault("ENVIRONMENT", "development")

from app.database import SessionLocal  # noqa: E402
from app.models import Driver, Trip, Vehicle  # noqa: E402

# Realistic Surat-area routes (origin label, dest label, origin latlng, dest latlng, km)
ROUTES = [
    ("Adajan Depot", "Vesu Hub", (21.1959, 72.7933), (21.1417, 72.7717), 9.4),
    ("Vesu Hub", "Piplod Center", (21.1417, 72.7717), (21.1592, 72.7758), 5.1),
    ("Piplod Center", "Athwa Gate", (21.1592, 72.7758), (21.1862, 72.8089), 7.2),
    ("Athwa Gate", "Udhna Warehouse", (21.1862, 72.8089), (21.1697, 72.8489), 6.6),
    ("Udhna Warehouse", "Katargam Hub", (21.1697, 72.8489), (21.2356, 72.8344), 11.3),
    ("Katargam Hub", "Adajan Depot", (21.2356, 72.8344), (21.1959, 72.7933), 8.7),
    ("Adajan Depot", "Pal Charging Stn", (21.1959, 72.7933), (21.1850, 72.7700), 4.3),
    ("Pal Charging Stn", "Dumas Road", (21.1850, 72.7700), (21.0833, 72.7167), 13.9),
]


def seed_for_driver(db, driver: Driver, vehicle_id: str, base: datetime):
    existing = db.query(Trip).filter(Trip.driver_id == driver.id).count()
    if existing:
        print(f"  {driver.full_name}: {existing} trips already — skipping")
        return 0
    soc = 96.0
    created = 0
    for i, (o_lbl, d_lbl, o_ll, d_ll, km) in enumerate(ROUTES):
        start = base - timedelta(days=i // 2, hours=6 - (i % 2) * 5)
        dur_min = int(km * 3.2 + 8)
        end = start + timedelta(minutes=dur_min)
        kwh = round(km * 0.135, 2)
        soc_start = round(soc, 1)
        soc_end = round(max(18.0, soc - (kwh / 15.0) * 100), 1)
        soc = soc_end if soc_end > 30 else 100.0  # "recharged" overnight
        trip = Trip(
            vehicle_id=vehicle_id,
            driver_id=driver.id,
            started_at=start,
            ended_at=end,
            origin_lat=o_ll[0], origin_lng=o_ll[1],
            dest_lat=d_ll[0], dest_lng=d_ll[1],
            origin_label=o_lbl, dest_label=d_lbl,
            soc_start=soc_start, soc_end=soc_end,
            kwh_used=kwh, distance_km=km,
            route_taken="eco" if i % 2 == 0 else "fast",
            recommended_route="eco",
            followed_nudge=(i % 3 != 0),
        )
        db.add(trip)
        created += 1
    print(f"  {driver.full_name}: seeded {created} trips")
    return created


def main():
    db = SessionLocal()
    try:
        drivers = db.query(Driver).all()
        if not drivers:
            print("No drivers found. Run the main seed first.")
            return
        total = 0
        for d in drivers:
            veh = (
                db.query(Vehicle).filter(Vehicle.id == d.assigned_vehicle_id).first()
                if getattr(d, "assigned_vehicle_id", None)
                else db.query(Vehicle).first()
            )
            if veh is None:
                print(f"  {d.full_name}: no vehicle — skipping")
                continue
            total += seed_for_driver(db, d, veh.id, datetime.utcnow())
        db.commit()
        print(f"Done. {total} trips inserted.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
