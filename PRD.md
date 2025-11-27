

------

# **AI 卡牌大师 · 社区版 — 产品需求文档（PRD）**

作者：韬程
 版本：1.0
 最后更新：2025-11-26

------

# **一、项目概述**

**目标：**
 打造一套可在浏览器中访问、支持**多模态卡牌解析（图片 + 文本）**、**个人解析档案管理**、**社区内容分享**的智能产品。适用于 AI 卡牌大师 MVP 验证、早期拉新、社区增长。

**核心能力：**

1. 用户体系（登录、注册、个人中心）
2. 多模态卡牌解析（上传图片 + 文本 → 大模型识别 + 解释）
3. 解析档案管理（结构化存储 + 历史回顾）
4. 社区文章分享（类似 Forem 的发帖/标签/评论体系）
5. 基础后台管理（用户、文章、AI 配置）
6. 配置化 AI 大模型接入（支持通义千问 / OpenAI 兼容接口）

**技术方向：前后端分离 + Python 后端 + React 前端**

运行平台：Windows（开发）、Web 浏览器（用户端）
 部署方式：无需 Docker，可直接运行后端服务 + 前端构建产物。

------

# **二、技术架构设计**

## **2.1 总体架构**

```
[前端 React]  <—HTTP/JSON—>  [FastAPI 后端]  ——— DB (MySQL/PG/SQLite)
                                   │
                              [AI 多模态接口]
```

## **2.2 后端选型（固定）**

- **语言：Python 3.11+**
- **框架：FastAPI**
- **数据库：SQLite（开发）→ MySQL/PostgreSQL（生产）**
- **ORM：SQLAlchemy / SQLModel**
- **认证：JWT（access_token + refresh_token）**
- **AI 调用：OpenAI 兼容接口（通义千问 / Qwen）**
- **配置管理：.env + YAML（ai.yaml）**

## **2.3 前端选型（固定）**

- **React + TypeScript**
- **构建：Vite**
- **UI：Ant Design 或 MUI**
- **状态管理：React Query + Zustand / Redux Toolkit**

------

# **三、系统角色与使用场景**

## **3.1 角色**

- **访客**：浏览社区文章
- **普通用户**：解析卡牌、管理个人解析档案、发帖、评论
- **管理员**：管理用户、文章、评论、AI 配置、标签

## **3.2 使用流程总览**

1. 用户注册 → 登录
2. 进入卡牌解析页
3. 上传卡牌照片 + 输入问题描述
4. 系统调用大模型：识别卡牌 + 解释
5. 用户查看解析结果 → 存入档案
6. 用户可将解析内容发布到社区
7. 社区用户互动评论
8. 管理员运营社区 + 配置 AI 模型

------

# **四、功能模块规划（重点！）**

以下为最终整合后的完整功能模块设计。

------

# **4.1 用户与身份体系模块**

## **功能列表**

### 1. 用户注册

- 邮箱 + 密码（MVP）
- 验证：邮箱不可重复
- 自动创建个人档案页

### 2. 用户登录

- 邮箱 + 密码
- 返回：
  - access_token
  - refresh_token
  - 用户信息

### 3. 个人中心

- 基础信息编辑：
  - 昵称
  - 头像
  - 简介
- 查看我的文章（发布列表）
- 查看我的解析档案（引用 4.2）

### 4. 账号权限

- 普通用户 & 管理员
- JWT 权限校验（后端）

------

# **4.2 多模态卡牌解析模块（核心）**

> 支持上传图片 + 文本描述，系统自动识别卡牌 → 生成解析 → 存档。

## **接口：`POST /api/ai/card/interpret-with-image`**

### **请求（multipart/form-data）**

- `card_type`：卡组类型
- `scene_desc`：用户意图描述
- `image_files[]`：1~N 张卡牌照片

### **后台处理流程**

1. 校验图片格式/大小
2. 将图片传入多模态大模型（通义千问/Qwen 兼容 OpenAI）
3. Prompt 统一要求模型输出 JSON，格式为：

```json
{
  "cards": [
    { "name": "红色主牌", "code": "R01", "position": "center" }
  ],
  "analysis": "详细中文解析文本"
}
```

1. 写入解析档案表：
   - 识别到的卡牌结构（cards_json）
   - AI 解析文本（ai_response）
   - 图片路径（image_urls）
2. 返回解析结果 → 前端展示

## **前端 UI**

- 上传组件（支持手机拍照）
- 场景描述输入框
- 提交按钮（loading）
- 结果展示：
  - 卡牌识别卡片列表
  - 长文本解析
  - 操作：
    - 复制
    - 分享到社区（生成文章草稿）

------

# **4.3 解析档案模块（卡牌解读存档）**

## **功能点**

### 1. 解析列表

- 按时间倒序
- 卡牌缩略图
- 搜索（按卡牌类型 / 标题匹配）

### 2. 解析详情页

- 识别到的卡牌 JSON → 渲染为 UI 卡片
- AI 解析文本
- 用户当时的输入描述
- 图片预览
- 按钮：
  - 分享到社区
  - 编辑标签（MVP 可不做）

------

# **4.4 社区模块（文章 + 标签 + 评论）**

借鉴 Forem 结构，但轻量化。

## **功能组成**

### 1. 文章发布

- 标题
- Markdown 正文
- 标签多选
- 可从「解析档案」一键导入内容
- 状态：草稿 / 发布

### 2. 文章展示

- 列表页
  - 最新文章
  - 按标签筛选
- 详情页
  - 正文区域
  - 作者信息
  - 点赞
  - 评论列表
  - 评论发布

### 3. 标签体系

- 多标签关联
- 标签页展示所有文章

### 4. 社区交互

- 点赞
- 评论（单层）
- 收藏（MVP 可不做）

### 5. 文章来源关联

如果文章来自解析档案，存字段 `from_reading_id`。

------

# **4.5 管理后台模块（轻量）**

管理员独占功能。

### 1. 用户管理

- 用户列表
- 状态控制（封禁账户）

### 2. 文章管理

- 列表
- 删除
- 强制下架

### 3. 评论管理

- 删除评论

### 4. 标签管理

- 创建 / 编辑 / 删除标签

### 5. AI 配置管理

- 查看模型名称、base_url、temperature 等
- 修改模型参数（不显示明文 API key）

------

# **4.6 配置模块（AI + 系统配置）**

### 1. `.env`

```
AI_API_KEY=sk-xxx
DATABASE_URL=sqlite:///db.sqlite3
```

### 2. `config/ai.yaml`

```yaml
provider: qwen
base_url: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"
chat_completion_path: "/chat/completions"
model: "qwen-max-2025"
timeout_seconds: 30
default_params:
  temperature: 0.7
  top_p: 0.9
  max_tokens: 1024
```

### 3. 日志记录

- AI 调用日志（模型名、耗时、tokens）
- 异常日志
- 访问日志（按 FastAPI Middleware 实现）

------

# **五、数据模型（数据库 Schema）**

## **users**

| 字段          | 类型             | 说明 |
| ------------- | ---------------- | ---- |
| id            | int              | 主键 |
| email         | varchar          | 唯一 |
| password_hash | varchar          | 密码 |
| nickname      | varchar          | 昵称 |
| avatar_url    | varchar          | 头像 |
| role          | enum(user/admin) | 角色 |
| created_at    | datetime         |      |

## **card_readings（解析档案）**

| 字段        | 类型       | 说明           |
| ----------- | ---------- | -------------- |
| id          | int        | 主键           |
| user_id     | fk → users |                |
| card_type   | varchar    | 卡组类别       |
| scene_desc  | text       | 描述           |
| ai_response | text       | 解析文本       |
| cards_json  | json       | 识别的卡牌结构 |
| image_urls  | json       | 图片路径列表   |
| created_at  | datetime   |                |

## **articles（社区文章）**

| 字段             | 类型       |
| ---------------- | ---------- |
| id               | int        |
| author_id        | fk         |
| title            | varchar    |
| content_markdown | text       |
| content_html     | text       |
| from_reading_id  | fk（可空） |
| is_featured      | boolean    |
| created_at       | datetime   |

## **article_tags / article_tag_rel / comments**

（略，按标准多对多与评论表结构）

------

# **六、API 设计概览（后端）**

只列关键路径，具体字段交由开发扩展。

### **Auth**

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`

### **AI**

- `POST /api/ai/card/interpret-with-image`
- `GET /api/ai/readings/my`
- `GET /api/ai/readings/{id}`

### **Articles**

- `POST /api/articles`
- `GET /api/articles`
- `GET /api/articles/{id}`
- `POST /api/articles/{id}/comments`
- `POST /api/articles/{id}/like`

### **Admin**

- `GET /api/admin/users`
- `POST /api/admin/users/{id}/ban`
- `GET /api/admin/ai-config`
- `PATCH /api/admin/ai-config`

------

# **七、前端页面清单**

### **用户端**

- 登录页
- 注册页
- 首页（社区文章流）
- 文章详情页
- 发布文章页
- 卡牌解析页（上传 + 文本 + 结果）
- 解析档案列表
- 解析详情页
- 个人中心

### **管理员端**

- 用户管理
- 文章管理
- 评论管理
- 标签管理
- AI 配置

------

# **八、开发环境与运行说明（Windows + PyCharm）**

1. 创建 Python venv

2. `pip install fastapi uvicorn sqlalchemy pydantic python-multipart`

3. 启动后端

   ```
   uvicorn main:app --reload
   ```

4. 启动前端

   ```
   npm install
   npm run dev
   ```

5. 前端 `.env` 配置 API 地址：

   ```
   VITE_API_BASE_URL=http://127.0.0.1:8000
   ```

------

# **九、非功能性要求**

- 响应时间：解析接口 ≤ 4s（取决于模型）
- 安全：所有敏感接口必须 JWT 校验
- 易扩展：支持替换 AI 模型
- 国际化：未来可以开放 i18n

------

# **十、未来版本（V2 / V3 预留）**

- 多卡牌阵解析（如三宫、十字架阵）
- AI 角色人格化（你的“卡牌大师”智能体）
- 社区关注/私信系统
- 移动端小程序接入
- 付费解析 / 订阅系统

------

# **一句话总结**

这是一份 **可立即投入开发** 的完整 PRD，结合你的 AI 卡牌大师功能 + 多模态解析 + 社区体系，是最适合 MVP 推出、快速增长、可扩展的产品方案。

------

