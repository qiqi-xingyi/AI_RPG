import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { catalog } from '../lib/catalog.mjs';
import { GameError, newSession, publicSession, prepareAction, applyOpening, applyTurn, prepareContinuation, applyContinuation } from '../lib/game.mjs';
import { createDeepSeek } from '../lib/deepseek.mjs';
import { applyRpgAction, rpgCatalog } from '../lib/rpg.mjs';
import { CloudStore } from './database.mjs';

const COOKIE = '__Host-storybound-trial';
const COOKIE_AGE = 7 * 86400;
const SECURITY = {
  'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin', 'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
};
function json(status, data, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: { ...SECURITY, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers } });
}
const safeEqual = (a, b) => typeof a === 'string' && typeof b === 'string' && Buffer.byteLength(a) === Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a), Buffer.from(b));
function signature(value, key) { return createHmac('sha256', key).update(value).digest('base64url'); }
function signedCookie(id, env) {
  const data = Buffer.from(JSON.stringify({ id, exp: Date.now() + COOKIE_AGE * 1000 })).toString('base64url');
  return `${COOKIE}=${data}.${signature(data, env.TRIAL_SIGNING_KEY)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${COOKIE_AGE}`;
}
function visitorOf(request, env) {
  if (!env.TRIAL_SIGNING_KEY || !env.PLAYTEST_CODE) return null;
  const value = request.headers.get('cookie')?.split(';').map(s => s.trim()).find(s => s.startsWith(COOKIE + '='))?.slice(COOKIE.length + 1);
  if (!value || value.length > 512) return null;
  const [data, mac, extra] = value.split('.');
  if (!data || !mac || extra || !safeEqual(mac, signature(data, env.TRIAL_SIGNING_KEY))) return null;
  try { const parsed = JSON.parse(Buffer.from(data, 'base64url').toString()); return /^[a-f0-9-]{36}$/.test(parsed.id) && Number.isFinite(parsed.exp) && parsed.exp > Date.now() ? parsed.id : null; }
  catch { return null; }
}
function positiveInteger(value, fallback, maximum) { const n = Number(value ?? fallback); return Number.isInteger(n) && n > 0 ? Math.min(n, maximum) : fallback; }
async function inputOf(request) {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new GameError('请求需要 JSON 格式。', 415);
  if (Number(request.headers.get('content-length')) > 8192) throw new GameError('请求内容过长。', 413);
  const reader = request.body?.getReader();
  if (!reader) throw new GameError('请求内容无法解析。');
  const parts = []; let size = 0;
  while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > 8192) { await reader.cancel(); throw new GameError('请求内容过长。', 413); } parts.push(value); }
  const buffer = new Uint8Array(size); let offset = 0; for (const p of parts) { buffer.set(p, offset); offset += p.length; }
  try { const value = JSON.parse(new TextDecoder().decode(buffer)); if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error(); return value; }
  catch { throw new GameError('请求内容无法解析。'); }
}
function authenticate(request, session) {
  const token = request.headers.get('authorization')?.replace(/^Bearer /, '');
  if (!session || !/^[a-f0-9]{64}$/.test(token ?? '') || !safeEqual(token, session.token)) throw new GameError('存档不存在或访问凭据已失效。', 404);
}
async function reserveGeneration(store, env, visitor) {
  const now = Date.now(), day = new Date(now).toISOString().slice(0, 10);
  const expires = now + 2 * 86400000;
  const personal = positiveInteger(env.PLAYTEST_USER_DAILY_LIMIT, 30, 100);
  const global = positiveInteger(env.PLAYTEST_GLOBAL_DAILY_LIMIT, 100, 1000);
  // Failed attempts still consume a reservation. Never refund a possibly paid call.
  if (!await store.consume(`ai-user:${day}:${visitor}`, personal, expires)) throw new GameError('今天的试玩次数已用完，明天可以带着存档继续。', 429);
  if (!await store.consume(`ai-global:${day}`, global, expires)) throw new GameError('今天的试玩名额已用完，明天再来继续冒险吧。', 429);
}
export function createWorker(options = {}) {
  return {
    async fetch(request, env, ctx = {}) {
      try {
        const url = new URL(request.url), path = url.pathname;
        if (path === '/health') return json(200, { ok: true });
        if (!path.startsWith('/api/')) {
          if (!['GET', 'HEAD'].includes(request.method)) throw new GameError('不支持这个请求。', 405);
          if (path.split('/').some(part => part.startsWith('.')) || path.startsWith('/data/')) throw new GameError('页面不存在。', 404);
          const response = await env.ASSETS.fetch(request);
          const headers = new Headers(response.headers); for (const [k, v] of Object.entries(SECURITY)) headers.set(k, v);
          headers.set('Cache-Control', 'no-cache');
          return new Response(response.body, { status: response.status, headers });
        }
        if (request.method === 'POST' && (request.headers.get('origin') && request.headers.get('origin') !== url.origin || request.headers.get('sec-fetch-site') === 'cross-site')) throw new GameError('不允许跨站请求。', 403);
        const visitor = visitorOf(request, env);
        if (request.method === 'GET' && path === '/api/config') {
          return json(200, { ...catalog(), rpg: rpgCatalog(), aiAvailable: !!env.DEEPSEEK_API_KEY, model: null,
            playtest: { required: true, authorized: !!visitor, dailyLimit: positiveInteger(env.PLAYTEST_USER_DAILY_LIMIT, 30, 100) } });
        }
        if (!env.DB || !env.PLAYTEST_CODE || !env.TRIAL_SIGNING_KEY) throw new GameError('试玩暂未开放，请稍后再试。', 503);
        const store = new CloudStore(env.DB);
        if (request.method === 'POST' && path === '/api/playtest/login') {
          const address = request.headers.get('cf-connecting-ip') || 'unknown';
          const ipHash = signature(address, env.TRIAL_SIGNING_KEY).slice(0, 24);
          const window = Math.floor(Date.now() / 600000);
          if (!await store.consume(`login:${ipHash}:${window}`, 10, Date.now() + 1200000)) throw new GameError('尝试太多，请十分钟后再试。', 429);
          const input = await inputOf(request);
          if (typeof input.code !== 'string' || input.code.length > 80 || !safeEqual(input.code.trim(), env.PLAYTEST_CODE)) throw new GameError('邀请码不正确，请向邀请你的朋友确认。', 403);
          return json(200, { ok: true }, { 'Set-Cookie': signedCookie(visitor || randomUUID(), env) });
        }
        if (!visitor) return json(401, { error: '请先输入试玩邀请码。', code: 'PLAYTEST_LOGIN_REQUIRED' });
        if (request.method === 'POST') {
          const minute = Math.floor(Date.now() / 60000);
          if (!await store.consume(`actions:${visitor}:${minute}`, 25, Date.now() + 120000)) throw new GameError('行动太快啦，请稍候再试。', 429);
        }
        const generate = options.provider ?? createDeepSeek({ apiKey: env.DEEPSEEK_API_KEY, model: env.DEEPSEEK_MODEL || 'deepseek-flash' });
        if (request.method === 'POST' && path === '/api/sessions') {
          const input = await inputOf(request);
          if (!env.DEEPSEEK_API_KEY) throw new GameError('AI 主持暂时不可用，请稍后再试。', 503);
          const initial = newSession(input);
          await reserveGeneration(store, env, visitor);
          const session = applyOpening(initial, await generate(initial));
          await store.create(session, visitor);
          if (ctx.waitUntil) ctx.waitUntil(store.cleanup().catch(() => {}));
          return json(201, { session: publicSession(session), token: session.token });
        }
        const match = path.match(/^\/api\/sessions\/([a-f0-9-]{36})(\/(?:turn|continue|rpg))?$/);
        if (!match) throw new GameError('接口不存在。', 404);
        const id = match[1]; let session = await store.get(id); authenticate(request, session);
        if (request.method === 'GET' && !match[2]) return json(200, { session: publicSession(session) });
        if (request.method !== 'POST' || !match[2]) throw new GameError('不支持这个请求。', 405);
        const input = await inputOf(request);
        if (!/^[a-f0-9-]{36}$/.test(input.requestId ?? '')) throw new GameError('请求标识不正确。');
        if (session.requestIds.includes(input.requestId)) return json(200, { session: publicSession(session) });
        if (!Number.isInteger(input.version) || session.version !== input.version) throw new GameError('冒险进度已更新，请刷新后继续。', 409);
        const leaseId = randomUUID();
        if (!await store.lease(id, input.version, leaseId)) {
          session = await store.get(id); authenticate(request, session);
          if (session.requestIds.includes(input.requestId)) return json(200, { session: publicSession(session) });
          throw new GameError('主持人正在回应，或冒险已更新，请稍候再试。', 409);
        }
        try {
          // Reload after taking the lease so stale input cannot overwrite a commit.
          session = await store.get(id); authenticate(request, session); session.mode = 'deepseek';
          let next;
          if (match[2] === '/rpg') next = applyRpgAction(session, input, input.requestId, options.dice);
          else {
            if (!env.DEEPSEEK_API_KEY) throw new GameError('AI 主持暂时不可用。原有进度已保留，请稍后再试。', 503);
            if (match[2] === '/continue') {
              const { draft, continuation } = prepareContinuation(session, input);
              await reserveGeneration(store, env, visitor);
              next = applyContinuation(session, draft, continuation, await generate(draft, null, null, { continuation }), input.requestId);
            } else {
              const { action, roll } = prepareAction(session, input, options.dice);
              await reserveGeneration(store, env, visitor);
              next = applyTurn(session, action, roll, await generate(session, action, roll), input.requestId);
            }
          }
          if (!await store.commit(next, leaseId)) throw new GameError('保存进度时出现冲突，请刷新后继续。', 409);
          return json(200, { session: publicSession(next) });
        } finally { await store.release(id, leaseId); }
      } catch (error) {
        if (error instanceof GameError) return json(error.status, { error: error.message });
        console.error('Playtest request failed:', error.name);
        return json(503, { error: '试玩服务暂时不可用。已保存的进度仍然保留，请稍后再试。' });
      }
    },
  };
}
export default createWorker();
