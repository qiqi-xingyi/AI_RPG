import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { WORLDS, ROLES, PRINCESS, demoTurn } from '../lib/catalog.mjs';
import { newSession, prepareAction, applyTurn, validateScene, publicSession, prepareContinuation, applyContinuation } from '../lib/game.mjs';
import { createDeepSeek } from '../lib/deepseek.mjs';

const setup = (extra = {}) => newSession({ name: '阿星', worldId: 'fantasy', roleId: 'wanderer', difficulty: 'balanced', ...extra });

test('all themes and identities create playable sessions', () => {
  for (const world of WORLDS) for (const role of ROLES) {
    const session = setup({ worldId: world.id, roleId: role.id });
    assert.equal(session.character.hp, 30);
    assert.ok(session.scene.choices.length >= 2);
    assert.equal(session.character.modifiers.insight, role.modifiers.insight);
    assert.equal(publicSession(session).token, undefined);
    assert.equal(publicSession(session).requestIds, undefined);
  }
});
test('princess identity persists across talents and turns and cannot be overridden by input', () => {
  for (const role of ROLES) {
    const session = setup({ name: '露娜', roleId: role.id, protagonistId: 'someone-else', age: 1, appearance: 'wrong', title: 'wrong' });
    assert.equal(session.character.protagonistId, PRINCESS.id);
    assert.equal(session.character.name, '露娜');
    assert.equal(session.character.age, 23);
    assert.equal(session.character.title, PRINCESS.title);
    assert.equal(session.character.appearance, PRINCESS.appearance);
    assert.ok(session.scene.narrative.includes('露娜公主'));
    assert.ok(!session.scene.narrative.includes('{{name}}'));
    const { action, roll } = prepareAction(session, { version: 0, choiceId: 'follow' }, () => 20);
    const next = applyTurn(session, action, roll, demoTurn(session, action, roll), randomUUID());
    assert.equal(next.character.protagonistId, PRINCESS.id);
    assert.equal(next.character.portrait, PRINCESS.portrait);
    assert.equal(next.character.name, '露娜');
  }
});
test('invalid creation and stale or forged actions are rejected', () => {
  assert.throws(() => setup({ name: ' ' }));
  assert.throws(() => setup({ worldId: '__proto__' }));
  assert.throws(() => setup({ wish: 'a'.repeat(301) }));
  const session = setup();
  assert.throws(() => prepareAction(session, { version: 2, choiceId: 'follow' }));
  assert.throws(() => prepareAction(session, { version: 0, choiceId: 'fake' }));
  assert.throws(() => prepareAction(session, { version: 0, action: '行动', skill: '__proto__' }));
});
test('natural 1 fails and natural 20 succeeds, difficulty changes actual DC', () => {
  const session = setup({ difficulty: 'hard' });
  const action = { version: 0, choiceId: 'follow' };
  assert.equal(prepareAction(session, action, () => 1).roll.success, false);
  assert.equal(prepareAction(session, action, () => 20).roll.success, true);
  assert.equal(prepareAction(session, action, () => 10).roll.dc, 14);
});
test('health, XP, gold and inventory are authoritative and original session is immutable', () => {
  const session = setup();
  const { action, roll } = prepareAction(session, { version: 0, choiceId: 'follow' }, () => 1);
  const raw = { ...demoTurn(session, action, roll), hp: 9999, gold: 9999 };
  const next = applyTurn(session, action, roll, raw, randomUUID());
  assert.equal(next.character.hp, 25);
  assert.equal(next.character.xp, 5);
  assert.equal(next.character.gold, 20);
  assert.equal(next.version, 1);
  assert.ok(next.inventory.includes('星纹铜钥匙'));
  assert.equal(session.version, 0);
  assert.equal(session.character.hp, 30);
});
test('malformed AI output is rejected instead of committing arbitrary state', () => {
  const session = setup();
  const { action, roll } = prepareAction(session, { version: 0, choiceId: 'follow' }, () => 20);
  const raw = demoTurn(session, action, roll);
  assert.throws(() => validateScene({ ...raw, choices: [{ skill: 'invalid' }] }));
  assert.throws(() => validateScene({ ...raw, ended: 'true' }));
  assert.throws(() => validateScene({ ...raw, memory: ['a'.repeat(301)] }));
  assert.throws(() => validateScene({ ...raw, choices: [] }));
});
test('each demo reaches a distinct ending with actual branch consequences', () => {
  const endings = new Set();
  for (const world of WORLDS) for (const skill of ['might', 'insight', 'agility', 'charm']) {
    let session = setup({ worldId: world.id });
    for (let i = 0; i < 5; i++) {
      const { action, roll } = prepareAction(session, { version: session.version, action: '我的行动', skill }, () => 20);
      session = applyTurn(session, action, roll, demoTurn(session, action, roll), randomUUID());
    }
    assert.equal(session.ended, true);
    assert.equal(session.scene.choices.length, 0);
    assert.equal(session.version, 5);
    assert.equal(session.character.gold, 35);
    assert.equal(session.flags.length, 1);
    endings.add(session.scene.narrative);
    assert.throws(() => prepareAction(session, { version: 5, action: '继续', skill }));
  }
  assert.equal(endings.size, 16);
});
test('zero health ends game and clears choices', () => {
  let session = setup({ difficulty: 'hard' });
  for (let i = 0; i < 4; i++) {
    const { action, roll } = prepareAction(session, { version: session.version, action: '冒险', skill: 'might' }, () => 1);
    session = applyTurn(session, action, roll, demoTurn(session, action, roll), randomUUID());
  }
  assert.equal(session.character.hp, 0);
  assert.equal(session.ended, true);
  assert.equal(session.scene.choices.length, 0);
});
test('DeepSeek sends server key, JSON mode and only recent history', async () => {
  let payload;
  let authorization;
  const generate = createDeepSeek({ apiKey: 'test-secret', fetchImpl: async (url, options) => {
    assert.equal(url.toString(), 'https://api.deepseek.com/chat/completions');
    payload = JSON.parse(options.body); authorization = options.headers.Authorization;
    return Response.json({ choices: [{ finish_reason: 'stop', message: { content: '{"title":"opening"}' } }] });
  } });
  await generate(setup());
  assert.equal(authorization, 'Bearer test-secret');
  assert.equal(payload.model, 'deepseek-flash');
  assert.equal(payload.response_format.type, 'json_object');
  assert.equal(payload.thinking.type, 'disabled');
  assert.ok(payload.messages[0].content.includes('JSON'));
  const context = JSON.parse(payload.messages[1].content);
  assert.equal(context.playerPreference, '由主持人安排');
  assert.equal(context.character.protagonistId, PRINCESS.id);
  assert.equal(context.character.title, PRINCESS.title);
  assert.equal(context.character.appearance, PRINCESS.appearance);
});
test('DeepSeek failures are explicit, and no truncated content is accepted', async () => {
  for (const status of [401, 402, 429, 500]) {
    const generate = createDeepSeek({ apiKey: 'key', fetchImpl: async () => new Response('{}', { status }) });
    await assert.rejects(generate(setup()), error => error.status >= 500);
  }
  const generate = createDeepSeek({ apiKey: 'key', fetchImpl: async () => Response.json({ choices: [{ finish_reason: 'length', message: { content: '{}' } }] }) });
  await assert.rejects(generate(setup()), /响应不完整/);
});

function ongoingScene(session, extra = {}) {
  return { ...session.scene, summary: '旅程继续，先前的经历仍然有效。', quest: session.quest, memory: session.memory,
    inventoryAdd: [], inventoryRemove: [], ended: false, ...extra };
}

test('AI stories remain playable beyond 30 turns', () => {
  let session = { ...setup(), mode: 'deepseek' };
  for (let i = 0; i < 40; i++) {
    const { action, roll } = prepareAction(session, { version: session.version, action: '和同伴讨论新的旅程', skill: 'charm' }, () => 20);
    session = applyTurn(session, action, roll, ongoingScene(session), randomUUID());
  }
  assert.equal(session.version, 40);
  assert.equal(session.ended, false);
  assert.equal(session.endReason, null);
  assert.ok(session.scene.choices.length >= 2);
});

test('next chapter preserves the campaign and restores only health after rest', () => {
  const session = { ...setup(), ended: true, endReason: 'exhausted', version: 5 };
  session.character.hp = 0;
  session.character.xp = 65;
  session.character.gold = 41;
  session.inventory.push('星纹铜钥匙');
  session.memory.push('莉亚已成为公主信任的同伴。');
  const before = structuredClone(session);
  const { draft, continuation } = prepareContinuation(session, { version: 5, direction: '和莉亚去邻国看海' });
  const next = applyContinuation(session, draft, continuation, ongoingScene(draft), randomUUID());
  assert.deepEqual(session, before);
  assert.equal(next.id, session.id);
  assert.equal(next.token, session.token);
  assert.equal(next.mode, 'deepseek');
  assert.equal(next.episode, 2);
  assert.equal(next.version, 6);
  assert.equal(next.ended, false);
  assert.equal(next.character.hp, 30);
  assert.equal(next.character.xp, 65);
  assert.equal(next.character.gold, 41);
  assert.equal(next.character.protagonistId, PRINCESS.id);
  assert.deepEqual(next.inventory, session.inventory);
  assert.ok(next.memory.includes('莉亚已成为公主信任的同伴。'));
  assert.equal(next.history.at(-1).roll, null);
  assert.equal(next.history.at(-1).restoredHp, 30);
  assert.equal(next.history.at(-1).scene.narrative, session.scene.narrative);
  assert.equal(next.chapterSummaries[0].ending, session.scene.narrative.slice(0, 1200));
});

test('continuation rejects stale versions, overlong directions and premature endings', () => {
  const session = setup();
  assert.throws(() => prepareContinuation(session, { version: 0 }), /还在进行/);
  session.ended = true;
  assert.throws(() => prepareContinuation(session, { version: 1 }), /进度已更新/);
  assert.throws(() => prepareContinuation(session, { version: 0, direction: 'a'.repeat(501) }));
  const { draft, continuation } = prepareContinuation(session, { version: 0 });
  assert.throws(() => applyContinuation(session, draft, continuation, ongoingScene(draft, { ended: true, choices: [] }), randomUUID()));
  assert.equal(session.ended, true);
  assert.equal(session.version, 0);
});

test('DeepSeek continuation receives previous ending, direction and accumulated memory', async () => {
  const session = { ...setup(), mode: 'deepseek', version: 35, ended: true };
  session.chapterSummaries = [{ episode: 1, title: '找回王冠', ending: '公主找回了王冠。' }];
  session.memory.push('莉亚承诺与公主同行。');
  const { draft, continuation } = prepareContinuation(session, { version: 35, direction: '和莉亚参加邻国舞会' });
  let payload;
  const generate = createDeepSeek({ apiKey: 'fake', fetchImpl: async (url, options) => {
    payload = JSON.parse(options.body);
    return Response.json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(ongoingScene(draft)) } }] });
  } });
  await generate(draft, null, null, { continuation });
  const context = JSON.parse(payload.messages[1].content);
  assert.equal(context.task, '延续上一章的经历，生成下一章开场');
  assert.equal(context.continuation.direction, '和莉亚参加邻国舞会');
  assert.equal(context.currentScene.narrative, session.scene.narrative);
  assert.ok(context.memory.includes('莉亚承诺与公主同行。'));
  assert.equal(context.chapterSummaries[0].ending, '公主找回了王冠。');
  assert.equal(context.mustConclude, false);
});
