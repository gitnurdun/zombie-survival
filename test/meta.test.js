'use strict';
// 元进度验收：Perk 装备与生效 · 角色解锁与加成 · 图鉴解锁 · 成就判定 · 新手引导。
// 跑法：node test/meta.test.js
const { load, ok, eq, section, summary } = require('./harness');

function fresh() {
  const env = load();
  const tg = env.tg;
  tg.startLevel(1);
  return env;
}
function tick(tg, n = 1) { for (let i = 0; i < n; i++) tg.step(1 / 60); }
const P = tg => tg.perkStats();
const CHARS_HANK_HP = () => 120;   // 老农 Hank 的基础血量

// ─────────────────────────────────────────────────────
section('① Perk 数据完整性');
{
  const env = fresh();
  const { tg } = env;
  const K = tg.perks();
  const list = Object.values(K);
  eq(list.length, 12, '一共 12 个 Perk');
  eq(new Set(list.map(p => p.name)).size, 12, '名字互不重复');
  ok(list.every(p => p.max === 3), '每个最高 3 级');
  ok(list.every(p => p.cost.length === 3), '每级都有价格');
  ok(list.every(p => p.desc && p.stat), '每个都有说明和数值');
  const cats = {};
  for (const p of list) cats[p.cat] = (cats[p.cat] || 0) + 1;
  eq(Object.keys(cats).sort().join(','), 'fire,scav,surv', '分成 生存 / 火力 / 拾荒 三类');
  ok(cats.surv >= 3 && cats.fire >= 3 && cats.scav >= 3, '每类至少 3 个',
    JSON.stringify(cats));
}

// ─────────────────────────────────────────────────────
section('② 装备 3 个 Perk，属性聚合正确');
{
  const env = fresh();
  const { tg } = env;
  const S = tg.save();
  // 不装任何东西时是基准值
  const base = P(tg);
  eq(base.hpAdd, 0, '基础血量加成 0');
  eq(base.spdMul, 1, '基础移速倍率 1');
  ok(Math.abs(base.meleeMul - 1.15) < 1e-6, '默认角色 Hank 近战 ×1.15（角色加成也算进聚合表）', base.meleeMul.toFixed(2));

  S.perkLv = { armor: 3, sprint: 2, crit: 2 };
  S.perkSlots = ['armor', 'sprint', 'crit'];
  tg.startLevel(1);
  const p = P(tg);
  eq(p.hpAdd, 90, '防弹背心 Lv3 → 最大生命 +90');
  ok(Math.abs(p.spdMul - 1.20) < 1e-6, '疾跑 Lv2 → 移速 ×1.20', p.spdMul.toFixed(2));
  ok(Math.abs(p.critAdd - 0.12) < 1e-6, '爆头大师 Lv2 → 暴击率 +12%', p.critAdd.toFixed(2));
  ok(Math.abs(p.critDmgMul - 1.5) < 1e-6, '爆头大师 Lv2 → 暴击伤害 +50%', p.critDmgMul.toFixed(2));
  eq(tg.player().maxHp, CHARS_HANK_HP() + 90, '玩家的 maxHp = Hank 的 120 + 90', tg.player().maxHp);

  // 只算装备槽里的 —— perkLv 里升了但没装备的不该生效
  S.perkSlots = ['armor', null, null];
  tg.startLevel(1);
  eq(P(tg).hpAdd, 90, '仍装备的防弹背心生效');
  eq(P(tg).spdMul, 1, '卸下疾跑后移速回到基准');
}

// ─────────────────────────────────────────────────────
section('③ Perk 真的影响战斗');
{
  const env = load();
  const { tg } = env;
  const S = tg.save();
  // 近战狂人 Lv3 → 近战伤害 ×1.9
  S.perkLv = { melee: 3 };
  S.perkSlots = ['melee', null, null];
  tg.startLevel(1);
  tg.noWave(); tg.props().length = 0; tg.clearFloors(); tg.zombies().length = 0;
  tg.place(2000);
  tg.giveWeapons(['bat']);
  const z = tg.spawnAt('normal', 2050);
  z.hp = z.maxHp = 1e6; z.spd = 0; z.atkT = 999;
  const before = z.hp;
  tg.hold('Space'); tick(tg, 3); tg.release('Space');
  tick(tg, 10);
  const withPerk = before - z.hp;
  tg.zombies().length = 0;

  // 对照组：不装
  S.perkLv = {}; S.perkSlots = [null, null, null];
  tg.startLevel(1);
  tg.noWave(); tg.props().length = 0; tg.clearFloors(); tg.zombies().length = 0;
  tg.place(2000);
  tg.giveWeapons(['bat']);
  const z2 = tg.spawnAt('normal', 2050);
  z2.hp = z2.maxHp = 1e6; z2.spd = 0; z2.atkT = 999;
  const b2 = z2.hp;
  tg.hold('Space'); tick(tg, 3); tg.release('Space');
  tick(tg, 10);
  const without = b2 - z2.hp;

  ok(withPerk > without, '装了「近战狂人」打出更多伤害',
    without + ' → ' + Math.round(withPerk) + '（约 ×' + (withPerk / without).toFixed(2) + '）');
  ok(withPerk / without > 1.5, '倍率接近 1.9');
}

// ─────────────────────────────────────────────────────
section('④ 角色：解锁条件与加成');
{
  const env = fresh();
  const { tg } = env;
  const S = tg.save();
  const C = tg.chars();
  eq(Object.keys(C).length, 5, '一共 5 个角色');

  S.unlocked = 1; S.cleared = {}; S.demonUnlocked = false;
  eq(tg.charUnlocked('hank'), true, '老农 Hank 初始可用');
  eq(tg.charUnlocked('reyes'), false, '退伍兵 Reyes 需要通关第 3 关');
  eq(tg.charUnlocked('mira'), false, '护士 Mira 需要第 6 关');
  eq(tg.charUnlocked('ozzy'), false, '机械师 Ozzy 需要第 9 关');
  eq(tg.charUnlocked('duke'), false, '疯子 Duke 需要击杀 Boss');

  S.cleared = { 3: { stars: 2 }, 6: { stars: 1 }, 9: { stars: 3 } };
  eq(tg.charUnlocked('reyes'), true, '通关第 3 关后解锁 Reyes');
  eq(tg.charUnlocked('mira'), true, '第 6 关 → Mira');
  eq(tg.charUnlocked('ozzy'), true, '第 9 关 → Ozzy');
  S.demonUnlocked = true;
  eq(tg.charUnlocked('duke'), true, '击杀 Boss 后解锁 Duke');

  // 角色加成真的生效
  S.curChar = 'duke'; tg.startLevel(1);
  eq(tg.player().maxHp, 70, 'Duke 的 HP 是 70', tg.player().maxHp);
  ok(P(tg).ammoMul >= 2, 'Duke 弹药上限 ×2', P(tg).ammoMul.toFixed(2));
  S.curChar = 'ozzy'; tg.startLevel(1);
  ok(P(tg).shopMul < 1, 'Ozzy 商店有折扣', P(tg).shopMul.toFixed(2));
  ok(tg.player().weapons.some(w => w.baseId === 'saw'), 'Ozzy 起始带电锯');
  S.curChar = 'reyes'; tg.startLevel(1);
  ok(tg.player().weapons.some(w => w.baseId === 'pistol'), 'Reyes 起始带手枪');
  S.curChar = 'hank'; tg.startLevel(1);
  ok(Math.abs(P(tg).meleeMul - 1.15) < 1e-6, 'Hank 近战 +15%', P(tg).meleeMul.toFixed(2));
}

// ─────────────────────────────────────────────────────
section('⑤ 图鉴：解锁前是 ???');
{
  const env = fresh();
  const { tg } = env;
  const S = tg.save();
  S.seen = { w: {}, z: {}, p: {} };
  tg.renderCodex('weapon');
  eq(tg.codexTab(), 'weapon', '武器页');
  tg.renderCodex('zombie');
  eq(tg.codexTab(), 'zombie', '僵尸页');
  tg.renderCodex('prop');
  eq(tg.codexTab(), 'prop', '物件页');

  // 解锁埋点：买枪 / 遇到僵尸 / 打碎物件
  S.seen = { w: {}, z: {}, p: {} };
  tg.startLevel(1); tg.noWave();
  tg.zombies().length = 0;
  tg.place(2000);
  tg.spawn('normal');
  eq(S.seen.z.normal, 1, '遇到僵尸会记进图鉴');
  const p = tg.props().find(x => x.kind === 'crate') || tg.props()[0];
  if (p) {
    const i = tg.props().indexOf(p);
    tg.damagePropAt(i, 999);
    eq(S.seen.p[p.kind], 1, '打碎物件会记进图鉴');
  }
}

// ─────────────────────────────────────────────────────
section('⑥ 成就：20 个，数据驱动，达成发钱');
{
  const env = fresh();
  const { tg } = env;
  const S = tg.save();
  const A = tg.achList();
  ok(A.length >= 20, '至少 20 个成就', A.length + ' 个');
  eq(new Set(A.map(a => a.id)).size, A.length, 'id 不重复');
  ok(A.every(a => a.name && a.desc && a.kind && a.reward > 0), '每个都有名字/说明/类型/奖励');

  S.stats = { kills: 0, crits: 0, propBreaks: 0, deaths: 0, bestCombo: 0 };
  S.ach = {}; S.cleared = {}; S.cash = 0; S.slots = ['bat', null, null];
  eq(tg.checkAch({ win: false }).length, 0, '什么都没做时不会凭空达成');

  S.stats.kills = 100;
  const got = tg.checkAch({ win: false });
  ok(got.some(a => a.id === 'k100'), '击杀 100 → 达成「初次收割」');
  ok(S.cash > 0, '成就发了金币', '$' + S.cash);
  // 同一个成就不会重复发钱
  const c1 = S.cash;
  tg.checkAch({ win: false });
  eq(S.cash, c1, '已达成的成就不会重复发钱');

  S.stats.kills = 10000; S.stats.crits = 1000; S.stats.deaths = 50; S.stats.bestCombo = 40;
  S.stats.propBreaks = 250; S.slots = ['bat', 'pistol', 'saw'];
  S.cleared = { 1:{stars:3}, 3:{stars:2}, 6:{stars:1}, 10:{stars:3}, 22:{stars:3} };
  // 补满 22 关（必须按编号来 —— 用 length 当 key 会在编号已存在时死循环）
  for (let i = 1; i <= 22; i++) if (!S.cleared[i]) S.cleared[i] = { stars: 1 };
  // 这一局是"理想局"：三星通关、无伤、安静、杀了 Boss、而且开着感染模式。
  // 每加一种"需要特殊条件"的成就，这里就要跟着补上对应的 run 字段。
  const all = tg.checkAch({ win: true, noMedkit: true, peakNoise: 20, bossKilled: true, infected: true });
  ok(all.length >= 15, '一次性达成一大批', all.length + ' 个');
  const left = tg.achList().filter(a => !S.ach[a.id]);
  ok(left.length === 0, '理想局之下，所有成就都解锁了（没有够不着的）',
    // 把 kind 也打出来 —— 新加一个成就时一眼看出该往 run 里补什么字段
    left.map(a => `${a.name}(kind=${a.kind})`).join(', '));

  // 反向保险：成就用到的每一种 kind，都要么被上面的理想局覆盖、
  // 要么是纯统计型（读 S.stats）。出现一个没人测过的新 kind 就会在这里红。
  const IDLE_KINDS = ['kills', 'crits', 'props', 'deaths', 'combo',
                      'mapClear', 'allMaps', 'fullSlots'];
  const RUN_KINDS = ['noMedClear', 'boss', 'lowNoise', 'infected'];
  const kinds = [...new Set(tg.achList().map(a => a.kind))];
  const unknown = kinds.filter(k => !IDLE_KINDS.includes(k) && !RUN_KINDS.includes(k));
  eq(unknown.length, 0, '没有没测过的新 kind（有的话把它加进上面两个列表）', unknown.join(', '));
  // 而 run 型的必须真的依赖 run —— 不能传了给钱、不传也给钱
  for (const k of RUN_KINDS) {
    const ids = tg.achList().filter(a => a.kind === k).map(a => a.id);
    const e2 = fresh();
    e2.tg.save().ach = {};
    const bare = e2.tg.checkAch({ win: true });
    const leaked = bare.filter(a => ids.includes(a.id));
    eq(leaked.length, 0, `kind=${k} 的成就在条件不满足时不会误发`, leaked.map(a => a.name).join(','));
  }
}

// ─────────────────────────────────────────────────────
section('⑦ 新手引导：只出现在第 1 关，做动作就划掉');
{
  const env = load();
  const { tg } = env;
  S_resetTut(tg);
  tg.startLevel(1);
  tg.noWave();
  tg.zombies().length = 0; tg.props().length = 0; tg.clearFloors();
  tg.place(2000);
  const t = tg.save().tut;
  eq(!!t.done, false, '开局引导未完成');

  tg.hold('KeyD'); tick(tg, 20); tg.release('KeyD');
  eq(t.done ? true : !!t.moved, true, '走一段路 → 移动那条划掉');

  tg.hold('KeyW'); tick(tg, 3); tg.release('KeyW');
  eq(!!t.jumped, true, '跳一下 → 跳跃那条划掉');

  tg.giveWeapons(['bat']);
  tg.hold('Space'); tick(tg, 3); tg.release('Space');
  eq(!!t.fired, true, '挥一次 → 开火那条划掉');

  tg.hold('ShiftLeft'); tick(tg, 2); tg.release('ShiftLeft');
  eq(!!t.dodged, true, '翻滚一次 → 翻滚那条划掉');

  // 进屋
  const h = tg.houses().find(x => x.type === 'safe');
  if (h) {
    tg.place(h.x + h.w / 2);
    tg.tap('KeyW'); tick(tg, 1); tg.release('KeyW');
    eq(!!t.entered, true, '进屋一次 → 进屋那条划掉');
  }
  eq(!!t.done, true, '五条全做完 → 引导结束');
  eq(tg.save().tut.done, true, '写进存档（重玩不再重复）');

  // 第 2 关不显示
  tg.startLevel(2);
  eq(!!tg.save().tut.done, true, '第 2 关本来就不显示引导');
}
function S_resetTut(tg) {
  const S = tg.save();
  S.tut = { moved: false, jumped: false, fired: false, entered: false, dodged: false, done: false };
}

summary();
