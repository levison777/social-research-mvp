#!/usr/bin/env node

const http = require("node:http");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");

const HOST = "127.0.0.1";
const PORT = Number(process.env.PORT || 8787);
const HTML_PATH = path.join(__dirname, "social-research-mvp.html");
const PLATFORM_RUNTIME_STATE_PATH = path.join(__dirname, "social-research-mvp.runtime.json");
const TASK_STORE_PATH = path.join(__dirname, "social-research-mvp.tasks.json");
const OPENCLI_TIMEOUT_MS = 45_000;
const OPENCLI_BROWSER_CALL_LIMIT = Number(process.env.OPENCLI_BROWSER_CALL_LIMIT || 10);
const FIRECRAWL_TIMEOUT_MS = 35_000;
const FIRECRAWL_BASE_URL = (process.env.FIRECRAWL_BASE_URL || "https://api.firecrawl.dev/v2").replace(/\/+$/, "");
const OPENCLI_BROWSERLESS_SITES = new Set(["google"]);
const PLATFORM_PRIORITY = ["X", "LinkedIn", "Facebook", "Google", "Reddit", "小红书", "微博", "YouTube", "B站", "Instagram", "Google News", "全网"];
const UNIFIED_BOARD_FIELDS = ["key_words", "platform", "content", "content_to_en", "sentiment_rating", "search_time", "comment_time", "topics", "language", "content_url", "engagement"];
const COMMENT_BOARD_FIELDS = ["目标link", "评论者账号", "评论内容", "发布时间（UTC+8）", "sentiment rating", "链接"];
const COMMENT_LINK_PLATFORMS = new Set(["X", "LinkedIn", "Facebook", "Google"]);
const COMMENT_CACHE_DIR = path.join(process.env.HOME || "/Users/jeff", "Desktop", "codex");
const EXPORT_DIR = path.join(os.homedir(), "Desktop");
const platformRuntimeState = loadPlatformRuntimeState();

const tasks = loadPersistedTasks();
const opencliVersion = detectOpencliVersion();

const server = http.createServer(async (req, res) => {
  try {
    if (!req.url) {
      return sendJson(res, 400, { ok: false, error: "Missing URL" });
    }

    const requestUrl = new URL(req.url, `http://${req.headers.host || `${HOST}:${PORT}`}`);
    applyCors(res);

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      return res.end();
    }

    if (req.method === "GET" && requestUrl.pathname === "/") {
      return sendHtml(res, HTML_PATH);
    }

    if (req.method === "GET" && requestUrl.pathname === "/api/health") {
      return sendJson(res, 200, {
        ok: true,
        server: { host: HOST, port: PORT, now: new Date().toISOString() },
        providers: {
          opencli: {
            available: Boolean(opencliVersion),
            version: opencliVersion || null,
            browserCallLimitPerTask: OPENCLI_BROWSER_CALL_LIMIT
          },
          firecrawl: {
            configured: Boolean(process.env.FIRECRAWL_API_KEY),
            baseUrl: FIRECRAWL_BASE_URL
          }
        },
        tasks: tasks.size
      });
    }

    if (req.method === "GET" && requestUrl.pathname === "/api/platforms") {
      if (requestUrl.searchParams.get("refresh") === "1") {
        resetTransientPlatformRuntimeState();
      }
      const firecrawlAvailable = Boolean(process.env.FIRECRAWL_API_KEY);
      return sendJson(res, 200, {
        ok: true,
        data: getPlatformCatalog({ firecrawlAvailable })
      });
    }

    if (req.method === "GET" && requestUrl.pathname === "/api/tasks") {
      const list = Array.from(tasks.values())
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
        .map(summarizeTask);
      return sendJson(res, 200, { ok: true, data: list });
    }

    if (req.method === "POST" && requestUrl.pathname === "/api/tasks") {
      const body = await readJsonBody(req);
      const input = normalizeTaskInput(body);
      const firecrawlAvailable = Boolean(input.firecrawlApiKey || process.env.FIRECRAWL_API_KEY);
      const catalog = getPlatformCatalog({ firecrawlAvailable });
      const index = new Map(catalog.map((platform) => [platform.platform, platform]));
      const runnable = input.platforms.filter((platform) => {
        const entry = index.get(platform);
        return entry && entry.enabled && entry.supportedModes.includes(input.mode);
      });
      if (!runnable.length) {
        return sendJson(res, 400, { ok: false, error: "所选平台当前都不可运行，请减少平台或补充 Firecrawl key / 登录态支持。" });
      }
      const task = createTask(input);
      runTask(task, input).catch((error) => failTask(task, error));
      return sendJson(res, 202, { ok: true, data: task });
    }

    if (req.method === "POST" && requestUrl.pathname === "/api/export") {
      const body = await readJsonBody(req);
      const exportPayload = buildExportPayload(body);
      if (!exportPayload.rows.length) {
        return sendJson(res, 400, { ok: false, error: "没有可导出的数据行。" });
      }
      const file = exportRowsToDesktop(exportPayload);
      return sendJson(res, 200, { ok: true, data: file });
    }

    const taskMatch = requestUrl.pathname.match(/^\/api\/tasks\/([^/]+)$/);
    if (req.method === "GET" && taskMatch) {
      const task = tasks.get(taskMatch[1]);
      if (!task) {
        return sendJson(res, 404, { ok: false, error: "Task not found" });
      }
      return sendJson(res, 200, { ok: true, data: task });
    }

    if (req.method === "DELETE" && taskMatch) {
      const taskId = decodeURIComponent(taskMatch[1]);
      const task = tasks.get(taskId);
      if (!task) {
        return sendJson(res, 404, { ok: false, error: "Task not found" });
      }
      tasks.delete(taskId);
      persistTasks();
      return sendJson(res, 200, {
        ok: true,
        data: {
          id: taskId,
          deleted: true,
          title: task.title,
          rowCount: task.result?.rows?.length || 0,
          postCount: task.result?.posts?.length || 0
        }
      });
    }

    return sendJson(res, 404, { ok: false, error: "Not found" });
  } catch (error) {
    return sendJson(res, 500, {
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`social-research-mvp server running at http://${HOST}:${PORT}`);
});

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

function normalizeTaskInput(body) {
  const subject = String(body.subject || body.taskName || "").trim();
  const mode = normalizeMode(body.mode);
  const platforms = Array.isArray(body.platforms)
    ? Array.from(new Set(body.platforms.map(String).filter(Boolean)))
    : [];

  return {
    mode,
    subject,
    platforms,
    timeRange: String(body.timeRange || "最近 7 天"),
    depth: String(body.depth || "标准采集"),
    commentPolicy: String(body.commentPolicy || "采集热门评论"),
    schemaPrompt: String(body.schemaPrompt || ""),
    firecrawlApiKey: String(body.firecrawlApiKey || "").trim()
  };
}

function normalizeMode(mode) {
  return ["keyword", "link", "account", "monitor"].includes(mode) ? mode : "keyword";
}

function rowHeadersForMode(mode) {
  return mode === "link" ? [...COMMENT_BOARD_FIELDS] : [...UNIFIED_BOARD_FIELDS];
}

function createTask(input) {
  const now = new Date().toISOString();
  const id = `task_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const task = {
    id,
    title: input.subject || "未命名研究任务",
    mode: input.mode,
    subtitle: `${modeLabel(input.mode)} · ${(input.platforms || []).join("、") || "未选择平台"} · ${input.timeRange}`,
    route: "",
    status: "运行中",
    tone: "blue",
    progress: 4,
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
      rowHeaders: rowHeadersForMode(input.mode),
      raw: [],
      emptyReason: "",
      stats: {
        platformsRequested: input.platforms.length,
        platformsCompleted: 0,
        opencliCalls: 0,
        opencliBrowserCalls: 0,
        opencliBrowserCallLimit: OPENCLI_BROWSER_CALL_LIMIT,
        firecrawlCalls: 0
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
    subtitle: task.subtitle,
    route: task.route,
    status: task.status,
    tone: task.tone,
    progress: task.progress,
    warningCount: task.warnings.length,
    errorCount: task.errors.length,
    warningSummary: task.warnings[0] || "",
    errorSummary: task.errors[0] || "",
    rowCount: task.result?.rows?.length || 0,
    postCount: task.result?.posts?.length || 0,
    emptyReason: task.result?.emptyReason || "",
    createdAt: task.createdAt,
    updatedAt: task.updatedAt
  };
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

function failTask(task, error) {
  const message = error instanceof Error ? error.message : String(error);
  task.errors.push(message);
  updateTask(task, { status: "失败", tone: "red", progress: 100 });
  logTask(task, `任务失败：${message}`);
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
  const catalog = [
    {
      platform: "X",
      priority: priorityOf("X"),
      enabled: opencliAvailable,
      supportedModes: ["keyword", "link", "account", "monitor"],
      disabledReason: disabledByOpencli,
      requiresFirecrawl: false,
      consumesBrowserBudget: true,
      budgetCostHint: "关键词搜索 1 次，补回复 1 次；Link 评论 1 次；账号 2 次",
      budgetCosts: { keywordSearch: 1, keywordEnrich: 1, link: 1, account: 2, monitorSearch: 1, monitorEnrich: 1 },
      routes: {
        keywordSearch: "twitter/search",
        keywordEnrich: "twitter/thread",
        link: "social-comment-export/twitter-thread",
        account: "twitter/profile + twitter/search"
      },
      note: "支持关键词、贴文详情、回复线程；Link 模式按评论导表 SOP 输出 6 列评论字段。"
    },
    {
      platform: "Reddit",
      priority: priorityOf("Reddit"),
      enabled: opencliAvailable,
      supportedModes: ["keyword", "account", "monitor"],
      disabledReason: disabledByOpencli,
      requiresFirecrawl: false,
      consumesBrowserBudget: true,
      budgetCostHint: "关键词搜索 1 次，补正文评论 1 次；账号 2 次；Link 评论链路不支持",
      budgetCosts: { keywordSearch: 1, keywordEnrich: 1, link: 1, account: 2, monitorSearch: 1, monitorEnrich: 1 },
      routes: {
        keywordSearch: "reddit/search",
        keywordEnrich: "reddit/read",
        account: "reddit/user-posts + reddit/user-comments"
      },
      note: "适合关键词争议主题和多层评论研究；目标 Link 评论导表链路暂不纳入 Reddit。"
    },
    {
      platform: "小红书",
      priority: priorityOf("小红书"),
      enabled: opencliAvailable,
      supportedModes: ["keyword", "account", "monitor"],
      disabledReason: disabledByOpencli,
      requiresFirecrawl: false,
      consumesBrowserBudget: true,
      budgetCostHint: "关键词搜索 1 次，补正文评论 2 次；账号 1 次；Link 评论链路不支持",
      budgetCosts: { keywordSearch: 1, keywordEnrich: 2, link: 2, account: 1, monitorSearch: 1, monitorEnrich: 2 },
      routes: {
        keywordSearch: "xiaohongshu/search",
        keywordEnrich: "xiaohongshu/note + comments",
        account: "xiaohongshu/user"
      },
      note: "支持关键词/账号采集；目标 Link 评论导表链路仅保留 X、LinkedIn、Facebook、Google。"
    },
    {
      platform: "微博",
      priority: priorityOf("微博"),
      enabled: opencliAvailable,
      supportedModes: ["keyword", "account", "monitor"],
      disabledReason: disabledByOpencli,
      requiresFirecrawl: false,
      consumesBrowserBudget: true,
      budgetCostHint: "关键词搜索 1 次，补正文评论 2 次；账号 1 次；Link 评论链路不支持",
      budgetCosts: { keywordSearch: 1, keywordEnrich: 2, link: 2, account: 1, monitorSearch: 1, monitorEnrich: 2 },
      routes: {
        keywordSearch: "weibo/search",
        keywordEnrich: "weibo/post + comments",
        account: "weibo/user"
      },
      note: "支持关键词正文和评论正文；目标 Link 评论导表链路暂不纳入微博。"
    },
    {
      platform: "YouTube",
      priority: priorityOf("YouTube"),
      enabled: opencliAvailable,
      supportedModes: ["keyword", "account", "monitor"],
      disabledReason: disabledByOpencli,
      requiresFirecrawl: false,
      consumesBrowserBudget: true,
      budgetCostHint: "关键词搜索 1 次，补视频/评论/字幕 2 次；账号 1 次；Link 评论链路不支持",
      budgetCosts: { keywordSearch: 1, keywordEnrich: 2, link: 3, account: 1, monitorSearch: 1, monitorEnrich: 2 },
      routes: {
        keywordSearch: "youtube/search",
        keywordEnrich: "youtube/video + comments + transcript",
        account: "youtube/channel"
      },
      note: "适合视频正文、评论和字幕联合研究；目标 Link 评论导表链路暂不纳入 YouTube。"
    },
    {
      platform: "B站",
      priority: priorityOf("B站"),
      enabled: opencliAvailable,
      supportedModes: ["keyword", "account", "monitor"],
      disabledReason: disabledByOpencli,
      requiresFirecrawl: false,
      consumesBrowserBudget: true,
      budgetCostHint: "关键词搜索 1 次，补评论字幕 2 次；账号 1 次；Link 评论链路不支持",
      budgetCosts: { keywordSearch: 1, keywordEnrich: 2, link: 2, account: 1, monitorSearch: 1, monitorEnrich: 2 },
      routes: {
        keywordSearch: "bilibili/search",
        keywordEnrich: "bilibili/comments + subtitle",
        account: "bilibili/user-videos"
      },
      note: "评论支持，视频标题与摘要优先来自搜索和字幕；目标 Link 评论导表链路暂不纳入 B站。"
    },
    {
      platform: "Instagram",
      priority: priorityOf("Instagram"),
      enabled: opencliAvailable,
      supportedModes: ["keyword", "account", "monitor"],
      disabledReason: disabledByOpencli,
      requiresFirecrawl: false,
      consumesBrowserBudget: true,
      budgetCostHint: "关键词搜索 1 次，补账号最近内容 1 次；账号 1 次；Link 评论链路不支持",
      budgetCosts: { keywordSearch: 1, keywordEnrich: 1, link: 1, account: 1, monitorSearch: 1, monitorEnrich: 1 },
      routes: {
        keywordSearch: "instagram/search",
        keywordEnrich: "instagram/user",
        account: "instagram/user"
      },
      note: "帖子评论正文暂不支持，只能拿评论数；目标 Link 评论导表链路暂不纳入 Instagram。"
    },
    {
      platform: "Facebook",
      priority: priorityOf("Facebook"),
      enabled: opencliAvailable,
      supportedModes: ["keyword", "link", "account", "monitor"],
      disabledReason: disabledByOpencli,
      requiresFirecrawl: false,
      consumesBrowserBudget: true,
      budgetCostHint: "关键词搜索 1 次；Link 评论通过浏览器可见页面采集约 5 次；账号 2 次",
      budgetCosts: { keywordSearch: 1, keywordEnrich: 0, link: 5, account: 2, monitorSearch: 1, monitorEnrich: 0 },
      routes: {
        keywordSearch: "facebook/search",
        link: "social-comment-export/browser-visible-comments",
        account: "facebook/profile + search"
      },
      note: "Link 模式按评论导表 SOP，从已登录浏览器可见评论区采集。"
    },
    {
      platform: "Google",
      priority: priorityOf("Google"),
      enabled: opencliAvailable,
      supportedModes: ["link"],
      disabledReason: disabledByOpencli,
      requiresFirecrawl: false,
      consumesBrowserBudget: true,
      budgetCostHint: "目标网页评论通过浏览器可见页面采集约 5 次；优先复用本地 strict JSON",
      budgetCosts: { keywordSearch: 0, keywordEnrich: 0, link: 5, account: 0, monitorSearch: 0, monitorEnrich: 0 },
      routes: {
        link: "social-comment-export/browser-visible-page"
      },
      note: "用于 Google/网页来源的目标 Link 评论采集，输出与附件 Excel 一致的 6 列字段。"
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
        keywordSearch: "google/news",
        monitorSearch: "google/news"
      },
      note: firecrawlAvailable ? "可用 Firecrawl 补正文。" : "无 Firecrawl key 时仅返回标题、来源、时间和 URL。"
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
      enabled: opencliAvailable,
      supportedModes: ["link"],
      disabledReason: disabledByOpencli,
      requiresFirecrawl: false,
      consumesBrowserBudget: true,
      budgetCostHint: "Link 评论通过浏览器访问目标页面并读取可见评论约 5 次",
      budgetCosts: { keywordSearch: 0, keywordEnrich: 0, link: 5, account: 0, monitorSearch: 0, monitorEnrich: 0 },
      routes: {
        link: "social-comment-export/linkedin-browser-visible-comments"
      },
      note: "仅 Link 模式启用：通过浏览器访问目标 LinkedIn 页面，再采集页面上可见评论。"
    }
  ];
  return catalog.map(applyRuntimePlatformState);
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
  return {
    ...entry,
    enabled: typeof runtime.enabled === "boolean" ? runtime.enabled : entry.enabled,
    disabledReason: runtime.disabledReason ?? entry.disabledReason,
    note: runtime.note || entry.note,
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

async function runTask(task, input) {
  const firecrawl = createFirecrawlClient(input.firecrawlApiKey || process.env.FIRECRAWL_API_KEY || "", task);
  const catalog = getPlatformCatalog({ firecrawlAvailable: firecrawl.available });
  const plan = buildTaskExecutionPlan({ input, catalog });
  const resultsByPlatform = new Map();
  const providersUsed = new Set();
  const routeParts = new Set();

  logTask(task, `开始执行 ${modeLabel(input.mode)}。`);
  task.plan = plan.preview;

  for (const warning of plan.initialWarnings) {
    warnTask(task, warning);
  }

  if (!plan.steps.length) {
    task.result.emptyReason = plan.initialWarnings[0] || "没有可执行的平台。";
    updateTask(task, { status: "失败", tone: "red", progress: 100 });
    logTask(task, "任务失败：没有可执行的平台。");
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
      const message = error instanceof Error ? error.message : String(error);
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
    updateTask(task, {
      status: "失败",
      tone: "red",
      progress: 100,
      route: Array.from(routeParts).join(" + ")
    });
    logTask(task, "没有采集到有效样本。");
    return;
  }

  task.providers = Array.from(providersUsed);
  task.route = Array.from(routeParts).join(" + ");
  task.result.posts = dedupePosts(allPosts);
  task.result.rowHeaders = rowHeadersForMode(input.mode);
  task.result.rows = buildRowsForTask(task.result.posts, input, task);
  task.result.stats.totalPosts = task.result.posts.length;
  if (!task.result.posts.length) {
    task.result.emptyReason = task.warnings[0] || task.errors[0] || "任务完成，但没有返回可展示样本。";
  }

  const finishedWithWarnings = Boolean(task.errors.length || task.warnings.length);
  updateTask(task, {
    status: finishedWithWarnings ? "部分完成" : "完成",
    tone: finishedWithWarnings ? "amber" : "green",
    progress: 100
  });
  logTask(task, `任务结束，共返回 ${task.result.posts.length} 条样本。`);
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
      initialWarnings.push(`${entry.platform} 已跳过：目标 Link 评论采集链路仅支持 X、LinkedIn、Facebook、Google。`);
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
  switch (platform) {
    case "X":
      return collectXKeywordSearch(input.subject, input, task);
    case "Reddit":
      return collectRedditKeywordSearch(input.subject, input, task);
    case "Instagram":
      return collectInstagramKeywordSearchOnly(input.subject, input, task);
    case "Facebook":
      return collectFacebookKeyword(input.subject, input, task);
    case "Google News":
      return collectGoogleNews(input.subject, input, task, firecrawl);
    case "全网":
      return collectFirecrawlWeb(input.subject, input, task, firecrawl);
    case "小红书":
      return collectXiaohongshuKeywordSearch(input.subject, input, task);
    case "微博":
      return collectWeiboKeywordSearch(input.subject, input, task);
    case "B站":
      return collectBilibiliKeywordSearch(input.subject, input, task);
    case "YouTube":
      return collectYouTubeKeywordSearch(input.subject, input, task);
    default:
      warnTask(task, `${platform} 还没有接入真实采集器。`);
      return [];
  }
}

async function executeKeywordEnrich(platform, posts, input, task, firecrawl) {
  if (!posts.length) {
    warnTask(task, `${platform} 搜索阶段没有返回候选样本，已跳过补采。`);
    return posts;
  }

  switch (platform) {
    case "X":
      return enrichXKeywordPosts(posts, input, task);
    case "Reddit":
      return enrichRedditKeywordPosts(posts, input, task);
    case "Instagram":
      return enrichInstagramKeywordPosts(posts, input, task);
    case "小红书":
      return enrichXiaohongshuKeywordPosts(posts, input, task);
    case "微博":
      return enrichWeiboKeywordPosts(posts, input, task);
    case "B站":
      return enrichBilibiliKeywordPosts(posts, input, task, firecrawl);
    case "YouTube":
      return enrichYouTubeKeywordPosts(posts, input, task);
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
  if (platform === "Instagram") {
    return mode === "account"
      ? collectInstagramAccount(input.subject, input, task)
      : collectInstagramLink(input.subject, input, task);
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

async function collectXKeywordSearch(query, input, task) {
  const tweets = await opencliJson(task, "twitter", ["search", query, "--limit", "5", "-f", "json"]);
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
  const results = await opencliJson(task, "reddit", ["search", query, "--limit", "3", "-f", "json"]);
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
  const rows = await opencliJson(task, "youtube", ["search", query, "--type", "video", "--limit", "5", "-f", "json"]);
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
  const tweets = await opencliJson(task, "twitter", ["search", query, "--limit", "5", "-f", "json"]);
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
  const results = await opencliJson(task, "reddit", ["search", query, "--limit", "3", "-f", "json"]);
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
  const comments = await collectBrowserVisibleComments("Facebook", target, input, task);
  if (!comments.length) {
    warnTask(task, "Facebook 页面未采集到可见评论；请确认浏览器已登录并展开评论区后重试。");
  }
  return comments;
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

async function collectLinkedIn(subject, input, task) {
  warnTask(task, "LinkedIn 当前适配器只能做职位搜索或首页时间线，不适合目标账号贴文和评论采集。");
  if (input.mode === "keyword") {
    const rows = await opencliJson(task, "linkedin", ["search", subject, "--limit", "3", "-f", "json"]);
    return rows.slice(0, 3).map((row, index) => normalizePost({
      id: `linkedin_${index}_${slugify(row.url || row.title)}`,
      title: row.title || "LinkedIn 职位搜索结果",
      body: `${row.company || ""} ${row.location || ""}`.trim(),
      platform: "LinkedIn",
      source: "opencli",
      score: 0.35,
      sentiment: "中性",
      comments: 0,
      likes: 0,
      url: row.url || "",
      author: row.company || "",
      publishedAt: row.listed || "",
      themes: themePairsFromTexts([row.title || "", row.company || ""])
    }));
  }
  return [];
}

async function collectLinkedInLinkComments(target, input, task) {
  const cached = readCachedCommentPosts("LinkedIn", target, task);
  if (cached.length) {
    return cached;
  }
  const comments = await collectBrowserVisibleComments("LinkedIn", target, input, task);
  if (!comments.length) {
    warnTask(task, "LinkedIn 页面未采集到可见评论；该链路依赖已登录浏览器页面，并需要目标帖子的评论在页面上可见。");
  }
  return comments;
}

async function collectGoogleLinkComments(target, input, task, firecrawl) {
  const cached = readCachedCommentPosts("Google", target, task);
  if (cached.length) {
    return cached;
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
      });
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
      });
    }
  };
}

async function firecrawlRequest(apiKey, endpoint, body) {
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
    return json;
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

async function collectBrowserVisibleComments(platform, target, input, task) {
  if (!looksLikeUrl(target)) {
    throw new Error(`${platform} Link 评论采集需要完整 URL。`);
  }
  await opencliBrowserText(task, ["open", target], { timeoutMs: 60_000 });
  const scrollRounds = input.depth === "深度采集" ? 5 : input.depth === "轻量抽样" ? 2 : 3;
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
  return runCommand("opencli", ["browser", ...args], {
    timeoutMs: options.timeoutMs || OPENCLI_TIMEOUT_MS,
    env: {
      ...process.env,
      CI: "1"
    }
  });
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
  return Array.isArray(parsed) ? parsed : [parsed];
}

function runCommand(command, args, options = {}) {
  const timeoutMs = options.timeoutMs || 30_000;
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: __dirname,
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
    publishedAt: post.publishedAt || "",
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
