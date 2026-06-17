#!/usr/bin/env node

const http = require("node:http");

const { createRuntime } = require("./services/runtime");
const createAgentRoutes = require("./routes/agent");
const createPlatformRoutes = require("./routes/platforms");
const createProviderRoutes = require("./routes/providers");
const createSettingsRoutes = require("./routes/settings");
const createTaskRoutes = require("./routes/tasks");

function createServer(runtime = createRuntime()) {
  const routeHandlers = [
    createPlatformRoutes(runtime),
    createSettingsRoutes(runtime),
    createProviderRoutes(runtime),
    createAgentRoutes(runtime),
    createTaskRoutes(runtime)
  ];

  const server = http.createServer(async (req, res) => {
    try {
      if (!req.url) {
        return runtime.sendJson(res, 400, { ok: false, error: "Missing URL" });
      }

      const requestUrl = new URL(req.url, `http://${req.headers.host || `${runtime.HOST}:${runtime.PORT}`}`);
      runtime.applyCors(res);

      if (req.method === "OPTIONS") {
        res.writeHead(204);
        return res.end();
      }

      if (req.method === "GET" && requestUrl.pathname === "/") {
        return runtime.sendHtml(res, runtime.HTML_PATH);
      }

      for (const handleRoute of routeHandlers) {
        const handled = await handleRoute(req, res, requestUrl);
        if (handled) return;
      }

      return runtime.sendJson(res, 404, { ok: false, error: "Not found" });
    } catch (error) {
      return runtime.sendJson(res, error.statusCode || 500, {
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  return { server, runtime };
}

function start() {
  const { server, runtime } = createServer();
  server.listen(runtime.PORT, runtime.HOST, () => {
    console.log(`social-research-mvp server running at http://${runtime.HOST}:${runtime.PORT}`);
  });
  return { server, runtime };
}

if (require.main === module) {
  start();
}

module.exports = { createServer, start };
