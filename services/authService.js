const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const DEFAULT_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 128;
const SESSION_COOKIE_NAME = "sr_session";
const ALLOWED_EMAIL_DOMAIN = "cometsgame.com";

function createAuthService(options = {}) {
  const databasePath = path.resolve(options.databasePath);
  const registrationEnabled = options.registrationEnabled !== false;
  const sessionTtlMs = Math.max(60_000, Number(options.sessionTtlMs || DEFAULT_SESSION_TTL_MS));
  const configuredSuperAdminEmail = normalizeEmail(options.superAdminEmail || "");
  const now = typeof options.now === "function" ? options.now : () => new Date();

  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  const database = new DatabaseSync(databasePath);
  database.exec("PRAGMA foreign_keys = ON");
  database.exec("PRAGMA busy_timeout = 5000");
  database.exec("PRAGMA journal_mode = WAL");
  database.exec("PRAGMA synchronous = NORMAL");
  createSchema(database);

  return {
    databasePath,
    getBootstrapState,
    register,
    login,
    logoutRequest,
    authenticateRequest,
    listUsers,
    listAuditLogs,
    recordDataExport,
    createUser,
    updateUser,
    resetPassword,
    sessionCookie,
    clearSessionCookie,
    close: () => database.close()
  };

  function getBootstrapState() {
    purgeExpiredSessions();
    const accountCount = countUsers();
    return {
      initialized: accountCount > 0,
      accountCount,
      registrationEnabled: accountCount === 0 || registrationEnabled,
      firstAccountWillBeAdmin: accountCount === 0,
      allowedEmailDomain: ALLOWED_EMAIL_DOMAIN
    };
  }

  function register(input = {}, context = {}) {
    const accountCount = countUsers();
    if (accountCount > 0 && !registrationEnabled) {
      throw authError(403, "当前系统未开放自主注册，请联系管理员创建账号。");
    }

    const userInput = normalizeUserInput(input, {
      role: accountCount === 0 ? "admin" : "member",
      status: "active",
      requirePassword: true
    });
    let user;
    transaction(database, () => {
      user = insertUser(userInput, "");
      insertAuditLog({
        actor: user,
        action: "account_register",
        target: user,
        summary: `注册账号（${user.role === "admin" ? "管理员" : "普通成员"}）`,
        details: { role: user.role, status: user.status }
      }, context);
    });
    return user;
  }

  function login(input = {}, context = {}) {
    purgeExpiredSessions();
    const email = normalizeEmail(input.email);
    const password = String(input.password || "");
    validateEmail(email);
    const row = email
      ? database.prepare("SELECT * FROM users WHERE email = ? COLLATE NOCASE").get(email)
      : null;

    const passwordMatches = verifyPassword(password, row?.password_hash || dummyPasswordHash());
    if (!row || !passwordMatches) {
      insertAuditLog({
        action: "login",
        target: row || { email },
        outcome: "failure",
        summary: "登录失败：邮箱或密码不正确。"
      }, context);
      throw authError(401, "邮箱或密码不正确。");
    }
    if (row.status !== "active") {
      insertAuditLog({
        actor: row,
        action: "login",
        target: row,
        outcome: "failure",
        summary: "登录失败：账号已停用。"
      }, context);
      throw authError(403, "账号已停用，请联系系统管理员。");
    }

    const signedInAt = nowIso();
    let session;
    transaction(database, () => {
      database.prepare("UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?")
        .run(signedInAt, signedInAt, row.id);
      session = createSession(row.id);
      insertAuditLog({
        actor: row,
        action: "login",
        target: row,
        summary: "登录系统。"
      }, context);
    });
    return {
      user: getUserById(row.id),
      token: session.token,
      expiresAt: session.expiresAt
    };
  }

  function logoutRequest(req, context = {}) {
    const token = requestSessionToken(req);
    if (!token) return false;
    const tokenHash = hashSessionToken(token);
    const row = database.prepare(`
      SELECT u.* FROM auth_sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ?
    `).get(tokenHash);
    if (!row) return false;
    let removed = false;
    transaction(database, () => {
      removed = database.prepare("DELETE FROM auth_sessions WHERE token_hash = ?")
        .run(tokenHash).changes > 0;
      if (removed) {
        insertAuditLog({
          actor: row,
          action: "logout",
          target: row,
          summary: "退出系统。"
        }, context);
      }
    });
    return removed;
  }

  function authenticateRequest(req) {
    purgeExpiredSessions();
    const token = requestSessionToken(req);
    if (!token) return null;

    const row = database.prepare(`
      SELECT u.*, s.token_hash, s.expires_at
      FROM auth_sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ?
    `).get(hashSessionToken(token));

    if (!row || row.status !== "active" || !isAllowedEmail(row.email) || Date.parse(row.expires_at) <= now().getTime()) {
      if (row?.token_hash) {
        database.prepare("DELETE FROM auth_sessions WHERE token_hash = ?").run(row.token_hash);
      }
      return null;
    }

    database.prepare("UPDATE auth_sessions SET last_seen_at = ? WHERE token_hash = ?")
      .run(nowIso(), row.token_hash);
    return toPublicUser(row);
  }

  function listUsers(filters = {}) {
    purgeExpiredSessions();
    const values = [];
    const conditions = [];
    const query = String(filters.query || "").trim();
    const role = normalizeOptionalChoice(filters.role, ["admin", "member"]);
    const status = normalizeOptionalChoice(filters.status, ["active", "disabled"]);

    if (query) {
      conditions.push("(name LIKE ? ESCAPE '\\' OR email LIKE ? ESCAPE '\\')");
      const pattern = `%${escapeLike(query)}%`;
      values.push(pattern, pattern);
    }
    if (role) {
      conditions.push("role = ?");
      values.push(role);
    }
    if (status) {
      conditions.push("status = ?");
      values.push(status);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const rows = database.prepare(`
      SELECT * FROM users
      ${where}
      ORDER BY CASE role WHEN 'admin' THEN 0 ELSE 1 END, created_at ASC, email ASC
    `).all(...values);
    const superAdminId = getSuperAdminUserId();
    return rows.map((row) => toPublicUser(row, superAdminId));
  }

  function listAuditLogs(actor, filters = {}) {
    requireAdmin(actor);
    const values = [];
    const conditions = [];
    const query = String(filters.query || "").trim().slice(0, 120);
    const action = String(filters.action || "").trim().slice(0, 64);
    const outcome = normalizeOptionalChoice(filters.outcome, ["success", "failure"]);
    const limit = Math.min(200, Math.max(1, Math.trunc(Number(filters.limit) || 50)));
    const offset = Math.max(0, Math.trunc(Number(filters.offset) || 0));

    if (query) {
      conditions.push(`(
        actor_name LIKE ? ESCAPE '\\' OR actor_email LIKE ? ESCAPE '\\'
        OR target_name LIKE ? ESCAPE '\\' OR target_email LIKE ? ESCAPE '\\'
        OR summary LIKE ? ESCAPE '\\' OR ip_address LIKE ? ESCAPE '\\'
      )`);
      const pattern = `%${escapeLike(query)}%`;
      values.push(pattern, pattern, pattern, pattern, pattern, pattern);
    }
    if (action) {
      conditions.push("action = ?");
      values.push(action);
    }
    if (outcome) {
      conditions.push("outcome = ?");
      values.push(outcome);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const total = Number(database.prepare(`SELECT COUNT(*) AS count FROM account_audit_logs ${where}`).get(...values)?.count || 0);
    const items = database.prepare(`
      SELECT * FROM account_audit_logs
      ${where}
      ORDER BY created_at DESC, id DESC
      LIMIT ? OFFSET ?
    `).all(...values, limit, offset).map(publicAuditLog);
    return { items, total, limit, offset };
  }

  function recordDataExport(actor, event = {}, context = {}) {
    requireActiveUser(actor);
    const taskId = normalizeAuditText(event.taskId || "all", 120) || "all";
    const taskTitle = normalizeAuditText(event.title || event.taskTitle || "全部任务", 160) || "全部任务";
    const platform = normalizeAuditText(event.platform || "全部平台", 80) || "全部平台";
    const query = normalizeAuditText(event.query, 160);
    const fileName = path.posix.basename(normalizeAuditText(event.fileName, 240).replace(/\\/g, "/"));
    const sheetName = normalizeAuditText(event.sheetName, 80);
    const rowCount = normalizeAuditCount(event.rowCount ?? event.rows?.length);
    const columnCount = normalizeAuditCount(event.columnCount ?? event.columns?.length);
    const outcome = event.outcome === "failure" ? "failure" : "success";
    const errorMessage = outcome === "failure" ? normalizeAuditText(event.errorMessage, 240) : "";
    const summary = outcome === "failure"
      ? `导出表格失败：${taskTitle} · ${platform}${errorMessage ? ` · ${errorMessage}` : ""}`
      : `导出表格：${taskTitle} · ${platform} · ${rowCount} 行${fileName ? ` · ${fileName}` : ""}`;

    insertAuditLog({
      actor,
      action: "data_export",
      target: { name: taskTitle, email: platform },
      outcome,
      summary,
      details: {
        taskId,
        taskTitle,
        platform,
        query,
        fileName,
        rowCount,
        columnCount,
        sheetName,
        ...(errorMessage ? { errorMessage } : {})
      }
    }, context);
  }

  function createUser(actor, input = {}, context = {}) {
    requireAdmin(actor);
    const userInput = normalizeUserInput(input, {
      role: normalizeChoice(input.role, ["admin", "member"], "member"),
      status: normalizeChoice(input.status, ["active", "disabled"], "active"),
      requirePassword: true
    });
    let user;
    transaction(database, () => {
      user = insertUser(userInput, actor.id);
      insertAuditLog({
        actor,
        action: "account_create",
        target: user,
        summary: `新建账号（${user.role === "admin" ? "管理员" : "普通成员"}，${user.status === "active" ? "启用" : "停用"}）`,
        details: { role: user.role, status: user.status }
      }, context);
    });
    return user;
  }

  function updateUser(actor, userId, input = {}, context = {}) {
    requireAdmin(actor);
    const existing = getUserRow(userId);
    if (!existing) throw authError(404, "账号不存在。");

    const nextName = input.name === undefined ? existing.name : normalizeName(input.name);
    const nextEmail = input.email === undefined ? existing.email : normalizeEmail(input.email);
    const nextRole = input.role === undefined
      ? existing.role
      : normalizeChoice(input.role, ["admin", "member"], existing.role);
    const nextStatus = input.status === undefined
      ? existing.status
      : normalizeChoice(input.status, ["active", "disabled"], existing.status);

    if (!nextName) throw authError(400, "请输入姓名。");
    validateEmail(nextEmail);
    if (actor.id === existing.id && (nextRole !== "admin" || nextStatus !== "active")) {
      throw authError(400, "不能取消自己的管理员权限或停用当前账号。");
    }
    if (existing.role === "admin" && existing.status === "active"
      && (nextRole !== "admin" || nextStatus !== "active")
      && countActiveAdmins() <= 1) {
      throw authError(400, "系统必须保留至少一个启用中的管理员账号。");
    }

    const changes = accountChanges(existing, {
      name: nextName,
      email: nextEmail,
      role: nextRole,
      status: nextStatus
    });
    const changedFields = Object.keys(changes);
    const action = changedFields.length === 1 && changes.status
      ? (nextStatus === "active" ? "account_enable" : "account_disable")
      : "account_update";
    const summary = action === "account_enable"
      ? "启用账号。"
      : action === "account_disable"
        ? "停用账号并注销现有会话。"
        : changedFields.length
          ? `编辑账号：${changedFields.map(accountFieldLabel).join("、")}。`
          : "保存账号资料（无字段变化）。";

    let updated;
    try {
      transaction(database, () => {
        database.prepare(`
          UPDATE users SET name = ?, email = ?, role = ?, status = ?, updated_at = ? WHERE id = ?
        `).run(nextName, nextEmail, nextRole, nextStatus, nowIso(), existing.id);
        if (nextStatus !== "active") {
          database.prepare("DELETE FROM auth_sessions WHERE user_id = ?").run(existing.id);
        }
        updated = getUserById(existing.id);
        insertAuditLog({ actor, action, target: updated, summary, details: { changes } }, context);
      });
    } catch (error) {
      if (isUniqueConstraint(error)) throw authError(409, "该邮箱已被其他账号使用。");
      throw error;
    }
    return updated;
  }

  function resetPassword(actor, userId, input = {}, context = {}) {
    requireAdmin(actor);
    const existing = getUserRow(userId);
    if (!existing) throw authError(404, "账号不存在。");
    const password = validatePassword(input.password);
    const changedAt = nowIso();
    let sessionsRevoked = 0;
    transaction(database, () => {
      database.prepare("UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?")
        .run(hashPassword(password), changedAt, existing.id);
      sessionsRevoked = database.prepare("DELETE FROM auth_sessions WHERE user_id = ?").run(existing.id).changes;
      insertAuditLog({
        actor,
        action: "password_reset",
        target: existing,
        summary: "修改账号密码并注销现有会话。",
        details: { sessionsRevoked }
      }, context);
    });
    return {
      user: getUserById(existing.id),
      currentSessionRevoked: actor.id === existing.id
    };
  }

  function sessionCookie(token, req) {
    const secure = requestIsSecure(req) ? "; Secure" : "";
    const maxAge = Math.floor(sessionTtlMs / 1000);
    return `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
  }

  function clearSessionCookie(req) {
    const secure = requestIsSecure(req) ? "; Secure" : "";
    return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
  }

  function insertUser(userInput, createdBy) {
    const id = `usr_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
    const createdAt = nowIso();
    try {
      database.prepare(`
        INSERT INTO users (
          id, name, email, password_hash, role, status, created_at, updated_at, last_login_at, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, '', ?)
      `).run(
        id,
        userInput.name,
        userInput.email,
        hashPassword(userInput.password),
        userInput.role,
        userInput.status,
        createdAt,
        createdAt,
        createdBy || ""
      );
    } catch (error) {
      if (isUniqueConstraint(error)) throw authError(409, "该邮箱已经注册。");
      throw error;
    }
    return getUserById(id);
  }

  function insertAuditLog(event = {}, context = {}) {
    const actor = auditIdentity(event.actor);
    const target = auditIdentity(event.target);
    const auditContext = normalizeAuditContext(context);
    database.prepare(`
      INSERT INTO account_audit_logs (
        actor_user_id, actor_name, actor_email, action,
        target_user_id, target_name, target_email, outcome,
        summary, details_json, ip_address, user_agent, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      actor.id,
      actor.name,
      actor.email,
      String(event.action || "account_update").slice(0, 64),
      target.id,
      target.name,
      target.email,
      event.outcome === "failure" ? "failure" : "success",
      normalizeAuditText(event.summary, 500),
      JSON.stringify(event.details && typeof event.details === "object" ? event.details : {}),
      auditContext.ipAddress,
      auditContext.userAgent,
      nowIso()
    );
  }

  function createSession(userId) {
    const token = crypto.randomBytes(32).toString("base64url");
    const createdAt = nowIso();
    const expiresAt = new Date(now().getTime() + sessionTtlMs).toISOString();
    database.prepare(`
      INSERT INTO auth_sessions (token_hash, user_id, created_at, expires_at, last_seen_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(hashSessionToken(token), userId, createdAt, expiresAt, createdAt);
    return { token, expiresAt };
  }

  function getUserRow(userId) {
    return database.prepare("SELECT * FROM users WHERE id = ?").get(String(userId || "")) || null;
  }

  function getUserById(userId) {
    const row = getUserRow(userId);
    return row ? toPublicUser(row) : null;
  }

  function countUsers() {
    return Number(database.prepare("SELECT COUNT(*) AS count FROM users").get()?.count || 0);
  }

  function countActiveAdmins() {
    return Number(database.prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'admin' AND status = 'active'").get()?.count || 0);
  }

  function getSuperAdminUserId() {
    if (configuredSuperAdminEmail) {
      const configured = database.prepare(`
        SELECT id FROM users
        WHERE email = ? COLLATE NOCASE AND role = 'admin' AND status = 'active'
        LIMIT 1
      `).get(configuredSuperAdminEmail);
      return configured?.id || "";
    }
    return database.prepare(`
      SELECT id FROM users
      WHERE role = 'admin' AND status = 'active'
      ORDER BY created_at ASC, id ASC
      LIMIT 1
    `).get()?.id || "";
  }

  function toPublicUser(row, superAdminId = getSuperAdminUserId()) {
    return publicUser(row, { isSuperAdmin: row?.id === superAdminId });
  }

  function purgeExpiredSessions() {
    database.prepare("DELETE FROM auth_sessions WHERE expires_at <= ?").run(nowIso());
  }

  function nowIso() {
    return now().toISOString();
  }
}

function createSchema(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin', 'member')),
      status TEXT NOT NULL CHECK (status IN ('active', 'disabled')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_login_at TEXT NOT NULL DEFAULT '',
      created_by TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS auth_sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS account_audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_user_id TEXT NOT NULL DEFAULT '',
      actor_name TEXT NOT NULL DEFAULT '',
      actor_email TEXT NOT NULL DEFAULT '',
      action TEXT NOT NULL,
      target_user_id TEXT NOT NULL DEFAULT '',
      target_name TEXT NOT NULL DEFAULT '',
      target_email TEXT NOT NULL DEFAULT '',
      outcome TEXT NOT NULL CHECK (outcome IN ('success', 'failure')),
      summary TEXT NOT NULL DEFAULT '',
      details_json TEXT NOT NULL DEFAULT '{}',
      ip_address TEXT NOT NULL DEFAULT '',
      user_agent TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_users_role_status ON users(role, status);
    CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id ON auth_sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires_at ON auth_sessions(expires_at);
    CREATE INDEX IF NOT EXISTS idx_account_audit_created_at ON account_audit_logs(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_account_audit_action ON account_audit_logs(action, outcome);
    CREATE INDEX IF NOT EXISTS idx_account_audit_actor ON account_audit_logs(actor_user_id);
    CREATE INDEX IF NOT EXISTS idx_account_audit_target ON account_audit_logs(target_user_id);
  `);
}

function accountChanges(existing, next) {
  return ["name", "email", "role", "status"].reduce((changes, field) => {
    if (existing[field] !== next[field]) {
      changes[field] = { from: existing[field], to: next[field] };
    }
    return changes;
  }, {});
}

function accountFieldLabel(field) {
  return {
    name: "姓名",
    email: "邮箱",
    role: "角色",
    status: "状态"
  }[field] || field;
}

function auditIdentity(value = {}) {
  return {
    id: normalizeAuditText(value?.id, 80),
    name: normalizeAuditText(value?.name, 80),
    email: normalizeAuditText(value?.email, 254)
  };
}

function normalizeAuditContext(context = {}) {
  return {
    ipAddress: normalizeAuditText(context.ipAddress, 120),
    userAgent: normalizeAuditText(context.userAgent, 500)
  };
}

function normalizeAuditText(value, maxLength) {
  return String(value || "").replace(/[\r\n\t]+/g, " ").trim().slice(0, maxLength);
}

function normalizeAuditCount(value) {
  const number = Math.trunc(Number(value));
  if (!Number.isFinite(number)) return 0;
  return Math.min(1_000_000_000, Math.max(0, number));
}

function publicAuditLog(row) {
  let details = {};
  try {
    details = JSON.parse(row.details_json || "{}");
  } catch (_error) {
    details = {};
  }
  return {
    id: Number(row.id),
    actorUserId: row.actor_user_id || "",
    actorName: row.actor_name || "",
    actorEmail: row.actor_email || "",
    action: row.action,
    targetUserId: row.target_user_id || "",
    targetName: row.target_name || "",
    targetEmail: row.target_email || "",
    outcome: row.outcome,
    summary: row.summary || "",
    details,
    ipAddress: row.ip_address || "",
    userAgent: row.user_agent || "",
    createdAt: row.created_at
  };
}

function normalizeUserInput(input, options) {
  const name = normalizeName(input.name);
  const email = normalizeEmail(input.email);
  if (!name) throw authError(400, "请输入姓名。");
  validateEmail(email);
  return {
    name,
    email,
    password: options.requirePassword ? validatePassword(input.password) : "",
    role: options.role,
    status: options.status
  };
}

function normalizeName(value) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, 80);
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase().slice(0, 254);
}

function validateEmail(email) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw authError(400, "请输入有效的邮箱地址。");
  }
  if (!isAllowedEmail(email)) {
    throw authError(400, `仅支持 @${ALLOWED_EMAIL_DOMAIN} 企业邮箱。`);
  }
  return email;
}

function isAllowedEmail(email) {
  const parts = String(email || "").toLowerCase().split("@");
  return parts.length === 2 && Boolean(parts[0]) && parts[1] === ALLOWED_EMAIL_DOMAIN;
}

function validatePassword(value) {
  const password = String(value || "");
  if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) {
    throw authError(400, `密码长度需要为 ${PASSWORD_MIN_LENGTH}-${PASSWORD_MAX_LENGTH} 位。`);
  }
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    throw authError(400, "密码至少需要包含一个字母和一个数字。");
  }
  return password;
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const digest = crypto.scryptSync(password, salt, 64);
  return `scrypt:${salt.toString("hex")}:${digest.toString("hex")}`;
}

function verifyPassword(password, encoded) {
  const [, saltHex, digestHex] = String(encoded || "").split(":");
  if (!saltHex || !digestHex) return false;
  try {
    const expected = Buffer.from(digestHex, "hex");
    const actual = crypto.scryptSync(String(password || ""), Buffer.from(saltHex, "hex"), expected.length);
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  } catch (_error) {
    return false;
  }
}

let cachedDummyPasswordHash = "";
function dummyPasswordHash() {
  if (!cachedDummyPasswordHash) cachedDummyPasswordHash = hashPassword("invalid-password-1");
  return cachedDummyPasswordHash;
}

function hashSessionToken(token) {
  return crypto.createHash("sha256").update(String(token || "")).digest("hex");
}

function requestSessionToken(req) {
  const cookies = parseCookies(req?.headers?.cookie || "");
  return cookies[SESSION_COOKIE_NAME] || "";
}

function parseCookies(header) {
  return String(header || "").split(";").reduce((cookies, part) => {
    const separator = part.indexOf("=");
    if (separator <= 0) return cookies;
    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    try {
      cookies[key] = decodeURIComponent(value);
    } catch (_error) {
      cookies[key] = value;
    }
    return cookies;
  }, {});
}

function requestIsSecure(req) {
  return Boolean(req?.socket?.encrypted)
    || String(req?.headers?.["x-forwarded-proto"] || "").split(",")[0].trim().toLowerCase() === "https";
}

function publicUser(row, options = {}) {
  const isSuperAdmin = options.isSuperAdmin === true;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    status: row.status,
    isSuperAdmin,
    permissions: {
      accountCollection: isSuperAdmin
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastLoginAt: row.last_login_at || ""
  };
}

function requireAdmin(actor) {
  if (!actor || actor.role !== "admin" || actor.status !== "active") {
    throw authError(403, "仅系统管理员可以执行此操作。");
  }
}

function requireActiveUser(actor) {
  if (!actor || !actor.id || actor.status !== "active") {
    throw authError(403, "只有已启用的登录账号可以执行此操作。");
  }
}

function normalizeChoice(value, allowed, fallback) {
  const normalized = String(value || "").trim().toLowerCase();
  return allowed.includes(normalized) ? normalized : fallback;
}

function normalizeOptionalChoice(value, allowed) {
  const normalized = String(value || "").trim().toLowerCase();
  return allowed.includes(normalized) ? normalized : "";
}

function escapeLike(value) {
  return String(value || "").replace(/[\\%_]/g, (character) => `\\${character}`);
}

function isUniqueConstraint(error) {
  return /UNIQUE constraint failed/i.test(String(error?.message || error));
}

function authError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function transaction(database, callback) {
  database.exec("BEGIN IMMEDIATE");
  try {
    callback();
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

module.exports = {
  createAuthService,
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
  SESSION_COOKIE_NAME
};
