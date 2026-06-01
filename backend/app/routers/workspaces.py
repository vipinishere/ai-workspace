"""
Workspaces router — active workspace retrieval and settings updates.
"""

from __future__ import annotations

import logging
import uuid
import re
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.workspaces import Workspace
from app.models.users import User
from app.models.teams import TeamMember
from app.schemas.workspaces import WorkspaceResponse, WorkspaceUpdate

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/workspace", tags=["workspaces"])


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


async def _get_or_create_active_workspace(
    db: AsyncSession,
    user: User,
) -> Workspace:
    """Fetch user's active workspace, fallback to owned/member workspace, or create a default."""
    if user.workspace_id:
        workspace = await db.get(Workspace, user.workspace_id)
        if workspace:
            return workspace

    # Find any owned workspace
    result = await db.execute(
        select(Workspace).where(Workspace.owner_id == user.id).limit(1)
    )
    workspace = result.scalar_one_or_none()
    if workspace:
        user.workspace_id = workspace.id
        db.add(user)
        await db.flush()
        return workspace

    # Find any member workspace
    mem_result = await db.execute(
        select(Workspace)
        .join(TeamMember, TeamMember.workspace_id == Workspace.id)
        .where(TeamMember.user_id == user.id)
        .limit(1)
    )
    workspace = mem_result.scalar_one_or_none()
    if workspace:
        user.workspace_id = workspace.id
        db.add(user)
        await db.flush()
        return workspace

    # Create a default workspace
    workspace_id = uuid.uuid4()
    clean_name = re.sub(r"[^a-zA-Z0-9]", "", user.name.split("@")[0].lower())
    slug = f"workspace-{clean_name}"[:30] or f"workspace-{str(user.id)[:8]}"

    workspace = Workspace(
        id=workspace_id,
        name="My Workspace",
        slug=slug,
        owner_id=user.id,
        plan=user.plan or "free",
        max_members=5 if user.plan == "pro" else 25 if user.plan == "team" else 1,
        settings={
            "defaultModel": "openai/gpt-4o-mini",
            "defaultSystemPrompt": "You are a helpful AI assistant.",
            "description": "My personal AI workspace.",
            "notifications": {
                "emailOnLowBalance": True,
                "emailOnQuotaExceeded": True,
                "emailWeeklyReport": True,
                "emailNewFeatures": False,
                "emailBilling": True,
            }
        },
        created_at=_utcnow(),
        updated_at=_utcnow(),
    )
    db.add(workspace)
    await db.flush()

    member = TeamMember(
        id=uuid.uuid4(),
        workspace_id=workspace.id,
        user_id=user.id,
        role="owner",
        joined_at=_utcnow(),
        created_at=_utcnow(),
    )
    db.add(member)

    user.workspace_id = workspace.id
    db.add(user)
    await db.flush()

    return workspace


@router.get("", response_model=WorkspaceResponse)
async def get_workspace(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Workspace:
    """Fetch the current user's active workspace."""
    return await _get_or_create_active_workspace(db, current_user)


@router.patch("", response_model=WorkspaceResponse)
async def update_workspace(
    payload: WorkspaceUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Workspace:
    """Update active workspace configurations."""
    workspace = await _get_or_create_active_workspace(db, current_user)

    # Validate permission: Owner or Admin only
    if workspace.owner_id != current_user.id:
        tm_res = await db.execute(
            select(TeamMember).where(
                TeamMember.workspace_id == workspace.id,
                TeamMember.user_id == current_user.id,
            )
        )
        member = tm_res.scalar_one_or_none()
        if not member or member.role not in ("owner", "admin"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only workspace owners or administrators can edit settings.",
            )

    if payload.name is not None:
        workspace.name = payload.name.strip()
        from app.schemas.workspaces import _make_slug
        workspace.slug = _make_slug(workspace.name)

    if payload.settings is not None:
        existing = workspace.settings or {}
        existing.update(payload.settings)
        workspace.settings = existing

    workspace.updated_at = _utcnow()
    db.add(workspace)
    return workspace
