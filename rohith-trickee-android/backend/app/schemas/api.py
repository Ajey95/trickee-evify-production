from typing import Any, Generic, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class ApiResponse(BaseModel, Generic[T]):
    success: bool = True
    data: T | None = None
    message: str = "OK"
    error: str | None = None


def ok(data: Any = None, message: str = "OK") -> dict[str, Any]:
    return {"success": True, "data": data, "message": message, "error": None}


def error_response(message: str, *, request_id: str | None = None) -> dict[str, Any]:
    data: dict[str, Any] = {"success": False, "data": None, "message": "Error", "error": message}
    if request_id:
        data["request_id"] = request_id
    return data
