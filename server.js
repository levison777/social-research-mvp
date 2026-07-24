#!/usr/bin/env node

const http = require("node:http");
const path = require("node:path");

const { createRuntime } = require("./services/runtime");
const { createAuthService } = require("./services/authService");
const createAgentRoutes = require("./routes/agent");
const createAuthRoutes = require("./routes/auth");
const createDatabaseRoutes = require("./routes/database");
const createPlatformRoutes = require("./routes/platforms");
const createProviderRoutes = require("./routes/providers");
const createSettingsRoutes = require("./routes/settings");
const createTaskRoutes = require("./routes/tasks");

function createServer(runtime = createRuntime(), options = {}) {
  const authService = options.authService || createAuthService({
    databasePath: path.resolve(__dirname, process.env.SOCIAL_RESEARCH_DATABASE_PATH || "data/social-research.sqlite3"),
    registrationEnabled: envFlag("AUTH_ALLOW_REGISTRATION", true),
    sessionTtlMs: Math.max(1, Number(process.env.AUTH_SESSION_DAYS || 7)) * 24 * 60 * 60 * 1000
  });
  const authRoute = createAuthRoutes(runtime, authService);
  const routeHandlers = [
    createPlatformRoutes(runtime),
    createSettingsRoutes(runtime),
    createProviderRoutes(runtime),
    createAgentRoutes(runtime),
    createDatabaseRoutes(runtime),
    createTaskRoutes(runtime, authService)
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

      if (requestUrl.pathname.startsWith("/api/auth/")) {
        return await authRoute(req, res, requestUrl);
      }

      if (requestUrl.pathname.startsWith("/api/") && requestUrl.pathname !== "/api/health") {
        const user = authService.authenticateRequest(req);
        if (!user) {
          return runtime.sendJson(res, 401, { ok: false, error: "请先登录。" });
        }
        req.auth = user;
        if (requiresAdmin(requestUrl.pathname) && user.role !== "admin") {
          return runtime.sendJson(res, 403, { ok: false, error: "仅系统管理员可以访问此功能。" });
        }
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

  if (!options.authService) {
    server.once("close", () => authService.close());
  }

  return { server, runtime, authService };
}

function requiresAdmin(pathname) {
  return pathname === "/api/settings" || /^\/api\/providers\/[^/]+\/test$/.test(pathname);
}

function envFlag(name, fallback) {
  const value = process.env[name];
  if (value === undefined || value === null || value === "") return fallback;
  return !/^(0|false|no|off)$/i.test(String(value).trim());
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
