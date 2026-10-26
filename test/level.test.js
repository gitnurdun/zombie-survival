'use strict';
// 关卡闭环验收：推到栅栏 → 停刷 → 进货架 → 买/升级/撤销 → 结算星级 → 存档持久化。
// 跑法：node test/level.test.js
const { load, ok, eq, section, summary } = require('./harness');

// 这套测试里不能用 harness 的 step()——它每帧会把状态按回 'play'，
// 会盖掉"走到货架自动切到 shelf 状态"这件事。这里自己走帧。
function tick(tg, n = 1) { for (let i = 0; i < n; i++) tg.step(1 / 60); }

function fresh(n = 1, cash) {
  const env = load();
  env.tg.startLevel(n || 1);
  if (cash !== undefined) env.tg.save().cash = cash;
  env.tg.setState('play');
  return env;
}
// 把玩家瞬移到某个 x 并推进一帧（触发 updateProgress）
function warpTo(env, x) { env.tg.place(x); tick(env.tg, 1); }

// ─────────────────────────────────────────────────────
section('① 走到栅栏 = 本关结束');
{
  const env = fresh();
  const { tg } = env;
  eq(tg.cleared(), false, '开局未过关');
  ok(tg.fenceX() > 1000 && tg.fenceX() < tg.shelfX(), '栅栏在货架之前',
    'fence ' + Math.round(tg.fenceX()) + ' < shelf ' + Math.round(tg.shelfX()));

  for (let i = 0; i < 60 * 20; i++) tick(tg, 1);   // 在起点待 20 秒刷怪
  const before = tg.zombies().length;
  ok(before > 0, '起点已经刷出了僵尸', before + ' 只');

  warpTo(env, tg.fenceX() + 5);
  eq(tg.cleared(), true, '越过栅栏 → cleared = true');
  // 跨线那一帧允许漏进来一只：update() 里 updateSpawner 在 updateProgress 之前跑，
  // 所以 spawnT 恰好到点的话会有最后一只被刷出来（它当帧就被置 boredT=999 自己走开）。
  // 这是**有意**的顺序（先刷后判），玩家看不出来；但基线要在这里取，不能在 warp 之前取 ——
  // 否则这条断言有约 1% 的概率随机红一次。
  const atCross = tg.zombies().length;
  ok(atCross - before <= 1, '跨线那一帧最多漏进来一只', before + ' → ' + atCross);

  // 停刷：等 20 秒，僵尸数量不该再涨（这一条才是"不再刷怪"的真正判据）
  for (let i = 0; i < 60 * 20; i++) tick(tg, 1);
  ok(tg.zombies().length <= atCross, '越过栅栏后不再刷怪',
    atCross + ' → ' + tg.zombies().length);
}

// ─────────────────────────────────────────────────────
section('② 栅栏之后走到货架 = 打开货架界面');
{
  const env = fresh();
  const { tg } = env;
  warpTo(env, tg.fenceX() + 5);
  eq(tg.state(), 'play', '还没到货架，仍在游戏中');

  warpTo(env, tg.shelfX() - 60);
  eq(tg.state(), 'shelf', '走到货架 → 自动打开货架界面');
}

// ─────────────────────────────────────────────────────
section('③ 货架：方向键导航');
{
  const env = fresh();
  const { tg } = env;
  warpTo(env, tg.shelfX() - 60);
  const sh = tg.shelf();

  eq(sh.cat, 0, '默认在第 1 个分类（冷兵器）');
  eq(sh.idx, 0, '默认选中第 1 件');

  tg.shelfNav('right'); eq(sh.idx, 1, '→ 选下一件');
  tg.shelfNav('left');  eq(sh.idx, 0, '← 选上一件');
  tg.shelfNav('left');  ok(sh.idx > 0, '在最左边按 ← 会绕到最后一件', 'idx = ' + sh.idx);

  tg.shelfNav('down'); eq(sh.cat, 1, '↓ 切到第 2 个分类');
  eq(sh.idx, 0, '换分类时选中项复位');
  tg.shelfNav('down'); eq(sh.cat, 2, '↓ 切到第 3 个分类');
  tg.shelfNav('down'); eq(sh.cat, 0, '再 ↓ 绕回第 1 个');
  tg.shelfNav('up');   eq(sh.cat, 2, '↑ 反向绕');
}

// ─────────────────────────────────────────────────────
section('④ 货架：购买 / 升级 / 撤销');
{
  const env = fresh(1, 2000);
  const { tg } = env;
  const S = tg.save();
  warpTo(env, tg.shelfX() - 60);

  // 选中第 2 件冷兵器（消防斧，$420）
  tg.shelfNav('right');
  const cash0 = S.cash;
  tg.shelfConfirm();
  ok(S.cash < cash0, '购买扣了钱', cash0 + ' → ' + S.cash);
  eq(S.owned.axe, 1, 'axe 记入存档并标记 Lv1');
  ok(tg.player().weapons.some(w => w.baseId === 'axe'), '买完自动装到装备槽里');

  // 再按一次 = 升级
  const cash1 = S.cash;
  tg.shelfConfirm();
  eq(S.owned.axe, 2, '再按 Enter → 升到 Lv2');
  ok(S.cash < cash1, '升级扣了钱', cash1 + ' → ' + S.cash);
  const w = tg.player().weapons.find(v => v.baseId === 'axe');
  eq(w.lv, 2, '手上那把同步升到 Lv2');
  ok(w.def.dmg > 52, '合并后的伤害数值确实变高了', 'dmg ' + w.def.dmg);

  // 撤销两次应该完全回滚
  tg.shelfUndo();
  eq(S.owned.axe, 1, '撤销升级 → 回到 Lv1');
  eq(tg.player().weapons.find(v => v.baseId === 'axe').lv, 1, '手上的也回滚了');
  tg.shelfUndo();
  eq(S.owned.axe, undefined, '再撤销 → 购买也被回滚');
  eq(S.cash, cash0, '金币完全恢复', cash0 + ' vs ' + S.cash);
  ok(!tg.player().weapons.some(w => w.baseId === 'axe'), '装备槽里的也移除了');

  tg.shelfUndo();
  ok(S.cash === cash0, '撤销栈空了之后再按不会扣钱/加钱');
}

// ─────────────────────────────────────────────────────
section('⑤ 金币不够时买不了');
{
  const env = fresh();
  const { tg } = env;
  const S = tg.save();
  S.cash = 10;
  warpTo(env, tg.shelfX() - 60);
  const before = JSON.stringify(S.owned);
  for (let i = 0; i < 8; i++) { tg.shelfConfirm(); tg.shelfNav('right'); }
  eq(JSON.stringify(S.owned), before, '钱不够时按多少个 Enter 都买不到东西');
  eq(S.cash, 10, '金币没变');
}

// ─────────────────────────────────────────────────────
section('⑥ 关掉货架 = 结算，星级判定');
{
  const env = fresh();
  const { tg } = env;
  const S = tg.save();
  S.cash = 5000;
  warpTo(env, tg.shelfX() - 60);
  eq(tg.state(), 'shelf', '在货架上');

  // 造一个"击杀达标 + 生命过半"的局面 → 3 星
  tg.player().kills = 200;
  tg.player().hp = tg.player().maxHp;
  eq(tg.stars(), 3, '三颗星条件全满足 → 3 星');

  tg.winLevel();
  eq(tg.state(), 'result', '进入结算');
  eq(S.cleared[1].stars, 3, '星级写进存档');
  eq(S.cleared[1].bestKills, 200, '最佳击杀写进存档');
  eq(S.unlocked, 2, '第 2 关解锁');

  // 低分局面
  tg.player().kills = 5;
  tg.player().hp = 10;
  eq(tg.stars(), 1, '只满足「活着到栅栏」→ 1 星');
  tg.winLevel();
  eq(S.cleared[1].stars, 3, '低分不会覆盖已有的高分记录');
}

// ─────────────────────────────────────────────────────
section('⑦ 失败也保留金币');
{
  const env = fresh();
  const { tg } = env;
  const S = tg.save();
  S.cash = 777;
  tg.loseLevel();
  eq(tg.state(), 'result', '进入结算（失败）');
  ok(S.cash >= 777, '金币一分没丢（成就奖励还可能让它变多）', '777 → ' + S.cash);
  eq(S.stats.deaths, 1, '死亡计数 +1');
}

// ─────────────────────────────────────────────────────
section('⑧ 存档持久化（刷新页面不丢）');
{
  const env = fresh();
  const { tg } = env;
  const S = tg.save();
  S.cash = 3000;
  warpTo(env, tg.shelfX() - 60);
  tg.shelfNav('down');            // 切到热武器
  tg.shelfConfirm();              // 买手枪
  eq(S.owned.pistol, 1, '买了手枪');
  const cashAfter = S.cash;

  // 模拟刷新：用同一份 localStorage 重新加载游戏
  const env2 = load({ store: env.store });
  env2.tg.save();
  const S2 = env2.tg.save();
  eq(S2.cash, cashAfter, '金币持久化', cashAfter + ' vs ' + S2.cash);
  eq(S2.owned.pistol, 1, '已购武器持久化');
  eq(S2.slots.includes('pistol'), true, '装备槽持久化');
}

// ─────────────────────────────────────────────────────
section('⑨ 关卡推进：结算后能进下一关');
{
  const env = fresh(1);
  const { tg } = env;
  tg.winLevel();
  tg.startLevel(2);
  eq(tg.state(), 'play', '进入第 2 关');
  eq(tg.player().kills, 0, '击杀数重置');
  ok(tg.player().cash > 0, '金币保留', '$' + tg.player().cash);
  ok(tg.player().x < 500, '从起点出发');
}

summary();
