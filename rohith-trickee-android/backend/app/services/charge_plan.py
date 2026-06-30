from __future__ import annotations

import math
from typing import Any

DEFAULT_DESTINATION_BUFFER_PCT = 10.0
DEFAULT_CHARGE_RATE_PCT_PER_MIN = 1.35


def build_destination_charge_plan(
    *,
    current_soc_pct: float,
    soc_required_pct: float,
    charger: dict[str, Any] | None = None,
    buffer_pct: float = DEFAULT_DESTINATION_BUFFER_PCT,
    charge_rate_pct_per_min: float = DEFAULT_CHARGE_RATE_PCT_PER_MIN,
) -> dict[str, Any]:
    """Estimate top-up needed to reach destination with a safety SOC buffer."""
    current_soc = max(0.0, min(100.0, float(current_soc_pct)))
    required_soc = max(0.0, float(soc_required_pct))
    buffer = max(0.0, float(buffer_pct))
    target_soc = min(100.0, required_soc + buffer)
    needed_pct = max(0.0, target_soc - current_soc)
    rate = max(float(charge_rate_pct_per_min), 0.1)
    minutes = int(math.ceil(needed_pct / rate)) if needed_pct > 0 else 0
    charger_name = charger.get("name") if charger else "nearest available charger"

    return {
        "needed": needed_pct > 0,
        "current_soc_pct": round(current_soc, 1),
        "destination_soc_required_pct": round(required_soc, 1),
        "buffer_pct": round(buffer, 1),
        "target_soc_pct": round(target_soc, 1),
        "top_up_soc_pct": round(needed_pct, 1),
        "charge_minutes": minutes,
        "charge_rate_pct_per_min": round(rate, 2),
        "charger": charger,
        "charger_name": charger_name,
        "message": (
            f"Destination needs {required_soc:.1f}% SOC. You have {current_soc:.1f}%. "
            f"Charge for {minutes} min at {charger_name} to reach with {buffer:.0f}% buffer."
            if needed_pct > 0
            else f"Destination needs {required_soc:.1f}% SOC. You have {current_soc:.1f}%; no top-up needed to keep {buffer:.0f}% buffer."
        ),
    }
