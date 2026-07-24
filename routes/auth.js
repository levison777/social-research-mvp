const { requestAuditContext } = require("../utils/requestAuditContext");

function createAuthRoutes(runtime, authService) {
  return async function handleAuthRoute(req, res, requestUrl) {
    if (!requestUrl.pathname.startsWith("/api/auth/")) return false;
    res.setHeader("Cache-Control", "no-store");

    if (req.method === "GET" && requestUrl.pathname === "/api/auth/bootstrap") {
      runtime.sendJson(res, 200, { ok: true, data: authService.getBootstrapState() });
      return true;
    }

    if (req.method === "POST" && requestUrl.pathname === "/api/auth/register") {
      const body = await runtime.readJsonBody(req);
      const context = requestAuditContext(req);
      authService.register(body, context);
      const session = authService.login({ email: body.email, password: body.password }, context);
      res.setHeader("Set-Cookie", authService.sessionCookie(session.token, req));
      runtime.sendJson(res, 201, {
        ok: true,
        data: { user: session.user, expiresAt: session.expiresAt }
      });
      return true;
    }

    if (req.method === "POST" && requestUrl.pathname === "/api/auth/login") {
      const body = await runtime.readJsonBody(req);
      const session = authService.login(body, requestAuditContext(req));
      res.setHeader("Set-Cookie", authService.sessionCookie(session.token, req));
      runtime.sendJson(res, 200, {
        ok: true,
        data: { user: session.user, expiresAt: session.expiresAt }
      });
      return true;
    }

    if (req.method === "POST" && requestUrl.pathname === "/api/auth/logout") {
      authService.logoutRequest(req, requestAuditContext(req));
      res.setHeader("Set-Cookie", authService.clearSessionCookie(req));
      runtime.sendJson(res, 200, { ok: true, data: { signedOut: true } });
      return true;
    }

    if (req.method === "GET" && requestUrl.pathname === "/api/auth/me") {
      const user = authService.authenticateRequest(req);
      if (!user) {
        runtime.sendJson(res, 401, { ok: false, error: "请先登录。" });
        return true;
      }
      runtime.sendJson(res, 200, { ok: true, data: user });
      return true;
    }

    if (req.method === "GET" && requestUrl.pathname === "/api/auth/users") {
      const actor = requireSignedInAdmin(req, res, runtime, authService);
      if (!actor) return true;
      runtime.sendJson(res, 200, {
        ok: true,
        data: authService.listUsers({
          query: requestUrl.searchParams.get("query") || "",
          role: requestUrl.searchParams.get("role") || "",
          status: requestUrl.searchParams.get("status") || ""
        })
      });
      return true;
    }

    if (req.method === "GET" && requestUrl.pathname === "/api/auth/audit-logs") {
      const actor = requireSignedInAdmin(req, res, runtime, authService);
      if (!actor) return true;
      runtime.sendJson(res, 200, {
        ok: true,
        data: authService.listAuditLogs(actor, {
          query: requestUrl.searchParams.get("query") || "",
          action: requestUrl.searchParams.get("action") || "",
          outcome: requestUrl.searchParams.get("outcome") || "",
          limit: requestUrl.searchParams.get("limit") || 50,
          offset: requestUrl.searchParams.get("offset") || 0
        })
      });
      return true;
    }

    if (req.method === "POST" && requestUrl.pathname === "/api/auth/users") {
      const actor = requireSignedInAdmin(req, res, runtime, authService);
      if (!actor) return true;
      const body = await runtime.readJsonBody(req);
      runtime.sendJson(res, 201, {
        ok: true,
        data: authService.createUser(actor, body, requestAuditContext(req))
      });
      return true;
    }

    const updateMatch = requestUrl.pathname.match(/^\/api\/auth\/users\/([^/]+)\/update$/);
    if (req.method === "POST" && updateMatch) {
      const actor = requireSignedInAdmin(req, res, runtime, authService);
      if (!actor) return true;
      const body = await runtime.readJsonBody(req);
      runtime.sendJson(res, 200, {
        ok: true,
        data: authService.updateUser(actor, decodeURIComponent(updateMatch[1]), body, requestAuditContext(req))
      });
      return true;
    }

    const resetMatch = requestUrl.pathname.match(/^\/api\/auth\/users\/([^/]+)\/reset-password$/);
    if (req.method === "POST" && resetMatch) {
      const actor = requireSignedInAdmin(req, res, runtime, authService);
      if (!actor) return true;
      const body = await runtime.readJsonBody(req);
      const result = authService.resetPassword(
        actor,
        decodeURIComponent(resetMatch[1]),
        body,
        requestAuditContext(req)
      );
      if (result.currentSessionRevoked) {
        res.setHeader("Set-Cookie", authService.clearSessionCookie(req));
      }
      runtime.sendJson(res, 200, { ok: true, data: result });
      return true;
    }

    runtime.sendJson(res, 404, { ok: false, error: "Auth route not found" });
    return true;
  };
}

function requireSignedInAdmin(req, res, runtime, authService) {
  const actor = req.auth || authService.authenticateRequest(req);
  if (!actor) {
    runtime.sendJson(res, 401, { ok: false, error: "请先登录。" });
    return null;
  }
  if (actor.role !== "admin") {
    runtime.sendJson(res, 403, { ok: false, error: "仅系统管理员可以管理账号。" });
    return null;
  }
  return actor;
}

module.exports = createAuthRoutes;
