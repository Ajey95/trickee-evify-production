from __future__ import annotations

from datetime import datetime

MAX_EVAL_SOC_DELTA_PCT = 5.0
MAX_SOC_DELTA_PCT_PER_MIN = 1.5
MAX_SOC_DELTA_PCT_ABSOLUTE = 40.0


def is_plausible_eval_soc_delta(delta_soc: float | None, max_abs_delta_pct: float = MAX_EVAL_SOC_DELTA_PCT) -> bool:
    if delta_soc is None:
        return False
    return abs(float(delta_soc)) <= max_abs_delta_pct


def max_plausible_soc_delta(elapsed_minutes: float) -> float:
    if elapsed_minutes <= 0:
        return MAX_EVAL_SOC_DELTA_PCT
    return min(
        MAX_SOC_DELTA_PCT_ABSOLUTE,
        max(MAX_EVAL_SOC_DELTA_PCT, elapsed_minutes * MAX_SOC_DELTA_PCT_PER_MIN),
    )


def is_plausible_soc_transition(
    previous_soc: float | None,
    current_soc: float | None,
    previous_at: datetime | None,
    current_at: datetime | None,
) -> bool:
    if previous_soc is None or current_soc is None or previous_at is None or current_at is None:
        return True
    if not (0 <= float(previous_soc) <= 100 and 0 <= float(current_soc) <= 100):
        return False

    elapsed_minutes = (current_at - previous_at).total_seconds() / 60.0
    if elapsed_minutes < 0:
        return False

    allowed_delta = max_plausible_soc_delta(elapsed_minutes)
    return abs(float(current_soc) - float(previous_soc)) <= allowed_delta


def latest_plausible_soc_segment(rows):
    """Return the newest contiguous segment that has no impossible SOC transitions."""
    segment = []
    rejected = []
    for row in rows:
        if not segment:
            segment = [row]
            continue
        previous = segment[-1]
        if is_plausible_soc_transition(previous.soc, row.soc, previous.recorded_at, row.recorded_at):
            segment.append(row)
            continue
        rejected.append(
            {
                "previous_recorded_at": previous.recorded_at.isoformat() if previous.recorded_at else None,
                "current_recorded_at": row.recorded_at.isoformat() if row.recorded_at else None,
                "previous_soc": previous.soc,
                "current_soc": row.soc,
                "delta_soc": round(float(row.soc) - float(previous.soc), 3),
            }
        )
        segment = [row]
    return segment, rejected
