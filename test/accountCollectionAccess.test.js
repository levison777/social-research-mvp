const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { createServer } = require("../server");
const { createAuthService } = require("../services/authService");

test("a configured super administrator email fails closed when it does not match", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "social-research-super-admin-pin-"));
  const authService = createAuthService({
    databasePath: path.join(directory, "data", "social-research.sqlite3"),
    superAdminEmail: "jeff@cometsgame.com"
  });
  t.after(() => {
    authService.close();
    fs.rmSync(directory, { recursive: true, force: true });
  });

  const firstAdmin = authService.register({
    name: "Different Admin",
    email: "different@cometsgame.com",
    password: "AdminPass123"
  });
  assert.equal(firstAdmin.role, "admin");
  assert.equal(firstAdmin.isSuperAdmin, false);
  assert.equal(firstAdmin.permissions.accountCollection, false);
});

test("only the super administrator can create account collection tasks", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "social-research-account-access-"));
  const authService = createAuthService({
    databasePath: path.join(directory, "data", "social-research.sqlite3"),
    superAdminEmail: "jeff@cometsgame.com"
  });
  const runtime = createRuntimeStub();
  const { server } = createServer(runtime, { authService });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    authService.close();
    fs.rmSync(directory, { recursive: true, force: true });
  });

  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const superAdminRegistration = await postJson(baseUrl, "/api/auth/register", {
    name: "Jeff",
    email: "jeff@cometsgame.com",
    password: "SuperAdmin123"
  });
  assert.equal(superAdminRegistration.status, 201);
  const superAdminCookie = responseCookie(superAdminRegistration);
  const superAdmin = (await superAdminRegistration.json()).data.user;
  assert.equal(superAdmin.role, "admin");
  assert.equal(superAdmin.isSuperAdmin, true);
  assert.equal(superAdmin.permissions.accountCollection, true);

  const adminCreation = await postJson(baseUrl, "/api/auth/users", {
    name: "Admin",
    email: "admin@cometsgame.com",
    password: "AdminPass123",
    role: "admin",
    status: "active"
  }, superAdminCookie);
  assert.equal(adminCreation.status, 201);
  const admin = (await adminCreation.json()).data;
  assert.equal(admin.role, "admin");
  assert.equal(admin.isSuperAdmin, false);
  assert.equal(admin.permissions.accountCollection, false);

  const memberCreation = await postJson(baseUrl, "/api/auth/users", {
    name: "Researcher",
    email: "researcher@cometsgame.com",
    password: "MemberPass123",
    role: "member",
    status: "active"
  }, superAdminCookie);
  assert.equal(memberCreation.status, 201);
  const member = (await memberCreation.json()).data;

  const adminLogin = await postJson(baseUrl, "/api/auth/login", {
    email: admin.email,
    password: "AdminPass123"
  });
  const adminCookie = responseCookie(adminLogin);
  const memberLogin = await postJson(baseUrl, "/api/auth/login", {
    email: member.email,
    password: "MemberPass123"
  });
  const memberCookie = responseCookie(memberLogin);

  const accountPayload = {
    mode: "account",
    subject: "@OpenAI",
    platforms: ["X"]
  };
  const memberAccountTask = await postJson(baseUrl, "/api/tasks", accountPayload, memberCookie);
  assert.equal(memberAccountTask.status, 403);
  assert.equal((await memberAccountTask.json()).error, "仅超级管理员可以使用账号主体采集。");

  const adminAccountTask = await postJson(baseUrl, "/api/tasks", accountPayload, adminCookie);
  assert.equal(adminAccountTask.status, 403);

  const memberKeywordTask = await postJson(baseUrl, "/api/tasks", {
    mode: "keyword",
    subject: "OpenAI",
    platforms: ["X"]
  }, memberCookie);
  assert.equal(memberKeywordTask.status, 202);

  const superAdminAccountTask = await postJson(baseUrl, "/api/tasks", accountPayload, superAdminCookie);
  assert.equal(superAdminAccountTask.status, 202);
  assert.equal((await superAdminAccountTask.json()).data.mode, "account");
  assert.deepEqual(runtime.createdTasks.map((item) => item.mode), ["keyword", "account"]);
});

function postJson(baseUrl, pathname, body, cookie = "") {
  return fetch(`${baseUrl}${pathname}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {})
    },
    body: JSON.stringify(body)
  });
}

function responseCookie(response) {
  const value = response.headers.get("set-cookie") || "";
  assert.ok(value, "expected an authentication cookie");
  return value.split(";", 1)[0];
}

function createRuntimeStub() {
  const createdTasks = [];
  return {
    HOST: "127.0.0.1",
    PORT: 0,
    HTML_PATH: "",
    createdTasks,
    applyCors(res) {
      res.setHeader("Access-Control-Allow-Origin", "*");
    },
    readJsonBody(req) {
      return new Promise((resolve, reject) => {
        const chunks = [];
        req.on("data", (chunk) => chunks.push(chunk));
        req.on("end", () => {
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
          } catch (error) {
            reject(error);
          }
        });
        req.on("error", reject);
      });
    },
    sendJson(res, statusCode, payload) {
      const body = JSON.stringify(payload);
      res.writeHead(statusCode, {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Length": Buffer.byteLength(body)
      });
      res.end(body);
    },
    createTaskFromBody(body) {
      const task = {
        id: `task_${createdTasks.length + 1}`,
        mode: body.mode,
        subject: body.subject,
        platforms: body.platforms || []
      };
      createdTasks.push(task);
      return task;
    }
  };
}
