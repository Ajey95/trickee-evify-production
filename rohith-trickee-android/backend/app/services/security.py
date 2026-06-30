from __future__ import annotations

import logging
import time
import uuid

from fastapi import HTTPException, Request, status
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse, Response

from app.config import get_settings
from app.schemas.api import error_response
from app.services.rate_limit import check_rate_limit


logger = logging.getLogger(__name__)


class SecurityMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        settings = get_settings()
        request_id = request.headers.get("x-request-id") or str(uuid.uuid4())
        request.state.request_id = request_id
        started_at = time.perf_counter()

        content_length = request.headers.get("content-length")
        try:
            request_size = int(content_length) if content_length else 0
        except ValueError:
            request_size = settings.max_request_body_bytes + 1
        if request_size > settings.max_request_body_bytes:
            response = JSONResponse(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                content=error_response("Request payload is too large"),
            )
            self._set_headers(response, request_id, started_at)
            return response

        if request.url.path.startswith(settings.api_prefix):
            try:
                await check_rate_limit(
                    request=request,
                    namespace="global-api",
                    limit=settings.global_rate_limit_per_minute,
                )
            except HTTPException as exc:
                response = JSONResponse(status_code=exc.status_code, content=error_response(str(exc.detail)))
                self._set_headers(response, request_id, started_at)
                return response

        response = await call_next(request)
        self._set_headers(response, request_id, started_at)
        return response

    def _set_headers(self, response: Response, request_id: str, started_at: float) -> None:
        elapsed_ms = (time.perf_counter() - started_at) * 1000
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-Response-Time-Ms"] = f"{elapsed_ms:.2f}"
        if get_settings().environment.lower() in {"production", "prod"}:
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    request_id = getattr(request.state, "request_id", str(uuid.uuid4()))
    logger.exception("Unhandled request error request_id=%s path=%s", request_id, request.url.path)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=error_response("Internal server error", request_id=request_id),
        headers={"X-Request-ID": request_id},
    )


async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    request_id = getattr(request.state, "request_id", str(uuid.uuid4()))
    content = error_response(str(exc.detail), request_id=request_id)
    return JSONResponse(status_code=exc.status_code, content=content, headers={**(exc.headers or {}), "X-Request-ID": request_id})
