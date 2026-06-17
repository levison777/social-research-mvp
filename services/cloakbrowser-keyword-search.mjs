#!/usr/bin/env node

import * as cloakbrowser from "cloakbrowser";

const PLATFORM_CONFIGS = {
  X: {
    searchUrl: (query) => `https://x.com/search?q=${encodeURIComponent(query)}&src=typed_query&f=live`,
    itemSelectors: ["article[data-testid='tweet']", "article[role='article']", "[data-testid='cellInnerDiv'] article"],
    linkSelectors: ["a[href*='/status/']"],
    authorSelectors: ["[data-testid='User-Name']", "a[href^='/'][role='link']", "div[dir='ltr'] span"],
    titleSelectors: ["[data-testid='tweetText']", "[lang]"],
    timeSelectors: ["time"]
  },
  Reddit: {
    searchUrl: (query) => `https://www.reddit.com/search/?q=${encodeURIComponent(query)}&sort=new&type=link`,
    itemSelectors: ["shreddit-post", "[data-testid='post-container']", "article", "faceplate-tracker[noun='post']"],
    linkSelectors: ["a[href*='/comments/']", "a[data-testid='post-title']", "a[href^='/r/']"],
    authorSelectors: ["a[href*='/user/']", "a[href*='/u/']", "[slot='authorName']", "[data-testid='post_author_link']"],
    titleSelectors: ["a[data-testid='post-title']", "[slot='title']", "h3", "h2"],
    timeSelectors: ["time", "faceplate-timeago"]
  },
  TikTok: {
    searchUrl: (query) => `https://www.tiktok.com/search/video?q=${encodeURIComponent(query)}`,
    itemSelectors: ["[data-e2e='search_video-item']", "div[data-e2e*='search-video']", "a[href*='/video/']"],
    linkSelectors: ["a[href*='/video/']"],
    authorSelectors: ["a[href^='/@']", "[data-e2e*='user']", "[data-e2e*='author']"],
    titleSelectors: ["[data-e2e='search-card-video-caption']", "[data-e2e*='caption']", "h3", "span"],
    timeSelectors: ["time"]
  },
  "小红书": {
    searchUrl: (query) => `https://www.xiaohongshu.com/search_result?keyword=${encodeURIComponent(query)}&source=web_search_result_notes`,
    itemSelectors: [".note-item", ".feeds-page .note-item", "section[class*='note']", "a[href*='/explore/']", "a[href*='/discovery/item/']"],
    linkSelectors: ["a[href*='/explore/']", "a[href*='/discovery/item/']", "a[href]"],
    authorSelectors: [".author", ".name", "[class*='user']", "[class*='author']"],
    titleSelectors: [".title", "[class*='title']", ".desc", "span"],
    timeSelectors: ["time", "[class*='time']", "[class*='date']"]
  },
  "微博": {
    searchUrl: (query) => `https://s.weibo.com/weibo?q=${encodeURIComponent(query)}`,
    itemSelectors: [".card-wrap", ".card", "div[action-type='feed_list_item']", "article"],
    linkSelectors: ["a[action-type='feed_list_url']", "a[href*='/status/']", "a[href*='weibo.com/']"],
    authorSelectors: [".name", "a[nick-name]", "a[href*='weibo.com/u/']", "a[href*='weibo.com/']"],
    titleSelectors: [".txt", "[node-type='feed_list_content']", "p"],
    timeSelectors: [".from a", "time", "[class*='time']"]
  },
  YouTube: {
    searchUrl: (query) => `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
    itemSelectors: ["ytd-video-renderer", "ytd-rich-item-renderer", "ytd-item-section-renderer ytd-video-renderer"],
    linkSelectors: ["a#video-title", "a[href*='watch?v=']", "a[href*='/shorts/']"],
    authorSelectors: ["ytd-channel-name a", "#channel-name a", ".ytd-channel-name"],
    titleSelectors: ["a#video-title", "#video-title", "h3"],
    timeSelectors: ["#metadata-line span:nth-child(2)", "span.inline-metadata-item:nth-of-type(2)", "time"]
  },
  "B站": {
    searchUrl: (query) => `https://search.bilibili.com/all?keyword=${encodeURIComponent(query)}`,
    itemSelectors: [".video-list-item", ".bili-video-card", ".video-item", "a[href*='/video/']"],
    linkSelectors: ["a[href*='/video/']", "a[href*='bilibili.com/video/']"],
    authorSelectors: [".bili-video-card__info--author", ".up-name", ".author", "[class*='author']"],
    titleSelectors: [".bili-video-card__info--tit", ".title", "h3", "a[title]"],
    timeSelectors: [".bili-video-card__info--date", ".so-imgTag_rb", "time"]
  },
  Instagram: {
    searchUrl: (query) => `https://www.instagram.com/explore/search/keyword/?q=${encodeURIComponent(query)}`,
    itemSelectors: ["article a[href*='/p/']", "article a[href*='/reel/']", "a[href*='/p/']", "a[href*='/reel/']", "[role='main'] a[href]"],
    linkSelectors: ["a[href*='/p/']", "a[href*='/reel/']", "a[href]"],
    authorSelectors: ["a[href^='/']", "span", "h2"],
    titleSelectors: ["img[alt]", "span", "div"],
    timeSelectors: ["time"]
  },
  Facebook: {
    searchUrl: (query) => `https://www.facebook.com/search/posts/?q=${encodeURIComponent(query)}`,
    itemSelectors: ["[role='article']", "div[data-ad-preview='message']", "div[data-pagelet*='SearchResults'] [role='article']"],
    linkSelectors: ["a[href*='/posts/']", "a[href*='/permalink/']", "a[href*='story_fbid']", "a[href*='/videos/']", "a[href]"],
    authorSelectors: ["h2 a", "h3 a", "strong a", "a[role='link'] strong", "[class*='author']"],
    titleSelectors: ["div[data-ad-preview='message']", "[data-ad-comet-preview='message']", "span[dir='auto']", "div[dir='auto']"],
    timeSelectors: ["abbr", "time", "[aria-label*='ago']", "[aria-label*='前']"]
  },
  Google: {
    searchUrl: (query) => `https://www.google.com/search?q=${encodeURIComponent(query)}`,
    itemSelectors: ["div.g", "div[data-sokoban-container]", "article"],
    linkSelectors: ["a[href^='http']"],
    authorSelectors: ["cite", ".VuuXrf"],
    titleSelectors: ["h3", "[role='heading']"],
    timeSelectors: ["span"]
  },
  "Google News": {
    searchUrl: (query) => `https://news.google.com/search?q=${encodeURIComponent(query)}`,
    itemSelectors: ["article", "c-wiz article", "div[role='article']"],
    linkSelectors: ["a[href^='./articles/']", "a[href*='articles/']", "a[href^='http']"],
    authorSelectors: ["time + div", "[data-n-tid]", ".vr1PYe"],
    titleSelectors: ["h3", "h4", "a[href*='articles/']"],
    timeSelectors: ["time"]
  },
  LinkedIn: {
    searchUrl: (query) => `https://www.linkedin.com/search/results/content/?keywords=${encodeURIComponent(query)}&origin=GLOBAL_SEARCH_HEADER`,
    itemSelectors: ["[data-urn*='activity']", ".feed-shared-update-v2", ".reusable-search__result-container", "li[class*='reusable-search']", "article"],
    linkSelectors: ["a[href*='/feed/update/']", "a[href*='/posts/']", "a[href*='/activity-']", "a[href^='http']"],
    authorSelectors: ["a[href*='/in/']", "a[href*='/company/']", "[class*='actor']", "[class*='author']", "span[dir='ltr']"],
    titleSelectors: [".feed-shared-update-v2__description", ".update-components-text", "[class*='summary']", "span[dir='ltr']"],
    timeSelectors: ["time", "[datetime]", "[class*='time']", "[aria-label*='ago']", "[aria-label*='前']"]
  }
};

async function main() {
  const payload = decodePayload(process.argv[2]);
  const platform = String(payload.platform || "").trim();
  const query = String(payload.query || "").trim();
  if (!platform || !query) {
    throw new Error("Missing keyword search payload");
  }
  const config = PLATFORM_CONFIGS[platform];
  if (!config) {
    throw new Error(`Unsupported CloakBrowser keyword platform: ${platform}`);
  }

  const browser = await launchBrowser(payload.options || {});
  try {
    const page = await browser.newPage();
    const target = config.searchUrl(query);
    await page.goto(target, { waitUntil: "domcontentloaded", timeout: 75_000 });
    await page.waitForTimeout(2500);
    await dismissCommonOverlays(page);
    await clickPreferredTabs(page, platform);
    for (let index = 0; index < Number(payload.scrollRounds || 2); index += 1) {
      await page.mouse.wheel(0, 1000);
      await page.waitForTimeout(900);
    }
    const records = await page.evaluate(extractKeywordRecords, {
      platform,
      query,
      target,
      limit: Number(payload.limit || 5),
      config: serializableConfig(config)
    });
    console.log(JSON.stringify({ records, target: page.url() }));
  } finally {
    await browser.close();
  }
}

function serializableConfig(config) {
  const { searchUrl: _searchUrl, ...rest } = config;
  return rest;
}

function decodePayload(value) {
  if (!value) {
    throw new Error("Missing encoded payload");
  }
  const normalized = String(value).replace(/-/g, "+").replace(/_/g, "/");
  return JSON.parse(Buffer.from(normalized, "base64").toString("utf8"));
}

async function launchBrowser(options = {}) {
  return cloakbrowser.launch({
    headless: options.headless !== false,
    humanize: options.humanize !== false,
    geoip: Boolean(options.geoip),
    proxy: options.proxy || undefined,
    userDataDir: options.userDataDir || undefined,
    humanPreset: options.humanPreset || "careful",
    locale: options.locale || "zh-CN",
    timezoneId: options.timezone || "Asia/Shanghai",
    fingerprint: options.fingerprint || undefined
  });
}

async function dismissCommonOverlays(page) {
  const selectors = [
    "button[aria-label='Dismiss']",
    "button[aria-label='Close']",
    "button[aria-label*='关闭']",
    "button:has-text('Accept')",
    "button:has-text('同意')",
    "button:has-text('Not now')",
    "button:has-text('暂不')"
  ];
  for (const selector of selectors) {
    try {
      const button = page.locator(selector).first();
      if (await button.count()) {
        await button.click({ timeout: 1000 });
        await page.waitForTimeout(500);
      }
    } catch (_error) {
      // Overlay copy differs by platform and locale.
    }
  }
}

async function clickPreferredTabs(page, platform) {
  const labels = {
    X: ["Latest", "最新"],
    YouTube: ["Videos", "视频"],
    TikTok: ["Videos", "视频"],
    Facebook: ["Posts", "帖子"],
    LinkedIn: ["Posts", "内容", "动态"],
    Reddit: ["Posts", "帖子"]
  }[platform] || [];
  for (const label of labels) {
    try {
      const tab = page.getByText(label, { exact: true }).first();
      if (await tab.count()) {
        await tab.click({ timeout: 1200 });
        await page.waitForTimeout(900);
        return;
      }
    } catch (_error) {
      // Tabs are optional.
    }
  }
}

function extractKeywordRecords({ platform, query, target, limit, config }) {
  const textOf = (node) => (node?.innerText || node?.textContent || "").replace(/\s+/g, " ").trim();
  const attrText = (node, attr) => String(node?.getAttribute?.(attr) || "").trim();
  const fullUrl = (href) => {
    if (!href) return "";
    try { return new URL(href, location.href).href; } catch (_error) { return ""; }
  };
  const clean = (value, max = 700) => String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
  const firstNode = (root, selectors = []) => {
    for (const selector of selectors) {
      const found = root.matches?.(selector) ? root : root.querySelector?.(selector);
      if (found) return found;
    }
    return null;
  };
  const nodeIdentity = (node) => {
    if (!node) return "";
    const link = firstNode(node, config.linkSelectors);
    return fullUrl(link?.getAttribute("href")) || textOf(node).slice(0, 180);
  };
  const parseCompactNumberLocal = (value) => {
    const text = String(value || "").replace(/,/g, "").replace(/_/g, "").trim();
    if (!text) return 0;
    const number = Number.parseFloat(text);
    if (!Number.isFinite(number)) return 0;
    if (/亿|億/i.test(text)) return Math.round(number * 100_000_000);
    if (/万|萬/i.test(text)) return Math.round(number * 10_000);
    if (/b/i.test(text)) return Math.round(number * 1_000_000_000);
    if (/m/i.test(text)) return Math.round(number * 1_000_000);
    if (/k/i.test(text)) return Math.round(number * 1_000);
    return Math.round(number);
  };
  const parseMetricsLocal = (text) => {
    const valueBefore = (labels) => {
      for (const label of labels) {
        const pattern = new RegExp(`([0-9][0-9,._]*(?:\\.[0-9]+)?\\s*(?:K|M|B|万|萬|亿|億)?)\\s*(?:${label})`, "i");
        const matched = text.match(pattern);
        if (matched) return parseCompactNumberLocal(matched[1]);
      }
      return 0;
    };
    return {
      likes: valueBefore(["likes?", "赞", "点赞", "reactions?", "喜欢"]),
      comments: valueBefore(["comments?", "评论", "回复", "条评论"]),
      views: valueBefore(["views?", "plays?", "播放", "观看", "次观看", "浏览", "阅读"]),
      shares: valueBefore(["shares?", "分享", "转发"])
    };
  };

  const rawNodes = Array.from(new Set((config.itemSelectors || [])
    .flatMap((selector) => Array.from(document.querySelectorAll(selector)))
    .map((node) => {
      if (node.tagName === "A") {
        return node.closest("article, [role='article'], ytd-video-renderer, ytd-rich-item-renderer, shreddit-post, .card-wrap, .note-item, .bili-video-card, .video-list-item, div") || node;
      }
      return node;
    })));

  const records = rawNodes.map((node, index) => {
    const linkNode = firstNode(node, config.linkSelectors);
    const authorNode = firstNode(node, config.authorSelectors);
    const titleNode = firstNode(node, config.titleSelectors);
    const timeNode = firstNode(node, config.timeSelectors);
    const imageNode = node.querySelector?.("img[alt]");
    const title = clean(
      textOf(titleNode)
      || attrText(titleNode, "title")
      || attrText(imageNode, "alt"),
      180
    );
    const allAria = Array.from(node.querySelectorAll?.("[aria-label]") || [])
      .map((item) => attrText(item, "aria-label"))
      .filter(Boolean)
      .join(" ");
    const body = clean([title, textOf(node)].filter(Boolean).join(" "), 700);
    const metrics = parseMetricsLocal(`${body} ${allAria}`);
    return {
      platform,
      query,
      target,
      title,
      body,
      author: clean(textOf(authorNode), 120),
      publishedAt: attrText(timeNode, "datetime") || attrText(timeNode, "title") || attrText(timeNode, "aria-label") || clean(textOf(timeNode), 80),
      url: fullUrl(linkNode?.getAttribute("href")),
      likes: metrics.likes,
      comments: metrics.comments,
      views: metrics.views,
      shares: metrics.shares,
      position: index + 1
    };
  }).filter((record) => {
    const haystack = `${record.title} ${record.body} ${record.url}`.trim();
    if (haystack.length < 8) return false;
    const fullPage = document.body.innerText.replace(/\s+/g, " ").trim();
    if (record.body && record.body === fullPage) return false;
    if (/^(log in|sign up|登录|注册|接受|同意)$/i.test(record.body)) return false;
    return true;
  });

  const seen = new Set();
  return records.filter((record, index) => {
    const key = record.url || nodeIdentity(rawNodes[index]) || `${record.author}:${record.body.slice(0, 180)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, Math.max(1, Number(limit) || 5));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
