"""Demo authentication: signed bearer tokens and a SIMULATED one-time-code flow.

THIS IS NOT PRODUCTION AUTHENTICATION. It exists so the prototype can demonstrate role-based
access on synthetic personas. What it does:

* Tokens are `base64url(claims).base64url(HMAC-SHA256(key, claims))`. The claims carry a
  `Principal`, an issue time, an expiry and a random token id. They are SIGNED, not encrypted:
  the holder can read them. Signature check uses `hmac.compare_digest` (constant time).
* The one-time-code flow simulates email and mobile verification. Nothing is delivered. In demo
  mode the code is returned in the response and flagged `simulated: true`; outside demo mode
  there is no delivery adapter, so `request_otp` refuses (`NotConfigured`).
* Codes are six digits from `secrets`, stored only as a keyed digest, expire, allow a limited
  number of attempts, and are single use. Verification compares digests in constant time.

What production would use instead: the UAE national identity provider (UAE PASS or Emirates ID)
for couple members and the facility's identity and access system for staff. Not simulated beyond
this module, not integrated, not claimed (spec section 2 rule 7). No token revocation list, no
per-IP rate limiting and no MFA here: see docs/decisions/0120 and 0131.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import re
import secrets
import threading
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from typing import Final, Literal

from pydantic import BaseModel, ConfigDict, ValidationError

from bayan.core.clock import Clock
from bayan.core.config import Settings
from bayan.core.errors import Forbidden, Invalid, Unauthenticated
from bayan.core.types import Principal, Role
from bayan.governance.errors import GovernanceConfigError, NotConfigured, TooManyAttempts
from bayan.governance.models import OtpChallenge, SessionToken

DEFAULT_DEV_SECRET: Final = "dev-only-not-a-secret"  # noqa: S105  (mirrors core.config default)
OTP_TTL: Final = timedelta(minutes=5)
OTP_MAX_ATTEMPTS: Final = 5
OTP_REQUEST_WINDOW: Final = timedelta(minutes=15)
OTP_REQUESTS_PER_WINDOW: Final = 5
MAX_TOKEN_LENGTH: Final = 4096

_EMAIL_RE: Final = re.compile(r"^[^@\s]{1,64}@[^@\s]{1,190}\.[^@\s]{2,24}$")
_MOBILE_RE: Final = re.compile(r"^\+?[0-9]{8,15}$")


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _unb64(text: str) -> bytes:
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


class _Claims(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    v: Literal[1]
    role: Role
    sub: str
    cid: str | None
    name: str
    iat: int
    exp: int
    jti: str


@dataclass(slots=True)
class _OtpState:
    challenge_id: str
    channel: Literal["email", "mobile"]
    target_key: str
    code_mac: str
    expires_at: datetime
    attempts_left: int = OTP_MAX_ATTEMPTS
    consumed: bool = False


@dataclass(slots=True)
class _AuthState:
    otp: dict[str, _OtpState] = field(default_factory=dict)
    identities: dict[tuple[str, str], Principal] = field(default_factory=dict)
    requests: dict[str, list[datetime]] = field(default_factory=dict)


def normalise_target(channel: Literal["email", "mobile"], target: str) -> str:
    raw = target.strip()
    if channel == "email":
        if not _EMAIL_RE.fullmatch(raw):
            raise Invalid("target is not a valid email address")
        return raw.lower()
    compact = re.sub(r"[\s\-()]", "", raw)
    if not _MOBILE_RE.fullmatch(compact):
        raise Invalid("target is not a valid mobile number")
    return compact.removeprefix("+")


def mask_target(channel: Literal["email", "mobile"], target_key: str) -> str:
    if channel == "email":
        local, _, domain = target_key.partition("@")
        return f"{local[:1]}***@{domain[:1]}***"
    return f"+{'*' * max(len(target_key) - 4, 0)}{target_key[-4:]}"


class AuthService:
    def __init__(self, clock: Clock, settings: Settings) -> None:
        if settings.env == "prod" and settings.session_secret == DEFAULT_DEV_SECRET:
            raise GovernanceConfigError(
                "Refusing to start with the development session secret in env=prod. "
                "Set BAYAN_SESSION_SECRET, or use the national identity provider."
            )
        if settings.session_ttl_minutes <= 0:
            raise GovernanceConfigError("session_ttl_minutes must be positive")
        self._clock = clock
        self._settings = settings
        root = settings.session_secret.encode("utf-8")
        self._token_key = hmac.new(root, b"bayan/token/v1", hashlib.sha256).digest()
        self._otp_key = hmac.new(root, b"bayan/otp/v1", hashlib.sha256).digest()
        self.pseudonym_key = hmac.new(root, b"bayan/audit-pseudonym/v1", hashlib.sha256).digest()
        self._state = _AuthState()
        self._lock = threading.Lock()

    # ----- tokens -----------------------------------------------------------------------------

    def issue(self, principal: Principal) -> SessionToken:
        now = self._clock.now()
        expires = now + timedelta(minutes=self._settings.session_ttl_minutes)
        claims = _Claims(
            v=1,
            role=principal.role,
            sub=principal.subject_id,
            cid=principal.couple_id,
            name=principal.display_name,
            iat=int(now.timestamp()),
            exp=int(expires.timestamp()),
            jti=secrets.token_hex(8),
        )
        body = _b64(claims.model_dump_json().encode("utf-8"))
        mac = _b64(hmac.new(self._token_key, body.encode("ascii"), hashlib.sha256).digest())
        return SessionToken(access_token=f"{body}.{mac}", expires_at=expires, principal=principal)

    def authenticate(self, token: str) -> Principal:
        """Verify signature and expiry. Every failure is the same 401 with a closed reason."""
        if not token or len(token) > MAX_TOKEN_LENGTH or token.count(".") != 1:
            raise Unauthenticated("invalid token", reason="malformed")
        body, mac = token.split(".")
        try:
            presented = _unb64(mac)
            payload = _unb64(body)
            claims = _Claims.model_validate(json.loads(payload))
        except (ValueError, ValidationError) as exc:
            raise Unauthenticated("invalid token", reason="malformed") from exc
        expected = hmac.new(
            self._token_key, body.encode("ascii", errors="replace"), hashlib.sha256
        ).digest()
        if not hmac.compare_digest(presented, expected):
            raise Unauthenticated("invalid token", reason="bad_signature")
        if claims.exp <= int(self._clock.now().timestamp()):
            raise Unauthenticated("token expired", reason="expired")
        return Principal(
            role=claims.role, subject_id=claims.sub, couple_id=claims.cid, display_name=claims.name
        )

    def require_demo_mode(self) -> None:
        if not self._settings.demo_mode:
            raise Forbidden("demo tokens are only issued in demo mode", reason="demo_mode_off")

    # ----- simulated one-time codes -------------------------------------------------------------

    def register_identity(
        self, channel: Literal["email", "mobile"], target: str, principal: Principal
    ) -> None:
        """Seed the demo identity directory (a persona's email or mobile maps to a Principal)."""
        with self._lock:
            self._state.identities[(channel, normalise_target(channel, target))] = principal

    def _mac(self, challenge_id: str, code: str) -> str:
        return hmac.new(
            self._otp_key, f"{challenge_id}:{code}".encode(), hashlib.sha256
        ).hexdigest()

    def request_otp(self, channel: Literal["email", "mobile"], target: str) -> OtpChallenge:
        if not self._settings.demo_mode:
            raise NotConfigured(
                "No code-delivery channel is configured. A production deployment signs people in with the "
                "national identity provider; this prototype only simulates the flow in demo mode.",
                reason="otp_delivery_not_configured",
            )
        key = normalise_target(channel, target)
        now = self._clock.now()
        with self._lock:
            window = [
                t
                for t in self._state.requests.get(f"{channel}:{key}", [])
                if now - t < OTP_REQUEST_WINDOW
            ]
            if len(window) >= OTP_REQUESTS_PER_WINDOW:
                raise TooManyAttempts(
                    "too many code requests for this target", reason="otp_request_rate"
                )
            window.append(now)
            self._state.requests[f"{channel}:{key}"] = window
            challenge_id = f"otp-{secrets.token_hex(8)}"
            code = f"{secrets.randbelow(10**6):06d}"
            expires = now + OTP_TTL
            self._state.otp[challenge_id] = _OtpState(
                challenge_id=challenge_id,
                channel=channel,
                target_key=key,
                code_mac=self._mac(challenge_id, code),
                expires_at=expires,
            )
        return OtpChallenge(
            challenge_id=challenge_id,
            channel=channel,
            target_masked=mask_target(channel, key),
            expires_at=expires,
            attempts_left=OTP_MAX_ATTEMPTS,
            demo_code=code,
        )

    def verify_otp(self, challenge_id: str, code: str) -> tuple[SessionToken, Principal]:
        now = self._clock.now()
        with self._lock:
            state = self._state.otp.get(challenge_id)
            if state is None or state.consumed:
                raise Unauthenticated("invalid or used code", reason="otp_invalid")
            if now >= state.expires_at:
                del self._state.otp[challenge_id]
                raise Unauthenticated("code expired", reason="otp_expired")
            if state.attempts_left <= 0:
                raise TooManyAttempts(
                    "too many wrong codes for this challenge", reason="otp_locked"
                )
            presented = self._mac(challenge_id, code.strip())
            if not hmac.compare_digest(presented, state.code_mac):
                state.attempts_left -= 1
                if state.attempts_left <= 0:
                    raise TooManyAttempts(
                        "too many wrong codes for this challenge", reason="otp_locked"
                    )
                raise Unauthenticated("invalid or used code", reason="otp_invalid")
            state.consumed = True
            principal = self._state.identities.get((state.channel, state.target_key))
        if principal is None:
            # Same response as a wrong code: the directory is not enumerable through this endpoint.
            raise Unauthenticated("invalid or used code", reason="otp_invalid")
        return self.issue(principal), principal


def utc(ts: datetime) -> datetime:
    return ts.astimezone(UTC)
