from __future__ import annotations

from pydantic import BaseModel


class CardFace(BaseModel):
    title: str
    english: str
    value: int
    color: str
    image: str | None = None


class CardDefinitionRead(BaseModel):
    id: str
    front: CardFace
    back: CardFace

    class Config:
        from_attributes = True
