# Social Research MVP

跨平台社媒研究采集工作台，支持关键词和目标 Link 两类任务，并将结果整理为可查看、筛选和导出的数据底表。

当前版本还包括：

- TikHub / Apify API 优先采集
- OpenCLI / Chrome Browser Bridge 浏览器采集能力
- 目标 Link 一级评论和楼中楼采集
- SQLite 任务、结果、API 用量和导出记录持久化
- 企业邮箱登录、管理员/成员权限和操作审计
- 中英文界面
- Excel 批量目标 URL 导入和结果下载

## 当前采集方式

推荐配置为 API 优先，同时保留 OpenCLI 浏览器能力：

```text
API_ONLY_COLLECTION=false
KEYWORD_PROVIDER_STRATEGY=api-first
KEYWORD_API_FALLBACK=true
BROWSER_ENGINE=opencli
```

关键词任务优先使用 TikHub / Apify。OpenCLI 用于浏览器可见内容采集和对应采集器的补充路径。若需要完全关闭浏览器采集，可将 `API_ONLY_COLLECTION` 设置为 `true`。

## 支持的平台

| 平台 | 关键词采集 | 目标 Link 采集 |
| --- | --- | --- |
| X | TikHub | TikHub 评论与回复 |
| Instagram | Apify | TikHub 评论与回复 |
| Facebook | Apify | Apify 评论与楼中楼 |
| LinkedIn | Apify | Apify 评论与楼中楼 |
| TikTok | TikHub / Apify | TikHub 评论与回复 |
| YouTube | TikHub | TikHub 评论与回复 |
| Reddit | Apify | Apify 评论线程与楼中楼 |
| Google | Apify | Apify 网页正文 |

目标 Link 的评论采集会尽可能同时获取一级评论和楼中楼回复。Google 目标 Link 为网页正文采集，不视为社媒评论线程。

## 数据底表

关键词任务：

```text
key_words, platform, content, content_to_en, search_time,
comment_time, topics, language, content_url, engagement
```

目标 Link 任务：

```text
目标link, 评论者账号, 评论内容, 发布时间（UTC+8）, 链接
```

两类底表均不包含 `sentiment_rating`。

## 运行要求

- Node.js 24.x
- TikHub 和/或 Apify API Key
- 使用 OpenCLI 时，需要安装 `opencli`、Chrome 和 Browser Bridge 扩展

OpenCLI 使用前应确认：

```bash
opencli doctor
```

Daemon、Extension 和 Connectivity 均为 `OK` 后，浏览器采集才算可用。

## 本地运行

```bash
npm ci
cp social-research-mvp.env.example .env.local
npm start
```

默认地址：[http://127.0.0.1:8787/](http://127.0.0.1:8787/)

健康检查：

```bash
curl http://127.0.0.1:8787/api/health
```

首次打开页面时，使用 `@cometsgame.com` 企业邮箱注册。第一个账号会成为管理员。完成初始化后，建议将 `AUTH_ALLOW_REGISTRATION` 设置为 `false` 并重启服务。

局域网运行时设置：

```text
HOST=0.0.0.0
PORT=8787
```

## 必要配置

在 `.env.local` 中填写真实密钥：

```bash
API_ONLY_COLLECTION=false
KEYWORD_PROVIDER_STRATEGY=api-first
KEYWORD_API_FALLBACK=true
APIFY_API_TOKEN=apify_api_your-token
TIKHUB_API_KEY=tikhub_your-token
BROWSER_ENGINE=opencli
OPENCLI_BIN=opencli
```

AI 采集方案功能可选配置 OpenAI-compatible LLM：

```bash
LLM_API_KEY=your-llm-api-key
LLM_MODEL=your-model-name
LLM_BASE_URL=https://api.openai.com/v1
LLM_CHAT_ENDPOINT=/chat/completions
```

API Key 只在后端读取，不会返回给前端。`.env.local`、SQLite 数据、任务记录、运行状态和服务日志均不会进入 Git。

## 主要接口

- `GET /api/health`
- `GET /api/auth/bootstrap`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/auth/users`
- `GET /api/auth/audit-logs`
- `GET /api/platforms`
- `GET /api/tasks`
- `POST /api/tasks`
- `GET /api/tasks/:id`
- `DELETE /api/tasks/:id`
- `POST /api/import-urls`
- `GET /api/usage`
- `POST /api/providers/:id/test`
- `GET /api/settings`
- `POST /api/settings`
- `POST /api/export`
- `GET /api/export-file`
- `GET /api/database`
- `GET /api/database/tasks`
- `GET /api/database/posts`
- `GET /api/database/rows`
- `GET /api/database/usage`
- `GET /api/database/exports`
- `GET /api/agent/status`
- `POST /api/agent/plan`

## 数据安全

- 默认数据库为 `data/social-research.sqlite3`，仅保存在本机。
- 登录密码使用 scrypt 加盐哈希，登录会话只保存令牌哈希。
- 设置和 provider 测试接口仅管理员可用。
- 数据导出、登录和账号管理操作会写入审计记录。
- 不要将 `.env.local`、SQLite 文件、日志或运行目录提交到 Git。
- 自动化验证任务可在 `POST /api/tasks` 中传入 `internalTest: true`，普通任务列表会默认隐藏这类任务。

Excel 导入当前使用 `xlsx@0.18.5`。该 npm 版本存在尚无 npm 修复版本的已知安全公告，因此只应导入可信文件，并在公开部署前替换为持续维护的解析库。
