#!/usr/bin/env node

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");

const PROJECT_ROOT = path.join(__dirname, "..");

loadLocalEnvFiles([
  path.join(PROJECT_ROOT, ".env"),
  path.join(PROJECT_ROOT, ".env.local"),
  path.join(PROJECT_ROOT, "social-research-mvp.env.local")
]);

const HOST = "127.0.0.1";
const PORT = Number(process.env.PORT || 8787);
const HTML_PATH = path.join(PROJECT_ROOT, "social-research-mvp.html");
const LOCAL_ENV_PATH = path.join(PROJECT_ROOT, ".env.local");
const PLATFORM_RUNTIME_STATE_PATH = path.join(PROJECT_ROOT, "social-research-mvp.runtime.json");
const TASK_STORE_PATH = path.join(PROJECT_ROOT, "social-research-mvp.tasks.json");
const API_PROVIDER_CONFIG_PATH = path.join(PROJECT_ROOT, "social-research-mvp.api-providers.json");
const API_USAGE_STATE_PATH = path.join(PROJECT_ROOT, "social-research-mvp.api-usage.json");
const CLOAKBROWSER_VISIBLE_COMMENTS_SCRIPT = path.join(PROJECT_ROOT, "services", "cloakbrowser-visible-comments.mjs");
const CLOAKBROWSER_KEYWORD_SEARCH_SCRIPT = path.join(PROJECT_ROOT, "services", "cloakbrowser-keyword-search.mjs");
const OPENCLI_TIMEOUT_MS = 45_000;
const OPENCLI_BROWSER_CALL_LIMIT = Number(process.env.OPENCLI_BROWSER_CALL_LIMIT || 10);
const MONITOR_INTERVAL_MINUTES = Math.max(1, Number(process.env.MONITOR_INTERVAL_MINUTES || 30));
const MONITOR_INTERVAL_MS = MONITOR_INTERVAL_MINUTES * 60_000;
const FIRECRAWL_TIMEOUT_MS = 35_000;
const FIRECRAWL_BASE_URL = (process.env.FIRECRAWL_BASE_URL || "https://api.firecrawl.dev/v2").replace(/\/+$/, "");
const APIFY_HEALTH_ENDPOINT = "/users/me";
const APIFY_TIKTOK_ACTOR = process.env.APIFY_TIKTOK_ACTOR || "clockworks/tiktok-scraper";
const APIFY_GOOGLE_FULL_ARTICLE_ACTOR = process.env.APIFY_GOOGLE_FULL_ARTICLE_ACTOR || "ohmydata/google-search-to-full-article";
const APIFY_LINKEDIN_POST_SEARCH_ACTOR = process.env.APIFY_LINKEDIN_POST_SEARCH_ACTOR || "harvestapi/linkedin-post-search";
const APIFY_LINKEDIN_COMMENTS_ACTOR = process.env.APIFY_LINKEDIN_COMMENTS_ACTOR || "harvestapi/linkedin-post-comments";
const APIFY_INSTAGRAM_HASHTAG_ACTOR = process.env.APIFY_INSTAGRAM_HASHTAG_ACTOR || "apidojo/instagram-hashtag-scraper";
const APIFY_FACEBOOK_POST_SEARCH_ACTOR = process.env.APIFY_FACEBOOK_POST_SEARCH_ACTOR || "powerai/facebook-post-search-scraper";
const APIFY_FACEBOOK_POSTS_ACTOR = process.env.APIFY_FACEBOOK_POSTS_ACTOR || "apify/facebook-posts-scraper";
const APIFY_FACEBOOK_COMMENTS_ACTOR = process.env.APIFY_FACEBOOK_COMMENTS_ACTOR || "apify/facebook-comments-scraper";
const APIFY_REDDIT_URL_ACTOR = process.env.APIFY_REDDIT_URL_ACTOR || "trudax/reddit-scraper-lite";
const APIFY_REDDIT_COMMENTS_ACTOR = process.env.APIFY_REDDIT_COMMENTS_ACTOR || "crawlerbros/reddit-comment-scraper";
const APIFY_X_URL_ACTOR = process.env.APIFY_X_URL_ACTOR || "apidojo/twitter-scraper-lite";
const APIFY_WEBSITE_CONTENT_CRAWLER_ACTOR = process.env.APIFY_WEBSITE_CONTENT_CRAWLER_ACTOR || "apify/website-content-crawler";
const APIFY_TIKTOK_MAX_RESULTS = Math.max(1, Math.min(20, Number(process.env.APIFY_TIKTOK_MAX_RESULTS || 5)));
const APIFY_GOOGLE_KEYWORD_MAX_RESULTS = Math.max(1, Math.min(20, Number(process.env.APIFY_GOOGLE_KEYWORD_MAX_RESULTS || 10)));
const APIFY_LINKEDIN_KEYWORD_MAX_RESULTS = Math.max(1, Math.min(20, Number(process.env.APIFY_LINKEDIN_KEYWORD_MAX_RESULTS || 5)));
const API_KEYWORD_MAX_RESULTS = Math.max(1, Math.min(20, Number(process.env.API_KEYWORD_MAX_RESULTS || 5)));
const APIFY_TIKTOK_USE_PROXY = !/^(0|false|no)$/i.test(String(process.env.APIFY_TIKTOK_USE_PROXY || "true"));
const APIFY_TIKTOK_COST_PER_1000_RESULTS = numberFromEnv("APIFY_TIKTOK_COST_PER_1000_RESULTS", 1.7);
const APIFY_LINKEDIN_COMMENTS_COST_PER_1000_RESULTS = numberFromEnv("APIFY_LINKEDIN_COMMENTS_COST_PER_1000_RESULTS", 2);
const TIKHUB_HEALTH_ENDPOINT = "/api/v1/health/check";
const TIKHUB_PRICING_TIERS = [
  { minCalls: 1, maxCalls: 1000, costPerCall: 0.001 },
  { minCalls: 1001, maxCalls: 5000, costPerCall: 0.0009 },
  { minCalls: 5001, maxCalls: 10000, costPerCall: 0.0008 },
  { minCalls: 10001, maxCalls: 20000, costPerCall: 0.0007 },
  { minCalls: 20001, maxCalls: 30000, costPerCall: 0.0006 },
  { minCalls: 30001, maxCalls: Infinity, costPerCall: 0.0005 }
];
const XAPI_BASE_URL = (process.env.XAPI_BASE_URL || "https://api.xapi.to/api").replace(/\/+$/, "");
const XAPI_HEALTH_ENDPOINT = "/auth/login/apikey";
const XAPI_DEFAULT_CU_PER_CALL = numberFromEnv("XAPI_DEFAULT_CU_PER_CALL", 0);
const XAPI_COST_PER_CU = numberFromEnv("XAPI_COST_PER_CU", 0);
const LLM_BASE_URL = (process.env.LLM_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
const LLM_CHAT_ENDPOINT = process.env.LLM_CHAT_ENDPOINT || "/chat/completions";
const LLM_MODEL = process.env.LLM_MODEL || "gpt-4o-mini";
const LLM_TIMEOUT_MS = Math.max(10_000, Number(process.env.LLM_TIMEOUT_MS || 45_000));
const LLM_JSON_MODE = !/^(0|false|no)$/i.test(String(process.env.LLM_JSON_MODE || "true"));
const LLM_TEMPERATURE = Number.isFinite(Number(process.env.LLM_TEMPERATURE)) ? Number(process.env.LLM_TEMPERATURE) : 0.2;
const AGENT_PLAN_MAX_PLATFORMS = Math.max(1, Math.min(8, Number(process.env.AGENT_PLAN_MAX_PLATFORMS || 5)));
const OPENCLI_BROWSERLESS_SITES = new Set(["google"]);
const PLATFORM_PRIORITY = ["X", "TikTok", "LinkedIn", "Facebook", "Google", "Reddit", "小红书", "微博", "YouTube", "B站", "Instagram", "Google News", "全网"];
const UNIFIED_BOARD_FIELDS = ["key_words", "platform", "content", "content_to_en", "sentiment_rating", "search_time", "comment_time", "topics", "language", "content_url", "engagement"];
const COMMENT_BOARD_FIELDS = ["目标link", "评论者账号", "评论内容", "发布时间（UTC+8）", "sentiment rating", "链接"];
const SHANGHAI_TIME_ZONE = "Asia/Shanghai";
const SHANGHAI_UTC_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const APP_SETTING_GROUPS = [
  {
    id: "dataSources",
    title: "数据源 API",
    description: "采集平台接口 key 仅保存在本机，不会返回给前端明文。",
    fields: [
      { key: "APIFY_API_TOKEN", label: "Apify API Token", secret: true, placeholder: "apify_api_..." },
      { key: "TIKHUB_API_KEY", label: "TikHub API Key", secret: true, placeholder: "TikHub bearer token" },
      { key: "XAPI_API_KEY", label: "XAPI API Key", secret: true, placeholder: "sk-..." },
      { key: "FIRECRAWL_API_KEY", label: "Firecrawl API Key", secret: true, placeholder: "fc-..." }
    ]
  },
  {
    id: "llm",
    title: "AI 模型",
    description: "用于 AI 生成采集方案和对话入口。",
    fields: [
      { key: "LLM_API_KEY", label: "LLM API Key", secret: true, placeholder: "sk-..." },
      { key: "LLM_MODEL", label: "模型名称", secret: false, placeholder: "deepseek-v4-pro" },
      { key: "LLM_BASE_URL", label: "Base URL", secret: false, placeholder: "https://api.deepseek.com" },
      { key: "LLM_CHAT_ENDPOINT", label: "Chat Endpoint", secret: false, placeholder: "/chat/completions" }
    ]
  },
  {
    id: "collection",
    title: "采集策略",
    description: "控制单次任务预算和持续监控节奏。",
    fields: [
      { key: "OPENCLI_BROWSER_CALL_LIMIT", label: "单任务浏览器调用上限", secret: false, placeholder: "10" },
      { key: "KEYWORD_PROVIDER_STRATEGY", label: "关键词 provider 策略", secret: false, placeholder: "web-first / api-first" },
      { key: "KEYWORD_API_FALLBACK", label: "关键词 API 兜底", secret: false, placeholder: "true / false" },
      { key: "BROWSER_ENGINE", label: "浏览器采集引擎", secret: false, placeholder: "opencli / auto / cloak" },
      { key: "CLOAKBROWSER_HEADLESS", label: "CloakBrowser Headless", secret: false, placeholder: "true" },
      { key: "CLOAKBROWSER_HUMANIZE", label: "CloakBrowser Humanize", secret: false, placeholder: "true" },
      { key: "CLOAKBROWSER_GEOIP", label: "CloakBrowser GeoIP", secret: false, placeholder: "false" },
      { key: "CLOAKBROWSER_PROFILE_DIR", label: "CloakBrowser 持久会话目录", secret: false, placeholder: ".cloakbrowser/profiles/default" },
      { key: "CLOAKBROWSER_PROXY", label: "CloakBrowser Proxy", secret: true, placeholder: "http://user:pass@proxy:8080" },
      { key: "MONITOR_INTERVAL_MINUTES", label: "持续监控间隔（分钟）", secret: false, placeholder: "30" }
    ]
  }
];
const APP_SETTING_KEYS = new Set(APP_SETTING_GROUPS.flatMap((group) => group.fields.map((field) => field.key)));
const SECRET_SETTING_KEYS = new Set(APP_SETTING_GROUPS.flatMap((group) => group.fields.filter((field) => field.secret).map((field) => field.key)));
const COMMENT_LINK_PLATFORMS = new Set([
  "X",
  "Reddit",
  "TikTok",
  "小红书",
  "微博",
  "YouTube",
  "B站",
  "Instagram",
  "Facebook",
  "Google",
  "LinkedIn"
]);
const COMMENT_API_CAPABILITIES = [
  {
    platforms: ["Facebook"],
    providerId: "apify",
    providerName: "Apify",
    type: "actor",
    level: "L1",
    label: "Facebook comments",
    actor: APIFY_FACEBOOK_COMMENTS_ACTOR,
    route: `apify:actor:${APIFY_FACEBOOK_COMMENTS_ACTOR}`,
    note: "Facebook 目标帖子评论 actor。"
  },
  {
    platforms: ["Google", "Google News", "全网"],
    providerId: "opencli",
    providerName: "opencli",
    type: "browser",
    level: "visible",
    label: "Google / News / Web visible comments",
    method: "BROWSER",
    endpoint: "opencli browser shared-session",
    route: "opencli:browser:visible-comments",
    note: "Google/News/Web 评论通过 opencli 连接真实浏览器，并和用户共享同一个浏览器会话读取可见评论。"
  },
  {
    platforms: ["Google", "Google News", "全网", "Facebook", "LinkedIn", "Instagram"],
    providerId: "cloakbrowser",
    providerName: "CloakBrowser",
    type: "browser",
    level: "visible",
    label: "Stealth browser visible comments",
    method: "BROWSER",
    endpoint: "CloakBrowser Playwright page",
    route: "cloakbrowser:browser:visible-comments",
    note: "可选浏览器增强层；用于目标 Link 可见评论采集，支持 humanize、proxy、geoip 和持久 profile。"
  },
  {
    platforms: ["Reddit"],
    providerId: "apify",
    providerName: "Apify",
    type: "actor",
    level: "L1/L2",
    label: "Reddit comment scraper",
    actor: APIFY_REDDIT_COMMENTS_ACTOR,
    route: `apify:actor:${APIFY_REDDIT_COMMENTS_ACTOR}`,
    note: "Reddit 帖子评论 actor。"
  },
  {
    platforms: ["LinkedIn"],
    providerId: "apify",
    providerName: "Apify",
    type: "actor",
    level: "L1",
    label: "LinkedIn post comments",
    actor: APIFY_LINKEDIN_COMMENTS_ACTOR,
    route: `apify:actor:${APIFY_LINKEDIN_COMMENTS_ACTOR}`,
    note: "LinkedIn 帖子评论 actor。"
  },
  {
    platforms: ["X"],
    providerId: "tikhub",
    providerName: "TikHub",
    type: "endpoint",
    level: "L1",
    label: "X/Twitter post comments",
    method: "GET",
    endpoint: "/api/v1/twitter/web/fetch_post_comments",
    route: "tikhub:GET:/api/v1/twitter/web/fetch_post_comments",
    note: "X/Twitter 一级评论接口。"
  },
  {
    platforms: ["TikTok"],
    providerId: "tikhub",
    providerName: "TikHub",
    type: "endpoint",
    level: "L1",
    label: "TikTok video comments",
    method: "GET",
    endpoint: "/api/v1/tiktok/app/v3/fetch_video_comments",
    route: "tikhub:GET:/api/v1/tiktok/app/v3/fetch_video_comments",
    note: "TikTok 视频一级评论接口。"
  },
  {
    platforms: ["TikTok"],
    providerId: "tikhub",
    providerName: "TikHub",
    type: "endpoint",
    level: "L2",
    label: "TikTok comment replies",
    method: "GET",
    endpoint: "/api/v1/tiktok/app/v3/fetch_video_comment_replies",
    route: "tikhub:GET:/api/v1/tiktok/app/v3/fetch_video_comment_replies",
    note: "TikTok 评论回复/楼中楼接口。"
  },
  {
    platforms: ["YouTube"],
    providerId: "tikhub",
    providerName: "TikHub",
    type: "endpoint",
    level: "L1",
    label: "YouTube video comments",
    method: "GET",
    endpoint: "/api/v1/youtube/web_v2/get_video_comments",
    route: "tikhub:GET:/api/v1/youtube/web_v2/get_video_comments",
    note: "YouTube 视频一级评论接口。"
  },
  {
    platforms: ["YouTube"],
    providerId: "tikhub",
    providerName: "TikHub",
    type: "endpoint",
    level: "L2",
    label: "YouTube comment replies",
    method: "GET",
    endpoint: "/api/v1/youtube/web_v2/get_video_comment_replies",
    route: "tikhub:GET:/api/v1/youtube/web_v2/get_video_comment_replies",
    note: "YouTube 评论回复/楼中楼接口。"
  },
  {
    platforms: ["Instagram"],
    providerId: "tikhub",
    providerName: "TikHub",
    type: "endpoint",
    level: "L1",
    label: "Instagram post comments",
    method: "GET",
    endpoint: "/api/v1/instagram/v3/get_post_comments",
    route: "tikhub:GET:/api/v1/instagram/v3/get_post_comments",
    note: "Instagram 帖子一级评论接口。"
  },
  {
    platforms: ["Instagram"],
    providerId: "tikhub",
    providerName: "TikHub",
    type: "endpoint",
    level: "L2",
    label: "Instagram comment replies",
    method: "GET",
    endpoint: "/api/v1/instagram/v3/get_comment_replies",
    route: "tikhub:GET:/api/v1/instagram/v3/get_comment_replies",
    note: "Instagram 评论回复/楼中楼接口。"
  }
];

const CLOAKBROWSER_KEYWORD_CAPABILITY_CONFIGS = [
  { platform: "X", route: "cloakbrowser:browser:x-keyword", label: "X/Twitter CloakBrowser keyword search", endpoint: "CloakBrowser X search page" },
  { platform: "Reddit", route: "cloakbrowser:browser:reddit-keyword", label: "Reddit CloakBrowser keyword search", endpoint: "CloakBrowser Reddit search page" },
  { platform: "TikTok", route: "cloakbrowser:browser:tiktok-keyword", label: "TikTok CloakBrowser keyword search", endpoint: "CloakBrowser TikTok search page" },
  { platform: "小红书", route: "cloakbrowser:browser:xiaohongshu-keyword", label: "Xiaohongshu CloakBrowser keyword search", endpoint: "CloakBrowser Xiaohongshu search page" },
  { platform: "微博", route: "cloakbrowser:browser:weibo-keyword", label: "Weibo CloakBrowser keyword search", endpoint: "CloakBrowser Weibo search page" },
  { platform: "YouTube", route: "cloakbrowser:browser:youtube-keyword", label: "YouTube CloakBrowser keyword search", endpoint: "CloakBrowser YouTube search page" },
  { platform: "B站", route: "cloakbrowser:browser:bilibili-keyword", label: "Bilibili CloakBrowser keyword search", endpoint: "CloakBrowser Bilibili search page" },
  { platform: "Instagram", route: "cloakbrowser:browser:instagram-keyword", label: "Instagram CloakBrowser keyword search", endpoint: "CloakBrowser Instagram search page" },
  { platform: "Facebook", route: "cloakbrowser:browser:facebook-keyword", label: "Facebook CloakBrowser keyword search", endpoint: "CloakBrowser Facebook search page" },
  { platform: "Google", route: "cloakbrowser:browser:google-keyword", label: "Google CloakBrowser keyword search", endpoint: "CloakBrowser Google search page" },
  { platform: "Google News", route: "cloakbrowser:browser:google-news-keyword", label: "Google News CloakBrowser keyword search", endpoint: "CloakBrowser Google News page" },
  { platform: "LinkedIn", route: "cloakbrowser:browser:linkedin-keyword", label: "LinkedIn CloakBrowser keyword search", endpoint: "CloakBrowser LinkedIn content search" }
];
const CLOAKBROWSER_KEYWORD_PLATFORMS = new Set(CLOAKBROWSER_KEYWORD_CAPABILITY_CONFIGS.map((item) => item.platform));

const KEYWORD_API_CAPABILITIES = [
  ...CLOAKBROWSER_KEYWORD_CAPABILITY_CONFIGS.map((item) => ({
    platforms: [item.platform],
    providerId: "cloakbrowser",
    providerName: "CloakBrowser",
    type: "browser",
    stage: "keywordSearch",
    label: item.label,
    method: "BROWSER",
    endpoint: item.endpoint,
    route: item.route,
    note: `${item.platform} 关键词优先走 CloakBrowser 页面采集；失败或无结果时可按策略回退 opencli / API。`
  })),
  {
    platforms: ["X"],
    providerId: "opencli",
    providerName: "opencli",
    type: "browser",
    stage: "keywordSearch",
    label: "X/Twitter web keyword search",
    method: "BROWSER",
    endpoint: "twitter/search",
    route: "opencli:twitter/search",
    note: "X/Twitter 关键词优先走本地网页/登录态采集，费用按本地采集计。"
  },
  {
    platforms: ["Reddit"],
    providerId: "opencli",
    providerName: "opencli",
    type: "browser",
    stage: "keywordSearch",
    label: "Reddit web keyword search",
    method: "BROWSER",
    endpoint: "reddit/search",
    route: "opencli:reddit/search",
    note: "Reddit 关键词优先走本地网页/公开页面采集，后续可用 reddit/read 补正文和评论。"
  },
  {
    platforms: ["TikTok"],
    providerId: "opencli",
    providerName: "opencli",
    type: "browser",
    stage: "keywordSearch",
    label: "TikTok web keyword search",
    method: "BROWSER",
    endpoint: "tiktok/search",
    route: "opencli:tiktok/search",
    note: "TikTok 关键词网页采集，费用按本地浏览器采集计，失败后可回退 Apify。"
  },
  {
    platforms: ["小红书"],
    providerId: "opencli",
    providerName: "opencli",
    type: "browser",
    stage: "keywordSearch",
    label: "Xiaohongshu web keyword search",
    method: "BROWSER",
    endpoint: "xiaohongshu/search",
    route: "opencli:xiaohongshu/search",
    note: "小红书关键词优先走本地网页/登录态采集，补采时继续使用 note/comments。"
  },
  {
    platforms: ["微博"],
    providerId: "opencli",
    providerName: "opencli",
    type: "browser",
    stage: "keywordSearch",
    label: "Weibo web keyword search",
    method: "BROWSER",
    endpoint: "weibo/search",
    route: "opencli:weibo/search",
    note: "微博关键词优先走本地网页采集，补采时继续使用 post/comments。"
  },
  {
    platforms: ["YouTube"],
    providerId: "opencli",
    providerName: "opencli",
    type: "browser",
    stage: "keywordSearch",
    label: "YouTube web keyword search",
    method: "BROWSER",
    endpoint: "youtube/search",
    route: "opencli:youtube/search",
    note: "YouTube 关键词优先走本地网页搜索，补采时继续读取 video/comments/transcript。"
  },
  {
    platforms: ["B站"],
    providerId: "opencli",
    providerName: "opencli",
    type: "browser",
    stage: "keywordSearch",
    label: "Bilibili web keyword search",
    method: "BROWSER",
    endpoint: "bilibili/search",
    route: "opencli:bilibili/search",
    note: "B站关键词优先走本地网页采集，补采时继续读取评论和字幕。"
  },
  {
    platforms: ["Instagram"],
    providerId: "opencli",
    providerName: "opencli",
    type: "browser",
    stage: "keywordSearch",
    label: "Instagram web keyword search",
    method: "BROWSER",
    endpoint: "instagram/search",
    route: "opencli:instagram/search",
    note: "Instagram 关键词优先走本地网页/登录态搜索，失败或需要 hashtag 深采时可回退 Apify。"
  },
  {
    platforms: ["Facebook"],
    providerId: "opencli",
    providerName: "opencli",
    type: "browser",
    stage: "keywordSearch",
    label: "Facebook web keyword search",
    method: "BROWSER",
    endpoint: "facebook/search",
    route: "opencli:facebook/search",
    note: "Facebook 关键词优先走本地网页/登录态搜索，失败或需要 URL 补数时可回退 Apify。"
  },
  {
    platforms: ["Google"],
    providerId: "opencli",
    providerName: "opencli",
    type: "browser",
    stage: "keywordSearch",
    label: "Google web keyword search",
    method: "BROWSER",
    endpoint: "google/search",
    route: "opencli:google/search",
    note: "Google 关键词网页搜索，优先避免调用付费文章 actor。"
  },
  {
    platforms: ["Google News"],
    providerId: "opencli",
    providerName: "opencli",
    type: "browser",
    stage: "keywordSearch",
    label: "Google News web keyword search",
    method: "BROWSER",
    endpoint: "google/news",
    route: "opencli:google/news",
    note: "Google News 关键词优先走本地网页新闻搜索；需要正文时再用网页正文补采能力。"
  },
  {
    platforms: ["Google", "Google News", "全网"],
    providerId: "apify",
    providerName: "Apify",
    type: "actor",
    stage: "keyword+article",
    label: "Google Search / Google News / full article",
    actor: APIFY_GOOGLE_FULL_ARTICLE_ACTOR,
    route: `apify:actor:${APIFY_GOOGLE_FULL_ARTICLE_ACTOR}`,
    note: "Google Search、Google News 关键词检索，并补采文章全文。"
  },
  {
    platforms: ["Google", "Google News", "全网"],
    providerId: "apify",
    providerName: "Apify",
    type: "actor",
    stage: "urlEnrich",
    label: "Google/Web URL enrichment",
    actor: APIFY_WEBSITE_CONTENT_CRAWLER_ACTOR,
    route: `apify:actor:${APIFY_WEBSITE_CONTENT_CRAWLER_ACTOR}`,
    note: "对 Google/Web URL 做网页正文补数。"
  },
  {
    platforms: ["LinkedIn"],
    providerId: "apify",
    providerName: "Apify",
    type: "actor",
    stage: "keywordSearch",
    label: "LinkedIn keyword post search",
    actor: APIFY_LINKEDIN_POST_SEARCH_ACTOR,
    route: `apify:actor:${APIFY_LINKEDIN_POST_SEARCH_ACTOR}`,
    note: "LinkedIn 关键词帖子搜索 actor；当前 LinkedIn 提交仍默认仅开放目标 Link 评论模式。"
  },
  {
    platforms: ["Instagram"],
    providerId: "apify",
    providerName: "Apify",
    type: "actor",
    stage: "keywordSearch",
    label: "Instagram keyword / hashtag search",
    actor: APIFY_INSTAGRAM_HASHTAG_ACTOR,
    route: `apify:actor:${APIFY_INSTAGRAM_HASHTAG_ACTOR}`,
    note: "Instagram 关键词/Hashtag 搜索 actor。"
  },
  {
    platforms: ["Facebook"],
    providerId: "apify",
    providerName: "Apify",
    type: "actor",
    stage: "keywordSearch",
    label: "Facebook keyword post search",
    actor: APIFY_FACEBOOK_POST_SEARCH_ACTOR,
    route: `apify:actor:${APIFY_FACEBOOK_POST_SEARCH_ACTOR}`,
    note: "Facebook 关键词帖子搜索 actor。"
  },
  {
    platforms: ["Facebook"],
    providerId: "apify",
    providerName: "Apify",
    type: "actor",
    stage: "urlEnrich",
    label: "Facebook URL / page enrichment",
    actor: APIFY_FACEBOOK_POSTS_ACTOR,
    route: `apify:actor:${APIFY_FACEBOOK_POSTS_ACTOR}`,
    note: "Facebook URL 或页面补数 actor。"
  },
  {
    platforms: ["X"],
    providerId: "apify",
    providerName: "Apify",
    type: "actor",
    stage: "urlEnrich",
    label: "X/Twitter URL enrichment",
    actor: APIFY_X_URL_ACTOR,
    route: `apify:actor:${APIFY_X_URL_ACTOR}`,
    note: "X/Twitter URL 补数 actor。"
  },
  {
    platforms: ["Reddit"],
    providerId: "apify",
    providerName: "Apify",
    type: "actor",
    stage: "urlEnrich",
    label: "Reddit URL enrichment",
    actor: APIFY_REDDIT_URL_ACTOR,
    route: `apify:actor:${APIFY_REDDIT_URL_ACTOR}`,
    note: "Reddit URL 补数 actor。"
  },
  {
    platforms: ["X"],
    providerId: "tikhub",
    providerName: "TikHub",
    type: "endpoint",
    stage: "keywordSearch",
    label: "X/Twitter keyword search",
    method: "GET",
    endpoint: "/api/v1/twitter/web/fetch_search_timeline",
    route: "tikhub:GET:/api/v1/twitter/web/fetch_search_timeline",
    note: "X/Twitter 关键词搜索接口。"
  },
  {
    platforms: ["X"],
    providerId: "tikhub",
    providerName: "TikHub",
    type: "endpoint",
    stage: "detailEnrich",
    label: "X/Twitter tweet detail / engagement",
    method: "GET",
    endpoint: "/api/v1/twitter/web/fetch_tweet_detail",
    route: "tikhub:GET:/api/v1/twitter/web/fetch_tweet_detail",
    note: "X/Twitter 单条推文详情与 engagement 补数接口。"
  },
  {
    platforms: ["Reddit"],
    providerId: "tikhub",
    providerName: "TikHub",
    type: "endpoint",
    stage: "keywordSearch",
    label: "Reddit keyword search",
    method: "GET",
    endpoint: "/api/v1/reddit/app/fetch_dynamic_search",
    route: "tikhub:GET:/api/v1/reddit/app/fetch_dynamic_search",
    note: "Reddit 关键词搜索接口。"
  },
  {
    platforms: ["TikTok"],
    providerId: "tikhub",
    providerName: "TikHub",
    type: "endpoint",
    stage: "keywordSearch",
    label: "TikTok keyword search",
    method: "GET",
    endpoint: "/api/v1/tiktok/app/v3/fetch_general_search_result",
    route: "tikhub:GET:/api/v1/tiktok/app/v3/fetch_general_search_result",
    note: "TikTok 综合关键词搜索接口。"
  },
  {
    platforms: ["TikTok"],
    providerId: "tikhub",
    providerName: "TikHub",
    type: "endpoint",
    stage: "detailEnrich",
    label: "TikTok video enrichment",
    method: "GET",
    endpoint: "/api/v1/tiktok/app/v3/fetch_one_video_v2",
    route: "tikhub:GET:/api/v1/tiktok/app/v3/fetch_one_video_v2",
    note: "TikTok 单视频详情补数接口。"
  },
  {
    platforms: ["YouTube"],
    providerId: "tikhub",
    providerName: "TikHub",
    type: "endpoint",
    stage: "keywordSearch",
    label: "YouTube keyword search",
    method: "GET",
    endpoint: "/api/v1/youtube/web_v2/get_general_search_v2",
    route: "tikhub:GET:/api/v1/youtube/web_v2/get_general_search_v2",
    note: "YouTube 关键词搜索接口。"
  },
  {
    platforms: ["YouTube"],
    providerId: "tikhub",
    providerName: "TikHub",
    type: "endpoint",
    stage: "detailEnrich",
    label: "YouTube video detail enrichment",
    method: "GET",
    endpoint: "/api/v1/youtube/web_v2/get_video_info",
    route: "tikhub:GET:/api/v1/youtube/web_v2/get_video_info",
    note: "YouTube 视频详情补数接口。"
  }
];
const COMMENT_CACHE_DIR = path.join(process.env.HOME || "/Users/jeff", "Desktop", "codex");
const EXPORT_DIR = path.join(os.homedir(), "Desktop");
const platformRuntimeState = loadPlatformRuntimeState();

const tasks = loadPersistedTasks();
const monitorTimers = new Map();
const opencliVersion = detectOpencliVersion();
let cloakBrowserAvailabilityCache = null;
let cloakBrowserAvailabilityCheckedAt = 0;
let apiProviderRegistry = loadApiProviderRegistry();
const apiUsageState = loadApiUsageState();

function createRuntime() {
  return {
    HOST,
    PORT,
    HTML_PATH,
    applyCors,
    sendJson,
    sendHtml,
    readJsonBody,
    getHealthPayload,
    getPlatformList,
    getAppSettings,
    updateAppSettings,
    getApiUsageReport,
    testApiProvider,
    getAgentStatus,
    generateAgentCollectionPlan,
    generateAgentChatReply,
    generatePageAnalysis,
    getTaskList,
    getTaskById,
    createTaskFromBody,
    deleteTaskById,
    exportRowsFromBody,
    collectors: {
      x: {
        collectXKeywordSearch,
        enrichXKeywordPosts,
        collectXKeyword,
        collectXLink,
        collectXLinkComments,
        collectXAccount,
        collectXThreadComments
      },
      reddit: {
        collectRedditKeywordSearch,
        enrichRedditKeywordPosts,
        collectRedditKeyword,
        collectRedditLink,
        collectRedditAccount
      },
      youtube: {
        collectYouTubeKeywordSearch,
        enrichYouTubeKeywordPosts,
        collectYouTubeLink,
        collectYouTubeAccount
      },
      browser: {
        collectBrowserVisibleComments,
        collectCloakBrowserVisibleComments,
        opencliBrowserText,
        browserCommentExtractionScript
      }
    },
    models: {
      normalizeTaskInput,
      summarizeTask,
      rowHeadersForMode,
      buildRowsForTask,
      normalizePost,
      commentPostFromRecord
    }
  };
}

module.exports = { createRuntime };

function loadLocalEnvFiles(filePaths) {
  for (const filePath of filePaths) {
    try {
      if (!fs.existsSync(filePath)) continue;
      const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
      for (const line of lines) {
        const parsed = parseEnvLine(line);
        if (!parsed || process.env[parsed.key] !== undefined) continue;
        process.env[parsed.key] = parsed.value;
      }
    } catch (_error) {
      // Local env files are optional; startup should continue if one is malformed.
    }
  }
}

function parseEnvLine(line) {
  const trimmed = String(line || "").trim();
  if (!trimmed || trimmed.startsWith("#")) return null;
  const equalsIndex = trimmed.indexOf("=");
  if (equalsIndex <= 0) return null;
  const key = trimmed.slice(0, equalsIndex).trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) return null;
  let value = trimmed.slice(equalsIndex + 1).trim();
  const quote = value[0];
  if ((quote === "\"" || quote === "'") && value.endsWith(quote)) {
    value = value.slice(1, -1);
  }
  return { key, value };
}

function detectOpencliVersion() {
  const result = spawnSync("opencli", ["--version"], {
    encoding: "utf8",
    timeout: 10_000
  });
  if (result.status !== 0) {
    return "";
  }
  return (result.stdout || "").trim();
}

function browserEnginePreference() {
  const value = String(process.env.BROWSER_ENGINE || "opencli").trim().toLowerCase();
  if (["opencli", "auto", "cloak", "cloakbrowser"].includes(value)) {
    return value === "cloakbrowser" ? "cloak" : value;
  }
  return "opencli";
}

function keywordProviderStrategy() {
  const value = String(process.env.KEYWORD_PROVIDER_STRATEGY || "api-first").trim().toLowerCase();
  if (["web-first", "api-first"].includes(value)) {
    return value;
  }
  return "api-first";
}

function keywordWebFirstEnabled() {
  return keywordProviderStrategy() === "web-first";
}

function keywordApiFallbackEnabled() {
  return envFlag("KEYWORD_API_FALLBACK", true);
}

function shouldTryCloakBrowser() {
  return ["auto", "cloak"].includes(browserEnginePreference());
}

function envFlag(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === null || raw === "") {
    return fallback;
  }
  return !/^(0|false|no|off)$/i.test(String(raw).trim());
}

function resolveProjectPath(value) {
  const text = String(value || "").trim();
  if (!text) {
    return "";
  }
  return path.isAbsolute(text) ? text : path.join(PROJECT_ROOT, text);
}

function cloakBrowserOptions() {
  return {
    headless: envFlag("CLOAKBROWSER_HEADLESS", true),
    humanize: envFlag("CLOAKBROWSER_HUMANIZE", true),
    geoip: envFlag("CLOAKBROWSER_GEOIP", false),
    proxy: String(process.env.CLOAKBROWSER_PROXY || "").trim(),
    userDataDir: resolveProjectPath(process.env.CLOAKBROWSER_PROFILE_DIR || ""),
    humanPreset: String(process.env.CLOAKBROWSER_HUMAN_PRESET || "careful").trim(),
    timezone: String(process.env.CLOAKBROWSER_TIMEZONE || SHANGHAI_TIME_ZONE).trim(),
    locale: String(process.env.CLOAKBROWSER_LOCALE || "zh-CN").trim(),
    fingerprint: String(process.env.CLOAKBROWSER_FINGERPRINT || "").trim()
  };
}

function detectCloakBrowserAvailability({ refresh = false } = {}) {
  const now = Date.now();
  if (!refresh && cloakBrowserAvailabilityCache && now - cloakBrowserAvailabilityCheckedAt < 30_000) {
    return cloakBrowserAvailabilityCache;
  }

  const result = spawnSync(process.execPath, [
    "--input-type=module",
    "-e",
    "import('cloakbrowser').then(() => console.log('available')).catch((error) => { console.error(error?.message || error); process.exit(1); })"
  ], {
    cwd: PROJECT_ROOT,
    encoding: "utf8",
    timeout: 8_000
  });

  cloakBrowserAvailabilityCheckedAt = now;
  const rawError = (result.stderr || result.stdout || "cloakbrowser package not installed").trim();
  cloakBrowserAvailabilityCache = {
    available: result.status === 0,
    error: result.status === 0 ? "" : /Cannot find package 'cloakbrowser'/.test(rawError) ? "未安装 cloakbrowser 包" : trimText(rawError, 220)
  };
  return cloakBrowserAvailabilityCache;
}

function activeBrowserEngineStatus() {
  const preference = browserEnginePreference();
  const cloak = detectCloakBrowserAvailability();
  return {
    preference,
    active: preference === "cloak"
      ? (cloak.available ? "cloakbrowser" : "cloakbrowser-unavailable")
      : preference === "auto"
        ? (cloak.available ? "cloakbrowser-with-opencli-fallback" : "opencli")
        : "opencli",
    fallback: preference === "auto" ? "opencli" : "",
    cloakbrowserAvailable: cloak.available,
    cloakbrowserError: cloak.error || ""
  };
}

function applyCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload, null, 2));
}

function sendHtml(res, filePath) {
  const html = fs.readFileSync(filePath, "utf8");
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(html);
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString("utf8").trim();
  return text ? JSON.parse(text) : {};
}

function getHealthPayload() {
  const cloak = detectCloakBrowserAvailability();
  const browserStatus = activeBrowserEngineStatus();
  const cloakOptions = cloakBrowserOptions();
  return {
    ok: true,
    server: { host: HOST, port: PORT, now: new Date().toISOString(), monitorIntervalMinutes: MONITOR_INTERVAL_MINUTES },
    browserEngine: browserStatus,
    collectionStrategy: {
      keywordProviderStrategy: keywordProviderStrategy(),
      keywordApiFallback: keywordApiFallbackEnabled()
    },
    providers: {
      opencli: {
        available: Boolean(opencliVersion),
        version: opencliVersion || null,
        browserCallLimitPerTask: OPENCLI_BROWSER_CALL_LIMIT
      },
      cloakbrowser: {
        available: cloak.available,
        enabled: shouldTryCloakBrowser() && cloak.available,
        preference: browserEnginePreference(),
        error: cloak.error || null,
        headless: cloakOptions.headless,
        humanize: cloakOptions.humanize,
        geoip: cloakOptions.geoip,
        persistentProfile: Boolean(cloakOptions.userDataDir),
        proxyConfigured: Boolean(cloakOptions.proxy)
      },
      firecrawl: {
        configured: Boolean(process.env.FIRECRAWL_API_KEY),
        baseUrl: FIRECRAWL_BASE_URL
      }
    },
    apiProviders: getApiProviderPublicList(),
    tasks: tasks.size
  };
}

function getPlatformList({ refresh = false } = {}) {
  if (refresh) {
    resetTransientPlatformRuntimeState();
  }
  return getPlatformCatalog({ firecrawlAvailable: Boolean(process.env.FIRECRAWL_API_KEY) });
}

function getAppSettings() {
  return {
    envPath: LOCAL_ENV_PATH,
    updatedAt: new Date().toISOString(),
    groups: APP_SETTING_GROUPS.map((group) => ({
      id: group.id,
      title: group.title,
      description: group.description,
      fields: group.fields.map(publicSettingField)
    }))
  };
}

function publicSettingField(field) {
  const value = String(process.env[field.key] || "");
  return {
    key: field.key,
    label: field.label,
    secret: Boolean(field.secret),
    placeholder: field.placeholder || "",
    configured: Boolean(value),
    value: field.secret ? "" : value,
    restartRequired: isRestartRequiredSetting(field.key),
    note: field.note || settingFieldNote(field.key)
  };
}

function updateAppSettings(body = {}) {
  const values = body && typeof body.values === "object" && body.values ? body.values : {};
  const clear = Array.isArray(body.clear) ? body.clear : [];
  const invalidKeys = [
    ...Object.keys(values),
    ...clear
  ].filter((key) => !APP_SETTING_KEYS.has(String(key || "").trim()));

  if (invalidKeys.length) {
    const error = new Error(`不支持的配置项：${uniqueStrings(invalidKeys).join("、")}`);
    error.statusCode = 400;
    throw error;
  }

  const normalizedValues = {};
  const clearKeys = new Set(clear.map((key) => String(key || "").trim()).filter(Boolean));

  for (const [rawKey, rawValue] of Object.entries(values)) {
    const key = String(rawKey || "").trim();
    if (!APP_SETTING_KEYS.has(key) || clearKeys.has(key)) continue;
    const value = sanitizeSettingValue(rawValue);
    if (SECRET_SETTING_KEYS.has(key) && !value) continue;
    if (!SECRET_SETTING_KEYS.has(key) && !value) {
      clearKeys.add(key);
      continue;
    }
    normalizedValues[key] = value;
  }

  if (!Object.keys(normalizedValues).length && !clearKeys.size) {
    return {
      ...getAppSettings(),
      updatedKeys: [],
      clearedKeys: [],
      restartRequiredKeys: []
    };
  }

  const result = writeLocalEnvValues(normalizedValues, Array.from(clearKeys));
  apiProviderRegistry = loadApiProviderRegistry();

  return {
    ...getAppSettings(),
    updatedKeys: result.updatedKeys,
    clearedKeys: result.clearedKeys,
    restartRequiredKeys: result.updatedKeys.concat(result.clearedKeys).filter(isRestartRequiredSetting)
  };
}

function sanitizeSettingValue(value) {
  return String(value ?? "").replace(/\r?\n/g, "").trim();
}

function isRestartRequiredSetting(key) {
  return new Set([
    "LLM_MODEL",
    "LLM_BASE_URL",
    "LLM_CHAT_ENDPOINT",
    "OPENCLI_BROWSER_CALL_LIMIT",
    "MONITOR_INTERVAL_MINUTES"
  ]).has(key);
}

function settingFieldNote(key) {
  if (SECRET_SETTING_KEYS.has(key)) {
    return "留空保存时不会覆盖已有 key。";
  }
  if (isRestartRequiredSetting(key)) {
    return "保存后重启本地后端生效。";
  }
  return "";
}

function writeLocalEnvValues(values = {}, clearKeys = []) {
  const clearSet = new Set(clearKeys.map((key) => String(key || "").trim()).filter((key) => APP_SETTING_KEYS.has(key)));
  const valueEntries = Object.entries(values)
    .map(([key, value]) => [String(key || "").trim(), sanitizeSettingValue(value)])
    .filter(([key]) => APP_SETTING_KEYS.has(key));
  const valueMap = new Map(valueEntries);
  const seen = new Set();
  const updatedKeys = [];
  const clearedKeys = [];
  const originalLines = readLocalEnvLines();
  const nextLines = [];

  for (const line of originalLines) {
    const parsed = parseEnvLine(line);
    if (!parsed || !APP_SETTING_KEYS.has(parsed.key)) {
      nextLines.push(line);
      continue;
    }

    seen.add(parsed.key);
    if (clearSet.has(parsed.key)) {
      delete process.env[parsed.key];
      clearedKeys.push(parsed.key);
      continue;
    }
    if (valueMap.has(parsed.key)) {
      const value = valueMap.get(parsed.key);
      process.env[parsed.key] = value;
      nextLines.push(`${parsed.key}=${formatEnvValue(value)}`);
      updatedKeys.push(parsed.key);
      continue;
    }
    nextLines.push(line);
  }

  const additions = [];
  for (const [key, value] of valueEntries) {
    if (seen.has(key) || clearSet.has(key)) continue;
    process.env[key] = value;
    additions.push(`${key}=${formatEnvValue(value)}`);
    updatedKeys.push(key);
  }

  if (additions.length) {
    if (nextLines.length && nextLines[nextLines.length - 1] !== "") {
      nextLines.push("");
    }
    nextLines.push(...additions);
  }

  for (const key of clearSet) {
    if (!seen.has(key)) {
      delete process.env[key];
      clearedKeys.push(key);
    }
  }

  fs.writeFileSync(LOCAL_ENV_PATH, `${trimTrailingEmptyLines(nextLines).join("\n")}\n`, { encoding: "utf8", mode: 0o600 });

  return {
    updatedKeys: uniqueStrings(updatedKeys),
    clearedKeys: uniqueStrings(clearedKeys)
  };
}

function readLocalEnvLines() {
  try {
    if (!fs.existsSync(LOCAL_ENV_PATH)) return [];
    return fs.readFileSync(LOCAL_ENV_PATH, "utf8").split(/\r?\n/);
  } catch (_error) {
    return [];
  }
}

function formatEnvValue(value) {
  const text = String(value ?? "");
  if (/^[A-Za-z0-9_@%+=:,./-]*$/.test(text)) {
    return text;
  }
  return JSON.stringify(text);
}

function trimTrailingEmptyLines(lines) {
  const next = [...lines];
  while (next.length && next[next.length - 1] === "") {
    next.pop();
  }
  return next;
}

function getTaskList({ includeInternal = false } = {}) {
  return Array.from(tasks.values())
    .filter((task) => includeInternal || !isInternalTestTask(task))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .map(summarizeTask);
}

function getTaskById(taskId) {
  return tasks.get(taskId) || null;
}

function createTaskFromBody(body = {}) {
  const input = normalizeTaskInput(body);
  const firecrawlAvailable = Boolean(input.firecrawlApiKey || process.env.FIRECRAWL_API_KEY);
  const catalog = getPlatformCatalog({ firecrawlAvailable });
  const index = new Map(catalog.map((platform) => [platform.platform, platform]));
  const runnable = input.platforms.filter((platform) => {
    const entry = index.get(platform);
    return entry && entry.enabled && entry.supportedModes.includes(input.mode);
  });
  if (!runnable.length) {
    const error = new Error("所选平台当前都不可运行，请减少平台或补充 Firecrawl key / 登录态支持。");
    error.statusCode = 400;
    throw error;
  }
  const task = createTask(input);
  runTaskLoop(task, input);
  return task;
}

function deleteTaskById(taskId) {
  const task = tasks.get(taskId);
  if (!task) {
    return null;
  }
  clearMonitorTimer(taskId);
  tasks.delete(taskId);
  persistTasks();
  return {
    id: taskId,
    deleted: true,
    title: task.title,
    rowCount: task.result?.rows?.length || 0,
    postCount: task.result?.posts?.length || 0
  };
}

function exportRowsFromBody(body = {}) {
  const exportPayload = buildExportPayload(body);
  if (!exportPayload.rows.length) {
    const error = new Error("没有可导出的数据行。");
    error.statusCode = 400;
    throw error;
  }
  return exportRowsToDesktop(exportPayload);
}

function parseTaskTimeWindow(input = {}) {
  const rawRange = String(input.timeRange || "").trim();
  let startDate = normalizeDateText(input.timeStart);
  let endDate = normalizeDateText(input.timeEnd);
  let inferredLabel = rawRange;

  if (!startDate || !endDate) {
    const explicitRange = rawRange.match(/(\d{4}[-/]\d{1,2}[-/]\d{1,2})\s*(?:至|到|~|--|—|->|to)\s*(\d{4}[-/]\d{1,2}[-/]\d{1,2})/i);
    if (explicitRange) {
      startDate = startDate || normalizeDateText(explicitRange[1]);
      endDate = endDate || normalizeDateText(explicitRange[2]);
      inferredLabel = `${startDate} 至 ${endDate}`;
    }
  }

  if ((!startDate || !endDate) && rawRange) {
    const today = shanghaiDateText();
    if (/24\s*(小时|h|hour)/i.test(rawRange)) {
      startDate = addDaysToDateText(today, -1);
      endDate = today;
    } else if (/7\s*(天|d|day)/i.test(rawRange)) {
      startDate = addDaysToDateText(today, -6);
      endDate = today;
    } else if (/30\s*(天|d|day)/i.test(rawRange)) {
      startDate = addDaysToDateText(today, -29);
      endDate = today;
    }
  }

  if (!startDate || !endDate) {
    return {
      label: inferredLabel,
      startDate: "",
      endDate: "",
      startAt: "",
      endAt: "",
      startMs: 0,
      endMs: 0,
      hasWindow: false
    };
  }

  if (startDate > endDate) {
    [startDate, endDate] = [endDate, startDate];
  }

  const startMs = dateTextToShanghaiUtcMs(startDate, "start");
  const endMs = dateTextToShanghaiUtcMs(endDate, "end");
  return {
    label: inferredLabel || `${startDate} 至 ${endDate}`,
    startDate,
    endDate,
    startAt: new Date(startMs).toISOString(),
    endAt: new Date(endMs).toISOString(),
    startMs,
    endMs,
    hasWindow: true
  };
}

function normalizeTaskInput(body) {
  const mode = normalizeMode(body.mode);
  const targetLinks = normalizeStringArray(body.targetLinks || body.links || body.urls)
    .filter(looksLikeUrl);
  const subject = String(body.subject || body.taskName || (mode === "link" ? targetLinks[0] || "" : "")).trim();
  const platforms = Array.isArray(body.platforms)
    ? Array.from(new Set(body.platforms.map(String).filter(Boolean)))
    : [];
  const timeRange = String(body.timeRange || "最近 7 天").trim() || "最近 7 天";
  const timeWindow = parseTaskTimeWindow({
    timeRange,
    timeStart: body.timeStart,
    timeEnd: body.timeEnd
  });

  return {
    mode,
    subject,
    targetLinks: uniqueStrings(targetLinks),
    platforms,
    internalTest: body.internalTest === true || body.internalTest === "true" || body.visibility === "internal",
    monitorEnabled: body.monitorEnabled === true || body.monitorEnabled === "true",
    timeRange: timeWindow.label || timeRange,
    timeStart: timeWindow.startDate,
    timeEnd: timeWindow.endDate,
    timeWindow,
    depth: String(body.depth || "标准采集"),
    commentPolicy: String(body.commentPolicy || "采集热门评论"),
    schemaPrompt: String(body.schemaPrompt || ""),
    agentPlan: body.agentPlan && typeof body.agentPlan === "object" ? body.agentPlan : null,
    firecrawlApiKey: String(body.firecrawlApiKey || "").trim()
  };
}

function normalizeMode(mode) {
  return ["keyword", "link", "account", "monitor"].includes(mode) ? mode : "keyword";
}

function rowHeadersForMode(mode) {
  return mode === "link" ? [...COMMENT_BOARD_FIELDS] : [...UNIFIED_BOARD_FIELDS];
}

function rowHeadersForInput(input) {
  return rowHeadersForMode(input.mode);
}

function buildTaskSubtitle(input) {
  const parts = [
    modeLabel(input.mode),
    (input.platforms || []).join("、") || "未选择平台",
    input.timeWindow?.label || input.timeRange
  ];
  if (input.monitorEnabled) {
    parts.push(`持续监控 · 每 ${MONITOR_INTERVAL_MINUTES} 分钟`);
  }
  return parts.join(" · ");
}

function clearMonitorTimer(taskId) {
  const timer = monitorTimers.get(taskId);
  if (!timer) return;
  clearTimeout(timer);
  monitorTimers.delete(taskId);
}

function createTask(input) {
  const now = new Date().toISOString();
  const id = `task_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const task = {
    id,
    title: input.subject || "未命名研究任务",
    mode: input.mode,
    internalTest: Boolean(input.internalTest),
    visibility: input.internalTest ? "internal" : "user",
    monitorEnabled: Boolean(input.monitorEnabled),
    timeRange: input.timeWindow?.label || input.timeRange,
    timeStart: input.timeWindow?.startDate || input.timeStart || "",
    timeEnd: input.timeWindow?.endDate || input.timeEnd || "",
    subtitle: buildTaskSubtitle(input),
    route: "",
    status: input.monitorEnabled ? "监控中" : "运行中",
    tone: "blue",
    progress: 4,
    runCount: 0,
    nextRunAt: "",
    lastRunCompletedAt: "",
    resultVersion: 0,
    createdAt: now,
    updatedAt: now,
    logs: [],
    warnings: [],
    errors: [],
    providers: [],
    plan: null,
    result: {
      posts: [],
      rows: [],
      rowHeaders: rowHeadersForInput(input),
      raw: [],
      emptyReason: "",
      stats: {
        platformsRequested: input.platforms.length,
        platformsCompleted: 0,
        opencliCalls: 0,
        opencliBrowserCalls: 0,
        opencliBrowserCallLimit: OPENCLI_BROWSER_CALL_LIMIT,
        cloakBrowserCalls: 0,
        browserEngine: browserEnginePreference(),
        firecrawlCalls: 0,
        apiUsage: {}
      }
    }
  };
  tasks.set(id, task);
  logTask(task, "任务已创建，等待执行。");
  return task;
}

function summarizeTask(task) {
  return {
    id: task.id,
    title: task.title,
    internalTest: Boolean(task.internalTest),
    visibility: task.visibility || (task.internalTest ? "internal" : "user"),
    monitorEnabled: Boolean(task.monitorEnabled),
    subtitle: task.subtitle,
    route: task.route,
    status: task.status,
    tone: task.tone,
    progress: task.progress,
    runCount: task.runCount || 0,
    nextRunAt: task.nextRunAt || "",
    lastRunCompletedAt: task.lastRunCompletedAt || "",
    resultVersion: task.resultVersion || 0,
    warningCount: task.warnings.length,
    errorCount: task.errors.length,
    warningSummary: task.warnings[0] || "",
    errorSummary: task.errors[0] || "",
    rowCount: task.result?.rows?.length || 0,
    postCount: task.result?.posts?.length || 0,
    emptyReason: task.result?.emptyReason || "",
    timeRange: task.timeRange || "",
    timeStart: task.timeStart || "",
    timeEnd: task.timeEnd || "",
    createdAt: task.createdAt,
    updatedAt: task.updatedAt
  };
}

function isInternalTestTask(task) {
  if (!task) {
    return false;
  }
  return task.internalTest === true || task.visibility === "internal";
}

function updateTask(task, patch) {
  Object.assign(task, patch);
  task.updatedAt = new Date().toISOString();
  persistTasks();
}

function logTask(task, message) {
  task.logs.push({ at: new Date().toISOString(), message });
  if (task.logs.length > 80) {
    task.logs.shift();
  }
  task.updatedAt = new Date().toISOString();
  persistTasks();
}

function warnTask(task, message) {
  task.warnings.push(message);
  logTask(task, `注意：${message}`);
}

function warnTaskOnce(task, message) {
  if (task.warnings.includes(message)) {
    return;
  }
  warnTask(task, message);
}

function failTask(task, error) {
  const message = errorMessage(error);
  task.errors.push(message);
  updateTask(task, { status: "失败", tone: "red", progress: 100 });
  logTask(task, `任务失败：${message}`);
}

function loadApiProviderRegistry() {
  const providers = new Map();
  const cloak = detectCloakBrowserAvailability();
  [
    {
      id: "opencli",
      name: "opencli",
      type: "local",
      baseUrl: "local command",
      enabled: Boolean(opencliVersion),
      configured: Boolean(opencliVersion),
	      costPerCall: numberFromEnv("OPENCLI_COST_PER_CALL", 0),
	      currency: process.env.OPENCLI_CURRENCY || "USD",
	      unit: "command",
	      platforms: ["X", "Reddit", "Instagram", "Facebook", "小红书", "微博", "B站", "YouTube", "Google News", "Google", "LinkedIn"],
	      keywordInterfaces: keywordCapabilitiesForProvider("opencli"),
	      commentInterfaces: commentCapabilitiesForProvider("opencli"),
	      note: keywordWebFirstEnabled()
	        ? "本地 opencli 命令采集器，关键词策略为 web-first 时优先用于网页采集，默认费用按 0 计。"
	        : "本地 opencli 命令采集器，默认费用按 0 计。"
    },
    {
      id: "cloakbrowser",
      name: "CloakBrowser",
      type: "local",
      baseUrl: "local stealth Chromium",
      enabled: shouldTryCloakBrowser() && cloak.available,
      configured: cloak.available,
      costPerCall: numberFromEnv("CLOAKBROWSER_COST_PER_CALL", 0),
      currency: process.env.CLOAKBROWSER_CURRENCY || "USD",
      unit: "browser session",
	      platforms: ["X", "Reddit", "TikTok", "小红书", "微博", "YouTube", "B站", "Instagram", "Facebook", "Google", "Google News", "全网", "LinkedIn"],
	      commentInterfaces: commentCapabilitiesForProvider("cloakbrowser"),
	      keywordInterfaces: keywordCapabilitiesForProvider("cloakbrowser"),
	      note: cloak.available
	        ? "可选浏览器增强层，当前用于目标 Link 可见评论采集和多平台关键词网页采集；BROWSER_ENGINE=auto 时先试 CloakBrowser，失败回退 opencli/API。"
	        : "未检测到 cloakbrowser 包；安装后设置 BROWSER_ENGINE=auto 或 cloak 才会参与采集。"
    },
    {
      id: "firecrawl",
      name: "Firecrawl",
      type: "http",
      baseUrl: FIRECRAWL_BASE_URL,
      apiKeyEnv: "FIRECRAWL_API_KEY",
      authHeader: "Authorization",
      authPrefix: "Bearer",
      healthPath: "",
      enabled: Boolean(process.env.FIRECRAWL_API_KEY),
      configured: Boolean(process.env.FIRECRAWL_API_KEY),
      costPerCall: numberFromEnv("FIRECRAWL_COST_PER_CALL", 0),
      currency: process.env.FIRECRAWL_CURRENCY || "USD",
      unit: "request",
      platforms: ["全网", "Google News", "Google", "B站"],
      note: "网页搜索、网页正文和新闻外链补采。"
    },
    {
      id: "apify",
      name: "Apify",
      type: "http",
      baseUrl: (process.env.APIFY_BASE_URL || "https://api.apify.com/v2").replace(/\/+$/, ""),
      apiKeyEnv: "APIFY_API_TOKEN",
      authHeader: "Authorization",
      authPrefix: "Bearer",
      healthPath: APIFY_HEALTH_ENDPOINT,
      enabled: Boolean(process.env.APIFY_API_TOKEN),
      configured: Boolean(process.env.APIFY_API_TOKEN),
      costPerCall: numberFromEnv("APIFY_COST_PER_CALL", 0),
      currency: process.env.APIFY_CURRENCY || "USD",
      unit: "actor run/request",
      pricingModel: "mixed",
      resultCostPer1000: APIFY_TIKTOK_COST_PER_1000_RESULTS,
      platforms: ["Instagram", "Facebook", "X", "YouTube", "Reddit", "TikTok", "LinkedIn", "Google"],
      keywordInterfaces: keywordCapabilitiesForProvider("apify"),
      commentInterfaces: commentCapabilitiesForProvider("apify"),
      note: `Apify actor 平台；TikTok actor 默认按 ${APIFY_TIKTOK_COST_PER_1000_RESULTS}/1000 results 估算，其他 actor 可用 APIFY_COST_PER_CALL 兜底。`
    },
    {
      id: "tikhub",
      name: "TikHub",
      type: "http",
      baseUrl: (process.env.TIKHUB_BASE_URL || "https://api.tikhub.io").replace(/\/+$/, ""),
      apiKeyEnv: "TIKHUB_API_KEY",
      authHeader: "Authorization",
      authPrefix: "Bearer",
      healthPath: TIKHUB_HEALTH_ENDPOINT,
      enabled: Boolean(process.env.TIKHUB_API_KEY),
      configured: Boolean(process.env.TIKHUB_API_KEY),
      costPerCall: numberFromEnv("TIKHUB_COST_PER_CALL", TIKHUB_PRICING_TIERS[0].costPerCall),
      currency: process.env.TIKHUB_CURRENCY || "USD",
      unit: "request",
      pricingModel: "dailyTiered",
      minCostPerCall: TIKHUB_PRICING_TIERS[TIKHUB_PRICING_TIERS.length - 1].costPerCall,
      maxCostPerCall: numberFromEnv("TIKHUB_MAX_COST_PER_CALL", 0.01),
      platforms: ["X", "TikTok", "Instagram", "YouTube", "LinkedIn", "Reddit", "小红书", "微博", "B站"],
      keywordInterfaces: keywordCapabilitiesForProvider("tikhub"),
      commentInterfaces: commentCapabilitiesForProvider("tikhub"),
      note: "TikHub 聚合社媒 API；默认按基础阶梯 $0.001/request 估算，官方区间为 $0.001-$0.01/request。"
    },
    {
      id: "xapi",
      name: "XAPI",
      type: "http",
      baseUrl: XAPI_BASE_URL,
      apiKeyEnv: "XAPI_API_KEY",
      authHeader: "Authorization",
      authPrefix: "Bearer",
      healthPath: XAPI_HEALTH_ENDPOINT,
      healthMethod: "POST",
      healthAuthMode: "apiKeyBody",
      enabled: Boolean(process.env.XAPI_API_KEY),
      configured: Boolean(process.env.XAPI_API_KEY),
      costPerCall: numberFromEnv("XAPI_COST_PER_CALL", 0),
      currency: process.env.XAPI_CURRENCY || "USD",
      unit: "request",
      pricingModel: XAPI_COST_PER_CU > 0 ? "creditUnit" : "flat",
      defaultCreditsPerCall: XAPI_DEFAULT_CU_PER_CALL,
      creditCostPerUnit: XAPI_COST_PER_CU,
      platforms: ["X", "Reddit", "TikTok", "Instagram", "小红书", "微博", "LinkedIn", "Google", "全网"],
      note: "XAPI 聚合网关，已纳入 X、Reddit、TikTok、Instagram、小红书、微博、LinkedIn 和 Web Search 的能力标记；具体 endpoint 路由会逐步接入采集器。"
    },
    {
      id: "llm",
      name: process.env.LLM_PROVIDER_NAME || "LLM Agent",
      type: "http",
      baseUrl: LLM_BASE_URL,
      apiKeyEnv: "LLM_API_KEY",
      authHeader: process.env.LLM_AUTH_HEADER || "Authorization",
      authPrefix: process.env.LLM_AUTH_PREFIX === undefined ? "Bearer" : process.env.LLM_AUTH_PREFIX,
      healthPath: "",
      enabled: Boolean(process.env.LLM_API_KEY),
      configured: Boolean(process.env.LLM_API_KEY),
      costPerCall: numberFromEnv("LLM_COST_PER_CALL", 0),
      currency: process.env.LLM_CURRENCY || "USD",
      unit: "chat completion",
      pricingModel: "token",
      inputCostPer1K: numberFromEnv("LLM_COST_PER_1K_INPUT", 0),
      outputCostPer1K: numberFromEnv("LLM_COST_PER_1K_OUTPUT", 0),
      platforms: ["Agent", "采集方案"],
      note: "用于 AI 生成采集方案；key 只在后端读取。"
    }
  ].forEach((provider) => providers.set(provider.id, normalizeApiProviderConfig(provider)));

  for (const provider of loadCustomApiProviderConfigs()) {
    const normalized = normalizeApiProviderConfig(provider);
    if (!normalized.id) continue;
    providers.set(normalized.id, {
      ...(providers.get(normalized.id) || {}),
      ...normalized
    });
  }

  return providers;
}

function loadCustomApiProviderConfigs() {
  return [
    ...parseApiProviderConfigText(process.env.SOCIAL_RESEARCH_API_PROVIDERS || ""),
    ...readApiProviderConfigFile(API_PROVIDER_CONFIG_PATH)
  ];
}

function readApiProviderConfigFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return [];
    }
    return parseApiProviderConfigText(fs.readFileSync(filePath, "utf8"));
  } catch (_error) {
    return [];
  }
}

function parseApiProviderConfigText(text) {
  const raw = String(text || "").trim();
  if (!raw) {
    return [];
  }
  try {
    const json = JSON.parse(raw);
    if (Array.isArray(json)) {
      return json;
    }
    if (Array.isArray(json.providers)) {
      return json.providers;
    }
    return [json];
  } catch (_error) {
    return [];
  }
}

function normalizeApiProviderConfig(provider) {
  const apiKeyEnv = String(provider.apiKeyEnv || "").trim();
  const directApiKey = String(provider.apiKey || "").trim();
  const envApiKey = apiKeyEnv ? String(process.env[apiKeyEnv] || "").trim() : "";
  const configured = provider.type === "local"
    ? Boolean(provider.configured ?? provider.enabled)
    : Boolean(provider.configured ?? (directApiKey || envApiKey));
  return {
    id: safeProviderId(provider.id || provider.name),
    name: String(provider.name || provider.id || "API").trim(),
    type: String(provider.type || "http").trim(),
    baseUrl: String(provider.baseUrl || "").replace(/\/+$/, ""),
    apiKeyEnv,
    apiKey: directApiKey,
    authHeader: String(provider.authHeader || "Authorization").trim(),
    authPrefix: String(provider.authPrefix || "Bearer").trim(),
    healthPath: String(provider.healthPath || "").trim(),
    healthMethod: String(provider.healthMethod || "GET").trim().toUpperCase(),
    healthAuthMode: String(provider.healthAuthMode || "default").trim(),
    enabled: Boolean(provider.enabled ?? configured),
    configured,
    costPerCall: numberValue(provider.costPerCall ?? provider.unitCost ?? provider.costPerRequest),
    minCostPerCall: numberValue(provider.minCostPerCall),
    maxCostPerCall: numberValue(provider.maxCostPerCall),
    pricingModel: String(provider.pricingModel || "flat").trim(),
    resultCostPer1000: numberValue(provider.resultCostPer1000),
    defaultCreditsPerCall: numberValue(provider.defaultCreditsPerCall),
    creditCostPerUnit: numberValue(provider.creditCostPerUnit),
    inputCostPer1K: numberValue(provider.inputCostPer1K),
    outputCostPer1K: numberValue(provider.outputCostPer1K),
    currency: String(provider.currency || "USD").trim().toUpperCase(),
    unit: String(provider.unit || "request").trim(),
    platforms: Array.isArray(provider.platforms) ? provider.platforms.map(String) : [],
    keywordInterfaces: normalizeKeywordCapabilities(provider.keywordInterfaces || []),
    commentInterfaces: normalizeCommentCapabilities(provider.commentInterfaces || []),
    note: String(provider.note || "").trim()
  };
}

function normalizeKeywordCapabilities(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => publicKeywordCapability(item))
    .filter((item) => item.providerId && item.route);
}

function normalizeCommentCapabilities(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => publicCommentCapability(item))
    .filter((item) => item.providerId && item.route);
}

function publicKeywordCapability(capability = {}) {
  return {
    platforms: Array.isArray(capability.platforms) ? capability.platforms.map(String) : [],
    providerId: String(capability.providerId || "").trim(),
    providerName: String(capability.providerName || capability.providerId || "").trim(),
    type: String(capability.type || "").trim(),
    stage: String(capability.stage || "").trim(),
    label: String(capability.label || "").trim(),
    method: String(capability.method || "").trim(),
    endpoint: String(capability.endpoint || "").trim(),
    actor: String(capability.actor || "").trim(),
    route: String(capability.route || capability.endpoint || capability.actor || "").trim(),
    note: String(capability.note || "").trim()
  };
}

function publicCommentCapability(capability = {}) {
  return {
    platforms: Array.isArray(capability.platforms) ? capability.platforms.map(String) : [],
    providerId: String(capability.providerId || "").trim(),
    providerName: String(capability.providerName || capability.providerId || "").trim(),
    type: String(capability.type || "").trim(),
    level: String(capability.level || "").trim(),
    label: String(capability.label || "").trim(),
    method: String(capability.method || "").trim(),
    endpoint: String(capability.endpoint || "").trim(),
    actor: String(capability.actor || "").trim(),
    route: String(capability.route || capability.endpoint || capability.actor || "").trim(),
    note: String(capability.note || "").trim()
  };
}

function keywordCapabilitiesForProvider(providerId) {
  const normalizedProviderId = String(providerId || "").trim();
  return KEYWORD_API_CAPABILITIES
    .filter((capability) => capability.providerId === normalizedProviderId)
    .map(publicKeywordCapability);
}

function commentCapabilitiesForProvider(providerId) {
  const normalizedProviderId = String(providerId || "").trim();
  return COMMENT_API_CAPABILITIES
    .filter((capability) => capability.providerId === normalizedProviderId)
    .map(publicCommentCapability);
}

function keywordCapabilitiesForPlatform(platform) {
  const normalizedPlatform = String(platform || "").trim();
  return KEYWORD_API_CAPABILITIES
    .filter((capability) => (capability.platforms || []).includes(normalizedPlatform))
    .sort(sortKeywordCapabilitiesByStage)
    .map(publicKeywordCapability);
}

function sortKeywordCapabilitiesByStage(left, right) {
  return keywordCapabilityStageRank(left.stage) - keywordCapabilityStageRank(right.stage);
}

function keywordCapabilityStageRank(stage) {
  return {
    keywordSearch: 1,
    "keyword+article": 1,
    detailEnrich: 2,
    urlEnrich: 3
  }[stage] || 9;
}

function commentCapabilitiesForPlatform(platform) {
  const normalizedPlatform = String(platform || "").trim();
  return COMMENT_API_CAPABILITIES
    .filter((capability) => (capability.platforms || []).includes(normalizedPlatform))
    .map(publicCommentCapability);
}

function describeKeywordCapabilitiesForPlatform(platform) {
  return keywordCapabilitiesForPlatform(platform)
    .map((capability) => {
      const target = capability.actor || capability.endpoint || capability.route;
      return `${capability.providerName} ${capability.stage}: ${target}`;
    })
    .join("；");
}

function describeCommentCapabilitiesForPlatform(platform) {
  return commentCapabilitiesForPlatform(platform)
    .map((capability) => {
      const target = capability.actor || capability.endpoint || capability.route;
      return `${capability.providerName} ${capability.level}: ${target}`;
    })
    .join("；");
}

function safeProviderId(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function numberFromEnv(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
}

function loadApiUsageState() {
  try {
    if (!fs.existsSync(API_USAGE_STATE_PATH)) {
      return { providers: {} };
    }
    const raw = fs.readFileSync(API_USAGE_STATE_PATH, "utf8");
    const json = raw ? JSON.parse(raw) : {};
    return json && typeof json === "object" ? { providers: json.providers || {} } : { providers: {} };
  } catch (_error) {
    return { providers: {} };
  }
}

function persistApiUsageState() {
  fs.writeFileSync(API_USAGE_STATE_PATH, `${JSON.stringify({
    savedAt: new Date().toISOString(),
    providers: apiUsageState.providers || {}
  }, null, 2)}\n`, "utf8");
}

function getApiProviderPublicList() {
  return Array.from(apiProviderRegistry.values()).map((provider) => ({
    id: provider.id,
    name: provider.name,
    type: provider.type,
    baseUrl: provider.baseUrl,
    enabled: provider.enabled,
    configured: provider.configured,
    apiKeyEnv: provider.apiKeyEnv || "",
    healthPath: provider.healthPath || "",
    healthMethod: provider.healthMethod || "GET",
    healthAuthMode: provider.healthAuthMode || "default",
    keyState: provider.configured ? "configured" : "missing",
    costPerCall: provider.costPerCall,
    minCostPerCall: provider.minCostPerCall,
    maxCostPerCall: provider.maxCostPerCall,
    pricingModel: provider.pricingModel,
    resultCostPer1000: provider.resultCostPer1000,
    defaultCreditsPerCall: provider.defaultCreditsPerCall,
    creditCostPerUnit: provider.creditCostPerUnit,
    inputCostPer1K: provider.inputCostPer1K,
    outputCostPer1K: provider.outputCostPer1K,
    pricingDescription: describeProviderPricing(provider),
    currency: provider.currency,
    unit: provider.unit,
    platforms: provider.platforms || [],
    keywordInterfaces: provider.keywordInterfaces || [],
    commentInterfaces: provider.commentInterfaces || [],
    note: provider.note || ""
  }));
}

function getApiUsageReport() {
  const providers = getApiProviderPublicList().map((provider) => {
    const usage = normalizedApiUsage(provider.id, provider);
    const interfaces = Object.entries(usage.interfaces || {})
      .map(([key, item]) => publicApiInterfaceUsage(provider, key, item))
      .sort(sortUsageRows);
    if (!interfaces.length && usage.calls) {
      interfaces.push(publicLegacyApiInterfaceUsage(provider, usage));
    }
    return {
      ...provider,
      calls: usage.calls,
      successCalls: usage.successCalls,
      failedCalls: usage.failedCalls,
      billableEvents: usage.billableEvents,
      billableUnits: usage.billableUnits,
      estimatedCost: roundMoney(usage.estimatedCost),
      lastCalledAt: usage.lastCalledAt || "",
      dailyUsageDate: usage.dailyUsageDate || "",
      dailyCalls: usage.dailyCalls || 0,
      lastEndpoint: usage.lastEndpoint || "",
      lastOperation: usage.lastOperation || "",
      lastStatus: usage.lastStatus || "",
      lastError: usage.lastError || "",
      interfaces
    };
  });
  const interfaces = providers
    .flatMap((provider) => provider.interfaces || [])
    .sort(sortUsageRows);
  return {
    providers,
    interfaces,
    totals: summarizeApiUsage(providers),
    interfaceTotals: summarizeApiUsage(interfaces)
  };
}

function normalizedApiUsage(providerId, provider = {}) {
  const current = apiUsageState.providers?.[providerId] || {};
  return {
    calls: numberValue(current.calls),
    successCalls: numberValue(current.successCalls),
    failedCalls: numberValue(current.failedCalls),
    billableEvents: numberValue(current.billableEvents),
    billableUnits: numberValue(current.billableUnits),
    estimatedCost: Number(current.estimatedCost || 0),
    currency: current.currency || provider.currency || "USD",
    dailyUsageDate: current.dailyUsageDate || "",
    dailyCalls: numberValue(current.dailyCalls),
    lastCalledAt: current.lastCalledAt || "",
    lastEndpoint: current.lastEndpoint || "",
    lastOperation: current.lastOperation || "",
    lastStatus: current.lastStatus || "",
    lastError: current.lastError || "",
    interfaces: normalizeApiInterfaceMap(current.interfaces || {}, provider)
  };
}

function summarizeApiUsage(providers) {
  const currency = providers.find((provider) => provider.currency)?.currency || "USD";
  const costByCurrency = providers.reduce((acc, provider) => {
    const itemCurrency = provider.currency || currency;
    acc[itemCurrency] = roundMoney(Number(acc[itemCurrency] || 0) + Number(provider.estimatedCost || 0));
    return acc;
  }, {});
  return {
    calls: providers.reduce((sum, provider) => sum + numberValue(provider.calls), 0),
    successCalls: providers.reduce((sum, provider) => sum + numberValue(provider.successCalls), 0),
    failedCalls: providers.reduce((sum, provider) => sum + numberValue(provider.failedCalls), 0),
    billableEvents: providers.reduce((sum, provider) => sum + numberValue(provider.billableEvents), 0),
    billableUnits: providers.reduce((sum, provider) => sum + numberValue(provider.billableUnits), 0),
    estimatedCost: roundMoney(providers.reduce((sum, provider) => sum + Number(provider.estimatedCost || 0), 0)),
    costByCurrency,
    currency
  };
}

function describeProviderPricing(provider) {
  const currency = provider.currency || "USD";
  if (provider.id === "llm" || provider.pricingModel === "token") {
    return `${currency} ${provider.inputCostPer1K || 0}/1K input tokens + ${currency} ${provider.outputCostPer1K || 0}/1K output tokens`;
  }
  if (provider.id === "tikhub" && provider.pricingModel === "dailyTiered") {
    return `${currency} ${provider.minCostPerCall || 0}-${provider.maxCostPerCall || provider.costPerCall || 0}/request`;
  }
  if (provider.id === "apify" && provider.resultCostPer1000) {
    return `${currency} ${provider.resultCostPer1000}/1000 TikTok results + ${currency} ${provider.costPerCall || 0}/${provider.unit || "request"}`;
  }
  if (provider.id === "xapi" && provider.pricingModel === "creditUnit") {
    return `${currency} ${provider.creditCostPerUnit || 0}/CU, default ${provider.defaultCreditsPerCall || 0} CU/call`;
  }
  return `${currency} ${provider.costPerCall || 0}/${provider.unit || "request"}`;
}

function normalizeApiInterfaceMap(interfaces, provider) {
  return Object.entries(interfaces || {}).reduce((acc, [key, value]) => {
    const normalized = normalizedApiInterfaceUsage(value, provider, key);
    if (normalized.key) {
      acc[normalized.key] = normalized;
    }
    return acc;
  }, {});
}

function normalizedApiInterfaceUsage(current = {}, provider = {}, fallbackKey = "") {
  const key = String(current.key || fallbackKey || "").trim();
  return {
    key,
    endpoint: String(current.endpoint || key || "").trim(),
    operation: String(current.operation || "").trim(),
    calls: numberValue(current.calls),
    successCalls: numberValue(current.successCalls),
    failedCalls: numberValue(current.failedCalls),
    billableEvents: numberValue(current.billableEvents),
    billableUnits: numberValue(current.billableUnits),
    pricingUnit: String(current.pricingUnit || provider.unit || "request").trim(),
    unitCost: numberValue(current.unitCost),
    averageCostPerCall: numberValue(current.averageCostPerCall),
    averageCostPerUnit: numberValue(current.averageCostPerUnit),
    estimatedCost: Number(current.estimatedCost || 0),
    currency: current.currency || provider.currency || "USD",
    inputTokens: numberValue(current.inputTokens),
    outputTokens: numberValue(current.outputTokens),
    lastCalledAt: current.lastCalledAt || "",
    lastStatus: current.lastStatus || "",
    lastError: current.lastError || ""
  };
}

function publicApiInterfaceUsage(provider, key, item) {
  const normalized = normalizedApiInterfaceUsage(item, provider, key);
  return {
    ...normalized,
    providerId: provider.id,
    providerName: provider.name,
    pricingModel: provider.pricingModel || "flat",
    pricingDescription: describeProviderPricing(provider),
    estimatedCost: roundMoney(normalized.estimatedCost),
    averageCostPerCall: normalized.calls ? roundMoney(normalized.estimatedCost / normalized.calls) : 0,
    averageCostPerUnit: normalized.billableUnits ? roundMoney(normalized.estimatedCost / normalized.billableUnits) : 0
  };
}

function publicLegacyApiInterfaceUsage(provider, usage) {
  return {
    key: `legacy:${provider.id}`,
    providerId: provider.id,
    providerName: provider.name,
    endpoint: "历史汇总",
    operation: `${usage.lastEndpoint || usage.lastOperation || provider.name} · 升级前未拆分 endpoint`,
    calls: usage.calls,
    successCalls: usage.successCalls,
    failedCalls: usage.failedCalls,
    billableEvents: usage.billableEvents,
    billableUnits: usage.billableUnits,
    pricingUnit: provider.unit || "request",
    unitCost: 0,
    averageCostPerCall: usage.calls ? roundMoney(usage.estimatedCost / usage.calls) : 0,
    averageCostPerUnit: usage.billableUnits ? roundMoney(usage.estimatedCost / usage.billableUnits) : 0,
    estimatedCost: roundMoney(usage.estimatedCost),
    currency: usage.currency || provider.currency || "USD",
    inputTokens: 0,
    outputTokens: 0,
    lastCalledAt: usage.lastCalledAt || "",
    lastStatus: usage.lastStatus || "",
    lastError: usage.lastError || "",
    pricingModel: provider.pricingModel || "flat",
    pricingDescription: describeProviderPricing(provider)
  };
}

function sortUsageRows(a, b) {
  const costDelta = Number(b.estimatedCost || 0) - Number(a.estimatedCost || 0);
  if (costDelta !== 0) return costDelta;
  return (Date.parse(b.lastCalledAt || "") || 0) - (Date.parse(a.lastCalledAt || "") || 0);
}

function recordApiInterfaceUsage(interfaces, provider, detail, metrics) {
  const key = apiInterfaceKey(provider.id, detail);
  const current = normalizedApiInterfaceUsage(interfaces?.[key], provider, key);
  const cost = Number(metrics.cost || 0);
  const calls = current.calls + (metrics.countedCall ? 1 : 0);
  const billableUnits = roundUsageUnits(current.billableUnits + metrics.units);
  const estimatedCost = roundMoney(Number(current.estimatedCost || 0) + cost);
  return {
    ...(interfaces || {}),
    [key]: {
      ...current,
      key,
      endpoint: key,
      operation: String(detail.operation || current.operation || ""),
      calls,
      successCalls: current.successCalls + (metrics.countedCall && metrics.ok ? 1 : 0),
      failedCalls: current.failedCalls + (metrics.countedCall && !metrics.ok ? 1 : 0),
      billableEvents: current.billableEvents + 1,
      billableUnits,
      pricingUnit: String(detail.pricingUnit || current.pricingUnit || provider.unit || "request"),
      unitCost: unitCostForUsageEvent(provider, detail, cost, metrics.units),
      averageCostPerCall: calls ? roundMoney(estimatedCost / calls) : 0,
      averageCostPerUnit: billableUnits ? roundMoney(estimatedCost / billableUnits) : 0,
      estimatedCost,
      currency: provider.currency || current.currency || "USD",
      inputTokens: current.inputTokens + numberValue(detail.inputTokens),
      outputTokens: current.outputTokens + numberValue(detail.outputTokens),
      lastCalledAt: metrics.now,
      lastStatus: metrics.ok ? "ok" : "error",
      lastError: metrics.ok ? "" : errorMessage(detail.error)
    }
  };
}

function apiInterfaceKey(providerId, detail = {}) {
  const endpoint = normalizeUsageEndpoint(providerId, detail.endpoint || detail.operation || providerId);
  return endpoint || `${providerId}:unknown`;
}

function normalizeUsageEndpoint(providerId, endpoint) {
  const raw = String(endpoint || "").trim();
  if (!raw) return "";
  if (/^apify:actor:/i.test(raw)) {
    return raw.replace(/\/+/g, "/");
  }
  let value = raw.split("?")[0];
  if (providerId === "apify") {
    value = value
      .replace(/\/v2\/acts\/[^/]+\/runs/i, "/acts/:actor/runs")
      .replace(/\/acts\/[^/]+\/runs/i, "/acts/:actor/runs")
      .replace(/\/v2\/actor-runs\/[^/]+/i, "/actor-runs/:runId")
      .replace(/\/actor-runs\/[^/]+/i, "/actor-runs/:runId")
      .replace(/\/v2\/datasets\/[^/]+\/items/i, "/datasets/:datasetId/items")
      .replace(/\/datasets\/[^/]+\/items/i, "/datasets/:datasetId/items");
  }
  return value || raw;
}

function usageUnitsFromDetail(detail, countedCall) {
  if (Number.isFinite(Number(detail.units))) {
    return Math.max(0, Number(detail.units));
  }
  if (Number.isFinite(Number(detail.billableUnits))) {
    return Math.max(0, Number(detail.billableUnits));
  }
  return countedCall ? 1 : 0;
}

function unitCostForUsageEvent(provider, detail, cost, units) {
  if (Number.isFinite(Number(detail.unitCost))) {
    return Number(detail.unitCost);
  }
  if (provider.id === "xapi" && provider.pricingModel === "creditUnit") {
    return Number(provider.creditCostPerUnit || 0);
  }
  if (provider.id === "llm" || provider.pricingModel === "token") {
    return units ? roundMoney(Number(cost || 0) / units) : 0;
  }
  return units ? roundMoney(Number(cost || 0) / units) : Number(provider.costPerCall || 0);
}

function roundUsageUnits(value) {
  return Math.round(Number(value || 0) * 1000) / 1000;
}

function recordApiCall(providerId, detail = {}) {
  if (detail.task && isInternalTestTask(detail.task)) {
    return;
  }
  const provider = apiProviderRegistry.get(providerId) || normalizeApiProviderConfig({ id: providerId, name: providerId, type: "http" });
  const usage = normalizedApiUsage(providerId, provider);
  const ok = detail.ok !== false;
  const countedCall = detail.countCall !== false;
  const cost = estimateProviderCallCost(provider, usage, detail);
  const units = usageUnitsFromDetail(detail, countedCall);
  const dailyDate = usageDateKey();
  const dailyCalls = usage.dailyUsageDate === dailyDate ? usage.dailyCalls : 0;
  const now = new Date().toISOString();
  const normalizedEndpoint = normalizeUsageEndpoint(provider.id, detail.endpoint || detail.operation || provider.id);
  const next = {
    ...usage,
    calls: usage.calls + (countedCall ? 1 : 0),
    successCalls: usage.successCalls + (countedCall && ok ? 1 : 0),
    failedCalls: usage.failedCalls + (countedCall && !ok ? 1 : 0),
    billableEvents: usage.billableEvents + 1,
    billableUnits: roundUsageUnits(usage.billableUnits + units),
    estimatedCost: roundMoney(usage.estimatedCost + cost),
    currency: provider.currency || usage.currency || "USD",
    dailyUsageDate: dailyDate,
    dailyCalls: dailyCalls + (countedCall ? 1 : 0),
    lastCalledAt: now,
    lastEndpoint: normalizedEndpoint,
    lastOperation: String(detail.operation || ""),
    lastStatus: ok ? "ok" : "error",
    lastError: ok ? "" : errorMessage(detail.error),
    interfaces: recordApiInterfaceUsage(usage.interfaces, provider, {
      ...detail,
      endpoint: normalizedEndpoint
    }, { cost, ok, countedCall, units, now })
  };
  apiUsageState.providers[providerId] = next;
  persistApiUsageState();
  if (detail.task) {
    recordTaskApiUsage(detail.task, provider, next, cost, ok, countedCall);
  }
}

function estimateProviderCallCost(provider, usage, detail = {}) {
  if (Number.isFinite(Number(detail.cost))) {
    return Number(detail.cost);
  }
  if (provider.id === "tikhub" && provider.pricingModel === "dailyTiered") {
    return tikHubTierCostForUsage(usage);
  }
  if (provider.id === "xapi" && provider.pricingModel === "creditUnit") {
    const credits = Number.isFinite(Number(detail.units)) ? Number(detail.units) : Number(provider.defaultCreditsPerCall || 0);
    return roundMoney((credits * Number(provider.creditCostPerUnit || 0)) + Number(provider.costPerCall || 0));
  }
  return Number(provider.costPerCall || 0);
}

function tikHubTierCostForUsage(usage) {
  const dailyDate = usageDateKey();
  const callsToday = usage.dailyUsageDate === dailyDate ? usage.dailyCalls : 0;
  const nextCallNumber = callsToday + 1;
  const tier = TIKHUB_PRICING_TIERS.find((item) => nextCallNumber >= item.minCalls && nextCallNumber <= item.maxCalls);
  return tier?.costPerCall ?? TIKHUB_PRICING_TIERS[0].costPerCall;
}

function usageDateKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function recordTaskApiUsage(task, provider, usage, cost, ok, countedCall = true) {
  if (!task?.result?.stats) {
    return;
  }
  if (!task.result.stats.apiUsage) {
    task.result.stats.apiUsage = {};
  }
  const current = task.result.stats.apiUsage[provider.id] || {
    providerId: provider.id,
    name: provider.name,
    calls: 0,
    successCalls: 0,
    failedCalls: 0,
    estimatedCost: 0,
    currency: provider.currency || "USD"
  };
  task.result.stats.apiUsage[provider.id] = {
    ...current,
    calls: current.calls + (countedCall ? 1 : 0),
    successCalls: current.successCalls + (countedCall && ok ? 1 : 0),
    failedCalls: current.failedCalls + (countedCall && !ok ? 1 : 0),
    estimatedCost: roundMoney(Number(current.estimatedCost || 0) + Number(cost || 0)),
    currency: provider.currency || usage.currency || "USD"
  };
  persistTasks();
}

function roundMoney(value) {
  return Math.round(Number(value || 0) * 1_000_000) / 1_000_000;
}

function getAgentStatus() {
  const provider = apiProviderRegistry.get("llm");
  return {
    configured: Boolean(provider?.enabled && provider?.configured),
    provider: provider ? {
      id: provider.id,
      name: provider.name,
      baseUrl: provider.baseUrl,
      keyState: provider.configured ? "configured" : "missing",
      currency: provider.currency,
      unit: provider.unit
    } : null,
    model: LLM_MODEL,
    chatEndpoint: LLM_CHAT_ENDPOINT,
    jsonMode: LLM_JSON_MODE,
    supportedModes: ["keyword", "link"],
    output: ["collection_plan", "chat_agent", "page_analysis"],
    capabilities: {
      plan: true,
      chat: true,
      actions: true,
      pageAnalysis: true
    },
    env: {
      apiKey: "LLM_API_KEY",
      model: "LLM_MODEL",
      baseUrl: "LLM_BASE_URL"
    }
  };
}

async function generateAgentCollectionPlan(body = {}) {
  const input = normalizeAgentPlanInput(body);
  if (!input.goal && !input.targetLinks.length) {
    throw new Error("请提供研究目标 goal，或提供 targetLinks / subject。");
  }
  const firecrawlAvailable = Boolean(input.firecrawlApiKey || process.env.FIRECRAWL_API_KEY);
  const catalog = getPlatformCatalog({ firecrawlAvailable });
  const context = buildAgentPlanningContext(input, catalog);
  const llmDraft = await requestAgentPlanFromLlm(input, context);
  return normalizeAgentCollectionPlan(llmDraft, input, context);
}

async function generateAgentChatReply(body = {}) {
  const input = normalizeAgentChatInput(body);
  const context = buildAgentChatContextSnapshot(input.context);
  const llmDraft = await requestAgentChatFromLlm(input, context);
  return normalizeAgentChatResponse(llmDraft, context);
}

async function generatePageAnalysis(body = {}) {
  const input = normalizePageAnalysisInput(body);
  const page = await fetchPageSnapshot(input.url);
  const inferredPlatform = inferCommentLinkPlatform(input.url) || "Google";
  const planInput = normalizeAgentPlanInput({
    mode: "link",
    subject: input.url,
    goal: input.goal || page.title || input.url,
    targetLinks: [input.url],
    preferredPlatforms: input.preferredPlatforms.length ? input.preferredPlatforms : [inferredPlatform],
    timeRange: input.timeRange,
    depth: input.depth,
    commentPolicy: input.commentPolicy,
    schemaPrompt: input.schemaPrompt,
    budgetLimit: input.budgetLimit,
    firecrawlApiKey: input.firecrawlApiKey
  });
  const catalog = getPlatformCatalog({ firecrawlAvailable: Boolean(input.firecrawlApiKey || process.env.FIRECRAWL_API_KEY) });
  const context = buildAgentPlanningContext(planInput, catalog);
  let llmDraft;
  try {
    llmDraft = await requestPageAnalysisFromLlm(input, page, context);
  } catch (error) {
    llmDraft = fallbackPageAnalysisDraft(input, page, inferredPlatform, error);
  }
  const analysis = normalizePageAnalysisResult(llmDraft, input, page, inferredPlatform);
  const planDraft = {
    summary: analysis.collectionGoal || analysis.summary,
    recommendedPlatforms: analysis.recommendedPlatforms,
    keywords: analysis.recommendedKeywords,
    targetLinks: [input.url],
    needCommentCollection: analysis.needCommentCollection,
    commentPolicy: analysis.commentPolicy,
    platformPlans: analysis.platformPlans,
    warnings: analysis.warnings,
    assumptions: analysis.assumptions
  };
  const collectionPlan = normalizeAgentCollectionPlan(planDraft, planInput, context);
  return {
    agent: {
      provider: "llm",
      model: LLM_MODEL,
      generatedAt: new Date().toISOString()
    },
    page,
    analysis,
    collectionPlan
  };
}

function normalizeAgentPlanInput(body = {}) {
  const explicitMode = String(body.mode || "").trim();
  const subject = String(body.subject || body.taskName || "").trim();
  const goal = String(body.goal || body.prompt || body.query || subject || "").trim();
  const targetLinks = normalizeStringArray(body.targetLinks || body.links || body.urls);
  if (looksLikeUrl(subject)) {
    targetLinks.unshift(subject);
  }
  const mode = ["keyword", "link"].includes(explicitMode)
    ? explicitMode
    : targetLinks.length ? "link" : "keyword";
  return {
    mode,
    goal,
    subject,
    targetLinks: uniqueStrings(targetLinks).slice(0, 8),
    preferredPlatforms: uniqueStrings(normalizeStringArray(body.preferredPlatforms || body.platforms)).slice(0, AGENT_PLAN_MAX_PLATFORMS),
    timeRange: String(body.timeRange || "最近 7 天").trim(),
    depth: String(body.depth || "标准采集").trim(),
    commentPolicy: normalizeCommentPolicy(body.commentPolicy || ""),
    schemaPrompt: String(body.schemaPrompt || "").trim(),
    budgetLimit: Number.isFinite(Number(body.budgetLimit)) ? Number(body.budgetLimit) : null,
    firecrawlApiKey: String(body.firecrawlApiKey || "").trim()
  };
}

function normalizeAgentChatInput(body = {}) {
  const message = String(body.message || body.prompt || body.query || "").trim();
  if (!message) {
    throw new Error("请提供对话内容 message。");
  }
  return {
    message,
    history: normalizeAgentChatHistory(body.history),
    context: body.context && typeof body.context === "object" ? body.context : {}
  };
}

function normalizePageAnalysisInput(body = {}) {
  const url = String(body.url || body.target || body.subject || "").trim();
  if (!looksLikeUrl(url)) {
    throw new Error("页面分析需要提供 http/https 目标 URL。");
  }
  return {
    url,
    goal: trimText(body.goal || body.prompt || "", 240),
    question: trimText(body.question || "", 240),
    preferredPlatforms: uniqueStrings(normalizeStringArray(body.preferredPlatforms || body.platforms)).slice(0, AGENT_PLAN_MAX_PLATFORMS),
    timeRange: String(body.timeRange || "最近 7 天").trim(),
    depth: String(body.depth || "标准采集").trim(),
    commentPolicy: normalizeCommentPolicy(body.commentPolicy || "采集热门评论"),
    schemaPrompt: String(body.schemaPrompt || "").trim(),
    budgetLimit: Number.isFinite(Number(body.budgetLimit)) ? Number(body.budgetLimit) : null,
    firecrawlApiKey: String(body.firecrawlApiKey || "").trim()
  };
}

function normalizeAgentChatHistory(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => ({
      role: item?.role === "assistant" ? "assistant" : "user",
      content: trimText(item?.content || item?.text || item?.message || "", 1200)
    }))
    .filter((item) => item.content)
    .slice(-8);
}

function buildAgentPlanningContext(input, catalog) {
  const providers = getApiProviderPublicList();
  const providerIndex = new Map(providers.map((provider) => [provider.id, provider]));
  const platformCapabilities = catalog.map((entry) => ({
    platform: entry.platform,
    enabled: entry.enabled,
    supportedModes: entry.supportedModes,
    disabledReason: entry.disabledReason,
    routes: entry.routes,
    keywordProviders: entry.keywordProviders || [],
    keywordProviderHint: entry.keywordProviderHint || "",
    commentProviders: entry.commentProviders || [],
    commentProviderHint: entry.commentProviderHint || "",
    budgetCosts: entry.budgetCosts,
    consumesBrowserBudget: entry.consumesBrowserBudget,
    note: entry.note,
    defaultProvider: providerForPlatform(entry, input.mode, providerIndex)?.name || "unknown"
  }));
  return {
    now: new Date().toISOString(),
    maxPlatforms: AGENT_PLAN_MAX_PLATFORMS,
    opencliBrowserCallLimit: OPENCLI_BROWSER_CALL_LIMIT,
    modeRules: [
      "keyword 任务只能选择 supportedModes 包含 keyword 的平台。",
      "link 任务只能选择 supportedModes 包含 link 的平台，并且要按 URL 域名推断平台。",
      "LinkedIn 只支持 link 模式，走 opencli 浏览器页面抓取，不走职位搜索。",
      "TikTok 关键词采集走 Apify actor，不占 opencli 浏览器预算。"
    ],
    platformCapabilities,
    providers: providers.map((provider) => ({
      id: provider.id,
      name: provider.name,
      configured: provider.configured,
      enabled: provider.enabled,
      costPerCall: provider.costPerCall,
      currency: provider.currency,
      unit: provider.unit,
      platforms: provider.platforms,
      keywordInterfaces: provider.keywordInterfaces || [],
      commentInterfaces: provider.commentInterfaces || [],
      note: provider.note
    }))
  };
}

function buildAgentChatContextSnapshot(clientContext = {}) {
  const firecrawlAvailable = Boolean(process.env.FIRECRAWL_API_KEY);
  const catalog = getPlatformCatalog({ firecrawlAvailable });
  const userTasks = Array.from(tasks.values())
    .filter((task) => !isInternalTestTask(task))
    .sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")));
  const usage = getApiUsageReport();
  const taskItems = userTasks.slice(0, 6).map(summarizeTaskForAgentChat);
  const currentTaskId = String(clientContext.activeTaskId || "").trim();
  const currentTask = userTasks.find((task) => task.id === currentTaskId) || null;
  const selectedPlatforms = uniqueStrings(normalizeStringArray(clientContext.selectedPlatforms)).slice(0, 8);
  return {
    now: new Date().toISOString(),
    app: {
      activeView: normalizeAgentViewName(clientContext.activeView),
      activeMode: ["keyword", "link", "account"].includes(clientContext.activeMode) ? clientContext.activeMode : "keyword",
      selectedPlatforms
    },
    currentTask: currentTask ? summarizeTaskForAgentChat(currentTask) : null,
    taskStats: {
      total: taskItems.length,
      running: taskItems.filter((task) => ["运行中", "监控中"].includes(task.status)).length,
      finished: taskItems.filter((task) => ["完成", "部分完成"].includes(task.status)).length,
      failed: taskItems.filter((task) => task.status === "失败").length
    },
    tasks: taskItems,
    board: summarizeBoardContextForAgentChat(clientContext.board || {}),
    currentDraft: summarizeDraftContextForAgentChat(clientContext.draft || {}),
    backend: {
      host: HOST,
      port: PORT,
      monitorIntervalMinutes: MONITOR_INTERVAL_MINUTES,
      opencliBrowserCallLimit: OPENCLI_BROWSER_CALL_LIMIT
    },
    agentStatus: getAgentStatus(),
    providers: usage.providers.slice(0, 6).map((provider) => ({
      id: provider.id,
      name: provider.name,
      configured: Boolean(provider.configured),
      calls: provider.calls || 0,
      estimatedCost: provider.estimatedCost || 0,
      currency: provider.currency || "USD",
      lastStatus: provider.lastStatus || "",
      lastOperation: trimText(provider.lastOperation || "", 48),
      keywordInterfaces: (provider.keywordInterfaces || []).slice(0, 8),
      commentInterfaces: (provider.commentInterfaces || []).slice(0, 8)
    })),
    platforms: catalog
      .filter((entry) => entry.enabled || ["X", "LinkedIn", "Facebook", "Google"].includes(entry.platform))
      .slice(0, 12)
      .map((entry) => ({
      platform: entry.platform,
      enabled: Boolean(entry.enabled),
      supportedModes: entry.supportedModes || [],
      disabledReason: trimText(entry.disabledReason || "", 80),
      routes: {
        keywordSearch: entry.routes?.keywordSearch || "",
        keywordEnrich: entry.routes?.keywordEnrich || "",
        link: entry.routes?.link || "",
        account: entry.routes?.account || ""
      },
      keywordProviders: (entry.keywordProviders || []).slice(0, 4),
      keywordProviderHint: entry.keywordProviderHint || "",
      commentProviders: (entry.commentProviders || []).slice(0, 4),
      commentProviderHint: entry.commentProviderHint || ""
    })),
    availableActions: [
      { type: "open_view", views: ["overview", "tasks", "data", "report", "sources"] },
      { type: "open_task_board" },
      { type: "open_task_drawer", modes: ["keyword", "link", "account"] },
      { type: "generate_plan", modes: ["keyword", "link"] },
      { type: "create_task", modes: ["keyword", "link", "account"], confirmationRequired: true },
      { type: "refresh_data" }
    ]
  };
}

function summarizeTaskForAgentChat(task) {
  return {
    id: task.id,
    title: trimText(task.title || "", 80),
    mode: task.mode || "keyword",
    status: task.status || "",
    monitorEnabled: Boolean(task.monitorEnabled),
    progress: Number(task.progress || 0),
    rowCount: task.result?.rows?.length || 0,
    postCount: task.result?.posts?.length || 0,
    subtitle: trimText(task.subtitle || "", 120),
    route: trimText(task.route || "", 120),
    warningSummary: trimText(task.warnings?.[0] || "", 120),
    errorSummary: trimText(task.errors?.[0] || "", 120),
    nextRunAt: task.nextRunAt || "",
    lastRunCompletedAt: task.lastRunCompletedAt || "",
    updatedAt: task.updatedAt || ""
  };
}

function summarizeBoardContextForAgentChat(board = {}) {
  const columns = uniqueStrings(normalizeStringArray(board.columns)).slice(0, 12);
  const platformBreakdown = Array.isArray(board.platformBreakdown)
    ? board.platformBreakdown.slice(0, 5).map((item) => ({
      platform: trimText(item?.platform || "", 40),
      count: numberValue(item?.count)
    })).filter((item) => item.platform)
    : [];
  return {
    activeTaskId: trimText(board.activeTaskId || "", 64),
    activeTaskTitle: trimText(board.activeTaskTitle || "", 120),
    totalRows: numberValue(board.totalRows),
    filteredRows: numberValue(board.filteredRows),
    columns,
    platformBreakdown,
    selectedRow: compactBoardRowForAgentChat(board.selectedRow),
    sampleRows: Array.isArray(board.sampleRows) ? board.sampleRows.slice(0, 3).map(compactBoardRowForAgentChat).filter(Boolean) : []
  };
}

function summarizeDraftContextForAgentChat(draft = {}) {
  return {
    mode: ["keyword", "link", "account"].includes(draft.mode) ? draft.mode : "keyword",
    subject: trimText(draft.subject || "", 180),
    selectedPlatforms: uniqueStrings(normalizeStringArray(draft.selectedPlatforms)).slice(0, 8),
    timeRange: trimText(draft.timeRange || "", 80),
    depth: trimText(draft.depth || "", 40),
    commentPolicy: trimText(draft.commentPolicy || "", 40),
    monitorEnabled: Boolean(draft.monitorEnabled)
  };
}

function compactBoardRowForAgentChat(row) {
  if (!row || typeof row !== "object") {
    return null;
  }
  const compact = {};
  for (const [key, value] of Object.entries(row)) {
    if (String(key).startsWith("_")) {
      continue;
    }
    const text = trimText(value, 180);
    if (text) {
      compact[key] = text;
    }
  }
  return Object.keys(compact).length ? compact : null;
}

function normalizeAgentViewName(view) {
  return ["overview", "tasks", "data", "report", "sources"].includes(String(view || ""))
    ? String(view)
    : "overview";
}

async function requestAgentPlanFromLlm(input, context) {
  const provider = apiProviderRegistry.get("llm");
  if (!provider?.enabled || !provider?.configured) {
    throw new Error("LLM_API_KEY 还没有配置；请把大模型 API key 放到 .env.local 后重启后端。");
  }

  const url = buildProviderUrl(provider, LLM_CHAT_ENDPOINT);
  const apiKey = provider.apiKey || (provider.apiKeyEnv ? process.env[provider.apiKeyEnv] : "");
  const headers = {
    "Content-Type": "application/json"
  };
  if (apiKey && provider.authHeader) {
    headers[provider.authHeader] = provider.authPrefix ? `${provider.authPrefix} ${apiKey}` : apiKey;
  }
  const requestBody = {
    model: LLM_MODEL,
    temperature: LLM_TEMPERATURE,
    messages: buildAgentPlannerMessages(input, context)
  };
  if (LLM_JSON_MODE) {
    requestBody.response_format = { type: "json_object" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });
    const text = await response.text();
    const payload = parseJsonResponseText(text);
    if (!response.ok) {
      throw new Error(payload?.error?.message || payload?.message || `LLM request failed: ${response.status}`);
    }
    const content = payload?.choices?.[0]?.message?.content || payload?.choices?.[0]?.text || payload?.content || "";
    const parsed = parseJsonObjectFromText(content);
    const usageCost = estimateLlmUsageCostDetail(payload?.usage);
    recordApiCall("llm", {
      endpoint: url.pathname,
      operation: `agent plan:${input.mode}`,
      ok: true,
      cost: usageCost.cost,
      units: usageCost.totalTokens,
      pricingUnit: "token",
      unitCost: usageCost.totalTokens ? usageCost.cost / usageCost.totalTokens : 0,
      inputTokens: usageCost.inputTokens,
      outputTokens: usageCost.outputTokens
    });
    return parsed;
  } catch (error) {
    recordApiCall("llm", {
      endpoint: url.pathname,
      operation: `agent plan:${input.mode}`,
      ok: false,
      cost: 0,
      error
    });
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function buildAgentPlannerMessages(input, context) {
  return [
    {
      role: "system",
      content: [
        "你是 Social Research Agent 的采集方案规划器。",
        "你只负责生成采集方案，不执行采集。",
        "必须严格遵守系统给出的平台能力、mode 支持、provider 和 route。",
        "不要推荐 unsupported 或 disabled 的平台。",
        "LinkedIn 只支持目标 Link 页面抓取，不走职位搜索。",
        "输出必须是一个 JSON object，不要输出 Markdown。"
      ].join("\n")
    },
    {
      role: "user",
      content: JSON.stringify({
        task: {
          mode: input.mode,
          goal: input.goal,
          targetLinks: input.targetLinks,
          preferredPlatforms: input.preferredPlatforms,
          timeRange: input.timeRange,
          depth: input.depth,
          commentPolicy: input.commentPolicy,
          budgetLimit: input.budgetLimit
        },
        systemContext: context,
        requiredJsonShape: {
          summary: "一句话说明采集目标",
          recommendedPlatforms: ["平台名"],
          keywords: ["关键词，keyword mode 至少 3 个"],
          targetLinks: ["link mode 的目标链接"],
          needCommentCollection: true,
          commentPolicy: "只采主贴 | 采集热门评论 | 完整采集评论",
          platformPlans: [
            {
              platform: "平台名",
              provider: "provider 名称",
              route: "后端 route",
              reason: "推荐原因",
              keywords: ["该平台建议使用的关键词"],
              targetLink: "link mode 可填",
              needComments: true
            }
          ],
          warnings: ["限制或风险"],
          assumptions: ["做出的假设"]
        }
      })
    }
  ];
}

async function requestAgentChatFromLlm(input, context) {
  const provider = apiProviderRegistry.get("llm");
  if (!provider?.enabled || !provider?.configured) {
    throw new Error("LLM_API_KEY 还没有配置；请把大模型 API key 放到 .env.local 后重启后端。");
  }

  const url = buildProviderUrl(provider, LLM_CHAT_ENDPOINT);
  const apiKey = provider.apiKey || (provider.apiKeyEnv ? process.env[provider.apiKeyEnv] : "");
  const headers = {
    "Content-Type": "application/json"
  };
  if (apiKey && provider.authHeader) {
    headers[provider.authHeader] = provider.authPrefix ? `${provider.authPrefix} ${apiKey}` : apiKey;
  }
  const requestBody = {
    model: LLM_MODEL,
    temperature: LLM_TEMPERATURE,
    messages: buildAgentChatMessages(input, context)
  };
  if (LLM_JSON_MODE) {
    requestBody.response_format = { type: "json_object" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });
    const text = await response.text();
    const payload = parseJsonResponseText(text);
    if (!response.ok) {
      throw new Error(payload?.error?.message || payload?.message || `LLM request failed: ${response.status}`);
    }
    const content = payload?.choices?.[0]?.message?.content || payload?.choices?.[0]?.text || payload?.content || "";
    const parsed = parseJsonObjectFromText(content);
    const usageCost = estimateLlmUsageCostDetail(payload?.usage);
    recordApiCall("llm", {
      endpoint: url.pathname,
      operation: "agent chat",
      ok: true,
      cost: usageCost.cost,
      units: usageCost.totalTokens,
      pricingUnit: "token",
      unitCost: usageCost.totalTokens ? usageCost.cost / usageCost.totalTokens : 0,
      inputTokens: usageCost.inputTokens,
      outputTokens: usageCost.outputTokens
    });
    return parsed;
  } catch (error) {
    recordApiCall("llm", {
      endpoint: url.pathname,
      operation: "agent chat",
      ok: false,
      cost: 0,
      error
    });
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function requestPageAnalysisFromLlm(input, page, context) {
  const provider = apiProviderRegistry.get("llm");
  if (!provider?.enabled || !provider?.configured) {
    throw new Error("LLM_API_KEY 还没有配置；请把大模型 API key 放到 .env.local 后重启后端。");
  }

  const url = buildProviderUrl(provider, LLM_CHAT_ENDPOINT);
  const apiKey = provider.apiKey || (provider.apiKeyEnv ? process.env[provider.apiKeyEnv] : "");
  const headers = {
    "Content-Type": "application/json"
  };
  if (apiKey && provider.authHeader) {
    headers[provider.authHeader] = provider.authPrefix ? `${provider.authPrefix} ${apiKey}` : apiKey;
  }
  const requestBody = {
    model: LLM_MODEL,
    temperature: LLM_TEMPERATURE,
    messages: buildPageAnalysisMessages(input, page, context)
  };
  if (LLM_JSON_MODE) {
    requestBody.response_format = { type: "json_object" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });
    const text = await response.text();
    const payload = parseJsonResponseText(text);
    if (!response.ok) {
      throw new Error(payload?.error?.message || payload?.message || `LLM request failed: ${response.status}`);
    }
    const content = payload?.choices?.[0]?.message?.content || payload?.choices?.[0]?.text || payload?.content || "";
    const parsed = parseJsonObjectFromText(content);
    const usageCost = estimateLlmUsageCostDetail(payload?.usage);
    recordApiCall("llm", {
      endpoint: url.pathname,
      operation: "page analysis",
      ok: true,
      cost: usageCost.cost,
      units: usageCost.totalTokens,
      pricingUnit: "token",
      unitCost: usageCost.totalTokens ? usageCost.cost / usageCost.totalTokens : 0,
      inputTokens: usageCost.inputTokens,
      outputTokens: usageCost.outputTokens
    });
    return parsed;
  } catch (error) {
    recordApiCall("llm", {
      endpoint: url.pathname,
      operation: "page analysis",
      ok: false,
      cost: 0,
      error
    });
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function buildAgentChatMessages(input, context) {
  return [
    {
      role: "system",
      content: [
        "你是 Social Research AI 助手。",
        "你可以基于系统上下文回答数据、任务、平台能力、provider 状态与成本问题。",
        "你可以建议前端执行动作，但不能编造不存在的任务、平台能力或 taskId。",
        "只有当用户明确要求执行、启动、运行或创建任务时，才返回 create_task 动作。",
        "如果用户还在探索阶段，优先返回 answer，并在需要时返回 generate_plan 或 open_task_drawer。",
        "create_task 动作必须给出 mode、subject、platforms、timeRange、depth、commentPolicy；link 模式必须使用 URL。",
        "目标 Link 评论采集当前可执行平台包括 X、Reddit、TikTok、小红书、微博、YouTube、B站、Instagram、Facebook、Google、LinkedIn。",
        "输出必须是一个 JSON object，不要输出 Markdown。"
      ].join("\n")
    },
    {
      role: "user",
      content: JSON.stringify({
        userMessage: input.message,
        conversationHistory: input.history,
        systemContext: context,
        requiredJsonShape: {
          reply: "直接回答用户问题，必要时说明依据与限制",
          actions: [
            {
              type: "open_view | open_task_board | open_task_drawer | generate_plan | create_task | refresh_data",
              label: "前端按钮文案",
              reason: "为什么建议执行这个动作",
              view: "overview | tasks | data | report | sources",
              taskId: "已有任务 id",
              mode: "keyword | link | account",
              payload: {
                mode: "keyword | link | account",
                subject: "任务主题或目标链接",
                taskName: "任务标题",
                platforms: ["平台"],
                targetLinks: ["link 模式目标链接"],
                timeRange: "最近 7 天",
                depth: "标准采集",
                commentPolicy: "采集热门评论",
                monitorEnabled: false
              }
            }
          ],
          followupSuggestions: ["最多 3 条后续问题建议"]
        }
      })
    }
  ];
}

function buildPageAnalysisMessages(input, page, context) {
  return [
    {
      role: "system",
      content: [
        "你是 Social Research 的页面分析 Agent。",
        "你的任务是阅读一个目标网页快照，并把它转成可执行的社媒/网页采集建议。",
        "必须严格使用 systemContext 中存在且 enabled 的平台、provider 与 route。",
        "如果页面是社媒贴文或视频 URL，优先推荐目标 Link 评论采集。",
        "如果页面是文章或普通网页，推荐 Google/全网类网页评论或关键词补采，并给出关键词。",
        "输出必须是一个 JSON object，不要输出 Markdown。"
      ].join("\n")
    },
    {
      role: "user",
      content: JSON.stringify({
        userGoal: input.goal,
        userQuestion: input.question,
        page,
        systemContext: context,
        requiredJsonShape: {
          summary: "页面内容摘要，最多 2 句话",
          contentType: "social_post | video | article | product | web_page | unknown",
          keyClaims: ["页面中的核心观点/事实"],
          entities: ["品牌、人物、产品、机构、话题"],
          recommendedPlatforms: ["平台名，必须来自 systemContext.platformCapabilities"],
          recommendedKeywords: ["适合后续关键词采集的词"],
          needCommentCollection: true,
          commentPolicy: "只采主贴 | 采集热门评论 | 完整采集评论",
          collectionGoal: "一句话采集目标",
          platformPlans: [
            {
              platform: "平台名",
              provider: "provider 名称",
              route: "后端 route",
              reason: "为什么推荐",
              keywords: ["该平台关键词"],
              targetLink: input.url,
              needComments: true
            }
          ],
          warnings: ["页面解析、登录、评论可见性或平台限制"],
          assumptions: ["做出的假设"]
        }
      })
    }
  ];
}

async function fetchPageSnapshot(targetUrl) {
  const url = String(targetUrl || "").trim();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FIRECRAWL_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.7"
      },
      signal: controller.signal
    });
    const contentType = response.headers.get("content-type") || "";
    const html = await response.text();
    if (!response.ok) {
      throw new Error(`Page fetch failed: ${response.status}`);
    }
    const snapshot = htmlToPageSnapshot(html, {
      url: response.url || url,
      status: response.status,
      contentType
    });
    recordApiCall("opencli", {
      endpoint: "page/analyze-fetch",
      operation: `page analysis fetch:${url}`,
      ok: true,
      cost: 0
    });
    return snapshot;
  } catch (error) {
    recordApiCall("opencli", {
      endpoint: "page/analyze-fetch",
      operation: `page analysis fetch:${url}`,
      ok: false,
      cost: 0,
      error
    });
    return {
      url,
      finalUrl: url,
      title: "",
      description: "",
      text: "",
      excerpt: "",
      status: 0,
      contentType: "",
      fetchedAt: new Date().toISOString(),
      fetchError: error instanceof Error ? error.message : String(error)
    };
  } finally {
    clearTimeout(timeout);
  }
}

function htmlToPageSnapshot(html, meta = {}) {
  const raw = String(html || "");
  const title = decodeHtmlEntities(firstHtmlMatch(raw, /<title[^>]*>([\s\S]*?)<\/title>/i));
  const description = decodeHtmlEntities(
    firstHtmlMatch(raw, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["'][^>]*>/i)
      || firstHtmlMatch(raw, /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["'][^>]*>/i)
  );
  const cleaned = raw
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<[^>]+>/g, " ");
  const text = normalizeWhitespace(decodeHtmlEntities(cleaned));
  return {
    url: meta.url || "",
    finalUrl: meta.url || "",
    title: trimText(title || inferTitleFromUrl(meta.url), 180),
    description: trimText(description, 420),
    text: trimText(text, 4000),
    excerpt: trimText(text, 1200),
    status: meta.status || 0,
    contentType: meta.contentType || "",
    fetchedAt: new Date().toISOString()
  };
}

function normalizePageAnalysisResult(raw, input, page, inferredPlatform) {
  const recommendedPlatforms = selectRunnablePlatforms(
    uniqueStrings([
      ...normalizeStringArray(raw?.recommendedPlatforms),
      ...normalizeStringArray(raw?.platforms),
      inferredPlatform
    ]),
    getPlatformCatalog({ firecrawlAvailable: Boolean(input.firecrawlApiKey || process.env.FIRECRAWL_API_KEY) }),
    "link"
  ).slice(0, AGENT_PLAN_MAX_PLATFORMS);
  const recommendedKeywords = uniqueStrings([
    ...normalizeStringArray(raw?.recommendedKeywords || raw?.keywords),
    ...deriveKeywordsFromGoal(`${page.title || ""} ${page.description || ""}`)
  ]).slice(0, 10);
  const commentPolicy = normalizeCommentPolicy(raw?.commentPolicy || input.commentPolicy);
  return {
    summary: trimText(raw?.summary || page.description || page.excerpt || "页面已解析，建议围绕该链接生成采集方案。", 800),
    contentType: trimText(raw?.contentType || "unknown", 40),
    keyClaims: normalizeTextList(raw?.keyClaims || raw?.claims).slice(0, 8),
    entities: uniqueStrings(normalizeStringArray(raw?.entities)).slice(0, 12),
    recommendedPlatforms,
    recommendedKeywords,
    needCommentCollection: Boolean(raw?.needCommentCollection ?? true),
    commentPolicy,
    collectionGoal: trimText(raw?.collectionGoal || raw?.goal || `围绕 ${page.title || input.url} 做目标 Link 采集。`, 240),
    platformPlans: Array.isArray(raw?.platformPlans) ? raw.platformPlans : [],
    warnings: normalizeTextList(raw?.warnings).slice(0, 8),
    assumptions: normalizeTextList(raw?.assumptions).slice(0, 8)
  };
}

function fallbackPageAnalysisDraft(input, page, inferredPlatform, error) {
  const title = page.title || inferTitleFromUrl(input.url) || input.url;
  const keywords = uniqueStrings([
    ...deriveKeywordsFromGoal(`${title} ${page.description || ""}`),
    inferredPlatform
  ]).filter((item) => item && item !== "Google").slice(0, 6);
  return {
    summary: page.description || page.excerpt || `已读取 ${title}，但 LLM 页面分析没有及时返回。`,
    contentType: inferredPlatform === "YouTube" ? "video" : inferredPlatform === "Google" ? "web_page" : "social_post",
    keyClaims: [trimText(page.excerpt || page.description || title, 180)].filter(Boolean),
    entities: keywords,
    recommendedPlatforms: [inferredPlatform || "Google"],
    recommendedKeywords: keywords.length ? keywords : [title],
    needCommentCollection: true,
    commentPolicy: input.commentPolicy || "采集热门评论",
    collectionGoal: `围绕 ${title} 做目标 Link 评论/页面采集。`,
    platformPlans: [{
      platform: inferredPlatform || "Google",
      route: "",
      reason: "根据目标链接域名自动匹配平台；LLM 分析超时，先生成可执行兜底方案。",
      keywords,
      targetLink: input.url,
      needComments: true
    }],
    warnings: [`LLM 页面分析未完成，已使用本地兜底方案：${error instanceof Error ? error.message : String(error)}`],
    assumptions: ["当前方案主要依据 URL 域名、页面标题和 meta 内容生成。"]
  };
}

function firstHtmlMatch(html, pattern) {
  const match = String(html || "").match(pattern);
  return match ? String(match[1] || "").trim() : "";
}

function decodeHtmlEntities(value) {
  return String(value || "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#039;/g, "'")
    .replace(/&#(\d+);/g, (_match, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code) => String.fromCharCode(parseInt(code, 16)));
}

function normalizeWhitespace(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function inferTitleFromUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return url.hostname.replace(/^www\./, "");
  } catch (_error) {
    return "";
  }
}

function normalizeAgentChatResponse(raw, context) {
  const reply = trimText(raw?.reply || raw?.answer || raw?.message || "我已经拿到系统上下文，但这一轮没有生成可展示的回答。", 4000);
  return {
    agent: {
      provider: "llm",
      model: LLM_MODEL,
      generatedAt: new Date().toISOString()
    },
    reply,
    actions: normalizeAgentChatActions(raw?.actions, context),
    followupSuggestions: uniqueStrings(normalizeStringArray(raw?.followupSuggestions || raw?.followups || raw?.nextQuestions)).slice(0, 3)
  };
}

function normalizeAgentChatActions(actions, context) {
  if (!Array.isArray(actions)) {
    return [];
  }
  const taskIndex = new Map((context.tasks || []).map((task) => [task.id, task]));
  return actions
    .map((action) => {
      const type = String(action?.type || "").trim();
      const label = trimText(action?.label || "", 40);
      const reason = trimText(action?.reason || "", 160);
      if (type === "open_view") {
        const view = normalizeAgentViewName(action?.view);
        return {
          type,
          label: label || `打开${view === "data" ? "采集看板" : view === "tasks" ? "采集任务" : view === "report" ? "研究报告" : view === "sources" ? "数据源" : "项目概览"}`,
          reason,
          view
        };
      }
      if (type === "refresh_data") {
        return {
          type,
          label: label || "刷新最新数据",
          reason
        };
      }
      if (type === "open_task_board") {
        const taskId = String(action?.taskId || "").trim();
        const task = taskIndex.get(taskId);
        if (!task) {
          return null;
        }
        return {
          type,
          label: label || `打开 ${task.title} 看板`,
          reason,
          taskId
        };
      }
      if (["open_task_drawer", "generate_plan", "create_task"].includes(type)) {
        const seed = normalizeAgentChatTaskSeed(action?.payload || action, context, action?.mode || action?.payload?.mode || "keyword");
        if (!seed.subject && type !== "open_task_drawer") {
          return null;
        }
        return {
          type,
          label: label || (type === "create_task" ? "执行采集任务" : type === "generate_plan" ? `${modeLabel(seed.mode)}方案` : "填写任务表单"),
          reason,
          mode: seed.mode,
          payload: seed,
          requiresConfirmation: type === "create_task"
        };
      }
      return null;
    })
    .filter(Boolean)
    .slice(0, 5);
}

function normalizeAgentChatTaskSeed(raw, context, fallbackMode = "keyword") {
  const firecrawlAvailable = Boolean(process.env.FIRECRAWL_API_KEY);
  const catalog = getPlatformCatalog({ firecrawlAvailable });
  let mode = ["keyword", "link", "account"].includes(String(raw?.mode || fallbackMode))
    ? String(raw?.mode || fallbackMode)
    : "keyword";
  const targetLinks = uniqueStrings(normalizeStringArray(raw?.targetLinks || raw?.links)).filter(looksLikeUrl).slice(0, 4);
  let subject = String(raw?.subject || raw?.taskName || raw?.goal || raw?.query || "").trim();
  if (!subject && mode === "link") {
    subject = targetLinks[0] || "";
  }
  if (!subject && context.currentDraft?.subject) {
    subject = context.currentDraft.subject;
  }
  if (looksLikeUrl(subject)) {
    mode = "link";
  }

  let platforms = uniqueStrings(normalizeStringArray(raw?.platforms || raw?.recommendedPlatforms || raw?.preferredPlatforms)).slice(0, AGENT_PLAN_MAX_PLATFORMS);
  if (mode === "link" && subject) {
    const inferredPlatform = inferCommentLinkPlatform(subject);
    if (inferredPlatform) {
      platforms = [inferredPlatform];
    }
  }
  platforms = selectRunnablePlatforms(platforms, catalog, mode);
  if (!platforms.length) {
    platforms = defaultAgentChatPlatforms(mode, catalog, subject);
  }

  return {
    mode,
    subject,
    taskName: trimText(raw?.taskName || subject, 80),
    platforms,
    targetLinks: mode === "link" ? uniqueStrings([subject, ...targetLinks]).filter(looksLikeUrl).slice(0, 1) : [],
    timeRange: trimText(raw?.timeRange || context.currentDraft?.timeRange || "最近 7 天", 80),
    depth: trimText(raw?.depth || context.currentDraft?.depth || "标准采集", 40),
    commentPolicy: normalizeCommentPolicy(raw?.commentPolicy || context.currentDraft?.commentPolicy || "采集热门评论"),
    schemaPrompt: trimText(raw?.schemaPrompt || "", 120),
    monitorEnabled: Boolean(raw?.monitorEnabled ?? context.currentDraft?.monitorEnabled)
  };
}

function defaultAgentChatPlatforms(mode, catalog, subject = "") {
  if (mode === "link") {
    const inferred = inferCommentLinkPlatform(subject);
    const inferredPlatforms = inferred ? selectRunnablePlatforms([inferred], catalog, "link") : [];
    if (inferredPlatforms.length) {
      return inferredPlatforms;
    }
    return selectRunnablePlatforms(["X", "Reddit", "小红书", "微博", "YouTube", "B站", "LinkedIn", "Facebook", "Google"], catalog, "link").slice(0, 1);
  }
  if (mode === "account") {
    return selectRunnablePlatforms(["X", "Instagram", "Facebook"], catalog, "account").slice(0, 3);
  }
  return selectRunnablePlatforms(["X", "Reddit", "小红书", "YouTube", "Google News"], catalog, "keyword").slice(0, 4);
}

function estimateLlmUsageCost(usage = {}) {
  return estimateLlmUsageCostDetail(usage).cost;
}

function estimateLlmUsageCostDetail(usage = {}) {
  const inputTokens = numberValue(usage.prompt_tokens ?? usage.input_tokens);
  const outputTokens = numberValue(usage.completion_tokens ?? usage.output_tokens);
  const inputRate = numberFromEnv("LLM_COST_PER_1K_INPUT", 0);
  const outputRate = numberFromEnv("LLM_COST_PER_1K_OUTPUT", 0);
  const perCall = numberFromEnv("LLM_COST_PER_CALL", 0);
  return {
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    inputCost: roundMoney((inputTokens / 1000) * inputRate),
    outputCost: roundMoney((outputTokens / 1000) * outputRate),
    cost: roundMoney(perCall + (inputTokens / 1000) * inputRate + (outputTokens / 1000) * outputRate)
  };
}

function parseJsonObjectFromText(text) {
  const raw = String(text || "").trim();
  if (!raw) {
    throw new Error("LLM 没有返回可解析的方案 JSON。");
  }
  try {
    return JSON.parse(raw);
  } catch (_error) {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error("LLM 返回内容不是 JSON object。");
    }
    return JSON.parse(match[0]);
  }
}

function normalizeAgentCollectionPlan(rawPlan, input, context) {
  const catalog = getPlatformCatalog({ firecrawlAvailable: Boolean(input.firecrawlApiKey || process.env.FIRECRAWL_API_KEY) });
  const providerIndex = new Map(getApiProviderPublicList().map((provider) => [provider.id, provider]));
  const catalogIndex = platformIndex(catalog);
  const warnings = uniqueStrings([
    ...normalizeTextList(rawPlan?.warnings),
    ...validateAgentPlanWarnings(rawPlan, input, catalog)
  ]);
  const assumptions = normalizeTextList(rawPlan?.assumptions).slice(0, 8);
  const keywords = input.mode === "keyword"
    ? normalizePlanKeywords(rawPlan, input)
    : [];
  const targetLinks = input.mode === "link"
    ? normalizePlanTargetLinks(rawPlan, input)
    : [];
  const selectedPlatforms = input.mode === "link"
    ? selectLinkPlanPlatforms({ rawPlan, input, catalog, targetLinks })
    : selectKeywordPlanPlatforms({ rawPlan, input, catalog });
  const commentPolicy = normalizeCommentPolicy(rawPlan?.commentPolicy || input.commentPolicy);
  const needCommentCollection = input.mode === "link"
    ? true
    : Boolean(rawPlan?.needCommentCollection ?? !commentPolicy.includes("只采"));
  const platformPlans = selectedPlatforms.map((platformName) => {
    const entry = catalogIndex.get(platformName);
    const rawPlatformPlan = findRawPlatformPlan(rawPlan, platformName);
    return buildNormalizedPlatformPlan({
      entry,
      rawPlatformPlan,
      input,
      keywords,
      targetLinks,
      commentPolicy,
      needCommentCollection,
      providerIndex
    });
  }).filter(Boolean);
  const totals = platformPlans.reduce((acc, item) => {
    acc.totalEstimatedCalls += numberValue(item.estimatedCalls);
    acc.totalEstimatedCost += Number(item.estimatedCost || 0);
    return acc;
  }, { totalEstimatedCalls: 0, totalEstimatedCost: 0 });
  const subject = input.mode === "link"
    ? targetLinks[0] || input.subject || input.goal
    : keywords[0] || input.subject || input.goal;
  const taskPayload = {
    mode: input.mode,
    subject,
    taskName: trimText(input.goal || subject, 80),
    platforms: platformPlans.map((plan) => plan.platform),
    timeRange: input.timeRange,
    depth: input.depth,
    commentPolicy,
    schemaPrompt: input.schemaPrompt,
    monitorEnabled: false
  };
  const executionPreview = taskPayload.platforms.length
    ? buildTaskExecutionPlan({
      input: normalizeTaskInput(taskPayload),
      catalog: getPlatformCatalog({ firecrawlAvailable: Boolean(input.firecrawlApiKey || process.env.FIRECRAWL_API_KEY) })
    }).preview
    : null;

  return {
    agent: {
      provider: "llm",
      model: LLM_MODEL,
      generatedAt: new Date().toISOString()
    },
    mode: input.mode,
    summary: String(rawPlan?.summary || defaultAgentPlanSummary(input, keywords, targetLinks)).trim(),
    recommendedPlatforms: taskPayload.platforms,
    keywords,
    targetLinks,
    needCommentCollection,
    commentPolicy,
    platformPlans,
    totalEstimatedCalls: totals.totalEstimatedCalls,
    totalEstimatedCost: roundMoney(totals.totalEstimatedCost),
    currency: platformPlans.find((plan) => plan.currency)?.currency || "USD",
    warnings,
    assumptions,
    executionPreview,
    taskPayload
  };
}

function validateAgentPlanWarnings(rawPlan, input, catalog) {
  const warnings = [];
  if (input.mode === "link" && !normalizePlanTargetLinks(rawPlan, input).length) {
    warnings.push("目标 Link 模式需要至少一个 URL；当前方案没有可执行链接。");
  }
  const index = platformIndex(catalog);
  for (const name of normalizeStringArray(rawPlan?.recommendedPlatforms)) {
    const entry = index.get(name);
    if (!entry) {
      warnings.push(`${name} 不在当前平台目录中，已忽略。`);
      continue;
    }
    if (!entry.enabled) {
      warnings.push(`${name} 当前不可用：${entry.disabledReason || "provider 未配置或登录态不可用"}。`);
      continue;
    }
    if (!entry.supportedModes.includes(input.mode)) {
      warnings.push(`${name} 不支持 ${modeLabel(input.mode)}，已忽略。`);
    }
  }
  return warnings;
}

function normalizePlanKeywords(rawPlan, input) {
  const keywords = uniqueStrings([
    ...normalizeStringArray(rawPlan?.keywords),
    ...normalizeStringArray(input.subject && !looksLikeUrl(input.subject) ? [input.subject] : []),
    ...deriveKeywordsFromGoal(input.goal)
  ]);
  return keywords.slice(0, 10);
}

function normalizePlanTargetLinks(rawPlan, input) {
  const fromRaw = normalizeStringArray(rawPlan?.targetLinks)
    .map((item) => typeof item === "string" ? item : item?.url)
    .filter(Boolean);
  return uniqueStrings([...input.targetLinks, ...fromRaw])
    .filter(looksLikeUrl)
    .slice(0, 8);
}

function selectKeywordPlanPlatforms({ rawPlan, input, catalog }) {
  const candidates = uniqueStrings([
    ...input.preferredPlatforms,
    ...normalizeStringArray(rawPlan?.recommendedPlatforms),
    ...rawPlatformNames(rawPlan)
  ]);
  const defaults = ["TikTok", "X", "Reddit", "YouTube", "B站", "小红书", "微博", "Instagram", "Facebook", "Google News", "全网"];
  return selectRunnablePlatforms(candidates.length ? candidates : defaults, catalog, "keyword")
    .slice(0, AGENT_PLAN_MAX_PLATFORMS);
}

function selectLinkPlanPlatforms({ rawPlan, input, catalog, targetLinks }) {
  const inferred = targetLinks.map(inferCommentLinkPlatform).filter(Boolean);
  const candidates = uniqueStrings([
    ...inferred,
    ...input.preferredPlatforms,
    ...normalizeStringArray(rawPlan?.recommendedPlatforms),
    ...rawPlatformNames(rawPlan)
  ]);
  return selectRunnablePlatforms(candidates.length ? candidates : ["Google"], catalog, "link")
    .slice(0, AGENT_PLAN_MAX_PLATFORMS);
}

function rawPlatformNames(rawPlan) {
  return Array.isArray(rawPlan?.platformPlans)
    ? rawPlan.platformPlans.map((item) => String(item?.platform || "").trim()).filter(Boolean)
    : [];
}

function selectRunnablePlatforms(candidates, catalog, mode) {
  const index = platformIndex(catalog);
  return uniqueStrings(candidates)
    .map((name) => index.get(name))
    .filter((entry) => entry?.enabled && entry.supportedModes.includes(mode))
    .map((entry) => entry.platform);
}

function findRawPlatformPlan(rawPlan, platformName) {
  const plans = Array.isArray(rawPlan?.platformPlans) ? rawPlan.platformPlans : [];
  return plans.find((plan) => String(plan?.platform || "").trim() === platformName) || {};
}

function buildNormalizedPlatformPlan({ entry, rawPlatformPlan, input, keywords, targetLinks, commentPolicy, needCommentCollection, providerIndex }) {
  if (!entry) {
    return null;
  }
  const provider = providerForPlatform(entry, input.mode, providerIndex);
  const route = routeForPlatform(entry, input.mode);
  const estimatedCalls = estimatePlatformCalls(entry, input.mode, needCommentCollection);
  const estimatedCost = estimatePlatformProviderCost(provider, entry, estimatedCalls);
  return {
    platform: entry.platform,
    provider: provider?.name || "unknown",
    providerId: provider?.id || "",
    route,
    reason: trimText(rawPlatformPlan?.reason || defaultPlatformReason(entry, input.mode), 180),
    keywords: input.mode === "keyword" ? uniqueStrings(normalizeStringArray(rawPlatformPlan?.keywords).concat(keywords)).slice(0, 6) : [],
    targetLink: input.mode === "link" ? String(rawPlatformPlan?.targetLink || targetLinks[0] || "").trim() : "",
    needComments: input.mode === "link" ? true : Boolean(rawPlatformPlan?.needComments ?? needCommentCollection),
    estimatedCalls,
    estimatedCost,
    currency: provider?.currency || "USD",
    costUnit: provider?.unit || "request",
    limits: platformLimits(entry, input.mode)
  };
}

function estimatePlatformProviderCost(provider, entry, estimatedCalls) {
  if (provider?.id === "apify" && entry?.platform === "TikTok" && Number(provider.resultCostPer1000 || 0) > 0) {
    return roundMoney((APIFY_TIKTOK_MAX_RESULTS / 1000) * Number(provider.resultCostPer1000 || 0));
  }
  return roundMoney(estimatedCalls * Number(provider?.costPerCall || 0));
}

function providerForPlatform(entry, mode, providerIndex = new Map(getApiProviderPublicList().map((provider) => [provider.id, provider]))) {
  const route = routeForPlatform(entry, mode);
  if (/^apify[:/]/i.test(route)) return providerIndex.get("apify");
  if (/^tikhub[:/]/i.test(route)) return providerIndex.get("tikhub");
  if (/^xapi[:/]/i.test(route)) return providerIndex.get("xapi");
  if (/^cloakbrowser[:/]/i.test(route)) return providerIndex.get("cloakbrowser");
  if (/^firecrawl\//i.test(route)) return providerIndex.get("firecrawl");
  return providerIndex.get("opencli") || providerIndex.get("llm");
}

function routeForPlatform(entry, mode) {
  if (!entry?.routes) {
    return "";
  }
  if (mode === "link") {
    return entry.routes.link || "";
  }
  if (mode === "keyword") {
    const keywordRoute = preferredKeywordProviderRoute(entry, ["keywordSearch", "keyword+article"]);
    if (keywordRoute) {
      return keywordRoute;
    }
    return entry.routes.keywordSearch || entry.routes.monitorSearch || "";
  }
  if (mode === "monitor") {
    const keywordRoute = preferredKeywordProviderRoute(entry, ["keywordSearch", "keyword+article"]);
    if (keywordRoute) {
      return keywordRoute;
    }
  }
  return entry.routes[mode] || "";
}

function preferredKeywordProviderRoute(entry, preferredStages = []) {
  const providers = Array.isArray(entry?.keywordProviders) ? entry.keywordProviders : [];
  const preferred = providers.find((provider) => preferredStages.includes(provider.stage));
  return (preferred || providers[0])?.route || "";
}

function estimatePlatformCalls(entry, mode, needCommentCollection) {
  if (!entry) {
    return 0;
  }
  if (!entry.consumesBrowserBudget) {
    return 1;
  }
  if (mode === "link") {
    return Math.max(1, numberValue(entry.budgetCosts?.link));
  }
  const search = Math.max(1, numberValue(entry.budgetCosts?.keywordSearch));
  const enrich = needCommentCollection ? numberValue(entry.budgetCosts?.keywordEnrich) : 0;
  return Math.max(1, search + enrich);
}

function platformLimits(entry, mode) {
  const limits = [];
  if (entry.disabledReason) {
    limits.push(entry.disabledReason);
  }
  if (mode === "link" && entry.platform === "LinkedIn") {
    limits.push(isApiProviderReady("apify")
      ? "优先使用 Apify LinkedIn 评论 actor；Apify 无结果时降级为浏览器可见评论。"
      : "未配置 Apify 时依赖已登录浏览器页面，且只能采集页面上可见评论。");
  }
  if (mode === "keyword" && entry.platform === "Instagram") {
    limits.push("当前帖子评论正文暂不支持，主要返回账号/内容线索与评论数。");
  }
  if (mode === "keyword" && entry.platform === "TikTok") {
    limits.push("关键词视频结果当前执行采集器来自 Apify actor；TikHub 关键词/视频详情接口已登记用于后续路由。");
  }
  return limits;
}

function defaultPlatformReason(entry, mode) {
  if (mode === "link") {
    return `${entry.platform} 支持目标 Link 页面评论采集。`;
  }
  return `${entry.platform} 支持关键词采集，适合补充该平台的社媒讨论样本。`;
}

function defaultAgentPlanSummary(input, keywords, targetLinks) {
  if (input.mode === "link") {
    return `围绕 ${targetLinks[0] || input.goal} 执行目标 Link 评论采集。`;
  }
  return `围绕 ${keywords[0] || input.goal} 执行多平台关键词采集。`;
}

function normalizeCommentPolicy(value) {
  const text = String(value || "").trim();
  if (text.includes("不采")) return "不采集评论";
  if (text.includes("完整")) return "完整采集评论";
  if (text.includes("只采") || text.includes("主贴")) return "只采主贴";
  if (text.includes("热门") || text.includes("评论")) return "采集热门评论";
  return "采集热门评论";
}

function deriveKeywordsFromGoal(goal) {
  const text = String(goal || "")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[，。！？、；：]/g, " ")
    .trim();
  const words = text.split(/\s+/)
    .map((word) => word.replace(/^#/, "").trim())
    .filter((word) => word.length >= 2 && !/^(帮我|采集|研究|重点|最近|用户|反馈|评论|内容|平台|社媒|海外|负面)$/i.test(word));
  return uniqueStrings(words).slice(0, 5);
}

function normalizeStringArray(value) {
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      if (typeof item === "string") {
        return item.split(/[,，\n]/).map((part) => part.trim()).filter(Boolean);
      }
      if (item && typeof item === "object") {
        return [String(item.platform || item.url || item.keyword || item.value || "").trim()].filter(Boolean);
      }
      return [];
    });
  }
  if (value === undefined || value === null) {
    return [];
  }
  return String(value).split(/[,，\n]/).map((item) => item.trim()).filter(Boolean);
}

function normalizeTextList(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean);
  }
  if (value === undefined || value === null) {
    return [];
  }
  return String(value).split(/\n/).map((item) => item.trim()).filter(Boolean);
}

function uniqueStrings(values) {
  const seen = new Set();
  const result = [];
  for (const value of values) {
    const text = String(value || "").trim();
    const key = text.toLowerCase();
    if (!text || seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(text);
  }
  return result;
}

async function testApiProvider(providerId) {
  const provider = apiProviderRegistry.get(providerId);
  if (!provider) {
    throw new Error(`API provider not found: ${providerId}`);
  }
  if (provider.type === "local") {
    return {
      id: provider.id,
      name: provider.name,
      ok: provider.enabled && provider.configured,
      message: provider.enabled && provider.configured ? "本地 provider 可用。" : "本地 provider 当前不可用。"
    };
  }
  if (!provider.enabled || !provider.configured) {
    throw new Error(`${provider.name} 还没有配置 key。`);
  }
  if (!provider.healthPath) {
    return {
      id: provider.id,
      name: provider.name,
      ok: true,
      message: "已读取 key；该 provider 未配置独立 health endpoint。"
    };
  }
  const payload = await providerHealthRequest(provider);
  return {
    id: provider.id,
    name: provider.name,
    ok: true,
    endpoint: provider.healthPath,
    message: payload?.message || payload?.msg || "连接测试成功。"
  };
}

async function providerHealthRequest(provider) {
  if (provider.healthAuthMode === "apiKeyBody") {
    const apiKey = provider.apiKey || (provider.apiKeyEnv ? process.env[provider.apiKeyEnv] : "");
    const url = buildProviderUrl(provider, provider.healthPath);
    try {
      const response = await fetch(url, {
        method: provider.healthMethod || "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey })
      });
      const text = await response.text();
      const payload = parseJsonResponseText(text);
      if (!response.ok || payload?.success === false || payload?.ok === false) {
        throw new Error(payloadErrorMessage(payload, `${provider.name} request failed: ${response.status}`));
      }
      recordApiCall(provider.id, { endpoint: url.pathname, operation: "provider health check", ok: true, cost: 0 });
      return payload;
    } catch (error) {
      recordApiCall(provider.id, { endpoint: url.pathname, operation: "provider health check", ok: false, cost: 0, error });
      throw error;
    }
  }
  return externalApiRequest(provider.id, provider.healthPath, {
    method: provider.healthMethod || "GET",
    operation: "provider health check",
    cost: 0
  });
}

async function externalApiRequest(providerId, endpoint, options = {}, task = null) {
  const provider = apiProviderRegistry.get(providerId);
  if (!provider) {
    throw new Error(`API provider not found: ${providerId}`);
  }
  if (!provider.enabled || !provider.configured) {
    throw new Error(`API provider is not configured: ${provider.name}`);
  }
  const url = buildProviderUrl(provider, endpoint);
  const apiKey = provider.apiKey || (provider.apiKeyEnv ? process.env[provider.apiKeyEnv] : "");
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };
  if (apiKey && provider.authHeader) {
    headers[provider.authHeader] = provider.authPrefix ? `${provider.authPrefix} ${apiKey}` : apiKey;
  }
  try {
    const response = await fetch(url, {
      method: options.method || "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal
    });
    const text = await response.text();
    const payload = parseJsonResponseText(text);
    if (!response.ok) {
      throw new Error(payloadErrorMessage(payload, `${provider.name} request failed: ${response.status}`));
    }
    recordApiCall(provider.id, { task, endpoint: url.pathname, operation: options.operation || endpoint, ok: true, cost: options.cost });
    return payload;
  } catch (error) {
    recordApiCall(provider.id, { task, endpoint: url.pathname, operation: options.operation || endpoint, ok: false, cost: options.cost, error });
    throw error;
  }
}

function parseJsonResponseText(text) {
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch (_error) {
    return { message: String(text).slice(0, 500) };
  }
}

function payloadErrorMessage(payload, fallback = "Request failed") {
  const error = payload?.error ?? payload?.message ?? payload;
  const message = errorMessage(error);
  return message && message !== "[object Object]" ? message : fallback;
}

function errorMessage(error) {
  if (!error) {
    return "";
  }
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  if (typeof error === "object") {
    const message = error.message || error.error || error.detail || error.description;
    if (message && typeof message !== "object") {
      return String(message);
    }
    try {
      return JSON.stringify(error);
    } catch (_jsonError) {
      return String(error);
    }
  }
  return String(error);
}

function buildProviderUrl(provider, endpoint) {
  const rawEndpoint = String(endpoint || "");
  if (/^https?:\/\//i.test(rawEndpoint)) {
    return new URL(rawEndpoint);
  }
  const base = String(provider.baseUrl || "").replace(/\/+$/, "");
  const suffix = rawEndpoint.replace(/^\/+/, "");
  return new URL(suffix ? `${base}/${suffix}` : base);
}

async function apifyRunActorDatasetItems(actorId, actorInput, task, operation, options = {}) {
  const actorPath = String(actorId || "").replace(/\//g, "~");
  const runPayload = await externalApiRequest("apify", `/acts/${actorPath}/runs`, {
    method: "POST",
    body: actorInput,
    operation: `${operation}:start`
  }, task);
  const run = runPayload?.data || runPayload;
  const runId = run?.id;
  if (!runId) {
    return [];
  }
  const finalRun = await waitForApifyRun(runId, task, operation);
  const datasetId = finalRun?.defaultDatasetId;
  if (!datasetId) {
    return [];
  }
  const limit = Math.max(1, Math.min(100, Number(options.limit || APIFY_TIKTOK_MAX_RESULTS + 5)));
  const payload = await externalApiRequest("apify", `/datasets/${datasetId}/items?clean=true&format=json&limit=${limit}`, {
    method: "GET",
    operation: `${operation}:dataset`
  }, task);
  if (Array.isArray(payload)) {
    recordApifyActorResultUsage(actorId, payload.length, task, operation);
    return payload;
  }
  if (Array.isArray(payload?.items)) {
    recordApifyActorResultUsage(actorId, payload.items.length, task, operation);
    return payload.items;
  }
  if (Array.isArray(payload?.data?.items)) {
    recordApifyActorResultUsage(actorId, payload.data.items.length, task, operation);
    return payload.data.items;
  }
  recordApifyActorResultUsage(actorId, 0, task, operation);
  return [];
}

function recordApifyActorResultUsage(actorId, resultCount, task, operation) {
  const cost = estimateApifyActorResultCost(actorId, resultCount);
  recordApiCall("apify", {
    task,
    endpoint: `apify:actor:${actorId}:results`,
    operation: `${operation}:result pricing`,
    ok: true,
    countCall: false,
    units: resultCount,
    pricingUnit: "result",
    unitCost: apifyActorResultUnitCost(actorId),
    cost
  });
}

function estimateApifyActorResultCost(actorId, resultCount) {
  const count = Math.max(0, numberValue(resultCount));
  if (isTikTokApifyActor(actorId)) {
    return roundMoney((count / 1000) * APIFY_TIKTOK_COST_PER_1000_RESULTS);
  }
  if (isLinkedInCommentsApifyActor(actorId)) {
    return roundMoney((count / 1000) * APIFY_LINKEDIN_COMMENTS_COST_PER_1000_RESULTS);
  }
  return 0;
}

function apifyActorResultUnitCost(actorId) {
  if (isTikTokApifyActor(actorId)) {
    return APIFY_TIKTOK_COST_PER_1000_RESULTS / 1000;
  }
  if (isLinkedInCommentsApifyActor(actorId)) {
    return APIFY_LINKEDIN_COMMENTS_COST_PER_1000_RESULTS / 1000;
  }
  return 0;
}

function isTikTokApifyActor(actorId) {
  return /tiktok/i.test(String(actorId || ""));
}

function isLinkedInCommentsApifyActor(actorId) {
  return /linkedin-post-comments/i.test(String(actorId || ""));
}

async function waitForApifyRun(runId, task, operation) {
  const terminal = new Set(["SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"]);
  for (let index = 0; index < 60; index += 1) {
    const payload = await externalApiRequest("apify", `/actor-runs/${encodeURIComponent(runId)}`, {
      method: "GET",
      operation: `${operation}:poll`
    }, task);
    const run = payload?.data || payload;
    if (terminal.has(run?.status)) {
      if (run.status !== "SUCCEEDED") {
        throw new Error(`Apify actor run ${run.status}`);
      }
      return run;
    }
    await sleep(2_000);
  }
  throw new Error("Apify actor run polling timed out");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function loadPersistedTasks() {
  try {
    if (!fs.existsSync(TASK_STORE_PATH)) {
      return new Map();
    }
    const raw = fs.readFileSync(TASK_STORE_PATH, "utf8");
    const json = raw ? JSON.parse(raw) : {};
    const rows = Array.isArray(json) ? json : Array.isArray(json.tasks) ? json.tasks : [];
    return new Map(rows.filter((task) => task?.id).map((task) => [task.id, task]));
  } catch (_error) {
    return new Map();
  }
}

function persistTasks() {
  const payload = {
    savedAt: new Date().toISOString(),
    tasks: Array.from(tasks.values())
  };
  fs.writeFileSync(TASK_STORE_PATH, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function buildExportPayload(body) {
  const taskId = String(body.taskId || "").trim();
  let rows = Array.isArray(body.rows) ? body.rows : [];
  let columns = Array.isArray(body.columns) ? body.columns.map((column) => String(column || "").trim()).filter(Boolean) : [];
  let title = String(body.title || "").trim();

  if (!rows.length && taskId && taskId !== "all") {
    const task = tasks.get(taskId);
    if (!task) {
      throw new Error("Task not found");
    }
    rows = task.result?.rows || [];
    columns = columns.length ? columns : (task.result?.rowHeaders || []);
    title = title || task.title;
  }

  if (!rows.length && (!taskId || taskId === "all")) {
    const allTasks = Array.from(tasks.values());
    rows = allTasks.flatMap((task) => task.result?.rows || []);
    title = title || "全部任务";
  }

  const normalizedColumns = columnsForExportRows(rows, columns);
  const normalizedRows = rows.map((row) => {
    const source = row && typeof row === "object" && !Array.isArray(row) ? row : { value: row };
    return Object.fromEntries(normalizedColumns.map((column) => [column, normalizeExcelValue(source[column])]));
  });

  return {
    title: title || "数据表",
    sheetName: safeSheetName(body.sheetName || title || "数据表"),
    columns: normalizedColumns,
    rows: normalizedRows
  };
}

function columnsForExportRows(rows, preferredColumns = []) {
  const columns = [];
  const seen = new Set();
  const addColumn = (column) => {
    const name = String(column || "").trim();
    if (!name || seen.has(name) || name.startsWith("_")) {
      return;
    }
    seen.add(name);
    columns.push(name);
  };

  preferredColumns.forEach(addColumn);
  rows.forEach((row) => {
    if (row && typeof row === "object" && !Array.isArray(row)) {
      Object.keys(row).forEach(addColumn);
    }
  });
  if (!columns.length) {
    columns.push("value");
  }
  return columns;
}

function exportRowsToDesktop(payload) {
  fs.mkdirSync(EXPORT_DIR, { recursive: true });
  const fileName = `social-research-${safeFileSegment(payload.title)}-${timestampForFilename()}.xlsx`;
  const filePath = path.join(EXPORT_DIR, fileName);
  writeXlsxFile(filePath, payload);
  return {
    fileName,
    filePath,
    rowCount: payload.rows.length,
    columnCount: payload.columns.length,
    sheetName: payload.sheetName
  };
}

function writeXlsxFile(filePath, payload) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "social-research-export-"));
  try {
    fs.mkdirSync(path.join(tempDir, "_rels"), { recursive: true });
    fs.mkdirSync(path.join(tempDir, "xl", "_rels"), { recursive: true });
    fs.mkdirSync(path.join(tempDir, "xl", "worksheets"), { recursive: true });

    fs.writeFileSync(path.join(tempDir, "[Content_Types].xml"), contentTypesXml(), "utf8");
    fs.writeFileSync(path.join(tempDir, "_rels", ".rels"), rootRelsXml(), "utf8");
    fs.writeFileSync(path.join(tempDir, "xl", "workbook.xml"), workbookXml(payload.sheetName), "utf8");
    fs.writeFileSync(path.join(tempDir, "xl", "_rels", "workbook.xml.rels"), workbookRelsXml(), "utf8");
    fs.writeFileSync(path.join(tempDir, "xl", "styles.xml"), workbookStylesXml(), "utf8");
    fs.writeFileSync(path.join(tempDir, "xl", "worksheets", "sheet1.xml"), worksheetXml(payload.columns, payload.rows), "utf8");

    fs.rmSync(filePath, { force: true });
    const zip = spawnSync("zip", ["-qr", filePath, "."], {
      cwd: tempDir,
      encoding: "utf8"
    });
    if (zip.status !== 0) {
      throw new Error(zip.stderr || zip.stdout || "Excel 文件压缩失败，请确认系统 zip 命令可用。");
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function contentTypesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;
}

function rootRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;
}

function workbookXml(sheetName) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="${escapeXml(sheetName)}" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`;
}

function workbookRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;
}

function workbookStylesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2">
    <font><sz val="11"/><name val="Arial"/></font>
    <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Arial"/></font>
  </fonts>
  <fills count="3">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF1F2937"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border>
      <left style="thin"><color rgb="FFE5E7EB"/></left>
      <right style="thin"><color rgb="FFE5E7EB"/></right>
      <top style="thin"><color rgb="FFE5E7EB"/></top>
      <bottom style="thin"><color rgb="FFE5E7EB"/></bottom>
      <diagonal/>
    </border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="3">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
}

function worksheetXml(columns, rows) {
  const lastColumn = columnName(columns.length - 1);
  const lastRow = rows.length + 1;
  const range = `A1:${lastColumn}${lastRow}`;
  const header = `<row r="1">${columns.map((column, index) => cellXml(column, 1, index, 1)).join("")}</row>`;
  const dataRows = rows.map((row, rowIndex) => {
    const excelRow = rowIndex + 2;
    return `<row r="${excelRow}">${columns.map((column, columnIndex) => cellXml(row[column], excelRow, columnIndex, 2)).join("")}</row>`;
  }).join("");
  const columnWidths = columns.map((column, index) => {
    const width = columnWidth(column, rows.map((row) => row[column]));
    const number = index + 1;
    return `<col min="${number}" max="${number}" width="${width}" customWidth="1"/>`;
  }).join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="${range}"/>
  <sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <cols>${columnWidths}</cols>
  <sheetData>${header}${dataRows}</sheetData>
  <autoFilter ref="${range}"/>
</worksheet>`;
}

function cellXml(value, rowNumber, columnIndex, styleIndex) {
  const ref = `${columnName(columnIndex)}${rowNumber}`;
  if (value === null || value === undefined || value === "") {
    return `<c r="${ref}" s="${styleIndex}"/>`;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return `<c r="${ref}" s="${styleIndex}"><v>${value}</v></c>`;
  }
  return `<c r="${ref}" s="${styleIndex}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
}

function columnName(index) {
  let value = index + 1;
  let name = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    value = Math.floor((value - 1) / 26);
  }
  return name;
}

function columnWidth(column, values) {
  const samples = [column, ...values].map((value) => String(value ?? "").replace(/\s+/g, " "));
  const maxLength = Math.max(...samples.map((value) => value.length), 8);
  return Math.min(Math.max(maxLength + 2, 12), 60);
}

function normalizeExcelValue(value) {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : "";
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (Array.isArray(value) || (typeof value === "object" && value)) {
    return JSON.stringify(value);
  }
  return String(value);
}

function escapeXml(value) {
  return String(value ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function safeSheetName(value) {
  const cleaned = String(value || "数据表").replace(/[\\/?*[\]:]/g, " ").trim();
  return (cleaned || "数据表").slice(0, 31);
}

function safeFileSegment(value) {
  const cleaned = String(value || "data")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return cleaned || "data";
}

function timestampForFilename(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join("") + "-" + [
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds())
  ].join("");
}

function getPlatformCatalog({ firecrawlAvailable }) {
  const opencliAvailable = Boolean(opencliVersion);
  const disabledByOpencli = opencliAvailable ? "" : "opencli 当前不可用。";
  const cloakBrowserAvailable = detectCloakBrowserAvailability().available;
  const webFirst = keywordWebFirstEnabled();
  const cloakKeywordAvailable = webFirst && cloakBrowserAvailable;
  const keywordRoute = (platform, fallbackRoute) => {
    if (!cloakKeywordAvailable || !CLOAKBROWSER_KEYWORD_PLATFORMS.has(platform)) {
      return fallbackRoute;
    }
    const capability = CLOAKBROWSER_KEYWORD_CAPABILITY_CONFIGS.find((item) => item.platform === platform);
    return `web-first:${capability?.route || "cloakbrowser:browser:keyword"} -> ${fallbackRoute}`;
  };
  const linkedInApifyAvailable = isApiProviderReady("apify");
  const apifyAvailable = isApiProviderReady("apify");
  const tikhubAvailable = isApiProviderReady("tikhub");
  const xApiAvailable = tikhubAvailable || apifyAvailable;
  const redditApiAvailable = tikhubAvailable || apifyAvailable;
  const youtubeApiAvailable = tikhubAvailable;
  const instagramApiAvailable = tikhubAvailable || apifyAvailable;
  const facebookApiAvailable = apifyAvailable;
  const googleLinkApiAvailable = apifyAvailable;
  const googleKeywordAvailable = apifyAvailable || (webFirst && opencliAvailable);
  const tiktokKeywordAvailable = tikhubAvailable || apifyAvailable || (webFirst && opencliAvailable);
  const linkedInKeywordAvailable = linkedInApifyAvailable || (webFirst && cloakBrowserAvailable);
  const xSupportedModes = uniqueStrings([
    ...(xApiAvailable ? ["keyword", "link", "monitor"] : []),
    ...(opencliAvailable ? ["keyword", "link", "account", "monitor"] : [])
  ]);
  const redditSupportedModes = uniqueStrings([
    ...(redditApiAvailable ? ["keyword", "link", "monitor"] : []),
    ...(opencliAvailable ? ["keyword", "link", "account", "monitor"] : [])
  ]);
  const youtubeSupportedModes = uniqueStrings([
    ...(youtubeApiAvailable ? ["keyword", "link", "monitor"] : []),
    ...(opencliAvailable ? ["keyword", "link", "account", "monitor"] : [])
  ]);
  const googleSupportedModes = uniqueStrings([
    ...(googleKeywordAvailable ? ["keyword", "monitor"] : []),
    ...(googleLinkApiAvailable || opencliAvailable ? ["link"] : [])
  ]);
  const linkedInSupportedModes = [
    ...(linkedInKeywordAvailable ? ["keyword", "monitor"] : []),
    ...(linkedInApifyAvailable ? ["link"] : []),
    ...(!linkedInApifyAvailable && opencliAvailable ? ["link"] : [])
  ];
  const tiktokSupportedModes = [
    ...(tiktokKeywordAvailable ? ["keyword", "monitor"] : []),
    ...(tikhubAvailable ? ["link"] : [])
  ];
  const instagramSupportedModes = uniqueStrings([
    ...(instagramApiAvailable ? ["keyword", "link", "monitor"] : []),
    ...(opencliAvailable ? ["keyword", "account", "monitor"] : [])
  ]);
  const facebookSupportedModes = uniqueStrings([
    ...(facebookApiAvailable ? ["keyword", "link", "monitor"] : []),
    ...(opencliAvailable ? ["keyword", "link", "account", "monitor"] : [])
  ]);
  const catalog = [
    {
      platform: "X",
      priority: priorityOf("X"),
      enabled: Boolean(xSupportedModes.length),
      supportedModes: xSupportedModes,
      disabledReason: xSupportedModes.length ? "" : "关键词/Link 采集需要 TikHub 或 Apify API；账号模式需要 opencli。",
      requiresFirecrawl: false,
      consumesBrowserBudget: webFirst || !xApiAvailable,
      budgetCostHint: xApiAvailable
        ? "关键词与 Link 评论优先走 TikHub API；账号模式仍需 opencli。"
        : "关键词搜索 1 次，补回复 1 次；Link 评论 1 次；账号 2 次",
	      budgetCosts: { keywordSearch: xApiAvailable && !webFirst ? 0 : 1, keywordEnrich: xApiAvailable && !webFirst ? 0 : 1, link: xApiAvailable ? 0 : 1, account: 2, monitorSearch: xApiAvailable && !webFirst ? 0 : 1, monitorEnrich: xApiAvailable && !webFirst ? 0 : 1 },
	      routes: {
	        keywordSearch: keywordRoute("X", tikhubAvailable ? "tikhub:GET:/api/v1/twitter/web/fetch_search_timeline" : "twitter/search"),
	        keywordEnrich: tikhubAvailable ? "tikhub:GET:/api/v1/twitter/web/fetch_tweet_detail" : "twitter/thread",
	        link: tikhubAvailable ? "tikhub:GET:/api/v1/twitter/web/fetch_post_comments" : "social-comment-export/twitter-thread",
	        account: "twitter/profile + twitter/search"
	      },
	      note: tikhubAvailable
	        ? "关键词、推文详情和 Link 评论优先走 TikHub；只有 API 无结果或失败时才回退浏览器。"
	        : (cloakKeywordAvailable ? "关键词优先走 CloakBrowser 搜索页采集，失败回退 opencli；Link 模式按评论导表 SOP 输出 6 列评论字段。" : "支持关键词、贴文详情、回复线程；Link 模式按评论导表 SOP 输出 6 列评论字段。")
    },
    {
      platform: "Reddit",
      priority: priorityOf("Reddit"),
      enabled: Boolean(redditSupportedModes.length),
      supportedModes: redditSupportedModes,
      disabledReason: redditSupportedModes.length ? "" : "关键词采集需要 TikHub API；Link 评论需要 Apify API；账号模式需要 opencli。",
      requiresFirecrawl: false,
      consumesBrowserBudget: webFirst || !redditApiAvailable,
      budgetCostHint: redditApiAvailable
        ? "关键词优先走 TikHub Reddit 搜索；Link 评论优先走 Apify Reddit comment actor；账号模式仍需 opencli。"
        : "关键词搜索 1 次，补正文评论 1 次；Link 评论 1 次；账号 2 次",
	      budgetCosts: { keywordSearch: redditApiAvailable && !webFirst ? 0 : 1, keywordEnrich: redditApiAvailable && !webFirst ? 0 : 1, link: apifyAvailable ? 0 : 1, account: 2, monitorSearch: redditApiAvailable && !webFirst ? 0 : 1, monitorEnrich: redditApiAvailable && !webFirst ? 0 : 1 },
	      routes: {
	        keywordSearch: keywordRoute("Reddit", tikhubAvailable ? "tikhub:GET:/api/v1/reddit/app/fetch_dynamic_search" : "reddit/search"),
	        keywordEnrich: apifyAvailable ? `apify:actor:${APIFY_REDDIT_COMMENTS_ACTOR}` : "reddit/read",
	        link: apifyAvailable ? `apify:actor:${APIFY_REDDIT_COMMENTS_ACTOR}` : "reddit/read + comments",
	        account: "reddit/user-posts + reddit/user-comments"
	      },
	      note: redditApiAvailable
	        ? "关键词和 Link 评论优先走 API；API 失败时才回退 opencli。"
	        : (cloakKeywordAvailable ? "关键词优先走 CloakBrowser 搜索页采集，失败回退 opencli；Link 模式按 Reddit 帖子读取正文、顶层评论和部分楼中楼。" : "适合关键词争议主题和多层评论研究；Link 模式按 Reddit 帖子读取正文、顶层评论和部分楼中楼。")
    },
    {
      platform: "TikTok",
      priority: priorityOf("TikTok"),
      enabled: Boolean(tiktokSupportedModes.length),
      supportedModes: tiktokSupportedModes,
      disabledReason: tiktokSupportedModes.length ? "" : "关键词采集需要 Apify API token；目标 Link 评论采集需要 TikHub API key。",
      requiresFirecrawl: false,
	      consumesBrowserBudget: webFirst && (cloakBrowserAvailable || opencliAvailable),
	      budgetCostHint: webFirst
	        ? `关键词优先走 CloakBrowser TikTok 搜索页，失败后回退 opencli / Apify actor；Link 评论走 TikHub L1/L2，默认每轮约 ${replyLimitForPolicy("采集热门评论")} 条`
	        : `关键词优先走 TikHub API，失败后回退 Apify actor；Link 评论走 TikHub L1/L2，默认每轮约 ${replyLimitForPolicy("采集热门评论")} 条`,
	      budgetCosts: { keywordSearch: webFirst && (cloakBrowserAvailable || opencliAvailable) ? 1 : 0, keywordEnrich: 0, link: 1, account: 0, monitorSearch: webFirst && (cloakBrowserAvailable || opencliAvailable) ? 1 : 0, monitorEnrich: 0 },
	      routes: {
	        keywordSearch: keywordRoute("TikTok", tikhubAvailable ? "tikhub:GET:/api/v1/tiktok/app/v3/fetch_general_search_result" : `apify/${APIFY_TIKTOK_ACTOR}:search`),
	        monitorSearch: keywordRoute("TikTok", tikhubAvailable ? "tikhub:GET:/api/v1/tiktok/app/v3/fetch_general_search_result" : `apify/${APIFY_TIKTOK_ACTOR}:search`),
	        link: "tikhub:GET:/api/v1/tiktok/app/v3/fetch_video_comments"
	      },
	      note: webFirst
	        ? "关键词视频结果优先通过 CloakBrowser 页面采集；无结果或失败时回退 opencli / Apify TikTok scraper。目标 Link 评论通过 TikHub 顶层评论接口，完整/深度采集时尝试补评论回复。"
	        : "关键词视频结果优先通过 TikHub 综合搜索接口；失败时回退 Apify TikTok scraper。目标 Link 评论通过 TikHub 顶层评论接口，完整/深度采集时尝试补评论回复。"
    },
    {
      platform: "小红书",
      priority: priorityOf("小红书"),
      enabled: opencliAvailable,
      supportedModes: ["keyword", "link", "account", "monitor"],
      disabledReason: disabledByOpencli,
      requiresFirecrawl: false,
      consumesBrowserBudget: true,
      budgetCostHint: "关键词搜索 1 次，补正文评论 2 次；Link 评论 2 次；账号 1 次",
	      budgetCosts: { keywordSearch: 1, keywordEnrich: 2, link: 2, account: 1, monitorSearch: 1, monitorEnrich: 2 },
	      routes: {
	        keywordSearch: keywordRoute("小红书", "xiaohongshu/search"),
	        keywordEnrich: "xiaohongshu/note + comments",
	        link: "xiaohongshu/note + comments",
	        account: "xiaohongshu/user"
	      },
	      note: cloakKeywordAvailable ? "关键词优先走 CloakBrowser 搜索页采集，失败回退 opencli；Link 模式需要可展开到 xsec_token 的完整笔记 URL，并拉取笔记评论。" : "支持关键词/账号采集；Link 模式需要可展开到 xsec_token 的完整笔记 URL，并拉取笔记评论。"
    },
    {
      platform: "微博",
      priority: priorityOf("微博"),
      enabled: opencliAvailable,
      supportedModes: ["keyword", "link", "account", "monitor"],
      disabledReason: disabledByOpencli,
      requiresFirecrawl: false,
      consumesBrowserBudget: true,
      budgetCostHint: "关键词搜索 1 次，补正文评论 2 次；Link 评论 2 次；账号 1 次",
	      budgetCosts: { keywordSearch: 1, keywordEnrich: 2, link: 2, account: 1, monitorSearch: 1, monitorEnrich: 2 },
	      routes: {
	        keywordSearch: keywordRoute("微博", "weibo/search"),
	        keywordEnrich: "weibo/post + comments",
	        link: "weibo/post + comments",
	        account: "weibo/user"
	      },
	      note: cloakKeywordAvailable ? "关键词优先走 CloakBrowser 搜索页采集，失败回退 opencli；Link 模式会按微博帖子 ID 拉取详情和评论。" : "支持关键词正文和评论正文；Link 模式会按微博帖子 ID 拉取详情和评论。"
    },
    {
      platform: "YouTube",
      priority: priorityOf("YouTube"),
      enabled: Boolean(youtubeSupportedModes.length),
      supportedModes: youtubeSupportedModes,
      disabledReason: youtubeSupportedModes.length ? "" : "关键词/Link 评论采集需要 TikHub API；账号模式需要 opencli。",
      requiresFirecrawl: false,
      consumesBrowserBudget: webFirst || !youtubeApiAvailable,
      budgetCostHint: youtubeApiAvailable
        ? "关键词、视频详情和评论优先走 TikHub YouTube API；字幕/账号仍可回退 opencli。"
        : "关键词搜索 1 次，补视频/评论/字幕 2 次；Link 评论 3 次；账号 1 次",
	      budgetCosts: { keywordSearch: youtubeApiAvailable && !webFirst ? 0 : 1, keywordEnrich: youtubeApiAvailable && !webFirst ? 0 : 2, link: youtubeApiAvailable ? 0 : 3, account: 1, monitorSearch: youtubeApiAvailable && !webFirst ? 0 : 1, monitorEnrich: youtubeApiAvailable && !webFirst ? 0 : 2 },
	      routes: {
	        keywordSearch: keywordRoute("YouTube", tikhubAvailable ? "tikhub:GET:/api/v1/youtube/web_v2/get_general_search_v2" : "youtube/search"),
	        keywordEnrich: tikhubAvailable ? "tikhub:GET:/api/v1/youtube/web_v2/get_video_info + comments" : "youtube/video + comments + transcript",
	        link: tikhubAvailable ? "tikhub:GET:/api/v1/youtube/web_v2/get_video_info + comments" : "youtube/video + comments + transcript",
	        account: "youtube/channel"
	      },
	      note: youtubeApiAvailable
	        ? "关键词、视频详情和评论优先走 TikHub；API 失败时才回退 opencli。"
	        : (cloakKeywordAvailable ? "关键词优先走 CloakBrowser 搜索页采集，失败回退 opencli；Link 模式按视频 URL 拉取详情、评论和字幕。" : "适合视频正文、评论和字幕联合研究；Link 模式按视频 URL 拉取详情、评论和字幕。")
    },
    {
      platform: "B站",
      priority: priorityOf("B站"),
      enabled: opencliAvailable,
      supportedModes: ["keyword", "link", "account", "monitor"],
      disabledReason: disabledByOpencli,
      requiresFirecrawl: false,
      consumesBrowserBudget: true,
      budgetCostHint: "关键词搜索 1 次，补评论字幕 2 次；Link 评论 2 次；账号 1 次",
	      budgetCosts: { keywordSearch: 1, keywordEnrich: 2, link: 2, account: 1, monitorSearch: 1, monitorEnrich: 2 },
	      routes: {
	        keywordSearch: keywordRoute("B站", "bilibili/search"),
	        keywordEnrich: "bilibili/comments + subtitle",
	        link: "bilibili/comments + subtitle",
	        account: "bilibili/user-videos"
	      },
	      note: cloakKeywordAvailable ? "关键词优先走 CloakBrowser 搜索页采集，失败回退 opencli；Link 模式按 BV 号拉取评论和字幕。" : "评论支持，视频标题与摘要优先来自搜索和字幕；Link 模式按 BV 号拉取评论和字幕。"
    },
    {
      platform: "Instagram",
      priority: priorityOf("Instagram"),
      enabled: Boolean(instagramSupportedModes.length),
      supportedModes: instagramSupportedModes,
      disabledReason: instagramSupportedModes.length ? "" : "关键词采集需要 Apify API；目标 Link 评论采集需要 TikHub API；账号模式需要 opencli。",
      requiresFirecrawl: false,
      consumesBrowserBudget: webFirst || !instagramApiAvailable,
      budgetCostHint: instagramApiAvailable
        ? "关键词优先走 Apify hashtag actor；Link 评论走 TikHub L1/L2，不占浏览器预算；账号模式仍需 opencli。"
        : "关键词搜索 1 次，补账号最近内容 1 次；Link 评论走 TikHub L1/L2，不占浏览器预算",
	      budgetCosts: { keywordSearch: instagramApiAvailable && !webFirst ? 0 : 1, keywordEnrich: instagramApiAvailable && !webFirst ? 0 : 1, link: tikhubAvailable ? 0 : 1, account: 1, monitorSearch: instagramApiAvailable && !webFirst ? 0 : 1, monitorEnrich: instagramApiAvailable && !webFirst ? 0 : 1 },
	      routes: {
	        keywordSearch: keywordRoute("Instagram", apifyAvailable ? `apify:actor:${APIFY_INSTAGRAM_HASHTAG_ACTOR}` : "instagram/search"),
	        keywordEnrich: apifyAvailable ? `apify:actor:${APIFY_INSTAGRAM_HASHTAG_ACTOR}` : "instagram/user",
	        link: "tikhub:GET:/api/v1/instagram/v3/get_post_comments",
	        account: "instagram/user"
	      },
	      note: instagramApiAvailable
	        ? "关键词优先走 Apify，目标 Link 评论走 TikHub；只有 API 失败时才回退浏览器。"
	        : (cloakKeywordAvailable ? "关键词优先走 CloakBrowser 搜索页采集，失败回退 opencli；目标 Link 评论通过 TikHub 帖子评论接口，完整/深度采集时尝试补评论回复。" : "opencli 负责账号/内容线索；目标 Link 评论通过 TikHub 帖子评论接口，完整/深度采集时尝试补评论回复。")
    },
    {
      platform: "Facebook",
      priority: priorityOf("Facebook"),
      enabled: Boolean(facebookSupportedModes.length),
      supportedModes: facebookSupportedModes,
      disabledReason: facebookSupportedModes.length ? "" : "关键词/Link 评论采集需要 Apify API；账号模式需要 opencli。",
      requiresFirecrawl: false,
      consumesBrowserBudget: webFirst || !facebookApiAvailable,
      budgetCostHint: facebookApiAvailable
        ? "关键词和 Link 评论优先走 Apify actor；账号模式仍需 opencli。"
        : "关键词搜索 1 次；Link 评论通过浏览器可见页面采集约 5 次；账号 2 次",
	      budgetCosts: { keywordSearch: facebookApiAvailable && !webFirst ? 0 : 1, keywordEnrich: 0, link: facebookApiAvailable ? 0 : 5, account: 2, monitorSearch: facebookApiAvailable && !webFirst ? 0 : 1, monitorEnrich: 0 },
	      routes: {
	        keywordSearch: keywordRoute("Facebook", apifyAvailable ? `apify:actor:${APIFY_FACEBOOK_POST_SEARCH_ACTOR}` : "facebook/search"),
	        link: apifyAvailable ? `apify:actor:${APIFY_FACEBOOK_COMMENTS_ACTOR}` : "social-comment-export/browser-visible-comments",
	        account: "facebook/profile + search"
	      },
	      note: facebookApiAvailable
	        ? "关键词和 Link 评论优先走 Apify；API 失败时才回退浏览器。"
	        : (cloakKeywordAvailable ? "关键词优先走 CloakBrowser 搜索页采集，失败回退 opencli；Link 模式按评论导表 SOP，从已登录浏览器可见评论区采集。" : "Link 模式按评论导表 SOP，从已登录浏览器可见评论区采集。")
    },
    {
      platform: "Google",
      priority: priorityOf("Google"),
      enabled: Boolean(googleSupportedModes.length),
      supportedModes: googleSupportedModes,
      disabledReason: googleSupportedModes.length ? "" : "关键词和目标链接采集需要 Apify API token。",
      requiresFirecrawl: false,
      consumesBrowserBudget: webFirst && opencliAvailable && !googleLinkApiAvailable,
      budgetCostHint: webFirst
        ? "关键词优先走 CloakBrowser Google 搜索页，失败后回退 opencli / Apify；目标网页通过 Apify Website Content Crawler 抓取。"
        : "关键词走 Apify Google Search to Full Article actor；目标网页走 Apify Website Content Crawler。",
      budgetCosts: { keywordSearch: webFirst && (cloakBrowserAvailable || opencliAvailable) ? 1 : 0, keywordEnrich: 0, link: googleLinkApiAvailable ? 0 : 5, account: 0, monitorSearch: webFirst && (cloakBrowserAvailable || opencliAvailable) ? 1 : 0, monitorEnrich: 0 },
      routes: {
        keywordSearch: keywordRoute("Google", `apify:actor:${APIFY_GOOGLE_FULL_ARTICLE_ACTOR}`),
        monitorSearch: keywordRoute("Google", `apify:actor:${APIFY_GOOGLE_FULL_ARTICLE_ACTOR}`),
        link: googleLinkApiAvailable ? `apify:actor:${APIFY_WEBSITE_CONTENT_CRAWLER_ACTOR}` : "social-comment-export/browser-visible-page"
      },
      note: webFirst
        ? "Google 关键词采集优先通过 CloakBrowser 页面采集；无结果或失败时回退 Apify。目标 Link 优先通过 Apify 抓取网页正文。"
        : "Google 关键词采集通过 Apify 提取搜索结果与文章全文；目标 Link 优先通过 Apify 抓取网页正文。"
    },
    {
      platform: "Google News",
      priority: priorityOf("Google News"),
      enabled: opencliAvailable,
      supportedModes: ["keyword", "monitor"],
      disabledReason: disabledByOpencli,
      requiresFirecrawl: false,
      consumesBrowserBudget: false,
      budgetCostHint: "不占浏览器预算；有 Firecrawl 时补正文",
      budgetCosts: { keywordSearch: 0, keywordEnrich: 0, link: 0, account: 0, monitorSearch: 0, monitorEnrich: 0 },
      routes: {
        keywordSearch: keywordRoute("Google News", "google/news"),
        monitorSearch: keywordRoute("Google News", "google/news")
      },
      note: cloakKeywordAvailable ? "关键词优先走 CloakBrowser 新闻搜索页，失败回退 opencli；需要正文时再补采。" : firecrawlAvailable ? "可用 Firecrawl 补正文。" : "无 Firecrawl key 时仅返回标题、来源、时间和 URL。"
    },
    {
      platform: "全网",
      priority: priorityOf("全网"),
      enabled: firecrawlAvailable,
      supportedModes: ["keyword", "monitor"],
      disabledReason: firecrawlAvailable ? "" : "需要 Firecrawl API key。",
      requiresFirecrawl: true,
      consumesBrowserBudget: false,
      budgetCostHint: "不占浏览器预算；由 Firecrawl search 提供；Link 评论链路由 Google 平台处理",
      budgetCosts: { keywordSearch: 0, keywordEnrich: 0, link: 0, account: 0, monitorSearch: 0, monitorEnrich: 0 },
      routes: {
        keywordSearch: "firecrawl/search",
        monitorSearch: "firecrawl/search"
      },
      note: "用于关键词/监控的网页兜底；目标 Link 评论导表链路请使用 Google。"
    },
    {
      platform: "LinkedIn",
      priority: priorityOf("LinkedIn"),
      enabled: linkedInApifyAvailable || opencliAvailable,
      supportedModes: linkedInSupportedModes,
      disabledReason: linkedInApifyAvailable || opencliAvailable ? "" : "需要 Apify API token，或可用的 opencli 浏览器登录态。",
      requiresFirecrawl: false,
      consumesBrowserBudget: webFirst || !linkedInApifyAvailable,
      budgetCostHint: linkedInApifyAvailable
        ? (webFirst ? "关键词优先走 CloakBrowser LinkedIn 内容搜索页，失败后回退 Apify；Link 评论优先通过 Apify LinkedIn post comments actor" : "关键词走 Apify LinkedIn post search actor；Link 评论优先通过 Apify LinkedIn post comments actor")
        : "Link 评论通过浏览器访问目标页面并读取可见评论约 5 次",
      budgetCosts: { keywordSearch: webFirst && cloakBrowserAvailable ? 1 : linkedInApifyAvailable ? 1 : 0, keywordEnrich: 0, link: linkedInApifyAvailable ? 1 : 5, account: 0, monitorSearch: webFirst && cloakBrowserAvailable ? 1 : linkedInApifyAvailable ? 1 : 0, monitorEnrich: 0 },
      routes: {
        keywordSearch: keywordRoute("LinkedIn", linkedInApifyAvailable ? `apify:actor:${APIFY_LINKEDIN_POST_SEARCH_ACTOR}` : ""),
        monitorSearch: keywordRoute("LinkedIn", linkedInApifyAvailable ? `apify:actor:${APIFY_LINKEDIN_POST_SEARCH_ACTOR}` : ""),
        link: linkedInApifyAvailable
          ? `apify:actor:${APIFY_LINKEDIN_COMMENTS_ACTOR}`
          : "social-comment-export/linkedin-browser-visible-comments"
      },
      note: linkedInApifyAvailable
        ? (webFirst ? `关键词模式优先使用 CloakBrowser 访问 LinkedIn 内容搜索页；失败或无结果时再使用 Apify actor ${APIFY_LINKEDIN_POST_SEARCH_ACTOR}。Link 模式使用 ${APIFY_LINKEDIN_COMMENTS_ACTOR} 采集帖子评论。` : `关键词模式使用 Apify actor ${APIFY_LINKEDIN_POST_SEARCH_ACTOR} 搜索 LinkedIn 帖子；Link 模式使用 ${APIFY_LINKEDIN_COMMENTS_ACTOR} 采集帖子评论。`)
        : "仅 Link 模式启用：未配置 Apify 时通过浏览器访问目标 LinkedIn 页面，再采集页面上可见评论。"
    }
  ];
  return catalog.map((entry) => applyRuntimePlatformState({
    ...entry,
    keywordProviders: keywordCapabilitiesForPlatform(entry.platform),
    keywordProviderHint: describeKeywordCapabilitiesForPlatform(entry.platform),
    commentProviders: commentCapabilitiesForPlatform(entry.platform),
    commentProviderHint: describeCommentCapabilitiesForPlatform(entry.platform)
  }));
}

function isApiProviderReady(providerId) {
  const provider = apiProviderRegistry.get(providerId);
  return Boolean(provider?.enabled && provider?.configured);
}

function priorityOf(platform) {
  const index = PLATFORM_PRIORITY.indexOf(platform);
  return index === -1 ? PLATFORM_PRIORITY.length + 1 : index + 1;
}

function platformIndex(catalog) {
  return new Map(catalog.map((platform) => [platform.platform, platform]));
}

function sortPlatformsByPriority(platforms, catalog) {
  const index = platformIndex(catalog);
  return [...platforms].sort((left, right) => {
    return (index.get(left)?.priority || 999) - (index.get(right)?.priority || 999);
  });
}

function applyRuntimePlatformState(entry) {
  const runtime = platformRuntimeState.get(entry.platform);
  if (!runtime) {
    return entry;
  }
  const note = entry.platform === "LinkedIn" && runtime.status === "ok"
    ? entry.note
    : runtime.note || entry.note;
  return {
    ...entry,
    enabled: typeof runtime.enabled === "boolean" ? runtime.enabled : entry.enabled,
    disabledReason: runtime.disabledReason ?? entry.disabledReason,
    note,
    runtimeStatus: runtime.status || "unknown",
    runtimeObservedAt: runtime.observedAt || null
  };
}

function recordPlatformSuccess(platform, detail = {}) {
  const previous = platformRuntimeState.get(platform) || {};
  platformRuntimeState.set(platform, {
    ...previous,
    status: "ok",
    enabled: true,
    disabledReason: "",
    note: detail.note || previous.note || "当前环境已验证可运行。",
    observedAt: new Date().toISOString()
  });
  persistPlatformRuntimeState();
}

function recordPlatformFailure(platform, error, context = {}) {
  const insight = classifyPlatformFailure(platform, error, context);
  if (!insight) {
    return;
  }
  const previous = platformRuntimeState.get(platform) || {};
  platformRuntimeState.set(platform, {
    ...previous,
    ...insight,
    observedAt: new Date().toISOString()
  });
  persistPlatformRuntimeState();
}

function classifyPlatformFailure(platform, error, context = {}) {
  const message = error instanceof Error ? error.message : String(error || "");
  if (!message) {
    return null;
  }

  if (platform === "小红书" && /AUTH_REQUIRED|login wall|log in to https:\/\/www\.xiaohongshu\.com/i.test(message)) {
    return {
      status: "auth_required",
      enabled: false,
      disabledReason: "当前环境未登录小红书，需先在 Chrome 或 Chromium 登录后再提交。",
      note: "小红书当前被登录墙拦住；登录后刷新即可重新启用。"
    };
  }

  if (platform === "Google News" && /Connect Timeout Error|fetch failed|timeout/i.test(message)) {
    return {
      status: "network_blocked",
      enabled: false,
      disabledReason: "当前网络到 Google News 超时，暂不可提交。",
      note: "Google News 在当前环境超时；网络恢复后刷新即可重新启用。"
    };
  }

  if (platform === "B站" && /videoData\.cid|bilibili\/subtitle|字幕/i.test(message)) {
    return {
      status: "degraded",
      enabled: true,
      disabledReason: "",
      note: "B站搜索当前可用，但字幕补采不稳定；会保留搜索结果与评论结果。"
    };
  }

  if (platform === "YouTube" && /No captions available|transcript/i.test(message)) {
    return {
      status: "degraded",
      enabled: true,
      disabledReason: "",
      note: "YouTube 搜索当前可用；部分视频没有字幕，转录补采会自动跳过。"
    };
  }

  if (platform === "微博" && /No Weibo search results found|NOT_FOUND/i.test(message)) {
    return {
      status: "no_results",
      enabled: true,
      disabledReason: "",
      note: "微博最近一次关键词没有结果；建议尝试中文关键词或确认微博登录态。"
    };
  }

  if (/timed out after|timeout/i.test(message)) {
    return {
      status: "timeout",
      enabled: true,
      disabledReason: "",
      note: `${platform} 最近一次请求超时，可稍后重试。`
    };
  }

  if (/AUTH_REQUIRED|Please open Chrome|Please open Chromium|log in/i.test(message)) {
    return {
      status: "auth_required",
      enabled: false,
      disabledReason: `${platform} 当前需要先在浏览器完成登录态。`,
      note: `${platform} 登录完成后刷新即可重新启用。`
    };
  }

  if (context.hadPosts) {
    return {
      status: "degraded",
      enabled: true,
      disabledReason: "",
      note: `${platform} 当前可返回样本，但补采阶段有部分能力不稳定。`
    };
  }

  return null;
}

function loadPlatformRuntimeState() {
  try {
    if (!fs.existsSync(PLATFORM_RUNTIME_STATE_PATH)) {
      return new Map();
    }
    const raw = fs.readFileSync(PLATFORM_RUNTIME_STATE_PATH, "utf8");
    const json = raw ? JSON.parse(raw) : {};
    return new Map(Object.entries(json));
  } catch (_error) {
    return new Map();
  }
}

function persistPlatformRuntimeState() {
  const payload = Object.fromEntries(platformRuntimeState.entries());
  fs.writeFileSync(PLATFORM_RUNTIME_STATE_PATH, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function resetTransientPlatformRuntimeState() {
  let mutated = false;
  for (const [platform, state] of platformRuntimeState.entries()) {
    if (state?.status && state.status !== "ok") {
      platformRuntimeState.delete(platform);
      mutated = true;
    }
  }
  if (mutated) {
    persistPlatformRuntimeState();
  }
}

function prepareTaskForRun(task, input) {
  clearMonitorTimer(task.id);
  const previousPosts = task.result?.posts || [];
  const previousRows = task.result?.rows || [];
  updateTask(task, {
    mode: input.mode,
    monitorEnabled: Boolean(input.monitorEnabled),
    timeRange: input.timeWindow?.label || input.timeRange,
    timeStart: input.timeWindow?.startDate || input.timeStart || "",
    timeEnd: input.timeWindow?.endDate || input.timeEnd || "",
    subtitle: buildTaskSubtitle(input),
    route: "",
    status: input.monitorEnabled ? "监控中" : "运行中",
    tone: "blue",
    progress: 4,
    nextRunAt: "",
    providers: [],
    plan: null,
    warnings: [],
    errors: [],
    result: {
      posts: previousPosts,
      rows: previousRows,
      rowHeaders: rowHeadersForInput(input),
      raw: [],
      emptyReason: "",
      stats: {
        platformsRequested: input.platforms.length,
        platformsCompleted: 0,
        opencliCalls: 0,
        opencliBrowserCalls: 0,
        opencliBrowserCallLimit: OPENCLI_BROWSER_CALL_LIMIT,
        cloakBrowserCalls: 0,
        browserEngine: browserEnginePreference(),
        firecrawlCalls: 0,
        apiUsage: {}
      }
    }
  });
}

function finishTaskRun(task, patch, message) {
  const completedAt = new Date().toISOString();
  updateTask(task, {
    ...patch,
    runCount: (task.runCount || 0) + 1,
    resultVersion: (task.resultVersion || 0) + 1,
    lastRunCompletedAt: completedAt,
    nextRunAt: ""
  });
  logTask(task, message);
}

function scheduleMonitorRun(task, input) {
  if (!task.monitorEnabled || !tasks.has(task.id)) {
    return;
  }
  clearMonitorTimer(task.id);
  const nextRunAt = new Date(Date.now() + MONITOR_INTERVAL_MS).toISOString();
  updateTask(task, {
    status: "监控中",
    tone: task.errors?.length ? "amber" : task.tone || "blue",
    nextRunAt
  });
  logTask(task, `持续监控已排队，${MONITOR_INTERVAL_MINUTES} 分钟后自动开始下一轮。`);
  const timer = setTimeout(() => {
    monitorTimers.delete(task.id);
    if (!tasks.has(task.id) || !task.monitorEnabled) {
      return;
    }
    runTaskLoop(task, input);
  }, MONITOR_INTERVAL_MS);
  monitorTimers.set(task.id, timer);
}

async function runTaskLoop(task, input) {
  try {
    await runTask(task, input);
  } catch (error) {
    failTask(task, error);
  } finally {
    if (task.monitorEnabled && tasks.has(task.id)) {
      scheduleMonitorRun(task, input);
    }
  }
}

async function runTask(task, input) {
  prepareTaskForRun(task, input);
  const firecrawl = createFirecrawlClient(input.firecrawlApiKey || process.env.FIRECRAWL_API_KEY || "", task);
  const catalog = getPlatformCatalog({ firecrawlAvailable: firecrawl.available });
  const plan = buildTaskExecutionPlan({ input, catalog });
  const resultsByPlatform = new Map();
  const providersUsed = new Set();
  const routeParts = new Set();

  logTask(task, `开始执行 ${modeLabel(input.mode)}。`);
  if (["keyword", "monitor"].includes(input.mode) && input.timeWindow?.hasWindow) {
    logTask(task, `采集时间范围：${input.timeWindow.label}。`);
  }
  task.plan = plan.preview;

  for (const warning of plan.initialWarnings) {
    warnTask(task, warning);
  }

  if (!plan.steps.length) {
    task.result.emptyReason = plan.initialWarnings[0] || "没有可执行的平台。";
    finishTaskRun(
      task,
      task.monitorEnabled
        ? { status: "监控中", tone: "red", progress: 100 }
        : { status: "失败", tone: "red", progress: 100 },
      "任务失败：没有可执行的平台。"
    );
    return;
  }

  for (let index = 0; index < plan.steps.length; index += 1) {
    const step = plan.steps[index];
    const progressStart = Math.round((index / plan.steps.length) * 88) + 8;
    updateTask(task, { progress: progressStart });
    logTask(task, `开始处理 ${step.platform} · ${step.label}。`);

    try {
      const posts = await executePlanStep({
        step,
        input,
        task,
        firecrawl,
        existingPosts: resultsByPlatform.get(step.platform) || []
      });

      if (Array.isArray(posts)) {
        resultsByPlatform.set(step.platform, posts);
      }

      const currentPosts = resultsByPlatform.get(step.platform) || [];
      if (currentPosts.length) {
        recordPlatformSuccess(step.platform, {
          note: step.stage === "keywordEnrich"
            ? `${step.platform} 当前环境已验证可返回搜索与补采样本。`
            : `${step.platform} 当前环境已验证可返回真实样本。`
        });
      }
      if (currentPosts.length) {
        task.result.stats.platformsCompleted = Math.max(
          task.result.stats.platformsCompleted,
          Array.from(resultsByPlatform.values()).filter((rows) => rows.length).length
        );
        currentPosts.forEach((post) => providersUsed.add(post.source));
      }
      routeParts.add(step.route);
      logTask(task, `${step.platform} · ${step.label} 完成，当前累计 ${currentPosts.length} 条样本。`);
    } catch (error) {
      const message = errorMessage(error);
      recordPlatformFailure(step.platform, error, {
        stage: step.stage,
        hadPosts: Boolean((resultsByPlatform.get(step.platform) || []).length)
      });
      task.errors.push(`${step.platform}: ${message}`);
      logTask(task, `${step.platform} · ${step.label} 失败：${message}`);
    }
  }

  updateTask(task, { progress: 96 });
  const allPosts = Array.from(resultsByPlatform.values()).flat();

  if (!allPosts.length && task.errors.length) {
    task.result.emptyReason = task.errors[0];
    finishTaskRun(
      task,
      task.monitorEnabled
        ? { status: "监控中", tone: "red", progress: 100, route: Array.from(routeParts).join(" + ") }
        : { status: "失败", tone: "red", progress: 100, route: Array.from(routeParts).join(" + ") },
      "没有采集到有效样本。"
    );
    return;
  }

  task.providers = Array.from(providersUsed);
  task.route = Array.from(routeParts).join(" + ");
  task.result.posts = dedupePosts(allPosts);
  task.result.rowHeaders = rowHeadersForTask(input, task.result.posts);
  task.result.rows = buildRowsForTask(task.result.posts, input, task);
  task.result.stats.totalPosts = task.result.posts.length;
  if (!task.result.posts.length) {
    task.result.emptyReason = task.warnings[0] || task.errors[0] || "任务完成，但没有返回可展示样本。";
  }

  const finishedWithWarnings = Boolean(task.errors.length || task.warnings.length);
  finishTaskRun(
    task,
    task.monitorEnabled
      ? { status: "监控中", tone: finishedWithWarnings ? "amber" : "blue", progress: 100 }
      : { status: finishedWithWarnings ? "部分完成" : "完成", tone: finishedWithWarnings ? "amber" : "green", progress: 100 },
    `任务结束，共返回 ${task.result.posts.length} 条样本。`
  );
}

function buildTaskExecutionPlan({ input, catalog }) {
  const index = platformIndex(catalog);
  const inferredLinkPlatform = input.mode === "link" ? inferCommentLinkPlatform(input.subject) : "";
  const selected = sortPlatformsByPriority(input.platforms, catalog)
    .map((platform) => index.get(platform))
    .filter(Boolean);
  const runnable = [];
  const initialWarnings = [];
  let browserBudget = OPENCLI_BROWSER_CALL_LIMIT;

  for (const entry of selected) {
    if (!entry.enabled) {
      initialWarnings.push(`${entry.platform} 已跳过：${entry.disabledReason}`);
      continue;
    }
    if (!entry.supportedModes.includes(input.mode)) {
      initialWarnings.push(`${entry.platform} 已跳过：当前模式不支持。`);
      continue;
    }
    if (input.mode === "link" && !COMMENT_LINK_PLATFORMS.has(entry.platform)) {
      initialWarnings.push(`${entry.platform} 已跳过：目标 Link 评论采集路由尚未接入后端。`);
      continue;
    }
    if (input.mode === "link" && inferredLinkPlatform && entry.platform !== inferredLinkPlatform) {
      initialWarnings.push(`${entry.platform} 已跳过：目标链接识别为 ${inferredLinkPlatform} 评论链路。`);
      continue;
    }
    runnable.push(entry);
  }

  const steps = [];
  const preview = {
    selected: selected.map((entry) => entry.platform),
    runnable: runnable.map((entry) => entry.platform),
    initialWarnings: [...initialWarnings],
    browserBudgetLimit: OPENCLI_BROWSER_CALL_LIMIT,
    browserBudgetPredicted: 0,
    browserBudgetRemaining: OPENCLI_BROWSER_CALL_LIMIT,
    searchPlatforms: [],
    enrichPlatforms: [],
    skippedByBudget: [],
    directPlatforms: []
  };

  if (["keyword", "monitor"].includes(input.mode)) {
    for (const entry of runnable) {
      const searchCost = entry.consumesBrowserBudget ? (entry.budgetCosts.keywordSearch || 0) : 0;
      if (searchCost > browserBudget) {
        const reason = `${entry.platform} 因预算跳过：剩余预算不足以执行关键词搜索。`;
        initialWarnings.push(reason);
        preview.skippedByBudget.push(entry.platform);
        continue;
      }
      browserBudget -= searchCost;
      steps.push({
        platform: entry.platform,
        stage: "keywordSearch",
        label: "搜索阶段",
        route: entry.routes.keywordSearch || entry.platform,
        predictedBudgetCost: searchCost
      });
      preview.searchPlatforms.push(entry.platform);
      preview.browserBudgetPredicted += searchCost;
    }

    for (const entry of runnable) {
      const enrichCost = entry.consumesBrowserBudget ? (entry.budgetCosts.keywordEnrich || 0) : 0;
      if (!enrichCost) {
        continue;
      }
      if (enrichCost > browserBudget) {
        initialWarnings.push(`${entry.platform} 仅执行搜索：剩余预算不足，已跳过详情/评论补采。`);
        preview.skippedByBudget.push(`${entry.platform}（补采）`);
        continue;
      }
      browserBudget -= enrichCost;
      steps.push({
        platform: entry.platform,
        stage: "keywordEnrich",
        label: "补采阶段",
        route: entry.routes.keywordEnrich || entry.platform,
        predictedBudgetCost: enrichCost
      });
      preview.enrichPlatforms.push(entry.platform);
      preview.browserBudgetPredicted += enrichCost;
    }
  } else {
    for (const entry of runnable) {
      const modeCost = entry.consumesBrowserBudget ? (entry.budgetCosts[input.mode] || 0) : 0;
      if (modeCost > browserBudget) {
        initialWarnings.push(`${entry.platform} 因预算跳过：剩余预算不足以执行 ${modeLabel(input.mode)}。`);
        preview.skippedByBudget.push(entry.platform);
        continue;
      }
      browserBudget -= modeCost;
      steps.push({
        platform: entry.platform,
        stage: input.mode,
        label: modeLabel(input.mode),
        route: entry.routes[input.mode] || entry.platform,
        predictedBudgetCost: modeCost
      });
      preview.directPlatforms.push(entry.platform);
      preview.browserBudgetPredicted += modeCost;
    }
  }

  preview.browserBudgetRemaining = browserBudget;
  return { steps, initialWarnings, preview };
}

async function executePlanStep({ step, input, task, firecrawl, existingPosts }) {
  if (!input.subject) {
    throw new Error("研究对象不能为空");
  }

  if (step.stage === "keywordSearch") {
    return executeKeywordSearch(step.platform, input, task, firecrawl);
  }
  if (step.stage === "keywordEnrich") {
    return executeKeywordEnrich(step.platform, existingPosts, input, task, firecrawl);
  }

  return executeDirectMode(step.platform, step.stage, input, task, firecrawl);
}

async function executeKeywordSearch(platform, input, task, firecrawl) {
  let posts = [];
  switch (platform) {
    case "X":
      posts = await collectXKeywordSearch(input.subject, input, task);
      break;
    case "Reddit":
      posts = await collectRedditKeywordSearch(input.subject, input, task);
      break;
    case "TikTok":
      posts = await collectTikTokKeywordSearch(input.subject, input, task);
      break;
    case "Instagram":
      posts = await collectInstagramKeywordSearchOnly(input.subject, input, task);
      break;
    case "Facebook":
      posts = await collectFacebookKeyword(input.subject, input, task);
      break;
    case "Google":
      posts = await collectGoogleKeywordSearch(input.subject, input, task);
      break;
    case "Google News":
      posts = await collectGoogleNews(input.subject, input, task, firecrawl);
      break;
    case "LinkedIn":
      posts = await collectLinkedInKeywordSearch(input.subject, input, task);
      break;
    case "全网":
      posts = await collectFirecrawlWeb(input.subject, input, task, firecrawl);
      break;
    case "小红书":
      posts = await collectXiaohongshuKeywordSearch(input.subject, input, task);
      break;
    case "微博":
      posts = await collectWeiboKeywordSearch(input.subject, input, task);
      break;
    case "B站":
      posts = await collectBilibiliKeywordSearch(input.subject, input, task);
      break;
    case "YouTube":
      posts = await collectYouTubeKeywordSearch(input.subject, input, task);
      break;
    default:
      warnTask(task, `${platform} 还没有接入真实采集器。`);
      posts = [];
  }
  return filterKeywordPostsByTimeWindow(platform, posts, input, task, {
    nativeFilterApplied: keywordSearchUsesNativeTimeFilter(platform, input)
  });
}

async function executeKeywordEnrich(platform, posts, input, task, firecrawl) {
  if (!posts.length) {
    warnTask(task, `${platform} 搜索阶段没有返回候选样本，已跳过补采。`);
    return posts;
  }

  switch (platform) {
    case "X":
      return filterKeywordPostsByTimeWindow(platform, await enrichXKeywordPosts(posts, input, task), input, task);
    case "Reddit":
      return filterKeywordPostsByTimeWindow(platform, await enrichRedditKeywordPosts(posts, input, task), input, task, {
        nativeFilterApplied: keywordSearchUsesNativeTimeFilter(platform, input)
      });
    case "Instagram":
      return filterKeywordPostsByTimeWindow(platform, await enrichInstagramKeywordPosts(posts, input, task), input, task);
    case "小红书":
      return filterKeywordPostsByTimeWindow(platform, await enrichXiaohongshuKeywordPosts(posts, input, task), input, task);
    case "微博":
      return filterKeywordPostsByTimeWindow(platform, await enrichWeiboKeywordPosts(posts, input, task), input, task);
    case "B站":
      return filterKeywordPostsByTimeWindow(platform, await enrichBilibiliKeywordPosts(posts, input, task, firecrawl), input, task);
    case "YouTube":
      return filterKeywordPostsByTimeWindow(platform, await enrichYouTubeKeywordPosts(posts, input, task), input, task, {
        nativeFilterApplied: keywordSearchUsesNativeTimeFilter(platform, input)
      });
    default:
      return posts;
  }
}

async function executeDirectMode(platform, mode, input, task, firecrawl) {
  if (platform === "X") {
    return mode === "account"
      ? collectXAccount(input.subject, input, task)
      : collectXLinkComments(input.subject, input, task);
  }
  if (platform === "Reddit") {
    return mode === "account"
      ? collectRedditAccount(input.subject, input, task)
      : collectRedditLink(input.subject, input, task);
  }
  if (platform === "TikTok") {
    return collectTikTokLinkComments(input.subject, input, task);
  }
  if (platform === "Instagram") {
    return mode === "account"
      ? collectInstagramAccount(input.subject, input, task)
      : collectInstagramPostComments(input.subject, input, task);
  }
  if (platform === "Facebook") {
    return mode === "account"
      ? collectFacebookAccount(input.subject, input, task)
      : collectFacebookLinkComments(input.subject, input, task);
  }
  if (platform === "Google") {
    return collectGoogleLinkComments(input.subject, input, task, firecrawl);
  }
  if (platform === "Google News") {
    return collectGoogleNews(input.subject, input, task, firecrawl);
  }
  if (platform === "全网") {
    return collectFirecrawlWeb(input.subject, input, task, firecrawl);
  }
  if (platform === "小红书") {
    return mode === "account"
      ? collectXiaohongshuAccount(input.subject, input, task)
      : collectXiaohongshuLink(input.subject, input, task);
  }
  if (platform === "微博") {
    return mode === "account"
      ? collectWeiboAccount(input.subject, input, task)
      : collectWeiboLink(input.subject, input, task);
  }
  if (platform === "B站") {
    return mode === "account"
      ? collectBilibiliAccount(input.subject, input, task)
      : collectBilibiliLink(input.subject, input, task, firecrawl);
  }
  if (platform === "YouTube") {
    return mode === "account"
      ? collectYouTubeAccount(input.subject, input, task)
      : collectYouTubeLink(input.subject, input, task);
  }
  if (platform === "LinkedIn") {
    return collectLinkedInLinkComments(input.subject, input, task);
  }

  warnTask(task, `${platform} 还没有接入真实采集器。`);
  return [];
}

function shouldUseCloakBrowserKeywordCollector(platform) {
  return keywordWebFirstEnabled() && shouldTryCloakBrowser() && CLOAKBROWSER_KEYWORD_PLATFORMS.has(platform);
}

async function collectKeywordWithCloakBrowserFirst(platform, query, input, task, fallbackCollector) {
  if (shouldUseCloakBrowserKeywordCollector(platform)) {
    try {
      const records = await collectCloakBrowserKeywordSearch(platform, query, input, task);
      const posts = records
        .map((record, index) => cloakBrowserKeywordPost(platform, record, query, index))
        .filter(Boolean);
      if (posts.length) {
        logTask(task, `${platform} 关键词已优先使用 CloakBrowser 页面采集，返回 ${posts.length} 条。`);
        return posts;
      }
      warnTask(task, `${platform} CloakBrowser 关键词采集没有返回样本。`);
    } catch (error) {
      warnTask(task, `${platform} CloakBrowser 关键词采集失败：${error instanceof Error ? error.message : String(error)}`);
    }
    logTask(task, `${platform} CloakBrowser 关键词采集未命中，已回退原有采集路径。`);
  }
  return fallbackCollector();
}

async function collectKeywordWithApiFirst(platform, task, apiProviderId, apiCollector, browserCollector) {
  if (!keywordWebFirstEnabled() && keywordApiFallbackEnabled() && isApiProviderReady(apiProviderId)) {
    try {
      const apiPosts = await apiCollector();
      if (apiPosts.length) {
        logTask(task, `${platform} 关键词已使用 API 采集，返回 ${apiPosts.length} 条。`);
        return apiPosts;
      }
      warnTask(task, `${platform} API 关键词采集没有返回可导出的样本。`);
    } catch (error) {
      warnTask(task, `${platform} API 关键词采集失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (browserCollector && opencliVersion) {
    try {
      const browserPosts = await browserCollector();
      if (browserPosts.length) {
        logTask(task, `${platform} 关键词已回退浏览器采集，返回 ${browserPosts.length} 条。`);
        return browserPosts;
      }
      warnTask(task, `${platform} 浏览器关键词采集没有返回样本。`);
    } catch (error) {
      warnTask(task, `${platform} 浏览器关键词采集失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (keywordApiFallbackEnabled() && keywordWebFirstEnabled() && isApiProviderReady(apiProviderId)) {
    try {
      const apiPosts = await apiCollector();
      if (apiPosts.length) {
        logTask(task, `${platform} 浏览器采集未命中，已回退 API，返回 ${apiPosts.length} 条。`);
        return apiPosts;
      }
      warnTask(task, `${platform} API 兜底没有返回可导出的样本。`);
    } catch (error) {
      warnTask(task, `${platform} API 兜底失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (!isApiProviderReady(apiProviderId)) {
    warnTask(task, `${platform} API provider 未配置或未启用。`);
  }
  return [];
}

function apiKeywordPosts(platform, payload, query, source, limit = API_KEYWORD_MAX_RESULTS) {
  return extractApiResultItems(payload)
    .map((record, index) => apiKeywordPost(platform, record, query, source, index))
    .filter(Boolean)
    .slice(0, limit);
}

function extractApiResultItems(payload) {
  const directPaths = [
    "data.entries",
    "data.videos",
    "data.shorts",
    "data.posts",
    "data.results",
    "data.items",
    "data.list",
    "data.children",
    "data.data.entries",
    "data.data.videos",
    "data.data.posts",
    "data.data.results",
    "data.data.items",
    "data.data.list",
    "entries",
    "videos",
    "shorts",
    "posts",
    "results",
    "items",
    "list"
  ];
  for (const pathName of directPaths) {
    const value = valueAtPath(payload, pathName);
    if (Array.isArray(value) && value.length) {
      return value;
    }
  }
  if (Array.isArray(payload)) {
    return payload;
  }
  const arrays = [];
  collectApiResultArrays(payload, arrays, 0);
  return arrays.sort((left, right) => right.length - left.length)[0] || [];
}

function collectApiResultArrays(value, arrays, depth) {
  if (!value || depth > 7) return;
  if (Array.isArray(value)) {
    if (value.some(looksLikeApiResultRecord)) {
      arrays.push(value);
    }
    value.forEach((item) => collectApiResultArrays(item, arrays, depth + 1));
    return;
  }
  if (typeof value !== "object") return;
  for (const child of Object.values(value)) {
    collectApiResultArrays(child, arrays, depth + 1);
  }
}

function looksLikeApiResultRecord(record) {
  if (!record || typeof record !== "object") return false;
  return Boolean(apiResultText(record) || apiResultUrl(record) || apiResultAuthor(record));
}

function apiKeywordPost(platform, record, query, source, index) {
  const content = apiResultText(record);
  const title = apiResultTitle(record) || trimText(content, 76);
  const author = apiResultAuthor(record);
  const id = apiResultId(record);
  const url = apiResultUrl(record, platform, id, author);
  if (!title && !content && !url && !author) {
    return null;
  }
  const textForScoring = [title, content, author].filter(Boolean).join(" ");
  return normalizePost({
    id: `${platformCode(platform)}_api_${slugify(id || url || title || content || index)}`,
    title: title || `${platform} API 结果 ${index + 1}`,
    body: content || title || "",
    platform,
    source,
    score: scoreFromQuery(query, textForScoring),
    sentiment: sentimentFromText(textForScoring),
    comments: apiNumberFromRecord(record, ["comments", "commentCount", "comment_count", "commentsCount", "replyCount", "reply_count", "stats.commentCount"]),
    likes: apiNumberFromRecord(record, ["likes", "likeCount", "like_count", "favorite_count", "favoriteCount", "diggCount", "stats.diggCount", "view_count", "views", "score"]),
    url,
    author,
    publishedAt: apiPublishedAt(record),
    themes: themePairsFromTexts([content || title || author || ""])
  });
}

function apiResultTitle(record) {
  return findFirstTextByKeys(record, [
    "title",
    "headline",
    "name",
    "content.title",
    "video.title",
    "snippet.title",
    "metadata.title"
  ]);
}

function apiResultText(record) {
  return findFirstTextByKeys(record, [
    "text",
    "full_text",
    "fullText",
    "content.text",
    "content.full_text",
    "description",
    "desc",
    "caption",
    "body",
    "selftext",
    "snippet",
    "summary",
    "message",
    "postText",
    "post_text"
  ]);
}

function apiResultAuthor(record) {
  return findFirstTextByKeys(record, [
    "author",
    "authorName",
    "author_name",
    "username",
    "screen_name",
    "user.screen_name",
    "user.username",
    "user.name",
    "author.username",
    "author.name",
    "authorMeta.name",
    "authorMeta.nickName",
    "authorMeta.uniqueId",
    "channel",
    "channelName",
    "channel.name",
    "owner",
    "subreddit"
  ]);
}

function apiResultId(record) {
  return findFirstTextByKeys(record, [
    "id",
    "id_str",
    "tweet_id",
    "tweetId",
    "rest_id",
    "aweme_id",
    "video_id",
    "videoId",
    "postId",
    "post_id",
    "shortcode",
    "code",
    "content.id",
    "content.rest_id",
    "video.id",
    "snippet.resourceId.videoId"
  ]);
}

function apiResultUrl(record, platform = "", id = "", author = "") {
  const direct = findFirstTextByKeys(record, [
    "url",
    "link",
    "permalink",
    "postUrl",
    "post_url",
    "tweet_url",
    "share_url",
    "shareUrl",
    "webVideoUrl",
    "video_url",
    "videoUrl",
    "content.url",
    "content.itemContent.tweet_results.result.legacy.entities.urls.expanded_url"
  ]);
  if (direct) {
    return normalizeSocialUrl(direct);
  }
  if (platform === "X") {
    return buildXStatusUrl(author, id);
  }
  if (platform === "YouTube" && id) {
    return `https://www.youtube.com/watch?v=${id}`;
  }
  if (platform === "TikTok" && author && id) {
    return `https://www.tiktok.com/@${String(author).replace(/^@/, "")}/video/${id}`;
  }
  return "";
}

function apiPublishedAt(record) {
  const direct = findFirstTextByKeys(record, [
    "publishedAt",
    "published_at",
    "createdAt",
    "created_at",
    "createTimeISO",
    "create_time_iso",
    "date",
    "datetime",
    "time",
    "timestamp",
    "created_utc",
    "published",
    "uploadDate"
  ]);
  if (normalizeIsoInstant(direct)) {
    return normalizeIsoInstant(direct);
  }
  const numeric = Number(direct || valueAtPath(record, "createTime") || valueAtPath(record, "create_time") || valueAtPath(record, "created_utc"));
  if (Number.isFinite(numeric) && numeric > 0) {
    return new Date(numeric > 1_000_000_000_000 ? numeric : numeric * 1000).toISOString();
  }
  return direct || "";
}

function apiNumberFromRecord(record, keys) {
  for (const key of keys) {
    const value = valueAtPath(record, key);
    const numeric = numberValue(value);
    if (numeric) return numeric;
  }
  const found = findFirstTextByKeys(record, keys);
  return numberValue(found);
}

function cloakBrowserKeywordPost(platform, record, query, index) {
  if (!record || typeof record !== "object") {
    return null;
  }
  const title = firstTextValue(record, ["title", "body", "text", "content", "desc"]);
  const body = firstTextValue(record, ["body", "text", "content", "desc", "title"]);
  const author = firstTextValue(record, ["author", "username", "name", "channel"]);
  const url = firstTextValue(record, ["url", "link"]);
  if (!title && !body && !url && !author) {
    return null;
  }
  const sourceLabel = `CloakBrowser ${platform} keyword search`;
  return normalizePost({
    id: `cloak_${platformCode(platform)}_${slugify(url || title || body || author || index)}`,
    title: trimText(title || body, 90) || `${platform} 搜索结果 ${index + 1}`,
    body: trimText(body || title || "", 420),
    platform,
    source: sourceLabel,
    score: scoreFromQuery(query, `${title || ""} ${body || ""} ${author || ""}`),
    sentiment: sentimentFromText(`${title || ""} ${body || ""}`),
    comments: numberFromRecord(record, ["comments", "commentCount", "comment_count"]),
    likes: numberFromRecord(record, ["likes", "likeCount", "like_count", "reactions"]),
    url,
    author,
    publishedAt: firstTextValue(record, ["publishedAt", "postedAt", "createdAt", "time", "date"]),
    themes: themePairsFromTexts([body || title || author || ""])
  });
}

async function collectXKeywordSearch(query, input, task) {
  return collectKeywordWithCloakBrowserFirst("X", query, input, task, () => collectKeywordWithApiFirst(
    "X",
    task,
    "tikhub",
    () => collectXKeywordViaTikHub(query, input, task),
    () => collectXKeywordViaOpencli(query, input, task)
  ));
}

async function collectXKeywordViaTikHub(query, input, task) {
  const searchQuery = buildXKeywordSearchQuery(query, input);
  const payload = await externalApiRequest("tikhub", buildQueryEndpoint("/api/v1/twitter/web/fetch_search_timeline", {
    keyword: searchQuery,
    search_type: "Latest",
    cursor: "undefined"
  }), {
    method: "GET",
    operation: `x/search ${query}`
  }, task);
  return apiKeywordPosts("X", payload, query, "TikHub X search", API_KEYWORD_MAX_RESULTS);
}

async function collectXKeywordViaOpencli(query, input, task) {
  const searchQuery = buildXKeywordSearchQuery(query, input);
  const tweets = await opencliJson(task, "twitter", ["search", searchQuery, "--filter", "live", "--limit", "5", "-f", "json"]);
  return tweets.slice(0, 5).map((tweet, index) => normalizePost({
    id: `x_${tweet.id || index}`,
    title: trimText(tweet.text, 76) || `X 搜索结果 ${index + 1}`,
    body: tweet.text || "",
    platform: "X",
    source: "opencli",
    score: scoreFromQuery(query, tweet.text || ""),
    sentiment: sentimentFromText(tweet.text || ""),
    comments: 0,
    likes: numberValue(tweet.likes),
    url: tweet.url || "",
    author: tweet.author || "",
    publishedAt: tweet.created_at || "",
      themes: themePairsFromTexts([tweet.text || ""])
  }));
}

async function enrichXKeywordPosts(posts, input, task) {
  if (!shouldCollectComments(input.commentPolicy)) {
    return posts;
  }
  const first = posts[0];
  const tweetId = extractTweetId(first.url) || first.id.replace(/^x_/, "");
  if (!tweetId) {
    return posts;
  }
  const replies = await collectXThreadComments(tweetId, input, task);
  if (!replies.length) {
    return posts;
  }
  return replacePostById(posts, first.id, {
    ...first,
    comments: replies.length,
    themes: themePairsFromTexts(replies)
  });
}

async function collectRedditKeywordSearch(query, input, task) {
  return collectKeywordWithCloakBrowserFirst("Reddit", query, input, task, () => collectKeywordWithApiFirst(
    "Reddit",
    task,
    "tikhub",
    () => collectRedditKeywordViaTikHub(query, input, task),
    () => collectRedditKeywordViaOpencli(query, input, task)
  ));
}

async function collectRedditKeywordViaTikHub(query, input, task) {
  const payload = await externalApiRequest("tikhub", buildQueryEndpoint("/api/v1/reddit/app/fetch_dynamic_search", {
    query,
    search_type: "post",
    sort: "RELEVANCE",
    time_range: redditTimeRangeForInput(input),
    safe_search: "unset",
    allow_nsfw: "0",
    after: "",
    need_format: false
  }), {
    method: "GET",
    operation: `reddit/search ${query}`
  }, task);
  return apiKeywordPosts("Reddit", payload, query, "TikHub Reddit search", API_KEYWORD_MAX_RESULTS);
}

async function collectRedditKeywordViaOpencli(query, input, task) {
  const results = await opencliJson(task, "reddit", ["search", query, ...redditTimeSearchArgs(input), "--limit", "3", "-f", "json"]);
  return results.slice(0, 3).map((row, index) => normalizePost({
    id: `reddit_${slugify(row.url || row.title || index)}`,
    title: row.title || `Reddit 搜索结果 ${index + 1}`,
    body: row.title || "",
    platform: "Reddit",
    source: "opencli",
    score: scoreFromQuery(query, row.title || ""),
    sentiment: sentimentFromText(row.title || ""),
    comments: numberValue(row.comments),
    likes: numberValue(row.score),
    url: row.url || "",
    author: row.author || "",
    publishedAt: "",
      themes: themePairsFromTexts([row.title || ""])
  }));
}

async function collectTikTokKeywordSearch(query, input, task) {
  return collectKeywordWithCloakBrowserFirst("TikTok", query, input, task, () => collectTikTokKeywordFallback(query, input, task));
}

async function collectTikTokKeywordFallback(query, input, task) {
  if (!keywordWebFirstEnabled() && keywordApiFallbackEnabled() && isApiProviderReady("tikhub")) {
    try {
      const apiPosts = await collectTikTokKeywordViaTikHub(query, input, task);
      if (apiPosts.length) {
        logTask(task, `TikTok 关键词已使用 TikHub API，返回 ${apiPosts.length} 条。`);
        return apiPosts;
      }
      warnTask(task, "TikHub TikTok 关键词接口没有返回可导出的样本。");
    } catch (error) {
      warnTask(task, `TikHub TikTok 关键词接口失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (keywordWebFirstEnabled() && opencliVersion) {
    try {
      const webPosts = await collectTikTokKeywordViaOpencli(query, input, task);
      if (webPosts.length) {
        logTask(task, `TikTok 关键词已优先使用网页采集，返回 ${webPosts.length} 条。`);
        return webPosts;
      }
      warnTask(task, "TikTok 网页关键词采集没有返回样本。");
    } catch (error) {
      warnTask(task, `TikTok 网页关键词采集失败：${error instanceof Error ? error.message : String(error)}`);
    }
    if (!keywordApiFallbackEnabled()) {
      return [];
    }
    logTask(task, "TikTok 网页采集未命中，已回退 Apify actor。");
  }
  if (!keywordApiFallbackEnabled()) {
    warnTask(task, "TikTok 已关闭关键词 API 兜底，本次不调用 Apify。");
    return [];
  }
  return collectTikTokKeywordViaApify(query, input, task);
}

async function collectTikTokKeywordViaTikHub(query, input, task) {
  const payload = await externalApiRequest("tikhub", buildQueryEndpoint("/api/v1/tiktok/app/v3/fetch_general_search_result", {
    keyword: query,
    offset: 0,
    count: API_KEYWORD_MAX_RESULTS,
    sort_type: 0,
    publish_time: tikTokPublishTimeForInput(input)
  }), {
    method: "GET",
    operation: `tiktok/search ${query}`
  }, task);
  return apiKeywordPosts("TikTok", payload, query, "TikHub TikTok search", API_KEYWORD_MAX_RESULTS);
}

async function collectTikTokKeywordViaOpencli(query, input, task) {
  const rows = await opencliJson(task, "tiktok", ["search", query, "--limit", String(APIFY_TIKTOK_MAX_RESULTS), "-f", "json"]);
  return rows.slice(0, APIFY_TIKTOK_MAX_RESULTS).map((row, index) => {
    const description = firstTextValue(row, ["desc", "description", "text", "title", "caption"]);
    const author = firstTextValue(row, ["author", "username", "author_username", "nickname"]);
    const url = firstTextValue(row, ["url", "video_url", "webVideoUrl", "shareUrl"]);
    return normalizePost({
      id: `tiktok_web_${slugify(url || description || index)}`,
      title: trimText(description, 76) || `TikTok 网页搜索结果 ${index + 1}`,
      body: trimText(description, 420),
      platform: "TikTok",
      source: "opencli tiktok/search",
      score: scoreFromQuery(query, `${description} ${author}`),
      sentiment: sentimentFromText(description),
      comments: numberFromRecord(row, ["comments", "commentCount", "comment_count"]),
      likes: numberFromRecord(row, ["likes", "likeCount", "like_count"]),
      url,
      author,
      publishedAt: firstTextValue(row, ["created_at", "publishedAt", "date", "time"]),
      themes: themePairsFromTexts([description || author || ""])
    });
  });
}

async function collectTikTokKeywordViaApify(query, input, task) {
  const actorInput = buildTikTokActorInput(query);
  const rows = await apifyRunActorDatasetItems(APIFY_TIKTOK_ACTOR, actorInput, task, `tiktok/search ${query}`);
  const videoRows = rows.filter(isTikTokVideoRecord);
  if (!videoRows.length) {
    warnTask(task, "TikTok actor 本次没有返回 video 类型记录。");
  }
  return videoRows.slice(0, APIFY_TIKTOK_MAX_RESULTS).map((row, index) => {
    const description = tiktokText(row, ["text", "description", "desc", "title", "caption"]);
    const hashtags = tiktokHashtags(row);
    const author = tiktokText(row, ["authorMeta.name", "authorMeta.nickName", "authorMeta.uniqueId", "author.username", "author.uniqueId", "author.name", "author", "username", "author_username", "author_nickname", "authorUniqueId", "nickname"]);
    const url = tiktokText(row, ["webVideoUrl", "video_url", "url", "shareUrl", "videoUrl", "submittedVideoUrl"]);
    const publishedAt = tiktokPublishedAt(row);
    const engagementText = [description, hashtags.join(" "), author].filter(Boolean).join(" ");
    return normalizePost({
      id: `tiktok_${slugify(tiktokText(row, ["id", "video_id", "aweme_id"]) || url || index)}`,
      title: trimText(description, 76) || `TikTok 搜索结果 ${index + 1}`,
      body: trimText([description, hashtags.length ? `#${hashtags.join(" #")}` : ""].filter(Boolean).join("\n"), 420),
      platform: "TikTok",
      source: `Apify ${APIFY_TIKTOK_ACTOR}`,
      score: scoreFromQuery(query, engagementText),
      sentiment: sentimentFromText(description),
      comments: tiktokNumber(row, ["commentCount", "stats.commentCount", "comments", "comment_count"]),
      likes: tiktokNumber(row, ["diggCount", "stats.diggCount", "stats.likes", "likes", "like_count", "likeCount", "digg_count"]),
      url,
      author,
      publishedAt,
      themes: themePairsFromTexts([description, hashtags.join(" ")])
    });
  });
}

function buildTikTokActorInput(query) {
  if (isClockworksTikTokActor()) {
    return {
      searchQueries: [query],
      searchSection: "/video",
      resultsPerPage: APIFY_TIKTOK_MAX_RESULTS,
      shouldDownloadVideos: false,
      shouldDownloadCovers: false,
      shouldDownloadSlideshowImages: false,
      shouldDownloadSubtitles: false,
      shouldDownloadAvatars: false,
      shouldDownloadMusicCovers: false
    };
  }
  return {
    mode: "search",
    inputs: [query],
    maxResultsPerInput: APIFY_TIKTOK_MAX_RESULTS,
    proxyConfig: { useApifyProxy: APIFY_TIKTOK_USE_PROXY }
  };
}

function isClockworksTikTokActor() {
  return /clockworks[~/]tiktok-scraper/i.test(APIFY_TIKTOK_ACTOR);
}

function tikTokProxyHint() {
  return !isClockworksTikTokActor() && APIFY_TIKTOK_USE_PROXY ? "，启用代理" : "";
}

async function collectTikTokLinkComments(target, input, task) {
  const awemeId = extractTikTokAwemeId(target) || await resolveTikTokAwemeIdFromShareUrl(target, task);
  if (!awemeId) {
    throw new Error("无法从 TikTok 链接中识别 video/aweme id。");
  }

  const limit = numericReplyLimit(input.commentPolicy);
  const comments = await collectTikHubComments({
    platform: "TikTok",
    target,
    task,
    endpoint: "/api/v1/tiktok/app/v3/fetch_video_comments",
    params: { aweme_id: awemeId, cursor: 0, count: limit },
    operation: "tiktok video comments"
  });

  const replies = shouldCollectCommentReplies(input)
    ? await collectTikTokCommentReplies({ target, task, awemeId, comments, limit })
    : [];
  const records = dedupeCommentRecords([...comments, ...replies]);
  if (!records.length) {
    warnTask(task, "TikHub TikTok 评论接口本次没有返回可导出的评论。");
  }
  return records.slice(0, limit + replies.length).map((record, index) => commentPostFromRecord({
    platform: "TikTok",
    source: record._source || "TikHub TikTok comments",
    target,
    index,
    record
  }));
}

async function collectTikTokCommentReplies({ target, task, awemeId, comments, limit }) {
  const result = [];
  const candidates = comments
    .map((comment) => comment._commentId)
    .filter(Boolean)
    .slice(0, 3);
  for (const commentId of candidates) {
    try {
      const replies = await collectTikHubComments({
        platform: "TikTok",
        target,
        task,
        endpoint: "/api/v1/tiktok/app/v3/fetch_video_comment_replies",
        params: { aweme_id: awemeId, comment_id: commentId, cursor: 0, count: limit },
        operation: "tiktok comment replies",
        parentCommentId: commentId
      });
      result.push(...replies);
    } catch (error) {
      warnTask(task, `TikTok 评论回复未拉取成功：${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return result;
}

async function resolveTikTokAwemeIdFromShareUrl(target, task) {
  if (!looksLikeUrl(target)) {
    return "";
  }
  try {
    const payload = await externalApiRequest("tikhub", buildQueryEndpoint("/api/v1/tiktok/app/v3/fetch_one_video_by_share_url", {
      share_url: target
    }), {
      method: "GET",
      operation: "tiktok resolve share url"
    }, task);
    return findFirstTextByKeys(payload, ["aweme_id", "id", "video_id"]);
  } catch (error) {
    warnTask(task, `TikTok 短链接解析未成功：${error instanceof Error ? error.message : String(error)}`);
    return "";
  }
}

async function enrichRedditKeywordPosts(posts, input, task) {
  const first = posts[0];
  if (!first?.url) {
    return posts;
  }
  const rows = await opencliJson(task, "reddit", ["read", first.url, "--limit", replyLimitForPolicy(input.commentPolicy), "--depth", "2", "--replies", "3", "-f", "json"]);
  const root = Array.isArray(rows) ? rows.find((item) => item.type === "POST") : null;
  const replies = Array.isArray(rows) ? rows.filter((item) => item.type && item.type !== "POST" && item.author && item.text).map((item) => item.text) : [];
  return replacePostById(posts, first.id, {
    ...first,
    body: trimText(root?.text || first.body, 420),
    comments: replies.length || first.comments,
    themes: themePairsFromTexts(replies.length ? replies : [root?.text || first.body])
  });
}

async function collectInstagramKeywordSearchOnly(query, input, task) {
  return collectKeywordWithCloakBrowserFirst("Instagram", query, input, task, () => collectKeywordWithApiFirst(
    "Instagram",
    task,
    "apify",
    () => collectInstagramKeywordViaApify(query, input, task),
    () => collectInstagramKeywordViaOpencli(query, input, task)
  ));
}

async function collectInstagramKeywordViaApify(query, input, task) {
  const rows = await apifyRunActorDatasetItems(APIFY_INSTAGRAM_HASHTAG_ACTOR, {
    keyword: String(query || "").replace(/^#/, "").trim(),
    getPosts: true,
    getReels: true,
    maxItems: API_KEYWORD_MAX_RESULTS,
    until: input.timeWindow?.startDate || ""
  }, task, `instagram/search ${query}`, { limit: API_KEYWORD_MAX_RESULTS + 5 });
  return rows
    .map((row, index) => apiKeywordPost("Instagram", row, query, `Apify ${APIFY_INSTAGRAM_HASHTAG_ACTOR}`, index))
    .filter(Boolean)
    .slice(0, API_KEYWORD_MAX_RESULTS);
}

async function collectInstagramKeywordViaOpencli(query, input, task) {
  const rows = await opencliJson(task, "instagram", ["search", query, "--limit", "3", "-f", "json"]);
  return rows.slice(0, 3).map((row, index) => normalizePost({
    id: `instagram_search_${row.username || index}`,
    title: `@${row.username || query}`,
    body: `${row.name || ""} ${row.verified === "Yes" ? "已认证" : ""}`.trim(),
    platform: "Instagram",
    source: "opencli",
    score: scoreFromQuery(query, `${row.username || ""} ${row.name || ""}`),
    sentiment: "中性",
    comments: 0,
    likes: 0,
    url: row.url || "",
    author: row.username || "",
    publishedAt: "",
    themes: themePairsFromTexts([`${row.name || ""} ${row.username || ""}`.trim()])
  }));
}

async function enrichInstagramKeywordPosts(posts, input, task) {
  const first = posts[0];
  const username = normalizeHandle(first?.author || extractInstagramUsername(first?.url || ""));
  if (!username) {
    return posts;
  }
  const enriched = await collectInstagramAccount(username, input, task);
  return enriched.length ? [enriched[0], ...posts.slice(1)] : posts;
}

async function collectXiaohongshuKeywordSearch(query, input, task) {
  return collectKeywordWithCloakBrowserFirst("小红书", query, input, task, () => collectXiaohongshuKeywordViaOpencli(query, input, task));
}

async function collectXiaohongshuKeywordViaOpencli(query, input, task) {
  const rows = await opencliJson(task, "xiaohongshu", ["search", query, "--limit", "5", "-f", "json"]);
  return rows.slice(0, 5).map((row, index) => normalizePost({
    id: `xhs_${slugify(row.url || row.title || index)}`,
    title: row.title || `小红书搜索结果 ${index + 1}`,
    body: row.title || "",
    platform: "小红书",
    source: "opencli",
    score: scoreFromQuery(query, row.title || ""),
    sentiment: sentimentFromText(row.title || ""),
    comments: 0,
    likes: numberValue(row.likes),
    url: row.url || "",
    author: row.author || "",
    publishedAt: row.published_at || "",
    themes: themePairsFromTexts([row.title || ""])
  }));
}

async function enrichXiaohongshuKeywordPosts(posts, input, task) {
  const first = posts[0];
  const noteUrl = await normalizeXiaohongshuNoteUrl(first?.url || "");
  if (!noteUrl) {
    warnTask(task, "小红书补采失败：缺少可用的完整笔记 URL。");
    return posts;
  }
  const noteRows = await opencliJson(task, "xiaohongshu", ["note", noteUrl, "-f", "json"]);
  const noteMap = fieldMapFromRows(noteRows);
  const commentArgs = ["comments", noteUrl, "--limit", replyLimitForPolicy(input.commentPolicy), "--with-replies", "true", "-f", "json"];
  const comments = shouldCollectComments(input.commentPolicy) ? await opencliJson(task, "xiaohongshu", commentArgs) : [];
  return replacePostById(posts, first.id, {
    ...first,
    body: extractLongBody(noteMap, [/(正文|内容|description|title)/i]),
    comments: comments.length,
    likes: first.likes || numberValue(findFieldValue(noteMap, /(点赞|likes?)/i)),
    themes: themePairsFromTexts(comments.map((row) => row.text).filter(Boolean))
  });
}

async function collectXiaohongshuLink(target, input, task) {
  const noteUrl = await normalizeXiaohongshuNoteUrl(target);
  if (!noteUrl || !noteUrl.includes("xsec_token")) {
    throw new Error("小红书 Link 模式需要带 xsec_token 的完整笔记 URL，短链会先尝试自动展开。");
  }
  const noteRows = await opencliJson(task, "xiaohongshu", ["note", noteUrl, "-f", "json"]);
  const noteMap = fieldMapFromRows(noteRows);
  const commentArgs = ["comments", noteUrl, "--limit", replyLimitForPolicy(input.commentPolicy), "--with-replies", "true", "-f", "json"];
  const comments = shouldCollectComments(input.commentPolicy) ? await opencliJson(task, "xiaohongshu", commentArgs) : [];
  return [normalizePost({
    id: `xhs_link_${slugify(noteUrl)}`,
    title: extractFieldValue(noteMap, [/(标题|title)/i]) || "小红书笔记详情",
    body: extractLongBody(noteMap, [/(正文|内容|description)/i, /(标题|title)/i]),
    platform: "小红书",
    source: "opencli",
    score: 0.91,
    sentiment: sentimentFromText(extractLongBody(noteMap, [/(正文|内容|description)/i])),
    comments: comments.length,
    likes: numberValue(findFieldValue(noteMap, /(点赞|likes?)/i)),
    url: noteUrl,
    author: extractFieldValue(noteMap, [/(作者|author|用户)/i]),
    publishedAt: extractFieldValue(noteMap, [/(时间|发布)/i]),
    themes: themePairsFromTexts(comments.map((row) => row.text).filter(Boolean))
  })];
}

async function collectXiaohongshuAccount(target, input, task) {
  const userId = normalizeXiaohongshuUserId(target);
  const rows = await opencliJson(task, "xiaohongshu", ["user", userId, "--limit", "5", "-f", "json"]);
  return [normalizePost({
    id: `xhs_user_${slugify(userId)}`,
    title: `${userId} 的小红书最近笔记`,
    body: rows.map((row) => row.title).filter(Boolean).slice(0, 3).join(" "),
    platform: "小红书",
    source: "opencli",
    score: 0.82,
    sentiment: sentimentFromText(rows.map((row) => row.title).join(" ")),
    comments: 0,
    likes: rows.reduce((sum, row) => sum + numberValue(row.likes), 0),
    url: rows[0]?.url || target,
    author: userId,
    publishedAt: "",
    themes: themePairsFromTexts(rows.map((row) => row.title).filter(Boolean))
  })];
}

async function collectWeiboKeywordSearch(query, input, task) {
  return collectKeywordWithCloakBrowserFirst("微博", query, input, task, () => collectWeiboKeywordViaOpencli(query, input, task));
}

async function collectWeiboKeywordViaOpencli(query, input, task) {
  const rows = await opencliJson(task, "weibo", ["search", query, "--limit", "5", "-f", "json"]);
  return rows.slice(0, 5).map((row, index) => normalizePost({
    id: `weibo_${slugify(row.url || row.title || index)}`,
    title: row.title || `微博搜索结果 ${index + 1}`,
    body: row.title || "",
    platform: "微博",
    source: "opencli",
    score: scoreFromQuery(query, row.title || ""),
    sentiment: sentimentFromText(row.title || ""),
    comments: 0,
    likes: 0,
    url: row.url || "",
    author: row.author || "",
    publishedAt: row.time || "",
    themes: themePairsFromTexts([row.title || ""])
  }));
}

async function enrichWeiboKeywordPosts(posts, input, task) {
  const first = posts[0];
  const postId = extractWeiboId(first?.url || first?.id || "");
  if (!postId) {
    warnTask(task, "微博补采失败：无法从搜索结果提取帖子 ID。");
    return posts;
  }
  const detailRows = await opencliJson(task, "weibo", ["post", postId, "-f", "json"]);
  const detailMap = fieldMapFromRows(detailRows);
  const comments = shouldCollectComments(input.commentPolicy)
    ? await opencliJson(task, "weibo", ["comments", postId, "--limit", replyLimitForPolicy(input.commentPolicy), "-f", "json"])
    : [];
  return replacePostById(posts, first.id, {
    ...first,
    body: extractLongBody(detailMap, [/(正文|内容|text|description)/i, /(标题|title)/i]),
    comments: comments.length,
    themes: themePairsFromTexts(comments.map((row) => row.text).filter(Boolean))
  });
}

async function collectWeiboLink(target, input, task) {
  const postId = extractWeiboId(target);
  if (!postId) {
    throw new Error("无法从微博链接中识别帖子 ID。");
  }
  const detailRows = await opencliJson(task, "weibo", ["post", postId, "-f", "json"]);
  const detailMap = fieldMapFromRows(detailRows);
  const comments = shouldCollectComments(input.commentPolicy)
    ? await opencliJson(task, "weibo", ["comments", postId, "--limit", replyLimitForPolicy(input.commentPolicy), "-f", "json"])
    : [];
  return [normalizePost({
    id: `weibo_link_${postId}`,
    title: extractFieldValue(detailMap, [/(标题|title)/i]) || "微博详情",
    body: extractLongBody(detailMap, [/(正文|内容|text|description)/i, /(标题|title)/i]),
    platform: "微博",
    source: "opencli",
    score: 0.9,
    sentiment: sentimentFromText(extractLongBody(detailMap, [/(正文|内容|text)/i])),
    comments: comments.length,
    likes: numberValue(findFieldValue(detailMap, /(赞|like)/i)),
    url: looksLikeUrl(target) ? target : "",
    author: extractFieldValue(detailMap, [/(作者|author|用户)/i]),
    publishedAt: extractFieldValue(detailMap, [/(时间|time|发布)/i]),
    themes: themePairsFromTexts(comments.map((row) => row.text).filter(Boolean))
  })];
}

async function collectWeiboAccount(target, input, task) {
  const userId = normalizeHandle(target);
  const rows = await opencliJson(task, "weibo", ["user", userId, "-f", "json"]);
  const profile = Array.isArray(rows) ? rows[0] : rows;
  return [normalizePost({
    id: `weibo_user_${slugify(userId)}`,
    title: `${profile?.screen_name || userId} 的微博账号`,
    body: profile?.description || "",
    platform: "微博",
    source: "opencli",
    score: 0.74,
    sentiment: sentimentFromText(profile?.description || ""),
    comments: 0,
    likes: parseChineseCount(profile?.followers),
    url: profile?.url || "",
    author: profile?.screen_name || userId,
    publishedAt: "",
    themes: themePairsFromTexts([profile?.description || profile?.location || ""])
  })];
}

async function collectBilibiliKeywordSearch(query, input, task) {
  return collectKeywordWithCloakBrowserFirst("B站", query, input, task, () => collectBilibiliKeywordViaOpencli(query, input, task));
}

async function collectBilibiliKeywordViaOpencli(query, input, task) {
  const rows = await opencliJson(task, "bilibili", ["search", query, "--type", "video", "--limit", "5", "-f", "json"]);
  return rows.slice(0, 5).map((row, index) => normalizePost({
    id: `bili_${slugify(row.url || row.title || index)}`,
    title: row.title || `B站搜索结果 ${index + 1}`,
    body: row.title || "",
    platform: "B站",
    source: "opencli",
    score: scoreFromQuery(query, row.title || ""),
    sentiment: sentimentFromText(row.title || ""),
    comments: 0,
    likes: numberValue(row.score),
    url: row.url || "",
    author: row.author || "",
    publishedAt: "",
    themes: themePairsFromTexts([row.title || ""])
  }));
}

async function enrichBilibiliKeywordPosts(posts, input, task, firecrawl) {
  const first = posts[0];
  const bvid = extractBilibiliBvid(first?.url || first?.id || "");
  if (!bvid) {
    warnTask(task, "B站补采失败：无法从搜索结果提取 BV 号。");
    return posts;
  }
  let comments = [];
  if (shouldCollectComments(input.commentPolicy)) {
    try {
      comments = await opencliJson(task, "bilibili", ["comments", bvid, "--limit", replyLimitForPolicy(input.commentPolicy), "-f", "json"]);
    } catch (error) {
      warnTask(task, `B站评论未拉取成功：${error instanceof Error ? error.message : String(error)}`);
    }
  }
  let subtitleRows = [];
  try {
    subtitleRows = await opencliJson(task, "bilibili", ["subtitle", bvid, "-f", "json"]);
  } catch (error) {
    warnTask(task, `B站字幕未拉取成功：${error instanceof Error ? error.message : String(error)}`);
  }
  let body = subtitleTextFromRows(subtitleRows);
  if (!body && firecrawl.available && first?.url) {
    try {
      body = extractFirecrawlText(await firecrawl.scrape(first.url));
    } catch (error) {
      warnTask(task, `B站页面补抓失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return replacePostById(posts, first.id, {
    ...first,
    body: body || first.body,
    comments: comments.length,
    themes: themePairsFromTexts(comments.map((row) => row.text).filter(Boolean).length ? comments.map((row) => row.text).filter(Boolean) : [body || first.body])
  });
}

async function collectBilibiliLink(target, input, task, firecrawl) {
  const bvid = extractBilibiliBvid(target);
  if (!bvid) {
    throw new Error("无法从 B站链接中识别 BV 号。");
  }
  let comments = [];
  if (shouldCollectComments(input.commentPolicy)) {
    try {
      comments = await opencliJson(task, "bilibili", ["comments", bvid, "--limit", replyLimitForPolicy(input.commentPolicy), "-f", "json"]);
    } catch (error) {
      warnTask(task, `B站评论未拉取成功：${error instanceof Error ? error.message : String(error)}`);
    }
  }
  let subtitleRows = [];
  try {
    subtitleRows = await opencliJson(task, "bilibili", ["subtitle", bvid, "-f", "json"]);
  } catch (error) {
    warnTask(task, `B站字幕未拉取成功：${error instanceof Error ? error.message : String(error)}`);
  }
  let title = bvid;
  let body = subtitleTextFromRows(subtitleRows);
  if (looksLikeUrl(target) && firecrawl.available) {
    try {
      const scraped = await firecrawl.scrape(target);
      title = extractFirecrawlTitle(scraped) || title;
      body = extractFirecrawlText(scraped) || body;
    } catch (error) {
      warnTask(task, `B站页面补抓失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return [normalizePost({
    id: `bili_link_${bvid}`,
    title,
    body,
    platform: "B站",
    source: firecrawl.available && looksLikeUrl(target) ? "opencli + Firecrawl" : "opencli",
    score: 0.89,
    sentiment: sentimentFromText(body),
    comments: comments.length,
    likes: 0,
    url: looksLikeUrl(target) ? target : `https://www.bilibili.com/video/${bvid}`,
    author: "",
    publishedAt: "",
    themes: themePairsFromTexts(comments.map((row) => row.text).filter(Boolean).length ? comments.map((row) => row.text).filter(Boolean) : [body])
  })];
}

async function collectBilibiliAccount(target, input, task) {
  const uid = normalizeHandle(target);
  const rows = await opencliJson(task, "bilibili", ["user-videos", uid, "--limit", "5", "-f", "json"]);
  return [normalizePost({
    id: `bili_user_${slugify(uid)}`,
    title: `${uid} 的 B站投稿视频`,
    body: rows.map((row) => row.title).filter(Boolean).slice(0, 3).join(" "),
    platform: "B站",
    source: "opencli",
    score: 0.8,
    sentiment: sentimentFromText(rows.map((row) => row.title).join(" ")),
    comments: 0,
    likes: rows.reduce((sum, row) => sum + numberValue(row.likes), 0),
    url: rows[0]?.url || "",
    author: uid,
    publishedAt: rows[0]?.date || "",
    themes: themePairsFromTexts(rows.map((row) => row.title).filter(Boolean))
  })];
}

async function collectYouTubeKeywordSearch(query, input, task) {
  return collectKeywordWithCloakBrowserFirst("YouTube", query, input, task, () => collectKeywordWithApiFirst(
    "YouTube",
    task,
    "tikhub",
    () => collectYouTubeKeywordViaTikHub(query, input, task),
    () => collectYouTubeKeywordViaOpencli(query, input, task)
  ));
}

async function collectYouTubeKeywordViaTikHub(query, input, task) {
  const payload = await externalApiRequest("tikhub", buildQueryEndpoint("/api/v1/youtube/web_v2/get_general_search_v2", {
    keyword: query,
    type: "video",
    upload_date: youtubeUploadDateForInput(input),
    sort_by: taskTimeWindow(input)?.hasWindow ? "upload_date" : "relevance"
  }), {
    method: "GET",
    operation: `youtube/search ${query}`
  }, task);
  return apiKeywordPosts("YouTube", payload, query, "TikHub YouTube search", API_KEYWORD_MAX_RESULTS);
}

async function collectYouTubeKeywordViaOpencli(query, input, task) {
  const rows = await opencliJson(task, "youtube", ["search", query, "--type", "video", ...youtubeUploadSearchArgs(input), "--limit", "5", "-f", "json"]);
  return rows.slice(0, 5).map((row, index) => normalizePost({
    id: `yt_${slugify(row.url || row.title || index)}`,
    title: row.title || `YouTube 搜索结果 ${index + 1}`,
    body: `${row.channel || ""} ${row.duration || ""}`.trim(),
    platform: "YouTube",
    source: "opencli",
    score: scoreFromQuery(query, row.title || ""),
    sentiment: sentimentFromText(row.title || ""),
    comments: 0,
    likes: 0,
    url: row.url || "",
    author: row.channel || "",
    publishedAt: row.published || "",
    themes: themePairsFromTexts([row.title || ""])
  }));
}

async function enrichYouTubeKeywordPosts(posts, input, task) {
  const first = posts[0];
  if (!first?.url) {
    return posts;
  }
  const enriched = await collectYouTubeLink(first.url, input, task);
  return enriched.length ? [enriched[0], ...posts.slice(1)] : posts;
}

async function collectYouTubeLink(target, input, task) {
  if (isApiProviderReady("tikhub")) {
    try {
      const apiPosts = await collectYouTubeLinkViaTikHub(target, input, task);
      if (apiPosts.length) {
        return apiPosts;
      }
      warnTask(task, "TikHub YouTube 详情/评论接口本次没有返回可导出的样本。");
    } catch (error) {
      warnTask(task, `TikHub YouTube 详情/评论接口失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }
  const detailRows = await opencliJson(task, "youtube", ["video", target, "-f", "json"]);
  const detailMap = fieldMapFromRows(detailRows);
  let comments = [];
  if (shouldCollectComments(input.commentPolicy)) {
    try {
      comments = await opencliJson(task, "youtube", ["comments", target, "--limit", replyLimitForPolicy(input.commentPolicy), "-f", "json"]);
    } catch (error) {
      warnTask(task, `YouTube 评论未拉取成功：${error instanceof Error ? error.message : String(error)}`);
    }
  }
  let transcriptRows = [];
  try {
    transcriptRows = await opencliJson(task, "youtube", ["transcript", target, "--mode", "grouped", "-f", "json"]);
  } catch (error) {
    warnTask(task, `YouTube 转录未拉取成功：${error instanceof Error ? error.message : String(error)}`);
  }
  const transcript = transcriptTextFromRows(transcriptRows);
  const title = extractFieldValue(detailMap, [/(title|标题)/i]) || "YouTube 视频详情";
  const description = extractLongBody(detailMap, [/(description|简介|正文)/i, /(title|标题)/i]);
  return [normalizePost({
    id: `yt_link_${slugify(target)}`,
    title,
    body: transcript || description,
    platform: "YouTube",
    source: "opencli",
    score: 0.92,
    sentiment: sentimentFromText(`${description} ${transcript}`),
    comments: comments.length,
    likes: numberValue(findFieldValue(detailMap, /(likes?|赞)/i)),
    url: target,
    author: extractFieldValue(detailMap, [/(channel|author|频道)/i]),
    publishedAt: extractFieldValue(detailMap, [/(publish|发布时间|date)/i]),
    themes: themePairsFromTexts(comments.map((row) => row.text).filter(Boolean).length ? comments.map((row) => row.text).filter(Boolean) : [transcript || description])
  })];
}

async function collectYouTubeLinkViaTikHub(target, input, task) {
  const videoId = extractYouTubeVideoId(target);
  if (!videoId) {
    throw new Error("无法从 YouTube 链接中识别 video id。");
  }
  const detail = await externalApiRequest("tikhub", buildQueryEndpoint("/api/v1/youtube/web_v2/get_video_info", {
    video_id: videoId,
    language_code: "zh-CN"
  }), {
    method: "GET",
    operation: `youtube/video ${videoId}`
  }, task);
  let comments = [];
  if (shouldCollectComments(input.commentPolicy)) {
    try {
      comments = await collectTikHubComments({
        platform: "YouTube",
        target,
        task,
        endpoint: "/api/v1/youtube/web_v2/get_video_comments",
        params: { video_id: videoId },
        operation: "youtube video comments"
      });
    } catch (error) {
      warnTask(task, `TikHub YouTube 评论接口未拉取成功：${error instanceof Error ? error.message : String(error)}`);
    }
  }
  const post = apiKeywordPost("YouTube", detail, target, "TikHub YouTube video detail", 0);
  if (!post && !comments.length) {
    return [];
  }
  const url = normalizeSocialUrl(target) || `https://www.youtube.com/watch?v=${videoId}`;
  return [normalizePost({
    ...(post || {}),
    id: post?.id || `yt_api_${videoId}`,
    title: post?.title || "YouTube 视频详情",
    body: post?.body || "",
    platform: "YouTube",
    source: "TikHub YouTube video detail",
    score: post?.score || 0.92,
    sentiment: post?.sentiment || sentimentFromText(post?.body || ""),
    comments: comments.length || post?.comments || 0,
    likes: post?.likes || 0,
    url: post?.url || url,
    author: post?.author || "",
    publishedAt: post?.publishedAt || "",
    themes: themePairsFromTexts(comments.map((row) => row["评论内容"]).filter(Boolean).length ? comments.map((row) => row["评论内容"]).filter(Boolean) : [post?.body || post?.title || ""])
  })];
}

async function collectYouTubeAccount(target, input, task) {
  const channelId = normalizeHandle(target);
  const rows = await opencliJson(task, "youtube", ["channel", channelId, "--limit", "5", "-f", "json"]);
  const fieldMap = fieldMapFromRows(rows);
  const summary = extractLongBody(fieldMap, [/(recent|视频|video|description|简介)/i, /(title|name|频道)/i]);
  return [normalizePost({
    id: `yt_channel_${slugify(channelId)}`,
    title: extractFieldValue(fieldMap, [/(name|title|频道)/i]) || `${channelId} 的 YouTube 频道`,
    body: summary,
    platform: "YouTube",
    source: "opencli",
    score: 0.79,
    sentiment: sentimentFromText(summary),
    comments: 0,
    likes: numberValue(findFieldValue(fieldMap, /(subscribers|订阅)/i)),
    url: extractFieldValue(fieldMap, [/(url|链接)/i]),
    author: channelId,
    publishedAt: "",
    themes: themePairsFromTexts([summary])
  })];
}

async function collectXKeyword(query, input, task) {
  const searchQuery = buildXKeywordSearchQuery(query, input);
  const tweets = await opencliJson(task, "twitter", ["search", searchQuery, "--filter", "live", "--limit", "5", "-f", "json"]);
  const threadSeed = tweets[0]?.id ? await collectXThreadComments(tweets[0].id, input, task) : [];
  return tweets.slice(0, 5).map((tweet, index) => normalizePost({
    id: `x_${tweet.id || index}`,
    title: trimText(tweet.text, 76) || `X 搜索结果 ${index + 1}`,
    body: tweet.text || "",
    platform: "X",
    source: "opencli",
    score: scoreFromQuery(query, tweet.text || ""),
    sentiment: sentimentFromText(tweet.text || ""),
    comments: index === 0 ? threadSeed.length : 0,
    likes: numberValue(tweet.likes),
    url: tweet.url || "",
    author: tweet.author || "",
    publishedAt: tweet.created_at || "",
    themes: themePairsFromTexts(threadSeed.length ? threadSeed : [tweet.text || ""])
  }));
}

async function collectXLink(target, input, task) {
  const tweetId = extractTweetId(target);
  if (!tweetId) {
    throw new Error("无法从 X 链接中识别 tweet id");
  }
  const thread = await opencliJson(task, "twitter", ["thread", tweetId, "--limit", replyLimitForPolicy(input.commentPolicy), "-f", "json"]);
  if (!Array.isArray(thread) || !thread.length) {
    return [];
  }
  const root = thread[0];
  const replies = thread.slice(1).map((item) => item.text).filter(Boolean);
  return [normalizePost({
    id: `x_${root.id || tweetId}`,
    title: trimText(root.text, 76) || "X 链接详情",
    body: root.text || "",
    platform: "X",
    source: "opencli",
    score: 0.92,
    sentiment: sentimentFromText(root.text || ""),
    comments: replies.length,
    likes: numberValue(root.likes),
    url: root.url || target,
    author: root.author || "",
    publishedAt: root.created_at || "",
    themes: themePairsFromTexts(replies.length ? replies : [root.text || ""])
  })];
}

async function collectXLinkComments(target, input, task) {
  const cached = readCachedCommentPosts("X", target, task);
  if (cached.length) {
    return cached;
  }

  const tweetId = extractTweetId(target);
  if (!tweetId) {
    throw new Error("无法从 X 链接中识别 tweet id");
  }
  if (isApiProviderReady("tikhub")) {
    try {
      const limit = numericReplyLimit(input.commentPolicy);
      const comments = await collectTikHubComments({
        platform: "X",
        target,
        task,
        endpoint: "/api/v1/twitter/web/fetch_post_comments",
        params: { tweet_id: tweetId, cursor: "undefined" },
        operation: "x post comments"
      });
      if (comments.length) {
        return comments.slice(0, limit).map((record, index) => commentPostFromRecord({
          platform: "X",
          source: record._source || "TikHub X comments",
          target,
          index,
          record
        }));
      }
      warnTask(task, "TikHub X 评论接口本次没有返回可导出的评论。");
    } catch (error) {
      warnTask(task, `TikHub X 评论接口本次未跑通：${error instanceof Error ? error.message : String(error)}`);
    }
  }
  const thread = await opencliJson(task, "twitter", ["thread", tweetId, "--limit", replyLimitForPolicy(input.commentPolicy), "-f", "json"]);
  const replies = Array.isArray(thread) ? thread.slice(1).filter((item) => item && item.text) : [];
  if (!replies.length) {
    warnTask(task, "X 线程没有返回可导出的回复评论。");
    return [];
  }
  return replies.map((reply, index) => commentPostFromRecord({
    platform: "X",
    source: "opencli twitter/thread",
    target,
    index,
    record: {
      "目标link": target,
      "评论者账号": reply.author || extractXAuthor(reply.url || "") || "",
      "评论内容": reply.text || "",
      "发布时间（UTC+8）": formatCommentDateForExport(reply.created_at || reply.time || reply.datetime),
      "sentiment rating": sentimentRating(sentimentFromText(reply.text || "")),
      "链接": reply.url || buildXStatusUrl(reply.author, reply.id)
    }
  }));
}

async function collectXAccount(target, input, task) {
  const username = normalizeHandle(target);
  const profileRows = await opencliJson(task, "twitter", ["profile", username, "-f", "json"]);
  const tweets = await opencliJson(task, "twitter", ["search", `from:${username}`, "--limit", "5", "-f", "json"]);
  const profile = Array.isArray(profileRows) ? profileRows[0] : profileRows;
  const threadSeed = tweets[0]?.id ? await collectXThreadComments(tweets[0].id, input, task) : [];
  return [normalizePost({
    id: `x_profile_${username}`,
    title: `${profile?.name || username} 在 X 的最近内容`,
    body: tweets[0]?.text || profile?.bio || "",
    platform: "X",
    source: "opencli",
    score: 0.88,
    sentiment: sentimentFromText(tweets[0]?.text || profile?.bio || ""),
    comments: threadSeed.length,
    likes: numberValue(tweets[0]?.likes || profile?.likes),
    url: tweets[0]?.url || `https://x.com/${username}`,
    author: profile?.screen_name || username,
    publishedAt: tweets[0]?.created_at || profile?.created_at || "",
    themes: themePairsFromTexts(threadSeed.length ? threadSeed : tweets.map((row) => row.text).filter(Boolean))
  })];
}

async function collectXThreadComments(tweetId, input, task) {
  if (!shouldCollectComments(input.commentPolicy)) {
    return [];
  }
  try {
    const thread = await opencliJson(task, "twitter", ["thread", tweetId, "--limit", replyLimitForPolicy(input.commentPolicy), "-f", "json"]);
    return thread.slice(1).map((item) => item.text).filter(Boolean);
  } catch (error) {
    warnTask(task, `X 回复线程未拉取成功：${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}

async function collectRedditKeyword(query, input, task) {
  const results = await opencliJson(task, "reddit", ["search", query, ...redditTimeSearchArgs(input), "--limit", "3", "-f", "json"]);
  const posts = [];
  for (const row of results.slice(0, 3)) {
    const readRows = shouldCollectComments(input.commentPolicy)
      ? await opencliJson(task, "reddit", ["read", row.url || row.title, "--limit", replyLimitForPolicy(input.commentPolicy), "--depth", "2", "--replies", "3", "-f", "json"])
      : [];
    const root = Array.isArray(readRows) ? readRows.find((item) => item.type === "POST") : null;
    const replies = Array.isArray(readRows) ? readRows.filter((item) => item.type && item.type !== "POST" && item.author && item.text).map((item) => item.text) : [];
    posts.push(normalizePost({
      id: `reddit_${slugify(row.url || row.title)}`,
      title: row.title || "Reddit 结果",
      body: root?.text || row.title || "",
      platform: "Reddit",
      source: "opencli",
      score: scoreFromQuery(query, `${row.title || ""} ${root?.text || ""}`),
      sentiment: sentimentFromText(`${row.title || ""} ${root?.text || ""}`),
      comments: numberValue(row.comments || replies.length),
      likes: numberValue(row.score),
      url: row.url || "",
      author: row.author || "",
      publishedAt: "",
      themes: themePairsFromTexts(replies.length ? replies : [row.title || ""])
    }));
  }
  return posts;
}

async function collectRedditLink(target, input, task) {
  if (isApiProviderReady("apify")) {
    try {
      const comments = await collectRedditLinkCommentsViaApify(target, input, task);
      if (comments.length) {
        return comments;
      }
      warnTask(task, "Apify Reddit comment actor 本次没有返回可导出的评论。");
    } catch (error) {
      warnTask(task, `Apify Reddit comment actor 采集失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }
  const rows = await opencliJson(task, "reddit", ["read", target, "--limit", replyLimitForPolicy(input.commentPolicy), "--depth", "2", "--replies", "3", "-f", "json"]);
  const root = Array.isArray(rows) ? rows.find((item) => item.type === "POST") : null;
  const replies = Array.isArray(rows) ? rows.filter((item) => item.type && item.type !== "POST" && item.author && item.text).map((item) => item.text) : [];
  return [normalizePost({
    id: `reddit_${slugify(target)}`,
    title: trimText(root?.text || target, 76) || "Reddit 链接详情",
    body: root?.text || "",
    platform: "Reddit",
    source: "opencli",
    score: 0.91,
    sentiment: sentimentFromText(root?.text || ""),
    comments: replies.length,
    likes: numberValue(root?.score),
    url: target,
    author: root?.author || "",
    publishedAt: "",
    themes: themePairsFromTexts(replies.length ? replies : [root?.text || ""])
  })];
}

async function collectRedditLinkCommentsViaApify(target, input, task) {
  const limit = numericReplyLimit(input.commentPolicy);
  const rows = await apifyRunActorDatasetItems(APIFY_REDDIT_COMMENTS_ACTOR, {
    startUrls: [target],
    maxComments: limit,
    maxReplies: shouldCollectCommentReplies(input) ? limit : 0
  }, task, `reddit/comments ${target}`, { limit: limit + 5 });
  return rows
    .map((record, index) => redditApifyCommentPost(record, target, index))
    .filter(Boolean)
    .slice(0, limit);
}

function redditApifyCommentPost(record, target, index) {
  const content = firstTextValue(record, [
    "body",
    "text",
    "comment",
    "commentText",
    "content",
    "message"
  ]);
  if (!content) {
    return null;
  }
  const author = firstTextValue(record, ["author", "username", "user", "userName", "commenter"]);
  const link = firstTextValue(record, ["permalink", "url", "link"]) || target;
  return commentPostFromRecord({
    platform: "Reddit",
    source: `Apify ${APIFY_REDDIT_COMMENTS_ACTOR}`,
    target,
    index,
    record: {
      "目标link": target,
      "评论者账号": author,
      "评论内容": content,
      "发布时间（UTC+8）": firstTextValue(record, ["createdAt", "created_at", "createdUtc", "created_utc", "date", "time"]),
      "sentiment rating": sentimentRating(sentimentFromText(content)),
      "链接": normalizeSocialUrl(link)
    }
  });
}

async function collectRedditAccount(target, input, task) {
  const username = normalizeHandle(target).replace(/^u\//, "");
  const posts = await opencliJson(task, "reddit", ["user-posts", username, "-f", "json"]);
  const comments = shouldCollectComments(input.commentPolicy)
    ? await opencliJson(task, "reddit", ["user-comments", username, "-f", "json"])
    : [];
  const sampleTexts = []
    .concat(Array.isArray(posts) ? posts.map((row) => row.title || row.text) : [])
    .concat(Array.isArray(comments) ? comments.map((row) => row.text) : [])
    .filter(Boolean);
  return [normalizePost({
    id: `reddit_user_${username}`,
    title: `u/${username} 的 Reddit 活跃内容`,
    body: trimText(sampleTexts[0] || "", 180),
    platform: "Reddit",
    source: "opencli",
    score: 0.81,
    sentiment: sentimentFromText(sampleTexts.join(" ")),
    comments: Array.isArray(comments) ? comments.length : 0,
    likes: numberValue(Array.isArray(posts) ? posts[0]?.score : 0),
    url: `https://www.reddit.com/user/${username}`,
    author: username,
    publishedAt: "",
    themes: themePairsFromTexts(sampleTexts)
  })];
}

async function collectInstagramKeyword(query, input, task) {
  const rows = await opencliJson(task, "instagram", ["search", query, "--limit", "3", "-f", "json"]);
  if (!Array.isArray(rows) || !rows.length) {
    return [];
  }
  const username = rows[0].username || query.replace(/^@/, "");
  return collectInstagramAccount(username, input, task);
}

async function collectInstagramLink(target, input, task) {
  const username = extractInstagramUsername(target);
  if (!username) {
    warnTask(task, "Instagram 链接当前只支持账号主页，帖子链接暂不支持正文与评论采集。");
    return [];
  }
  return collectInstagramAccount(username, input, task);
}

async function collectInstagramPostComments(target, input, task) {
  const code = extractInstagramPostCode(target);
  if (!code) {
    throw new Error("Instagram Link 评论采集需要帖子、Reel 或 TV 链接。");
  }

  const limit = numericReplyLimit(input.commentPolicy);
  let comments = [];
  try {
    comments = await collectTikHubComments({
      platform: "Instagram",
      target,
      task,
      endpoint: "/api/v1/instagram/v3/get_post_comments",
      params: { code, count: limit },
      operation: "instagram post comments"
    });
  } catch (error) {
    warnTask(task, `TikHub Instagram 评论接口本次未跑通：${error instanceof Error ? error.message : String(error)}`);
  }
  const replies = comments.length && shouldCollectCommentReplies(input)
    ? await collectInstagramCommentReplies({ target, task, comments, limit })
    : [];
  const records = dedupeCommentRecords([...comments, ...replies]);
  if (!records.length) {
    warnTask(task, "TikHub Instagram 评论接口本次没有返回可导出的评论。");
    try {
      const fallback = await collectBrowserVisibleComments("Instagram", target, input, task);
      if (fallback.length) {
        return fallback;
      }
    } catch (error) {
      warnTask(task, `Instagram 浏览器可见评论兜底未跑通：${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return records.slice(0, limit + replies.length).map((record, index) => commentPostFromRecord({
    platform: "Instagram",
    source: record._source || "TikHub Instagram comments",
    target,
    index,
    record
  }));
}

async function collectInstagramCommentReplies({ target, task, comments, limit }) {
  const result = [];
  const candidates = comments
    .map((comment) => comment._commentId)
    .filter(Boolean)
    .slice(0, 3);
  for (const commentId of candidates) {
    try {
      const replies = await collectTikHubComments({
        platform: "Instagram",
        target,
        task,
        endpoint: "/api/v1/instagram/v3/get_comment_replies",
        params: { comment_id: commentId, count: limit },
        operation: "instagram comment replies",
        parentCommentId: commentId
      });
      result.push(...replies);
    } catch (error) {
      warnTask(task, `Instagram 评论回复未拉取成功：${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return result;
}

async function collectInstagramAccount(target, input, task) {
  const username = normalizeHandle(target);
  const rows = await opencliJson(task, "instagram", ["user", username, "--limit", "4", "-f", "json"]);
  const posts = Array.isArray(rows) ? rows : [];
  if (!posts.length) {
    return [];
  }
  return [normalizePost({
    id: `instagram_${username}`,
    title: `@${username} 最近内容`,
    body: posts.map((row) => row.caption).filter(Boolean).slice(0, 2).join(" "),
    platform: "Instagram",
    source: "opencli",
    score: 0.79,
    sentiment: sentimentFromText(posts.map((row) => row.caption).join(" ")),
    comments: posts.reduce((sum, row) => sum + numberValue(row.comments), 0),
    likes: posts.reduce((sum, row) => sum + numberValue(row.likes), 0),
    url: `https://www.instagram.com/${username}`,
    author: username,
    publishedAt: posts[0]?.date || "",
    themes: themePairsFromTexts(posts.map((row) => row.caption).filter(Boolean))
  })];
}

async function collectFacebookKeyword(query, input, task) {
  return collectKeywordWithCloakBrowserFirst("Facebook", query, input, task, () => collectKeywordWithApiFirst(
    "Facebook",
    task,
    "apify",
    () => collectFacebookKeywordViaApify(query, input, task),
    () => collectFacebookKeywordViaOpencli(query, input, task)
  ));
}

async function collectFacebookKeywordViaApify(query, input, task) {
  const window = taskTimeWindow(input);
  const rows = await apifyRunActorDatasetItems(APIFY_FACEBOOK_POST_SEARCH_ACTOR, {
    query: String(query || "").trim(),
    recent_posts: Boolean(window?.hasWindow),
    start_date: window?.startDate || "",
    end_date: window?.endDate || "",
    maxResults: API_KEYWORD_MAX_RESULTS
  }, task, `facebook/search ${query}`, { limit: API_KEYWORD_MAX_RESULTS + 5 });
  return rows
    .map((row, index) => apiKeywordPost("Facebook", row, query, `Apify ${APIFY_FACEBOOK_POST_SEARCH_ACTOR}`, index))
    .filter(Boolean)
    .slice(0, API_KEYWORD_MAX_RESULTS);
}

async function collectFacebookKeywordViaOpencli(query, input, task) {
  const rows = await opencliJson(task, "facebook", ["search", query, "--limit", "3", "-f", "json"]);
  return rows.slice(0, 3).map((row, index) => normalizePost({
    id: `facebook_search_${index}_${slugify(row.url || row.title)}`,
    title: row.title || `Facebook 搜索结果 ${index + 1}`,
    body: row.text || "",
    platform: "Facebook",
    source: "opencli",
    score: scoreFromQuery(query, `${row.title || ""} ${row.text || ""}`),
    sentiment: sentimentFromText(row.text || row.title || ""),
    comments: 0,
    likes: 0,
    url: row.url || "",
    author: "",
    publishedAt: "",
    themes: themePairsFromTexts([row.text || row.title || ""])
  }));
}

async function collectFacebookLink(target, input, task) {
  const username = extractFacebookUsername(target);
  if (!username) {
    throw new Error("无法从 Facebook 链接中识别页面名");
  }
  return collectFacebookAccount(username, input, task);
}

async function collectFacebookLinkComments(target, input, task) {
  const cached = readCachedCommentPosts("Facebook", target, task);
  if (cached.length) {
    return cached;
  }
  if (isApiProviderReady("apify")) {
    try {
      const apiComments = await collectFacebookLinkCommentsViaApify(target, input, task);
      if (apiComments.length) {
        return apiComments;
      }
      warnTask(task, "Apify Facebook comments actor 本次没有返回可导出的评论。");
    } catch (error) {
      warnTask(task, `Apify Facebook comments actor 采集失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }
  const comments = await collectBrowserVisibleComments("Facebook", target, input, task);
  if (!comments.length) {
    warnTask(task, "Facebook 页面未采集到可见评论；请确认浏览器已登录并展开评论区后重试。");
  }
  return comments;
}

async function collectFacebookLinkCommentsViaApify(target, input, task) {
  const limit = numericReplyLimit(input.commentPolicy);
  const rows = await apifyRunActorDatasetItems(APIFY_FACEBOOK_COMMENTS_ACTOR, {
    startUrls: [{ url: target }],
    resultsLimit: limit,
    includeNestedComments: shouldCollectCommentReplies(input),
    viewOption: "RANKED_UNFILTERED",
    onlyCommentsNewerThan: input.timeWindow?.startDate || ""
  }, task, `facebook/comments ${target}`, { limit: limit + 5 });
  return rows
    .map((record, index) => facebookApifyCommentPost(record, target, index))
    .filter(Boolean)
    .slice(0, limit);
}

function facebookApifyCommentPost(record, target, index) {
  const content = firstTextValue(record, [
    "text",
    "comment",
    "commentText",
    "message",
    "body",
    "content"
  ]);
  if (!content) {
    return null;
  }
  const author = firstTextValue(record, [
    "profileName",
    "authorName",
    "author.name",
    "user.name",
    "name",
    "username"
  ]);
  const link = firstTextValue(record, ["commentUrl", "url", "link", "facebookUrl"]) || target;
  return commentPostFromRecord({
    platform: "Facebook",
    source: `Apify ${APIFY_FACEBOOK_COMMENTS_ACTOR}`,
    target,
    index,
    record: {
      "目标link": target,
      "评论者账号": author,
      "评论内容": content,
      "发布时间（UTC+8）": firstTextValue(record, ["date", "createdAt", "created_at", "timestamp", "time"]),
      "sentiment rating": sentimentRating(sentimentFromText(content)),
      "链接": normalizeSocialUrl(link)
    }
  });
}

async function collectFacebookAccount(target, input, task) {
  const username = normalizeHandle(target);
  const profileRows = await opencliJson(task, "facebook", ["profile", username, "-f", "json"]);
  const searchRows = await opencliJson(task, "facebook", ["search", username, "--limit", "1", "-f", "json"]);
  const profile = Array.isArray(profileRows) ? profileRows[0] : profileRows;
  const search = Array.isArray(searchRows) ? searchRows[0] : searchRows;
  return [normalizePost({
    id: `facebook_${username}`,
    title: `${profile?.name || username} 的 Facebook 页面`,
    body: search?.text || "",
    platform: "Facebook",
    source: "opencli",
    score: 0.73,
    sentiment: "中性",
    comments: 0,
    likes: parseChineseCount(profile?.followers),
    url: profile?.url || search?.url || `https://www.facebook.com/${username}`,
    author: profile?.username || username,
    publishedAt: "",
    themes: themePairsFromTexts([search?.text || profile?.name || username])
  })];
}

async function collectGoogleNews(query, input, task, firecrawl) {
  return collectKeywordWithCloakBrowserFirst("Google News", query, input, task, () => collectGoogleNewsViaOpencli(query, input, task, firecrawl));
}

async function collectGoogleNewsViaOpencli(query, input, task, firecrawl) {
  const rows = await opencliJson(task, "google", ["news", query, "--limit", "4", "-f", "json"]);
  const results = [];
  for (const row of rows.slice(0, 4)) {
    let articleText = "";
    if (firecrawl.available && row.url) {
      try {
        const scraped = await firecrawl.scrape(row.url);
        articleText = extractFirecrawlText(scraped);
      } catch (error) {
        warnTask(task, `Firecrawl 抓取新闻外链失败：${error instanceof Error ? error.message : String(error)}`);
      }
    }
    results.push(normalizePost({
      id: `gnews_${slugify(row.url || row.title)}`,
      title: row.title || "Google News 结果",
      body: articleText || `${row.source || ""} ${row.date || ""}`.trim(),
      platform: "Google News",
      source: firecrawl.available && articleText ? "opencli + Firecrawl" : "opencli",
      score: scoreFromQuery(query, `${row.title || ""} ${articleText || ""}`),
      sentiment: sentimentFromText(`${row.title || ""} ${articleText || ""}`),
      comments: 0,
      likes: 0,
      url: row.url || "",
      author: row.source || "",
      publishedAt: row.date || "",
      themes: themePairsFromTexts([articleText || row.title || ""])
    }));
  }
  return results;
}

async function collectGoogleKeywordSearch(query, input, task) {
  return collectKeywordWithCloakBrowserFirst("Google", query, input, task, () => collectGoogleKeywordFallback(query, input, task));
}

async function collectGoogleKeywordFallback(query, input, task) {
  if (keywordWebFirstEnabled() && opencliVersion) {
    try {
      const webPosts = await collectGoogleKeywordViaOpencli(query, input, task);
      if (webPosts.length) {
        logTask(task, `Google 关键词已优先使用网页搜索，返回 ${webPosts.length} 条。`);
        return webPosts;
      }
      warnTask(task, "Google 网页关键词搜索没有返回样本。");
    } catch (error) {
      warnTask(task, `Google 网页关键词搜索失败：${error instanceof Error ? error.message : String(error)}`);
    }
    if (!keywordApiFallbackEnabled()) {
      return [];
    }
    logTask(task, "Google 网页搜索未命中，已回退 Apify 文章 actor。");
  }
  if (!keywordApiFallbackEnabled()) {
    warnTask(task, "Google 已关闭关键词 API 兜底，本次不调用 Apify。");
    return [];
  }
  return collectGoogleKeywordViaApify(query, input, task);
}

async function collectGoogleKeywordViaOpencli(query, input, task) {
  const rows = await opencliJson(task, "google", ["search", query, "--limit", String(APIFY_GOOGLE_KEYWORD_MAX_RESULTS), "-f", "json"]);
  return rows
    .slice(0, APIFY_GOOGLE_KEYWORD_MAX_RESULTS)
    .map((row, index) => googleWebSearchPost(row, query, index))
    .filter(Boolean);
}

function googleWebSearchPost(row, query, index) {
  if (!row || typeof row !== "object") {
    return null;
  }
  const title = findFirstTextByKeys(row, ["title", "name", "headline"]);
  const url = findFirstTextByKeys(row, ["url", "link"]);
  const snippet = findFirstTextByKeys(row, ["snippet", "description", "summary", "text"]);
  if (!title && !url && !snippet) {
    return null;
  }
  const textForScoring = [title, snippet, url].filter(Boolean).join(" ");
  return normalizePost({
    id: `google_web_${slugify(url || title || index)}`,
    title: title || `Google 网页搜索结果 ${index + 1}`,
    body: snippet,
    platform: "Google",
    source: "opencli google/search",
    score: scoreFromQuery(query, textForScoring),
    sentiment: sentimentFromText(`${title} ${snippet}`),
    comments: 0,
    likes: 0,
    url,
    author: domainFromUrl(url),
    publishedAt: findFirstTextByKeys(row, ["date", "publishedAt", "time"]),
    themes: themePairsFromTexts([snippet || title || ""])
  });
}

function domainFromUrl(value) {
  try {
    return new URL(String(value || "").trim()).hostname.replace(/^www\./, "");
  } catch (_error) {
    return "";
  }
}

async function collectGoogleKeywordViaApify(query, input, task) {
  if (!isApiProviderReady("apify")) {
    warnTask(task, "Google 关键词采集需要配置 APIFY_API_TOKEN。");
    return [];
  }
  const actorInput = buildGoogleFullArticleActorInput(query, input);
  const rows = await apifyRunActorDatasetItems(
    APIFY_GOOGLE_FULL_ARTICLE_ACTOR,
    actorInput,
    task,
    `google/search ${query}`,
    { limit: APIFY_GOOGLE_KEYWORD_MAX_RESULTS + 5 }
  );
  const posts = rows
    .map((row, index) => googleFullArticlePost(row, query, index))
    .filter(Boolean)
    .slice(0, APIFY_GOOGLE_KEYWORD_MAX_RESULTS);
  if (!posts.length) {
    warnTask(task, "Google Apify actor 本次没有返回可导出的搜索/文章样本。");
  }
  return posts;
}

function buildGoogleFullArticleActorInput(query, input) {
  return {
    queries: [String(query || "").trim()].filter(Boolean),
    articles_limit: Math.max(10, APIFY_GOOGLE_KEYWORD_MAX_RESULTS),
    days_back: googleDaysBackForInput(input),
    domain: "com",
    tbm: "",
    device: "desktop"
  };
}

function googleDaysBackForInput(input) {
  const window = taskTimeWindow(input);
  if (!window?.hasWindow || !window.startMs) {
    return 7;
  }
  const now = Date.now();
  const end = Math.max(now, window.endMs || now);
  return Math.max(1, Math.ceil((end - window.startMs + 1) / DAY_MS));
}

function googleFullArticlePost(row, query, index) {
  if (!row || typeof row !== "object") {
    return null;
  }
  const title = findFirstTextByKeys(row, ["title", "headline", "articleTitle", "article_title", "name"]);
  const url = findFirstTextByKeys(row, ["url", "link", "articleUrl", "article_url", "sourceUrl", "source_url"]);
  const body = findFirstTextByKeys(row, [
    "articleText",
    "article_text",
    "text",
    "content",
    "markdown",
    "description",
    "snippet",
    "summary"
  ]);
  if (!title && !body && !url) {
    return null;
  }
  const sourceName = findFirstTextByKeys(row, ["source", "sourceName", "publisher", "siteName", "domain", "author"]);
  const publishedAt = findFirstTextByKeys(row, ["publishedAt", "published_at", "date", "time", "datetime", "createdAt"]);
  const textForScoring = [title, body, sourceName].filter(Boolean).join(" ");
  return normalizePost({
    id: `google_${slugify(url || title || index)}`,
    title: title || `Google 搜索结果 ${index + 1}`,
    body: body || sourceName || "",
    platform: "Google",
    source: `Apify ${APIFY_GOOGLE_FULL_ARTICLE_ACTOR}`,
    score: scoreFromQuery(query, textForScoring),
    sentiment: sentimentFromText(textForScoring),
    comments: numberFromRecord(row, ["comments", "commentCount", "commentsCount"]),
    likes: numberFromRecord(row, ["likes", "likeCount", "reactions", "score"]),
    url,
    author: sourceName,
    publishedAt,
    themes: themePairsFromTexts([body || title || ""])
  });
}

async function collectLinkedInKeywordSearch(query, input, task) {
  return collectKeywordWithCloakBrowserFirst("LinkedIn", query, input, task, async () => {
    if (!keywordApiFallbackEnabled()) {
      warnTask(task, "LinkedIn 已关闭关键词 API 兜底，本次不调用 Apify。");
      return [];
    }
    return collectLinkedInKeywordViaApify(query, input, task);
  });
}

async function collectLinkedInKeywordViaApify(query, input, task) {
  if (!isApiProviderReady("apify")) {
    warnTask(task, "LinkedIn 关键词帖子搜索需要配置 APIFY_API_TOKEN。");
    return [];
  }
  const actorInput = buildLinkedInPostSearchActorInput(query, input);
  const rows = await apifyRunActorDatasetItems(
    APIFY_LINKEDIN_POST_SEARCH_ACTOR,
    actorInput,
    task,
    `linkedin/search ${query}`,
    { limit: APIFY_LINKEDIN_KEYWORD_MAX_RESULTS + 5 }
  );
  const posts = rows
    .map((row, index) => linkedInKeywordPost(row, query, index))
    .filter(Boolean)
    .slice(0, APIFY_LINKEDIN_KEYWORD_MAX_RESULTS);
  if (!posts.length) {
    warnTask(task, "LinkedIn Apify post search actor 本次没有返回可导出的帖子样本。");
  }
  return posts;
}

function buildLinkedInPostSearchActorInput(query, input) {
  const collectComments = shouldCollectComments(input.commentPolicy);
  const actorInput = {
    searchQueries: [String(query || "").trim()].filter(Boolean),
    maxPosts: APIFY_LINKEDIN_KEYWORD_MAX_RESULTS,
    sortBy: "date",
    contentType: "all",
    profileScraperMode: "short",
    scrapeComments: collectComments,
    maxComments: collectComments ? Number(replyLimitForPolicy(input.commentPolicy)) || 5 : 0,
    commentsProfileScraperMode: "short"
  };
  const postedLimit = linkedInPostedLimitForInput(input);
  if (postedLimit) {
    actorInput.postedLimit = postedLimit;
  }
  const window = taskTimeWindow(input);
  if (window?.startDate) {
    actorInput.postedLimitDate = window.startDate;
  }
  return actorInput;
}

function linkedInKeywordPost(row, query, index) {
  if (!row || typeof row !== "object") {
    return null;
  }
  const content = findFirstTextByKeys(row, [
    "text",
    "postText",
    "post_text",
    "content",
    "commentary",
    "description",
    "body",
    "summary",
    "title"
  ]);
  const url = findFirstTextByKeys(row, [
    "postUrl",
    "post_url",
    "url",
    "link",
    "activityUrl",
    "activity_url",
    "linkedinUrl",
    "permalink"
  ]);
  const author = findFirstTextByKeys(row, [
    "authorName",
    "author_name",
    "author.name",
    "author.fullName",
    "actorName",
    "actor.name",
    "profileName",
    "profile.name",
    "companyName",
    "company.name",
    "username"
  ]);
  if (!content && !url && !author) {
    return null;
  }
  const publishedAt = findFirstTextByKeys(row, [
    "postedAt",
    "posted_at",
    "publishedAt",
    "published_at",
    "createdAt",
    "created_at",
    "date",
    "time",
    "datetime"
  ]);
  const textForScoring = [content, author].filter(Boolean).join(" ");
  return normalizePost({
    id: `linkedin_${slugify(url || content || index)}`,
    title: trimText(content, 76) || `LinkedIn 搜索结果 ${index + 1}`,
    body: content,
    platform: "LinkedIn",
    source: `Apify ${APIFY_LINKEDIN_POST_SEARCH_ACTOR}`,
    score: scoreFromQuery(query, textForScoring),
    sentiment: sentimentFromText(textForScoring),
    comments: numberFromRecord(row, ["comments", "commentCount", "commentsCount", "numComments", "totalComments"]),
    likes: numberFromRecord(row, ["likes", "likeCount", "numLikes", "reactions", "reactionCount", "totalReactions"]),
    url,
    author,
    publishedAt,
    themes: themePairsFromTexts([content || author || ""])
  });
}

function numberFromRecord(record, keys) {
  for (const key of keys) {
    const value = valueAtPath(record, key);
    if (value !== undefined && value !== null && value !== "") {
      const numeric = numberValue(value);
      if (numeric) {
        return numeric;
      }
    }
  }
  const found = findFirstTextByKeys(record, keys);
  return numberValue(found);
}

async function collectLinkedInLinkComments(target, input, task) {
  const cached = readCachedCommentPosts("LinkedIn", target, task);
  if (cached.length) {
    return cached;
  }

  if (isApiProviderReady("apify")) {
    try {
      const apiComments = await collectLinkedInApifyLinkComments(target, input, task);
      if (apiComments.length) {
        return apiComments;
      }
      if (opencliVersion) {
        warnTask(task, "LinkedIn Apify actor 本次未返回评论，已切换到浏览器可见评论兜底。");
      }
    } catch (error) {
      if (opencliVersion) {
        warnTask(task, `LinkedIn Apify actor 采集失败，已切换到浏览器兜底：${error instanceof Error ? error.message : String(error)}`);
      } else {
        warnTask(task, `LinkedIn Apify actor 采集失败，且 opencli 不可用：${error instanceof Error ? error.message : String(error)}`);
        return [];
      }
    }
  }

  if (!opencliVersion) {
    warnTask(task, "LinkedIn 评论采集需要配置 APIFY_API_TOKEN；未配置 Apify 时还需要可用的 opencli 浏览器登录态。");
    return [];
  }

  const comments = await collectBrowserVisibleComments("LinkedIn", target, input, task);
  if (!comments.length) {
    warnTask(task, "LinkedIn 页面未采集到可见评论；请确认 APIFY_API_TOKEN 已配置，或浏览器已登录并展开目标帖子的评论区。");
  }
  return comments;
}

async function collectLinkedInApifyLinkComments(target, input, task) {
  if (!looksLikeUrl(target)) {
    throw new Error("LinkedIn Link 评论采集需要完整 URL。");
  }
  const { actorInput, maxItems } = buildLinkedInCommentsActorInput(target, input);
  const rows = await apifyRunActorDatasetItems(
    APIFY_LINKEDIN_COMMENTS_ACTOR,
    actorInput,
    task,
    `linkedin/comments ${target}`,
    { limit: maxItems + 5 }
  );
  return flattenLinkedInCommentRecords(rows)
    .map((record, index) => linkedInApifyCommentPost(record, target, index))
    .filter(Boolean)
    .slice(0, maxItems);
}

function buildLinkedInCommentsActorInput(target, input) {
  const maxItems = Math.max(1, Math.min(50, Number(replyLimitForPolicy(input.commentPolicy)) || 5));
  const actorInput = {
    posts: [target],
    maxItems,
    scrapeReplies: String(input.commentPolicy || "").includes("完整")
  };
  const postedLimit = linkedInPostedLimitForInput(input);
  if (postedLimit) {
    actorInput.postedLimit = postedLimit;
  }
  return { actorInput, maxItems };
}

function linkedInPostedLimitForInput(input) {
  const label = String(input?.timeRange || "").toLowerCase();
  if (/24\s*(小时|h|hour)/i.test(label)) return "24h";
  if (/7\s*(天|d|day)|week|周/i.test(label)) return "week";
  if (/30\s*(天|d|day)|month|月/i.test(label)) return "month";
  const window = input?.timeWindow;
  if (!window?.hasWindow || !window.startMs || !window.endMs) {
    return "";
  }
  const days = Math.max(1, Math.ceil((window.endMs - window.startMs) / DAY_MS));
  if (days <= 1) return "24h";
  if (days <= 7) return "week";
  if (days <= 31) return "month";
  if (days <= 93) return "3months";
  if (days <= 186) return "6months";
  return "year";
}

function flattenLinkedInCommentRecords(rows) {
  const flattened = [];
  const nestedKeys = ["comments", "replies", "childComments", "nestedComments"];
  for (const row of Array.isArray(rows) ? rows : []) {
    if (!row || typeof row !== "object") {
      continue;
    }
    flattened.push(row);
    for (const key of nestedKeys) {
      const nested = valueAtPath(row, key);
      if (Array.isArray(nested)) {
        nested.forEach((child) => {
          if (child && typeof child === "object") {
            flattened.push({
              ...child,
              postUrl: firstTextValue(child, ["postUrl", "post.url"]) || firstTextValue(row, ["postUrl", "url", "link"])
            });
          }
        });
      }
    }
  }
  return flattened;
}

function linkedInApifyCommentPost(record, target, index) {
  const content = firstTextValue(record, [
    "comment",
    "commentText",
    "comment.text",
    "text",
    "content",
    "message",
    "body",
    "description",
    "reply",
    "replyText"
  ]);
  if (!content) {
    return null;
  }
  const author = firstTextValue(record, [
    "authorName",
    "author.name",
    "author.fullName",
    "commenterName",
    "commenter.name",
    "profileName",
    "profile.name",
    "userName",
    "user.name",
    "user.fullName",
    "actorName",
    "actor.name",
    "person.name",
    "username"
  ]);
  const publishedAt = firstTextValue(record, [
    "createdAt",
    "created_at",
    "publishedAt",
    "published_at",
    "postedAt",
    "commentedAt",
    "date",
    "time",
    "datetime",
    "comment.createdAt"
  ]);
  const link = firstTextValue(record, [
    "commentUrl",
    "comment.url",
    "url",
    "link",
    "commentLink",
    "permalink",
    "activityUrl",
    "postUrl"
  ]) || target;
  return commentPostFromRecord({
    platform: "LinkedIn",
    source: `Apify ${APIFY_LINKEDIN_COMMENTS_ACTOR}`,
    target,
    index,
    record: {
      "目标link": target,
      "评论者账号": author,
      "评论内容": content,
      "发布时间（UTC+8）": publishedAt,
      "sentiment rating": sentimentRating(sentimentFromText(content)),
      "链接": link
    }
  });
}

async function collectGoogleLinkComments(target, input, task, firecrawl) {
  const cached = readCachedCommentPosts("Google", target, task);
  if (cached.length) {
    return cached;
  }
  if (isApiProviderReady("apify")) {
    try {
      const apiRows = await collectGoogleLinkViaApifyCrawler(target, task);
      if (apiRows.length) {
        return apiRows;
      }
      warnTask(task, "Google/网页 Apify crawler 本次没有返回可导出的页面正文。");
    } catch (error) {
      warnTask(task, `Google/网页 Apify crawler 采集失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }
  const comments = await collectBrowserVisibleComments("Google", target, input, task);
  if (comments.length) {
    return comments;
  }
  if (firecrawl.available) {
    try {
      const scraped = await firecrawl.scrape(target);
      const text = extractFirecrawlText(scraped);
      if (text) {
        warnTask(task, "Google/网页目标没有识别出独立评论节点，已保留页面正文片段作为人工复核线索。");
        return [commentPostFromRecord({
          platform: "Google",
          source: "Firecrawl",
          target,
          index: 0,
          record: {
            "目标link": target,
            "评论者账号": extractFirecrawlTitle(scraped) || "page",
            "评论内容": text,
            "发布时间（UTC+8）": "unavailable",
            "sentiment rating": sentimentRating(sentimentFromText(text)),
            "链接": target
          }
        })];
      }
    } catch (error) {
      warnTask(task, `Firecrawl 兜底读取网页失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }
  warnTask(task, "Google/网页目标未采集到可见评论；请确认评论区已展开，或先按 social-comment-export SOP 生成 strict JSON 后复用。");
  return [];
}

async function collectGoogleLinkViaApifyCrawler(target, task) {
  if (!looksLikeUrl(target)) {
    throw new Error("Google/网页 Link 模式需要完整 URL。");
  }
  const rows = await apifyRunActorDatasetItems(APIFY_WEBSITE_CONTENT_CRAWLER_ACTOR, {
    startUrls: [{ url: target }],
    maxCrawlDepth: 0,
    maxCrawlPages: 1,
    useSitemaps: false,
    respectRobotsTxtFile: true
  }, task, `google/webpage ${target}`, { limit: 3 });
  return rows
    .map((record, index) => googleApifyPagePost(record, target, index))
    .filter(Boolean)
    .slice(0, 1);
}

function googleApifyPagePost(record, target, index) {
  const content = firstTextValue(record, [
    "markdown",
    "text",
    "content",
    "html",
    "description",
    "metadata.description"
  ]);
  if (!content) {
    return null;
  }
  return commentPostFromRecord({
    platform: "Google",
    source: `Apify ${APIFY_WEBSITE_CONTENT_CRAWLER_ACTOR}`,
    target,
    index,
    record: {
      "目标link": target,
      "评论者账号": domainFromUrl(target),
      "评论内容": trimText(content.replace(/\s+/g, " "), 700),
      "发布时间（UTC+8）": "",
      "sentiment rating": sentimentRating(sentimentFromText(content)),
      "链接": firstTextValue(record, ["url", "sourceUrl", "metadata.url"]) || target
    }
  });
}

async function collectTikHubComments({ platform, target, task, endpoint, params, operation, parentCommentId = "" }) {
  const payload = await externalApiRequest("tikhub", buildQueryEndpoint(endpoint, params), {
    method: "GET",
    operation
  }, task);
  const items = extractTikHubCommentItems(payload);
  return items
    .map((item, index) => normalizeTikHubCommentRecord({ platform, target, item, index, operation, parentCommentId }))
    .filter((record) => record["评论内容"]);
}

function buildQueryEndpoint(endpoint, params = {}) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params || {})) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `${endpoint}?${query}` : endpoint;
}

function extractTikHubCommentItems(payload) {
  const directPaths = [
    "data.comments",
    "data.comment_list",
    "data.commentList",
    "data.items",
    "data.list",
    "data.data.comments",
    "data.data.comment_list",
    "comments",
    "comment_list",
    "items",
    "list"
  ];
  for (const pathName of directPaths) {
    const value = valueAtPath(payload, pathName);
    if (Array.isArray(value) && value.length) {
      return value;
    }
  }
  if (Array.isArray(payload)) {
    return payload;
  }
  const arrays = [];
  collectCommentArrays(payload, arrays, 0);
  return arrays.sort((left, right) => right.length - left.length)[0] || [];
}

function collectCommentArrays(value, arrays, depth) {
  if (!value || depth > 6) return;
  if (Array.isArray(value)) {
    if (value.some(looksLikeCommentRecord)) {
      arrays.push(value);
    }
    value.forEach((item) => collectCommentArrays(item, arrays, depth + 1));
    return;
  }
  if (typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (Array.isArray(child) && /(comment|reply|replies|item|list)/i.test(key) && child.some(looksLikeCommentRecord)) {
      arrays.push(child);
    }
    collectCommentArrays(child, arrays, depth + 1);
  }
}

function looksLikeCommentRecord(record) {
  if (!record || typeof record !== "object") return false;
  return Boolean(commentContentFromRecord(record) || commentIdFromRecord(record));
}

function normalizeTikHubCommentRecord({ platform, target, item, index, operation, parentCommentId = "" }) {
  const content = commentContentFromRecord(item);
  const author = commentAuthorFromRecord(item) || `${platform} user`;
  const commentId = commentIdFromRecord(item);
  const publishedAt = commentPublishedAtFromRecord(item);
  const link = firstTextValue(item, [
    "url",
    "link",
    "permalink",
    "share_url",
    "comment_url",
    "comment.link",
    "comment.url"
  ]) || (commentId ? `${target}#comment-${commentId}` : target);
  return {
    _source: `TikHub ${operation}`,
    _commentId: commentId,
    _parentCommentId: parentCommentId,
    "目标link": target,
    "评论者账号": author,
    "评论内容": content,
    "发布时间（UTC+8）": publishedAt,
    "sentiment rating": sentimentRating(sentimentFromText(content)),
    "链接": link || `${target}#comment-${index + 1}`
  };
}

function commentContentFromRecord(record) {
  return firstTextValue(record, [
    "text",
    "comment_text",
    "content",
    "comment",
    "body",
    "message",
    "caption",
    "desc",
    "comment.text",
    "comment.content"
  ]);
}

function commentAuthorFromRecord(record) {
  return firstTextValue(record, [
    "user.username",
    "user.unique_id",
    "user.nickname",
    "user.full_name",
    "user.name",
    "author.username",
    "author.unique_id",
    "author.nickname",
    "author.name",
    "owner.username",
    "username",
    "nickname",
    "name"
  ]);
}

function commentIdFromRecord(record) {
  return firstTextValue(record, [
    "cid",
    "comment_id",
    "commentId",
    "pk",
    "id",
    "comment.pk",
    "comment.id"
  ]);
}

function commentPublishedAtFromRecord(record) {
  const direct = firstTextValue(record, [
    "created_at",
    "create_time",
    "createdAt",
    "created_time",
    "timestamp",
    "time",
    "datetime"
  ]);
  const numeric = Number(direct);
  if (Number.isFinite(numeric) && numeric > 0) {
    return formatCommentDateForExport(new Date(numeric > 1_000_000_000_000 ? numeric : numeric * 1000).toISOString());
  }
  return formatCommentDateForExport(direct);
}

function numericReplyLimit(policy) {
  return Number(replyLimitForPolicy(policy)) || 5;
}

function shouldCollectCommentReplies(input) {
  return shouldCollectComments(input.commentPolicy) && (String(input.commentPolicy || "").includes("完整") || input.depth === "深度采集");
}

function dedupeCommentRecords(records) {
  const seen = new Set();
  return records.filter((record) => {
    const key = [record._commentId, record._parentCommentId, record["评论者账号"], record["评论内容"], record["链接"]].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function collectFirecrawlWeb(query, input, task, firecrawl) {
  if (!firecrawl.available) {
    warnTask(task, "未配置 FIRECRAWL_API_KEY，本次跳过全网搜索与网页补采。");
    return [];
  }

  if (input.mode === "link" && looksLikeUrl(query)) {
    const scraped = await firecrawl.scrape(query);
    const text = extractFirecrawlText(scraped);
    const title = extractFirecrawlTitle(scraped) || query;
    return [normalizePost({
      id: `firecrawl_${slugify(query)}`,
      title,
      body: text,
      platform: "全网",
      source: "Firecrawl",
      score: 0.84,
      sentiment: sentimentFromText(text),
      comments: 0,
      likes: 0,
      url: query,
      author: "",
      publishedAt: "",
      themes: themePairsFromTexts([text])
    })];
  }

  const results = await firecrawl.search(query);
  const rows = results.slice(0, 4);
  return rows.map((row, index) => normalizePost({
    id: `firecrawl_search_${index}_${slugify(row.url || row.title)}`,
    title: row.title || `全网搜索结果 ${index + 1}`,
    body: trimText(row.markdown || row.description || "", 320),
    platform: "全网",
    source: "Firecrawl",
    score: scoreFromQuery(query, `${row.title || ""} ${row.markdown || row.description || ""}`),
    sentiment: sentimentFromText(`${row.title || ""} ${row.markdown || row.description || ""}`),
    comments: 0,
    likes: 0,
    url: row.url || "",
    author: row.source || "",
    publishedAt: "",
    themes: themePairsFromTexts([row.markdown || row.description || row.title || ""])
  }));
}

function createFirecrawlClient(apiKey, task) {
  const available = Boolean(apiKey);
  return {
    available,
    async search(query) {
      if (!available) {
        throw new Error("Missing Firecrawl API key");
      }
      task.result.stats.firecrawlCalls += 1;
      const payload = await firecrawlRequest(apiKey, "/search", {
        query,
        limit: 4
      }, task);
      const data = payload?.data?.web || payload?.data || payload?.results || [];
      return Array.isArray(data) ? data : [];
    },
    async scrape(url) {
      if (!available) {
        throw new Error("Missing Firecrawl API key");
      }
      task.result.stats.firecrawlCalls += 1;
      return firecrawlRequest(apiKey, "/scrape", {
        url,
        formats: ["markdown"]
      }, task);
    }
  };
}

async function firecrawlRequest(apiKey, endpoint, body, task) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FIRECRAWL_TIMEOUT_MS);
  try {
    const response = await fetch(`${FIRECRAWL_BASE_URL}${endpoint}`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    const text = await response.text();
    const json = text ? JSON.parse(text) : {};
    if (!response.ok) {
      throw new Error(json?.error || json?.message || `Firecrawl request failed: ${response.status}`);
    }
    recordApiCall("firecrawl", { task, endpoint, operation: endpoint.replace(/^\//, ""), ok: true });
    return json;
  } catch (error) {
    recordApiCall("firecrawl", { task, endpoint, operation: endpoint.replace(/^\//, ""), ok: false, error });
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function extractFirecrawlText(payload) {
  const data = payload?.data || payload;
  const text = data?.markdown || data?.content || data?.html || "";
  return trimText(String(text || "").replace(/\s+/g, " ").trim(), 420);
}

function extractFirecrawlTitle(payload) {
  const data = payload?.data || payload;
  return data?.metadata?.title || data?.metadata?.sourceURL || "";
}

function readCachedCommentPosts(platform, target, task) {
  if (!looksLikeUrl(target) || !fs.existsSync(COMMENT_CACHE_DIR)) {
    return [];
  }
  const targetKey = comparableUrl(target);
  const platformKey = platformCode(platform);
  const candidates = fs.readdirSync(COMMENT_CACHE_DIR)
    .filter((name) => name.endsWith("_strict_fields.json"))
    .filter((name) => {
      const lower = name.toLowerCase();
      if (platformKey === "google") {
        return lower.includes("google") || lower.includes("news") || lower.includes("article") || lower.includes("eurogamer");
      }
      return lower.includes(platformKey);
    });

  for (const filename of candidates) {
    const filePath = path.join(COMMENT_CACHE_DIR, filename);
    try {
      const records = JSON.parse(fs.readFileSync(filePath, "utf8"));
      const matched = (Array.isArray(records) ? records : [])
        .filter((record) => comparableUrl(record["目标link"]) === targetKey)
        .map((record, index) => commentPostFromRecord({
          platform,
          source: `strict JSON cache:${filename}`,
          target,
          index,
          record
        }));
      if (matched.length) {
        logTask(task, `${platform} 复用本地 strict JSON：${filename}，命中 ${matched.length} 条评论。`);
        return matched;
      }
    } catch (error) {
      warnTask(task, `读取评论缓存 ${filename} 失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return [];
}

async function collectCloakBrowserKeywordSearch(platform, query, input, task) {
  const cloak = detectCloakBrowserAvailability();
  if (!cloak.available) {
    throw new Error(`CloakBrowser 不可用：${cloak.error || "未安装 cloakbrowser 包"}`);
  }
	  const payload = {
	    platform,
	    query,
	    scrollRounds: browserVisibleScrollRounds(input),
	    limit: cloakBrowserKeywordLimit(platform),
	    options: cloakBrowserOptions()
	  };

  if (!task.result.stats.cloakBrowserCalls) {
    task.result.stats.cloakBrowserCalls = 0;
  }
  task.result.stats.cloakBrowserCalls += 1;
  task.result.stats.browserEngine = "cloakbrowser";

  try {
    const raw = await runCommand(process.execPath, [
      CLOAKBROWSER_KEYWORD_SEARCH_SCRIPT,
      encodeJsonArgument(payload)
    ], {
      timeoutMs: 95_000,
      env: {
        ...process.env,
        CI: "1"
      }
    });
    recordApiCall("cloakbrowser", {
      task,
      endpoint: "browser/keyword-search",
      operation: `${platform} keyword web search`,
      ok: true
    });
    const parsed = parseLooseJson(raw);
    return Array.isArray(parsed) ? parsed : Array.isArray(parsed?.records) ? parsed.records : [];
  } catch (error) {
    recordApiCall("cloakbrowser", {
      task,
      endpoint: "browser/keyword-search",
      operation: `${platform} keyword web search`,
      ok: false,
      error
    });
    throw error;
  }
	}

function cloakBrowserKeywordLimit(platform) {
  if (platform === "Google") {
    return APIFY_GOOGLE_KEYWORD_MAX_RESULTS;
  }
  if (platform === "LinkedIn") {
    return APIFY_LINKEDIN_KEYWORD_MAX_RESULTS;
  }
  if (platform === "TikTok") {
    return APIFY_TIKTOK_MAX_RESULTS;
  }
  return 5;
}

async function collectBrowserVisibleComments(platform, target, input, task) {
  if (!looksLikeUrl(target)) {
    throw new Error(`${platform} Link 评论采集需要完整 URL。`);
  }
  const preference = browserEnginePreference();
  if (preference === "auto" || preference === "cloak") {
    const cloak = detectCloakBrowserAvailability();
    if (!cloak.available) {
      const message = `CloakBrowser 不可用：${cloak.error || "未安装 cloakbrowser 包"}`;
      if (preference === "cloak") {
        throw new Error(message);
      }
      logTask(task, `${platform} ${message}，已回退 opencli 浏览器采集。`);
    } else {
      try {
        const posts = await collectCloakBrowserVisibleComments(platform, target, input, task);
        if (posts.length || preference === "cloak") {
          return posts;
        }
        logTask(task, `${platform} CloakBrowser 未提取到可见评论，已回退 opencli 浏览器采集。`);
      } catch (error) {
        if (preference === "cloak") {
          throw error;
        }
        logTask(task, `${platform} CloakBrowser 采集失败，已回退 opencli：${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }
  return collectOpencliBrowserVisibleComments(platform, target, input, task);
}

async function collectOpencliBrowserVisibleComments(platform, target, input, task) {
  await opencliBrowserText(task, ["open", target], { timeoutMs: 60_000 });
  const scrollRounds = browserVisibleScrollRounds(input);
  for (let index = 0; index < scrollRounds; index += 1) {
    try {
      await opencliBrowserText(task, ["scroll", "down"], { timeoutMs: 15_000 });
    } catch (_error) {
      break;
    }
  }
  const raw = await opencliBrowserText(task, ["eval", browserCommentExtractionScript(platform, target)], { timeoutMs: 45_000 });
  const parsed = parseLooseJson(raw);
  const records = Array.isArray(parsed) ? parsed : [];
  return records
    .filter((record) => record && record["评论内容"])
    .slice(0, replyLimitForPolicy(input.commentPolicy))
    .map((record, index) => commentPostFromRecord({
      platform,
      source: "opencli browser visible page",
      target,
      index,
      record
    }));
}

async function collectCloakBrowserVisibleComments(platform, target, input, task) {
  const limit = Number(replyLimitForPolicy(input.commentPolicy)) || 5;
  const payload = {
    platform,
    target,
    scrollRounds: browserVisibleScrollRounds(input),
    limit: Math.max(20, limit),
    options: cloakBrowserOptions()
  };

  if (!task.result.stats.cloakBrowserCalls) {
    task.result.stats.cloakBrowserCalls = 0;
  }
  task.result.stats.cloakBrowserCalls += 1;
  task.result.stats.browserEngine = "cloakbrowser";

  try {
    const raw = await runCommand(process.execPath, [
      CLOAKBROWSER_VISIBLE_COMMENTS_SCRIPT,
      encodeJsonArgument(payload)
    ], {
      timeoutMs: 95_000,
      env: {
        ...process.env,
        CI: "1"
      }
    });
    recordApiCall("cloakbrowser", {
      task,
      endpoint: "browser/visible-comments",
      operation: `${platform} target link visible comments`,
      ok: true
    });
    const parsed = parseLooseJson(raw);
    const records = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.records) ? parsed.records : [];
    return records
      .filter((record) => record && record["评论内容"])
      .slice(0, limit)
      .map((record, index) => commentPostFromRecord({
        platform,
        source: "CloakBrowser visible page",
        target,
        index,
        record
      }));
  } catch (error) {
    recordApiCall("cloakbrowser", {
      task,
      endpoint: "browser/visible-comments",
      operation: `${platform} target link visible comments`,
      ok: false,
      error
    });
    throw error;
  }
}

function browserVisibleScrollRounds(input) {
  return input.depth === "深度采集" ? 5 : input.depth === "轻量抽样" ? 2 : 3;
}

function encodeJsonArgument(payload) {
  return Buffer.from(JSON.stringify(payload), "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function browserCommentExtractionScript(platform, target) {
  const platformLiteral = JSON.stringify(platform);
  const targetLiteral = JSON.stringify(target);
  return `(() => {
    const platform = ${platformLiteral};
    const target = ${targetLiteral};
    const textOf = (node) => (node?.innerText || node?.textContent || "").replace(/\\s+/g, " ").trim();
    const fullUrl = (href) => {
      if (!href) return "";
      try { return new URL(href, location.href).href; } catch (_error) { return ""; }
    };
    const selectors = platform === "LinkedIn"
      ? [".comments-comment-item", ".comments-comments-list__comment-item", "[data-test-comment]", "article", "[role='article']"]
      : platform === "Facebook"
        ? ["[aria-label='Comment']", "[aria-label*='comment']", "[role='article']", "div[data-ad-preview='message']"]
        : [".comment", "[class*='comment']", "[id*='comment']", "article", "[role='article']"];
    const nodes = Array.from(new Set(selectors.flatMap((selector) => Array.from(document.querySelectorAll(selector)))));
    const records = nodes.map((node) => {
      const text = textOf(node);
      const link = fullUrl(node.querySelector("a[href*='comment'], a[href*='activity'], a[href*='posts'], a[href*='status'], a[href*='#comments'], a[href]")?.getAttribute("href"));
      const author = textOf(node.querySelector("a[href*='/in/'], a[href*='facebook.com/'], a[href*='x.com/'], strong, h3, [class*='author'], [class*='actor']"));
      const timeNode = node.querySelector("time, abbr, [datetime], [class*='time'], [aria-label*='ago'], [aria-label*='前']");
      const time = timeNode?.getAttribute("datetime") || timeNode?.getAttribute("title") || timeNode?.getAttribute("aria-label") || textOf(timeNode);
      return { "目标link": target, "评论者账号": author, "评论内容": text, "发布时间（UTC+8）": time, "链接": link || target };
    }).filter((record) => {
      const text = record["评论内容"] || "";
      if (text.length < 2 || text.length > 1200) return false;
      if (/^(like|reply|share|send|comment|comments|reactions?|赞|回复|分享|评论)$/i.test(text)) return false;
      if (text === document.body.innerText.replace(/\\s+/g, " ").trim()) return false;
      return true;
    });
    const seen = new Set();
    return JSON.stringify(records.filter((record) => {
      const key = [record["评论者账号"], record["评论内容"], record["链接"]].join("|");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 80));
  })()`;
}

async function opencliBrowserText(task, args, options = {}) {
  if (task.result.stats.opencliBrowserCalls >= OPENCLI_BROWSER_CALL_LIMIT) {
    throw new Error(`已达到单次任务 opencli 浏览器调用上限 ${OPENCLI_BROWSER_CALL_LIMIT} 次，已中止后续浏览器采集。`);
  }
  task.result.stats.opencliBrowserCalls += 1;
  task.result.stats.opencliCalls += 1;
  try {
    const result = await runCommand("opencli", ["browser", ...args], {
      timeoutMs: options.timeoutMs || OPENCLI_TIMEOUT_MS,
      env: {
        ...process.env,
        CI: "1"
      }
    });
    recordApiCall("opencli", { task, endpoint: `browser/${args[0] || "command"}`, operation: ["browser", ...args].join(" "), ok: true });
    return result;
  } catch (error) {
    recordApiCall("opencli", { task, endpoint: `browser/${args[0] || "command"}`, operation: ["browser", ...args].join(" "), ok: false, error });
    throw error;
  }
}

async function opencliJson(task, site, args, options = {}) {
  const usesBrowser = options.browser ?? !OPENCLI_BROWSERLESS_SITES.has(site);
  if (usesBrowser) {
    if (task.result.stats.opencliBrowserCalls >= OPENCLI_BROWSER_CALL_LIMIT) {
      throw new Error(`已达到单次任务 opencli 浏览器调用上限 ${OPENCLI_BROWSER_CALL_LIMIT} 次，已中止后续浏览器采集。`);
    }
    task.result.stats.opencliBrowserCalls += 1;
  }
  task.result.stats.opencliCalls += 1;
  try {
    const stdout = await runCommand("opencli", [site, ...args], {
      timeoutMs: OPENCLI_TIMEOUT_MS,
      env: {
        ...process.env,
        CI: "1"
      }
    });
    const parsed = parseLooseJson(stdout);
    if (parsed === null) {
      throw new Error(`opencli ${site} 返回了无法解析的 JSON`);
    }
    recordApiCall("opencli", { task, endpoint: `${site}/${args[0] || "command"}`, operation: [site, ...args].join(" "), ok: true });
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch (error) {
    recordApiCall("opencli", { task, endpoint: `${site}/${args[0] || "command"}`, operation: [site, ...args].join(" "), ok: false, error });
    throw error;
  }
}

function runCommand(command, args, options = {}) {
  const timeoutMs = options.timeoutMs || 30_000;
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: PROJECT_ROOT,
      env: options.env || process.env,
      stdio: ["ignore", "pipe", "pipe"],
      detached: process.platform !== "win32"
    });

    let stdout = "";
    let stderr = "";
    let killedByTimeout = false;
    let killedHard = false;
    let hardKillTimer = null;
    const killChild = (signal) => {
      try {
        if (process.platform !== "win32" && child.pid) {
          process.kill(-child.pid, signal);
        } else {
          child.kill(signal);
        }
      } catch (_error) {
        // Ignore missing process errors.
      }
    };
    const timer = setTimeout(() => {
      killedByTimeout = true;
      killChild("SIGTERM");
      hardKillTimer = setTimeout(() => {
        killedHard = true;
        killChild("SIGKILL");
      }, 2_500);
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });

    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.on("error", (error) => {
      clearTimeout(timer);
      if (hardKillTimer) {
        clearTimeout(hardKillTimer);
      }
      reject(error);
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      if (hardKillTimer) {
        clearTimeout(hardKillTimer);
      }
      if (killedByTimeout) {
        const suffix = killedHard ? " and required SIGKILL cleanup" : "";
        return reject(new Error(`${command} ${args.join(" ")} timed out after ${timeoutMs}ms${suffix}`));
      }
      if (code !== 0) {
        const details = [stdout.trim(), stderr.trim()].filter(Boolean).join("\n");
        return reject(new Error(details || `${command} exited with code ${code}`));
      }
      resolve(stdout.trim());
    });
  });
}

function parseLooseJson(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) {
    return null;
  }

  try {
    return JSON.parse(trimmed);
  } catch (_error) {
    // Ignore and fall back to loose parsing.
  }

  for (const startChar of ["[", "{"]) {
    const start = trimmed.indexOf(startChar);
    if (start === -1) {
      continue;
    }
    const endChar = startChar === "[" ? "]" : "}";
    for (let end = trimmed.lastIndexOf(endChar); end > start; end = trimmed.lastIndexOf(endChar, end - 1)) {
      const candidate = trimmed.slice(start, end + 1);
      try {
        return JSON.parse(candidate);
      } catch (_error) {
        // Keep looking.
      }
    }
  }

  return null;
}

function normalizePost(post) {
  return {
    id: post.id,
    title: trimText(post.title || "未命名样本", 100),
    body: trimText(post.body || "", 420),
    platform: post.platform,
    source: post.source,
    score: clampScore(post.score),
    sentiment: post.sentiment || "中性",
    comments: numberValue(post.comments),
    likes: numberValue(post.likes),
    url: post.url || "",
    author: post.author || "",
    publishedAt: normalizeCollectedTimestamp(post.publishedAt) || post.publishedAt || "",
    commentRecord: post.commentRecord || null,
    themes: Array.isArray(post.themes) && post.themes.length
      ? post.themes.slice(0, 3)
      : [["样本 1", trimText(post.body || "", 120)]]
  };
}

function dedupePosts(posts) {
  const seen = new Set();
  return posts.filter((post) => {
    const key = `${post.platform}:${post.url || post.title}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function buildRowsForTask(posts, input, task) {
  return input.mode === "link"
    ? buildCommentRows(posts, input, task)
    : buildUnifiedRows(posts, input, task);
}

function rowHeadersForTask(input, posts = []) {
  return rowHeadersForMode(input.mode);
}

function buildUnifiedRows(posts, input, task) {
  const rows = posts.map((post) => {
    const content = buildRowContent(post);
    const language = detectLanguage(content);
    return {
      _rowId: `${task.id}:${post.id}`,
      _taskId: task.id,
      _postId: post.id,
      _source: post.source,
      _score: post.score,
      _author: post.author || "",
      _themes: Array.isArray(post.themes) ? post.themes : [],
      _route: task.route || "",
      _status: task.status,
      key_words: input.subject,
      platform: platformCode(post.platform),
      content,
      content_to_en: contentToEnglish(content, language),
      sentiment_rating: sentimentRating(post.sentiment),
      search_time: normalizeIsoInstant(task.createdAt) || new Date().toISOString(),
      comment_time: normalizeCommentTime(post.publishedAt),
      topics: classifyTopic(post, content),
      language,
      content_url: post.url || "unavailable",
      engagement: normalizeEngagement(post)
    };
  });
  return dedupeBoardRows(rows);
}

function buildCommentRows(posts, input, task) {
  const rows = posts.map((post, index) => {
    const record = normalizeCommentRecordForBoard(post.commentRecord || {
      "目标link": input.subject,
      "评论者账号": post.author || "",
      "评论内容": buildRowContent(post),
      "发布时间（UTC+8）": formatCommentDateForExport(post.publishedAt),
      "sentiment rating": sentimentRating(post.sentiment),
      "链接": post.url || input.subject
    });
    return {
      _rowId: `${task.id}:${post.id || index}`,
      _taskId: task.id,
      _postId: post.id,
      _source: post.source,
      _score: post.score,
      _author: record["评论者账号"] || "",
      _themes: Array.isArray(post.themes) ? post.themes : [],
      _route: task.route || "",
      _status: task.status,
      _schema: "comment",
      _platform: platformCode(post.platform),
      ...record
    };
  });
  return dedupeBoardRows(rows);
}

function dedupeBoardRows(rows) {
  const seen = new Set();
  return rows.filter((row) => {
    if (row._schema === "comment") {
      const key = row["链接"] && row["链接"] !== "unavailable"
        ? row["链接"]
        : `${row["目标link"]}:${row["评论者账号"]}:${row["发布时间（UTC+8）"]}:${row["评论内容"]}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    }
    const key = row.content_url && row.content_url !== "unavailable"
      ? row.content_url
      : row.content
        ? `${row.platform}:${row.content}`
        : `${row.platform}:${row._author}:${row.comment_time}:${row.content}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function buildRowContent(post) {
  const title = String(post.title || "").trim();
  const body = String(post.body || "").trim();
  if (!body) {
    return title;
  }
  if (!title || title === body) {
    return body;
  }
  return trimText(`${title}\n\n${body}`, 700);
}

function commentPostFromRecord({ platform, source, target, index, record }) {
  const normalized = normalizeCommentRecordForBoard(record, target);
  const content = normalized["评论内容"];
  const author = normalized["评论者账号"];
  return normalizePost({
    id: `comment_${platformCode(platform)}_${index}_${slugify(normalized["链接"] || `${author}_${content}`)}`,
    title: trimText(content, 76) || `${platform} 评论 ${index + 1}`,
    body: content,
    platform,
    source,
    score: 0.9,
    sentiment: sentimentFromRating(normalized["sentiment rating"]),
    comments: 1,
    likes: 0,
    url: normalized["链接"] || normalized["目标link"] || target,
    author,
    publishedAt: normalized["发布时间（UTC+8）"],
    commentRecord: normalized,
    themes: [[author || `评论 ${index + 1}`, trimText(content, 120)]]
  });
}

function normalizeCommentRecordForBoard(record, fallbackTarget = "") {
  const content = String(record["评论内容"] ?? record.comment ?? record.text ?? record.content ?? "").trim();
  const ratingValue = record["sentiment rating"] ?? record.sentiment_rating ?? sentimentRating(sentimentFromText(content));
  const rating = Number(ratingValue);
  return {
    "目标link": String(record["目标link"] || record.target || fallbackTarget || "").trim(),
    "评论者账号": String(record["评论者账号"] || record.author || record.username || record.user || "").trim(),
    "评论内容": content,
    "发布时间（UTC+8）": formatCommentDateForExport(record["发布时间（UTC+8）"] || record["评论时间"] || record["发布时间"] || record.created_at || record.time || record.datetime),
    "sentiment rating": [1, 2, 3].includes(rating) ? rating : sentimentRating(sentimentFromText(content)),
    "链接": String(record["链接"] || record.url || record.link || fallbackTarget || "").trim()
  };
}

function sentimentFromRating(rating) {
  if (Number(rating) === 1) {
    return "正面";
  }
  if (Number(rating) === 3) {
    return "负面";
  }
  return "中性";
}

function formatCommentDateForExport(value) {
  const text = String(value || "").trim();
  if (!text) {
    return "unavailable";
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }
  const parsed = Date.parse(text);
  if (Number.isNaN(parsed)) {
    return "unavailable";
  }
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(parsed));
}

function inferCommentLinkPlatform(target) {
  try {
    const url = new URL(String(target || "").trim());
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    if (host === "x.com" || host.endsWith(".x.com") || host === "twitter.com" || host.endsWith(".twitter.com")) {
      return "X";
    }
    if (host === "reddit.com" || host.endsWith(".reddit.com") || host === "redd.it") {
      return "Reddit";
    }
    if (host === "tiktok.com" || host.endsWith(".tiktok.com") || host === "vm.tiktok.com") {
      return "TikTok";
    }
    if (host === "xiaohongshu.com" || host.endsWith(".xiaohongshu.com") || host === "xhslink.com") {
      return "小红书";
    }
    if (host === "weibo.com" || host.endsWith(".weibo.com") || host === "weibo.cn" || host.endsWith(".weibo.cn")) {
      return "微博";
    }
    if (host === "youtube.com" || host.endsWith(".youtube.com") || host === "youtu.be") {
      return "YouTube";
    }
    if (host === "bilibili.com" || host.endsWith(".bilibili.com") || host === "b23.tv") {
      return "B站";
    }
    if (host === "instagram.com" || host.endsWith(".instagram.com")) {
      return "Instagram";
    }
    if (host === "linkedin.com" || host.endsWith(".linkedin.com")) {
      return "LinkedIn";
    }
    if (host === "facebook.com" || host.endsWith(".facebook.com") || host === "fb.watch") {
      return "Facebook";
    }
    return "Google";
  } catch (_error) {
    return "";
  }
}

function comparableUrl(value) {
  return String(value || "")
    .trim()
    .replace(/^http:\/\/twitter\.com\//i, "https://x.com/")
    .replace(/^https:\/\/twitter\.com\//i, "https://x.com/")
    .replace(/\/+$/, "");
}

function extractXAuthor(url) {
  const match = String(url || "").match(/https?:\/\/(?:www\.)?(?:x|twitter)\.com\/([^/]+)\/status\/\d+/i);
  return match ? match[1] : "";
}

function buildXStatusUrl(author, id) {
  if (!author || !id) {
    return "";
  }
  return `https://x.com/${String(author).replace(/^@/, "")}/status/${id}`;
}

function platformCode(platform) {
  return {
    "X": "x",
    "TikTok": "tiktok",
    "Reddit": "reddit",
    "小红书": "xiaohongshu",
    "微博": "weibo",
    "YouTube": "youtube",
    "B站": "bilibili",
    "Instagram": "instagram",
    "Facebook": "facebook",
    "Google": "google",
    "Google News": "google",
    "全网": "web",
    "LinkedIn": "linkedin"
  }[platform] || String(platform || "").toLowerCase();
}

function contentToEnglish(content, language) {
  const text = String(content || "").trim();
  if (!text) {
    return "";
  }
  if (language === "en" || language === "unknown") {
    return text;
  }
  return `Translation unavailable in MVP: ${text}`;
}

function sentimentRating(sentiment) {
  if (sentiment === "正面") {
    return 1;
  }
  if (sentiment === "负面") {
    return 3;
  }
  return 2;
}

function normalizeIsoInstant(value) {
  const text = String(value || "").trim();
  if (!text) {
    return "";
  }
  const parsed = Date.parse(text);
  if (Number.isNaN(parsed)) {
    return "";
  }
  return new Date(parsed).toISOString();
}

function normalizeCommentTime(value) {
  const text = String(value || "").trim();
  if (!text) {
    return "unavailable";
  }
  if (!/(Z|[+-]\d{2}:?\d{2}|UTC|GMT)/i.test(text)) {
    return "unavailable";
  }
  const parsed = Date.parse(text);
  if (Number.isNaN(parsed)) {
    return "unavailable";
  }
  return new Date(parsed).toISOString();
}

function normalizeDateText(value) {
  const text = String(value || "").trim();
  if (!text) {
    return "";
  }
  const direct = datePartsFromText(text);
  if (direct) {
    return formatDateParts(direct);
  }
  const chinese = text.match(/(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日?/);
  if (chinese) {
    return formatDateParts({
      year: Number(chinese[1]),
      month: Number(chinese[2]),
      day: Number(chinese[3])
    });
  }
  const parsed = Date.parse(text);
  if (Number.isNaN(parsed)) {
    return "";
  }
  return shanghaiDateText(new Date(parsed));
}

function datePartsFromText(value) {
  const match = String(value || "").trim().match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

function formatDateParts(parts) {
  if (!parts || !Number.isFinite(parts.year) || !Number.isFinite(parts.month) || !Number.isFinite(parts.day)) {
    return "";
  }
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  if (
    date.getUTCFullYear() !== parts.year
    || date.getUTCMonth() !== parts.month - 1
    || date.getUTCDate() !== parts.day
  ) {
    return "";
  }
  return [
    String(parts.year).padStart(4, "0"),
    String(parts.month).padStart(2, "0"),
    String(parts.day).padStart(2, "0")
  ].join("-");
}

function shanghaiDateText(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SHANGHAI_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function dateTextToShanghaiUtcMs(dateText, boundary = "start") {
  const parts = datePartsFromText(dateText);
  if (!parts) {
    return Number.NaN;
  }
  const hour = boundary === "end" ? 23 : 0;
  const minute = boundary === "end" ? 59 : 0;
  const second = boundary === "end" ? 59 : 0;
  const millisecond = boundary === "end" ? 999 : 0;
  return Date.UTC(parts.year, parts.month - 1, parts.day, hour, minute, second, millisecond) - SHANGHAI_UTC_OFFSET_MS;
}

function addDaysToDateText(dateText, days) {
  const parts = datePartsFromText(dateText);
  if (!parts) {
    return "";
  }
  const shifted = new Date(Date.UTC(parts.year, parts.month - 1, parts.day) + days * DAY_MS);
  return shifted.toISOString().slice(0, 10);
}

function taskTimeWindow(input = {}) {
  if (input.timeWindow && typeof input.timeWindow === "object") {
    return input.timeWindow;
  }
  return parseTaskTimeWindow(input);
}

function timeWindowDurationDays(window) {
  if (!window?.hasWindow || !Number.isFinite(window.startMs) || !Number.isFinite(window.endMs)) {
    return 0;
  }
  return Math.max(1, Math.ceil((window.endMs - window.startMs + 1) / DAY_MS));
}

function buildXKeywordSearchQuery(query, input) {
  const window = taskTimeWindow(input);
  let value = String(query || "").trim();
  if (!window?.hasWindow || !value) {
    return value;
  }
  if (!/\bsince:\d{4}-\d{2}-\d{2}/i.test(value) && window.startDate) {
    value = `${value} since:${window.startDate}`;
  }
  if (!/\buntil:\d{4}-\d{2}-\d{2}/i.test(value) && window.endDate) {
    value = `${value} until:${addDaysToDateText(window.endDate, 1)}`;
  }
  return value;
}

function redditTimeSearchArgs(input) {
  const window = taskTimeWindow(input);
  if (!window?.hasWindow) {
    return [];
  }
  const days = timeWindowDurationDays(window);
  if (days <= 1) return ["--time", "day"];
  if (days <= 7) return ["--time", "week"];
  if (days <= 31) return ["--time", "month"];
  if (days <= 366) return ["--time", "year"];
  return [];
}

function redditTimeRangeForInput(input) {
  const window = taskTimeWindow(input);
  if (!window?.hasWindow) {
    return "all";
  }
  const days = timeWindowDurationDays(window);
  if (days <= 1) return "day";
  if (days <= 7) return "week";
  if (days <= 31) return "month";
  if (days <= 366) return "year";
  return "all";
}

function youtubeUploadSearchArgs(input) {
  const window = taskTimeWindow(input);
  if (!window?.hasWindow) {
    return [];
  }
  const days = timeWindowDurationDays(window);
  if (days <= 1) return ["--upload", "today"];
  if (days <= 7) return ["--upload", "week"];
  if (days <= 31) return ["--upload", "month"];
  if (days <= 366) return ["--upload", "year"];
  return [];
}

function youtubeUploadDateForInput(input) {
  const window = taskTimeWindow(input);
  if (!window?.hasWindow) {
    return "";
  }
  const days = timeWindowDurationDays(window);
  if (days <= 1) return "today";
  if (days <= 7) return "this_week";
  if (days <= 31) return "this_month";
  if (days <= 366) return "this_year";
  return "";
}

function tikTokPublishTimeForInput(input) {
  const window = taskTimeWindow(input);
  if (!window?.hasWindow) {
    return 0;
  }
  const days = timeWindowDurationDays(window);
  if (days <= 1) return 1;
  if (days <= 7) return 7;
  if (days <= 31) return 30;
  if (days <= 93) return 90;
  if (days <= 186) return 180;
  return 0;
}

function keywordSearchUsesNativeTimeFilter(platform, input) {
  const window = taskTimeWindow(input);
  if (!window?.hasWindow) {
    return false;
  }
  if (shouldUseCloakBrowserKeywordCollector(platform)) {
    return false;
  }
  if (platform === "X") {
    return true;
  }
  if (platform === "Reddit") {
    return redditTimeSearchArgs(input).length > 0;
  }
  if (platform === "YouTube") {
    return youtubeUploadSearchArgs(input).length > 0;
  }
  if ((platform === "Google" || platform === "LinkedIn") && keywordWebFirstEnabled()) {
    return false;
  }
  if (platform === "Google" || platform === "LinkedIn") {
    return true;
  }
  return false;
}

function filterKeywordPostsByTimeWindow(platform, posts, input, task, options = {}) {
  const list = Array.isArray(posts) ? posts : [];
  const window = taskTimeWindow(input);
  if (!["keyword", "monitor"].includes(input.mode) || !window?.hasWindow || !list.length) {
    return list;
  }

  let dated = 0;
  let undated = 0;
  let dropped = 0;
  const filtered = list.filter((post) => {
    const normalized = normalizeCollectedTimestamp(post?.publishedAt);
    if (!normalized) {
      undated += 1;
      return true;
    }
    dated += 1;
    post.publishedAt = normalized;
    const timestamp = Date.parse(normalized);
    if (timestamp < window.startMs || timestamp > window.endMs) {
      dropped += 1;
      return false;
    }
    return true;
  });

  if (dropped) {
    logTask(task, `${platform} 已按 ${window.label || `${window.startDate} 至 ${window.endDate}`} 过滤掉 ${dropped} 条不在时间范围内的样本。`);
  }
  if (undated && !options.nativeFilterApplied) {
    warnTaskOnce(task, `${platform} 有 ${undated} 条样本未返回可解析发布时间；这些样本无法做本地时间二次过滤。`);
  }
  if (!dated && undated && options.nativeFilterApplied) {
    logTask(task, `${platform} 已使用平台原生时间筛选，但返回结果未提供可展示发布时间。`);
  }
  return filtered;
}

function normalizeCollectedTimestamp(value) {
  const timestamp = parseCollectedTimestampMs(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : "";
}

function parseCollectedTimestampMs(value, now = new Date()) {
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return value.getTime();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return value > 1_000_000_000_000 ? value : value * 1000;
  }
  const text = String(value || "").trim();
  if (!text || /^unavailable$/i.test(text)) {
    return Number.NaN;
  }
  if (/^\d{10,13}$/.test(text)) {
    const numeric = Number(text);
    return numeric > 1_000_000_000_000 ? numeric : numeric * 1000;
  }
  const dateOnly = normalizeDateText(text);
  if (dateOnly && (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(text) || /年\s*\d{1,2}月/.test(text))) {
    return dateTextToShanghaiUtcMs(dateOnly, "start");
  }
  const relative = parseRelativeTimestampMs(text, now);
  if (Number.isFinite(relative)) {
    return relative;
  }
  const parsed = Date.parse(text.replace(/UTC\+8/i, "GMT+0800"));
  return Number.isNaN(parsed) ? Number.NaN : parsed;
}

function parseRelativeTimestampMs(text, now = new Date()) {
  const value = String(text || "").trim().toLowerCase();
  if (!value) {
    return Number.NaN;
  }
  if (/(刚刚|刚才|just now|moments? ago)/i.test(value)) {
    return now.getTime();
  }
  if (/(昨天|yesterday)/i.test(value)) {
    return now.getTime() - DAY_MS;
  }
  if (/(今天|today)/i.test(value)) {
    return now.getTime();
  }

  const en = value.match(/(\d+(?:\.\d+)?)\s*(second|sec|s|minute|min|m|hour|hr|h|day|d|week|w|month|mo|year|y)s?\s+ago/i);
  if (en) {
    return now.getTime() - Number(en[1]) * relativeUnitMs(en[2]);
  }
  const zh = value.match(/(\d+(?:\.\d+)?)\s*(秒|分钟|分|小时|天|日|周|星期|个月|月|年)前/);
  if (zh) {
    return now.getTime() - Number(zh[1]) * relativeUnitMs(zh[2]);
  }
  return Number.NaN;
}

function relativeUnitMs(unit) {
  const normalized = String(unit || "").toLowerCase();
  if (/^(second|sec|s|秒)$/.test(normalized)) return 1000;
  if (/^(minute|min|m|分钟|分)$/.test(normalized)) return 60 * 1000;
  if (/^(hour|hr|h|小时)$/.test(normalized)) return 60 * 60 * 1000;
  if (/^(day|d|天|日)$/.test(normalized)) return DAY_MS;
  if (/^(week|w|周|星期)$/.test(normalized)) return 7 * DAY_MS;
  if (/^(month|mo|个月|月)$/.test(normalized)) return 30 * DAY_MS;
  if (/^(year|y|年)$/.test(normalized)) return 365 * DAY_MS;
  return DAY_MS;
}

function detectLanguage(text) {
  const value = String(text || "").trim();
  if (!value) {
    return "unknown";
  }
  const cjkHits = (value.match(/[\u3400-\u9fff]/g) || []).length;
  const latinHits = (value.match(/[A-Za-z]/g) || []).length;
  if (cjkHits && !latinHits) {
    return "zh";
  }
  if (latinHits && !cjkHits) {
    return "en";
  }
  if (cjkHits > latinHits / 2) {
    return "zh";
  }
  if (latinHits) {
    return "en";
  }
  return "unknown";
}

function normalizeEngagement(post) {
  const total = numberValue(post.likes) + numberValue(post.comments);
  return total > 0 ? total : "unavailable";
}

function classifyTopic(post, content) {
  const haystack = `${post.platform || ""} ${post.author || ""} ${content || ""}`.toLowerCase();
  if (/(hiring|recruit|job|career|vacanc|招聘|岗位|职位|招人)/i.test(haystack)) {
    return "Hiring / recruitment";
  }
  if (/(official|announcement|introducing|launch|release update|官宣|发布|公告|更新说明)/i.test(haystack)) {
    return "Official announcement";
  }
  if (/(game|rpg|trailer|gameplay|video game|玩法|预告|剧情|worldbuilding|dlc)/i.test(haystack)) {
    return "Game information";
  }
  if (/(team|staff|developer|artist|writer|producer|veteran|talent|成员|团队|开发者|前bioware)/i.test(haystack)) {
    return "Team / talent";
  }
  if (/(founder|leadership|ceo|executive|casey hudson|sam altman|创始人|高管|领导层)/i.test(haystack)) {
    return "Founder / leadership";
  }
  if (/(studio|company|profile|about us|工作室|公司介绍|公司简介)/i.test(haystack)) {
    return "Company / studio profile";
  }
  if (/(discussion|thread|reddit|comment|reply|debate|讨论|回复|串楼)/i.test(haystack)) {
    return "Social discussion";
  }
  if (/(can'?t wait|so ready|love this|hate this|peak|期待|喜欢|支持|吐槽|失望|震惊)/i.test(haystack)) {
    return "Fan reaction";
  }
  if (/(business|industry|market|funding|investment|commercial|行业|商业|市场|融资)/i.test(haystack)) {
    return "Business / industry";
  }
  if (post.platform === "Google News" || /(pcgamer|gamespot|ign|polygon|the verge|reuters|media|报道|采访)/i.test(haystack)) {
    return "Media coverage";
  }
  return "Other";
}

function themePairsFromTexts(texts) {
  const rows = texts
    .map((text) => trimText(String(text || "").replace(/\s+/g, " ").trim(), 120))
    .filter(Boolean)
    .slice(0, 3);

  if (!rows.length) {
    return [["样本 1", "没有可展示的正文片段。"]];
  }

  return rows.map((text, index) => [`样本 ${index + 1}`, text]);
}

function replacePostById(posts, id, nextPost) {
  return posts.map((post) => (post.id === id ? normalizePost(nextPost) : post));
}

function fieldMapFromRows(rows) {
  return (Array.isArray(rows) ? rows : []).reduce((acc, row, index) => {
    if (row && typeof row === "object" && "field" in row && "value" in row) {
      acc[String(row.field)] = row.value;
    } else if (row && typeof row === "object") {
      Object.entries(row).forEach(([key, value]) => {
        acc[`${index}.${key}`] = value;
      });
    }
    return acc;
  }, {});
}

function findFieldValue(fieldMap, matcher) {
  const entry = Object.entries(fieldMap).find(([key]) => matcher.test(key));
  return entry ? entry[1] : "";
}

function extractFieldValue(fieldMap, matchers) {
  for (const matcher of matchers) {
    const value = findFieldValue(fieldMap, matcher);
    if (value) {
      return String(value);
    }
  }
  return "";
}

function extractLongBody(fieldMap, matchers) {
  const direct = extractFieldValue(fieldMap, matchers);
  if (direct) {
    return trimText(String(direct).replace(/\s+/g, " ").trim(), 420);
  }
  const fallback = Object.values(fieldMap)
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(" ");
  return trimText(fallback.replace(/\s+/g, " ").trim(), 420);
}

function firstTextValue(record, keys) {
  for (const key of keys) {
    const value = valueAtPath(record, key);
    if (value !== undefined && value !== null && String(value).trim()) {
      if (typeof value === "object") {
        continue;
      }
      return String(value).trim();
    }
  }
  return "";
}

function findFirstTextByKeys(value, keys) {
  if (!value) return "";
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findFirstTextByKeys(item, keys);
      if (found) return found;
    }
    return "";
  }
  if (typeof value !== "object") return "";
  const direct = firstTextValue(value, keys);
  if (direct) return direct;
  for (const child of Object.values(value)) {
    const found = findFirstTextByKeys(child, keys);
    if (found) return found;
  }
  return "";
}

function tiktokText(record, keys) {
  return firstTextValue(record, keys);
}

function isTikTokVideoRecord(record) {
  if (!record || typeof record !== "object") {
    return false;
  }
  if (record._meta || record._message) {
    return false;
  }
  return Boolean(tiktokText(record, [
    "video_id",
    "id",
    "aweme_id",
    "text",
    "video_url",
    "url",
    "webVideoUrl",
    "shareUrl",
    "description",
    "desc"
  ]));
}

function tiktokNumber(record, keys) {
  for (const key of keys) {
    const value = Number(valueAtPath(record, key));
    if (Number.isFinite(value)) {
      return value;
    }
  }
  return 0;
}

function valueAtPath(record, pathName) {
  if (!record || typeof record !== "object") {
    return undefined;
  }
  if (Object.prototype.hasOwnProperty.call(record, pathName)) {
    return record[pathName];
  }
  return String(pathName || "").split(".").reduce((value, key) => {
    if (value === undefined || value === null) {
      return undefined;
    }
    if (typeof value !== "object") {
      return undefined;
    }
    return value[key];
  }, record);
}

function tiktokHashtags(record) {
  const raw = record?.hashtags ?? record?.hashtag_names ?? record?.challenges ?? record?.mentions ?? [];
  if (Array.isArray(raw)) {
    return raw
      .map((item) => typeof item === "string" ? item : item?.name || item?.title || item?.hashtag_name || "")
      .map((item) => String(item || "").replace(/^#/, "").trim())
      .filter(Boolean)
      .slice(0, 8);
  }
  return String(raw || "")
    .split(/[,\s]+/)
    .map((item) => item.replace(/^#/, "").trim())
    .filter(Boolean)
    .slice(0, 8);
}

function tiktokPublishedAt(record) {
  const direct = tiktokText(record, ["published_at", "created_at", "createTimeISO", "create_time_iso", "date", "datetime"]);
  if (normalizeIsoInstant(direct)) {
    return normalizeIsoInstant(direct);
  }
  const seconds = Number(valueAtPath(record, "createTime") ?? valueAtPath(record, "create_time") ?? valueAtPath(record, "timestamp") ?? valueAtPath(record, "published_ts"));
  if (Number.isFinite(seconds) && seconds > 0) {
    return new Date(seconds > 1_000_000_000_000 ? seconds : seconds * 1000).toISOString();
  }
  return "";
}

function subtitleTextFromRows(rows) {
  if (!Array.isArray(rows)) {
    return "";
  }
  const texts = rows
    .map((row) => row.text || row.content || row.value || "")
    .filter(Boolean);
  return trimText(texts.join(" "), 420);
}

function transcriptTextFromRows(rows) {
  if (!Array.isArray(rows)) {
    return "";
  }
  const texts = rows
    .map((row) => row.text || row.content || row.segment || row.value || "")
    .filter(Boolean);
  return trimText(texts.join(" "), 420);
}

function scoreFromQuery(query, text) {
  const subject = String(query || "").trim().toLowerCase();
  const body = String(text || "").trim().toLowerCase();
  if (!subject || !body) {
    return 0.62;
  }
  if (body.includes(subject)) {
    return 0.92;
  }
  const tokens = subject.split(/\s+/).filter(Boolean);
  const hits = tokens.filter((token) => body.includes(token)).length;
  return clampScore(0.55 + (tokens.length ? hits / tokens.length : 0) * 0.35);
}

function sentimentFromText(text) {
  const body = String(text || "").toLowerCase();
  const negativeWords = ["risk", "worry", "problem", "scam", "bad", "hate", "fucked", "down", "concern", "fail", "失败", "担忧", "风险", "差", "贵"];
  const positiveWords = ["love", "great", "good", "smart", "fast", "helpful", "amazing", "better", "efficient", "喜欢", "好用", "高效", "不错"];
  const negativeHits = negativeWords.filter((word) => body.includes(word)).length;
  const positiveHits = positiveWords.filter((word) => body.includes(word)).length;
  if (negativeHits > positiveHits) {
    return "负面";
  }
  if (positiveHits > negativeHits) {
    return "正面";
  }
  return "中性";
}

function shouldCollectComments(policy) {
  return !String(policy || "").includes("不采集");
}

function replyLimitForPolicy(policy) {
  if (String(policy || "").includes("完整")) {
    return "10";
  }
  return "5";
}

function trimText(text, max = 180) {
  const value = String(text || "").trim();
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

function numberValue(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  const normalized = String(value ?? "")
    .replace(/[^\d.-]/g, "");
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : 0;
}

function parseChineseCount(value) {
  const text = String(value || "").trim();
  if (!text) {
    return 0;
  }
  if (text.includes("万")) {
    return Math.round(parseFloat(text) * 10_000);
  }
  return numberValue(text);
}

function normalizeHandle(value) {
  return String(value || "")
    .trim()
    .replace(/^@/, "")
    .replace(/^https?:\/\/(www\.)?x\.com\//, "")
    .replace(/^https?:\/\/(www\.)?twitter\.com\//, "")
    .replace(/^https?:\/\/(www\.)?instagram\.com\//, "")
    .replace(/^https?:\/\/(www\.)?facebook\.com\//, "")
    .replace(/^https?:\/\/(www\.)?reddit\.com\/user\//, "")
    .replace(/^https?:\/\/(www\.)?weibo\.com\//, "")
    .replace(/^https?:\/\/(www\.)?bilibili\.com\//, "")
    .replace(/^https?:\/\/(www\.)?youtube\.com\//, "")
    .replace(/\/.*$/, "");
}

async function normalizeXiaohongshuNoteUrl(value) {
  const text = String(value || "").trim();
  if (!text) {
    return "";
  }
  if (text.includes("xsec_token")) {
    return text;
  }
  if (!looksLikeUrl(text)) {
    return text;
  }
  try {
    const response = await fetch(text, { redirect: "follow" });
    return response.url || text;
  } catch (_error) {
    return text;
  }
}

function normalizeXiaohongshuUserId(value) {
  const text = String(value || "").trim();
  const match = text.match(/xiaohongshu\.com\/user\/profile\/([^/?#]+)/i);
  if (match) {
    return match[1];
  }
  return normalizeHandle(text);
}

function extractTweetId(value) {
  const text = String(value || "").trim();
  const match = text.match(/status\/(\d+)/);
  if (match) {
    return match[1];
  }
  return /^\d+$/.test(text) ? text : "";
}

function extractTikTokAwemeId(value) {
  const text = String(value || "").trim();
  const match = text.match(/\/video\/(\d+)/i)
    || text.match(/[?&](?:aweme_id|item_id|video_id)=(\d+)/i)
    || text.match(/\/item\/(\d+)/i);
  if (match) {
    return match[1];
  }
  return /^\d{8,}$/.test(text) ? text : "";
}

function extractYouTubeVideoId(value) {
  const text = String(value || "").trim();
  const match = text.match(/[?&]v=([^&#]+)/i)
    || text.match(/youtu\.be\/([^/?#]+)/i)
    || text.match(/youtube\.com\/shorts\/([^/?#]+)/i)
    || text.match(/youtube\.com\/embed\/([^/?#]+)/i)
    || text.match(/youtube\.com\/live\/([^/?#]+)/i);
  if (match) {
    return match[1];
  }
  return /^[A-Za-z0-9_-]{6,}$/.test(text) && !looksLikeUrl(text) ? text : "";
}

function extractInstagramPostCode(value) {
  const text = String(value || "").trim();
  const match = text.match(/instagram\.com\/(?:p|reel|tv)\/([^/?#]+)/i);
  if (match) {
    return match[1];
  }
  return looksLikeUrl(text) ? "" : text.replace(/^\/+|\/+$/g, "");
}

function extractInstagramUsername(value) {
  const text = String(value || "").trim();
  const match = text.match(/instagram\.com\/([^/?#]+)/i);
  if (!match) {
    return "";
  }
  const candidate = match[1];
  return ["p", "reel", "stories"].includes(candidate.toLowerCase()) ? "" : candidate;
}

function extractFacebookUsername(value) {
  const text = String(value || "").trim();
  const match = text.match(/facebook\.com\/([^/?#]+)/i);
  return match ? match[1] : "";
}

function extractWeiboId(value) {
  const text = String(value || "").trim();
  if (!looksLikeUrl(text)) {
    return text;
  }
  const match = text.match(/[?&]idstr=([A-Za-z0-9]+)/i)
    || text.match(/[?&]mblogid=([A-Za-z0-9]+)/i)
    || text.match(/weibo\.com\/[^/]+\/([A-Za-z0-9]+)/i)
    || text.match(/detail\/([A-Za-z0-9]+)/i);
  return match ? match[1] : "";
}

function extractBilibiliBvid(value) {
  const text = String(value || "").trim();
  const match = text.match(/(BV[0-9A-Za-z]+)/);
  return match ? match[1] : "";
}

function looksLikeUrl(value) {
  return /^https?:\/\//i.test(String(value || "").trim());
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/https?:\/\//g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function clampScore(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0.65;
  }
  return Math.max(0.01, Math.min(0.99, Math.round(numeric * 100) / 100));
}

function modeLabel(mode) {
  return {
    keyword: "关键词研究",
    link: "目标 Link",
    account: "账号主体",
    monitor: "持续监控"
  }[mode] || "关键词研究";
}
