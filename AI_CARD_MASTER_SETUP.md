# AI Card Master - Dev Setup

This repo now contains a FastAPI backend (./backend) and a Vite + React + Ant Design frontend (./frontend) per PRD.

## Backend (FastAPI)
1. `cd backend`
2. Create env: `python -m venv .venv && .\.venv\Scripts\activate`
3. Install deps: `pip install -r requirements.txt`
4. Copy env: `cp .env.example .env` then edit `DATABASE_URL`, `JWT_SECRET`, `AI_API_KEY`.
5. Optional: edit `config/ai.yaml` for provider/model.
6. Run dev: `uvicorn main:app --reload`

Key endpoints (all under `/api`):
- `POST /auth/register`, `POST /auth/login`, `GET /auth/me`, `POST /auth/refresh`
- `POST /ai/card/interpret-with-image` (multipart, saves uploads + stub AI if no key)
- `GET /ai/readings/my`, `GET /ai/readings/{id}`
- `POST /articles`, `GET /articles`, `GET /articles/{id}`, `POST /articles/{id}/comments`, `POST /articles/{id}/like`
- Admin (role=admin): `GET /admin/users`, `POST /admin/users/{id}/ban`, `GET/PATCH /admin/ai-config`, `GET /admin/ai/test`

Notes:
- DB: SQLite by default (`backend/db.sqlite3`).
- Uploads: saved under `backend/uploads` and served at `/uploads`.
- Rate limits: login 5/min, AI parse 20/hour per user (in-memory).
- AI calls: OpenAI-compatible; falls back to stub if `AI_API_KEY` or `ai.yaml` missing.

## Frontend (Vite + React + TS + AntD)
1. `cd frontend`
2. Install deps: `npm install` (or `pnpm install`)
3. Run dev: `npm run dev` (proxy to backend at 127.0.0.1:8000)

Pages/routes:
- `/` feed, `/articles/:id` detail + comments/like
- `/login`, `/register`
- `/parse` card interpreter (upload images + scene description)
- `/readings` saved readings list
- `/articles/new` markdown editor (react-md-editor)
- `/admin` minimal admin (users + AI config/test), visible when user.role == admin

## Seeds / roles
- New users are `role=user`. Promote admin by updating DB (`role='admin'`).

## Open TODOs / follow-ups
- Flesh out AI provider payloads for Qwen/OpenAI once key is available.
- Add refresh-token flow on frontend + unauthorized interceptors.
- Add article draft/publish toggle and pagination.
- Expand admin moderation for articles/comments and tag CRUD.
- Add tests (pytest/HTTPX + frontend lint/test).
