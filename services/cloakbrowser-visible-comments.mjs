import * as cloakbrowser from "cloakbrowser";

const launch = cloakbrowser.launch || cloakbrowser.default?.launch;
const launchPersistentContext = cloakbrowser.launchPersistentContext || cloakbrowser.default?.launchPersistentContext;

async function main() {
  const payload = decodePayload(process.argv[2] || "");
  const { page, close } = await createPage(payload.options || {});
  try {
    await page.goto(payload.target, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await sleep(1600);
    await dismissCommonOverlays(page);
    for (let index = 0; index < Number(payload.scrollRounds || 3); index += 1) {
      await scrollPage(page);
      await sleep(900);
    }
    const records = await page.evaluate(extractVisibleComments, {
      platform: payload.platform,
      target: payload.target,
      limit: Number(payload.limit || 40)
    });
    process.stdout.write(JSON.stringify(records));
  } finally {
    await close().catch(() => {});
  }
}

function decodePayload(value) {
  if (!value) {
    throw new Error("Missing CloakBrowser payload");
  }
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
}

async function createPage(options) {
  if (!launch) {
    throw new Error("cloakbrowser launch API is unavailable");
  }
  const launchOptions = compactObject({
    headless: options.headless !== false,
    proxy: options.proxy,
    geoip: Boolean(options.geoip),
    humanize: options.humanize !== false,
    humanPreset: options.humanPreset || "careful",
    timezone: options.timezone,
    locale: options.locale,
    fingerprint: options.fingerprint
  });

  if (options.userDataDir && launchPersistentContext) {
    const context = await launchPersistentContext({
      ...launchOptions,
      userDataDir: options.userDataDir
    });
    return {
      page: await context.newPage(),
      close: () => context.close()
    };
  }

  const browser = await launch(launchOptions);
  return {
    page: await browser.newPage(),
    close: () => browser.close()
  };
}

function compactObject(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== null && item !== ""));
}

async function dismissCommonOverlays(page) {
  await page.evaluate(() => {
    const acceptPattern = /(accept|agree|allow all|continue|同意|接受|允许|继续|我知道了)/i;
    const denyPattern = /(cancel|取消)/i;
    const buttons = Array.from(document.querySelectorAll("button, [role='button'], a"));
    for (const button of buttons.slice(0, 80)) {
      const text = (button.innerText || button.textContent || button.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim();
      if (text && acceptPattern.test(text) && !denyPattern.test(text)) {
        button.click();
        break;
      }
    }
  }).catch(() => {});
}

async function scrollPage(page) {
  try {
    await page.mouse.wheel(0, 980);
  } catch (_error) {
    await page.evaluate(() => window.scrollBy(0, Math.max(720, window.innerHeight * 0.85))).catch(() => {});
  }
}

function extractVisibleComments({ platform, target, limit }) {
  const textOf = (node) => (node?.innerText || node?.textContent || "").replace(/\s+/g, " ").trim();
  const fullUrl = (href) => {
    if (!href) return "";
    try {
      return new URL(href, location.href).href;
    } catch (_error) {
      return "";
    }
  };
  const selectorSets = {
    LinkedIn: [".comments-comment-item", ".comments-comments-list__comment-item", "[data-test-comment]", "article", "[role='article']"],
    Facebook: ["[aria-label='Comment']", "[aria-label*='comment']", "[aria-label*='评论']", "[role='article']", "div[data-ad-preview='message']"],
    Instagram: ["ul li", "article ul li", "[role='dialog'] ul li", "[class*='comment']"],
    Google: [".comment", "[class*='comment']", "[id*='comment']", "article", "[role='article']"],
    "Google News": [".comment", "[class*='comment']", "[id*='comment']", "article", "[role='article']"],
    "全网": [".comment", "[class*='comment']", "[id*='comment']", "article", "[role='article']"]
  };
  const selectors = selectorSets[platform] || [".comment", "[class*='comment']", "[id*='comment']", "article", "[role='article']"];
  const nodes = Array.from(new Set(selectors.flatMap((selector) => Array.from(document.querySelectorAll(selector)))));
  const bodyText = textOf(document.body);
  const records = nodes.map((node) => {
    const text = textOf(node);
    const link = fullUrl(node.querySelector("a[href*='comment'], a[href*='activity'], a[href*='posts'], a[href*='status'], a[href*='#comments'], a[href]")?.getAttribute("href"));
    const author = textOf(node.querySelector("a[href*='/in/'], a[href*='facebook.com/'], a[href*='instagram.com/'], a[href*='x.com/'], strong, h3, [class*='author'], [class*='actor']"));
    const timeNode = node.querySelector("time, abbr, [datetime], [class*='time'], [aria-label*='ago'], [aria-label*='前']");
    const time = timeNode?.getAttribute("datetime") || timeNode?.getAttribute("title") || timeNode?.getAttribute("aria-label") || textOf(timeNode);
    return {
      "目标link": target,
      "评论者账号": author,
      "评论内容": text,
      "发布时间（UTC+8）": time,
      "链接": link || target
    };
  }).filter((record) => {
    const text = record["评论内容"] || "";
    if (text.length < 2 || text.length > 1200) return false;
    if (/^(like|reply|share|send|comment|comments|reactions?|赞|回复|分享|评论)$/i.test(text)) return false;
    if (text === bodyText) return false;
    return true;
  });
  const seen = new Set();
  return records.filter((record) => {
    const key = [record["评论者账号"], record["评论内容"], record["链接"]].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, Math.max(1, Number(limit || 40)));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
