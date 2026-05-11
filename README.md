# Social Research MVP

社媒研究采集工作台 MVP，用于通过 `opencli` 和 Firecrawl 采集跨平台社媒、新闻与网页数据，并统一整理成研究底表。

## 功能概览

- 创建关键词、链接、账号主体和监控类采集任务。
- 使用 `opencli` 采集 X、Reddit、Instagram、Facebook、小红书、微博、B站、YouTube、Google News 等平台。
- 可选使用 Firecrawl 做全网搜索、任意网页抓取和新闻外链正文补采。
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
FIRECRAWL_API_KEY=fc-your-api-key
OPENCLI_BROWSER_CALL_LIMIT=10
```

`FIRECRAWL_API_KEY` 是可选项；不配置时，通用网页和全网补采能力会关闭，但已接入的 `opencli` 平台仍可运行。

## Firecrawl Submodule

`firecrawl/` 是 Git submodule，用于固定底层 Firecrawl 源码版本。

首次克隆本仓库后运行：

```bash
git submodule update --init --recursive
```

当前固定的 Firecrawl commit：

```text
3afe6df1f48f4485b8a018069ad8bbf54ae99cb2
```

## 分支策略

- `main`：正式稳定版本分支。
- `dev`：测试和日常开发分支。

日常修改先进入 `dev`，测试通过后再合并到 `main`。正式版本可以在 `main` 上打 tag，例如 `v0.1.0`。
