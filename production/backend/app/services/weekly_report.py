from __future__ import annotations

from typing import Any

import httpx

from app.config import get_settings


SENSITIVE_KEYS = {"driver_name", "phone", "email", "full_name", "access_token", "token"}


def _sanitize_for_llm(value: Any) -> Any:
    if isinstance(value, dict):
        return {
            key: _sanitize_for_llm(child)
            for key, child in value.items()
            if key not in SENSITIVE_KEYS
        }
    if isinstance(value, list):
        return [_sanitize_for_llm(item) for item in value[:20]]
    return value


def _fallback_narrative(metrics: dict[str, Any]) -> str:
    summary = metrics.get("fleet_summary", {})
    risk_count = summary.get("battery_risk_drivers", 0)
    charging_count = summary.get("charging_opportunities", 0)
    wait_count = metrics.get("wait_event_count", 0)
    return (
        f"This {metrics.get('period', {}).get('days', 7)}-day live report includes "
        f"{metrics.get('telemetry_rows', 0)} telemetry rows across {metrics.get('driver_count', 0)} drivers. "
        f"{risk_count} drivers need battery-risk attention, {charging_count} drivers have charging opportunities, "
        f"and {wait_count} wait events were detected. Prioritize low-SOC drivers who are already waiting near chargers."
    )


def generate_weekly_report(metrics: dict[str, Any]) -> dict[str, Any]:
    settings = get_settings()
    sanitized_metrics = _sanitize_for_llm(metrics)
    if not settings.groq_api_key:
        return {
            "source": "deterministic",
            "narrative": _fallback_narrative(metrics),
            "llm_status": "groq_not_configured",
        }

    prompt = (
        "Write a concise weekly EV fleet operations report for Evify. "
        "Use only these sanitized metrics. Do not invent names, phone numbers, emails, API keys, or private data. "
        f"Metrics: {sanitized_metrics}"
    )
    payload = {
        "model": settings.groq_model,
        "messages": [
            {"role": "system", "content": "You summarize EV fleet telemetry into operational actions."},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.2,
        "max_tokens": 500,
    }
    headers = {
        "Authorization": f"Bearer {settings.groq_api_key}",
        "Content-Type": "application/json",
    }
    try:
        with httpx.Client(timeout=settings.external_api_timeout_seconds) as client:
            response = client.post("https://api.groq.com/openai/v1/chat/completions", json=payload, headers=headers)
            response.raise_for_status()
            data = response.json()
        narrative = data.get("choices", [{}])[0].get("message", {}).get("content") or _fallback_narrative(metrics)
        return {"source": "groq", "model": settings.groq_model, "narrative": narrative, "llm_status": "ok"}
    except Exception:
        return {
            "source": "deterministic",
            "narrative": _fallback_narrative(metrics),
            "llm_status": "groq_error_fallback",
        }
