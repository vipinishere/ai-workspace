"""
Teams router — manage team members, invites, and roles.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select, and_, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.users import User
from app.models.workspaces import Workspace
from app.models.teams import TeamMember
from app.schemas.workspaces import (
    TeamMemberResponse,
    InviteTeamMemberRequest,
    UpdateTeamMemberRequest,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/team", tags=["teams"])


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


async def _get_active_workspace_or_raise(
    db: AsyncSession,
    user: User,
) -> Workspace:
    if not user.workspace_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active workspace set. Please load workspace first.",
        )
    workspace = await db.get(Workspace, user.workspace_id)
    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found.",
        )
    return workspace


@router.get("/members", response_model=List[TeamMemberResponse])
async def list_team_members(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> List[TeamMemberResponse]:
    """List members in the user's active workspace."""
    workspace = await _get_active_workspace_or_raise(db, current_user)

    result = await db.execute(
        select(TeamMember, User.email, User.name, User.avatar_url)
        .join(User, User.id == TeamMember.user_id)
        .where(TeamMember.workspace_id == workspace.id)
    )

    members_list = []
    for row in result.all():
        member, email, name, avatar = row
        members_list.append(
            TeamMemberResponse(
                id=member.id,
                workspace_id=member.workspace_id,
                user_id=member.user_id,
                role=member.role,
                invited_by=member.invited_by,
                joined_at=member.joined_at,
                created_at=member.created_at,
                user_email=email,
                user_name=name,
                user_avatar_url=avatar,
            )
        )

    return members_list


@router.post("/invites", response_model=TeamMemberResponse)
async def invite_team_member(
    payload: InviteTeamMemberRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TeamMemberResponse:
    """Add a new member to the active workspace by email."""
    workspace = await _get_active_workspace_or_raise(db, current_user)

    # Permission check: owner or admin only
    tm_res = await db.execute(
        select(TeamMember).where(
            TeamMember.workspace_id == workspace.id,
            TeamMember.user_id == current_user.id,
        )
    )
    current_member = tm_res.scalar_one_or_none()
    if not current_member or current_member.role not in ("owner", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only workspace owners or administrators can invite members.",
        )

    # Load or provision target user
    target_user_res = await db.execute(
        select(User).where(User.email == payload.email.strip().lower())
    )
    target_user = target_user_res.scalar_one_or_none()

    if not target_user:
        target_user = User(
            id=uuid.uuid4(),
            clerk_id=f"user_invited_{payload.email.split('@')[0]}",
            email=payload.email.strip().lower(),
            name=payload.email.split("@")[0].capitalize(),
            plan="free",
            is_admin=False,
            created_at=_utcnow(),
            updated_at=_utcnow(),
        )
        db.add(target_user)
        await db.flush()

    # Membership check
    existing_mem_res = await db.execute(
        select(TeamMember).where(
            TeamMember.workspace_id == workspace.id,
            TeamMember.user_id == target_user.id,
        )
    )
    if existing_mem_res.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User is already a member of this workspace.",
        )

    # Limit check based on plan
    from app.services.billing import PLAN_MAX_MEMBERS
    member_count = await db.scalar(
        select(func.count(TeamMember.id)).where(TeamMember.workspace_id == workspace.id)
    )
    max_allowed = PLAN_MAX_MEMBERS.get(workspace.plan, 1)
    if member_count and member_count >= max_allowed:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=f"Member limit reached ({max_allowed}) for plan '{workspace.plan}'. Upgrade plan.",
        )

    new_member = TeamMember(
        id=uuid.uuid4(),
        workspace_id=workspace.id,
        user_id=target_user.id,
        role=payload.role,
        invited_by=current_user.id,
        joined_at=_utcnow(),
        created_at=_utcnow(),
    )
    db.add(new_member)
    await db.flush()

    return TeamMemberResponse(
        id=new_member.id,
        workspace_id=new_member.workspace_id,
        user_id=new_member.user_id,
        role=new_member.role,
        invited_by=new_member.invited_by,
        joined_at=new_member.joined_at,
        created_at=new_member.created_at,
        user_email=target_user.email,
        user_name=target_user.name,
        user_avatar_url=target_user.avatar_url,
    )


@router.patch("/members/{user_id}/role", response_model=TeamMemberResponse)
async def update_member_role(
    user_id: uuid.UUID,
    payload: UpdateTeamMemberRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TeamMemberResponse:
    """Modify a member's role."""
    workspace = await _get_active_workspace_or_raise(db, current_user)

    # Permission check: owner or admin only
    tm_res = await db.execute(
        select(TeamMember).where(
            TeamMember.workspace_id == workspace.id,
            TeamMember.user_id == current_user.id,
        )
    )
    current_member = tm_res.scalar_one_or_none()
    if not current_member or current_member.role not in ("owner", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only workspace owners or administrators can change roles.",
        )

    # Target member fetch
    target_res = await db.execute(
        select(TeamMember).where(
            TeamMember.workspace_id == workspace.id,
            TeamMember.user_id == user_id,
        )
    )
    target_member = target_res.scalar_one_or_none()
    if not target_member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team member not found.",
        )

    # Prevent owner role changes
    if target_member.role == "owner" or target_member.user_id == workspace.owner_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot change roles for the workspace owner.",
        )

    target_member.role = payload.role
    db.add(target_member)
    await db.flush()

    user_info = await db.get(User, target_member.user_id)

    return TeamMemberResponse(
        id=target_member.id,
        workspace_id=target_member.workspace_id,
        user_id=target_member.user_id,
        role=target_member.role,
        invited_by=target_member.invited_by,
        joined_at=target_member.joined_at,
        created_at=target_member.created_at,
        user_email=user_info.email if user_info else "",
        user_name=user_info.name if user_info else "",
        user_avatar_url=user_info.avatar_url if user_info else None,
    )


@router.delete("/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
async def remove_team_member(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    """Delete a team member (or leave workspace)."""
    workspace = await _get_active_workspace_or_raise(db, current_user)

    is_self = user_id == current_user.id
    tm_res = await db.execute(
        select(TeamMember).where(
            TeamMember.workspace_id == workspace.id,
            TeamMember.user_id == current_user.id,
        )
    )
    current_member = tm_res.scalar_one_or_none()

    if not is_self:
        if not current_member or current_member.role not in ("owner", "admin"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only workspace owners or administrators can remove members.",
            )

    target_res = await db.execute(
        select(TeamMember).where(
            TeamMember.workspace_id == workspace.id,
            TeamMember.user_id == user_id,
        )
    )
    target_member = target_res.scalar_one_or_none()
    if not target_member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team member not found.",
        )

    if target_member.role == "owner" or target_member.user_id == workspace.owner_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot remove the workspace owner.",
        )

    await db.delete(target_member)

    if is_self:
        current_user.workspace_id = None
        db.add(current_user)

    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
