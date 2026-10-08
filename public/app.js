import { takeAccessLink } from './access-link.js';
let accessLink, accessLinkError;
try { accessLink = takeAccessLink(window.location, window.history); } catch (error) { accessLinkError = error; }
const $ = selector => document.querySelector(selector);
const app = $('#app');
const modal = $('#modal');
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const icons = {
  crown: '<path d="m3 6 4 4 5-6 5 6 4-4-2 12H5Z"/><path d="M5 21h14"/>',
  star: '<path d="m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5Z"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m16 8-2 6-6 2 2-6Z"/>',
  book: '<path d="M12 5v16M12 5C8 2 3 3 3 3v16s5-1 9 2c4-3 9-2 9-2V3s-5-1-9 2Z"/>',
  shield: '<path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6Z"/><path d="m9 12 2 2 4-4"/>',
  spark: '<path d="m12 3 2 6 6 3-6 2-2 7-2-7-7-2 7-3ZM20 2v4M18 4h4"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  back: '<path d="M20 12H4m6-6-6 6 6 6"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  settings: '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="2"/><circle cx="15" cy="17" r="2"/>',
  dice: '<path d="m12 2 9 5v10l-9 5-9-5V7Z"/><path d="m3 7 9 5 9-5M12 12v10M7 5l10 14M17 5 7 19"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  wind: '<path d="M3 8h12c5 0 5-6 1-6M3 12h15c5 0 5 7 0 7M3 16h7c4 0 4 6 0 6"/>',
  sword: '<path d="m14 4 6-2-2 6L8 18l-4-4ZM3 21l3-3M2 12l10 10"/>',
  leaf: '<path d="M5 19C-2 9 8 3 21 3c0 13-6 22-16 16ZM5 19l10-10"/>',
  save: '<path d="M5 3h12l4 4v14H3V3ZM7 3v6h10V3M7 21v-7h10v7"/>',
  bag: '<path d="M7 8V6c0-6 10-6 10 0v2M4 8h16l1 13H3Z"/>',
  moon: '<path d="M20 14a9 9 0 0 1-10-11 9 9 0 1 0 10 11Z"/>',
  copy: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
};
const icon = (name, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.star}</svg>`;
function readSaves() { try { const saved = JSON.parse(localStorage.getItem('storybound.saves') || '[]'); return Array.isArray(saved) ? saved.filter(s => s && typeof s.id === 'string' && typeof s.token === 'string').slice(0, 12) : []; } catch { return []; } }
const state = { config: null, session: null, token: null, screen: 'home', busy: false, saves: readSaves(), pending: null, rpgTab: null };
function requestId() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
let toastTimer;
function toast(message) { $('#toast').textContent = message; $('#toast').classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 5000); }
async function api(path, options = {}) {
  let response;
  try { response = await fetch(path, { ...options, headers: { 'Content-Type': 'application/json', ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}) }, signal: AbortSignal.timeout(75000) }); }
  catch (error) { throw new Error(error.name === 'TimeoutError' ? '等待回应超时。请重试；重复提交不会重复推进回合。' : '连接中断，请检查网络。你的已完成回合仍保存在服务器。'); }
  let result;
  try { result = await response.json(); } catch { throw new Error('服务器回应异常，请稍后重试。'); }
  if (!response.ok) { if (result.code === 'PLAYTEST_LOGIN_REQUIRED' && state.config?.playtest) state.config.playtest.authorized = false; const error = new Error(result.error || '暂时无法完成，请重试。'); error.status = response.status; throw error; }
  return result;
}
function persist() {
  const s = state.session;
  const entry = { id: s.id, token: state.token, name: s.character.name, worldId: worldOfSession(s).id, mode: s.mode, title: s.scene.title, version: s.version, storyTurns: s.storyTurns, ended: s.ended, updatedAt: s.updatedAt };
  state.saves = [entry, ...state.saves.filter(save => save.id !== s.id)].slice(0, 12);
  try { localStorage.setItem('storybound.saves', JSON.stringify(state.saves)); } catch { toast('浏览器无法保存存档入口，请导出存档凭据以便继续。'); }
}
const worldOf = id => state.config.worlds.find(w => w.id === id);
const worldOfSession = s => worldOf(s.worldId === 'fantasy' && !s.settingVersion && s.character.protagonistId === 'princess-elya' ? 'princess' : s.worldId);
const roleOf = id => state.config.roles.find(r => r.id === id);
const paragraphs = value => String(value).split(/\n+/).filter(Boolean).map(p => `<p>${esc(p)}</p>`).join('');
const modeBadge = () => `<span class="mode-badge live"><span class="status-dot"></span>AI 主持${state.config?.playtest?.access === 'owner' ? ' · 专属游玩' : ''}</span>`;

function sidebar() {
  return `<aside class="sidebar">
    <button class="brand" data-action="home" aria-label="星叙首页"><span class="brand-symbol">${icon('star')}</span><span><strong>星叙</strong><small>STORYBOUND</small></span></button>
    <div class="sidebar-section">你的冒险空间</div>
    <nav class="main-nav" aria-label="主导航"><button class="nav-item ${state.screen === 'home' ? 'active' : ''}" data-action="home">${icon('compass')}<span>冒险大厅</span><span class="nav-dot"></span></button><button class="nav-item" data-action="saves">${icon('book')}<span>我的故事</span><span class="nav-count">${state.saves.length}</span></button>${state.session ? `<button class="nav-item ${state.screen === 'story' ? 'active' : ''}" data-action="current">${icon('leaf')}<span>当前旅途</span></button>` : ''}</nav>
    <div class="sidebar-section saved-title">最近的旅途 <span>✧</span></div>
    <div class="recent-saves">${state.saves.length ? state.saves.slice(0, 3).map(s => `<button class="recent-save" data-action="resume" data-id="${esc(s.id)}"><span class="save-mark ${esc(s.worldId)}">${icon('book')}</span><span><strong>${esc(worldOf(s.worldId)?.name || '未知故事')}</strong><small>${esc(s.name)} · ${s.ended ? '已完结' : `第 ${Number(s.storyTurns ?? s.version) + 1} 幕`}</small></span></button>`).join('') : '<p class="empty-recent">每段故事，都从一次<br>勇敢的启程开始。</p>'}</div>
    <div class="sidebar-bottom"><div class="guide-note">${icon('spark')}<p>一个世界，一段旅程。<br>你的选择，由 AI 回应。</p></div><button class="connection" data-action="settings"><span class="status-dot ${state.config.aiAvailable ? 'green' : ''}"></span><span>${state.config.aiAvailable ? 'AI 主持已就绪' : 'AI 主持暂不可用'}</span>${icon('settings')}</button></div>
  </aside>`;
}
function header() {
  return `<header class="topbar"><div class="breadcrumbs"><span class="mobile-brand">✧ 星叙</span><span class="desktop-crumb">你的冒险空间</span><span class="crumb-divider">/</span><strong>${state.screen === 'story' ? '当前旅途' : '冒险大厅'}</strong></div><div class="topbar-right"><button class="quiet-button mobile-saves" data-action="saves" aria-label="我的故事">${icon('book')}</button><span class="topbar-note">${state.config.playtest?.access === 'owner' ? '专属游玩 · AI 无次数限制' : '一人，一骰，无限可能'}</span><button class="avatar-button" data-action="settings" aria-label="游玩指南">${icon('spark')}</button></div></header>`;
}
function home() {
  return `<div class="home-view">
    <section class="hero">
      <div class="hero-copy"><div class="eyebrow"><span></span> YOUR WORLD. YOUR CHARACTER. YOUR STORY.</div><h1>让想象，成为<br>你的下一次<span class="world-word">冒险<svg viewBox="0 0 130 14" aria-hidden="true"><path d="M3 10C40 0 80 2 127 7" fill="none" stroke="currentColor" stroke-width="2"/></svg></span>。</h1><p class="hero-description">选择一个世界，写下角色的背景。<br>让 AI 主持旅程，让每一次选择改变故事。</p><button class="primary-button" data-action="create" data-world="fantasy">开启一段冒险 ${icon('arrow')}</button><div class="hero-features"><span>${icon('spark')}AI 主持</span><span>${icon('dice')}自由抉择</span><span>${icon('save')}自动存档</span></div></div>
      <div class="hero-art"><img src="/assets/fantasy.svg" alt="星光下的奇幻世界与旧灯塔"/><div class="hero-art-shade"></div><span class="art-top">A NEW ADVENTURE AWAITS</span><div class="art-caption"><span class="art-caption-star">✧</span><div><small>奇幻 · 悬疑 · 赛博 · 仙侠 · 自定义世界</small><strong>你的故事，由你书写。</strong></div></div><span class="art-coordinate">STORYBOUND · AI GAME MASTER</span></div>
    </section>
    <section class="worlds-section"><div class="section-heading"><div><div class="eyebrow muted">CHOOSE YOUR NEXT CHAPTER</div><h2>选择你的世界 <span>不同的身份，同样自由的旅程</span></h2></div><span class="section-number">01 — ${String(state.config.worlds.length).padStart(2, '0')}</span></div>
      <div class="world-grid">${state.config.worlds.map((w, i) => `<button class="world-card ${esc(w.id)}" data-action="create" data-world="${esc(w.id)}"><div class="world-image"><img src="${esc(w.art)}" alt="${esc(w.name)}主题插画"/><span class="world-number">${String(i + 1).padStart(2, '0')}</span><span class="world-genre">${esc(w.genre)}</span></div><div class="world-card-copy"><div class="world-title"><h3>${esc(w.name)}</h3>${icon('arrow')}</div><p>${esc(w.description)}</p><div class="tags">${w.tags.slice(0, 2).map(t => `<span>${esc(t)}</span>`).join('')}</div></div></button>`).join('')}</div>
    </section>
    <div class="home-footer"><span>✧ 一人，一骰，无限可能。</span><span>AI 跑团 RPG · 为自己的命运作一次选择</span></div>
  </div>`;
}

const itemOf = id => state.config.rpg.items.find(item => item.id === id);
const rpgButton = (label, payload, disabled = false, cls = 'rpg-button') => `<button class="${cls}" data-action="rpg-do" ${Object.entries(payload).map(([key,value]) => `data-${key.replace(/[A-Z]/g, c => '-' + c.toLowerCase())}="${esc(value)}"`).join(' ')} ${disabled || state.busy ? 'disabled' : ''}>${label}</button>`;
function rpgToolbar() {
  const s = state.session, c = s.character, battle = !!s.rpg.combat;
  const xp = c.xp % 50;
  return `<section class="rpg-toolbar" aria-label="RPG 功能"><div class="rpg-toolbar-heading"><span>${icon('crown')}角色成长</span><small>LV. ${c.level} · ${xp} / 50 经验${s.rpg.skillPoints ? ` · ${s.rpg.skillPoints} 点天赋待分配` : ''}</small></div><progress class="xp-bar" value="${xp}" max="50" aria-label="本级经验 ${xp}/50"></progress><div class="rpg-tools">${[['bag','bag','行囊'],['gear','shield','装备与天赋'],['quests','compass','任务'],['shop','spark','商会'],['craft','sword','工坊']].map(([tab,ico,label]) => `<button data-action="rpg-open" data-tab="${tab}" ${state.busy || battle && tab !== 'bag' ? 'disabled' : ''}>${icon(ico)}${label}</button>`).join('')}${!s.ended && !battle ? rpgButton(`${icon('moon')}休息 · 8 金`, {type:'rest'}, c.gold < 8 || c.hp === c.maxHp && c.mp === c.maxMp, 'rpg-rest') : ''}</div><div class="rpg-recent">${s.rpg.log.slice(-2).map(entry => `<p>${icon('check')}${esc(entry.message)}</p>`).join('')}</div></section>`;
}
function combatPanel() {
  const s = state.session, b = s.rpg.combat, c = s.character;
  if (!b) {
    const last = s.rpg.lastCombat;
    if (!last || s.history.at(-1)?.kind !== 'rpg') return '';
    return `<section class="battle-result ${esc(last.outcome)}"><strong>${icon(last.outcome === 'victory' ? 'crown' : 'wind')}${esc(last.name)} · ${{victory:'胜利',escaped:'已脱身',defeated:'需要休整'}[last.outcome]}</strong><p>${esc(last.log.at(-1))}</p><small>下一次故事行动时，AI 会回应这场战斗的结果。</small></section>`;
  }
  return `<section class="combat-panel" aria-label="回合制战斗"><div class="battle-eyebrow">${icon('sword')}${b.trial ? '月光演武' : '遭遇战'}<span>第 ${b.round + 1} 回合</span></div><div class="enemy-heading"><h2>${esc(b.name)}</h2><strong>${b.hp}<small> / ${b.maxHp}</small></strong></div><progress class="enemy-health" value="${b.hp}" max="${b.maxHp}" aria-label="对手生命 ${b.hp}/${b.maxHp}"></progress><div class="battle-player"><span>生命 <strong>${c.hp} / ${c.maxHp}</strong></span><span>魔力 <strong>${c.mp} / ${c.maxMp}</strong></span><span>防御 <strong>${c.defense}</strong></span></div><div class="battle-log" role="log">${b.log.slice(-5).map(line => `<p>${esc(line)}</p>`).join('')}</div><div class="battle-actions">${state.config.rpg.abilities.map(ability => rpgButton(`${icon(ability.icon)}<span>${esc(ability.name)}<small>${ability.cost ? ability.cost + ' 魔力' : '无需魔力'}</small></span>`, {type:'combat',abilityId:ability.id}, c.mp < ability.cost || ability.id === 'heal' && c.hp === c.maxHp, 'battle-ability')).join('')}</div><div class="battle-items">${['potion','ether'].map(id => rpgButton(`${icon(itemOf(id).icon)}${id === 'potion' ? '生命药剂' : '魔力药剂'} ×${s.rpg.bag[id] || 0}`,{type:'use',itemId:id}, !s.rpg.bag[id] || (id === 'potion' ? c.hp === c.maxHp : c.mp === c.maxMp))).join('')}<small>攻击、技能或道具均消耗一回合，对手会反击；击倒或成功脱身后结束战斗。</small></div></section>`;
}
function rpgDialog(tab = 'bag') {
  if (!state.session) return;
  const s = state.session, r = s.rpg, c = s.character;
  const titles = {bag:'冒险行囊',gear:'装备与天赋',quests:'冒险任务',shop:'随行商会',craft:'月光工坊'};
  if (!titles[tab]) tab = 'bag';
  state.rpgTab = tab;
  const blocked = !!r.combat;
  let content = '';
  if (tab === 'bag') {
    content = `<p class="rpg-description">药剂可以恢复状态；战斗中使用会消耗一回合。故事线索单独记录在旅途面板。</p><div class="rpg-item-list">${Object.entries(r.bag).map(([id,quantity]) => {
      const item = itemOf(id), equipped = Object.values(r.equipment).includes(id);
      return `<article class="rpg-item"><span class="item-symbol ${esc(item.kind)}">${icon(item.icon)}</span><div class="item-copy"><strong>${esc(item.name)} <small>×${quantity}${equipped ? ' · 已装备' : ''}</small></strong><p>${esc(item.description)}</p></div><div class="item-actions">${item.kind === 'consumable' ? rpgButton('使用', {type:'use',itemId:id}, s.ended || (item.heal ? c.hp === c.maxHp : c.mp === c.maxMp)) : item.kind === 'equipment' ? rpgButton(equipped ? '已装备' : '装备', {type:'equip',itemId:id}, equipped || blocked) : '<small class="material-label">锻造材料</small>'}</div></article>`;
    }).join('')}</div>`;
  }
  if (tab === 'gear') {
    content = `<div class="gear-slots">${Object.entries(state.config.rpg.slots).map(([slot,label]) => {const item = itemOf(r.equipment[slot]); return `<article><small>${esc(label)}</small>${icon(item?.icon || 'shield')}<strong>${item ? esc(item.name) : '等待你的选择'}</strong><p>${item ? esc(item.description) : '在行囊中选择装备'}</p>${item ? rpgButton('卸下',{type:'unequip',slot},blocked) : '<button class="rpg-button" data-action="rpg-open" data-tab="bag">前往行囊</button>'}</article>`;}).join('')}</div><div class="talent-heading"><h3>成长天赋</h3><span>可用天赋点 <strong>${r.skillPoints}</strong></span></div><p class="rpg-description">每 50 经验升一级，生命上限 +6、魔力上限 +2，并获得 1 点天赋。装备与天赋会实际影响故事检定和战斗。</p><div class="talent-grid">${Object.entries(state.config.skills).map(([skill,detail]) => `<article>${icon(detail.icon)}<div><strong>${esc(detail.name)} +${c.modifiers[skill]}</strong><small>天赋 +${r.talents[skill]} · 基础 +${c.baseModifiers[skill]}</small></div>${rpgButton('+1', {type:'talent',skill}, blocked || r.skillPoints < 1)}</article>`).join('')}</div><h3 class="rpg-subheading">战斗技能</h3><div class="ability-guide">${state.config.rpg.abilities.map(a => `<p>${icon(a.icon)}<span><strong>${esc(a.name)}</strong>${esc(a.description)}</span></p>`).join('')}</div>${!s.ended ? `<div class="training-card"><div><strong>月光演武</strong><p>花费 3 金币挑战幻影，获胜获得 8 经验。生命与魔力消耗会保留。</p></div>${rpgButton('进入演武', {type:'trial'}, blocked || c.gold < 3)}</div>` : ''}`;
  }
  if (tab === 'quests') {
    content = `<div class="main-quest"><small>故事主线 · 由你的选择推进</small><p>${esc(s.quest)}</p></div><div class="quest-list">${r.quests.map(q => `<article class="quest-card ${q.claimed ? 'claimed' : ''}"><div><strong>${esc(q.name)}</strong><span>${q.claimed ? '已领取' : q.progress + ' / ' + q.goal}</span></div><p>${esc(q.description)}</p><progress class="xp-bar" value="${q.progress}" max="${q.goal}"></progress><small>奖励：${q.reward.xp} 经验 · ${q.reward.gold} 金币 · ${esc(itemOf(q.reward.item).name)}</small>${rpgButton(q.claimed ? '奖励已领取' : q.progress === q.goal ? '领取奖励' : '继续冒险', {type:'claim',questId:q.id}, blocked || q.claimed || q.progress < q.goal)}</article>`).join('')}</div>`;
  }
  if (tab === 'shop') {
    content = `<p class="rpg-description">随行商会提供补给与装备，每次买卖一件。装备中的最后一件无法出售，请先卸下。金币 <strong>${c.gold}</strong></p><div class="rpg-item-list">${state.config.rpg.items.map(item => `<article class="rpg-item"><span class="item-symbol ${esc(item.kind)}">${icon(item.icon)}</span><div class="item-copy"><strong>${esc(item.name)}</strong><p>${esc(item.description)}</p><small>持有 ${r.bag[item.id] || 0} 件 · 售出 ${Math.floor(item.price / 2)} 金</small></div><div class="item-actions">${rpgButton(`购买 · ${item.price} 金`,{type:'buy',itemId:item.id},blocked || c.gold < item.price || (r.bag[item.id] || 0) >= 99)}${rpgButton('出售',{type:'sell',itemId:item.id}, blocked || !r.bag[item.id] || Object.values(r.equipment).includes(item.id) && r.bag[item.id] === 1,'rpg-button subtle')}</div></article>`).join('')}</div>`;
  }
  if (tab === 'craft') {
    content = `<p class="rpg-description">用旅途中的材料制作补给和更强的装备。锻造材料如果已装备，需要先卸下。</p><div class="recipe-list">${state.config.rpg.recipes.map(recipe => { const ready = c.gold >= recipe.gold && Object.entries(recipe.materials).every(([id,count]) => (r.bag[id] || 0) - (Object.values(r.equipment).includes(id) ? 1 : 0) >= count); return `<article class="recipe-card"><span class="item-symbol equipment">${icon(itemOf(recipe.result).icon)}</span><h3>${esc(recipe.name)}</h3><p>${esc(itemOf(recipe.result).description)}</p><div class="recipe-materials">${Object.entries(recipe.materials).map(([id,count]) => `<span>${esc(itemOf(id).name)} ${r.bag[id] || 0}/${count}</span>`).join('')}${recipe.gold ? `<span>${recipe.gold} 金币</span>` : ''}</div>${rpgButton(ready ? '制作' : '材料不足或装备待卸下',{type:'craft',recipeId:recipe.id},blocked || !ready)}</article>`;}).join('')}</div>`;
  }
  modal.className = 'rpg-dialog';
  openDialog(`${dialogHead(titles[tab],`${c.name} · LV. ${c.level} · ${c.gold} 金币 · 生命 ${c.hp}/${c.maxHp} · 魔力 ${c.mp}/${c.maxMp}`)}<nav class="rpg-tabs" aria-label="RPG 功能分页">${Object.entries(titles).map(([id,title]) => `<button class="${id === tab ? 'active' : ''}" data-action="rpg-open" data-tab="${id}" ${state.busy || blocked && id !== 'bag' ? 'disabled' : ''}>${esc(title.replace('公主的','').replace('冒险','').replace('随行','').replace('月光',''))}</button>`).join('')}</nav><div class="rpg-dialog-content">${content}</div>`,titles[tab]);
}

function characterPanel() {
  const s = state.session;
  const c = s.character;
  const role = roleOf(c.roleId);
  const princess = c.protagonistId === 'princess-elya';
  return `<aside class="story-sidebar"><section class="character-card"><div class="panel-eyebrow">${princess ? '你的公主' : '你的角色'} <span>LV. ${c.level || Math.floor(c.xp / 50) + 1}</span></div><div class="character-name">${princess ? `<img class="princess-avatar" src="${esc(c.portrait)}" alt="${esc(c.name)}公主肖像"/>` : ''}<span class="role-portrait ${princess ? 'princess-role' : ''}">${icon(role.icon)}</span><div><h3>${esc(c.name)}</h3><p>${princess ? `${esc(c.title)} · ${esc(role.name)}天赋` : `${esc(role.name)} · ${esc(role.subtitle)}`}</p></div></div>${princess ? `<div class="princess-traits"><span>温柔</span><span>聪慧</span><span>勇敢</span></div><p class="princess-description">银金长发 · 紫晶眼眸<br>月石王冠 · 淡紫礼裙</p>` : ''}<div class="health-label"><span>生命</span><strong>${c.hp}<small> / ${c.maxHp}</small></strong></div><progress class="health-bar" value="${c.hp}" max="${c.maxHp}" aria-label="生命值 ${c.hp}/${c.maxHp}"></progress><div class="health-label mana-label"><span>魔力</span><strong>${c.mp}<small> / ${c.maxMp}</small></strong></div><progress class="mana-bar" value="${c.mp}" max="${c.maxMp}" aria-label="魔力值 ${c.mp}/${c.maxMp}"></progress><div class="character-resources"><span>金币 <strong>${c.gold}</strong></span><span>经验 <strong>${c.xp}</strong></span></div><div class="skill-grid">${Object.entries(state.config.skills).map(([key, skill]) => `<div>${icon(skill.icon)}<span>${esc(skill.name)}</span><strong>+${c.modifiers[key]}</strong></div>`).join('')}</div></section>
    <section class="side-panel"><div class="panel-eyebrow">角色装备 ${icon('shield')}</div><div class="equipped-summary">${Object.entries(s.rpg.equipment).map(([slot,id]) => `<div><small>${esc(state.config.rpg.slots[slot])}</small><span>${id ? esc(itemOf(id).name) : '未装备'}</span></div>`).join('')}</div><div class="combat-stats"><span>攻击 ${c.attack}</span><span>法术 ${c.magic}</span><span>防御 ${c.defense}</span></div><button class="rpg-side-button" data-action="rpg-open" data-tab="gear">装备与天赋 ${icon('arrow')}</button></section>
    <section class="side-panel"><div class="panel-eyebrow">当前目标 ${icon('compass')}</div><p class="quest">${esc(s.quest)}</p></section>
    <section class="side-panel"><div class="panel-eyebrow">故事线索 ${icon('book')}</div><div class="inventory">${s.inventory.map(item => `<span>${icon('star')}${esc(item)}</span>`).join('')}</div></section>
    <button class="journal-link" data-action="journal">${icon('book')}旅途记录<span>${s.history.length}</span>${icon('arrow')}</button>
    <div class="autosave-note">${icon('check')}已自动保存这一幕</div>
  </aside>`;
}
function rollCard() {
  const last = state.session.history.at(-1);
  if (!last?.roll) return '';
  const r = last.roll;
  if (last.kind === 'rpg') return '';
  return `<div class="roll-card ${r.success ? 'success' : 'failure'}"><span class="rolled-dice">${r.natural}</span><div><strong>${esc(state.config.skills[r.skill].name)}检定 · ${r.critical === 'success' ? '大成功' : r.critical === 'failure' ? '大失败' : r.success ? '成功' : '受挫'}</strong><small>D20 ${r.natural} + ${r.modifier} = ${r.total} <span>难度 ${r.dc}</span></small></div><span class="roll-effect">${last.damage ? `生命 −${last.damage}` : '经验 +10'}</span></div>`;
}
function chapterEnding() {
  const s = state.session;
  const exhausted = s.character.hp === 0;
  return `<div class="ending"><div class="eyebrow">YOUR STORY CAN GO ON</div><h2>${exhausted ? '先休息，旅途还能继续。' : '这一章落幕，你的故事仍可继续。'}</h2><p>角色的经历、物品和已发生的结局，会带入下一章。</p>
    ${state.config.aiAvailable ? `<form id="continue-form" class="continue-form"><label for="continue-direction">你想把下一章带向哪里？<small>选填</small></label><textarea id="continue-direction" name="direction" class="text-input" maxlength="500" rows="3" placeholder="例如：和母后一起去邻国看海，途中结识一位有秘密的伙伴…" ${state.busy ? 'disabled' : ''}></textarea><button class="primary-button" type="submit" ${state.busy ? 'disabled' : ''}>休整并开启下一章 ${icon('arrow')}</button><p class="continuation-note">休整后恢复生命，保留经验、金币和行囊；下一幕由 AI 主持生成。</p></form>` : '<p class="continuation-note">AI 主持暂时不可用，进度已保留，请稍后回来继续。</p>' }
    <div class="ending-actions"><button class="text-button" data-action="export">${icon('book')}保存这段旅途</button><button class="text-button" data-action="home">${icon('moon')}暂别，稍后回来</button><button class="text-button" data-action="create" data-world="${esc(s.worldId)}">${icon('plus')}另开一段新故事</button></div></div>`;
}
function story() {
  const s = state.session;
  const w = worldOfSession(s);
  return `<div class="story-view"><div class="story-toolbar"><button class="text-button" data-action="home">${icon('back')}返回大厅</button><div>${modeBadge()}<button class="quiet-button" data-action="export" aria-label="导出故事">${icon('save')}</button></div></div>
    <div class="story-grid"><article class="story-paper"><div class="story-landscape ${esc(w.id)}"><img src="${esc(w.sceneArt || w.art)}" alt="${esc(w.name)}的故事封面"/><div><span>${esc(w.english)}</span><strong>${icon('compass')}${esc(s.scene.location)}</strong></div></div><div class="story-text"><div class="chapter-line"><span>${esc(s.scene.chapter)}</span><span>第 ${s.episode || 1} 卷 · 第 ${(s.storyTurns ?? s.version) + 1} 幕</span></div><h1>${esc(s.scene.title)}</h1><div class="narrative">${paragraphs(s.scene.narrative)}</div>${rollCard()}${rpgToolbar()}${combatPanel()}<div class="choice-divider"><span>✧</span></div>
      ${s.ended ? chapterEnding() : s.rpg.combat ? '<p class="combat-wait-note">完成战斗或脱身后，可以继续自由行动。</p>' : `<div class="choices-heading"><h2>你打算怎么做？</h2><span>选择一条路，或创造自己的路</span></div><div class="choices">${s.scene.choices.map((c, i) => `<button class="choice" data-action="choose" data-id="${esc(c.id)}" ${state.busy ? 'disabled' : ''}><span class="choice-key">${String.fromCharCode(65 + i)}</span><span class="choice-content"><strong>${esc(c.label)}</strong><small>${esc(c.hint)}</small></span><span class="choice-skill">${icon(state.config.skills[c.skill].icon)}${esc(state.config.skills[c.skill].name)}</span>${icon('arrow')}</button>`).join('')}</div><form id="action-form" class="custom-action"><label for="custom-input">也可以，让想象力带路</label><div class="custom-input-wrap"><textarea id="custom-input" name="action" maxlength="500" rows="2" placeholder="例如：我试着用那封信上的字，向白鹿说明来意…" ${state.busy ? 'disabled' : ''}></textarea><div class="custom-controls"><select name="skill" aria-label="自由行动使用的能力" ${state.busy ? 'disabled' : ''}>${Object.entries(state.config.skills).map(([key, skill]) => `<option value="${key}" ${key === 'insight' ? 'selected' : ''}>${esc(skill.name)} +${s.character.modifiers[key]}</option>`).join('')}</select><span id="action-counter">0 / 500</span><button type="submit" class="send-button" aria-label="尝试自由行动" ${state.busy ? 'disabled' : ''}>${icon('arrow')}</button></div></div></form>`}
      ${state.busy ? `<div class="thinking" role="status"><span class="thinking-dots">···</span>${state.pending?.input.type ? '正在记录这次行动…' : '主持人正在编织下一幕…'}</div>` : ''}
      <p class="demo-notice">AI 持续生成 · 无固定回合上限，故事因你的选择而改变。</p>
    </div></article>${characterPanel()}</div></div>`;
}
function render() {
  if (!state.config) return;
  if (state.config.playtest?.required && !state.config.playtest.authorized) {
    document.title = '星叙 · 朋友试玩';
    app.innerHTML = `<main class="playtest-gate"><section class="playtest-card"><img src="${esc(state.config.protagonist.portrait)}" alt="星光下的奇幻世界"><div class="playtest-copy"><span class="playtest-eyebrow">✧ 星叙 · 朋友试玩</span><h1>你的故事，<br>从一次选择开始。</h1><p>输入朋友分享的邀请码，踏上一段由你决定的冒险。</p><form id="playtest-form"><label for="playtest-code">试玩邀请码</label><input id="playtest-code" name="code" class="text-input" maxlength="80" required autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="输入邀请码"><p class="form-error" id="playtest-error" role="alert"></p><button class="primary-button" type="submit">进入冒险大厅 ${icon('arrow')}</button></form><small>进度自动保存。每个试玩浏览器每天有 ${Number(state.config.playtest.dailyLimit)} 次 AI 生成机会，明天可以接着玩。</small></div></section></main>`;
    return;
  }
  app.innerHTML = `<div class="app-shell">${sidebar()}<main class="main">${header()}${state.screen === 'story' && state.session ? story() : home()}</main></div>`;
  document.title = state.screen === 'story' ? `${state.session.scene.title} · 星叙` : '星叙 Storybound · 你的故事，由你书写';
}
function openDialog(html, label) { modal.innerHTML = html; modal.setAttribute('aria-label', label); if (!modal.open) modal.showModal(); }
const dialogHead = (title, sub = '') => `<div class="dialog-head"><div><h2>${esc(title)}</h2>${sub ? `<p>${esc(sub)}</p>` : ''}</div><button class="quiet-button" data-action="close" aria-label="关闭">${icon('close')}</button></div>`;
function createDialog(worldId) {
  const w = worldOf(worldId), royal = w.defaultProtagonistId === 'princess-elya';
  modal.className = 'create-dialog';
  openDialog(`<div class="create-layout"><div class="create-art ${esc(w.id)}"><img src="${esc(w.art)}" alt="${esc(w.name)}"/><div><span>${esc(w.english)}</span><h2>${esc(w.name)}</h2><p>${esc(w.description)}</p><div class="tags">${w.tags.map(t => `<span>${esc(t)}</span>`).join('')}</div></div></div><div class="create-form-side">${dialogHead('创建你的角色', '写下身份与目标，让世界回应你的选择。')}<form id="create-form"><input type="hidden" name="worldId" value="${esc(w.id)}"><label class="field-label" for="protagonist">角色身份</label><select class="text-input" id="protagonist" name="protagonistId">${state.config.protagonists.filter(p => !royal || p.id === 'princess-elya').map(p => `<option value="${esc(p.id)}" ${p.id === (w.defaultProtagonistId || 'custom') ? 'selected' : ''}>${esc(p.title)}${p.id === 'princess-elya' ? ' · 示例角色' : ' · 自定义背景'}</option>`).join('')}</select><label class="field-label" for="name">角色的名字</label><input class="text-input" id="name" name="name" maxlength="24" required value="${esc((state.config.protagonists.find(p => p.id === (w.defaultProtagonistId || 'custom'))).defaultName)}" autocomplete="off"><label class="field-label" for="character-concept">角色背景 <small>选填</small></label><textarea class="text-input wish-input" id="character-concept" name="characterConcept" maxlength="500" rows="2" ${royal ? 'disabled' : ''} placeholder="例如：一位失去故乡的调查员，擅长与陌生人交涉，想找回自己的记忆。"></textarea>${w.id === 'custom' ? '<label class="field-label" for="world-premise">世界设定</label><textarea class="text-input wish-input" id="world-premise" name="worldPremise" maxlength="1000" rows="3" required placeholder="描述时代、环境、世界规则与当前冲突。比如：一座漂浮在云海上的城市，所有人的梦都可以交易…"></textarea>' : ''}<label class="field-label" for="story-language">故事语言 / Story language</label><select class="text-input" id="story-language" name="language">${state.config.languages.map(l => `<option value="${esc(l.id)}">${esc(l.name)}</option>`).join('')}</select><fieldset class="role-fieldset"><legend class="field-label">选择角色的天赋</legend><div class="role-options">${state.config.roles.map((r, i) => `<label class="role-option"><input type="radio" name="roleId" value="${esc(r.id)}" ${i === 0 ? 'checked' : ''}><span>${icon(r.icon)}<strong>${esc(r.name)}</strong><small>${esc(r.subtitle)}</small></span></label>`).join('')}</div></fieldset><fieldset class="difficulty-fieldset"><legend class="field-label">旅途的节奏</legend><div class="difficulty-options">${state.config.difficulties.map(d => `<label><input type="radio" name="difficulty" value="${esc(d.id)}" ${d.id === 'balanced' ? 'checked' : ''}><span>${esc(d.name)}</span></label>`).join('')}</div><p id="difficulty-description" class="field-note">机遇与风险，恰到好处</p></fieldset><label class="field-label" for="wish">故事偏好 <small>选填</small></label><textarea id="wish" class="text-input wish-input" name="wish" maxlength="300" rows="2" placeholder="比如：我想结识可靠的伙伴，多一些调查与谈判，让故事温暖一些…"></textarea><p class="form-error" id="create-error" role="alert"></p><button class="primary-button start-button" type="submit">开启冒险 ${icon('arrow')}</button><p class="privacy-note">${icon('save')}进度自动保存，随时回来继续。</p></form></div></div>`, '创建冒险');
  $('#name').select();
}

function savesDialog() {
  modal.className = 'standard-dialog';
  openDialog(`${dialogHead('我的故事', '每一次启程，都有迹可循。')}<div class="saves-list">${state.saves.length ? state.saves.map(s => `<div class="save-row"><img src="${esc(worldOf(s.worldId)?.art || '/assets/fantasy.svg')}" alt=""><div><strong>${esc(worldOf(s.worldId)?.name || '未知故事')} <small>AI</small></strong><p>${esc(s.name)} · ${esc(s.title)} · ${s.ended ? '已完结' : `第 ${Number(s.storyTurns ?? s.version) + 1} 幕`}</p></div><button class="small-button" data-action="resume" data-id="${esc(s.id)}">${s.ended ? '回顾' : '继续'} ${icon('arrow')}</button></div>`).join('') : '<div class="empty-state">✧<p>还没有写下的故事，正在等你。</p><button class="primary-button" data-action="create" data-world="fantasy">开启第一段旅途</button></div>'}</div><div class="import-section"><label class="text-button" for="import-file">${icon('save')}导入存档凭据</label><input id="import-file" type="file" accept="application/json,.json" hidden><p>存档保存在此服务器；导入凭据可在另一台设备上继续。</p></div>`, '我的故事');
}
function settingsDialog() {
  state.rpgTab = null;
  modal.className = 'standard-dialog settings-dialog';
  openDialog(`${dialogHead('游玩指南')}<div class="settings-content">${modeBadge()}<h3>你的选择，决定故事</h3><p>每一段冒险都由 AI 主持。选择主题、角色背景、天赋和故事语言后，就可以直接启程；也可以随时写下自己的行动，让故事向新的方向发展。</p><div class="rules-note"><h3>${icon('dice')}一枚骰子，很多可能</h3><p>行动掷 D20，加上对应能力，达到难度即成功。自然 20 为大成功，1 为大失败。失败仍推进故事，叙事 / 经典 / 挑战分别失去 3 / 5 / 8 点生命。</p><p>AI 故事没有固定回合上限。章节自然收尾后，可以休整并继续下一章，沿用人物、行囊和过往经历。</p><p>行囊中可以使用道具和穿戴装备；装备与天赋会影响检定和战斗。战斗技能与药剂消耗一个回合，对手会反击。装备与天赋面板中的月光演武可以练习战斗。</p><p>进度自动保存，手机和网页都可以继续游玩。</p></div></div>`, '游玩指南');
}
function journalDialog() {
  modal.className = 'standard-dialog journal-dialog';
  const s = state.session;
  state.rpgTab = null;
  openDialog(`${dialogHead('旅途记录', `${worldOfSession(s).name} · ${s.character.name}`)}<div class="journal-entries">${s.history.length ? s.history.map(h => `<details class="journal-entry"><summary><span class="journal-index">${h.turn.toString().padStart(2, '0')}</span><div><strong>${esc(h.scene.title)}</strong><small>${esc(h.action.label)}</small></div><span class="journal-outcome ${h.roll?.success ? 'success' : ''}">${h.roll ? h.roll.success ? '成功' : '受挫' : h.kind === 'rpg' ? '成长' : '新章'}</span></summary><div class="journal-detail">${paragraphs(h.scene.narrative)}<p class="journal-summary">${esc(h.summary)}</p><small>${h.roll ? `D20 ${h.roll.natural} + ${h.roll.modifier} = ${h.roll.total} / 难度 ${h.roll.dc}` : h.kind === 'rpg' ? h.summary : `章节续写 · 休整恢复 ${h.restoredHp || 0} 生命`}</small></div></details>`).join('') : '<div class="empty-state">✧<p>旅程刚刚开始。你的第一个选择，会写在这里。</p></div>'}<div class="journal-current"><small>此刻</small><strong>${esc(s.scene.title)}</strong></div></div><button class="small-button" data-action="export">${icon('save')}导出故事与存档凭据</button>`, '旅途记录');
}
async function resume(id, credentials = null) {
  if (state.busy) return;
  const save = credentials || state.saves.find(s => s.id === id);
  if (!save) return toast('找不到这个存档入口。');
  state.busy = true;
  toast('正在展开这段旅途…');
  try {
    const { session } = await api(`/api/sessions/${encodeURIComponent(id)}`, { token: save.token });
    state.session = session; state.token = save.token; state.screen = 'story'; state.pending = null;
    persist(); modal.close(); window.scrollTo(0, 0);
  } catch (error) { toast(error.message); }
  finally { state.busy = false; render(); }
}
async function turn(payload, kind = 'turn') {
  if (state.busy || !state.session || (kind === 'turn' && state.session.ended) || (kind === 'continue' && !state.session.ended)) return;
  const fingerprint = JSON.stringify({ kind, id: state.session.id, version: state.session.version, ...payload });
  if (state.pending && state.pending.fingerprint !== fingerprint) {
    // First reconcile a possibly committed response before permitting a different action.
    try {
      const result = await api(`/api/sessions/${state.session.id}`, { token: state.token });
      if (result.session.version !== state.session.version) {
        state.session = result.session; state.pending = null; persist(); render();
        toast('上一回合已经完成，已恢复最新进度。'); return;
      }
    } catch (error) { toast(error.message); return; }
  }
  const input = state.pending?.fingerprint === fingerprint ? state.pending.input : { ...payload, version: state.session.version, requestId: requestId() };
  state.pending = { input, fingerprint };
  state.busy = true;
  const draft = $('#custom-input')?.value;
  const continuationDirection = $('#continue-direction')?.value;
  const selectedSkill = $('#action-form select')?.value;
  render();
  if (kind === 'rpg' && state.rpgTab && modal.open) rpgDialog(state.rpgTab);
  try {
    const result = await api(`/api/sessions/${state.session.id}/${kind}`, { method: 'POST', body: JSON.stringify(input), token: state.token });
    state.session = result.session; state.pending = null; persist();
    state.busy = false; render();
    if (kind === 'rpg' && $('#custom-input')) { $('#custom-input').value = draft || ''; $('#action-form select').value = selectedSkill || 'insight'; $('#action-counter').textContent = `${(draft || '').length} / 500`; }
    if (kind === 'rpg') { if (payload.type === 'trial') { modal.close(); state.rpgTab = null; } else if (state.rpgTab && modal.open) rpgDialog(state.rpgTab); }
    else $('.story-paper').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
  } catch (error) {
    if (error.status === 409) {
      try { const result = await api(`/api/sessions/${state.session.id}`, { token: state.token }); state.session = result.session; state.pending = null; persist(); } catch { /* Keep the recoverable local view. */ }
    }
    toast(error.message);
    state.busy = false; render();
    if (kind === 'rpg' && state.rpgTab && modal.open) rpgDialog(state.rpgTab);
    if ($('#custom-input')) { $('#custom-input').value = draft || ''; $('#action-form select').value = selectedSkill || 'insight'; $('#action-counter').textContent = `${(draft || '').length} / 500`; }
    if ($('#continue-direction')) $('#continue-direction').value = continuationDirection || '';
  } finally { state.busy = false; }
}
function exportStory() {
  const s = state.session;
  if (!s) return;
  const download = (content, name, mime) => {
    const url = URL.createObjectURL(new Blob([content], { type: mime }));
    const link = document.createElement('a'); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const safeName = s.character.name.replace(/[^\p{L}\p{N}_-]/gu, '_');
  const content = `星叙 · ${worldOfSession(s).name}\n主角：${s.character.name}${s.character.title ? ` · ${s.character.title}` : ''}\n主持：AI 主持\n\n${s.history.map(h => `${h.scene.chapter}\n${h.scene.title}\n\n${h.scene.narrative}\n\n> ${h.action.label}\n${h.roll ? `D20 ${h.roll.natural} + ${h.roll.modifier} = ${h.roll.total}，难度 ${h.roll.dc}，${h.roll.success ? '成功' : '受挫'}` : h.kind === 'rpg' ? h.summary : `章节续写 · 休整恢复 ${h.restoredHp || 0} 生命`}\n`).join('\n——————\n\n')}\n${s.scene.chapter}\n${s.scene.title}\n\n${s.scene.narrative}\n\n当前目标：${s.quest}`;
  modal.className = 'standard-dialog';
  openDialog(`${dialogHead('把旅途带走')}<div class="settings-content"><p>故事文件可阅读和分享。存档凭据用于在同一服务器上继续，请妥善保管。</p><button id="download-story" class="primary-button">${icon('book')}下载故事 .txt</button><button id="download-save" class="small-button export-save">${icon('save')}下载存档凭据 .json</button><p class="field-note">凭据不是完整数据库备份；服务器的 data 文件夹需要保留。</p></div>`, '导出故事');
  $('#download-story').onclick = () => download(content, `星叙_${safeName}.txt`, 'text/plain;charset=utf-8');
  $('#download-save').onclick = () => download(JSON.stringify({ format: 'storybound-save-v1', id: s.id, token: state.token }, null, 2), `星叙_${safeName}_存档.json`, 'application/json');
}

document.addEventListener('click', event => {
  const button = event.target.closest('[data-action]');
  if (!button || button.disabled) return;
  const action = button.dataset.action;
  if (state.busy && ['home', 'current', 'create', 'resume', 'choose'].includes(action)) return toast('请等主持人回应后再继续。');
  if (action === 'home') { state.screen = 'home'; modal.close(); render(); window.scrollTo(0, 0); }
  if (action === 'current') { state.screen = 'story'; render(); window.scrollTo(0, 0); }
  if (action === 'create') createDialog(button.dataset.world);
  if (action === 'rpg-open') { if (!state.busy) rpgDialog(button.dataset.tab); }
  if (action === 'rpg-do') {
    if (state.busy) return;
    const payload = { type: button.dataset.type };
    for (const key of ['itemId', 'recipeId', 'questId', 'slot', 'skill', 'abilityId']) if (button.dataset[key]) payload[key] = button.dataset[key];
    turn(payload, 'rpg');
  }
  if (action === 'close') { state.rpgTab = null; if ($('#create-form button[type="submit"]')?.disabled) return; modal.close(); }
  if (action === 'settings') settingsDialog();
  if (action === 'saves') savesDialog();
  if (action === 'resume') resume(button.dataset.id);
  if (action === 'journal') journalDialog();
  if (action === 'choose') turn({ choiceId: button.dataset.id });
  if (action === 'export') exportStory();
});
document.addEventListener('submit', async event => {
  if (event.target.id === 'playtest-form') {
    event.preventDefault();
    if (state.busy) return;
    const form = event.target, button = form.querySelector('button[type="submit"]');
    state.busy = true; button.disabled = true;
    try { await api('/api/playtest/login', {method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(form)))}); state.config = await api('/api/config'); render(); }
    catch (error) { const message = $('#playtest-error'); if (message) message.textContent = error.message; }
    finally { state.busy = false; button.disabled = false; }
  }
  if (event.target.id === 'action-form') { event.preventDefault(); const data = Object.fromEntries(new FormData(event.target)); if (!data.action.trim()) return toast('先写下你想尝试的行动。'); await turn(data); }
  if (event.target.id === 'continue-form') { event.preventDefault(); await turn(Object.fromEntries(new FormData(event.target)), 'continue'); }
  if (event.target.id === 'create-form') {
    event.preventDefault();
    if (state.busy) return;
    state.busy = true;
    const form = event.target;
    const button = form.querySelector('button[type="submit"]');
    const errorElement = $('#create-error');
    const data = Object.fromEntries(new FormData(form));
    button.disabled = true; button.innerHTML = '<span class="thinking-dots">···</span> 正在写下第一幕'; errorElement.textContent = '';
    try {
      const result = await api('/api/sessions', { method: 'POST', body: JSON.stringify(data) });
      state.session = result.session; state.token = result.token; state.screen = 'story'; state.pending = null;
      persist(); modal.close(); render(); window.scrollTo(0, 0);
    } catch (error) { errorElement.textContent = error.message; }
    finally { state.busy = false; button.disabled = false; button.innerHTML = `开启冒险 ${icon('arrow')}`; if (state.screen === 'story') render(); }
  }
});
document.addEventListener('input', event => {
  if (event.target.id === 'custom-input') $('#action-counter').textContent = `${event.target.value.length} / 500`;
  if (event.target.name === 'difficulty') $('#difficulty-description').textContent = state.config.difficulties.find(d => d.id === event.target.value).description;
});
document.addEventListener('change', async event => {
  if (event.target.id === 'protagonist') {
    const royal = event.target.value === 'princess-elya';
    $('#character-concept').disabled = royal;
    const preset = state.config.protagonists.find(p => p.id === event.target.value);
    if (state.config.protagonists.some(p => p.defaultName === $('#name').value)) $('#name').value = preset.defaultName;
  }
  if (event.target.id === 'story-language' && $('#name').value === '阿星' && event.target.value === 'en') $('#name').value = 'Alex';
  if (event.target.id !== 'import-file') return;
  const file = event.target.files[0];
  if (!file) return;
  try {
    if (file.size > 8192) throw new Error('请选择导出的存档凭据文件。');
    const data = JSON.parse(await file.text());
    if (data.format !== 'storybound-save-v1' || !/^[a-f0-9-]{36}$/.test(data.id) || !/^[a-f0-9]{64}$/.test(data.token)) throw new Error('这不是有效的存档凭据。');
    await resume(data.id, data);
  } catch (error) { toast(error.message || '无法读取存档凭据。'); }
});
modal.addEventListener('cancel', event => { if (state.busy) event.preventDefault(); });
async function boot() {
  try {
    if (accessLinkError) throw accessLinkError;
    if (accessLink) {
      await api(accessLink.path, { method: 'POST', body: JSON.stringify(accessLink.data) });
      accessLink = null;
    }
    state.config = await api('/api/config'); render();
  }
  catch (error) { app.innerHTML = `<div class="boot"><span class="boot-star">✧</span><h1>故事暂时还未展开</h1><p>${esc(error.message)}</p><button id="retry" class="primary-button">重新连接 ${icon('arrow')}</button></div>`; $('#retry').onclick = boot; }
}
boot();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
