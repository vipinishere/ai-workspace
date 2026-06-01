"""
Chat router — streaming AI completions and conversation management.

Routes:
  POST /api/v1/chat/completions                        — SSE streaming chat
  POST /api/v1/chat/conversations                      — Create conversation
  GET  /api/v1/chat/conversations                      — List conversations
  GET  /api/v1/chat/conversations/{id}                 — Get conversation
  PUT  /api/v1/chat/conversations/{id}                 — Update conversation
  DELETE /api/v1/chat/conversations/{id}               — Delete conversation
  GET  /api/v1/chat/conversations/{id}/messages        — Get messages
  GET  /api/v1/chat/models                             — List available models
"""

from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sse_starlette.sse import EventSourceResponse

from app.database import get_db
from app.middleware.auth import get_current_user
from app.middleware.rate_limit import rate_limit_chat
from app.models.api_keys import ApiKey
from app.models.conversations import Conversation
from app.models.messages import Message
from app.models.users import User
from app.schemas.conversations import (
    ChatRequest,
    ConversationCreate,
    ConversationListResponse,
    ConversationResponse,
    ConversationUpdate,
    MessageResponse,
)
from app.services.ai_router import ChatMessage, ai_router, MODEL_REGISTRY
from app.services.encryption import encryption_service
from app.services.usage import check_quota, log_usage

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/chat", tags=["chat"])


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


async def _get_byok_key(
    db: AsyncSession,
    user_id: uuid.UUID,
    provider: str,
) -> Optional[str]:
    result = await db.execute(
        select(ApiKey).where(
            ApiKey.user_id == user_id,
            ApiKey.provider == provider,
            ApiKey.is_active == True,  # noqa: E712
        )
    )
    api_key_row = result.scalars().first()
    if api_key_row is None:
        return None
    try:
        enc_svc = encryption_service()
        return enc_svc.decrypt(api_key_row.encrypted_key)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Failed to decrypt BYOK key for user %s: %s", user_id, exc)
        return None


@router.post("/completions")
@router.post("/stream")
async def chat_completion(
    request: ChatRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _: None = Depends(rate_limit_chat),
) -> EventSourceResponse:
    """Stream an AI chat completion via SSE."""
    has_quota = await check_quota(db, user_id=current_user.id)
    if not has_quota:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="Monthly token quota exceeded. Please upgrade your plan.",
        )

    model_id = request.model_id
    model_info = ai_router.get_model_info(model_id)
    provider = model_info["provider"]

    byok_key = await _get_byok_key(db, current_user.id, provider)

    conversation: Optional[Conversation] = None
    if request.conversation_id:
        result = await db.execute(
            select(Conversation).where(
                Conversation.id == request.conversation_id,
                Conversation.user_id == current_user.id,
            )
        )
        conversation = result.scalar_one_or_none()
        if conversation is None:
            raise HTTPException(status_code=404, detail="Conversation not found")

    chat_messages: list[ChatMessage] = []
    new_user_content = ""

    if request.messages:
        chat_messages = [ChatMessage(role=m.role, content=m.content) for m in request.messages]
        last_user_msg = next(
            (m for m in reversed(request.messages) if m.role == "user"), None
        )
        if last_user_msg:
            new_user_content = last_user_msg.content
    elif request.message:
        if conversation:
            history_result = await db.execute(
                select(Message)
                .where(Message.conversation_id == conversation.id)
                .order_by(Message.created_at.asc())
            )
            for db_msg in history_result.scalars().all():
                chat_messages.append(ChatMessage(role=db_msg.role, content=db_msg.content))
        chat_messages.append(ChatMessage(role="user", content=request.message))
        new_user_content = request.message
    else:
        raise HTTPException(status_code=400, detail="Either 'message' or 'messages' must be provided")

    if conversation is None:
        title = new_user_content[:60].strip() or "New Conversation"
        if len(new_user_content) > 60:
            title += "..."
        conversation = Conversation(
            id=uuid.uuid4(),
            user_id=current_user.id,
            workspace_id=request.workspace_id,
            title=title,
            model_id=model_id,
            provider=provider,
            system_prompt=request.system_prompt,
            is_archived=False,
            total_tokens=0,
            created_at=_utcnow(),
            updated_at=_utcnow(),
        )
        db.add(conversation)
        await db.flush()
        await db.refresh(conversation)

    if new_user_content:
        already_saved = False
        if conversation:
            last_msg_res = await db.execute(
                select(Message)
                .where(Message.conversation_id == conversation.id)
                .order_by(Message.created_at.desc())
                .limit(1)
            )
            last_msg = last_msg_res.scalar_one_or_none()
            if last_msg and last_msg.role == "user" and last_msg.content == new_user_content:
                already_saved = True

        if not already_saved:
            user_msg = Message(
                id=uuid.uuid4(),
                conversation_id=conversation.id,
                role="user",
                content=new_user_content,
                created_at=_utcnow(),
            )
            db.add(user_msg)
            await db.flush()

    conversation_id = conversation.id
    user_id = current_user.id
    workspace_id = request.workspace_id

    async def event_generator():
        full_content = ""
        final_chunk = None

        try:
            async for chunk in ai_router.stream(
                model_id=model_id,
                messages=chat_messages,
                api_key=byok_key,
                max_tokens=request.max_tokens,
                temperature=request.temperature,
                system_prompt=request.system_prompt,
            ):
                if chunk.error:
                    yield {
                        "event": "error",
                        "data": json.dumps({"error": chunk.error}),
                    }
                    from app.database import AsyncSessionLocal
                    async with AsyncSessionLocal() as err_db:
                        try:
                            await log_usage(
                                err_db,
                                user_id=user_id,
                                workspace_id=workspace_id,
                                conversation_id=conversation_id,
                                message_id=None,
                                provider=provider,
                                model_id=model_id,
                                prompt_tokens=0,
                                completion_tokens=0,
                                cost_usd=0.0,
                                latency_ms=chunk.latency_ms,
                                status="error",
                                error_message=chunk.error,
                            )
                            await err_db.commit()
                        except Exception:  # noqa: BLE001
                            pass
                    return

                if not chunk.done:
                    full_content += chunk.content
                    yield {
                        "event": "chunk",
                        "data": json.dumps({"content": chunk.content, "done": False}),
                    }
                else:
                    final_chunk = chunk

        except Exception as exc:  # noqa: BLE001
            yield {"event": "error", "data": json.dumps({"error": str(exc)})}
            return

        if final_chunk is not None:
            from app.database import AsyncSessionLocal
            async with AsyncSessionLocal() as write_db:
                try:
                    assistant_msg = Message(
                        id=uuid.uuid4(),
                        conversation_id=conversation_id,
                        role="assistant",
                        content=full_content,
                        model_id=model_id,
                        prompt_tokens=final_chunk.prompt_tokens,
                        completion_tokens=final_chunk.completion_tokens,
                        total_tokens=final_chunk.total_tokens,
                        cost_usd=final_chunk.cost_usd,
                        duration_ms=final_chunk.latency_ms,
                        created_at=_utcnow(),
                    )
                    write_db.add(assistant_msg)

                    conv = await write_db.get(Conversation, conversation_id)
                    if conv:
                        conv.total_tokens = (conv.total_tokens or 0) + final_chunk.total_tokens
                        conv.updated_at = _utcnow()

                    await log_usage(
                        write_db,
                        user_id=user_id,
                        workspace_id=workspace_id,
                        conversation_id=conversation_id,
                        message_id=assistant_msg.id,
                        provider=provider,
                        model_id=model_id,
                        prompt_tokens=final_chunk.prompt_tokens,
                        completion_tokens=final_chunk.completion_tokens,
                        cost_usd=final_chunk.cost_usd,
                        latency_ms=final_chunk.latency_ms,
                        status="success",
                    )
                    await write_db.commit()
                except Exception as exc:  # noqa: BLE001
                    logger.error("Failed to persist chat result: %s", exc)

            yield {
                "event": "done",
                "data": json.dumps({
                    "content": full_content,
                    "done": True,
                    "tokens": final_chunk.total_tokens,
                    "cost_usd": final_chunk.cost_usd,
                    "model_id": model_id,
                    "conversation_id": str(conversation_id),
                }),
            }

    return EventSourceResponse(event_generator())


def _generate_title(messages) -> str:
    for m in messages:
        if m.role == "user":
            content = m.content[:60].strip()
            return content if len(m.content) <= 60 else content + "..."
    return "New Conversation"


@router.post("/conversations", response_model=ConversationResponse, status_code=status.HTTP_201_CREATED)
async def create_conversation(
    data: ConversationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Conversation:
    model_info = ai_router.get_model_info(data.model_id)
    conversation = Conversation(
        id=uuid.uuid4(),
        user_id=current_user.id,
        workspace_id=data.workspace_id,
        title=data.title,
        model_id=data.model_id,
        provider=model_info["provider"],
        system_prompt=data.system_prompt,
        is_archived=False,
        total_tokens=0,
        created_at=_utcnow(),
        updated_at=_utcnow(),
    )
    db.add(conversation)
    await db.flush()
    await db.refresh(conversation)
    return conversation


@router.get("/conversations", response_model=ConversationListResponse)
async def list_conversations(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    archived: bool = Query(False),
    workspace_id: Optional[uuid.UUID] = Query(None),
) -> ConversationListResponse:
    filters = [
        Conversation.user_id == current_user.id,
        Conversation.is_archived == archived,
    ]
    if workspace_id is not None:
        filters.append(Conversation.workspace_id == workspace_id)

    total = await db.scalar(select(func.count(Conversation.id)).where(*filters))
    result = await db.execute(
        select(Conversation)
        .where(*filters)
        .order_by(Conversation.updated_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    conversations = result.scalars().all()
    return ConversationListResponse(
        items=[ConversationResponse.model_validate(c) for c in conversations],
        total=int(total or 0),
        page=page,
        page_size=page_size,
    )


@router.get("/conversations/{conversation_id}", response_model=ConversationResponse)
async def get_conversation(
    conversation_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Conversation:
    result = await db.execute(
        select(Conversation).where(
            Conversation.id == conversation_id,
            Conversation.user_id == current_user.id,
        )
    )
    conversation = result.scalar_one_or_none()
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conversation


@router.put("/conversations/{conversation_id}", response_model=ConversationResponse)
async def update_conversation(
    conversation_id: uuid.UUID,
    update_data: ConversationUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Conversation:
    result = await db.execute(
        select(Conversation).where(
            Conversation.id == conversation_id,
            Conversation.user_id == current_user.id,
        )
    )
    conversation = result.scalar_one_or_none()
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    if update_data.title is not None:
        conversation.title = update_data.title
    if update_data.system_prompt is not None:
        conversation.system_prompt = update_data.system_prompt
    if update_data.is_archived is not None:
        conversation.is_archived = update_data.is_archived
    conversation.updated_at = _utcnow()
    await db.flush()
    await db.refresh(conversation)
    return conversation


@router.delete("/conversations/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
async def delete_conversation(
    conversation_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    result = await db.execute(
        select(Conversation).where(
            Conversation.id == conversation_id,
            Conversation.user_id == current_user.id,
        )
    )
    conversation = result.scalar_one_or_none()
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    await db.delete(conversation)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/conversations/{conversation_id}/messages", response_model=list[MessageResponse])
async def get_messages(
    conversation_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> list[Message]:
    conv_result = await db.execute(
        select(Conversation).where(
            Conversation.id == conversation_id,
            Conversation.user_id == current_user.id,
        )
    )
    if conv_result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.asc())
        .offset(offset)
        .limit(limit)
    )
    return list(result.scalars().all())


@router.get("/models")
async def list_models() -> dict:
    """Return all available AI models with pricing and context windows."""
    models = [
        {
            "id": model_id,
            "provider": info["provider"],
            "model": info["model"],
            "price_prompt_per_token": info["price_prompt"],
            "price_completion_per_token": info["price_completion"],
            "context_window": info.get("context_window", 128_000),
        }
        for model_id, info in MODEL_REGISTRY.items()
    ]
    return {"models": models, "total": len(models)}
