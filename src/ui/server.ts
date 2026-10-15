// A local UI for running the demos and the test matrix: `npm run ui`.
//
// Listens on 127.0.0.1 only. Because a live run sends real requests, every
// POST must be same-origin JSON (another website can't send that without a
// CORS preflight, which this server never answers), the Host header must be
// this server's (blocks DNS rebinding), and a live run must say confirmLive.
import { existsSync, readFileSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { join } from "node:path";
import { parseEnv } from "node:util";
import { cases, passed } from "../../test/cases.js";
import { catalogue } from "../catalogue.js";
import { listDemos, root, runDemo, type Mode } from "../runner.js";

const PORT = Number(process.env.UI_PORT ?? 4321);
const HOST = "127.0.0.1";
const allowedHosts = new Set([`127.0.0.1:${PORT}`, `localhost:${PORT}`]);
const page = new URL("./index.html", import.meta.url);

/** .env as the demos will see it, with shell variables winning, as in src/demo.ts. */
function settings() {
  const file = join(root, ".env");
  const fromFile = existsSync(file) ? parseEnv(readFileSync(file, "utf8")) : {};
  const get = (key: string) => process.env[key] ?? fromFile[key];
  return {
    defaultMode: (get("DELIVERD_MODE") === "development" ? "development" : "live") as Mode,
    hasKey: /^dlv[o]?_/.test(get("DELIVERD_API_KEY") ?? ""),
    approver: get("DEMO_APPROVER") ?? null,
    reportId: get("DEMO_REPORT_ID") ?? null,
  };
}

const sdkVersion: string = JSON.parse(
  readFileSync(join(root, "node_modules/@deliverd/sdk/package.json"), "utf8"),
).version;

/** The catalogue's order (simplest first), then any demo it doesn't list yet. */
function demos() {
  const onDisk = listDemos();
  const listed = catalogue.filter((demo) => onDisk.includes(demo.name));
  const unlisted = onDisk.filter((name) => !catalogue.some((demo) => demo.name === name));
  return [
    ...listed,
    ...unlisted.map((name) => ({
        name,
        title: name,
        shows: "Not in src/catalogue.ts yet.",
        dev: "yes",
        outcomes: ["approved", "rejected"],
        liveNeeds: "Unknown.",
        liveEffect: "Unknown: read the demo before running it live.",
    })),
  ];
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
  res.end(JSON.stringify(body));
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 10_000) throw new Error("Body too large.");
  }
  const parsed = JSON.parse(body || "{}");
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error("Expected an object.");
  return parsed;
}

/** Aborts when the browser goes away, so a closed tab stops its demo. */
function abortOnClose(res: ServerResponse) {
  const controller = new AbortController();
  res.on("close", () => {
    if (!res.writableFinished) controller.abort();
  });
  return controller.signal;
}

async function handleRun(req: IncomingMessage, res: ServerResponse) {
  const body = await readJson(req);
  const demo = String(body.demo ?? "");
  const mode = body.mode === "live" ? "live" : "development";
  const outcome = typeof body.outcome === "string" && /^[a-z]+$/.test(body.outcome) ? body.outcome : undefined;

  if (!listDemos().includes(demo)) return sendJson(res, 404, { error: `No demo called "${demo}".` });
  if (mode === "live") {
    // Set by the Playwright tests, so no test can ever reach a real organisation.
    if (process.env.UI_DEV_ONLY) return sendJson(res, 403, { error: "Live runs are disabled (UI_DEV_ONLY)." });
    if (body.confirmLive !== true) return sendJson(res, 400, { error: "Live runs must be confirmed." });
    if (!settings().hasKey) return sendJson(res, 400, { error: "Set DELIVERD_API_KEY in .env to run live." });
  }

  // Newline-delimited JSON: output chunks as they arrive, then the exit.
  res.writeHead(200, { "content-type": "application/x-ndjson", "cache-control": "no-store" });
  const send = (event: object) => res.write(`${JSON.stringify(event)}\n`);
  const signal = abortOnClose(res);
  const result = await runDemo(demo, {
    mode,
    outcome: mode === "development" ? outcome : undefined,
    signal,
    onOutput: (text) => send({ type: "output", text }),
  });
  send({ type: "exit", code: result.code, ms: result.ms });
  res.end();
}

async function handleTest(req: IncomingMessage, res: ServerResponse) {
  const body = await readJson(req);
  const testCase = cases[Number(body.index)];
  if (!testCase) return sendJson(res, 404, { error: "No such test case." });
  // Tests only ever run in development mode, whatever the UI's mode switch says.
  const result = await runDemo(testCase.demo, {
    mode: "development",
    outcome: testCase.outcome,
    signal: abortOnClose(res),
  });
  sendJson(res, 200, { ...result, pass: passed(testCase, result) });
}

const server = createServer(async (req, res) => {
  try {
    if (!allowedHosts.has(req.headers.host ?? "")) return sendJson(res, 403, { error: "Unexpected Host header." });
    const url = new URL(req.url ?? "/", `http://${req.headers.host}`);

    if (req.method === "GET") {
      if (url.pathname === "/") {
        res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
        return res.end(readFileSync(page));
      }
      if (url.pathname === "/api/status") return sendJson(res, 200, { ...settings(), sdkVersion });
      if (url.pathname === "/api/demos") return sendJson(res, 200, demos());
      if (url.pathname === "/api/cases") return sendJson(res, 200, cases);
    }

    if (req.method === "POST") {
      const origin = req.headers.origin;
      if (origin && !allowedHosts.has(origin.replace(/^http:\/\//, ""))) {
        return sendJson(res, 403, { error: "Cross-origin request refused." });
      }
      if (!req.headers["content-type"]?.startsWith("application/json")) {
        return sendJson(res, 415, { error: "Send JSON." });
      }
      if (url.pathname === "/api/run") return await handleRun(req, res);
      if (url.pathname === "/api/test") return await handleTest(req, res);
    }

    sendJson(res, 404, { error: "Not found." });
  } catch (error) {
    if (res.headersSent) return res.end();
    sendJson(res, 400, { error: (error as Error).message });
  }
});

server.listen(PORT, HOST, () => {
  const { defaultMode, hasKey } = settings();
  console.log(`TestDeliverd UI: http://localhost:${PORT}`);
  console.log(`.env mode: ${defaultMode}; API key ${hasKey ? "set" : "not set"}. Ctrl+C to stop.`);
});
