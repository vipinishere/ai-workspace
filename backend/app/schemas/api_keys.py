import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, field_validator


VALID_PROVIDERS = {"openai", "anthropic", "google", "openrouter", "custom"}


class ApiKeyCreate(BaseModel):
    """Request to store a new BYOK API key."""
    name: str
    provider: str
    key: str  # raw key — will be encrypted server-side

    @field_validator("provider")
    @classmethod
    def validate_provider(cls, v: str) -> str:
        if v not in VALID_PROVIDERS:
            raise ValueError(f"provider must be one of: {', '.join(sorted(VALID_PROVIDERS))}")
        return v

    @field_validator("key")
    @classmethod
    def validate_key_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("key must not be empty")
        return v.strip()

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("name must not be empty")
        if len(v) > 255:
            raise ValueError("name must be 255 characters or fewer")
        return v


class ApiKeyUpdate(BaseModel):
    """Request to update an API key (name or active status)."""
    name: Optional[str] = None
    is_active: Optional[bool] = None


class ApiKeyResponse(BaseModel):
    """API key response — never exposes the raw key."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    provider: str
    key_preview: str  # e.g. "sk-a...xyz1"
    is_active: bool
    last_used_at: Optional[datetime] = None
    created_at: datetime


class ApiKeyTestResponse(BaseModel):
    """Result of testing an API key's validity."""
    valid: bool
    provider: str
    message: str
    latency_ms: Optional[int] = None
