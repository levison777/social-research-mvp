# Social Research MVP

跨平台社媒研究采集工作台，支持通过关键词和目标 Link 创建采集任务，并将结果整理为可查看、筛选和导出的数据底表。

## 当前采集方式

采集默认为 API-only，仅使用：

- TikHub 结构化 API
- Apify Actor / API

不使用 OpenCLI 或浏览器登录态执行采集。`API_ONLY_COLLECTION` 默认值为 `true`。

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

## 本地运行

```bash
npm install
cp social-research-mvp.env.example .env.local
npm start
```

默认地址：[http://127.0.0.1:8787/](http://127.0.0.1:8787/)

健康检查：

```bash
curl http://127.0.0.1:8787/api/health
```

## 必要配置

在 `.env.local` 中填写真实密钥：

```bash
API_ONLY_COLLECTION=true
KEYWORD_PROVIDER_STRATEGY=api-first
APIFY_API_TOKEN=apify_api_your-token
TIKHUB_API_KEY=tikhub_your-token
```

AI 采集方案功能可选配置 OpenAI-compatible LLM：

```bash
LLM_API_KEY=your-llm-api-key
LLM_MODEL=your-model-name
LLM_BASE_URL=https://api.openai.com/v1
LLM_CHAT_ENDPOINT=/chat/completions
```

API Key 只在后端读取，不会返回给前端。`.env.local`、任务数据、运行状态和服务日志均不会进入 Git。

## 主要接口

- `GET /api/health`
- `GET /api/platforms`
- `GET /api/tasks`
- `POST /api/tasks`
- `GET /api/tasks/:id`
- `DELETE /api/tasks/:id`
- `GET /api/usage`
- `POST /api/providers/:id/test`
- `GET /api/settings`
- `POST /api/settings`
- `POST /api/export`
- `GET /api/agent/status`
- `POST /api/agent/plan`

## 数据安全

- `social-research-mvp.tasks.json` 仅保存在本地。
- `social-research-mvp.runtime.json` 仅保存本地平台运行状态。
- `social-research-mvp-server.log` 仅保存本地日志。
- 自动化验证任务可在 `POST /api/tasks` 中传入 `internalTest: true`，普通任务列表会默认隐藏这类任务。
