from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class ArticleBase(BaseModel):
    title: str
    content_markdown: str
    is_published: bool = True
    is_auto_generated: bool = False
    tag_names: List[str] = Field(default_factory=list)
    from_reading_id: Optional[int] = None


class ArticleCreate(ArticleBase):
    pass


class ArticleRead(BaseModel):
    id: int
    title: str
    content_markdown: str
    content_html: str
    is_published: bool
    is_auto_generated: bool
    is_featured: bool
    author_id: int
    author_name: Optional[str] = None
    from_reading_id: Optional[int]
    tags: List[str] = Field(default_factory=list)
    created_at: datetime
    likes_count: int = 0

    class Config:
        from_attributes = True


class CommentCreate(BaseModel):
    content: str


class CommentRead(BaseModel):
    id: int
    article_id: int
    user_id: int
    content: str
    created_at: datetime

    class Config:
        from_attributes = True
