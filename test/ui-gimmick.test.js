'use strict';
// 暂停菜单 + 关卡机关（低重力/冰面/沙尘暴/酸雨/极寒/陨石）验收。
// 跑法：node test/ui-gimmick.test.js
const { load, ok, eq, section, summary } = require('./harness');

function fresh(n = 1, cash) {
  const env = load();
  env.tg.startLevel(n);
  if (cash !== undefined) env.tg.save().cash = cash;
  env.tg.noWave();
  env.tg.props().length = 0;
  env.tg.clearFloors();
  env.tg.place(2000);
  return env;
}
function tick(tg, n = 1) { for (let i = 0; i < n; i++) tg.step(1 / 60); }

// ─────────────────────────────────────────────────────
section('① 暂停 / 继续 / 重开 / 回关卡选择');
{
  const env = fresh();
  const { tg } = env;

  eq(tg.paused(), false, '开局没暂停');
  tg.togglePause();
  eq(tg.paused(), true, '按 P → 暂停');
  eq(tg.state(), 'play', '暂停时状态仍是 play（不是另起一个状态）');

  tick(tg, 30);
  tg.togglePause();
  eq(tg.paused(), false, '再按 P → 继续');

  // 攒一点进度，然后重开
  tg.player().kills = 42;
  tg.save().cash = 1234;
  tick(tg, 60);
  tg.togglePause();
  tg.restart();
  eq(tg.paused(), false, '重开后自动取消暂停');
  eq(tg.player().kills, 0, '重开清空本局击杀');
  eq(tg.save().cash, 1234, '重开不影响金币（单一持久钱包）');
  ok(tg.player().x < 500, '重开回到起点');

  // 回关卡选择
  tg.togglePause();
  tg.quitToLevels();
  eq(tg.state(), 'menu', '回关卡选择 → 状态变 menu');
  eq(tg.paused(), false, '回菜单时取消暂停');
}

// ─────────────────────────────────────────────────────
section('② 每张地图的机关参数正确');
{
  const env = load();
  const { tg } = env;
  const G = tg.gimmicks();
  ok(Object.keys(G).length >= 6, '至少 6 种机关', Object.keys(G).join(' '));
  ok(Object.values(G).every(g => g.name && g.desc), '每种机关都有名字和说明');

  const byG = {};
  for (let n = 1; n <= tg.mapCount(); n++) {
    tg.startLevel(n);
    const gm = tg.mods();
    const used = Object.keys(gm).filter(k => gm[k]);
    if (used.length) byG[used[0]] = (byG[used[0]] || 0) + 1;
  }
  for (const k of Object.keys(G)) {
    ok(byG[k] > 0, '机关「' + G[k].name + '」至少有一张地图在用', (byG[k] || 0) + ' 张');
  }
}

// ─────────────────────────────────────────────────────
section('③ 低重力：跳得更高、滞空更久');
{
  const envN = fresh(1);
  envN.tg.hold('KeyW'); tick(envN.tg, 1); envN.tg.release('KeyW');
  let nFrames = 0;
  while (!envN.tg.player().onGround && nFrames++ < 600) tick(envN.tg, 1);

  const envL = fresh(15);                       // 月球基地
  eq(envL.tg.mods().lowGrav, true, '第 15 关是低重力');
  ok(envL.tg.jumpV() < 560, '起跳速度被调低了', 'vz ' + envL.tg.jumpV());
  ok(envL.tg.gravity() < 1500, '重力被调低了', 'g ' + envL.tg.gravity());

  // 实测滞空时间
  envL.tg.hold('KeyW'); tick(envL.tg, 1); envL.tg.release('KeyW');
  let lFrames = 0, peak = 0;
  while (!envL.tg.player().onGround && lFrames++ < 600) {
    tick(envL.tg, 1);
    peak = Math.max(peak, envL.tg.player().z);
  }
  ok(lFrames > nFrames * 1.6, '滞空时间明显更长（普通 ' + nFrames + ' 帧 → 月球 ' + lFrames + ' 帧）');
  ok(peak > 104, '跳得比普通重力更高', '最高 z = ' + Math.round(peak) + '（普通重力顶点 104.5）');
  ok(peak > 88, '仍然跳得过一层平台（层高 88）');
}

// ─────────────────────────────────────────────────────
section('④ 冰面：松开方向键还会滑一段');
{
  function slideFrames(level) {
    const env = fresh(level);
    const { tg } = env;
    tg.hold('KeyD');
    tick(tg, 40);                                // 加速
    tg.release('KeyD');
    let f = 0;
    while (Math.abs(tg.player().vx) > 8 && f++ < 600) tick(tg, 1);
    return { f, x: tg.player().x - 2000 };
  }
  const normal = slideFrames(1);
  const ice = slideFrames(11);                   // 雪原公路
  eq(fresh(11).tg.mods().ice, true, '第 11 关是冰面');
  ok(ice.f > normal.f * 3, '冰面上的滑行时间长得多',
    '普通 ' + normal.f + ' 帧 → 冰面 ' + ice.f + ' 帧');
}

// ─────────────────────────────────────────────────────
section('⑤ 极寒：持续掉血，但不会冻死');
{
  const env = fresh(21);                         // 冥王星冰原
  const { tg } = env;
  tg.setStalker(null);                           // 这张图有追逐者，本节只测极寒，先隔离
  eq(tg.mods().cold, true, '第 21 关是极寒');
  const hp0 = tg.player().hp;
  tick(tg, 60 * 6);                              // 6 秒
  ok(tg.player().hp < hp0, '站着不动会掉血', hp0 + ' → ' + Math.round(tg.player().hp));
  tick(tg, 60 * 30);                             // 再冻 30 秒
  ok(tg.player().hp >= 5, '但最低只掉到 5，不会站着冻死', 'HP ' + Math.round(tg.player().hp));
  ok(tg.player().hp > 0, '玩家还活着');
}

// ─────────────────────────────────────────────────────
section('⑥ 酸雨：地面会周期性出现新的酸池');
{
  const env = fresh(17);                         // 金星酸雨
  const { tg } = env;
  eq(tg.mods().acidRain, true, '第 17 关是酸雨');
  // 危险区会过期，所以要看累计出现过几次，不能只看最终数量
  let added = 0, last = tg.hazards().length;
  for (let i = 0; i < 60 * 14; i++) { tick(tg, 1); if (tg.hazards().length > last) added++; last = tg.hazards().length; }
  ok(added > 0, '14 秒内落下了新的酸池', added + ' 次');
}

// ─────────────────────────────────────────────────────
section('⑦ 陨石带：天上掉石头，落地留一团火');
{
  const env = fresh(19);                         // 土星碎片带
  const { tg } = env;
  eq(tg.mods().meteor, true, '第 19 关是陨石带');
  let sawMeteor = false, fireAdded = 0, last = tg.hazards().length;
  for (let i = 0; i < 60 * 20; i++) {
    tick(tg, 1);
    if (tg.meteors().length > 0) sawMeteor = true;
    if (tg.hazards().length > last) fireAdded++;
    last = tg.hazards().length;
  }
  ok(sawMeteor, '20 秒内看到了天上的陨石');
  // 火只烧 3.5 秒，所以要数累计出现次数（只看最终数量会在采样时恰好烧完而误判）
  ok(fireAdded > 0, '陨石落地后留下了火', fireAdded + ' 次');
}

// ─────────────────────────────────────────────────────
section('⑧ 沙尘暴：风向一直在变，会把人往一边推');
{
  const env = fresh(13);                         // 沙漠公路
  const { tg } = env;
  eq(tg.mods().storm, true, '第 13 关是沙尘暴');
  let maxW = 0, minW = 0;
  for (let i = 0; i < 60 * 8; i++) { tick(tg, 1); maxW = Math.max(maxW, tg.wind()); minW = Math.min(minW, tg.wind()); }
  ok(Math.abs(maxW) > 4 || Math.abs(minW) > 4, '风力确实在变化', '范围 ' + minW.toFixed(1) + ' ~ ' + maxW.toFixed(1));
  ok(Math.abs(maxW) <= 79 && Math.abs(minW) <= 79, '风力被限制在 ±78 以内（不会把人吹飞）');
}

// ─────────────────────────────────────────────────────
section('⑨ 没有机关的地图不会误触发');
{
  const env = fresh(1);
  const { tg } = env;
  const gm = tg.mods();
  eq(Object.values(gm).some(Boolean), false, '第 1 关一个机关都没有');
  eq(tg.gravity(), 1500, '重力是默认值');
  eq(tg.jumpV(), 560, '起跳速度是默认值');
  const h0 = tg.hazards().length;
  tick(tg, 60 * 20);
  eq(tg.hazards().length, h0, '20 秒内没有凭空冒出危险区');
  eq(tg.meteors().length, 0, '没有陨石');
}

summary();
