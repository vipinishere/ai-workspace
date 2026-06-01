import uuid
from datetime import datetime
from typing import Optional, List

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ConversationCreate(BaseModel):
    """Schema to create a new conversation."""
    model_config = ConfigDict(populate_by_name=True)

    model_id: str = Field(..., alias="modelId")
    title: str = "New Conversation"
    system_prompt: Optional[str] = Field(None, alias="systemPrompt")
    workspace_id: Optional[uuid.UUID] = Field(None, alias="workspaceId")


class ConversationUpdate(BaseModel):
    """Schema to update conversation metadata."""
    title: Optional[str] = None
    system_prompt: Optional[str] = None
    is_archived: Optional[bool] = None


class ConversationResponse(BaseModel):
    """Full conversation response."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    workspace_id: Optional[uuid.UUID] = None
    title: str
    model_id: str
    provider: str
    system_prompt: Optional[str] = None
    is_archived: bool
    total_tokens: int
    created_at: datetime
    updated_at: datetime


class MessageCreate(BaseModel):
    """Schema for a single message in a chat request."""
    role: str  # user, assistant, system
    content: str

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        if v not in ("user", "assistant", "system"):
            raise ValueError("role must be one of: user, assistant, system")
        return v


class MessageResponse(BaseModel):
    """Message response with token and cost info."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    conversation_id: uuid.UUID
    role: str
    content: str
    model_id: Optional[str] = None
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    cost_usd: float
    duration_ms: Optional[int] = None
    created_at: datetime


class ChatRequest(BaseModel):
    """Request body for a streaming chat completion."""
    model_config = ConfigDict(populate_by_name=True)

    conversation_id: Optional[uuid.UUID] = Field(None, alias="conversationId")
    model_id: str = Field(..., alias="modelId")
    messages: Optional[List[MessageCreate]] = None
    message: Optional[str] = None
    system_prompt: Optional[str] = Field(None, alias="systemPrompt")
    stream: bool = True
    max_tokens: int = Field(4096, alias="maxTokens")
    temperature: float = 0.7
    workspace_id: Optional[uuid.UUID] = Field(None, alias="workspaceId")

    @field_validator("temperature")
    @classmethod
    def validate_temperature(cls, v: float) -> float:
        if not 0.0 <= v <= 2.0:
            raise ValueError("temperature must be between 0.0 and 2.0")
        return v

    @field_validator("max_tokens")
    @classmethod
    def validate_max_tokens(cls, v: int) -> int:
        if not 1 <= v <= 128000:
            raise ValueError("max_tokens must be between 1 and 128000")
        return v


class StreamChunk(BaseModel):
    """Server-Sent Event payload for streaming responses."""
    content: str = ""
    done: bool = False
    tokens: int = 0
    cost_usd: float = 0.0
    model_id: str = ""
    error: Optional[str] = None


class ConversationListResponse(BaseModel):
    """Paginated list of conversations."""
    items: List[ConversationResponse]
    total: int
    page: int
    page_size: int
