import { randomInt } from 'node:crypto';
import { GameError } from './errors.mjs';
import { ROLES } from './catalog.mjs';

export const ITEMS = [
  { id: 'potion', name: '玫瑰生命药剂', kind: 'consumable', icon: 'leaf', price: 10, heal: 18, description: '恢复 18 生命。战斗中使用会消耗一个回合。' },
  { id: 'ether', name: '月露魔力药剂', kind: 'consumable', icon: 'moon', price: 12, mana: 8, description: '恢复 8 魔力。战斗中使用会消耗一个回合。' },
  { id: 'apple', name: '蜜糖苹果', kind: 'consumable', icon: 'leaf', price: 4, heal: 8, description: '恢复 8 生命。' },
  { id: 'moonblade', name: '月银细剑', kind: 'equipment', slot: 'weapon', icon: 'sword', price: 28, attack: 2, modifiers: { might: 1 }, description: '攻击 +2，力量 +1。便于携带的轻巧细剑。' },
  { id: 'royalstaff', name: '星纹法杖', kind: 'equipment', slot: 'weapon', icon: 'spark', price: 32, attack: 1, modifiers: { insight: 2 }, description: '攻击 +1，洞察 +2，提升星辉术威力。' },
  { id: 'cloak', name: '旅人斗篷', kind: 'equipment', slot: 'armor', icon: 'shield', price: 24, defense: 2, modifiers: { agility: 1 }, description: '防御 +2，敏捷 +1，减少战斗伤害。' },
  { id: 'moonrobe', name: '月织护衣', kind: 'equipment', slot: 'armor', icon: 'shield', price: 36, defense: 3, modifiers: { insight: 1 }, description: '防御 +3，洞察 +1。月光丝线织成的防护衣。' },
  { id: 'mooncharm', name: '蔷薇月石坠', kind: 'equipment', slot: 'accessory', icon: 'crown', price: 30, modifiers: { charm: 2 }, description: '魅力 +2，让真诚的话语更有力量。' },
  { id: 'starblade', name: '辉星之剑', kind: 'equipment', slot: 'weapon', icon: 'sword', price: 70, attack: 4, modifiers: { might: 2, agility: 1 }, description: '攻击 +4，力量 +2，敏捷 +1。可用月银细剑与星尘锻造。' },
  { id: 'herb', name: '银叶草', kind: 'material', icon: 'leaf', price: 5, description: '可用于调制生命药剂。' },
  { id: 'stardust', name: '星尘', kind: 'material', icon: 'star', price: 8, description: '可用于锻造辉星之剑。' },
];
export const ENEMIES = [
  { id: 'shadow', name: '迷途影灵', hp: 20, attack: 5, dc: 10, xp: 20, gold: 12, loot: 'stardust', description: '残余魔力凝成的影子，行动缓慢。' },
  { id: 'wolf', name: '荆棘幻狼', hp: 24, attack: 6, dc: 11, xp: 25, gold: 14, loot: 'herb', description: '守护林间小径的幻兽，擅长突袭。' },
  { id: 'sentinel', name: '失落守卫', hp: 32, attack: 7, dc: 12, xp: 35, gold: 20, loot: 'stardust', description: '被旧日誓约束缚的守卫，坚韧而谨慎。' },
  { id: 'bandit', name: '蒙面拦路者', hp: 26, attack: 6, dc: 11, xp: 25, gold: 16, loot: 'potion', description: '挡住去路的对手，可以交战，也可以尝试逃离。' },
];
export const ABILITIES = [
  { id: 'attack', name: '轻剑攻击', cost: 0, icon: 'sword', description: '使用力量或敏捷较高的一项检定。命中造成物理伤害。' },
  { id: 'spark', name: '星辉术', cost: 3, icon: 'spark', description: '消耗 3 魔力，以洞察检定，造成魔法伤害。' },
  { id: 'heal', name: '月光祝福', cost: 4, icon: 'moon', description: '消耗 4 魔力，恢复 12 + 等级×2 生命，对手仍会反击。' },
  { id: 'guard', name: '守护姿态', cost: 0, icon: 'shield', description: '本回合承受伤害减半，并恢复 2 魔力。' },
  { id: 'flee', name: '灵巧脱身', cost: 0, icon: 'wind', description: '通过敏捷检定逃离。失败时对手会反击。' },
];
export const RECIPES = [
  { id: 'brew', name: '调制生命药剂', result: 'potion', materials: { herb: 2 }, gold: 0 },
  { id: 'forge', name: '锻造辉星之剑', result: 'starblade', materials: { moonblade: 1, stardust: 3 }, gold: 15 },
];
export const SLOTS = { weapon: '武器', armor: '防具', accessory: '饰品' };
const itemOf = id => ITEMS.find(item => item.id === id);
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const emptyTalents = () => ({ might: 0, insight: 0, agility: 0, charm: 0 });
const starterQuests = () => [
  { id: 'explorer', name: '勇敢的第一步', description: '成功完成 3 次故事行动。', goal: 3, progress: 0, claimed: false, reward: { xp: 15, gold: 10, item: 'herb' } },
  { id: 'victor', name: '守护自己的光', description: '赢得 1 场正式战斗。', goal: 1, progress: 0, claimed: false, reward: { xp: 20, gold: 12, item: 'potion' } },
  { id: 'diplomat', name: '真诚的交涉', description: '成功完成 2 次魅力行动。', goal: 2, progress: 0, claimed: false, reward: { xp: 15, gold: 10, item: 'mooncharm' } },
];
export function rpgCatalog() { return { items: ITEMS, enemies: ENEMIES, abilities: ABILITIES, recipes: RECIPES, slots: SLOTS }; }

// Migration is in memory; the next successful mutation persists it with the save.
export function ensureRpg(session) {
  session.language ??= 'zh';
  if (!session.rpg) {
    const level = Math.floor(session.character.xp / 50) + 1;
    session.character.baseModifiers = { ...session.character.modifiers };
    session.character.level = level;
    session.character.maxHp = Math.max(session.character.maxHp, 30 + (level - 1) * 6);
    session.character.maxMp = 12 + (level - 1) * 2;
    session.character.mp = session.character.maxMp;
    session.rpg = {
      bag: { moonblade: 1, cloak: 1, potion: 3, ether: 2, herb: 2, stardust: 1 },
      equipment: { weapon: null, armor: null, accessory: null }, talents: emptyTalents(), skillPoints: level - 1,
      combat: null, lastCombat: null, log: [], quests: starterQuests(), lootGranted: 0,
    };
  }
  session.storyTurns ??= session.history.filter(h => !h.kind || h.kind === 'story').length;
  refreshStats(session);
  return session;
}
export function refreshStats(session) {
  const c = session.character;
  c.baseModifiers ??= { ...ROLES.find(r => r.id === c.roleId).modifiers };
  c.modifiers = { ...c.baseModifiers };
  let attack = 0, defense = 0;
  for (const [key, value] of Object.entries(session.rpg.talents)) c.modifiers[key] += value;
  for (const id of Object.values(session.rpg.equipment)) {
    const item = itemOf(id);
    if (!item) continue;
    attack += item.attack || 0;
    defense += item.defense || 0;
    for (const [key, value] of Object.entries(item.modifiers || {})) c.modifiers[key] += value;
  }
  c.attack = 4 + c.level + Math.max(c.modifiers.might, c.modifiers.agility) + attack;
  c.magic = 5 + c.level + c.modifiers.insight;
  c.defense = defense;
}
function addItem(session, id, amount = 1) {
  if (!itemOf(id)) throw new GameError('这个物品不存在。');
  if ((session.rpg.bag[id] || 0) + amount > 99) throw new GameError('这个物品已经装满了。');
  session.rpg.bag[id] = (session.rpg.bag[id] || 0) + amount;
}
function awardItem(session, id) {
  if ((session.rpg.bag[id] || 0) >= 99) {
    logEvent(session, `${itemOf(id).name}已装满，本次未收下。`);
    return false;
  }
  addItem(session, id);
  return true;
}
function removeItem(session, id, amount = 1) {
  if (!Number.isInteger(amount) || amount < 1 || (session.rpg.bag[id] || 0) < amount) throw new GameError('行囊中没有足够的物品。');
  if (Object.values(session.rpg.equipment).includes(id) && session.rpg.bag[id] - amount < 1) throw new GameError('请先卸下这件装备。');
  session.rpg.bag[id] -= amount;
  if (session.rpg.bag[id] === 0) delete session.rpg.bag[id];
}
function logEvent(session, message) {
  session.rpg.log = [...session.rpg.log, { at: new Date().toISOString(), message }].slice(-25);
}
export function gainXp(session, amount) {
  session.character.xp += amount;
  const level = Math.floor(session.character.xp / 50) + 1;
  const gained = level - session.character.level;
  if (gained > 0) {
    session.character.level = level;
    session.character.maxHp += 6 * gained;
    if (session.character.hp > 0) session.character.hp += 6 * gained;
    session.character.maxMp += 2 * gained;
    session.character.mp += 2 * gained;
    session.rpg.skillPoints += gained;
    logEvent(session, `升至 ${level} 级！生命上限 +${gained * 6}，魔力上限 +${gained * 2}，获得 ${gained} 天赋点。`);
  }
  refreshStats(session);
}
function updateQuest(session, id, amount = 1) {
  const quest = session.rpg.quests.find(q => q.id === id);
  quest.progress = Math.min(quest.goal, quest.progress + amount);
}
export function validateRpgScene(raw) {
  const loot = raw.loot ?? [];
  if (!Array.isArray(loot) || loot.length > 2 || loot.some(id => typeof id !== 'string' || !itemOf(id) || id === 'starblade')) throw new Error('loot');
  const encounter = raw.encounter ?? null;
  if (encounter !== null && (typeof encounter !== 'object' || Array.isArray(encounter) || !ENEMIES.some(e => e.id === encounter.enemyId) || typeof encounter.name !== 'string' || !encounter.name.trim() || encounter.name.length > 24)) throw new Error('encounter');
  return { loot: [...new Set(loot)], encounter: encounter && { enemyId: encounter.enemyId, name: encounter.name.trim() } };
}
export function beginCombat(session, encounter, { trial = false } = {}) {
  if (session.rpg.combat) throw new GameError('先完成当前战斗。', 409);
  const enemy = ENEMIES.find(e => e.id === encounter.enemyId);
  const level = session.character.level;
  const maxHp = enemy.hp + (level - 1) * 4;
  session.rpg.combat = { enemyId: enemy.id, name: encounter.name, hp: maxHp, maxHp, attack: enemy.attack + level - 1, dc: Math.min(17, enemy.dc + Math.floor((level - 1) / 2)), round: 0, trial, log: [`${encounter.name}出现在你面前。`] };
  logEvent(session, `遭遇${encounter.name}。`);
}
export function applyRpgScene(session, output, { opening = false, roll = null } = {}) {
  if (roll?.success) {
    updateQuest(session, 'explorer');
    if (roll.skill === 'charm') updateQuest(session, 'diplomat');
    const remaining = Math.max(0, 3 - session.rpg.lootGranted);
    for (const id of output.loot.slice(0, remaining)) {
      if (awardItem(session, id)) {
        session.rpg.lootGranted++;
        logEvent(session, `获得${itemOf(id).name}。`);
      }
    }
  }
  if (!opening && output.encounter && !session.ended && session.character.hp > 0) beginCombat(session, output.encounter);
}
function rollCheck(session, skill, dc, dice) {
  const natural = dice();
  if (!Number.isInteger(natural) || natural < 1 || natural > 20) throw new Error('Invalid d20 result');
  const modifier = session.character.modifiers[skill];
  return { natural, modifier, total: natural + modifier, dc, skill, success: natural === 20 || (natural !== 1 && natural + modifier >= dc), critical: natural === 20 ? 'success' : natural === 1 ? 'failure' : null };
}
function finishCombat(session, outcome) {
  const battle = session.rpg.combat;
  session.rpg.lastCombat = { name: battle.name, enemyId: battle.enemyId, outcome, round: battle.round, log: [...battle.log] };
  if (outcome === 'victory') {
    const enemy = ENEMIES.find(e => e.id === battle.enemyId);
    const xp = battle.trial ? 8 : enemy.xp;
    const gold = battle.trial ? 0 : enemy.gold;
    gainXp(session, xp);
    session.character.gold += gold;
    const receivedLoot = !battle.trial && awardItem(session, enemy.loot);
    if (!battle.trial) updateQuest(session, 'victor');
    logEvent(session, `${battle.name}已被击退。经验 +${xp}${gold ? `，金币 +${gold}${receivedLoot ? `，获得${itemOf(enemy.loot).name}` : ''}` : ''}。`);
  } else logEvent(session, outcome === 'escaped' ? `你成功脱离了与${battle.name}的战斗。` : `你在与${battle.name}的战斗中耗尽体力，这一章暂歇。`);
  session.memory = [...session.memory, `与${battle.name}的战斗结果：${{ victory: '胜利', escaped: '脱身', defeated: '体力耗尽' }[outcome]}。`].slice(-32);
  session.rpg.combat = null;
}
function enemyTurn(session, guarded = false) {
  const c = session.character, battle = session.rpg.combat;
  const difficulty = { story: -2, balanced: 0, hard: 2 }[session.difficulty];
  let damage = Math.max(1, battle.attack + difficulty - c.defense);
  if (guarded) damage = Math.max(1, Math.floor(damage / 2));
  c.hp = Math.max(0, c.hp - damage);
  battle.log.push(`${battle.name}反击，你损失 ${damage} 生命。`);
  if (c.hp === 0) {
    finishCombat(session, 'defeated');
    session.ended = true; session.endReason = 'exhausted';
    session.scene.choices = [];
    session.scene.narrative += '\n\n你的体力在战斗中耗尽，同伴带你撤到安全处。这一章暂歇，休整后仍可继续故事。';
  }
  return damage;
}
function useItem(session, id) {
  const item = itemOf(id), c = session.character;
  if (!item || item.kind !== 'consumable' || !session.rpg.bag[id]) throw new GameError('这件物品无法使用。');
  if (item.heal && c.hp === c.maxHp || item.mana && c.mp === c.maxMp) throw new GameError(item.heal ? '生命已满，留着药剂吧。' : '魔力已满，留着药剂吧。');
  if (c.hp === 0) throw new GameError('体力耗尽后需要休整开启下一章。', 409);
  const hp = c.hp, mp = c.mp;
  c.hp = Math.min(c.maxHp, c.hp + (item.heal || 0));
  c.mp = Math.min(c.maxMp, c.mp + (item.mana || 0));
  removeItem(session, id);
  return `使用${item.name}，恢复 ${c.hp - hp ? `${c.hp - hp} 生命` : `${c.mp - mp} 魔力`}。`;
}
export function applyRpgAction(session, input, requestId, dice = () => randomInt(1, 21)) {
  if (!Number.isInteger(input?.version) || input.version !== session.version) throw new GameError('冒险进度已更新，请刷新后继续。', 409);
  const next = ensureRpg(structuredClone(session));
  const r = next.rpg, c = next.character;
  const type = input.type;
  let message, roll = null, damage = 0;
  if (r.combat && !['combat', 'use'].includes(type)) throw new GameError('战斗中只能行动或使用道具。', 409);
  if (next.ended && ['trial', 'rest', 'combat', 'use'].includes(type)) throw new GameError('这一章已经结束，请休整并开启下一章。', 409);
  if (type === 'equip') {
    const item = itemOf(input.itemId);
    if (!item || item.kind !== 'equipment' || !r.bag[item.id]) throw new GameError('你还没有这件装备。');
    if (r.equipment[item.slot] === item.id) throw new GameError('这件装备已穿戴。');
    r.equipment[item.slot] = item.id;
    message = `装备${item.name}：${item.description}`;
  } else if (type === 'unequip') {
    if (!Object.hasOwn(SLOTS, input.slot) || !r.equipment[input.slot]) throw new GameError('这个部位没有装备。');
    message = `卸下${itemOf(r.equipment[input.slot]).name}。`;
    r.equipment[input.slot] = null;
  } else if (type === 'buy' || type === 'sell') {
    const item = itemOf(input.itemId);
    if (!item) throw new GameError('这个物品不存在。');
    if (type === 'buy') {
      if (c.gold < item.price) throw new GameError('金币不足。');
      addItem(next, item.id); c.gold -= item.price;
      message = `购买${item.name}，花费 ${item.price} 金币。`;
    } else {
      removeItem(next, item.id); const value = Math.floor(item.price / 2); c.gold += value;
      message = `出售${item.name}，获得 ${value} 金币。`;
    }
  } else if (type === 'craft') {
    const recipe = RECIPES.find(recipe => recipe.id === input.recipeId);
    if (!recipe) throw new GameError('这个配方不存在。');
    if (c.gold < recipe.gold) throw new GameError('锻造所需金币不足。');
    for (const [id, amount] of Object.entries(recipe.materials)) removeItem(next, id, amount);
    addItem(next, recipe.result); c.gold -= recipe.gold;
    message = `完成${recipe.name}，获得${itemOf(recipe.result).name}。`;
  } else if (type === 'talent') {
    if (!Object.hasOwn(r.talents, input.skill) || r.skillPoints < 1) throw new GameError('没有可用的天赋点，或能力不存在。');
    r.talents[input.skill]++; r.skillPoints--;
    message = `${{ might: '力量', insight: '洞察', agility: '敏捷', charm: '魅力' }[input.skill]}永久 +1。`;
  } else if (type === 'claim') {
    const q = r.quests.find(q => q.id === input.questId);
    if (!q || q.claimed || q.progress < q.goal) throw new GameError('这个任务还不能领取奖励。');
    q.claimed = true; gainXp(next, q.reward.xp); c.gold += q.reward.gold; addItem(next, q.reward.item);
    message = `完成「${q.name}」：经验 +${q.reward.xp}，金币 +${q.reward.gold}，获得${itemOf(q.reward.item).name}。`;
  } else if (type === 'rest') {
    if (c.hp === c.maxHp && c.mp === c.maxMp) throw new GameError('状态很好，无需休息。');
    if (c.gold < 8) throw new GameError('休息需要 8 金币。');
    c.gold -= 8;
    const hp = c.hp, mp = c.mp;
    c.hp = Math.min(c.maxHp, c.hp + 15); c.mp = Math.min(c.maxMp, c.mp + 8);
    message = `在营地休息：恢复 ${c.hp - hp} 生命、${c.mp - mp} 魔力，花费 8 金币。`;
  } else if (type === 'trial') {
    if (c.gold < 3) throw new GameError('演武需要 3 金币。');
    c.gold -= 3;
    beginCombat(next, { enemyId: 'shadow', name: '月光演武幻影' }, { trial: true });
    message = '开始月光演武，花费 3 金币。获胜获得 8 经验，不掉落金币或物品。';
  } else if (type === 'use') {
    message = useItem(next, input.itemId);
    if (r.combat) { r.combat.round++; r.combat.log.push(message); damage = enemyTurn(next); }
  } else if (type === 'combat') {
    const battle = r.combat;
    if (!battle) throw new GameError('当前没有需要交战的对手。', 409);
    const ability = ABILITIES.find(a => a.id === input.abilityId);
    if (!ability) throw new GameError('这个战斗技能不存在。');
    if (c.mp < ability.cost) throw new GameError('魔力不足，可以防守恢复魔力或使用药剂。');
    if (ability.id === 'heal' && c.hp === c.maxHp) throw new GameError('生命已满，无需施放祝福。');
    c.mp -= ability.cost; battle.round++;
    if (ability.id === 'guard') {
      c.mp = Math.min(c.maxMp, c.mp + 2); message = '你摆出守护姿态，本回合伤害减半，恢复至多 2 魔力。';
    } else if (ability.id === 'heal') {
      const hp = c.hp; c.hp = Math.min(c.maxHp, c.hp + 12 + c.level * 2); message = `月光祝福恢复 ${c.hp - hp} 生命。`;
    } else {
      const skill = ability.id === 'spark' ? 'insight' : ability.id === 'flee' ? 'agility' : c.modifiers.might >= c.modifiers.agility ? 'might' : 'agility';
      const dc = ability.id === 'flee' ? 10 : battle.dc;
      roll = rollCheck(next, skill, dc, dice);
      if (ability.id === 'flee') {
        message = roll.success ? '你灵巧地脱离了战斗。' : '你尝试脱身，去路却被拦住。';
        battle.log.push(message);
        if (roll.success) finishCombat(next, 'escaped');
      } else {
        const hit = roll.success ? (ability.id === 'spark' ? c.magic : c.attack) + (roll.critical === 'success' ? 4 : 0) : 0;
        battle.hp = Math.max(0, battle.hp - hit);
        message = hit ? `${ability.name}命中，造成 ${hit} 伤害。` : `${ability.name}未能命中。`;
        battle.log.push(message);
        if (battle.hp === 0) finishCombat(next, 'victory');
      }
    }
    if (r.combat) {
      if (['guard', 'heal'].includes(ability.id)) battle.log.push(message);
      damage = enemyTurn(next, ability.id === 'guard');
      if (r.combat) r.combat.log = r.combat.log.slice(-12);
    }
  } else throw new GameError('这个行动不存在。');
  refreshStats(next);
  logEvent(next, message);
  next.version++;
  next.history.push({ kind: 'rpg', turn: next.version, scene: structuredClone(session.scene), action: { id: type, label: message, custom: false }, roll, damage, summary: message });
  next.updatedAt = new Date().toISOString();
  next.requestIds = [...next.requestIds, requestId].slice(-50);
  return next;
}
