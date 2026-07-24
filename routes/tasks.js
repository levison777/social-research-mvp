const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const taskRunner = require("../services/taskRunner");
const exportExcel = require("../utils/exportExcel");
const { requestAuditContext } = require("../utils/requestAuditContext");

const EXPORT_DOWNLOAD_DIR = path.join(os.homedir(), "Desktop");

function encodeHeaderValue(value) {
  return encodeURIComponent(String(value || ""));
}

function asciiHeaderFileName(value) {
  return String(value || "social-research-export.xlsx")
    .replace(/[^\x20-\x7E]+/g, "_")
    .replace(/["\\]/g, "_")
    .trim() || "social-research-export.xlsx";
}

function sendExportDownload(res, file) {
  const fileBuffer = fs.readFileSync(file.filePath);
  const fileName = file.fileName || "social-research-export.xlsx";
  const fallbackName = asciiHeaderFileName(fileName);
  res.writeHead(200, {
    "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "Content-Length": fileBuffer.length,
    "Content-Disposition": `attachment; filename="${fallbackName}"; filename*=UTF-8''${encodeHeaderValue(fileName)}`,
    "Cache-Control": "no-store",
    "Access-Control-Expose-Headers": [
      "Content-Disposition",
      "X-Export-File-Name",
      "X-Export-File-Path",
      "X-Export-Row-Count",
      "X-Export-Column-Count"
    ].join(", "),
    "X-Export-File-Name": encodeHeaderValue(fileName),
    "X-Export-File-Path": encodeHeaderValue(file.filePath || ""),
    "X-Export-Row-Count": String(file.rowCount || 0),
    "X-Export-Column-Count": String(file.columnCount || 0)
  });
  res.end(fileBuffer);
}

function exportFileFromRequest(requestUrl) {
  const fileName = path.basename(String(requestUrl.searchParams.get("fileName") || ""));
  if (!fileName || !fileName.endsWith(".xlsx")) {
    const error = new Error("导出文件名无效。");
    error.statusCode = 400;
    throw error;
  }
  const filePath = path.join(EXPORT_DOWNLOAD_DIR, fileName);
  if (!fs.existsSync(filePath)) {
    const error = new Error("导出文件不存在或已被移动。");
    error.statusCode = 404;
    throw error;
  }
  return { fileName, filePath };
}

function createTaskRoutes(runtime, authService) {
  return async function handleTaskRoute(req, res, requestUrl) {
    if (req.method === "GET" && requestUrl.pathname === "/api/tasks") {
      const includeInternal = requestUrl.searchParams.get("includeInternal") === "1";
      runtime.sendJson(res, 200, {
        ok: true,
        data: taskRunner.listTasks(runtime, { includeInternal })
      });
      return true;
    }

    if (req.method === "POST" && requestUrl.pathname === "/api/tasks") {
      const body = await runtime.readJsonBody(req);
      if (String(body.mode || "").trim().toLowerCase() === "account" && !canUseAccountCollection(req.auth)) {
        runtime.sendJson(res, 403, {
          ok: false,
          error: "仅超级管理员可以使用账号主体采集。"
        });
        return true;
      }
      const task = taskRunner.createTask(runtime, body);
      runtime.sendJson(res, 202, { ok: true, data: task });
      return true;
    }

    if (req.method === "POST" && requestUrl.pathname === "/api/import-urls") {
      const body = await runtime.readJsonBody(req);
      const result = runtime.importUrlsFromSpreadsheetBody(body);
      runtime.sendJson(res, 200, { ok: true, data: result });
      return true;
    }

    if (req.method === "GET" && requestUrl.pathname === "/api/export-file") {
      sendExportDownload(res, exportFileFromRequest(requestUrl));
      return true;
    }

    if (req.method === "POST" && requestUrl.pathname === "/api/export") {
      let body = {};
      try {
        body = await runtime.readJsonBody(req);
        const file = exportExcel.exportRowsToDesktop(runtime, body);
        authService?.recordDataExport(req.auth, exportAuditEvent(body, file), requestAuditContext(req));
        if (requestUrl.searchParams.get("download") === "1") {
          sendExportDownload(res, file);
          return true;
        }
        runtime.sendJson(res, 200, { ok: true, data: file });
        return true;
      } catch (error) {
        try {
          authService?.recordDataExport(req.auth, exportAuditEvent(body, {
            outcome: "failure",
            errorMessage: error instanceof Error ? error.message : String(error)
          }), requestAuditContext(req));
        } catch (_auditError) {
          // Preserve the original export error if audit storage is unavailable.
        }
        throw error;
      }
    }

    const taskMatch = requestUrl.pathname.match(/^\/api\/tasks\/([^/]+)$/);
    if (req.method === "GET" && taskMatch) {
      const task = taskRunner.getTask(runtime, taskMatch[1]);
      if (!task) {
        runtime.sendJson(res, 404, { ok: false, error: "Task not found" });
        return true;
      }
      runtime.sendJson(res, 200, { ok: true, data: task });
      return true;
    }

    if (req.method === "DELETE" && taskMatch) {
      const taskId = decodeURIComponent(taskMatch[1]);
      const deleted = taskRunner.deleteTask(runtime, taskId);
      if (!deleted) {
        runtime.sendJson(res, 404, { ok: false, error: "Task not found" });
        return true;
      }
      runtime.sendJson(res, 200, { ok: true, data: deleted });
      return true;
    }

    return false;
  };
}

function canUseAccountCollection(user) {
  return Boolean(
    user?.status === "active"
    && user?.role === "admin"
    && (user?.isSuperAdmin === true || user?.permissions?.accountCollection === true)
  );
}

function exportAuditEvent(body = {}, result = {}) {
  return {
    taskId: result.taskId || body.taskId || "all",
    title: body.title || "全部任务",
    platform: body.platform || "全部平台",
    query: body.query || "",
    fileName: result.fileName || "",
    sheetName: result.sheetName || body.sheetName || "",
    rowCount: result.rowCount ?? (Array.isArray(body.rows) ? body.rows.length : 0),
    columnCount: result.columnCount ?? (Array.isArray(body.columns) ? body.columns.length : 0),
    outcome: result.outcome,
    errorMessage: result.errorMessage || ""
  };
}

module.exports = createTaskRoutes;
