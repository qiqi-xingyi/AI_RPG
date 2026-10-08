import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { request as httpRequest } from 'node:http';
import { createApp } from '../server.mjs';
import { newSession } from '../lib/game.mjs';
import { SessionStore } from '../lib/store.mjs';
import { demoTurn, WORLDS } from '../lib/catalog.mjs';

async function fixture(t, options = {}) {
  const dataDir = await mkdtemp(join(tmpdir(), 'storybound-test-'));
  const { server, store } = await createApp({ dataDir, apiKey: 'test-key', dice: () => 20, provider: async (s, action, roll) => action ? demoTurn(s, action, roll) : generatedScene(s), ...options });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => { await new Promise(resolve => server.close(resolve)); await rm(dataDir, { recursive: true, force: true }); });
  const request = async (path, { data, token, headers = {} } = {}) => {
    const response = await fetch(url + path, { method: data === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers }, ...(data !== undefined ? { body: JSON.stringify(data) } : {}) });
    return { status: response.status, body: await response.json() };
  };
  const create = (extra = {}) => request('/api/sessions', { data: { name: '测试旅人', worldId: 'fantasy', roleId: 'wanderer', difficulty: 'balanced', ...extra } });
  return { request, create, dataDir, store, url, server };
}

test('HTTP create, resume, durable save and idempotent turn', async t => {
  const f = await fixture(t);
  const config = await f.request('/api/config');
  assert.equal(config.body.aiAvailable, true);
  assert.equal(config.body.worlds.length, 4);
  const created = await f.create();
  assert.equal(created.status, 201);
  const { session, token } = created.body;
  assert.equal(session.token, undefined);
  assert.equal((await f.request(`/api/sessions/${session.id}`)).status, 404);
  assert.equal((await f.request(`/api/sessions/${session.id}`, { token: 'é'.repeat(64) })).status, 404);
  const data = { version: 0, choiceId: 'option-1', requestId: randomUUID() };
  const one = await f.request(`/api/sessions/${session.id}/turn`, { data, token });
  assert.equal(one.status, 200);
  assert.equal(one.body.session.version, 1);
  const again = await f.request(`/api/sessions/${session.id}/turn`, { data, token });
  assert.equal(again.status, 200);
  assert.equal(again.body.session.version, 1);
  const stale = await f.request(`/api/sessions/${session.id}/turn`, { data: { ...data, requestId: randomUUID() }, token });
  assert.equal(stale.status, 409);
  const reloaded = await new SessionStore(f.dataDir).load();
  assert.equal(reloaded.get(session.id).version, 1);
  assert.equal(reloaded.get(session.id).token, token);
});
test('server rejects bad configuration, body size and cross-origin requests', async t => {
  const f = await fixture(t);
  assert.equal((await f.create({ worldId: 'missing' })).status, 400);
  const unavailable = await fixture(t, { apiKey: '' });
  assert.equal((await unavailable.create()).status, 503);
  assert.equal((await unavailable.create({ mode: 'demo' })).status, 503);
  assert.equal((await f.create({ wish: 'x'.repeat(9000) })).status, 413);
  const cross = await f.request('/api/sessions', { data: {}, headers: { Origin: 'https://other.example' } });
  assert.equal(cross.status, 403);
  const asset = await fetch(f.url + '/assets/fantasy.svg');
  assert.equal(asset.status, 200);
  assert.match(asset.headers.get('content-type'), /image\/svg/);
  assert.ok(asset.headers.get('content-security-policy').includes("script-src 'self'"));
  const secret = await fetch(f.url + '/.env');
  assert.equal(secret.status, 404);
});
test('failed AI response leaves the previous turn and character intact', async t => {
  let fail = false;
  const f = await fixture(t, { apiKey: 'fake-key', provider: async (s, action, roll) => {
    if (!action) return { ...s.scene, summary: '故事开始', quest: s.quest, memory: s.memory, inventoryAdd: [], inventoryRemove: [], ended: false };
    if (fail) return { title: 'invalid' };
    return demoTurn(s, action, roll);
  } });
  const { session, token } = (await f.create({ mode: 'deepseek' })).body;
  fail = true;
  const response = await f.request(`/api/sessions/${session.id}/turn`, { data: { version: 0, choiceId: 'option-1', requestId: randomUUID() }, token });
  assert.equal(response.status, 502);
  const saved = (await f.request(`/api/sessions/${session.id}`, { token })).body.session;
  assert.equal(saved.version, 0);
  assert.equal(saved.character.hp, 30);
  assert.equal(saved.history.length, 0);
});
test('concurrent turns cannot commit twice', async t => {
  let release;
  let signal;
  const started = new Promise(resolve => { signal = resolve; });
  const blocked = new Promise(resolve => { release = resolve; });
  const f = await fixture(t, { apiKey: 'fake-key', provider: async (s, action, roll) => {
    if (!action) return { ...s.scene, summary: '开局', quest: s.quest, memory: s.memory, inventoryAdd: [], inventoryRemove: [], ended: false };
    signal(); await blocked; return demoTurn(s, action, roll);
  } });
  const { session, token } = (await f.create({ mode: 'deepseek' })).body;
  const first = f.request(`/api/sessions/${session.id}/turn`, { data: { version: 0, choiceId: 'option-1', requestId: randomUUID() }, token });
  await started;
  const second = await f.request(`/api/sessions/${session.id}/turn`, { data: { version: 0, choiceId: 'option-2', requestId: randomUUID() }, token });
  release();
  assert.equal(second.status, 409);
  assert.equal((await first).body.session.version, 1);
  assert.equal(f.store.get(session.id).history.length, 1);
});

test('a slow request body cannot overwrite a newly committed turn', async t => {
  const f = await fixture(t);
  const { session, token } = (await f.create()).body;
  const payload = JSON.stringify({ version: 0, choiceId: 'option-2', requestId: randomUUID() });
  const accepted = new Promise(resolve => f.server.once('request', resolve));
  let delayed;
  const finished = new Promise((resolve, reject) => {
    delayed = httpRequest(f.url + `/api/sessions/${session.id}/turn`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'Content-Length': Buffer.byteLength(payload) } }, response => {
      response.resume();
      response.on('end', () => resolve(response.statusCode));
    });
    delayed.on('error', reject);
  });
  delayed.write(payload.slice(0, 5));
  await accepted;
  const committed = await f.request(`/api/sessions/${session.id}/turn`, { data: { version: 0, choiceId: 'option-1', requestId: randomUUID() }, token });
  delayed.end(payload.slice(5));
  assert.equal(committed.status, 200);
  assert.equal(await finished, 409);
  assert.equal(f.store.get(session.id).history[0].action.id, 'option-1');
});

function generatedScene(session, extra = {}) {
  return { ...session.scene, choices: session.scene.choices.length ? session.scene.choices : WORLDS.find(w => w.id === session.worldId).opening.choices, summary: '验收用模拟主持回应', quest: session.quest, memory: session.memory,
    inventoryAdd: [], inventoryRemove: [], ended: false, ...extra };
}

test('HTTP chapter continuation is durable, preserves progress and is idempotent', async t => {
  let calls = 0;
  let captured;
  const f = await fixture(t, { apiKey: 'test-key', dice: () => 1, provider: async (s, action, roll, options = {}) => {
    calls++;
    if (options.continuation) { captured = { session: s, continuation: options.continuation }; return generatedScene(s); }
    return action ? generatedScene(s, { ended: true, choices: [], narrative: '公主与莉亚建立了盟约，这一章自然结束。' }) : generatedScene(s);
  } });
  const { session, token } = (await f.create({ mode: 'deepseek' })).body;
  const end = await f.request(`/api/sessions/${session.id}/turn`, { token, data: { version: 0, choiceId: 'option-1', requestId: randomUUID() } });
  assert.equal(end.body.session.ended, true);
  assert.equal(end.body.session.character.hp, 25);
  const data = { version: 1, direction: '和莉亚去邻国看海', requestId: randomUUID() };
  const result = await f.request(`/api/sessions/${session.id}/continue`, { token, data });
  assert.equal(result.status, 200);
  assert.equal(result.body.session.id, session.id);
  assert.equal(result.body.session.ended, false);
  assert.equal(result.body.session.episode, 2);
  assert.equal(result.body.session.version, 2);
  assert.equal(result.body.session.character.hp, 30);
  assert.equal(result.body.session.character.xp, 5);
  assert.equal(result.body.session.character.gold, 20);
  assert.deepEqual(result.body.session.inventory, end.body.session.inventory);
  assert.equal(captured.continuation.direction, data.direction);
  assert.equal(captured.session.scene.narrative, end.body.session.scene.narrative);
  assert.equal((await f.request(`/api/sessions/${session.id}/continue`, { token, data })).body.session.version, 2);
  assert.equal(calls, 3);
  assert.equal((await new SessionStore(f.dataDir).load()).get(session.id).episode, 2);
});

test('failed chapter generation does not heal, reset or replace the existing save', async t => {
  const f = await fixture(t, { apiKey: 'test-key', dice: () => 1, provider: async (s, action, roll, options = {}) => {
    if (options.continuation) return { title: 'invalid' };
    return action ? generatedScene(s, { ended: true, choices: [] }) : generatedScene(s);
  } });
  const { session, token } = (await f.create({ mode: 'deepseek' })).body;
  const end = await f.request(`/api/sessions/${session.id}/turn`, { token, data: { version: 0, choiceId: 'option-1', requestId: randomUUID() } });
  const failed = await f.request(`/api/sessions/${session.id}/continue`, { token, data: { version: 1, requestId: randomUUID() } });
  assert.equal(failed.status, 502);
  assert.deepEqual((await f.request(`/api/sessions/${session.id}`, { token })).body.session, end.body.session);
});

test('a finished legacy save requires AI for continuation and stays intact when unavailable', async t => {
  const f = await fixture(t, { apiKey: '' });
  const legacy = newSession({ name: '旧存档公主', worldId: 'fantasy', roleId: 'wanderer', difficulty: 'balanced' });
  legacy.mode = 'demo'; legacy.ended = true; legacy.endReason = 'chapter'; legacy.version = 5;
  legacy.scene.choices = [];
  await f.store.save(legacy);
  const before = f.store.get(legacy.id);
  const response = await f.request(`/api/sessions/${legacy.id}/continue`, { token: legacy.token, data: { version: 5, requestId: randomUUID() } });
  assert.equal(response.status, 503);
  assert.deepEqual(f.store.get(legacy.id), before);
});

test('RPG mutations are authenticated, durable, versioned and idempotent, including consumed items', async t => {
  const f = await fixture(t);
  const { session, token } = (await f.create()).body;
  const data = { version: 0, type: 'buy', itemId: 'potion', requestId: randomUUID(), price: 0 };
  assert.equal((await f.request(`/api/sessions/${session.id}/rpg`, { data })).status, 404);
  const first = await f.request(`/api/sessions/${session.id}/rpg`, { token, data });
  assert.equal(first.status, 200); assert.equal(first.body.session.character.gold, 10); assert.equal(first.body.session.rpg.bag.potion, 4);
  const repeat = await f.request(`/api/sessions/${session.id}/rpg`, { token, data });
  assert.equal(repeat.body.session.character.gold, 10); assert.equal(repeat.body.session.version, 1);
  const stale = await f.request(`/api/sessions/${session.id}/rpg`, { token, data: { ...data, requestId: randomUUID() } });
  assert.equal(stale.status, 409);
  const reloaded = (await new SessionStore(f.dataDir).load()).get(session.id);
  assert.equal(reloaded.rpg.bag.potion, 4); assert.equal(reloaded.character.gold, 10);
  const fail = await f.request(`/api/sessions/${session.id}/rpg`, { token, data: { version: 1, type: 'buy', itemId: 'starblade', requestId: randomUUID() } });
  assert.equal(fail.status, 400); assert.equal(f.store.get(session.id).version, 1);
});


test('creation always invokes AI without a mode parameter and cannot be switched by clients', async t => {
  let openings = 0;
  const f = await fixture(t, { provider: async s => { openings++; return generatedScene(s, {title:'AI 生成的新开场'}); } });
  for (const extra of [{}, {mode:'demo'}, {mode:'anything',model:'client-model'}]) {
    const response = await f.create(extra);
    assert.equal(response.status,201);
    assert.equal(response.body.session.mode,'deepseek');
    assert.equal(response.body.session.scene.title,'AI 生成的新开场');
  }
  assert.equal(openings,3);
});

test('legacy demo saves keep progress and use AI on their next story action', async t => {
  let received;
  const f = await fixture(t, { provider: async (s, action) => {
    received = {mode:s.mode,xp:s.character.xp,gold:s.character.gold,inventory:s.inventory,history:s.history,action:action.label};
    return generatedScene(s,{title:'AI 接续旧旅程'});
  } });
  const legacy = newSession({name:'旧存档公主',worldId:'fantasy',roleId:'wanderer',difficulty:'balanced'});
  legacy.mode='demo'; legacy.version=7; legacy.storyTurns=2; legacy.character.xp=20; legacy.character.gold=31;
  legacy.inventory.push('母后的信笺');
  legacy.memory.push('莉亚是公主信任的同伴。');
  legacy.history.push({turn:7,scene:structuredClone(legacy.scene),action:{label:'与莉亚建立信任'},roll:null,damage:0,summary:'莉亚愿意同行。'});
  await f.store.save(legacy);
  const resume = await f.request(`/api/sessions/${legacy.id}`,{token:legacy.token});
  assert.equal(resume.body.session.mode,'deepseek');
  assert.equal(resume.body.session.version,7);
  assert.deepEqual(resume.body.session.inventory,legacy.inventory);
  const result = await f.request(`/api/sessions/${legacy.id}/turn`,{token:legacy.token,data:{version:7,action:'和莉亚前往海边',skill:'charm',mode:'demo',requestId:randomUUID()}});
  assert.equal(result.status,200);
  assert.equal(received.mode,'deepseek'); assert.equal(received.xp,20); assert.equal(received.gold,31);
  assert.deepEqual(received.inventory,legacy.inventory); assert.deepEqual(received.history,legacy.history);
  assert.equal(result.body.session.scene.title,'AI 接续旧旅程'); assert.equal(result.body.session.version,8);
  assert.equal(f.store.get(legacy.id).mode,'deepseek');
});

test('AI unavailability never falls back to a legacy demo or advances its save', async t => {
  let called = false;
  const f = await fixture(t,{apiKey:'',provider:async()=>{called=true;throw new Error('Should not call');}});
  const legacy = newSession({name:'旧存档公主',worldId:'fantasy',roleId:'wanderer',difficulty:'balanced'});
  legacy.mode='demo'; await f.store.save(legacy);
  const before=f.store.get(legacy.id);
  const result=await f.request(`/api/sessions/${legacy.id}/turn`,{token:legacy.token,data:{version:0,action:'继续旅途',skill:'insight',requestId:randomUUID()}});
  assert.equal(result.status,503); assert.equal(called,false); assert.deepEqual(f.store.get(legacy.id),before);
});
