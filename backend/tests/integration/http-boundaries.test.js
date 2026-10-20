const express = require("express");
const {
  configureHttpSecurity,
  httpErrorHandler,
} = require("../../middlewares/http-security.middleware");
const docs = require("../../middlewares/documentation-access.middleware");
const release = require("../../middlewares/release-access.middleware");
let servers = [];
async function appFor(environment) {
  const app = express();
  configureHttpSecurity(app, { NODE_ENV: environment });
  app.use(express.json({ limit: "32b" }));
  app.get("/", (_req, res) => res.json({ ok: true }));
  app.post("/", (req, res) => res.json(req.body));
  app.get("/error", (_req, _res, next) =>
    next(
      Object.assign(new Error("PRIVATE_SQL_AND_STACK"), {
        code: "SYNTHETIC_IO",
      }),
    ),
  );
  app.use(httpErrorHandler);
  const server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  servers.push(server);
  return "http://127.0.0.1:" + server.address().port;
}
afterEach(async () => {
  for (const server of servers) {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
  servers = [];
  jest.restoreAllMocks();
});
test("security headers and same-origin production policy prevent development CORS exposure", async () => {
  const production = await appFor("production"),
    development = await appFor("development");
  for (const origin of ["http://localhost:4200", "https://untrusted.invalid"]) {
    const r = await fetch(production, { headers: { Origin: origin } });
    expect(r.headers.get("access-control-allow-origin")).toBeNull();
    expect(r.headers.get("x-powered-by")).toBeNull();
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(r.headers.get("x-frame-options")).toBe("DENY");
    expect(r.headers.get("x-content-type-options")).toBe("nosniff");
    expect(r.headers.get("referrer-policy")).toBe("no-referrer");
    await r.text();
  }
  for (const origin of ["http://localhost:4200", "http://127.0.0.1:4200"]) {
    const r = await fetch(development, { headers: { Origin: origin } });
    expect(r.headers.get("access-control-allow-origin")).toBe(origin);
    expect(r.headers.get("access-control-allow-credentials")).toBeNull();
    await r.text();
  }
  const r = await fetch(development);
  expect(r.headers.get("access-control-allow-origin")).toBeNull();
  await r.text();
});
test("malformed, oversized and unsupported JSON requests fail without leaking internals", async () => {
  const base = await appFor("production");
  for (const [body, type, status] of [
    ["{", "application/json", 400],
    [JSON.stringify({ payload: "x".repeat(100) }), "application/json", 413],
    ["{}", "application/json; charset=unsupported", 415],
  ]) {
    const r = await fetch(base, {
      method: "POST",
      headers: { "Content-Type": type },
      body,
    });
    expect(r.status).toBe(status);
    expect((await r.json()).error).toBeTruthy();
  }
  const log = jest.spyOn(console, "error").mockImplementation(() => {});
  const r = await fetch(base + "/error");
  expect(r.status).toBe(500);
  expect(await r.text()).not.toContain("PRIVATE_SQL_AND_STACK");
  expect(JSON.stringify(log.mock.calls)).not.toContain("PRIVATE_SQL_AND_STACK");
  const forwarded = jest.fn();
  const error = new Error("already sent");
  httpErrorHandler(error, {}, { headersSent: true }, forwarded);
  expect(forwarded).toHaveBeenCalledWith(error);
  const response = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  httpErrorHandler(new Error("private"), {}, response, jest.fn());
  expect(response.status).toHaveBeenCalledWith(500);
});
test("development-only tools trust the socket rather than spoofed forwarded addresses", () => {
  expect(docs.isDocumentationEnabled({})).toBe(true);
  expect(docs.isDocumentationEnabled({ NODE_ENV: "development" })).toBe(true);
  expect(docs.isDocumentationEnabled({ NODE_ENV: "production" })).toBe(false);
  expect(
    docs.isDocumentationEnabled({
      NODE_ENV: "development",
      DOCUMENTATION_DISABLED: "true",
    }),
  ).toBe(false);
  expect(release.isReleaseProcessEnabled("production")).toBe(false);
  expect(release.isReleaseProcessEnabled("development")).toBe(true);
  const env = { ...process.env };
  try {
    process.env.NODE_ENV = "production";
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    docs.requireLocalDocumentationAccess(
      { socket: { remoteAddress: "127.0.0.1" } },
      res,
      next,
    );
    expect(res.status).toHaveBeenLastCalledWith(404);
    expect(next).not.toHaveBeenCalled();
    process.env.NODE_ENV = "development";
    delete process.env.DOCUMENTATION_DISABLED;
    for (const middleware of [
      docs.requireLocalDocumentationAccess,
      release.requireLocalReleaseAccess,
    ]) {
      middleware(
        {
          socket: { remoteAddress: "192.0.2.1" },
          headers: { "x-forwarded-for": "127.0.0.1" },
        },
        res,
        next,
      );
      expect(res.status).toHaveBeenLastCalledWith(403);
      middleware({}, res, next);
      expect(res.status).toHaveBeenLastCalledWith(403);
      for (const remoteAddress of ["127.0.0.1", "::1", "::ffff:127.0.0.1"])
        middleware({ socket: { remoteAddress } }, res, next);
    }
    expect(next).toHaveBeenCalledTimes(6);
  } finally {
    for (const key of Object.keys(process.env))
      if (!(key in env)) delete process.env[key];
    Object.assign(process.env, env);
  }
});
