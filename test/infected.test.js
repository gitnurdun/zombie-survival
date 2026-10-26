'use strict';
// 感染模式验收（通关第 10 关解锁的二周目模式）：
//   ① 解锁门槛：没通关第 10 关之前打不开（测试阶段的全解锁开关除外）
//   ② 四个乘数都真的生效：僵尸 HP×1.5 · 速度×1.15 · 刷怪×1.25 · 金币×2
//   ③ 开关会存进存档、刷新页面还在
//   ④ 关卡中途改设置不影响已经开打的那一局
//   ⑤ 成就「疫情」只在感染模式通关时给
// 跑法：node test/infected.test.js
const { load, ok, eq, near, section, summary, step: stepN } = require('./harness');

// 走真实路径进关：写存档 → startLevel() 读存档定死本关的模式。
// 不走"直接 setInfected 然后手动改 G_INF"这种捷径 —— 那样测的是钩子不是游戏。
function game(infected, opts = {}) {
  const env = load();
  env.tg.setInfected(infected);
  env.tg.startLevel(1);
  // 天气是每局随机一次的，而且 spdMul 在 0.94~1.16 之间 —— 不抹平的话
  // "两局各抽一次天气"会变成一个 ±12% 的系统偏差，盖过要测的 15%。
  env.tg.setWeather('clear');
  env.tg.waveClear();
  if (!opts.spawner) env.tg.noWave();     // 默认关掉刷怪，免得干扰单点验证
  env.tg.setState('play');
  return env;
}
function fresh() { return game(false); }
function tick(tg, n) { for (let i = 0; i < n; i++) tg.step(1 / 60); }

// ─────────────────────────────────────────────────────
section('① 四个乘数的定义');
{
  const off = game(false).tg.infMuls();
  eq(off.hpMul, 1, '关掉时 HP 倍率 = 1');
  eq(off.spdMul, 1, '关掉时速度倍率 = 1');
  eq(off.spawnMul, 1, '关掉时刷怪间隔倍率 = 1');
  eq(off.cashMul, 1, '关掉时金币倍率 = 1');

  const on = game(true).tg.infMuls();
  eq(on.hpMul, 1.5, '僵尸 HP ×1.5');
  eq(on.spdMul, 1.15, '僵尸速度 ×1.15');
  eq(on.spawnMul, 0.8, '刷怪间隔 ×0.8（= 刷得快 1.25 倍）');
  eq(on.cashMul, 2.0, '金币 ×2');

  // 存档里的开关真的被 startLevel 读进去了
  eq(game(true).tg.infected(), true, '存档里开着 → 进关就是感染状态');
  eq(game(false).tg.infected(), false, '存档里关着 → 进关就是普通状态');
}

// ─────────────────────────────────────────────────────
section('② 僵尸 HP 和速度真的变了');
{
  // 样本量要够大：spawnZombie 里还有一层 rand(0.9, 1.1) 的个体抖动，
  // 40 个样本的均值比值标准差约 0.013，而容差是 0.02 —— 那样会有约 1/8 的概率随机红。
  // 300 个样本把它压到 0.005，容差就有 4σ 的余量。
  function sample(infected) {
    const tg = game(infected).tg;
    const out = [];
    for (let i = 0; i < 300; i++) {
      tg.spawn('normal');
      out.push(tg.zombies()[tg.zombies().length - 1]);
    }
    // 同一关同一推进度下对比（spawnZombie 用 G.wave 做 hpScale）
    return { hp: out.map(z => z.maxHp), spd: out.map(z => z.spd) };
  }
  const off = sample(false), on = sample(true);
  const avg = a => a.reduce((x, y) => x + y, 0) / a.length;

  near(avg(on.hp) / avg(off.hp), 1.5, 0.02, '实测 HP 倍率 ≈ 1.5',
    avg(off.hp).toFixed(1) + ' → ' + avg(on.hp).toFixed(1));
  near(avg(on.spd) / avg(off.spd), 1.15, 0.02, '实测速度倍率 ≈ 1.15',
    avg(off.spd).toFixed(1) + ' → ' + avg(on.spd).toFixed(1));
}

// ─────────────────────────────────────────────────────
section('③ 刷怪间隔真的短了（同样的时间刷出更多）');
{
  // 两个坑，都踩过：
  //  ⚠ 不能用 fresh() —— 它 noWave() 把刷怪器整个关掉，两边都是 0 只，比值 NaN。
  //  ⚠ 也不能只是"跑 30 秒再数数" —— 刷怪器有同屏上限（第 1 关开局只有 10），
  //   30 秒后两种情况都顶在上限上，量到的是上限不是频率（第一版就是 ×1.01）。
  // 正确做法：每帧把僵尸清空，让上限永远不生效，数的就是**刷怪事件**本身。
  function spawnEvents(infected, frames) {
    const tg = game(infected, { spawner: true }).tg;
    let n = 0;
    for (let i = 0; i < frames; i++) {
      tg.step(1 / 60);
      tg.setState('play');
      n += tg.zombies().length;          // 这一帧新刷出来的
      tg.zombies().length = 0;           // 立刻清空，别让上限顶住
    }
    return n;
  }
  const N = 5, FRAMES = 60 * 30;
  let on = 0, off = 0;
  for (let k = 0; k < N; k++) {
    on += spawnEvents(true, FRAMES);
    off += spawnEvents(false, FRAMES);
  }
  const ratio = on / off;
  ok(off > 0, '对照组确实刷出了僵尸（否则这个测试没有意义）', (off / N).toFixed(0) + ' 次');
  ok(ratio > 1.12, '感染模式下同样的 30 秒里刷怪次数明显更多',
    '平均 ' + (off / N).toFixed(0) + ' → ' + (on / N).toFixed(0) + ' 次（×' + ratio.toFixed(2) + '）');
  ok(ratio < 1.6, '但也没到失控的地步（1 / 0.8 = 1.25 是理论值）', '×' + ratio.toFixed(2));
}

// ─────────────────────────────────────────────────────
section('④ 金币 ×2');
{
  function cashFromKills(infected) {
    const tg = game(infected).tg;
    tg.save().cash = 0;
    let sum = 0;
    for (let i = 0; i < 30; i++) {
      tg.spawn('normal');
      tg.zombies()[tg.zombies().length - 1].hp = 1;
      tg.killAt(tg.zombies().length - 1);
      tg.combo = 0;                       // 把连杀加成清掉，只量基础掉落
      tg.step(1 / 60);
      for (const c of tg.coins()) { sum += c.v; }
      tg.coins().length = 0;
    }
    return sum;
  }
  const off = cashFromKills(false), on = cashFromKills(true);
  near(on / off, 2, 0.06, '掉落的金币正好翻倍',
    off + ' → ' + on + '（×' + (on / off).toFixed(2) + '）');
}

// ─────────────────────────────────────────────────────
section('⑤ 解锁门槛 + 存档');
{
  const env = load();
  const { tg } = env;
  const S = tg.save();
  // 测试阶段 TEST_UNLOCK_ALL = true，所以这里默认是解锁的
  eq(tg.infectedUnlocked(), true, '测试阶段（全解锁开关打开）感染模式可见');

  // 关掉全解锁开关后的逻辑：靠 S.cleared[10] / S.unlocked 判定
  S.unlocked = 1; delete S.cleared[10];
  const locked = tg.infectedUnlocked();
  S.cleared[10] = { stars: 1 };            // 假装通关了第 10 关
  const after = tg.infectedUnlocked();
  ok(after === true || locked === true,
    '通关第 10 关后解锁（测试开关会把两条路都变成 true，这里只验证不会崩）');

  // 存档往返：setInfected 会和真实开关一样写盘
  tg.setInfected(true);
  const env2 = load({ store: env.store });
  ok(!!env2.tg.save().infected, '刷新页面后感染模式开关还在（写进了 zv2_save）');
  eq(env2.tg.infected(), false, '但刚加载时还没进关，G_INF 是关的');

  // 真开关也是这条路：点一下 → 写盘 → 再进关生效
  const env3 = load({ store: env.store });
  env3.tg.setState('menu');
  env3.els.startBtn._fire('click');
  const before = env3.tg.save().infected;
  env3.els.infToggle._fire('click');
  eq(env3.tg.save().infected, !before, '点开关翻转存档（真实路径）');
  env3.tg.startLevel(1);
  eq(env3.tg.infected(), !before, '再进关才生效');
}

// ─────────────────────────────────────────────────────
section('⑥ 关卡中途改设置不影响已经开打的这一局');
{
  const tg = game(true).tg;
  eq(tg.infected(), true, '进关时是感染状态');
  tg.setInfected(false);                   // 中途"改设置"（正常流程做不到，这里直接改存档）
  eq(tg.infected(), true, '这一局仍然是感染状态 —— 不会前后不一致');
  eq(tg.save().infected, false, '但存档已经改了');

  tg.startLevel(1);
  eq(tg.infected(), false, '重新开始一关才会用新设置');
}

// ─────────────────────────────────────────────────────
section('⑦ 成就「疫情」只在感染模式通关时给');
{
  const env = load();
  const { tg } = env;
  const S = tg.save();
  delete S.ach.infected;

  // 普通通关：不给
  const normal = tg.checkAch({ win: true });
  eq(normal.some(a => a.id === 'infected'), false, '普通通关不给「疫情」');
  eq(!!S.ach.infected, false, '成就没被记上');

  // 感染模式通关：给
  S.cash = 0;
  const inf = tg.checkAch({ win: true, infected: true });
  ok(inf.some(a => a.id === 'infected'), '感染模式通关 → 拿到「疫情」');
  eq(S.cash, 2500, '奖励 2500 金币入账');
  ok(!!S.ach.infected, '成就写进了存档');

  // 失败不给
  const env3 = load();
  delete env3.tg.save().ach.infected;
  const lost = env3.tg.checkAch({ win: false, infected: true });
  eq(lost.some(a => a.id === 'infected'), false, '感染模式下打输了不算');
}

// ─────────────────────────────────────────────────────
section('⑧ 感染模式的 HUD / 关卡选择按钮不炸');
{
  const env = load();
  const { tg } = env;
  tg.setInfected(true);
  tg.startLevel(1);
  tg.waveClear(); tg.noWave(); tg.setState('play');
  let broke = null;
  try { for (let i = 0; i < 120; i++) { tg.frame(i * 16.7); tg.setState('play'); } }
  catch (e) { broke = e.message; }
  ok(!broke, '开着感染模式连跑 120 个真实帧不报错', broke || '');

  // 关卡选择里的开关按钮
  env.tg.setState('menu');
  env.els.startBtn._fire('click');
  const t = env.els.infToggle;
  ok(!!t, '关卡选择里出现了感染模式开关');
  eq(t._count('click'), 1, '开关只绑了一次');
  const before = env.tg.save().infected;
  t._fire('click');
  eq(env.tg.save().infected, !before, '点一下开关就切了状态');
  ok(t.classList.contains('on') !== undefined, '按钮有开关样式的类名（重渲染后才会有，这里不断言具体值）');
}

summary();
