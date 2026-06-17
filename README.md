# Social Research MVP

社媒研究采集工作台 MVP，用于采集跨平台社媒、新闻与网页数据，并统一整理成研究底表。

## 功能概览

- 创建关键词、链接、账号主体和监控类采集任务。
- 使用 `opencli` 采集 X、Reddit、Instagram、Facebook、小红书、微博、B站、YouTube、Google News 等平台。
- 支持目标链接评论采集，并输出统一评论字段。
- 前端看板展示任务进度、平台覆盖、统一字段、样本详情和数据源能力矩阵。

## 本地运行

```bash
node social-research-mvp-server.js
```

默认服务地址：

```text
http://127.0.0.1:8787
```

健康检查：

```bash
curl http://127.0.0.1:8787/api/health
```

## 环境变量

参考 `social-research-mvp.env.example`：

```bash
PORT=8787
OPENCLI_BROWSER_CALL_LIMIT=10
BROWSER_ENGINE=opencli
CLOAKBROWSER_HEADLESS=true
CLOAKBROWSER_HUMANIZE=true
CLOAKBROWSER_GEOIP=false
# CLOAKBROWSER_PROFILE_DIR=.cloakbrowser/profiles/default
# CLOAKBROWSER_PROXY=http://user:pass@proxy:8080
FIRECRAWL_API_KEY=fc-your-api-key
FIRECRAWL_COST_PER_CALL=0
APIFY_API_TOKEN=apify_api_your-token
APIFY_COST_PER_CALL=0
APIFY_CURRENCY=USD
# Optional: Apify API v2 base
# APIFY_BASE_URL=https://api.apify.com/v2
# Optional: TikTok keyword collection via Apify actor
APIFY_TIKTOK_ACTOR=clockworks/tiktok-scraper
APIFY_TIKTOK_MAX_RESULTS=5
APIFY_TIKTOK_USE_PROXY=true
APIFY_TIKTOK_COST_PER_1000_RESULTS=1.70
# Optional: LinkedIn target-link comment collection via Apify actor
APIFY_LINKEDIN_COMMENTS_ACTOR=harvestapi/linkedin-post-comments
APIFY_LINKEDIN_COMMENTS_COST_PER_1000_RESULTS=2.00
TIKHUB_API_KEY=tikhub_your-token
TIKHUB_COST_PER_CALL=0.001
TIKHUB_MAX_COST_PER_CALL=0.01
TIKHUB_CURRENCY=USD
# Optional: Mainland China network can switch to https://api.tikhub.dev
# TIKHUB_BASE_URL=https://api.tikhub.dev
XAPI_API_KEY=sk-your-xapi-key
XAPI_COST_PER_CALL=0
XAPI_CURRENCY=USD
XAPI_DEFAULT_CU_PER_CALL=0
XAPI_COST_PER_CU=0
# Optional: XAPI account API base
# XAPI_BASE_URL=https://api.xapi.to/api
# Optional: OpenAI-compatible LLM used by /api/agent/plan
LLM_API_KEY=your-llm-api-key
LLM_MODEL=your-model-name
LLM_BASE_URL=https://api.openai.com/v1
LLM_CHAT_ENDPOINT=/chat/completions
LLM_JSON_MODE=true
LLM_COST_PER_1K_INPUT=0
LLM_COST_PER_1K_OUTPUT=0
LLM_COST_PER_CALL=0
```

`OPENCLI_BROWSER_CALL_LIMIT` 用于限制单次任务的浏览器调用次数，避免一次采集任务占用过久。

浏览器可见页面采集默认仍使用 `opencli`。如需启用 CloakBrowser 增强稳定性，先在项目目录安装可选依赖：

```bash
npm install cloakbrowser playwright-core
```

然后设置 `BROWSER_ENGINE=auto`。`auto` 会先尝试 CloakBrowser，失败或未提取到评论时回退到 opencli；`BROWSER_ENGINE=cloak` 会强制使用 CloakBrowser。当前 CloakBrowser 主要接入目标 Link 的可见评论采集链路，适用于 Google/Web、Facebook、LinkedIn、Instagram 这类需要浏览器访问页面的采集补强；API/Actor 链路仍走 TikHub、Apify、XAPI 等 provider。

API key 只在后端读取。前端通过 `/api/usage` 查看 provider 的配置状态、调用次数和预估费用，不会展示明文 key。默认已登记 `opencli`、`CloakBrowser`、`Firecrawl`、`Apify`、`TikHub`、`XAPI`。自定义接口可复制 `social-research-mvp.api-providers.example.json` 为 `social-research-mvp.api-providers.json`，或通过 `SOCIAL_RESEARCH_API_PROVIDERS` 提供 JSON 配置。

费用面板会同时展示 provider 汇总和 endpoint/actor/token 明细。TikHub 定价按请求计费，当前默认按基础阶梯 `$0.001/request` 估算，并在后端按当天请求量套用 `$0.001`、`$0.0009`、`$0.0008`、`$0.0007`、`$0.0006`、`$0.0005` 的批量阶梯。官方价格区间为 `$0.001 - $0.01/request`，部分端点可能更高，可用 `TIKHUB_MAX_COST_PER_CALL` 保留展示口径。

Apify 的通用 API 请求可用 `APIFY_COST_PER_CALL` 兜底估算；当前 TikTok actor 和 LinkedIn 评论 actor 会额外按返回结果量估算，默认 `APIFY_TIKTOK_COST_PER_1000_RESULTS=1.70`、`APIFY_LINKEDIN_COMMENTS_COST_PER_1000_RESULTS=2.00`。XAPI 如果按 CU 计价，可配置 `XAPI_DEFAULT_CU_PER_CALL` 和 `XAPI_COST_PER_CU`，否则仍按 `XAPI_COST_PER_CALL` 估算。

评论采集能力已结构化登记到平台目录：Apify actor 包括 `apify/facebook-comments-scraper`、`crawlerbros/reddit-comment-scraper`、`harvestapi/linkedin-post-comments`；Google / News / Web comments 通过 `opencli` 连接真实浏览器，并和用户共享同一个会话读取可见评论；TikHub endpoint 包括 X/Twitter、TikTok、YouTube、Instagram 的 L1 评论接口，以及 TikTok、YouTube、Instagram 的 L2/replies 接口。前端目标 Link 平台卡片和 API 费用页会展示这些 actor/endpoint，真实调用后会进入 endpoint 级用量统计。

本地开发也可以把真实 key 放到 `.env.local`；后端启动时会自动读取 `.env`、`.env.local` 和 `social-research-mvp.env.local`，这些文件不会进入 Git。前端 API 费用面板里的“测试”按钮会调用 provider 的 `healthPath`，Apify 默认使用 `/users/me`，TikHub 默认使用 `/api/v1/health/check`，XAPI 默认使用 `/auth/login/apikey` 做连接测试。

AI 采集方案 Agent 使用 `POST /api/agent/plan`。它只生成方案，不直接执行采集；返回里的 `taskPayload` 可以在用户确认后提交到现有 `/api/tasks`。`GET /api/agent/status` 可查看 LLM 是否已配置。

Codex/后端自动化验证创建采集任务时请在 `/api/tasks` body 里加入 `internalTest: true`。普通 `GET /api/tasks` 会默认隐藏这些内部测试任务；用户在前端手动测试创建的任务不要加该字段，仍会正常展示。排查内部任务时可用 `GET /api/tasks?includeInternal=1` 查看。

## 分支策略

- `main`：正式稳定版本分支。
- `dev`：测试和日常开发分支。

日常修改先进入 `dev`，测试通过后再合并到 `main`。正式版本可以在 `main` 上打 tag，例如 `v0.1.0`。
