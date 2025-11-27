from __future__ import annotations

import markdown2
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlmodel import Session, select
from sqlalchemy import or_

from app.api import deps
from app.models.article import Article, ArticleLike, ArticleTagLink, Comment, Tag
from app.models.card_reading import CardReading
from app.models.user import User
from app.schemas.article import ArticleCreate, ArticleRead, CommentCreate, CommentRead

router = APIRouter(prefix="/articles", tags=["articles"])


class ArticleUpdate(BaseModel):
    is_published: Optional[bool] = None
    title: Optional[str] = None
    content_markdown: Optional[str] = None
    tag_names: Optional[list[str]] = None
    delete: Optional[bool] = None


def _attach_tags(session: Session, article: Article, tag_names: list[str]) -> None:
    unique_names = {name.strip().lower() for name in tag_names if name.strip() and not name.strip().isdigit()}
    for name in unique_names:
        tag = session.exec(select(Tag).where(Tag.name == name)).first()
        if not tag:
            tag = Tag(name=name)
            session.add(tag)
            session.flush()
        link = ArticleTagLink(article_id=article.id, tag_id=tag.id)
        session.merge(link)


def _clear_tags(session: Session, article_id: int) -> None:
    links = session.exec(select(ArticleTagLink).where(ArticleTagLink.article_id == article_id)).all()
    for link in links:
        session.delete(link)


def _to_read_model(session: Session, article: Article) -> ArticleRead:
    tag_names_raw = [
        tag.name
        for tag in session.exec(
            select(Tag).join(ArticleTagLink, Tag.id == ArticleTagLink.tag_id).where(ArticleTagLink.article_id == article.id)
        ).all()
    ]
    tag_names = [t for t in tag_names_raw if t and not t.strip().isdigit()]
    likes = session.exec(select(ArticleLike).where(ArticleLike.article_id == article.id)).all()
    likes_count = len(likes)
    author = session.get(User, article.author_id)
    return ArticleRead(
        id=article.id,
        title=article.title,
        content_markdown=article.content_markdown,
        content_html=article.content_html,
        is_published=article.is_published,
        is_auto_generated=article.is_auto_generated,
        is_featured=article.is_featured,
        author_id=article.author_id,
        author_name=author.nickname if author else None,
        from_reading_id=article.from_reading_id,
        tags=tag_names,
        created_at=article.created_at,
        likes_count=likes_count,
    )


@router.post("/", response_model=ArticleRead)
def create_article(
    payload: ArticleCreate,
    session: Session = Depends(deps.get_db),
    current_user: User | None = Depends(deps.get_current_user_optional),
):
    author = current_user
    if not author:
        author = session.exec(select(User).where(User.is_active == True)).first()
    if not author:
        raise HTTPException(status_code=401, detail="No available user to create article")
    content_html = markdown2.markdown(payload.content_markdown)
    article = Article(
        author_id=author.id,
        title=payload.title,
        content_markdown=payload.content_markdown,
        content_html=content_html,
        is_published=payload.is_published,
        from_reading_id=payload.from_reading_id,
        is_auto_generated=payload.is_auto_generated,
    )
    session.add(article)
    session.commit()
    session.refresh(article)

    _attach_tags(session, article, payload.tag_names)
    session.commit()
    return _to_read_model(session, article)


@router.get("/", response_model=list[ArticleRead])
def list_articles(
    session: Session = Depends(deps.get_db),
    tag: str | None = Query(default=None),
    scope: str | None = Query(default="community"),
    author_id: int | None = Query(default=None),
    current_user=Depends(deps.get_current_user_optional),
):
    scope = (scope or "community").lower()
    if author_id is not None:
        query = select(Article).where(Article.author_id == author_id)
    elif scope == "mine":
        if not current_user:
            raise HTTPException(status_code=401, detail="Not authenticated")
        query = select(Article).where(Article.author_id == current_user.id)
    else:  # community or default
        query = select(Article).where(Article.is_published == True)
    query = query.order_by(Article.created_at.desc())
    if tag:
        query = query.join(ArticleTagLink, ArticleTagLink.article_id == Article.id).join(Tag, Tag.id == ArticleTagLink.tag_id).where(Tag.name == tag)
    articles = session.exec(query).all()
    return [_to_read_model(session, a) for a in articles]


@router.get("/{article_id}", response_model=ArticleRead)
def get_article(article_id: int, session: Session = Depends(deps.get_db)):
    article = session.get(Article, article_id)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    return _to_read_model(session, article)


@router.patch("/{article_id}", response_model=None)
def update_article(
    article_id: int,
    payload: ArticleUpdate,
    session: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    article = session.get(Article, article_id)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    if current_user.role != "admin" and article.author_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    if payload.delete:
        session.delete(article)
        session.commit()
        return {"deleted": True}

    update_data = payload.model_dump(exclude_none=True)
    protected_fields = {"title", "content_markdown", "tag_names"}
    if article.is_auto_generated and protected_fields.intersection(update_data.keys()):
        raise HTTPException(status_code=400, detail="自动归档的文章不支持编辑内容")
    if "tag_names" in update_data:
        _clear_tags(session, article.id)
        _attach_tags(session, article, update_data.pop("tag_names") or [])
    if "content_markdown" in update_data:
        article.content_html = markdown2.markdown(update_data["content_markdown"])
    for key, val in update_data.items():
        setattr(article, key, val)

    session.add(article)
    session.commit()
    session.refresh(article)
    return _to_read_model(session, article)


@router.post("/{article_id}/comments", response_model=CommentRead)
def comment_article(
    article_id: int,
    payload: CommentCreate,
    session: Session = Depends(deps.get_db),
    current_user=Depends(deps.get_current_user),
):
    article = session.get(Article, article_id)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    comment = Comment(article_id=article_id, user_id=current_user.id, content=payload.content)
    session.add(comment)
    session.commit()
    session.refresh(comment)
    return comment


@router.post("/{article_id}/like")
def like_article(
    article_id: int,
    session: Session = Depends(deps.get_db),
    current_user=Depends(deps.get_current_user),
):
    article = session.get(Article, article_id)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    like = ArticleLike(article_id=article_id, user_id=current_user.id)
    session.merge(like)
    session.commit()
    return {"liked": True}


@router.get("/{article_id}/comments", response_model=list[CommentRead])
def list_comments(article_id: int, session: Session = Depends(deps.get_db)):
    comments = session.exec(select(Comment).where(Comment.article_id == article_id).order_by(Comment.created_at.asc())).all()
    return comments
