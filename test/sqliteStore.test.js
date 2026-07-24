const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { createSqliteStore } = require("../services/sqliteStore");

test("imports legacy JSON and persists normalized task data", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "social-research-sqlite-"));
  const taskStorePath = path.join(directory, "tasks.json");
  const runtimePath = path.join(directory, "runtime.json");
  const usagePath = path.join(directory, "usage.json");
  const databasePath = path.join(directory, "data", "social-research.sqlite3");

  fs.writeFileSync(taskStorePath, JSON.stringify({
    tasks: [{
      id: "task-1",
      title: "OpenAI 讨论",
      status: "完成",
      mode: "keyword",
      createdAt: "2026-07-15T08:00:00.000Z",
      updatedAt: "2026-07-15T09:00:00.000Z",
      warnings: [],
      errors: [],
      result: {
        posts: [{ platform: "X", author: "alice", content: "hello", content_url: "https://x.com/1" }],
        rows: [{ platform: "X", content: "hello", content_url: "https://x.com/1" }]
      }
    }]
  }));
  fs.writeFileSync(runtimePath, JSON.stringify({ X: { status: "ok" } }));
  fs.writeFileSync(usagePath, JSON.stringify({ providers: { tikhub: { calls: 3 } } }));

  const store = createSqliteStore({
    databasePath,
    taskStorePath,
    platformRuntimeStatePath: runtimePath,
    apiUsageStatePath: usagePath
  });
  t.after(() => {
    store.close();
    fs.rmSync(directory, { recursive: true, force: true });
  });

  assert.equal(store.loadTasks().size, 1);
  assert.deepEqual(store.getHealth().counts, {
    tasks: 1,
    posts: 1,
    rows: 1,
    apiProviders: 1,
    exports: 0
  });
  assert.equal(store.listPosts()[0].author, "alice");
  assert.equal(store.listRows()[0].payload.content, "hello");
  assert.equal(store.loadPlatformRuntimeState().get("X").status, "ok");
  assert.equal(store.loadApiUsageState().providers.tikhub.calls, 3);

  const tasks = store.loadTasks();
  tasks.get("task-1").result.rows.push({ platform: "Reddit", content: "second" });
  store.saveTasks(tasks);
  assert.equal(store.getHealth().counts.rows, 2);

  store.recordExport({
    fileName: "result.xlsx",
    filePath: "/tmp/result.xlsx",
    taskId: "task-1",
    rowCount: 2,
    columnCount: 3,
    sheetName: "结果"
  });
  assert.equal(store.listExports()[0].rowCount, 2);
});
