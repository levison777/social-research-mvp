const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

function createSqliteStore(options = {}) {
  const databasePath = path.resolve(options.databasePath);
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });

  const database = new DatabaseSync(databasePath);
  database.exec("PRAGMA foreign_keys = ON");
  database.exec("PRAGMA busy_timeout = 5000");
  database.exec("PRAGMA journal_mode = WAL");
  database.exec("PRAGMA synchronous = NORMAL");
  createSchema(database);

  const store = {
    databasePath,
    loadTasks,
    saveTasks,
    loadPlatformRuntimeState,
    savePlatformRuntimeState,
    loadApiUsageState,
    saveApiUsageState,
    recordExport,
    getHealth,
    listTasks,
    listPosts,
    listRows,
    listApiUsage,
    listExports,
    close: () => database.close()
  };

  importLegacyFiles();
  return store;

  function importLegacyFiles() {
    if (!hasMetadata(database, "legacy_tasks_imported")) {
      const json = readJsonFile(options.taskStorePath, {});
      const tasks = Array.isArray(json) ? json : Array.isArray(json.tasks) ? json.tasks : [];
      if (countTable(database, "tasks") === 0 && tasks.length) {
        saveTasks(new Map(tasks.filter((task) => task?.id).map((task) => [task.id, task])));
      }
      setMetadata(database, "legacy_tasks_imported", new Date().toISOString());
    }

    if (!hasMetadata(database, "legacy_platform_runtime_imported")) {
      const json = readJsonFile(options.platformRuntimeStatePath, {});
      if (countTable(database, "platform_runtime") === 0 && json && typeof json === "object" && !Array.isArray(json)) {
        savePlatformRuntimeState(new Map(Object.entries(json)));
      }
      setMetadata(database, "legacy_platform_runtime_imported", new Date().toISOString());
    }

    if (!hasMetadata(database, "legacy_api_usage_imported")) {
      const json = readJsonFile(options.apiUsageStatePath, {});
      if (countTable(database, "api_usage") === 0 && json && typeof json === "object") {
        saveApiUsageState({ providers: json.providers || {} });
      }
      setMetadata(database, "legacy_api_usage_imported", new Date().toISOString());
    }
  }

  function loadTasks() {
    const rows = database.prepare("SELECT payload_json FROM tasks ORDER BY created_at ASC, id ASC").all();
    return new Map(rows.map((row) => safeJsonParse(row.payload_json, null)).filter((task) => task?.id).map((task) => [task.id, task]));
  }

  function saveTasks(taskMap) {
    const taskList = Array.from(taskMap.values());
    transaction(database, () => {
      const retainedIds = new Set(taskList.map((task) => String(task.id)));
      database.prepare("SELECT id FROM tasks").all().forEach((row) => {
        if (!retainedIds.has(row.id)) database.prepare("DELETE FROM tasks WHERE id = ?").run(row.id);
      });

      const upsertTask = database.prepare(`
        INSERT INTO tasks (
          id, title, status, mode, created_at, updated_at, row_count, post_count,
          warning_count, error_count, payload_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          title = excluded.title,
          status = excluded.status,
          mode = excluded.mode,
          created_at = excluded.created_at,
          updated_at = excluded.updated_at,
          row_count = excluded.row_count,
          post_count = excluded.post_count,
          warning_count = excluded.warning_count,
          error_count = excluded.error_count,
          payload_json = excluded.payload_json
      `);
      const insertPost = database.prepare(`
        INSERT INTO task_posts (
          task_id, position, platform, author, content, content_url, published_at, payload_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const insertRow = database.prepare(`
        INSERT INTO task_rows (
          task_id, position, platform, content, content_url, published_at, payload_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      taskList.forEach((task) => {
        const posts = Array.isArray(task.result?.posts) ? task.result.posts : [];
        const rows = Array.isArray(task.result?.rows) ? task.result.rows : [];
        upsertTask.run(
          String(task.id),
          stringValue(task.title),
          stringValue(task.status),
          stringValue(task.mode || "keyword"),
          stringValue(task.createdAt),
          stringValue(task.updatedAt),
          rows.length,
          posts.length,
          Array.isArray(task.warnings) ? task.warnings.length : 0,
          Array.isArray(task.errors) ? task.errors.length : 0,
          JSON.stringify(task)
        );

        database.prepare("DELETE FROM task_posts WHERE task_id = ?").run(String(task.id));
        database.prepare("DELETE FROM task_rows WHERE task_id = ?").run(String(task.id));

        posts.forEach((post, position) => {
          insertPost.run(
            String(task.id),
            position,
            pickText(post, ["platform", "平台"]),
            pickText(post, ["author", "authorName", "username", "评论者账号"]),
            pickText(post, ["content", "text", "body", "评论内容"]),
            pickText(post, ["content_url", "contentUrl", "url", "链接", "目标link"]),
            pickText(post, ["publishedAt", "published_at", "comment_time", "发布时间（UTC+8）"]),
            JSON.stringify(post)
          );
        });

        rows.forEach((row, position) => {
          insertRow.run(
            String(task.id),
            position,
            pickText(row, ["platform", "平台"]),
            pickText(row, ["content", "评论内容", "text", "body"]),
            pickText(row, ["content_url", "链接", "目标link", "url"]),
            pickText(row, ["comment_time", "发布时间（UTC+8）", "publishedAt", "published_at"]),
            JSON.stringify(row)
          );
        });
      });

      setMetadata(database, "tasks_updated_at", new Date().toISOString());
    });
  }

  function loadPlatformRuntimeState() {
    const rows = database.prepare("SELECT platform, payload_json FROM platform_runtime ORDER BY platform").all();
    return new Map(rows.map((row) => [row.platform, safeJsonParse(row.payload_json, {})]));
  }

  function savePlatformRuntimeState(stateMap) {
    transaction(database, () => {
      database.exec("DELETE FROM platform_runtime");
      const insert = database.prepare("INSERT INTO platform_runtime (platform, payload_json, updated_at) VALUES (?, ?, ?)");
      const now = new Date().toISOString();
      for (const [platform, state] of stateMap.entries()) {
        insert.run(String(platform), JSON.stringify(state || {}), now);
      }
      setMetadata(database, "platform_runtime_updated_at", now);
    });
  }

  function loadApiUsageState() {
    const providers = {};
    database.prepare("SELECT provider_id, payload_json FROM api_usage ORDER BY provider_id").all().forEach((row) => {
      providers[row.provider_id] = safeJsonParse(row.payload_json, {});
    });
    return { providers };
  }

  function saveApiUsageState(state = {}) {
    transaction(database, () => {
      database.exec("DELETE FROM api_usage");
      const insert = database.prepare("INSERT INTO api_usage (provider_id, payload_json, updated_at) VALUES (?, ?, ?)");
      const now = new Date().toISOString();
      Object.entries(state.providers || {}).forEach(([providerId, payload]) => {
        insert.run(providerId, JSON.stringify(payload || {}), now);
      });
      setMetadata(database, "api_usage_updated_at", now);
    });
  }

  function recordExport(file = {}) {
    const now = new Date().toISOString();
    database.prepare(`
      INSERT INTO exports (file_name, file_path, task_id, row_count, column_count, sheet_name, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      stringValue(file.fileName),
      stringValue(file.filePath),
      stringValue(file.taskId),
      Number(file.rowCount || 0),
      Number(file.columnCount || 0),
      stringValue(file.sheetName),
      now
    );
    setMetadata(database, "exports_updated_at", now);
  }

  function getHealth() {
    const sizeBytes = [databasePath, `${databasePath}-wal`, `${databasePath}-shm`]
      .reduce((total, filePath) => total + (fs.existsSync(filePath) ? fs.statSync(filePath).size : 0), 0);
    const journalRow = database.prepare("PRAGMA journal_mode").get();
    const updatedRow = database.prepare("SELECT MAX(updated_at) AS updated_at FROM metadata").get();
    return {
      connected: true,
      path: databasePath,
      sizeBytes,
      journalMode: journalRow?.journal_mode || "unknown",
      updatedAt: updatedRow?.updated_at || "",
      counts: {
        tasks: countTable(database, "tasks"),
        posts: countTable(database, "task_posts"),
        rows: countTable(database, "task_rows"),
        apiProviders: countTable(database, "api_usage"),
        exports: countTable(database, "exports")
      }
    };
  }

  function listTasks(options = {}) {
    return database.prepare(`
      SELECT id, title, status, mode, created_at AS createdAt, updated_at AS updatedAt,
             row_count AS rowCount, post_count AS postCount,
             warning_count AS warningCount, error_count AS errorCount
      FROM tasks ORDER BY updated_at DESC, id DESC LIMIT ?
    `).all(normalizeLimit(options.limit));
  }

  function listPosts(options = {}) {
    const values = [];
    let where = "";
    if (options.taskId) {
      where = "WHERE p.task_id = ?";
      values.push(String(options.taskId));
    }
    values.push(normalizeLimit(options.limit));
    return database.prepare(`
      SELECT p.task_id AS taskId, t.title AS taskTitle, p.position, p.platform, p.author,
             p.content, p.content_url AS contentUrl, p.published_at AS publishedAt, p.payload_json AS payloadJson
      FROM task_posts p JOIN tasks t ON t.id = p.task_id
      ${where} ORDER BY t.updated_at DESC, p.position ASC LIMIT ?
    `).all(...values).map(expandPayload);
  }

  function listRows(options = {}) {
    const values = [];
    let where = "";
    if (options.taskId) {
      where = "WHERE r.task_id = ?";
      values.push(String(options.taskId));
    }
    values.push(normalizeLimit(options.limit));
    return database.prepare(`
      SELECT r.task_id AS taskId, t.title AS taskTitle, r.position, r.platform,
             r.content, r.content_url AS contentUrl, r.published_at AS publishedAt, r.payload_json AS payloadJson
      FROM task_rows r JOIN tasks t ON t.id = r.task_id
      ${where} ORDER BY t.updated_at DESC, r.position ASC LIMIT ?
    `).all(...values).map(expandPayload);
  }

  function listApiUsage(options = {}) {
    return database.prepare("SELECT provider_id AS providerId, payload_json AS payloadJson, updated_at AS updatedAt FROM api_usage ORDER BY updated_at DESC LIMIT ?")
      .all(normalizeLimit(options.limit)).map(expandPayload);
  }

  function listExports(options = {}) {
    return database.prepare(`
      SELECT id, file_name AS fileName, file_path AS filePath, task_id AS taskId,
             row_count AS rowCount, column_count AS columnCount, sheet_name AS sheetName, created_at AS createdAt
      FROM exports ORDER BY created_at DESC, id DESC LIMIT ?
    `).all(normalizeLimit(options.limit));
  }
}

function createSchema(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT '',
      mode TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT '',
      row_count INTEGER NOT NULL DEFAULT 0,
      post_count INTEGER NOT NULL DEFAULT 0,
      warning_count INTEGER NOT NULL DEFAULT 0,
      error_count INTEGER NOT NULL DEFAULT 0,
      payload_json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS task_posts (
      task_id TEXT NOT NULL,
      position INTEGER NOT NULL,
      platform TEXT NOT NULL DEFAULT '',
      author TEXT NOT NULL DEFAULT '',
      content TEXT NOT NULL DEFAULT '',
      content_url TEXT NOT NULL DEFAULT '',
      published_at TEXT NOT NULL DEFAULT '',
      payload_json TEXT NOT NULL,
      PRIMARY KEY (task_id, position),
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS task_rows (
      task_id TEXT NOT NULL,
      position INTEGER NOT NULL,
      platform TEXT NOT NULL DEFAULT '',
      content TEXT NOT NULL DEFAULT '',
      content_url TEXT NOT NULL DEFAULT '',
      published_at TEXT NOT NULL DEFAULT '',
      payload_json TEXT NOT NULL,
      PRIMARY KEY (task_id, position),
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS platform_runtime (
      platform TEXT PRIMARY KEY,
      payload_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS api_usage (
      provider_id TEXT PRIMARY KEY,
      payload_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS exports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_name TEXT NOT NULL DEFAULT '',
      file_path TEXT NOT NULL DEFAULT '',
      task_id TEXT NOT NULL DEFAULT '',
      row_count INTEGER NOT NULL DEFAULT 0,
      column_count INTEGER NOT NULL DEFAULT 0,
      sheet_name TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_tasks_updated_at ON tasks(updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_task_posts_platform ON task_posts(platform);
    CREATE INDEX IF NOT EXISTS idx_task_rows_platform ON task_rows(platform);
    CREATE INDEX IF NOT EXISTS idx_exports_created_at ON exports(created_at DESC);
  `);
}

function transaction(database, callback) {
  database.exec("BEGIN IMMEDIATE");
  try {
    callback();
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

function countTable(database, tableName) {
  return Number(database.prepare(`SELECT COUNT(*) AS count FROM ${tableName}`).get()?.count || 0);
}

function setMetadata(database, key, value) {
  database.prepare(`
    INSERT INTO metadata (key, value, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).run(key, value, value);
}

function hasMetadata(database, key) {
  return Boolean(database.prepare("SELECT 1 AS found FROM metadata WHERE key = ?").get(key)?.found);
}

function readJsonFile(filePath, fallback) {
  try {
    if (!filePath || !fs.existsSync(filePath)) return fallback;
    return safeJsonParse(fs.readFileSync(filePath, "utf8"), fallback);
  } catch (_error) {
    return fallback;
  }
}

function safeJsonParse(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch (_error) {
    return fallback;
  }
}

function pickText(value, keys) {
  if (!value || typeof value !== "object") return "";
  for (const key of keys) {
    if (value[key] !== undefined && value[key] !== null && String(value[key]).trim()) return String(value[key]);
  }
  return "";
}

function stringValue(value) {
  return value === undefined || value === null ? "" : String(value);
}

function normalizeLimit(value) {
  const limit = Number(value || 100);
  return Number.isFinite(limit) ? Math.max(1, Math.min(500, Math.floor(limit))) : 100;
}

function expandPayload(row) {
  const payload = safeJsonParse(row.payloadJson, {});
  const { payloadJson, ...summary } = row;
  return { ...summary, payload };
}

module.exports = { createSqliteStore };
