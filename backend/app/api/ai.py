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
from app.models.card_reading import CardReading
from app.schemas.reading import ReadingRead
from app.services import ai_client
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai", tags=["ai"])


@router.post("/card/interpret-with-image", response_model=ReadingRead)
async def interpret_with_image(
    card_type: str = Form(...),
    scene_desc: str = Form(...),
    cardset_layout: str = Form(default="[]"),
    cardset_scores: str = Form(default="{}"),
    cardset_score_text: str = Form(default=""),
    image_files: List[UploadFile] = File(default_factory=list),
    session: Session = Depends(deps.get_db),
    current_user=Depends(deps.get_current_user),
):
    deps.rate_limit_ai(current_user.id)
    settings = get_settings()
    logger.info(
        "interpret request user=%s files=%s card_type=%s",
        current_user.id,
        len(image_files),
        card_type,
    )
    saved_paths: List[str] = []
    upload_dir = Path(settings.upload_dir) / datetime.utcnow().strftime("%Y/%m/%d")
    os.makedirs(upload_dir, exist_ok=True)

    file_buffers: List[Tuple[str, bytes]] = []
    for idx, file in enumerate(image_files):
        content = await file.read()
        filename = f"reading_{current_user.id}_{int(datetime.utcnow().timestamp())}_{idx}{Path(file.filename).suffix}"
        dest = upload_dir / filename
        with open(dest, "wb") as f:
            f.write(content)
        saved_paths.append(str(dest.relative_to(Path.cwd())))
        file_buffers.append((file.filename or "image.jpg", content))

    try:
        parsed_layout = json.loads(cardset_layout or "[]")
    except json.JSONDecodeError:
        parsed_layout = []
    try:
        parsed_scores = json.loads(cardset_scores or "{}")
    except json.JSONDecodeError:
        parsed_scores = {}

    prompt = ai_client.build_prompt(
        card_type=card_type,
        scene_desc=scene_desc,
        cardset_layout=json.dumps(parsed_layout, ensure_ascii=False),
        cardset_scores=json.dumps(parsed_scores, ensure_ascii=False),
        cardset_score_text=cardset_score_text,
    )
    try:
        ai_result = await ai_client.call_ai_model(files=file_buffers, prompt=prompt, user_id=current_user.id)
    except Exception as exc:  # surface AI errors to frontend
        logger.exception("AI call failed user=%s", current_user.id)
        raise HTTPException(status_code=400, detail=f"AI 调用失败: {exc}") from exc

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
