from __future__ import annotations

import hashlib
import time
from collections import defaultdict, deque
from collections.abc import Awaitable, Callable

from fastapi import Depends, HTTPException, Request, status

from app.config import get_settings
from app.models import User
from app.services.auth import get_current_user


_memory_windows: dict[str, deque[float]] = defaultdict(deque)


def _client_ip(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for", "")
    if forwarded_for:
        return forwarded_for.split(",", 1)[0].strip()
    return request.client.host if request.client else "unknown"


def _hash_key(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


async def _redis_increment(key: str, window_seconds: int, redis_url: str) -> int | None:
    try:
        from redis.asyncio import Redis
    except Exception:
        return None

    client = Redis.from_url(redis_url, decode_responses=True)
    try:
        pipe = client.pipeline()
        pipe.incr(key)
        pipe.expire(key, window_seconds)
        count, _ = await pipe.execute()
        return int(count)
    except Exception:
        return None
    finally:
        await client.aclose()


async def check_rate_limit(
    *,
    request: Request,
    namespace: str,
    limit: int,
    window_seconds: int = 60,
    subject: str | None = None,
) -> None:
    if limit <= 0:
        return

    settings = get_settings()
    identity = subject or _client_ip(request)
    key = f"rate:{namespace}:{_hash_key(identity)}"

    if settings.redis_url:
        count = await _redis_increment(key, window_seconds, settings.redis_url)
        if count is not None:
            if count > limit:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Too many requests. Try again shortly.",
                )
            return

    now = time.monotonic()
    window_start = now - window_seconds
    bucket = _memory_windows[key]
    while bucket and bucket[0] < window_start:
        bucket.popleft()
    if len(bucket) >= limit:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many requests. Try again shortly.",
        )
    bucket.append(now)


def ip_rate_limit(namespace: str, limit_getter: Callable[[], int]) -> Callable[[Request], Awaitable[None]]:
    async def dependency(request: Request) -> None:
        await check_rate_limit(request=request, namespace=namespace, limit=limit_getter())

    return dependency


async def user_rate_limit(
    request: Request,
    current_user: User,
    *,
    namespace: str,
    limit: int,
) -> None:
    await check_rate_limit(
        request=request,
        namespace=namespace,
        limit=limit,
        subject=f"user:{current_user.id}",
    )


async def rate_limited_user(request: Request, current_user: User = Depends(get_current_user)) -> User:
    settings = get_settings()
    await user_rate_limit(
        request,
        current_user,
        namespace="authenticated",
        limit=settings.global_rate_limit_per_minute,
    )
    return current_user
