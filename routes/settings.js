function createSettingsRoutes(runtime) {
  return async function handleSettingsRoute(req, res, requestUrl) {
    if (req.method === "GET" && requestUrl.pathname === "/api/settings") {
      runtime.sendJson(res, 200, {
        ok: true,
        data: runtime.getAppSettings()
      });
      return true;
    }

    if (req.method === "POST" && requestUrl.pathname === "/api/settings") {
      const body = await runtime.readJsonBody(req);
      runtime.sendJson(res, 200, {
        ok: true,
        data: runtime.updateAppSettings(body)
      });
      return true;
    }

    return false;
  };
}

module.exports = createSettingsRoutes;
