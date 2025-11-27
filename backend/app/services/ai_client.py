from __future__ import annotations

import logging
import os
import time
import asyncio
from pathlib import Path
from typing import Any, Dict, List, Tuple

import httpx
import yaml
from dotenv import load_dotenv

from app.core.config import get_settings, PROJECT_ROOT

settings = get_settings()
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)
PROMPT_FILE = Path(__file__).resolve().parents[3] / 'config' / 'prompt.txt'
PRESET_FILE = PROJECT_ROOT / "config" / "model_presets.yaml"
BASE_PROMPT = None

DEFAULT_PATH = "/v1/chat/completions"

# ensure env from repo root/backends are loaded for provider-specific keys
load_dotenv(PROJECT_ROOT / ".env")
load_dotenv(PROJECT_ROOT / "backend" / ".env")


def _normalize_content(content: Any) -> str:
    if not content:
        return ""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "".join(part.get("text", "") for part in content if isinstance(part, dict)).strip()
    return ""


def _resolve_api_key(provider: str | None) -> tuple[str, str]:
    """Pick API key by provider, return (key, source)."""
    provider = (provider or "").lower()
    if provider == "qwen":
        key = os.getenv("QWEN_API_KEY") or settings.ai_api_key or ""
        return key, "QWEN_API_KEY" if os.getenv("QWEN_API_KEY") else "AI_API_KEY"
    if provider == "gemini":
        key = os.getenv("GEMINI_API_KEY") or settings.ai_api_key or ""
        return key, "GEMINI_API_KEY" if os.getenv("GEMINI_API_KEY") else "AI_API_KEY"
    key = settings.ai_api_key or ""
    return key, "AI_API_KEY"


async def call_ai_model(
    files: List[Tuple[str, bytes]],
    prompt: str,
    user_id: int | None = None,
) -> Dict[str, Any]:
    """Call OpenAI-compatible multimodal endpoint.

    If ai.yaml is missing or AI_API_KEY is unset, returns a stubbed response.
    """
    start = time.time()
    ai_cfg = settings.load_ai_config()
    if not ai_cfg or not ai_cfg.base_url or not ai_cfg.model:
        raise RuntimeError('ai.yaml missing base_url/model; cannot call AI')

    # allow overriding by preset name in ai.yaml provider
    if ai_cfg.provider and PRESET_FILE.exists():
        try:
            presets = yaml.safe_load(PRESET_FILE.read_text(encoding="utf-8")) or {}
            preset = (presets.get("presets") or {}).get(ai_cfg.provider)
            if preset:
                ai_cfg.base_url = preset.get("base_url", ai_cfg.base_url)
                ai_cfg.model = preset.get("model", ai_cfg.model)
                ai_cfg.chat_completion_path = preset.get("chat_completion_path", ai_cfg.chat_completion_path)
                if preset.get("default_params"):
                    ai_cfg.default_params = {**preset.get("default_params"), **(ai_cfg.default_params or {})}
        except Exception:  # noqa: BLE001
            pass

    api_key, key_source = _resolve_api_key(ai_cfg.provider)
    if not api_key:
        raise RuntimeError(f"API key missing for provider '{ai_cfg.provider or 'default'}'; set {key_source} in environment/.env")
    masked_key = f"{api_key[:6]}***{api_key[-4:]}" if len(api_key) > 10 else "SHORT_KEY"
    endpoint = ai_cfg.base_url.rstrip("/") + (ai_cfg.chat_completion_path or DEFAULT_PATH)

    print(
        "[ai_client] call start",
        {
            "model": ai_cfg.model,
            "prompt_len": len(prompt),
            "endpoint": endpoint,
            "api_key": masked_key,
            "key_source": key_source,
            "provider": ai_cfg.provider,
        },
        flush=True,
    )

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
    }
    payload: Dict[str, Any] = {
        "model": ai_cfg.model,
        "messages": [
            {
                "role": "user",
                "content": [{"type": "text", "text": prompt}],
            }
        ],
    }
    if ai_cfg.default_params:
        payload.update(ai_cfg.default_params)

    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(endpoint, json=payload, headers=headers)
        text = resp.text
        status = resp.status_code
        content_type = resp.headers.get("content-type", "")

    if "application/json" in content_type:
        try:
            data = resp.json()
        except Exception as exc:  # noqa: BLE001
            print("[ai_client] json parse failed", {"status": status, "snippet": text[:400]}, flush=True)
            raise RuntimeError(f"AI response parse error: {exc}") from exc
    else:
        print("[ai_client] non-json response", {"status": status, "snippet": text[:400]}, flush=True)
        raise RuntimeError("AI response is not JSON; check endpoint/network")

    if status >= 400:
        print("[ai_client] http error", {"status": status, "body": data}, flush=True)
        raise RuntimeError(data.get("error", {}).get("message") or f"AI request failed: {status}")

    message = (data.get("choices") or [{}])[0].get("message") or {}
    content = _normalize_content(message.get("content"))
    latency_ms = int((time.time() - start) * 1000)

    print(
        "[ai_client] call done",
        {
            "model": ai_cfg.model,
            "latency_ms": latency_ms,
            "status": status,
            "content_len": len(content),
            "raw_keys": list(data.keys()),
        },
        flush=True,
    )
    logger.info('AI call end model=%s latency_ms=%s', ai_cfg.model, latency_ms)

    return {
        "analysis": content,
        "raw": data,
        "latency_ms": latency_ms,
    }


def build_prompt(
    card_type: str,
    scene_desc: str,
    cardset_layout: str | None = None,
    cardset_scores: str | None = None,
    cardset_score_text: str | None = None,
    cardset_layout_summary: str | None = None,
    cardset_score_logic: str | None = None,
) -> str:
    global BASE_PROMPT
    if BASE_PROMPT is None:
        try:
            BASE_PROMPT = PROMPT_FILE.read_text(encoding='utf-8')
        except FileNotFoundError:
            BASE_PROMPT = (
                'You are a card interpretation assistant. Combine the provided images and descriptions to output JSON with '
                'an `analysis` summary and a `cards` list.'
            )

    layout_part = f"\nCard layout JSON: {cardset_layout}" if cardset_layout else ''
    layout_summary_part = f"\nLayout summary: {cardset_layout_summary}" if cardset_layout_summary else ''
    score_part = f"\nScores JSON: {cardset_scores}" if cardset_scores else ''
    score_text_part = f"\nScore summary: {cardset_score_text}" if cardset_score_text else ''
    score_logic_part = f"\nScoring rule: {cardset_score_logic}" if cardset_score_logic else ''

    return (
        f"{BASE_PROMPT}\n\n"
        f"Card set type: {card_type}\n"
        f"Scene description: {scene_desc}"
        f"{layout_part}{layout_summary_part}{score_part}{score_text_part}{score_logic_part}"
    )
