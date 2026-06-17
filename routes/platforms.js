function createPlatformRoutes(runtime) {
  return async function handlePlatformRoute(_req, res, requestUrl) {
    if (_req.method === "GET" && requestUrl.pathname === "/api/health") {
      runtime.sendJson(res, 200, runtime.getHealthPayload());
      return true;
    }

    if (_req.method === "GET" && requestUrl.pathname === "/api/platforms") {
      runtime.sendJson(res, 200, {
        ok: true,
        data: runtime.getPlatformList({ refresh: requestUrl.searchParams.get("refresh") === "1" })
      });
      return true;
    }

    return false;
  };
}

module.exports = createPlatformRoutes;
