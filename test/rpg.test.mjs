import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { newSession, prepareAction, applyTurn, validateScene, publicSession } from '../lib/game.mjs';
import { applyRpgAction, beginCombat, gainXp, ensureRpg } from '../lib/rpg.mjs';
import { demoTurn } from '../lib/catalog.mjs';
import { createDeepSeek } from '../lib/deepseek.mjs';
const setup = () => newSession({ name: '艾莉娅', worldId: 'fantasy', roleId: 'wanderer', difficulty: 'balanced' });
const act = (s, input, dice = () => 20) => applyRpgAction(s, { version: s.version, ...input }, randomUUID(), dice);

test('equipment changes checks, attack and defense, while replacements and removal restore stats', () => {
  const initial = setup();
  const sword = act(initial, { type: 'equip', itemId: 'moonblade', gold: 99999, modifiers: { might: 999 } });
  assert.equal(sword.character.modifiers.might, initial.character.modifiers.might + 1);
  assert.equal(sword.character.attack, initial.character.attack + 2);
  assert.equal(initial.rpg.equipment.weapon, null);
  const cloak = act(sword, { type: 'equip', itemId: 'cloak' });
  assert.equal(cloak.character.defense, 2);
  assert.equal(prepareAction(cloak, { version: cloak.version, action: '绕过卫兵', skill: 'agility' }, () => 8).roll.modifier, 5);
  const removed = act(cloak, { type: 'unequip', slot: 'armor' });
  assert.equal(removed.character.modifiers.agility, 4);
  assert.equal(removed.character.defense, 0);
  assert.throws(() => act(initial, { type: 'equip', itemId: '__proto__' }));
});
test('consumables consume exactly one item and cannot be wasted or revive exhausted saves', () => {
  const initial = setup(); initial.character.hp = 20;
  const used = act(initial, { type: 'use', itemId: 'potion' });
  assert.equal(used.character.hp, 30);
  assert.equal(used.rpg.bag.potion, 2);
  assert.equal(initial.rpg.bag.potion, 3);
  assert.throws(() => act(used, { type: 'use', itemId: 'potion' }));
  initial.character.hp = 0;
  assert.throws(() => act(initial, { type: 'use', itemId: 'potion' }));
});
test('shop and crafting preserve the economy and refuse equipped materials without partial changes', () => {
  const initial = setup();
  const bought = act(initial, { type: 'buy', itemId: 'potion', price: 0, quantity: 999 });
  assert.equal(bought.character.gold, 10); assert.equal(bought.rpg.bag.potion, 4);
  assert.throws(() => act(bought, { type: 'buy', itemId: 'starblade' }));
  const equipped = act(bought, { type: 'equip', itemId: 'moonblade' });
  assert.throws(() => act(equipped, { type: 'sell', itemId: 'moonblade' }));
  const brewed = act(initial, { type: 'craft', recipeId: 'brew' });
  assert.equal(brewed.rpg.bag.herb, undefined); assert.equal(brewed.rpg.bag.potion, 4);
  initial.rpg.bag.stardust = 3;
  const forged = act(initial, { type: 'craft', recipeId: 'forge' });
  assert.equal(forged.rpg.bag.starblade, 1); assert.equal(forged.rpg.bag.moonblade, undefined); assert.equal(forged.character.gold, 5);
  const unchanged = structuredClone(equipped);
  assert.throws(() => act(equipped, { type: 'craft', recipeId: 'forge' }));
  assert.deepEqual(equipped, unchanged);
});
test('leveling grows health and mana, grants points, and talents cannot be forged', () => {
  let s = setup(); gainXp(s, 50);
  assert.equal(s.character.level, 2); assert.equal(s.character.maxHp, 36); assert.equal(s.character.maxMp, 14); assert.equal(s.rpg.skillPoints, 1);
  s = act(s, { type: 'talent', skill: 'charm', amount: 100 });
  assert.equal(s.character.modifiers.charm, 2); assert.equal(s.rpg.skillPoints, 0);
  assert.throws(() => act(s, { type: 'talent', skill: 'charm' }));
});
test('combat uses real equipment, spends mana, blocks story actions and retaliates on potions', () => {
  let s = act(setup(), { type: 'equip', itemId: 'cloak' });
  beginCombat(s, { enemyId: 'sentinel', name: '星冠守卫', hp: 1, attack: 0 });
  assert.equal(s.rpg.combat.hp, 32);
  assert.throws(() => prepareAction(s, { version: s.version, action: '绕过去', skill: 'charm' }));
  assert.throws(() => act(s, { type: 'buy', itemId: 'potion' }));
  const attack = act(s, { type: 'combat', abilityId: 'spark' }, () => 15);
  assert.equal(attack.character.mp, 9); assert.equal(attack.rpg.combat.hp, 24);
  assert.equal(attack.character.hp, 25);
  const healing = act(attack, { type: 'use', itemId: 'potion' });
  assert.equal(healing.character.hp, 25); assert.equal(healing.rpg.bag.potion, 2); assert.equal(healing.rpg.combat.round, 2);
  const guarding = act(healing, { type: 'combat', abilityId: 'guard' });
  assert.equal(guarding.character.mp, 11); assert.equal(guarding.character.hp, 23);
});
test('victory grants rewards once; retreat, defeat and low mana obey rules', () => {
  let s = setup(); beginCombat(s, { enemyId: 'shadow', name: '影灵' });
  while (s.rpg.combat) s = act(s, { type: 'combat', abilityId: 'attack' });
  assert.equal(s.rpg.lastCombat.outcome, 'victory'); assert.equal(s.character.xp, 20); assert.equal(s.character.gold, 32); assert.equal(s.rpg.bag.stardust, 2);
  assert.throws(() => act(s, { type: 'combat', abilityId: 'attack' }));
  let escaped = setup(); beginCombat(escaped, { enemyId: 'sentinel', name: '守卫' });
  escaped = act(escaped, { type: 'combat', abilityId: 'flee' });
  assert.equal(escaped.rpg.combat, null); assert.equal(escaped.rpg.lastCombat.outcome, 'escaped'); assert.equal(escaped.character.gold, 20);
  let defeated = setup(); defeated.character.hp = 1; defeated.character.mp = 0;
  beginCombat(defeated, { enemyId: 'sentinel', name: '守卫' });
  assert.throws(() => act(defeated, { type: 'combat', abilityId: 'spark' }));
  defeated = act(defeated, { type: 'combat', abilityId: 'attack' }, () => 1);
  assert.equal(defeated.character.hp, 0); assert.equal(defeated.ended, true); assert.equal(defeated.endReason, 'exhausted');
});
test('RPG operations do not consume demo scenes, and quest rewards require an explicit single claim', () => {
  let s = act(setup(), { type: 'equip', itemId: 'moonblade' });
  assert.equal(s.storyTurns, 0);
  for (let i = 0; i < 3; i++) {
    const { action, roll } = prepareAction(s, { version: s.version, action: '探索', skill: 'charm' }, () => 20);
    const raw = demoTurn(s, action, roll);
    s = applyTurn(s, action, roll, raw, randomUUID());
  }
  assert.equal(s.storyTurns, 3); assert.equal(s.ended, false);
  const beforeGold = s.character.gold;
  const claimed = act(s, { type: 'claim', questId: 'explorer' });
  assert.equal(claimed.character.gold, beforeGold + 10);
  assert.throws(() => act(claimed, { type: 'claim', questId: 'explorer' }));
  assert.equal(s.rpg.quests[0].claimed, false);
});
test('AI can propose bounded encounters and loot but cannot supply arbitrary stats or mint unlimited gear', () => {
  let s = setup();
  const { action, roll } = prepareAction(s, { version: 0, action: '探索', skill: 'insight' }, () => 20);
  const raw = { ...demoTurn(s, action, roll), encounter: { enemyId: 'shadow', name: '月影', hp: 1, gold: 999999 }, loot: ['potion','cloak'], gold: 999999 };
  const next = applyTurn(s, action, roll, raw, randomUUID());
  assert.equal(next.rpg.combat.hp, 20); assert.equal(next.rpg.bag.potion, 4); assert.equal(next.character.gold, 23);
  assert.throws(() => validateScene({ ...raw, loot: ['starblade'] }));
  assert.throws(() => validateScene({ ...raw, encounter: { enemyId: 'dragon', name: '龙' } }));
  s.rpg.lootGranted = 3;
  const capped = applyTurn(s, action, roll, raw, randomUUID());
  assert.equal(capped.rpg.bag.potion, 3);
});
test('legacy saves migrate without losing identity, clues or XP and without exposing the token', () => {
  const s = setup(); delete s.rpg; delete s.character.level; delete s.character.mp; delete s.character.maxMp; delete s.character.baseModifiers;
  s.character.xp = 110; s.inventory.push('母后的信笺');
  const legacy = structuredClone(s);
  const visible = publicSession(s);
  assert.equal(visible.character.level, 3); assert.equal(visible.rpg.skillPoints, 2); assert.ok(visible.inventory.includes('母后的信笺'));
  assert.equal(visible.token, undefined); assert.deepEqual(s, legacy);
  assert.equal(ensureRpg(s).id, legacy.id);
});
test('DeepSeek receives equipment, consumables, combat outcome and finite loot allowance', async () => {
  const s = act(setup(), {type:'equip',itemId:'moonblade'});
  s.rpg.lastCombat = { name:'影灵',outcome:'victory' }; let context;
  const ai = createDeepSeek({ apiKey:'fake', fetchImpl:async (url, options) => {
    context = JSON.parse(JSON.parse(options.body).messages[1].content);
    return Response.json({ choices:[{finish_reason:'stop',message:{content:'{}'}}] });
  } });
  await ai(s);
  assert.equal(context.turn,0); assert.equal(context.recentHistory.length,0);
  assert.equal(context.rpg.equipment.weapon,'moonblade'); assert.equal(context.rpg.lastCombat.outcome,'victory');
  assert.equal(context.rpg.bag.find(i => i.id === 'potion').quantity,3); assert.equal(context.rpg.lootRemaining,3);
});


test('fatal story damage cannot be undone by a simultaneous level up', () => {
  const s = setup(); s.character.xp = 45; s.character.hp = 1;
  const {action, roll} = prepareAction(s, {version:0,action:'迎向危险',skill:'might'}, () => 1);
  const next = applyTurn(s,action,roll,demoTurn(s,action,roll),randomUUID());
  assert.equal(next.character.level,2); assert.equal(next.character.hp,0); assert.equal(next.ended,true);
});


test('a full loot stack cannot prevent combat victory or duplicate its reward', () => {
  let s = setup(); s.rpg.bag.stardust = 99; beginCombat(s,{enemyId:'shadow',name:'影灵'});
  while(s.rpg.combat) s=act(s,{type:'combat',abilityId:'attack'});
  assert.equal(s.rpg.lastCombat.outcome,'victory'); assert.equal(s.rpg.bag.stardust,99);
  assert.equal(s.character.gold,32); assert.equal(s.rpg.quests.find(q=>q.id==='victor').progress,1);
});
