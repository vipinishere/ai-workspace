import uuid
from datetime import datetime
from typing import Optional, Dict, Any

from pydantic import BaseModel, ConfigDict, field_validator
import re


def _make_slug(name: str) -> str:
    """Convert a workspace name to a URL-safe slug."""
    slug = name.lower().strip()
    slug = re.sub(r"[^a-z0-9\s-]", "", slug)
    slug = re.sub(r"[\s]+", "-", slug)
    slug = re.sub(r"-+", "-", slug).strip("-")
    return slug


class WorkspaceCreate(BaseModel):
    """Request to create a new workspace."""
    name: str
    slug: Optional[str] = None  # auto-generated from name if not provided

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("name must not be empty")
        if len(v) > 255:
            raise ValueError("name must be 255 characters or fewer")
        return v

    @field_validator("slug")
    @classmethod
    def validate_slug(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        v = v.strip().lower()
        if not re.match(r"^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$", v):
            raise ValueError("slug must be lowercase alphanumeric with hyphens, 3–63 chars")
        return v


class WorkspaceUpdate(BaseModel):
    """Request to update workspace settings."""
    name: Optional[str] = None
    settings: Optional[Dict[str, Any]] = None


class WorkspaceResponse(BaseModel):
    """Full workspace response."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    slug: str
    owner_id: uuid.UUID
    plan: str
    max_members: int
    settings: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime


class TeamMemberResponse(BaseModel):
    """Team member response with basic user info."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    workspace_id: uuid.UUID
    user_id: uuid.UUID
    role: str
    invited_by: Optional[uuid.UUID] = None
    joined_at: Optional[datetime] = None
    created_at: datetime

    # Populated by join query
    user_email: Optional[str] = None
    user_name: Optional[str] = None
    user_avatar_url: Optional[str] = None


class InviteTeamMemberRequest(BaseModel):
    """Request to invite a user to a workspace."""
    email: str
    role: str = "member"

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        valid = {"owner", "admin", "member", "viewer"}
        if v not in valid:
            raise ValueError(f"role must be one of: {', '.join(sorted(valid))}")
        return v


class UpdateTeamMemberRequest(BaseModel):
    """Request to change a team member's role."""
    role: str

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        valid = {"admin", "member", "viewer"}
        if v not in valid:
            raise ValueError(f"role must be one of: {', '.join(sorted(valid))}")
        return v
