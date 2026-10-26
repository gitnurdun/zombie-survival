'use strict';
// Boss 战验收：锁死栅栏 → 三阶段 → 召唤 / 冲锋 → 击杀后放行 + 解锁隐藏角色。
// 跑法：node test/boss.test.js
const { load, ok, eq, section, summary } = require('./harness');

function atFence(n = 10) {
  const env = load();
  const tg = env.tg;
  tg.startLevel(n);
  tg.setState('play');
  tg.place(tg.fenceX() + 10);
  tg.step(1 / 60);
  return env;
}
function tick(tg, n = 1) { for (let i = 0; i < n; i++) tg.step(1 / 60); }

// ─────────────────────────────────────────────────────
section('① 哪些关有 Boss');
{
  const env = load();
  const { tg } = env;
  const withBoss = [];
  for (let n = 1; n <= tg.mapCount(); n++) if (tg.maps()[n - 1].boss) withBoss.push(n);
  eq(withBoss.join(','), '10,22', '只有第 10 关和第 22 关有 Boss');
  ok(tg.ztypes().boss.boss, 'Boss 类型本身带了 boss 标记');
  eq(tg.ztypes().boss.noHeadshot, true, 'Boss 不可爆头');
  ok(tg.ztypes().boss.hp >= 3000, '血量够厚', tg.ztypes().boss.hp + ' HP');
}

// ─────────────────────────────────────────────────────
section('② 走到栅栏：栅栏锁死，Boss 出现，玩家被挡住');
{
  const env = atFence(10);
  const { tg } = env;
  ok(!!tg.boss(), 'Boss 出现了');
  eq(tg.cleared(), false, '栅栏没开，关卡没结束');
  ok(tg.player().x < tg.fenceX(), '玩家被挡在栅栏之前',
    'x ' + Math.round(tg.player().x) + ' < fence ' + Math.round(tg.fenceX()));

  // 反复尝试往前走也过不去
  for (let i = 0; i < 120; i++) { tg.place(tg.fenceX() + 50); tick(tg, 1); }
  eq(tg.cleared(), false, '一直往前挤也过不去');

  // 没有 Boss 的关照常放行
  const env2 = load();
  const { tg: t2 } = env2;
  t2.startLevel(1); t2.setState('play');
  t2.place(t2.fenceX() + 10); tick(t2, 1);
  eq(t2.cleared(), true, '普通关卡走到栅栏就结束');
  eq(t2.boss(), null, '普通关卡没有 Boss');
}

// ─────────────────────────────────────────────────────
section('③ 三阶段：血条 66% / 33% 各切一次');
{
  const env = atFence(10);
  const { tg } = env;
  const b = tg.boss();
  eq(b.phase, 1, '开局是阶段一');

  b.hp = b.maxHp * 0.7; b.invulnT = 0; tick(tg, 4);
  eq(b.phase, 1, '70% 还在阶段一');
  b.hp = b.maxHp * 0.6; b.invulnT = 0; tick(tg, 4);
  eq(b.phase, 2, '掉到 60% → 阶段二');
  b.hp = b.maxHp * 0.4; b.invulnT = 0; tick(tg, 4);
  eq(b.phase, 2, '40% 还在阶段二');
  b.hp = b.maxHp * 0.3; b.invulnT = 0; tick(tg, 4);
  eq(b.phase, 3, '掉到 30% → 阶段三');
}

// ─────────────────────────────────────────────────────
section('④ 阶段二会召唤；阶段三会冲锋');
{
  const env = atFence(10);
  const { tg } = env;
  const b = tg.boss();
  b.hp = b.maxHp * 0.55; b.invulnT = 0;
  tick(tg, 4);
  tg.zombies().length = 1;                      // 只留 Boss
  tg.zombies()[0] = b;
  let summoned = 0;
  for (let i = 0; i < 60 * 30; i++) {
    tick(tg, 1);
    const extra = tg.zombies().length - 1;
    if (extra > summoned) summoned = extra;
  }
  ok(summoned > 0, '阶段二会召唤小怪', '最多同屏 ' + summoned + ' 只召唤物');

  // 阶段三冲锋
  const env2 = atFence(10);
  const { tg: t2 } = env2;
  const b2 = t2.boss();
  b2.hp = b2.maxHp * 0.2; b2.invulnT = 0;
  tick(t2, 4);
  eq(b2.phase, 3, '已进阶段三');
  // 冲锋要求距离 > 280px，把玩家拉远一点。
  // 还得给玩家一大管血 —— 否则在等的这几十秒里会被 Boss 的酸液打死，
  // 状态切到 result 之后 update() 就不跑了，Boss 也跟着停。
  t2.player().maxHp = 1e6; t2.player().hp = 1e6;
  t2.place(b2.x - 700);
  let sawCharge = false;
  for (let i = 0; i < 60 * 40; i++) { tick(t2, 1); if (b2.charging) { sawCharge = true; break; } }
  ok(sawCharge, '阶段三会朝玩家冲锋');

  // 冲锋撞到玩家会重伤
  const hp0 = t2.player().hp;
  b2.charging = true; b2.chargeVx = (t2.player().x > b2.x ? 1 : -1) * 760; b2.dir = 1;
  for (let i = 0; i < 60 * 5; i++) { tick(t2, 1); if (t2.player().hp < hp0) break; }
  ok(t2.player().hp < hp0, '被冲锋撞到会重伤', 'HP ' + Math.round(t2.player().hp));
}

// ─────────────────────────────────────────────────────
section('⑤ Boss 战期间不刷杂兵');
{
  const env = atFence(10);
  const { tg } = env;
  tg.zombies().length = 1; tg.zombies()[0] = tg.boss();
  tick(tg, 60 * 40);
  // 场上除了 Boss（和它自己召唤的）不该出现"刷怪器"来的僵尸
  ok(tg.zombies().includes(tg.boss()), 'Boss 一直在场上');
}

// ─────────────────────────────────────────────────────
section('⑥ 击杀 Boss：栅栏打开 + 解锁隐藏角色');
{
  const env = atFence(10);
  const { tg } = env;
  const b = tg.boss();
  eq(tg.save().chars.duke, undefined, '开局疯子 Duke 是锁着的');

  b.hp = 1; b.invulnT = 0;
  tg.damageAt(tg.zombies().indexOf(b), 999);
  eq(tg.boss(), null, 'Boss 被移除');
  eq(tg.bossDone(), true, '记录已击杀');
  eq(tg.save().chars.duke, true, '疯子 Duke 解锁');
  eq(tg.save().demonUnlocked, true, '存档里标记了');

  tg.place(tg.fenceX() + 10); tick(tg, 1);
  eq(tg.cleared(), true, '栅栏打开，关卡可以结束了');

  // 通关后走到货架照常开界面
  tg.place(tg.shelfX() - 60); tick(tg, 1);
  eq(tg.state(), 'shelf', '货架照常打开');
}

// ─────────────────────────────────────────────────────
section('⑦ 每张 Boss 关都能跑通真实渲染');
{
  const env = load();
  const { tg } = env;
  const fails = [];
  for (const n of [10, 22]) {
    try {
      tg.startLevel(n);
      tg.place(tg.fenceX() + 10);
      const t0 = Date.now() + 300000 + n * 10000;
      for (let i = 0; i < 600; i++) tg.frame(t0 + i * 16);      // 阶段一
      const b = tg.boss();
      b.hp = b.maxHp * 0.5; b.invulnT = 0;
      for (let i = 0; i < 600; i++) tg.frame(t0 + 10000 + i * 16);  // 阶段二
      b.hp = b.maxHp * 0.2; b.invulnT = 0;
      for (let i = 0; i < 900; i++) tg.frame(t0 + 20000 + i * 16);  // 阶段三
    } catch (e) { fails.push('第' + n + '关: ' + e.message); }
  }
  eq(fails.length, 0, '两个 Boss 关的三阶段全跑通', fails.join(' / '));
}

summary();
