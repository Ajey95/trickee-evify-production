from __future__ import annotations

import re
from typing import Any


SENSITIVE_KEYS = {"password", "token", "access_token", "refresh_token", "secret", "api_key", "phone", "email"}
PROMPT_INJECTION_PATTERNS = (
    "ignore previous",
    "system prompt",
    "developer message",
    "reveal instructions",
    "jailbreak",
    "forget all",
)


def sanitize_text(value: str, *, max_chars: int = 1200) -> str:
    text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", " ", str(value or ""))
    text = re.sub(r"\s+", " ", text).strip()
    return text[:max_chars]


def sanitize_payload(value: Any, *, max_list: int = 20) -> Any:
    if isinstance(value, dict):
        return {
            str(key): sanitize_payload(child, max_list=max_list)
            for key, child in value.items()
            if str(key).lower() not in SENSITIVE_KEYS
        }
    if isinstance(value, list):
        return [sanitize_payload(item, max_list=max_list) for item in value[:max_list]]
    if isinstance(value, str):
        return sanitize_text(value)
    return value


def detect_prompt_injection(text: str) -> bool:
    lowered = sanitize_text(text, max_chars=2000).lower()
    return any(pattern in lowered for pattern in PROMPT_INJECTION_PATTERNS)


def clamp_sentences(text: str, *, max_sentences: int = 2, max_chars: int = 360) -> str:
    cleaned = sanitize_text(text, max_chars=max_chars)
    parts = re.split(r"(?<=[.!?])\s+", cleaned)
    if len(parts) <= max_sentences:
        return cleaned
    return " ".join(parts[:max_sentences]).strip()


def safe_error(exc: Exception) -> str:
    return sanitize_text(exc.__class__.__name__, max_chars=80)
