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
```

`OPENCLI_BROWSER_CALL_LIMIT` 用于限制单次任务的浏览器调用次数，避免一次采集任务占用过久。

## 分支策略

- `main`：正式稳定版本分支。
- `dev`：测试和日常开发分支。

日常修改先进入 `dev`，测试通过后再合并到 `main`。正式版本可以在 `main` 上打 tag，例如 `v0.1.0`。
