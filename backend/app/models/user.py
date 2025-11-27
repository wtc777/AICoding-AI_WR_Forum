from __future__ import annotations

from datetime import datetime
from typing import Optional, TYPE_CHECKING

from sqlmodel import Field, SQLModel, UniqueConstraint, Relationship

if TYPE_CHECKING:
    from app.models.card_reading import CardReading
    from app.models.article import Article


class User(SQLModel, table=True):
    __table_args__ = (UniqueConstraint("email", name="uq_users_email"),)

    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(index=True)
    password_hash: str
    nickname: str = Field(default="")
    avatar_url: Optional[str] = None
    role: str = Field(default="user", index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)
    is_active: bool = Field(default=True)
