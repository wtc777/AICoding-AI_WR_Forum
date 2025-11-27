from __future__ import annotations

import json
import os
from datetime import datetime
from pathlib import Path
from typing import List, Tuple

from fastapi import APIRouter, Depends, File, Form, UploadFile, HTTPException
from sqlmodel import Session, select

from app.api import deps
from app.core.config import get_settings
from app.models.ai_log import AICallLog
from app.models.card_definition import CardDefinition
from app.models.card_reading import CardReading
from app.schemas.reading import ReadingRead
from app.schemas.card import CardDefinitionRead, CardFace
from app.services import ai_client
import logging

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

router = APIRouter(prefix="/ai", tags=["ai"])


def _serialize_card_definition(card) -> CardDefinitionRead:
    return CardDefinitionRead(
        id=card.id,
        front=CardFace(
            title=card.front_title,
            english=card.front_english,
            value=card.front_value,
            color=card.front_color,
            image=card.front_image,
        ),
        back=CardFace(
            title=card.back_title,
            english=card.back_english,
            value=card.back_value,
            color=card.back_color,
            image=card.back_image,
        ),
    )


@router.get("/cards", response_model=List[CardDefinitionRead])
def list_card_definitions(
    session: Session = Depends(deps.get_db),
    current_user=Depends(deps.get_current_user),
):
    cards = session.exec(select(CardDefinition).order_by(CardDefinition.id)).all()
    return [_serialize_card_definition(card) for card in cards]


@router.post("/upload")
async def upload_image(
    file: UploadFile = File(...),
    current_user=Depends(deps.get_current_user_optional),
):
    settings = get_settings()
    upload_dir = Path(settings.upload_dir) / datetime.utcnow().strftime("%Y/%m/%d")
    upload_dir.mkdir(parents=True, exist_ok=True)

    suffix = Path(file.filename or "file.png").suffix or ".png"
    prefix = f"{getattr(current_user, 'id', 'anon')}"
    filename = f"reading_{prefix}_{int(datetime.utcnow().timestamp())}{suffix}"
    dest = upload_dir / filename

    content = await file.read()
    with open(dest, "wb") as f:
        f.write(content)

    relative = dest.relative_to(Path.cwd())
    url = "/" + str(relative).replace("\\", "/")
    return {"url": url}


@router.post("/card/interpret-with-image", response_model=ReadingRead)
async def interpret_with_image(
    card_type: str = Form(...),
    scene_desc: str = Form(...),
    cardset_layout: str = Form(default="[]"),
    cardset_scores: str = Form(default="{}"),
    cardset_score_text: str = Form(default=""),
    cardset_layout_summary: str = Form(default=""),
    cardset_score_logic: str = Form(default=""),
    image_files: List[UploadFile] = File(default_factory=list),
    session: Session = Depends(deps.get_db),
    current_user=Depends(deps.get_current_user),
):
    print(
        "[ai] interpret start",
        {
            "user": current_user.id,
            "card_type": card_type,
            "scene_len": len(scene_desc or ""),
            "layout_raw_len": len(cardset_layout or ""),
            "scores_raw_len": len(cardset_scores or ""),
        },
        flush=True,
    )
    deps.rate_limit_ai(current_user.id)
    settings = get_settings()
    logger.info(
        "interpret request user=%s files=%s card_type=%s",
        current_user.id,
        0,
        card_type,
    )
    saved_paths: List[str] = []
    upload_dir = Path(settings.upload_dir) / datetime.utcnow().strftime("%Y/%m/%d")
    os.makedirs(upload_dir, exist_ok=True)

    file_buffers: List[Tuple[str, bytes]] = []
    for idx, file in enumerate(image_files):
        # Images are ignored for this endpoint; keep placeholder for compatibility
        _ = idx
        _ = file

    try:
        parsed_layout = json.loads(cardset_layout or "[]")
    except json.JSONDecodeError:
        parsed_layout = []
    try:
        parsed_scores = json.loads(cardset_scores or "{}")
    except json.JSONDecodeError:
        parsed_scores = {}

    logger.info(
        "ai request user=%s layout_len=%s scores_len=%s files=%s layout_summary_len=%s score_text_len=%s scene_len=%s",
        current_user.id,
        len(cardset_layout or ""),
        len(cardset_scores or ""),
        0,
        len(cardset_layout_summary or ""),
        len(cardset_score_text or ""),
        len(scene_desc or ""),
    )

    prompt = ai_client.build_prompt(
        card_type=card_type,
        scene_desc=scene_desc,
        cardset_layout=json.dumps(parsed_layout, ensure_ascii=False),
        cardset_scores=json.dumps(parsed_scores, ensure_ascii=False),
        cardset_score_text=cardset_score_text,
        cardset_layout_summary=cardset_layout_summary,
        cardset_score_logic=cardset_score_logic,
    )
    print(
        "[ai] prompt preview",
        {
            "prompt_len": len(prompt),
            "prompt_snippet": prompt[:200],
        },
        flush=True,
    )
    try:
        ai_result = await ai_client.call_ai_model(files=file_buffers, prompt=prompt, user_id=current_user.id)
    except Exception as exc:  # surface AI errors to frontend
        logger.exception("AI call failed user=%s", current_user.id)
        raise HTTPException(status_code=400, detail=f"AI invocation failed: {exc}") from exc

    print(
        "[ai] model response",
        {
            "latency_ms": ai_result.get("latency_ms"),
            "has_cards": bool(ai_result.get("cards") or ai_result.get("raw", {}).get("cards")),
            "analysis_len": len(ai_result.get("analysis") or json.dumps(ai_result.get("raw") or {})),
        },
        flush=True,
    )

    logger.info(
        "ai response user=%s latency_ms=%s has_cards=%s analysis_len=%s",
        current_user.id,
        ai_result.get("latency_ms"),
        bool(ai_result.get("cards") or ai_result.get("raw", {}).get("cards")),
        len(ai_result.get("analysis") or json.dumps(ai_result.get("raw") or {})),
    )

    cards_json = ai_result.get("cards") or ai_result.get("raw", {}).get("cards")
    ai_response = ai_result.get("analysis") or json.dumps(ai_result.get("raw"), ensure_ascii=False)

    reading = CardReading(
        user_id=current_user.id,
        card_type=card_type,
        scene_desc=scene_desc,
        ai_response=ai_response,
        cards_json=cards_json,
        image_urls=saved_paths,
    )
    session.add(reading)

    log = AICallLog(
        user_id=current_user.id,
        model=(settings.load_ai_config().model if settings.load_ai_config() else "stub"),
        tokens_in=None,
        tokens_out=None,
        latency_ms=ai_result.get("latency_ms"),
        status="success",
    )
    session.add(log)

    session.commit()
    session.refresh(reading)
    return reading


@router.get("/readings/my", response_model=List[ReadingRead])
def my_readings(current_user=Depends(deps.get_current_user), session: Session = Depends(deps.get_db)):
    readings = session.exec(
        select(CardReading).where(CardReading.user_id == current_user.id).order_by(CardReading.created_at.desc())
    ).all()
    return readings


@router.get("/readings/{reading_id}", response_model=ReadingRead)
def get_reading(reading_id: int, current_user=Depends(deps.get_current_user), session: Session = Depends(deps.get_db)):
    reading = session.get(CardReading, reading_id)
    if not reading or reading.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Reading not found")
    return reading
