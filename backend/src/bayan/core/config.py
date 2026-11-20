"""Runtime configuration. Everything tunable is an environment variable with a safe default."""

from __future__ import annotations

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

from bayan.core.types import Emirate


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="BAYAN_", env_file=None, extra="ignore")

    env: str = "dev"  # dev | demo | prod
    demo_mode: bool = True  # synthetic data, persona picker, reset endpoint
    session_secret: str = Field(default="dev-only-not-a-secret", repr=False)
    session_ttl_minutes: int = 240
    default_emirate_policy: Emirate = Emirate.ABU_DHABI
    cors_origins: str = ""  # comma separated; empty means same-origin only
    log_json: bool = False
    # The explainer ships reviewed templates only; there is no runtime LLM path (ADR 0003 in docs/decisions).
    arabic_urdu_status: str = "draft_machine_translated_pending_native_clinical_review"


@lru_cache
def get_settings() -> Settings:
    return Settings()
