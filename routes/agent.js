function createAgentRoutes(runtime) {
  return async function handleAgentRoute(req, res, requestUrl) {
    if (req.method === "GET" && requestUrl.pathname === "/api/agent/status") {
      runtime.sendJson(res, 200, {
        ok: true,
        data: runtime.getAgentStatus()
      });
      return true;
    }

    if (req.method === "POST" && requestUrl.pathname === "/api/agent/plan") {
      const body = await runtime.readJsonBody(req);
      try {
        const plan = await runtime.generateAgentCollectionPlan(body);
        runtime.sendJson(res, 200, { ok: true, data: plan });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const statusCode = message.includes("LLM_API_KEY") ? 400 : 502;
        runtime.sendJson(res, statusCode, { ok: false, error: message });
      }
      return true;
    }

    if (req.method === "POST" && requestUrl.pathname === "/api/agent/chat") {
      const body = await runtime.readJsonBody(req);
      try {
        const reply = await runtime.generateAgentChatReply(body);
        runtime.sendJson(res, 200, { ok: true, data: reply });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const statusCode = message.includes("LLM_API_KEY") ? 400 : 502;
        runtime.sendJson(res, statusCode, { ok: false, error: message });
      }
      return true;
    }

    if (req.method === "POST" && requestUrl.pathname === "/api/agent/page-analyze") {
      const body = await runtime.readJsonBody(req);
      try {
        const analysis = await runtime.generatePageAnalysis(body);
        runtime.sendJson(res, 200, { ok: true, data: analysis });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const statusCode = message.includes("LLM_API_KEY") ? 400 : 502;
        runtime.sendJson(res, statusCode, { ok: false, error: message });
      }
      return true;
    }

    return false;
  };
}

module.exports = createAgentRoutes;
