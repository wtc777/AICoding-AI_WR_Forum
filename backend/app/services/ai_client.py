from __future__ import annotations

import logging
import time
import asyncio
from pathlib import Path
from typing import Any, Dict, List, Tuple

from app.core.config import get_settings
from app.services.gemini_client import analyze_image_bytes

settings = get_settings()
logger = logging.getLogger(__name__)
PROMPT_FILE = Path(__file__).resolve().parents[3] / "config" / "prompt.txt"
BASE_PROMPT = None


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
    if not ai_cfg:
        raise RuntimeError("ai.yaml not found or invalid; cannot call Gemini")

    logger.info(
        "AI call start model=%s files=%s prompt_len=%s endpoint=%s",
        ai_cfg.model,
        len(files),
        len(prompt),
        ai_cfg.base_url,
    )
    result = await asyncio.to_thread(
        analyze_image_bytes,
        files,
        prompt,
        ai_cfg.model,
        ai_cfg.base_url.rstrip("/") if ai_cfg.base_url else None,
    )
    latency_ms = int((time.time() - start) * 1000)
    logger.info("AI call end model=%s latency_ms=%s", ai_cfg.model, latency_ms)
    return {**result, "latency_ms": latency_ms}


def build_prompt(
    card_type: str,
    scene_desc: str,
    cardset_layout: str | None = None,
    cardset_scores: str | None = None,
    cardset_score_text: str | None = None,
) -> str:
    global BASE_PROMPT
    if BASE_PROMPT is None:
        try:
            BASE_PROMPT = PROMPT_FILE.read_text(encoding="utf-8")
        except FileNotFoundError:
            BASE_PROMPT = (
                "你是卡牌解读助手，请结合图片与描述输出 JSON，包括 analysis 与 cards 列表。"
            )

    layout_part = f"\nCard layout JSON: {cardset_layout}" if cardset_layout else ""
    score_part = f"\nScores JSON: {cardset_scores}" if cardset_scores else ""
    score_text_part = f"\nScore summary: {cardset_score_text}" if cardset_score_text else ""

    return (
        f"{BASE_PROMPT}\n\n"
        f"卡组类型: {card_type}\n"
        f"场景描述: {scene_desc}"
        f"{layout_part}{score_part}{score_text_part}"
    )
