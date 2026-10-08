import { randomInt, randomUUID, randomBytes } from 'node:crypto';
import { WORLDS, ROLES, SKILLS, DIFFICULTIES, PRINCESS } from './catalog.mjs';

import { GameError } from './errors.mjs';
export { GameError } from './errors.mjs';
import { ensureRpg, validateRpgScene, applyRpgScene, gainXp } from './rpg.mjs';
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
function text(value, max, field, optional = false) {
  if (optional && (value === undefined || value === '')) return '';
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) throw new GameError(`${field}格式不正确。`);
  return value.trim();
}
export function newSession(input) {
  if (!input || typeof input !== 'object') throw new GameError('请选择冒险设置。');
  const world = WORLDS.find(w => w.id === input.worldId);
  const role = ROLES.find(r => r.id === input.roleId);
  const difficulty = DIFFICULTIES.find(d => d.id === input.difficulty);
  if (!world || !role || !difficulty) throw new GameError('主题、角色或难度不存在。');
  const name = text(input.name, 24, '角色名称');
  const wish = text(input.wish, 300, '故事偏好', true);
  const now = new Date().toISOString();
  const scene = structuredClone(world.opening);
  scene.narrative = scene.narrative.replaceAll('{{name}}', name);
  if (world.id !== 'fantasy') scene.narrative = `${name}公主，离开熟悉的王宫，你带着自己的判断走进这个世界。${PRINCESS.appearance}\n\n${scene.narrative}`;
  return ensureRpg({
    id: randomUUID(), token: randomBytes(32).toString('hex'), mode: 'deepseek', worldId: world.id, difficulty: difficulty.id, wish,
    character: { name, protagonistId: PRINCESS.id, title: PRINCESS.title, age: PRINCESS.age, appearance: PRINCESS.appearance, personality: PRINCESS.personality, portrait: PRINCESS.portrait, roleId: role.id, hp: 30, maxHp: 30, gold: 20, xp: 0, modifiers: { ...role.modifiers } },
    version: 0, scene, inventory: ['旅途行囊', '神秘来信'],
    quest: world.quest || '找到来信背后的真相', memory: [`${name}是${PRINCESS.title}，温柔、聪慧、勇敢，主动决定自己的未来。`, `${name}公主在${world.opening.location}开始冒险。`], flags: [], history: [],
    ended: false, endReason: null, episode: 1, chapterSummaries: [], createdAt: now, updatedAt: now, requestIds: [],
  });
}
export function publicSession(session) {
  const { token, requestIds, ...result } = ensureRpg(structuredClone(session));
  result.mode = 'deepseek';
  return structuredClone(result);
}
export function prepareAction(session, input, dice = () => randomInt(1, 21)) {
  session = ensureRpg(structuredClone(session));
  if (session.rpg.combat) throw new GameError('当前正在战斗，请先行动或脱身，再继续剧情。', 409);
  if (session.ended) throw new GameError('这段冒险已经完结，可以开启新的故事。', 409);
  if (!Number.isInteger(input?.version) || input.version !== session.version) throw new GameError('冒险进度已更新，请刷新后继续。', 409);
  let action;
  if (input.choiceId) {
    const choice = session.scene.choices.find(c => c.id === input.choiceId);
    if (!choice) throw new GameError('这个选择已经失效，请选择当前场景中的行动。', 409);
    action = { ...choice, custom: false };
  } else {
    const label = text(input.action, 500, '自由行动');
    if (!Object.hasOwn(SKILLS, input.skill)) throw new GameError('请选择行动使用的能力。');
    const approaches = { might: 'bold', insight: 'investigate', agility: 'explore', charm: 'social' };
    action = { id: 'custom', label, hint: '玩家的自由行动', skill: input.skill, approach: approaches[input.skill], dc: 12, custom: true };
  }
  const difficulty = DIFFICULTIES.find(d => d.id === session.difficulty);
  const natural = dice();
  if (!Number.isInteger(natural) || natural < 1 || natural > 20) throw new Error('Invalid d20 result');
  const modifier = session.character.modifiers[action.skill];
  const dc = clamp(action.dc + difficulty.dc, 5, 20);
  const total = natural + modifier;
  return { action, roll: { natural, modifier, total, dc, skill: action.skill, success: natural === 20 || (natural !== 1 && total >= dc), critical: natural === 20 ? 'success' : natural === 1 ? 'failure' : null } };
}
export function validateScene(raw, { opening = false } = {}) {
  // JSON mode guarantees JSON syntax, not a trusted game schema.
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new GameError('主持人的响应格式异常，请重试。', 502);
  try {
    if (typeof raw.ended !== 'boolean') throw new Error('ended');
    const scene = {
      title: text(raw.title, 80, '场景标题'), chapter: text(raw.chapter, 80, '章节'),
      location: text(raw.location, 80, '地点'), narrative: text(raw.narrative, 4000, '叙事'), choices: [],
    };
    if (!Array.isArray(raw.choices) || raw.choices.length > 4 || (!raw.ended && raw.choices.length < 2) || (opening && raw.ended)) throw new Error('choices');
    const ids = new Set();
    scene.choices = raw.ended ? [] : raw.choices.map((c, index) => {
      if (!c || !Object.hasOwn(SKILLS, c.skill) || !['explore', 'bold', 'investigate', 'social'].includes(c.approach) || !Number.isInteger(c.dc) || c.dc < 5 || c.dc > 18) throw new Error('choice');
      const id = `option-${index + 1}`;
      if (ids.has(id)) throw new Error('duplicate');
      ids.add(id);
      return { id, label: text(c.label, 100, '行动'), hint: text(c.hint, 160, '提示'), skill: c.skill, approach: c.approach, dc: c.dc };
    });
    const strings = (value, limit, size) => {
      if (!Array.isArray(value) || value.length > limit) throw new Error('array');
      return [...new Set(value.map(v => text(v, size, '故事记录')))];
    };
    return {
      ...validateRpgScene(raw), scene, summary: text(raw.summary, 300, '回合摘要'), quest: text(raw.quest, 180, '当前目标'),
      memory: strings(raw.memory, 32, 300), inventoryAdd: strings(raw.inventoryAdd, 3, 40), inventoryRemove: strings(raw.inventoryRemove, 3, 40), ended: raw.ended,
    };
  } catch { throw new GameError('主持人的响应不完整，进度没有改变，请重试。', 502); }
}
export function applyOpening(session, raw) {
  const output = validateScene(raw, { opening: true });
  const next = ensureRpg(structuredClone(session));
  Object.assign(next, { scene: output.scene, quest: output.quest, memory: output.memory });
  applyRpgScene(next, output, { opening: true });
  return next;
}
export function applyTurn(session, action, roll, raw, requestId) {
  const output = validateScene(raw);
  const next = ensureRpg(structuredClone(session));
  const damage = roll.success ? 0 : DIFFICULTIES.find(d => d.id === session.difficulty).damage;
  next.character.hp = clamp(next.character.hp - damage, 0, next.character.maxHp);
  gainXp(next, roll.success ? 10 : 5);
  next.storyTurns++;
  next.character.gold += roll.success ? 3 : 0;
  next.version += 1;
  next.history.push({ turn: next.version, scene: session.scene, action, roll, damage, summary: output.summary });
  next.scene = output.scene;
  next.inventory = [...new Set([...next.inventory.filter(item => !output.inventoryRemove.includes(item)), ...output.inventoryAdd])].slice(-20);
  next.quest = output.quest;
  next.memory = output.memory;
  next.flags = [...new Set([...next.flags, action.approach])];
  next.ended = output.ended || next.character.hp === 0;
  next.endReason = next.character.hp === 0 ? 'exhausted' : output.ended ? 'chapter' : null;
  if (next.character.hp === 0) {
    next.scene.narrative += '\n\n你的体力已经耗尽。同伴带你离开危险，先前的选择则留在这个世界里。这一章在此暂歇。休整之后，你仍可以带着已有的经历，继续自己的旅程。';
    next.quest = '旅程结束：暂别此地，休整归来';
  }
  if (next.ended) next.scene.choices = [];
  applyRpgScene(next, output, { roll });
  next.updatedAt = new Date().toISOString();
  next.requestIds = [...next.requestIds, requestId].slice(-50);
  return next;
}

export function prepareContinuation(session, input) {
  if (!session.ended) throw new GameError('当前章节还在进行中，可以直接输入行动改变故事方向。', 409);
  if (!Number.isInteger(input?.version) || input.version !== session.version) throw new GameError('冒险进度已更新，请刷新后继续。', 409);
  const direction = text(input.direction, 500, '下一章的方向', true);
  const draft = ensureRpg(structuredClone(session));
  const restoredHp = draft.character.maxHp - draft.character.hp;
  draft.character.hp = draft.character.maxHp;
  draft.character.mp = draft.character.maxMp;
  draft.rpg.lootGranted = 0;
  draft.mode = 'deepseek';
  draft.episode = (session.episode || 1) + 1;
  draft.ended = false;
  draft.endReason = null;
  return { draft, continuation: { previousEpisode: session.episode || 1, direction, restoredHp } };
}

export function applyContinuation(session, draft, continuation, raw, requestId) {
  const output = validateScene(raw, { opening: true });
  const next = structuredClone(draft);
  next.version = session.version + 1;
  next.scene = output.scene;
  next.quest = output.quest;
  next.memory = output.memory;
  next.chapterSummaries = [...(session.chapterSummaries || []), {
    episode: session.episode || 1,
    title: session.scene.title,
    ending: session.scene.narrative.slice(0, 1200),
  }];
  next.history.push({
    kind: 'chapter', turn: next.version, scene: structuredClone(session.scene),
    action: { id: 'continue', label: continuation.direction || '休整并开启下一章', custom: true },
    roll: null, damage: 0, restoredHp: continuation.restoredHp,
    summary: `第${next.episode}卷开始。${output.summary}`,
  });
  next.updatedAt = new Date().toISOString();
  next.requestIds = [...next.requestIds, requestId].slice(-50);
  return next;
}
