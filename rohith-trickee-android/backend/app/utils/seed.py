from __future__ import annotations

import math
import random
from datetime import datetime, timedelta

from sqlalchemy import desc

from app.config import get_settings
from app.database import Base, SessionLocal, engine
from app.models import Driver, Fleet, Telemetry, User, Vehicle
from app.services.auth import hash_password
from app.services.physics import compute_derived_fields


def seed() -> None:
    settings = get_settings()
    if not settings.demo_seed:
        print("DEMO_SEED is false. Skipping demo seed.")
        return
    if not (settings.demo_admin_password and settings.demo_fleet_password and settings.demo_driver_password):
        raise RuntimeError(
            "DEMO_SEED requires DEMO_ADMIN_PASSWORD, DEMO_FLEET_PASSWORD, and DEMO_DRIVER_PASSWORD."
        )

    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if db.query(User).count() > 0:
            print("DB already seeded. Skipping.")
            return

        fleet = Fleet(name="Evify Surat Fleet", city="Surat")
        db.add(fleet)
        db.flush()

        drivers = [
            Driver(fleet_id=fleet.id, driver_code="D047", full_name="Ravi Shah", style_label="Aggressive", personal_factor=1.136),
            Driver(fleet_id=fleet.id, driver_code="D051", full_name="Priya Nair", style_label="Smooth", personal_factor=1.072),
            Driver(fleet_id=fleet.id, driver_code="D033", full_name="Karthik Raj", style_label="Efficient", personal_factor=1.045),
            Driver(fleet_id=fleet.id, driver_code="D058", full_name="Arjun Patel", style_label="Moderate", personal_factor=1.150),
        ]
        db.add_all(drivers)
        db.flush()

        vehicles = [
            Vehicle(fleet_id=fleet.id, vehicle_code="GJ05PZ1903", make="Evify", model="S1 Pro", max_range_km=85),
            Vehicle(fleet_id=fleet.id, vehicle_code="GJ05PZ1847", make="Evify", model="S1 Pro", max_range_km=85),
            Vehicle(fleet_id=fleet.id, vehicle_code="GJ05PZ4573", make="Evify", model="S1 Pro", max_range_km=85),
        ]
        db.add_all(vehicles)
        db.flush()

        users = [
            User(email="admin@trickee.ai", password_hash=hash_password(settings.demo_admin_password), full_name="Arjun Mehta", role="trickee_admin"),
            User(email="fleet@evify.in", password_hash=hash_password(settings.demo_fleet_password), full_name="Rajesh Kumar", role="fleet_operator", fleet_id=fleet.id),
            User(email="driver1@evify.in", password_hash=hash_password(settings.demo_driver_password), full_name="Ravi Shah", role="driver", fleet_id=fleet.id, driver_id=drivers[0].id),
            User(email="driver2@evify.in", password_hash=hash_password(settings.demo_driver_password), full_name="Priya Nair", role="driver", fleet_id=fleet.id, driver_id=drivers[1].id),
        ]
        db.add_all(users)

        start = datetime.utcnow() - timedelta(minutes=5 * 60)
        rng = random.Random(42)
        for v_idx, vehicle in enumerate(vehicles):
            soc = 82.0 - v_idx * 6
            temp = 31.0 + v_idx
            driver = drivers[v_idx % len(drivers)]
            for i in range(60):
                recorded_at = start + timedelta(minutes=5 * i)
                speed = 22 + 8 * math.sin(i / 5.0) + rng.uniform(-2, 2)
                ignition = speed > 3
                current = 7.5 + 2.0 * math.sin(i / 3.0) if ignition else 0.2
                if i % 17 == 0:
                    current = -1.5
                soc = max(5.0, min(100.0, soc - max(current, 0) * 0.018 + (0.03 if current < 0 else 0)))
                temp = temp + max(current, 0) * 0.012 - 0.03
                voltage = 48.0 + soc * 0.07 - current * 0.03
                prev = (
                    db.query(Telemetry)
                    .filter(Telemetry.vehicle_id == vehicle.id)
                    .order_by(desc(Telemetry.recorded_at))
                    .first()
                )
                derived = compute_derived_fields(
                    soc=soc,
                    battery_voltage=voltage,
                    current=current,
                    temp_max=temp,
                    prev_temp_max=prev.temp_max if prev else None,
                    cycle_count=610 + v_idx * 25,
                    soh=95 - v_idx,
                    recorded_at=recorded_at,
                )
                db.add(
                    Telemetry(
                        vehicle_id=vehicle.id,
                        driver_id=driver.id,
                        recorded_at=recorded_at,
                        soc=round(soc, 3),
                        current=round(current, 3),
                        battery_voltage=round(voltage, 3),
                        speed=round(max(speed, 0), 3),
                        temp_max=round(temp, 3),
                        soh=95 - v_idx,
                        charge_plug=current < 0,
                        ignition_on=ignition,
                        regen_status=current < 0,
                        throttle_status=current > 2,
                        cycle_count=610 + v_idx * 25,
                        cell_imbalance_mv=18 + v_idx * 3,
                        wh_throughput=1400 + i * 0.5,
                        lat=21.17 + rng.uniform(-0.03, 0.03),
                        lng=72.83 + rng.uniform(-0.03, 0.03),
                        **derived,
                    )
                )

        db.commit()
        print("Seed complete.")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
