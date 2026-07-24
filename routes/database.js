function createDatabaseRoutes(runtime) {
  return async function handleDatabaseRoute(req, res, requestUrl) {
    if (req.method === "GET" && requestUrl.pathname === "/api/database") {
      runtime.sendJson(res, 200, { ok: true, data: runtime.getDatabaseHealth() });
      return true;
    }

    const match = requestUrl.pathname.match(/^\/api\/database\/(tasks|posts|rows|usage|exports)$/);
    if (req.method === "GET" && match) {
      runtime.sendJson(res, 200, {
        ok: true,
        data: runtime.getDatabaseRecords(match[1], {
          limit: requestUrl.searchParams.get("limit"),
          taskId: requestUrl.searchParams.get("taskId") || ""
        })
      });
      return true;
    }

    return false;
  };
}

module.exports = createDatabaseRoutes;
