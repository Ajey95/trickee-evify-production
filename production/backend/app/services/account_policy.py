from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class AccountPolicy:
    role: str
    access_mode: str = "full"
    capabilities: tuple[str, ...] = ()
    default_name: str | None = None


FIXED_GOOGLE_ACCOUNT_POLICIES: dict[str, AccountPolicy] = {
    "ajaybhargavajaswanthreddy@trickee.co.in": AccountPolicy(
        role="trickee_admin",
        default_name="Ajay Bhargava Jaswanth Reddy",
    ),
    "jshah862@gmail.com": AccountPolicy(
        role="trickee_admin",
        access_mode="read_only",
        capabilities=("mock_sos",),
        default_name="J Shah",
    ),
}


def fixed_google_policy(email: str | None) -> AccountPolicy | None:
    return FIXED_GOOGLE_ACCOUNT_POLICIES.get((email or "").strip().lower())


def has_capability(user, capability: str) -> bool:
    return capability in (getattr(user, "capabilities", None) or [])
