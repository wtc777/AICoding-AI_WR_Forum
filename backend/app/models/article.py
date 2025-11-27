from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlmodel import Field, SQLModel, ForeignKey, Relationship, UniqueConstraint
from app.models.user import User
from app.models.card_reading import CardReading


class ArticleTagLink(SQLModel, table=True):
    __table_args__ = (UniqueConstraint("article_id", "tag_id", name="uq_article_tag"),)

    article_id: int = Field(foreign_key="article.id", primary_key=True)
    tag_id: int = Field(foreign_key="tag.id", primary_key=True)


class Article(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    author_id: int = Field(foreign_key="user.id", index=True)
    title: str
    content_markdown: str
    content_html: str = Field(default="")
    from_reading_id: Optional[int] = Field(default=None, foreign_key="cardreading.id")
    is_featured: bool = Field(default=False)
    is_published: bool = Field(default=True)
    created_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)

    author: User = Relationship()
    # tags relationship omitted to simplify mapper resolution; join via ArticleTagLink in queries.


class Tag(SQLModel, table=True):
    __table_args__ = (UniqueConstraint("name", name="uq_tags_name"),)

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True)

    # back-rel omitted; manage via ArticleTagLink manually.


class Comment(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    article_id: int = Field(foreign_key="article.id", index=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    content: str
    created_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)


class ArticleLike(SQLModel, table=True):
    __table_args__ = (UniqueConstraint("article_id", "user_id", name="uq_article_like"),)

    id: Optional[int] = Field(default=None, primary_key=True)
    article_id: int = Field(foreign_key="article.id", index=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)
