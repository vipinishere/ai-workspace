"""
AI Provider Router — Abstraction layer for multiple AI providers.

Supports:
  - OpenAI  (GPT-4o, GPT-4o-mini, GPT-4-turbo, o1)
  - Anthropic (Claude 3.5 Sonnet/Haiku, Claude 3 Opus)
  - Google   (Gemini 2.0 Flash, Gemini 1.5 Pro)
  - OpenRouter (Grok, DeepSeek, Llama, and any model on OR)

Features:
  - Streaming SSE via AsyncGenerator
  - Per-provider retry logic with exponential back-off
  - Token counting and cost calculation
  - BYOK (bring-your-own-key) support
  - Fallback to OpenRouter for unknown model IDs
"""

from __future__ import annotations

import asyncio
import json
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import AsyncGenerator, List, Optional

import httpx

from app.config import get_settings


class AIProvider(str, Enum):
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    GOOGLE = "google"
    OPENROUTER = "openrouter"


@dataclass
class ChatMessage:
    role: str  # user | assistant | system
    content: str


@dataclass
class StreamChunk:
    content: str
    done: bool
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    cost_usd: float = 0.0
    model_id: str = ""
    error: Optional[str] = None
    latency_ms: int = 0


# ---------------------------------------------------------------------------
# Model registry: model_id -> {provider, model, price_prompt, price_completion}
# Prices are per-token in USD.
# ---------------------------------------------------------------------------
MODEL_REGISTRY: dict[str, dict] = {
    # ── OpenAI ──────────────────────────────────────────────────────────────
    "openai/gpt-4o": {
        "provider": "openai",
        "model": "gpt-4o",
        "price_prompt": 0.0000025,
        "price_completion": 0.000010,
        "context_window": 128_000,
    },
    "openai/gpt-4o-mini": {
        "provider": "openai",
        "model": "gpt-4o-mini",
        "price_prompt": 0.00000015,
        "price_completion": 0.0000006,
        "context_window": 128_000,
    },
    "openai/gpt-4-turbo": {
        "provider": "openai",
        "model": "gpt-4-turbo",
        "price_prompt": 0.000010,
        "price_completion": 0.000030,
        "context_window": 128_000,
    },
    "openai/o1": {
        "provider": "openai",
        "model": "o1",
        "price_prompt": 0.000015,
        "price_completion": 0.000060,
        "context_window": 128_000,
    },
    "openai/o1-mini": {
        "provider": "openai",
        "model": "o1-mini",
        "price_prompt": 0.000003,
        "price_completion": 0.000012,
        "context_window": 128_000,
    },
    # ── Anthropic ────────────────────────────────────────────────────────────
    "anthropic/claude-3-5-sonnet": {
        "provider": "anthropic",
        "model": "claude-3-5-sonnet-20241022",
        "price_prompt": 0.000003,
        "price_completion": 0.000015,
        "context_window": 200_000,
    },
    "anthropic/claude-3-5-haiku": {
        "provider": "anthropic",
        "model": "claude-3-5-haiku-20241022",
        "price_prompt": 0.0000008,
        "price_completion": 0.000004,
        "context_window": 200_000,
    },
    "anthropic/claude-3-opus": {
        "provider": "anthropic",
        "model": "claude-3-opus-20240229",
        "price_prompt": 0.000015,
        "price_completion": 0.000075,
        "context_window": 200_000,
    },
    "anthropic/claude-3-haiku": {
        "provider": "anthropic",
        "model": "claude-3-haiku-20240307",
        "price_prompt": 0.00000025,
        "price_completion": 0.00000125,
        "context_window": 200_000,
    },
    # ── Google ───────────────────────────────────────────────────────────────
    "google/gemini-2.0-flash": {
        "provider": "google",
        "model": "gemini-2.0-flash",
        "price_prompt": 0.0000001,
        "price_completion": 0.0000004,
        "context_window": 1_000_000,
    },
    "google/gemini-1.5-pro": {
        "provider": "google",
        "model": "gemini-1.5-pro",
        "price_prompt": 0.00000125,
        "price_completion": 0.000005,
        "context_window": 2_000_000,
    },
    "google/gemini-1.5-flash": {
        "provider": "google",
        "model": "gemini-1.5-flash",
        "price_prompt": 0.000000075,
        "price_completion": 0.0000003,
        "context_window": 1_000_000,
    },
    # ── OpenRouter ───────────────────────────────────────────────────────────
    "openrouter/x-ai/grok-2": {
        "provider": "openrouter",
        "model": "x-ai/grok-2",
        "price_prompt": 0.000002,
        "price_completion": 0.000010,
        "context_window": 131_072,
    },
    "openrouter/deepseek/deepseek-r1": {
        "provider": "openrouter",
        "model": "deepseek/deepseek-r1",
        "price_prompt": 0.0000008,
        "price_completion": 0.0000024,
        "context_window": 64_000,
    },
    "openrouter/deepseek/deepseek-chat": {
        "provider": "openrouter",
        "model": "deepseek/deepseek-chat",
        "price_prompt": 0.00000027,
        "price_completion": 0.0000011,
        "context_window": 64_000,
    },
    "openrouter/meta-llama/llama-3.3-70b-instruct": {
        "provider": "openrouter",
        "model": "meta-llama/llama-3.3-70b-instruct",
        "price_prompt": 0.00000059,
        "price_completion": 0.00000079,
        "context_window": 131_072,
    },
    "openrouter/mistralai/mixtral-8x22b-instruct": {
        "provider": "openrouter",
        "model": "mistralai/mixtral-8x22b-instruct",
        "price_prompt": 0.0000009,
        "price_completion": 0.0000009,
        "context_window": 65_536,
    },
    "openrouter/cohere/command-r-plus": {
        "provider": "openrouter",
        "model": "cohere/command-r-plus",
        "price_prompt": 0.000003,
        "price_completion": 0.000015,
        "context_window": 128_000,
    },
}

_MAX_RETRIES = 3
_RETRY_DELAYS = [1.0, 2.0, 4.0]  # seconds


class AIRouter:
    """Routes chat requests to the appropriate AI provider and streams responses."""

    def __init__(self) -> None:
        self.settings = get_settings()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def get_model_info(self, model_id: str) -> dict:
        """Return registry entry for a model, defaulting to OpenRouter."""
        if model_id in MODEL_REGISTRY:
            return MODEL_REGISTRY[model_id]
        # Unknown model — treat as an OpenRouter pass-through
        return {
            "provider": "openrouter",
            "model": model_id,
            "price_prompt": 0.000001,
            "price_completion": 0.000002,
            "context_window": 128_000,
        }

    def calculate_cost(
        self, model_id: str, prompt_tokens: int, completion_tokens: int
    ) -> float:
        info = self.get_model_info(model_id)
        return round(
            prompt_tokens * info["price_prompt"]
            + completion_tokens * info["price_completion"],
            8,
        )

    async def stream(
        self,
        model_id: str,
        messages: List[ChatMessage],
        api_key: Optional[str] = None,
        max_tokens: int = 4096,
        temperature: float = 0.7,
        system_prompt: Optional[str] = None,
    ) -> AsyncGenerator[StreamChunk, None]:
        """Main entry point — dispatches to the correct provider stream."""
        info = self.get_model_info(model_id)
        provider = info["provider"]
        model = info["model"]
        start_time = time.monotonic()

        for attempt in range(_MAX_RETRIES):
            try:
                if provider == "openai":
                    gen = self._stream_openai(
                        model_id, model, messages, api_key, max_tokens, temperature,
                        system_prompt, start_time
                    )
                elif provider == "anthropic":
                    gen = self._stream_anthropic(
                        model_id, model, messages, api_key, max_tokens, temperature,
                        system_prompt, start_time
                    )
                elif provider == "google":
                    gen = self._stream_google(
                        model_id, model, messages, api_key, max_tokens, temperature,
                        system_prompt, start_time
                    )
                else:
                    gen = self._stream_openrouter(
                        model_id, model, messages, api_key, max_tokens, temperature,
                        system_prompt, start_time
                    )

                async for chunk in gen:
                    yield chunk
                return  # success

            except (httpx.ReadTimeout, httpx.ConnectTimeout) as exc:
                if attempt < _MAX_RETRIES - 1:
                    await asyncio.sleep(_RETRY_DELAYS[attempt])
                    continue
                latency = int((time.monotonic() - start_time) * 1000)
                yield StreamChunk(
                    content="", done=True,
                    error=f"Timeout after {_MAX_RETRIES} attempts: {exc}",
                    latency_ms=latency,
                )
                return

            except httpx.HTTPStatusError as exc:
                latency = int((time.monotonic() - start_time) * 1000)
                yield StreamChunk(
                    content="", done=True,
                    error=f"HTTP {exc.response.status_code}: {exc.response.text[:300]}",
                    latency_ms=latency,
                )
                return

            except Exception as exc:  # noqa: BLE001
                latency = int((time.monotonic() - start_time) * 1000)
                yield StreamChunk(
                    content="", done=True,
                    error=str(exc),
                    latency_ms=latency,
                )
                return

    # ------------------------------------------------------------------
    # Provider implementations
    # ------------------------------------------------------------------

    async def _stream_openai(
        self,
        model_id: str,
        model: str,
        messages: List[ChatMessage],
        api_key: Optional[str],
        max_tokens: int,
        temperature: float,
        system_prompt: Optional[str],
        start_time: float,
    ) -> AsyncGenerator[StreamChunk, None]:
        key = api_key or self.settings.OPENAI_API_KEY
        headers = {
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        }

        msgs: list[dict] = []
        if system_prompt:
            msgs.append({"role": "system", "content": system_prompt})
        msgs.extend({"role": m.role, "content": m.content} for m in messages)

        payload: dict = {
            "model": model,
            "messages": msgs,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "stream": True,
            "stream_options": {"include_usage": True},
        }

        prompt_tokens = 0
        completion_tokens = 0

        async with httpx.AsyncClient(timeout=httpx.Timeout(120.0, connect=10.0)) as client:
            async with client.stream(
                "POST",
                "https://api.openai.com/v1/chat/completions",
                headers=headers,
                json=payload,
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line.startswith("data: "):
                        continue
                    data = line[6:]
                    if data.strip() == "[DONE]":
                        latency = int((time.monotonic() - start_time) * 1000)
                        cost = self.calculate_cost(model_id, prompt_tokens, completion_tokens)
                        yield StreamChunk(
                            content="",
                            done=True,
                            prompt_tokens=prompt_tokens,
                            completion_tokens=completion_tokens,
                            total_tokens=prompt_tokens + completion_tokens,
                            cost_usd=cost,
                            model_id=model_id,
                            latency_ms=latency,
                        )
                        return
                    try:
                        obj = json.loads(data)
                        if obj.get("usage"):
                            prompt_tokens = obj["usage"].get("prompt_tokens", prompt_tokens)
                            completion_tokens = obj["usage"].get(
                                "completion_tokens", completion_tokens
                            )
                        choices = obj.get("choices") or []
                        if choices:
                            delta = choices[0].get("delta") or {}
                            content = delta.get("content") or ""
                            if content:
                                yield StreamChunk(content=content, done=False, model_id=model_id)
                    except (json.JSONDecodeError, KeyError):
                        continue

    async def _stream_anthropic(
        self,
        model_id: str,
        model: str,
        messages: List[ChatMessage],
        api_key: Optional[str],
        max_tokens: int,
        temperature: float,
        system_prompt: Optional[str],
        start_time: float,
    ) -> AsyncGenerator[StreamChunk, None]:
        key = api_key or self.settings.ANTHROPIC_API_KEY
        headers = {
            "x-api-key": key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
            "anthropic-beta": "messages-2023-12-15",
        }

        # Anthropic: system messages must be passed as top-level param
        msgs = [
            {"role": m.role, "content": m.content}
            for m in messages
            if m.role != "system"
        ]

        payload: dict = {
            "model": model,
            "messages": msgs,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "stream": True,
        }
        if system_prompt:
            payload["system"] = system_prompt

        prompt_tokens = 0
        completion_tokens = 0

        async with httpx.AsyncClient(timeout=httpx.Timeout(120.0, connect=10.0)) as client:
            async with client.stream(
                "POST",
                "https://api.anthropic.com/v1/messages",
                headers=headers,
                json=payload,
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line.startswith("data: "):
                        continue
                    try:
                        obj = json.loads(line[6:])
                    except json.JSONDecodeError:
                        continue

                    event_type = obj.get("type", "")

                    if event_type == "message_start":
                        usage = (obj.get("message") or {}).get("usage") or {}
                        prompt_tokens = usage.get("input_tokens", 0)

                    elif event_type == "content_block_delta":
                        text = (obj.get("delta") or {}).get("text") or ""
                        if text:
                            yield StreamChunk(content=text, done=False, model_id=model_id)

                    elif event_type == "message_delta":
                        usage = (obj.get("usage") or {})
                        completion_tokens = usage.get("output_tokens", completion_tokens)

                    elif event_type == "message_stop":
                        latency = int((time.monotonic() - start_time) * 1000)
                        cost = self.calculate_cost(model_id, prompt_tokens, completion_tokens)
                        yield StreamChunk(
                            content="",
                            done=True,
                            prompt_tokens=prompt_tokens,
                            completion_tokens=completion_tokens,
                            total_tokens=prompt_tokens + completion_tokens,
                            cost_usd=cost,
                            model_id=model_id,
                            latency_ms=latency,
                        )
                        return

                    elif event_type == "error":
                        error_msg = (obj.get("error") or {}).get("message", "Unknown Anthropic error")
                        latency = int((time.monotonic() - start_time) * 1000)
                        yield StreamChunk(
                            content="", done=True, error=error_msg,
                            model_id=model_id, latency_ms=latency,
                        )
                        return

    async def _stream_google(
        self,
        model_id: str,
        model: str,
        messages: List[ChatMessage],
        api_key: Optional[str],
        max_tokens: int,
        temperature: float,
        system_prompt: Optional[str],
        start_time: float,
    ) -> AsyncGenerator[StreamChunk, None]:
        key = api_key or self.settings.GOOGLE_AI_API_KEY
        url = (
            f"https://generativelanguage.googleapis.com/v1beta/models/"
            f"{model}:streamGenerateContent?key={key}&alt=sse"
        )

        contents: list[dict] = []
        for m in messages:
            if m.role == "system":
                continue  # handled via systemInstruction
            google_role = "user" if m.role == "user" else "model"
            contents.append({"role": google_role, "parts": [{"text": m.content}]})

        payload: dict = {
            "contents": contents,
            "generationConfig": {
                "maxOutputTokens": max_tokens,
                "temperature": temperature,
            },
        }
        if system_prompt:
            payload["systemInstruction"] = {"parts": [{"text": system_prompt}]}

        prompt_tokens = 0
        completion_tokens = 0
        finish_sent = False

        async with httpx.AsyncClient(timeout=httpx.Timeout(120.0, connect=10.0)) as client:
            async with client.stream("POST", url, json=payload) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line.startswith("data: "):
                        continue
                    try:
                        obj = json.loads(line[6:])
                    except json.JSONDecodeError:
                        continue

                    candidates = obj.get("candidates") or []
                    if candidates:
                        parts = (candidates[0].get("content") or {}).get("parts") or []
                        for part in parts:
                            text = part.get("text") or ""
                            if text:
                                yield StreamChunk(content=text, done=False, model_id=model_id)

                        finish_reason = candidates[0].get("finishReason")
                        if finish_reason and not finish_sent:
                            usage = obj.get("usageMetadata") or {}
                            prompt_tokens = usage.get("promptTokenCount", prompt_tokens)
                            completion_tokens = usage.get(
                                "candidatesTokenCount", completion_tokens
                            )
                            latency = int((time.monotonic() - start_time) * 1000)
                            cost = self.calculate_cost(model_id, prompt_tokens, completion_tokens)
                            yield StreamChunk(
                                content="",
                                done=True,
                                prompt_tokens=prompt_tokens,
                                completion_tokens=completion_tokens,
                                total_tokens=prompt_tokens + completion_tokens,
                                cost_usd=cost,
                                model_id=model_id,
                                latency_ms=latency,
                            )
                            finish_sent = True
                            return

                    # Capture usage even without candidates (final chunk)
                    usage = obj.get("usageMetadata") or {}
                    if usage:
                        prompt_tokens = usage.get("promptTokenCount", prompt_tokens)
                        completion_tokens = usage.get("candidatesTokenCount", completion_tokens)

        # If we exhausted lines without a finishReason chunk
        if not finish_sent:
            latency = int((time.monotonic() - start_time) * 1000)
            cost = self.calculate_cost(model_id, prompt_tokens, completion_tokens)
            yield StreamChunk(
                content="",
                done=True,
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                total_tokens=prompt_tokens + completion_tokens,
                cost_usd=cost,
                model_id=model_id,
                latency_ms=latency,
            )

    async def _stream_openrouter(
        self,
        model_id: str,
        model: str,
        messages: List[ChatMessage],
        api_key: Optional[str],
        max_tokens: int,
        temperature: float,
        system_prompt: Optional[str],
        start_time: float,
    ) -> AsyncGenerator[StreamChunk, None]:
        key = api_key or self.settings.OPENROUTER_API_KEY
        headers = {
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://aiworkspace.app",
            "X-Title": "AI Workspace",
        }

        msgs: list[dict] = []
        if system_prompt:
            msgs.append({"role": "system", "content": system_prompt})
        msgs.extend({"role": m.role, "content": m.content} for m in messages)

        payload = {
            "model": model,
            "messages": msgs,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "stream": True,
        }

        prompt_tokens = 0
        completion_tokens = 0

        async with httpx.AsyncClient(timeout=httpx.Timeout(120.0, connect=10.0)) as client:
            async with client.stream(
                "POST",
                "https://openrouter.ai/api/v1/chat/completions",
                headers=headers,
                json=payload,
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line.startswith("data: "):
                        continue
                    data = line[6:]
                    if data.strip() == "[DONE]":
                        latency = int((time.monotonic() - start_time) * 1000)
                        cost = self.calculate_cost(model_id, prompt_tokens, completion_tokens)
                        yield StreamChunk(
                            content="",
                            done=True,
                            prompt_tokens=prompt_tokens,
                            completion_tokens=completion_tokens,
                            total_tokens=prompt_tokens + completion_tokens,
                            cost_usd=cost,
                            model_id=model_id,
                            latency_ms=latency,
                        )
                        return
                    try:
                        obj = json.loads(data)
                        usage = obj.get("usage") or {}
                        if usage:
                            prompt_tokens = usage.get("prompt_tokens", prompt_tokens)
                            completion_tokens = usage.get(
                                "completion_tokens", completion_tokens
                            )
                        choices = obj.get("choices") or []
                        if choices:
                            delta = choices[0].get("delta") or {}
                            content = delta.get("content") or ""
                            if content:
                                yield StreamChunk(
                                    content=content, done=False, model_id=model_id
                                )
                    except (json.JSONDecodeError, KeyError):
                        continue


# Module-level singleton
ai_router = AIRouter()
