const taskRunner = require("../services/taskRunner");
const exportExcel = require("../utils/exportExcel");

function createTaskRoutes(runtime) {
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
      const task = taskRunner.createTask(runtime, body);
      runtime.sendJson(res, 202, { ok: true, data: task });
      return true;
    }

    if (req.method === "POST" && requestUrl.pathname === "/api/export") {
      const body = await runtime.readJsonBody(req);
      const file = exportExcel.exportRowsToDesktop(runtime, body);
      runtime.sendJson(res, 200, { ok: true, data: file });
      return true;
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

module.exports = createTaskRoutes;
