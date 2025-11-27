# Forem 项目梳理

## 基本信息
- 路径：Forem/forem-main（AGPL-3.0）
- 后端：Ruby 3.3.0 + Rails 7.0.8.4，PostgreSQL（`config/database.yml`），Redis（会话/缓存 + Sidekiq），Sidekiq 定时任务（`config/sidekiq.yml`、`config/schedule.yml`），Flipper 特性开关，Devise/Omniauth 登录，Algolia 搜索、Fastly CDN、Cloudinary/S3 上传、Datadog/Honeybadger 监控
- 前端：Preact 为主，部分 Stimulus/ERB，esbuild 打包（`esbuild.config.mjs`），Storybook，Jest/Testing Library 单元测试，Cypress E2E
- Node 20 + Yarn（`package.json`），客户端依赖集中在 app/javascript；Ruby 依赖见 Gemfile

## 目录速览
- `app/`：Rails 主体（模型、控制器、服务、政策、序列化器、后台任务、Liquid 标签、邮件等）；`app/javascript/` 为 Preact 组件、packs、Storybook 配置
- `config/`：环境/路由/初始化器、Sidekiq、feature flags（Flipper）、Fastly、i18n、计划任务（`schedule.yml`）
- `db/`：迁移、结构、种子、数据任务；`db/data` 存放数据脚本
- `spec/`：RSpec 测试；`cypress/`：E2E；`app/javascript/__tests__/`：Jest；`docs/`：性能与 i18n 相关文档；`swagger/`：OpenAPI 定义
- 其他：`.dockerdev`、`Containerfile`/`docker-compose`/`container-compose`、`.devcontainer` 支持容器化开发；`.buildkite` CI；`.husky` git hooks；`scripts/` 运维脚本；`.yarn/` 新版 Yarn 元数据

## 核心业务域（从模型/服务/worker 命名推断）
- 内容：`Article`、`Comment`、`Tag`、`Page`、`Listing`、`Podcast(Episode)`、`Billboard`（广告/运营位）、`Broadcast`、`Collection`
- 用户与社交：`User`、`Follow`、`Badge`/`BadgeAchievement`、`Credits`、`Notifications`/`NotificationSubscription`、`Reactions`、`Mentions`
- 审核与治理：`Moderation`、`AuditLog`、`Blocklist`、`BanishedUser`、`ContextNote`、`Reports`
- 商业化/支付：`Payment`/`Stripe` 集成、`Campaign`、`Organizations`
- 集成：`GithubRepo`、`Mailchimp`、`AlgoliaSearch`、`Fastly`、`Imgproxy`、`ReCaptcha`、`PushNotifications`
- AI/推荐：`app/services/ai`、`app/queries` 中 feed/推荐相关逻辑
- 后台作业：`app/workers` 下分类（articles/comments/notifications/feeds 等），通过 Sidekiq + Redis 执行，cron 由 `config/schedule.yml` 定义

## 前端概览
- 入口与打包：esbuild + `app/javascript/packs`（Rails jsbundling-rails），`app/assets/stylesheets` + PostCSS/Sass；`app/views` 中仍有 ERB/HTML 片段
- 组件与功能：`app/javascript` 下按域划分（articles、listings、modCenter、onboarding、sidebar 等），`crayons` 为 UI 设计系统；`controllers/` 下 Stimulus 控制器
- 故事与测试：Storybook 配置在 `app/javascript/.storybook`，Jest 配置 `jest.config.js`，Cypress 配置 `cypress.config.js`

## API 与文档
- `swagger/`：OpenAPI 规范（公开 API、Admin/Analytics 等）；`app/serializers` JSON API；`app/controllers/api/` 命名空间提供 API 入口
- `docs/`：性能优化（Feed/Moderation）、i18n 指南与工具（bin/locale_*）；`README_READ_ONLY_DATABASE.md` 讲解只读库架构

## 测试与质量保障
- RSpec（`spec/`）、FactoryBot/Faker；Rubocop（`.rubocop.yml`）、ERB lint；i18n-tasks；Jest/Testing Library；Cypress；husky + lint-staged
- 覆盖率工具 SimpleCov（`.simplecov`），Codecov 配置 `codecov.yml`

## 本地开发提示
- 参考 `README.md` 与开发者文档（developers.forem.com）；复制 `.env_sample` 为本地环境变量
- 可用容器方案：`docker-compose.yml` / `Containerfile`；也可按 Brewfile/dep 安装（Mac/Linux 无容器指南）
- 常用命令：`bin/setup`（Rails 初始化）、`bin/dev`/`Procfile.dev`（前后端启动）、`yarn build` 或 `yarn storybook`、`bundle exec rspec`、`yarn test`/`yarn e2e`
