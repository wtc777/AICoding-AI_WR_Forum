# AI_Forum 项目说明

本仓库包含一个 FastAPI 后端与 React/Vite 前端（不含 `Module/` 目录下的内容）。下方是环境要求、启动步骤与常用操作。

## 环境要求
- Python 3.11+（推荐与虚拟环境配合 `python -m venv`）
- Node.js 18+（Vite 5 需 Node 18 或更高）
- npm 9+（随 Node 版本而定）

## 仓库结构
- `backend/`：FastAPI 服务、鉴权、AI 调用、卡牌与文章接口，SQLite 默认存储在 `backend/db.sqlite3`。
- `frontend/`：React + Vite 前端，使用 Ant Design、React Query、Zustand 等。
- `config/`：卡牌定义、AI 模型配置等（如 `config/card_definitions.json`，`config/ai.yaml`）。
- 其他根目录文档：`PRD.md`、`AI_CARD_MASTER_SETUP.md` 等。

## 后端（FastAPI）
1. 进入目录并创建虚拟环境（可用随附的 `.venv` 也可新建）：
   ```bash
   cd backend
   python -m venv .venv
   .\.venv\Scripts\activate
   ```
2. 安装依赖：
   ```bash
   pip install -r requirements.txt
   ```
3. 配置环境变量：复制 `.env.example` 为 `.env`，设置：
   - `DATABASE_URL`（默认为 SQLite：`sqlite:///./backend/db.sqlite3`）
   - `JWT_SECRET`
   - `AI_API_KEY`（供 `config/ai.yaml` 中的模型调用）
4. 启动开发服务（端口自行选择，需与前端代理一致）：
   ```bash
   uvicorn main:app --reload --host 127.0.0.1 --port 8000
   ```
   或使用提供的脚本（默认 8001，请注意与前端代理端口保持一致）：`start_backend.bat`
5. 首次启动会自动运行 `init_db()` 并根据 `config/card_definitions.json` 写入卡牌定义；上传文件保存在 `backend/uploads/`。

## 前端（React + Vite）
1. 安装依赖：
   ```bash
   cd frontend
   npm install
   ```
2. 环境变量：`frontend/.env.local` 示例包含：
   - `VITE_AI_MODEL_NAME`
   - `VITE_AI_API_KEY`
3. 启动开发服务器：
   ```bash
   npm run dev
   ```
   默认运行在 `http://127.0.0.1:5174`。`vite.config.ts` 代理 `/api` 与 `/uploads` 到 `http://127.0.0.1:8000`，如后端端口不同（如使用 `start_backend.bat` 的 8001），请同步修改代理或后端启动端口。
4. 构建与预览：
   ```bash
   npm run build
   npm run preview
   ```

## 数据与配置
- 卡牌素材已改为 OSS 直链（见 `config/card_definitions.json`），无需本地静态图。
- AI 模型配置读取 `config/ai.yaml`（字段：`provider`、`base_url`、`model` 等），需要 `AI_API_KEY`。
- 默认鉴权基于 JWT，前端会将 token 注入 `Authorization: Bearer` 头。

## 常见操作
- 本地调试：先启动后端（确保端口与代理一致），再启动前端。
- 数据库：默认 SQLite；如改用其它数据库，请更新 `DATABASE_URL` 并确保驱动已安装。
- 日志/上传：运行时文件写入 `backend/uploads/`，请确保具有写权限。

## 参考脚本
- `backend/start_backend.bat`：创建 venv、安装依赖并启动 uvicorn（默认 127.0.0.1:8001）。
- `frontend/start_frontend.bat`：安装 npm 依赖并启动 `npm run dev`。

## 后续建议
- 将生产环境端口与前端代理一致化，并在部署环境中使用反向代理（如 Nginx）统一路由 `/api` 与 `/uploads`。
- 将敏感配置（JWT 密钥、AI 密钥）通过环境变量或密钥管理服务下发。
- 为主要接口和组件补充自动化测试与 CI 流程（lint、type-check、单元测试）。
