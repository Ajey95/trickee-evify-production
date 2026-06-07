from __future__ import annotations

from dataclasses import dataclass
import logging
import time
from typing import Any

import httpx
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import AIInteractionLog, User
from app.services.ai.safety import clamp_sentences, safe_error, sanitize_payload, sanitize_text

logger = logging.getLogger(__name__)


@dataclass
class LLMResult:
    text: str
    fallback_used: bool
    model_name: str | None = None
    latency_ms: int | None = None
    token_usage: dict[str, Any] | None = None
    error_message: str | None = None


class LLMClient:
    prompt_version = "v1"

    def compose(
        self,
        *,
        feature: str,
        system: str,
        facts: dict[str, Any],
        fallback: str,
        max_sentences: int = 2,
        max_tokens: int | None = None,
    ) -> LLMResult:
        settings = get_settings()
        fallback_text = clamp_sentences(fallback, max_sentences=max_sentences)
        provider = (settings.llm_provider or "gemini").lower()
        if provider == "gemini" and settings.gemini_api_key:
            return self._compose_gemini(
                settings=settings,
                feature=feature,
                system=system,
                facts=facts,
                fallback_text=fallback_text,
                max_sentences=max_sentences,
                max_tokens=max_tokens,
            )
        if provider == "groq" and settings.groq_api_key:
            return self._compose_groq(
                settings=settings,
                feature=feature,
                system=system,
                facts=facts,
                fallback_text=fallback_text,
                max_sentences=max_sentences,
                max_tokens=max_tokens,
            )
        if settings.gemini_api_key:
            return self._compose_gemini(
                settings=settings,
                feature=feature,
                system=system,
                facts=facts,
                fallback_text=fallback_text,
                max_sentences=max_sentences,
                max_tokens=max_tokens,
            )
        if settings.groq_api_key:
            return self._compose_groq(
                settings=settings,
                feature=feature,
                system=system,
                facts=facts,
                fallback_text=fallback_text,
                max_sentences=max_sentences,
                max_tokens=max_tokens,
            )
        return LLMResult(text=fallback_text, fallback_used=True, error_message="llm_not_configured")

    def _compose_groq(
        self,
        *,
        settings: Any,
        feature: str,
        system: str,
        facts: dict[str, Any],
        fallback_text: str,
        max_sentences: int,
        max_tokens: int | None,
    ) -> LLMResult:
        sanitized_facts = sanitize_payload(facts)
        prompt = (
            "Use only the facts below. Do not invent numbers, places, availability, traffic, SOC, range, or safety claims. "
            "If a fact is missing, say it is unavailable. Keep the answer concise.\n"
            f"Facts: {str(sanitized_facts)[:settings.ai_max_input_chars]}"
        )
        payload = {
            "model": settings.groq_model,
            "messages": [
                {"role": "system", "content": sanitize_text(system, max_chars=1200)},
                {"role": "user", "content": prompt},
            ],
            "temperature": 0.2,
            "max_tokens": max_tokens or settings.ai_max_output_tokens,
        }
        headers = {"Authorization": "Bearer " + str(settings.groq_api_key), "Content-Type": "application/json"}
        started = time.monotonic()
        try:
            last_exc: Exception | None = None
            for _ in range(max(1, settings.ai_max_retries + 1)):
                try:
                    with httpx.Client(timeout=settings.ai_request_timeout_seconds) as client:
                        response = client.post("https://api.groq.com/openai/v1/chat/completions", json=payload, headers=headers)
                    response.raise_for_status()
                    data = response.json()
                    text = data.get("choices", [{}])[0].get("message", {}).get("content") or fallback_text
                    usage = data.get("usage") if isinstance(data.get("usage"), dict) else None
                    return LLMResult(
                        text=clamp_sentences(text, max_sentences=max_sentences),
                        fallback_used=False,
                        model_name=settings.groq_model,
                        latency_ms=int((time.monotonic() - started) * 1000),
                        token_usage=usage,
                    )
                except Exception as exc:  # noqa: BLE001 - sanitized before logging/storing
                    last_exc = exc
            raise last_exc or RuntimeError("llm_error")
        except Exception as exc:  # noqa: BLE001
            logger.info("AI fallback for %s: %s", feature, safe_error(exc))
            return LLMResult(
                text=fallback_text,
                fallback_used=True,
                model_name=settings.groq_model,
                latency_ms=int((time.monotonic() - started) * 1000),
                error_message=safe_error(exc),
            )

    def _compose_gemini(
        self,
        *,
        settings: Any,
        feature: str,
        system: str,
        facts: dict[str, Any],
        fallback_text: str,
        max_sentences: int,
        max_tokens: int | None,
    ) -> LLMResult:
        sanitized_facts = sanitize_payload(facts)
        prompt = (
            "Use only the facts below. Do not invent numbers, places, availability, traffic, SOC, range, or safety claims. "
            "If a fact is missing, say it is unavailable. Keep the answer concise.\n"
            f"Facts: {str(sanitized_facts)[:settings.ai_max_input_chars]}"
        )
        payload = {
            "system_instruction": {"parts": [{"text": sanitize_text(system, max_chars=1200)}]},
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.2, "maxOutputTokens": max_tokens or settings.ai_max_output_tokens},
        }
        started = time.monotonic()
        try:
            last_exc: Exception | None = None
            for _ in range(max(1, settings.ai_max_retries + 1)):
                try:
                    with httpx.Client(timeout=settings.ai_request_timeout_seconds) as client:
                        response = client.post(
                            f"https://generativelanguage.googleapis.com/v1beta/models/{settings.gemini_model}:generateContent",
                            params={"key": settings.gemini_api_key},
                            json=payload,
                        )
                    response.raise_for_status()
                    data = response.json()
                    candidates = data.get("candidates") or []
                    parts = (((candidates[0] if candidates else {}).get("content") or {}).get("parts")) or []
                    text = " ".join(str(part.get("text", "")).strip() for part in parts if part.get("text")) or fallback_text
                    usage = data.get("usageMetadata") if isinstance(data.get("usageMetadata"), dict) else None
                    return LLMResult(
                        text=clamp_sentences(text, max_sentences=max_sentences),
                        fallback_used=False,
                        model_name=settings.gemini_model,
                        latency_ms=int((time.monotonic() - started) * 1000),
                        token_usage=usage,
                    )
                except Exception as exc:  # noqa: BLE001
                    last_exc = exc
            raise last_exc or RuntimeError("llm_error")
        except Exception as exc:  # noqa: BLE001
            logger.info("AI fallback for %s: %s", feature, safe_error(exc))
            return LLMResult(
                text=fallback_text,
                fallback_used=True,
                model_name=settings.gemini_model,
                latency_ms=int((time.monotonic() - started) * 1000),
                error_message=safe_error(exc),
            )

    def record(
        self,
        db: Session,
        *,
        user: User | None,
        feature: str,
        result: LLMResult,
        driver_id: str | None = None,
        vehicle_id: str | None = None,
        fleet_id: str | None = None,
        tool_calls: list[str] | None = None,
    ) -> None:
        db.add(
            AIInteractionLog(
                user_id=user.id if user else None,
                driver_id=driver_id,
                vehicle_id=vehicle_id,
                fleet_id=fleet_id,
                feature=feature,
                prompt_version=self.prompt_version,
                model_name=result.model_name,
                tool_calls=tool_calls or [],
                token_usage=result.token_usage,
                latency_ms=result.latency_ms,
                fallback_used=result.fallback_used,
                success=not bool(result.error_message),
                error_message=result.error_message,
            )
        )


llm_client = LLMClient()
