"""
Pydantic schemas for AI Agents.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict, Field


class AgentCreate(BaseModel):
    """Schema to create a new AI agent."""
    name: str
    description: str
    model_id: str = Field(..., alias="modelId")
    system_prompt: str = Field(..., alias="systemPrompt")
    category: str = "general"
    is_public: bool = Field(False, alias="isPublic")
    icon_emoji: Optional[str] = Field("🤖", alias="iconEmoji")
    tags: Optional[List[str]] = None

    model_config = ConfigDict(populate_by_name=True)


class AgentUpdate(BaseModel):
    """Schema to update an existing AI agent."""
    name: Optional[str] = None
    description: Optional[str] = None
    model_id: Optional[str] = Field(None, alias="modelId")
    system_prompt: Optional[str] = Field(None, alias="systemPrompt")
    category: Optional[str] = None
    is_public: Optional[bool] = Field(None, alias="isPublic")
    icon_emoji: Optional[str] = Field(None, alias="iconEmoji")
    tags: Optional[List[str]] = None

    model_config = ConfigDict(populate_by_name=True)


class AgentResponse(BaseModel):
    """Full AI agent response."""
    id: uuid.UUID
    name: str
    description: str
    model_id: str = Field(..., alias="modelId")
    system_prompt: str = Field(..., alias="systemPrompt")
    category: str
    is_public: bool = Field(..., alias="isPublic")
    rating: float
    usage_count: int = Field(..., alias="usageCount")
    created_by: uuid.UUID = Field(..., alias="createdBy")
    icon_emoji: Optional[str] = Field("🤖", alias="iconEmoji")
    tags: List[str] = []
    created_at: datetime = Field(..., alias="createdAt")

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)
