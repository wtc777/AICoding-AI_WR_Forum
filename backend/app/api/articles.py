from __future__ import annotations

import markdown2
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from app.api import deps
from app.models.article import Article, ArticleLike, ArticleTagLink, Comment, Tag
from app.models.card_reading import CardReading
from app.schemas.article import ArticleCreate, ArticleRead, CommentCreate, CommentRead

router = APIRouter(prefix="/articles", tags=["articles"])


def _attach_tags(session: Session, article: Article, tag_names: list[str]) -> None:
    unique_names = {name.strip().lower() for name in tag_names if name.strip()}
    for name in unique_names:
        tag = session.exec(select(Tag).where(Tag.name == name)).first()
        if not tag:
            tag = Tag(name=name)
            session.add(tag)
            session.flush()
        link = ArticleTagLink(article_id=article.id, tag_id=tag.id)
        session.merge(link)


def _to_read_model(session: Session, article: Article) -> ArticleRead:
    tag_names = [tag.name for tag in session.exec(
        select(Tag).join(ArticleTagLink, Tag.id == ArticleTagLink.tag_id).where(ArticleTagLink.article_id == article.id)
    ).all()]
    likes = session.exec(select(ArticleLike).where(ArticleLike.article_id == article.id)).all()
    likes_count = len(likes)
    return ArticleRead(
        id=article.id,
        title=article.title,
        content_markdown=article.content_markdown,
        content_html=article.content_html,
        is_published=article.is_published,
        is_featured=article.is_featured,
        author_id=article.author_id,
        from_reading_id=article.from_reading_id,
        tags=tag_names,
        created_at=article.created_at,
        likes_count=likes_count,
    )


@router.post("/", response_model=ArticleRead)
def create_article(
    payload: ArticleCreate,
    session: Session = Depends(deps.get_db),
    current_user=Depends(deps.get_current_user),
):
    content_html = markdown2.markdown(payload.content_markdown)
    article = Article(
        author_id=current_user.id,
        title=payload.title,
        content_markdown=payload.content_markdown,
        content_html=content_html,
        is_published=payload.is_published,
        from_reading_id=payload.from_reading_id,
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
):
    query = select(Article).where(Article.is_published == True).order_by(Article.created_at.desc())
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
