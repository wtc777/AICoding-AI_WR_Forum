from __future__ import annotations

from contextlib import contextmanager
from typing import Generator

from sqlmodel import Session, SQLModel, create_engine

from app.core.config import get_settings

settings = get_settings()
engine = create_engine(settings.database_url, echo=False)


def init_db() -> None:
    from app import models  # noqa: F401
    from app.db.card_seed import ensure_card_definitions

    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        ensure_card_definitions(session)


@contextmanager
def get_session() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session
