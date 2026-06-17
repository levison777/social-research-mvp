const providers = require("../services/providers");

function createProviderRoutes(runtime) {
  return async function handleProviderRoute(req, res, requestUrl) {
    if (req.method === "GET" && requestUrl.pathname === "/api/usage") {
      runtime.sendJson(res, 200, {
        ok: true,
        data: providers.getApiUsageReport(runtime)
      });
      return true;
    }

    const providerTestMatch = requestUrl.pathname.match(/^\/api\/providers\/([^/]+)\/test$/);
    if (req.method === "POST" && providerTestMatch) {
      const providerId = decodeURIComponent(providerTestMatch[1]);
      const result = await providers.testApiProvider(runtime, providerId);
      runtime.sendJson(res, 200, { ok: true, data: result });
      return true;
    }

    return false;
  };
}

module.exports = createProviderRoutes;
