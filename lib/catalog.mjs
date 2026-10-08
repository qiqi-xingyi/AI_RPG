export const PRINCESS = {
  id: 'princess-elya', defaultName: '艾莉娅', title: '艾尔维亚公主', age: 23,
  appearance: '银金色长发柔软地垂在肩头，紫水晶般的眼睛明亮清澈；精致的月石王冠与淡紫色礼裙衬着她温柔而自信的笑容。',
  personality: '温柔、聪慧、勇敢，有自己的判断；珍惜同伴，也愿意为自己的选择承担责任。',
  portrait: '/assets/princess-elya.png',
};

export const SKILLS = {
  might: { name: '力量', icon: 'sword' },
  insight: { name: '洞察', icon: 'eye' },
  agility: { name: '敏捷', icon: 'wind' },
  charm: { name: '魅力', icon: 'spark' },
};

export const ROLES = [
  { id: 'wanderer', name: '旅人', subtitle: '与未知同行', description: '敏捷的探索者，擅长潜行与发现。', icon: 'compass', modifiers: { might: 1, insight: 2, agility: 4, charm: 1 } },
  { id: 'guardian', name: '守护者', subtitle: '直面风暴', description: '坚韧的行动者，力量是你的底牌。', icon: 'shield', modifiers: { might: 4, insight: 1, agility: 1, charm: 2 } },
  { id: 'scholar', name: '学者', subtitle: '看见真相', description: '敏锐的观察者，解开世界的谜题。', icon: 'book', modifiers: { might: 0, insight: 5, agility: 1, charm: 2 } },
  { id: 'storyteller', name: '吟游者', subtitle: '言语亦是魔法', description: '天生的交涉者，让陌生人成为盟友。', icon: 'spark', modifiers: { might: 1, insight: 2, agility: 1, charm: 4 } },
];

const choice = (id, label, hint, skill, approach, dc = 11) => ({ id, label, hint, skill, approach, dc });
export const WORLDS = [
  {
    id: 'fantasy', name: '公主与星之冠', genre: '公主童话', english: 'THE PRINCESS & THE STAR CROWN', color: '#b7c7ab', art: PRINCESS.portrait, sceneArt: PRINCESS.portrait,
    description: '加冕前夜，漂亮的公主踏上寻找星之冠的旅程。', tags: ['公主主角', '月光童话', '命运抉择'],
    quest: '找回失落的星之冠，追寻母后留下的秘密',
    premise: '主角是23岁的艾尔维亚公主，玩家可以为她改名。她有银金色长发、紫水晶般的眼睛、精致月石王冠与淡紫色礼裙，漂亮、温柔、聪慧且勇敢。加冕前夜，王国的星之冠失踪，公主收到失踪母后留下的来信，从月光宫苑主动出发，寻找王冠与真相。主线围绕她的王室身份、与母后的羁绊、同伴关系和她对王国未来的选择展开；让她主动解谜、谈判或冒险，不安排替她作决定的救世主，也不强迫婚姻。',
    locations: ['月光宫苑', '星落灯塔', '镜月密室', '沉眠观星台', '群星之门'],
    opening: {
      title: '公主的加冕前夜', location: '月光宫苑', chapter: '第一章 · 月光下的王冠',
      narrative: '{{name}}公主站在月光宫苑的蔷薇长廊下。银金色长发被晚风轻轻拂起，紫水晶般的眼睛映着漫天星辉；月石王冠与淡紫色礼裙的细致金绣，在夜色中泛着柔和的光。她美得像一页被月亮照亮的童话，笑容里却有属于自己的坚定。\n\n明天本该是你的加冕礼。然而，就在钟声响起之前，星之冠从王宫中消失了。你收到一封母后失踪前留下的信：「亲爱的孩子，如果星冠不再发光，请去寻找守灯人的女儿。别让任何人替你决定，怎样才算一个好公主。」\n\n你把信放进随身的小行囊，亲自推开花园的门。一只角间缠着星辉的白鹿正等在宫苑尽头；远处，古老灯塔亮起银色的光。你的故事，从这一刻开始。',
      choices: [choice('follow', '跟随白鹿，离开月光宫苑', '循着星辉，寻找母后留下的路。', 'insight', 'explore'), choice('tower', '披上斗篷，亲自前往灯塔', '王冠的答案，值得你主动追寻。', 'might', 'bold'), choice('letter', '解读母后来信中的暗纹', '王室的秘密，也许藏在熟悉的字迹里。', 'insight', 'investigate')],
    },
    clue: '星纹铜钥匙', ally: '守灯人的女儿莉亚', mystery: '星之冠靠封存王后与臣民的珍贵记忆发光，母后取下王冠，是为了让公主有机会结束这场牺牲',
    endings: {
      explore: '你打开群星之门，让王冠中被囚禁的记忆化作星辉，回到母后与每一个臣民的心里。母后在门后向你伸出手；你握住她，然后决定以自己的方式走向王国的明天。',
      bold: '你亲手解开星之冠的旧锁。王冠不再靠别人的遗忘发光，而是映出你守护同伴的勇气。母后沿着星雨归来，站在你身旁，见证你为王国立下新的誓言。',
      investigate: '你读懂母后留下的最后一行字，改写了星之冠的古老誓约。记忆不再是加冕的代价。天亮时，母后替你拂去发间的花瓣，说：这才是属于你的王冠。',
      social: '你邀请母后、守灯人的女儿与王国的居民，一同决定星之冠的未来。加冕礼不再是一场牺牲，而是一份共同的承诺。你戴上属于自己的月石王冠，温柔而坚定地迎向晨光。',
    },
  },
  {
    id: 'noir', name: '午夜来信', genre: '悬疑调查', english: 'LETTERS AFTER MIDNIGHT', color: '#c7a886', art: '/assets/noir.svg',
    description: '雨夜的旧城，藏着一个被所有人遗忘的名字。', tags: ['都市谜案', '线索推理', '秘密交易'],
    premise: '1930年代架空港城，一名已经失踪三年的歌手给玩家寄来明晚的车票。旧城的钟会在午夜多敲一下。故事悬疑但不血腥，线索可交叉验证。',
    locations: ['雨巷车站', '月蚀俱乐部', '旧城档案馆', '钟楼密室', '第十三号站台'],
    opening: {
      title: '第十三声钟响', location: '雨巷车站', chapter: '第一章 · 没有终点的车票',
      narrative: '雨水沿着车站的铁皮屋檐落下。你手中是一张没有目的地的车票，寄件人的名字属于一位失踪三年的歌手。背面写着：「午夜之前，别让他们认出你。」\n\n大厅里的时钟停在十一点五十九分。一名穿灰色大衣的女人把行李箱放在你身旁，说了一声「终于来了」，便消失在蒸汽中。\n\n箱子里传来轻微的音乐声。检票员正从走廊另一端向你走来，手上拿着一张与你极为相似的旧照片。',
      choices: [choice('box', '打开行李箱，寻找线索', '那首歌，也许从未真正结束。', 'insight', 'investigate'), choice('hide', '避开检票员，追上女人', '在城市的阴影里寻找答案。', 'agility', 'explore'), choice('talk', '主动向检票员问话', '一段对话，可能比一场追逐更有用。', 'charm', 'social')],
    },
    clue: '刻着十三的唱片', ally: '报社记者沈秋', mystery: '失踪的人仍在第十三号站台，他们在保护一份能揭露旧城骗局的证词',
    endings: { explore: '你带着滞留在站台的人们穿过废弃隧道。天亮时，他们的名字重新出现在城市的档案里；那班没有终点的列车终于停了下来。', bold: '你拉响钟楼警报，把那份证词送到整座城市面前。雨停了，隐瞒真相的人再也无处躲藏。', investigate: '你拼齐唱片与档案的证据，让那位歌手在广播里唱出了所有被抹去的名字。旧城终于记起他们。', social: '你促成记者、检票员与失踪者的共同作证。午夜的钟只敲了十二下，一封新的来信上写着：谢谢你相信我们。' },
  },
  {
    id: 'cyber', name: '霓虹边界', genre: '赛博未来', english: 'BEYOND THE NEON', color: '#bea4d0', art: '/assets/cyber.svg',
    description: '当记忆可以交易，什么才是真正属于你的？', tags: ['人工意识', '霓虹都市', '身份谜题'],
    premise: '近未来霓虹城，一段不属于玩家的记忆出现在脑海中。市政主脑宣布零点重置，城中的仿生人突然开始做梦。只写虚构技术，不提供真实攻击操作。',
    locations: ['下城区天桥', '记忆交易所', '废弃中继站', '云端花园', '城市核心'],
    opening: {
      title: '一段不属于你的记忆', location: '下城区天桥', chapter: '第一章 · 零点重置',
      narrative: '广告屏的粉紫色光映在积水里。你站在下城区天桥上，脑海中却闪过一片从未见过的海。有人在那段记忆里喊出了你的名字。\n\n腕上的终端显示一条匿名消息：「别卖掉这段记忆。它是整座城市最后的备份。」市政广播同时响起：距离零点重置，还有三个小时。\n\n桥下的仿生花贩抬起头，递给你一朵真正的花。「我昨晚梦到了海，」她轻声说，「你也一样，对吗？」',
      choices: [choice('memory', '解析陌生记忆的来源', '在碎片中找回一条完整的线。', 'insight', 'investigate'), choice('vendor', '询问花贩的梦', '也许意识并不只属于人类。', 'charm', 'social'), choice('bridge', '前往记忆交易所', '答案就在城市最亮的阴影里。', 'agility', 'explore')],
    },
    clue: '离线记忆晶片', ally: '仿生花贩零七', mystery: '主脑的重置会抹去仿生人的新生意识，而那片海是它们共同的第一个梦',
    endings: { explore: '你把城市的梦保存在独立的花园里。仿生人沿着旧轨道走向真正的大海，第一次拥有了不被定价的明天。', bold: '你切断了重置装置的虚构能量枢纽。霓虹屏幕暗下去，天边的日出却亮了起来。整座城市听见了仿生人的心声。', investigate: '你证明了那些梦是独立意识的证据。市政停止重置，记忆不再只是商品，而成为每个人可以保留的历史。', social: '你让人类与仿生人在云端花园共同表决。重置被取消，零七把第一朵真正的花别在你的衣领上。' },
  },
  {
    id: 'wuxia', name: '山海旧梦', genre: '东方仙侠', english: 'ECHOES OF SHANHAI', color: '#b4c4c9', art: '/assets/wuxia.svg',
    description: '循一缕剑意入山海，赴一场跨越千年的约。', tags: ['山海异闻', '江湖羁绊', '修行奇遇'],
    premise: '架空东方仙侠，昆仑山的河流开始倒流。一位失忆剑客与玩家在渡口相遇，千年前的盟约即将到期。人妖均有善恶，选择可和平可冒险。',
    locations: ['青苇渡口', '听雨古寺', '倒流之河', '昆仑问心台', '山海石门'],
    opening: {
      title: '逆流而来的纸舟', location: '青苇渡口', chapter: '第一章 · 故人未归',
      narrative: '暮色笼住青苇渡口，河面上却漂来一只逆流而行的纸舟。舟上压着一枚玉佩，与你随身佩戴的那枚恰好能合在一起。\n\n渡口的老船夫望见玉佩，缓缓放下竹篙。「这场约，已经等了一千年。」远山传来一声清越的剑鸣，群鸟却没有惊起。\n\n一位白衣剑客从雨中走来，剑鞘空空。他不记得自己的名字，却记得你。他说：「石门开时，千万别替我做选择。」',
      choices: [choice('jade', '查看玉佩上的古老铭文', '旧日的盟约，总会留下痕迹。', 'insight', 'investigate'), choice('swordsman', '与失忆剑客同行', '从陌生人开始，续写一段羁绊。', 'charm', 'social'), choice('river', '乘舟追寻逆流的源头', '踏入山海，直面天意。', 'might', 'bold')],
    },
    clue: '合璧山海玉', ally: '失忆剑客云归', mystery: '千年盟约靠封存剑客的记忆维系，而逆流的河是他不愿再次遗忘的心意',
    endings: { explore: '你沿逆流找到盟约之外的道路，让河水重新流向大海。云归终于记起自己的名字，而纸舟载着新的愿望顺流而下。', bold: '你与云归并肩斩开石门的旧锁。剑意落下时没有伤及一人；千年的盟约化为细雨，人们学会自己守护山海。', investigate: '你读懂玉佩缺失的那一行字：盟约可以被共同的承诺取代。人们重新立约，再也不需要牺牲任何人的记忆。', social: '你召集河岸的村民与山中的灵物，在问心台重新讲述彼此的故事。云归收起剑，决定以自己的名字留在人间。' },
  },
];

export const DIFFICULTIES = [
  { id: 'story', name: '叙事', description: '享受故事，失败的代价更轻', dc: -2, damage: 3 },
  { id: 'balanced', name: '经典', description: '机遇与风险，恰到好处', dc: 0, damage: 5 },
  { id: 'hard', name: '挑战', description: '每一次选择都更有分量', dc: 3, damage: 8 },
];

export function catalog() {
  return { protagonist: PRINCESS, worlds: WORLDS.map(({ premise, opening, locations, clue, ally, mystery, endings, quest, ...world }) => world), roles: ROLES, skills: SKILLS, difficulties: DIFFICULTIES };
}
export function demoChoices(stage) {
  if (stage === 1) return [choice('search', '循着线索继续探索', '离开熟悉的路，听见世界的回声。', 'agility', 'explore'), choice('ally', '和相遇的人交换消息', '每个人都有尚未说出口的故事。', 'charm', 'social'), choice('clue', '解读刚刚发现的物件', '拼起真相的第一块碎片。', 'insight', 'investigate')];
  if (stage === 2) return [choice('unlock', '解开通往深处的机关', '用观察代替蛮力。', 'insight', 'investigate', 12), choice('force', '正面突破阻挡', '用勇气为自己开一条路。', 'might', 'bold', 12), choice('detour', '寻找另一条入口', '总有被忽略的缝隙。', 'agility', 'explore', 12)];
  if (stage === 3) return [choice('truth', '追问被隐藏的真相', '了解代价，才能做出选择。', 'insight', 'investigate', 12), choice('trust', '说服同伴共同面对', '一个人的决定，可以成为共同的承诺。', 'charm', 'social', 12), choice('act', '先保护眼前的人', '让行动比犹豫更快。', 'might', 'bold', 12)];
  return [choice('restore', '寻找一条新的道路', '把未来交还给每一个人。', 'agility', 'explore', 13), choice('break', '打破束缚世界的旧规则', '即使冒险，也值得一试。', 'might', 'bold', 13), choice('reveal', '用真相改变结局', '让那些声音终于被听见。', 'insight', 'investigate', 13), choice('unite', '让所有人一起做决定', '选择不必由一个人承担。', 'charm', 'social', 13)];
}

export function demoTurn(session, action, roll) {
  const world = WORLDS.find(w => w.id === session.worldId);
  const stage = (session.storyTurns ?? session.version) + 1;
  const consequence = roll.success ? '你的判断没有落空。原本闭合的道路向你敞开，你也赢得了一点珍贵的信任。' : '事情没有按计划进行。你在匆忙中受了轻伤，却也因此发现了原本会错过的痕迹。失败没有结束旅程，只是让它转向另一条路。';
  const approachLines = { explore: '你避开显眼的正路，循着细微的痕迹前行。', bold: '你没有继续等待，主动走向阻挡在前方的危险。', investigate: '你把零散线索放在一起，开始看见隐藏的联系。', social: '你放慢脚步，认真听完对方的故事。原本紧绷的气氛终于缓和。' };
  const custom = action.custom ? '你提出了一个自己的办法。在演示剧本中，主持人将按你选择的能力，把它作为这次行动的尝试。' : '';
  const ending = stage >= 5;
  const royal = session.character.protagonistId === PRINCESS.id;
  const royalAddress = royal ? `${session.character.name}公主` : session.character.name;
  const narrative = ending
    ? `${approachLines[action.approach]}${consequence}\n\n${world.endings[action.approach]}\n\n${royalAddress}，这段旅程因为你的选择，留下了属于你的结局。${roll.success ? '你与同伴带着希望踏上了归途。' : '虽然留下了伤痕，你仍然守住了最重要的东西。'}`
    : `${custom}${approachLines[action.approach]}${consequence}\n\n${[
      '',
      `在${world.locations[1]}附近，你遇见了${world.ally}。对方认出了你带来的来信，将一件${world.clue}交到你手中。「先别急着做决定，」对方说，「你还没有看见故事的另一面。」`,
      `你们进入${world.locations[2]}。墙上的记录与外面流传的故事截然不同：有人一直在替所有人做选择。${session.flags.includes('social') ? '先前建立的信任让同伴愿意说出一条家族的秘密。' : session.flags.includes('investigate') ? '你先前仔细记录的细节，在此刻成为解读记录的关键。' : '先前探索过的道路，让你在这里认出了一条隐蔽的退路。'}`,
      `来到${world.locations[3]}时，${world.ally}终于说出真相：${world.mystery}。你可以继续追问，也可以先保护眼前的人。没有谁能替你决定什么更重要。`,
      `最后一道门前，${world.clue}在你掌心微微发亮。你曾经的选择已经改变了同行者对你的看法。${session.flags.includes('social') ? '曾被你说服的人也赶到这里，愿意与你并肩。' : '同行者把决定权留给你，但也承诺不会让你独自承担后果。'}现在，故事等待你写下最后一笔。`,
    ][stage]}`;
  return {
    title: ending ? '属于你的结局' : ['', '不期而遇的同行者', '门后的另一段历史', '真相的重量', '最后一道门'][stage],
    chapter: ending ? '终章 · 星叙未完' : `第${['', '二', '三', '四', '五'][stage]}章 · ${world.name}`,
    location: world.locations[Math.min(stage, 4)], narrative,
    choices: ending ? [] : demoChoices(stage),
    summary: `${royalAddress}选择「${action.label}」，${roll.success ? '判定成功' : '受挫但继续前进'}。${ending ? '完成冒险。' : `抵达${world.locations[Math.min(stage, 4)]}。`}`,
    memory: [...session.memory, `第${stage}回合采取${action.approach}方式，${roll.success ? '成功' : '受挫'}。`].slice(-12),
    inventoryAdd: stage === 1 ? [world.clue] : [], inventoryRemove: [],
    quest: ending ? (session.worldId === 'fantasy' ? '已完成：为公主与王国选择新的未来' : '已完成：为这段故事选择未来') : stage >= 3 ? '决定真相被揭开之后的未来' : world.quest || '找到来信背后的真相',
    ended: ending,
  };
}
