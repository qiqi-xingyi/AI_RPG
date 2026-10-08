import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, dirname, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { timingSafeEqual } from 'node:crypto';
import { loadEnvFile } from 'node:process';
import { catalog } from './lib/catalog.mjs';
import { GameError, newSession, publicSession, prepareAction, applyOpening, applyTurn, prepareContinuation, applyContinuation } from './lib/game.mjs';
import { createDeepSeek } from './lib/deepseek.mjs';
import { applyRpgAction, rpgCatalog } from './lib/rpg.mjs';
import { SessionStore } from './lib/store.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const publicRoot = resolve(root, 'public');
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };

function json(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(payload));
}
async function body(req) {
  if (!req.headers['content-type']?.startsWith('application/json')) throw new GameError('请求需要 JSON 格式。', 415);
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 8192) throw new GameError('请求内容过长。', 413);
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new GameError('请求内容无法解析。'); }
}
function authenticate(req, session) {
  const token = req.headers.authorization?.replace(/^Bearer /, '');
  if (!session || typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token) || !timingSafeEqual(Buffer.from(token), Buffer.from(session.token))) throw new GameError('存档不存在或访问凭据已失效。', 404);
}

export async function createApp(options = {}) {
  const apiKey = options.apiKey ?? process.env.DEEPSEEK_API_KEY ?? '';
  const model = options.model ?? process.env.DEEPSEEK_MODEL ?? 'deepseek-flash';
  const baseUrl = options.baseUrl ?? process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com';
  const ai = options.provider ?? createDeepSeek({ apiKey, model, baseUrl });
  const store = await new SessionStore(options.dataDir ?? resolve(root, 'data')).load();
  const locks = new Set();
  const limits = new Map();
  const maintenance = setInterval(() => {
    const now = Date.now();
    for (const [key, value] of limits) if (now > value.reset) limits.delete(key);
  }, 60000);
  maintenance.unref();
  const server = createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname.startsWith('/api/')) {
        if (req.method === 'POST') {
          // Browsers cannot spend a configured key from another origin.
          const origin = req.headers.origin;
          if (origin && (!['http:', 'https:'].includes(new URL(origin).protocol) || new URL(origin).host !== req.headers.host)) throw new GameError('不允许跨站请求。', 403);
          const address = req.socket.remoteAddress;
          const now = Date.now();
          const budget = limits.get(address) ?? { count: 0, reset: now + 60000 };
          if (now > budget.reset) { budget.count = 0; budget.reset = now + 60000; }
          budget.count++;
          limits.set(address, budget);
          if (budget.count > 20) { res.setHeader('Retry-After', '60'); throw new GameError('行动太快啦，请稍候再试。', 429); }
        }
        if (req.method === 'GET' && url.pathname === '/api/config') return json(res, 200, { ...catalog(), rpg: rpgCatalog(), aiAvailable: !!apiKey, model: apiKey ? model : null });
        if (req.method === 'POST' && url.pathname === '/api/sessions') {
          const input = await body(req);
          if (!apiKey) throw new GameError('AI 主持暂时不可用，请稍后再试。', 503);
          let session = newSession(input);
          session = applyOpening(session, await ai(session));
          await store.save(session);
          return json(res, 201, { session: publicSession(session), token: session.token });
        }
        const match = url.pathname.match(/^\/api\/sessions\/([a-f0-9-]{36})(\/(?:turn|continue|rpg))?$/);
        if (match) {
          const id = match[1];
          let session = store.get(id);
          authenticate(req, session);
          if (req.method === 'GET' && !match[2]) return json(res, 200, { session: publicSession(session) });
          if (req.method === 'POST' && match[2]) {
            const input = await body(req);
            session = store.get(id);
            authenticate(req, session);
            session.mode = 'deepseek';
            if (!/^[a-f0-9-]{36}$/.test(input?.requestId ?? '')) throw new GameError('请求标识不正确。');
            if (session.requestIds.includes(input.requestId)) return json(res, 200, { session: publicSession(session) });
            if (locks.has(id)) throw new GameError('主持人正在回应，请稍候。', 409);
            locks.add(id);
            try {
              if (match[2] === '/rpg') {
                const next = applyRpgAction(session, input, input.requestId, options.dice);
                await store.save(next);
                return json(res, 200, { session: publicSession(next) });
              }
              if (match[2] === '/continue') {
                const { draft, continuation } = prepareContinuation(session, input);
                if (!apiKey) throw new GameError('AI 主持暂时不可用。原有进度已保留，请稍后再试。', 503);
                const raw = await ai(draft, null, null, { continuation });
                const next = applyContinuation(session, draft, continuation, raw, input.requestId);
                await store.save(next);
                return json(res, 200, { session: publicSession(next) });
              }
              const { action, roll } = prepareAction(session, input, options.dice);
              if (!apiKey) throw new GameError('AI 主持暂时不可用。原有进度已保留，请稍后再试。', 503);
              const raw = await ai(session, action, roll);
              const next = applyTurn(session, action, roll, raw, input.requestId);
              await store.save(next);
              return json(res, 200, { session: publicSession(next) });
            } finally { locks.delete(id); }
          }
        }
        throw new GameError('接口不存在。', 404);
      }
      if (!['GET', 'HEAD'].includes(req.method)) throw new GameError('不支持这个请求。', 405);
      const path = resolve(publicRoot, `.${decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)}`);
      if (!path.startsWith(publicRoot + sep)) throw new GameError('页面不存在。', 404);
      let info;
      try { info = await stat(path); } catch { throw new GameError('页面不存在。', 404); }
      if (!info.isFile()) throw new GameError('页面不存在。', 404);
      res.writeHead(200, { 'Content-Type': MIME[extname(path)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' });
      return res.end(req.method === 'HEAD' ? undefined : await readFile(path));
    } catch (error) {
      if (res.headersSent) return res.end();
      if (error instanceof GameError) return json(res, error.status, { error: error.message });
      console.error('Request failed:', error.name);
      return json(res, 500, { error: '服务暂时无法完成请求，请稍后再试。' });
    }
  });
  server.on('close', () => clearInterval(maintenance));
  server.requestTimeout = 70000;
  return { server, store };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { loadEnvFile(resolve(root, '.env')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const port = Number(process.env.PORT ?? 3000);
  const host = process.env.HOST ?? '127.0.0.1';
  const { server } = await createApp();
  server.listen(port, host, () => console.log(`星叙已启动：http://${host}:${port} · ${process.env.DEEPSEEK_API_KEY ? 'DeepSeek 主持已就绪' : 'AI 主持尚未配置'}`));
}
