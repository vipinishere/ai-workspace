"""
Agents router — custom AI agents marketplace and configuration.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import select, or_, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.users import User
from app.models.agents import Agent
from app.schemas.agents import AgentCreate, AgentUpdate, AgentResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/agents", tags=["agents"])


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


@router.get("", response_model=List[AgentResponse])
async def list_agents(
    category: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> List[AgentResponse]:
    """List public and author-owned AI agents."""
    filters = [
        or_(
            Agent.is_public == True,  # noqa: E712
            Agent.author_id == current_user.id,
        )
    ]

    if category and category != "all":
        filters.append(Agent.category == category)

    result = await db.execute(
        select(Agent)
        .where(and_(*filters))
        .order_by(Agent.usage_count.desc(), Agent.created_at.desc())
    )
    agents = result.scalars().all()

    response_list = []
    for a in agents:
        response_list.append(
            AgentResponse(
                id=a.id,
                name=a.name,
                description=a.description,
                modelId=a.model_id,
                systemPrompt=a.system_prompt,
                category=a.category,
                isPublic=a.is_public,
                rating=a.rating,
                usageCount=a.usage_count,
                createdBy=a.author_id,
                iconEmoji=a.icon_url or "🤖",
                tags=["AI", a.category] if a.category else ["AI"],
                createdAt=a.created_at,
            )
        )
    return response_list


@router.post("", response_model=AgentResponse, status_code=status.HTTP_201_CREATED)
async def create_agent(
    payload: AgentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AgentResponse:
    """Create a new custom prompt-engineered AI agent."""
    agent_id = uuid.uuid4()

    agent = Agent(
        id=agent_id,
        name=payload.name,
        description=payload.description,
        author_id=current_user.id,
        model_id=payload.model_id,
        system_prompt=payload.system_prompt,
        category=payload.category,
        is_public=payload.is_public,
        is_featured=False,
        usage_count=0,
        rating=5.0,
        price_credits=0,
        icon_url=payload.icon_emoji or "🤖",
        created_at=_utcnow(),
        updated_at=_utcnow(),
    )
    db.add(agent)
    await db.commit()
    await db.refresh(agent)

    return AgentResponse(
        id=agent.id,
        name=agent.name,
        description=agent.description,
        modelId=agent.model_id,
        systemPrompt=agent.system_prompt,
        category=agent.category,
        isPublic=agent.is_public,
        rating=agent.rating,
        usageCount=agent.usage_count,
        createdBy=agent.author_id,
        iconEmoji=agent.icon_url or "🤖",
        tags=["AI", agent.category],
        createdAt=agent.created_at,
    )


@router.patch("/{agent_id}", response_model=AgentResponse)
async def update_agent(
    agent_id: uuid.UUID,
    payload: AgentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AgentResponse:
    """Update configurations of a custom AI agent."""
    agent = await db.get(Agent, agent_id)
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="AI Agent not found.",
        )

    if agent.author_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the author can update this AI agent.",
        )

    if payload.name is not None:
        agent.name = payload.name.strip()
    if payload.description is not None:
        agent.description = payload.description.strip()
    if payload.model_id is not None:
        agent.model_id = payload.model_id
    if payload.system_prompt is not None:
        agent.system_prompt = payload.system_prompt
    if payload.category is not None:
        agent.category = payload.category
    if payload.is_public is not None:
        agent.is_public = payload.is_public
    if payload.icon_emoji is not None:
        agent.icon_url = payload.icon_emoji

    agent.updated_at = _utcnow()
    db.add(agent)
    await db.commit()
    await db.refresh(agent)

    return AgentResponse(
        id=agent.id,
        name=agent.name,
        description=agent.description,
        modelId=agent.model_id,
        systemPrompt=agent.system_prompt,
        category=agent.category,
        isPublic=agent.is_public,
        rating=agent.rating,
        usageCount=agent.usage_count,
        createdBy=agent.author_id,
        iconEmoji=agent.icon_url or "🤖",
        tags=["AI", agent.category],
        createdAt=agent.created_at,
    )


@router.delete("/{agent_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
async def delete_agent(
    agent_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    """Delete a custom AI agent."""
    agent = await db.get(Agent, agent_id)
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="AI Agent not found.",
        )

    if agent.author_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the author can delete this AI agent.",
        )

    await db.delete(agent)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
