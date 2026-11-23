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
      if (req.method === "GET" && STATIC_FILES.has(requestUrl.pathname)) {
        const [fileName,contentType]=STATIC_FILES.get(requestUrl.pathname);
        const content=await readFile(path.join(rootDir,fileName));
        res.writeHead(200,{
          "Content-Type":contentType,
          "Content-Length":content.length,
          "Cache-Control":"no-store",
          "X-Content-Type-Options":"nosniff",
          "Referrer-Policy":"same-origin",
          "Content-Security-Policy":"default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data: blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"
        });
        return res.end(content);
      }
      if (req.method === "OPTIONS") throw new HttpError(405,"method_not_allowed","不支持跨来源预检请求。");
      throw new HttpError(404,"not_found","资源不存在。");
    } catch (error) {
      if (res.headersSent) { res.destroy(); return; }
      const status = Number.isInteger(error.status) ? error.status : 500;
      const code = error.code || "internal_error";
      const message = error instanceof ProviderError || error instanceof HttpError
        ? error.message
        : "服务器内部错误，请查看本地服务日志。";
      if (status >= 500) logger.error?.("TerraMind request failed:",code);
      sendJson(res,status,{error:{code,message}});
    }
  });
}

function isLoopback(host) {
  return ["127.0.0.1","localhost","::1"].includes(host);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const host=process.env.HOST || "127.0.0.1";
  if (!isLoopback(host)) {
    console.error("安全限制：V0.5 开发服务器仅允许绑定 localhost/127.0.0.1/::1。公开部署需要先配置身份认证与 HTTPS 反向代理。");
    process.exit(1);
  }
  const port=Number.parseInt(process.env.PORT || "8000",10);
  if (!Number.isInteger(port) || port<1 || port>65535) {
    console.error("PORT 必须是 1–65535 之间的整数。");
    process.exit(1);
  }
  const server=createServer();
  server.listen(port,host,()=>{
    const config=readProviderConfig();
    console.log(`TerraMind V0.5 listening at http://${host}:${port}`);
    console.log(`Model provider: ${config.apiKey && config.model ? config.model : "not configured (local planner fallback only)"}`);
  });
}
