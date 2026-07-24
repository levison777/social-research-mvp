function requestAuditContext(req) {
  const forwarded = Array.isArray(req.headers?.["x-forwarded-for"])
    ? req.headers["x-forwarded-for"][0]
    : req.headers?.["x-forwarded-for"];
  const ipAddress = String(forwarded || req.socket?.remoteAddress || "")
    .split(",")[0]
    .trim()
    .replace(/^::ffff:/, "");
  return {
    ipAddress,
    userAgent: String(req.headers?.["user-agent"] || "")
  };
}

module.exports = { requestAuditContext };
