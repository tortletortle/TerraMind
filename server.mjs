import http from "node:http";
import {readFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";
import {SceneDocument} from "./scene.mjs";
import {validateToolProposal} from "./assistant.mjs";
import {ProviderError, readProviderConfig, requestScenePlan} from "./llm-provider.mjs";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const MAX_BODY_BYTES = 256 * 1024;
const STATIC_FILES = new Map([
  ["/", ["index.html", "text/html; charset=utf-8"]],
  ["/index.html", ["index.html", "text/html; charset=utf-8"]],
  ["/view.mjs", ["view.mjs", "text/javascript; charset=utf-8"]],
  ["/scene.mjs", ["scene.mjs", "text/javascript; charset=utf-8"]],
  ["/assistant.mjs", ["assistant.mjs", "text/javascript; charset=utf-8"]],
  ["/semantic-index.mjs", ["semantic-index.mjs", "text/javascript; charset=utf-8"]]
]);

class HttpError extends Error {
  constructor(status, code, message) { super(message); this.status=status; this.code=code; }
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "same-origin"
  });
  res.end(body);
}

async function readJson(req) {
  const contentType = String(req.headers["content-type"] || "").toLowerCase();
  if (!contentType.startsWith("application/json")) throw new HttpError(415, "content_type_required", "请求必须使用 application/json。");
  const chunks=[]; let size=0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new HttpError(413, "request_too_large", "请求内容超过 256 KB 限制。");
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new HttpError(400, "invalid_json", "请求 JSON 格式无效。"); }
}

function checkSameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return;
  let parsed;
  try { parsed = new URL(origin); }
  catch { throw new HttpError(403, "invalid_origin", "请求来源无效。"); }
  if (parsed.host !== req.headers.host || !["http:", "https:"].includes(parsed.protocol)) {
    throw new HttpError(403, "cross_origin_blocked", "跨来源请求已被拒绝。");
  }
}

function safeConversationContext(value, document) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const validIds = key => Array.isArray(source[key])
    ? [...new Set(source[key].filter(id => typeof id === "string" && document.get(id)))].slice(0, 100)
    : [];
  return {
    targetIds: validIds("targetIds"),
    anchorIds: validIds("anchorIds"),
    lastSummary: typeof source.lastSummary === "string" ? source.lastSummary.slice(0, 160) : null
  };
}

function createRateLimiter({limit=20, windowMs=60_000, now=Date.now}={}) {
  const buckets = new Map();
  return key => {
    const time=now(), current=buckets.get(key);
    if (!current || time-current.startedAt >= windowMs) {
      buckets.set(key,{startedAt:time,count:1}); return true;
    }
    current.count += 1;
    return current.count <= limit;
  };
}

export function createServer({
  config = readProviderConfig(), fetchImpl = globalThis.fetch, rootDir = ROOT,
  logger = console, rateLimit = createRateLimiter()
} = {}) {
  return http.createServer(async (req,res) => {
    try {
      const requestUrl = new URL(req.url || "/", "http://localhost");
      if (req.method === "GET" && requestUrl.pathname === "/api/health") {
        return sendJson(res,200,{
          ok:true,
          providerConfigured:Boolean(config.apiKey && config.model),
          model:config.model || null,
          apiMode:config.apiMode || "chat_completions",
          apiKeyConfigured:Boolean(config.apiKey)
        });
      }
      if (req.method === "POST" && requestUrl.pathname === "/api/plan") {
        checkSameOrigin(req);
        const address = req.socket.remoteAddress || "unknown";
        if (!rateLimit(address)) throw new HttpError(429,"local_rate_limit","请求过于频繁，请稍后重试。");
        const body = await readJson(req);
        if (!body || typeof body !== "object" || Array.isArray(body)) throw new HttpError(400,"invalid_payload","请求体必须是对象。");
        if (typeof body.sceneSnapshot !== "string" || body.sceneSnapshot.length > 200_000) throw new HttpError(400,"invalid_scene_snapshot","场景快照缺失或超过 200 KB。");
        let document;
        try { document = SceneDocument.restore(body.sceneSnapshot); }
        catch { throw new HttpError(400,"invalid_scene_snapshot","场景快照无效，服务端拒绝规划。"); }
        if (document.entities.length > 300) throw new HttpError(413,"scene_too_large","场景物体超过 300 个的 AI 规划上限。");
        const context = safeConversationContext(body.context,document);
        const selectedId = typeof body.selectedId === "string" && document.get(body.selectedId) ? body.selectedId : null;
        const history = Array.isArray(body.history) ? body.history.slice(-8) : [];
        const result = await requestScenePlan({
          command:body.command,
          document,
          context,
          selectedId,
          history,
          config,
          fetchImpl,
          validateProposal:validateToolProposal
        });
        return sendJson(res,200,{
          plan:result.plan,
          reply:result.reply,
          model:result.model,
          usage:result.usage
        });
      }
