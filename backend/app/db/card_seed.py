from __future__ import annotations

import json
from pathlib import Path
from typing import List

from sqlmodel import Session, select

from app.core.config import PROJECT_ROOT
from app.models.card_definition import CardDefinition

CARD_DEFINITION_PATH = PROJECT_ROOT / "config" / "card_definitions.json"


def ensure_card_definitions(session: Session) -> None:
    """Seed or refresh card definitions from JSON."""
    if not CARD_DEFINITION_PATH.exists():
        return

    existing = {c.id: c for c in session.exec(select(CardDefinition)).all()}
    raw_text = CARD_DEFINITION_PATH.read_text(encoding="utf-8-sig")
    raw: List[dict] = json.loads(raw_text)

    for item in raw:
        front = item.get("front") or {}
        back = item.get("back") or {}
        card = existing.get(item["id"])
        if not card:
            card = CardDefinition(id=item["id"])
            session.add(card)
        card.front_title = front.get("title", "")
        card.front_english = front.get("english", "")
        card.front_value = int(front.get("value", 0))
        card.front_color = front.get("color", "")
        card.front_image = front.get("image")
        card.back_title = back.get("title", "")
        card.back_english = back.get("english", "")
        card.back_value = int(back.get("value", 0))
        card.back_color = back.get("color", "")
        card.back_image = back.get("image")

    session.commit()
