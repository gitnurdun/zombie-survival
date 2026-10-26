'use strict';
// 本轮 8 个新系统的验收：
//   僵尸词缀 · 闪避翻滚 · 连杀 · 噪音 · 追逐者 · 移动平台 · 天气变体 · 昼夜推进
// 跑法：node test/new-systems.test.js
const { load, ok, eq, section, summary } = require('./harness');

function fresh(n = 1, opts = {}) {
  const env = load();
  env.tg.startLevel(n);
  env.tg.noWave();
  env.tg.props().length = 0;
  env.tg.clearFloors();
  env.tg.zombies().length = 0;
  if (opts.noStalker) env.tg.setStalker(null);
  env.tg.place(opts.x === undefined ? 2000 : opts.x, opts.z);
  return env;
}
function tick(tg, n = 1) { for (let i = 0; i < n; i++) tg.step(1 / 60); }
// 直接造一只指定类型 + 指定词缀的僵尸（绕过随机）
function makeZ(tg, type, affix, x, z) {
  const zz = tg.spawnAt(type, x, z);
  zz.affix = affix;
  if (affix === 'shielded') zz.shield = tg.affixes().shielded.shield;
  return zz;
}

// ─────────────────────────────────────────────────────
section('① 僵尸词缀：越往后越常见，第 1 关基本没有');
{
  const env = load();
  const { tg } = env;
  const A = tg.affixes();
  ok(Object.keys(A).length >= 7, '至少 7 种词缀', Object.keys(A).join(' '));
  ok(Object.values(A).every(a => a.name && a.col), '每种词缀都有名字和颜色');

  // 直接用刷怪器抽样：统计有多少只带词缀
  function sampleAffixed(lv, n = 800) {
    tg.startLevel(lv); tg.noWave();
    let withAffix = 0;
    for (let i = 0; i < n; i++) {
      tg.zombies().length = 0;
      tg.place(tg.fenceX() * 0.9);
      tg.spawn('normal');
      const z = tg.zombies()[0];
      if (z && z.affix) withAffix++;
    }
    return withAffix / n;
  }
  const lv1 = sampleAffixed(1);
  const lv18 = sampleAffixed(18);
  eq(lv1, 0, '第 1 关一只精英怪都不会有');
  ok(lv18 > 0.15, '第 18 关后半段精英怪明显变多', Math.round(lv18 * 100) + '%');
}

// ─────────────────────────────────────────────────────
section('② 词缀效果：带盾 / 再生 / 爆裂 / 燃烧');
{
  // 带盾的：盾没破之前伤害进不去
  const env = fresh(1);
  const { tg } = env;
  tg.giveWeapons(['pistol']);
  const sh = makeZ(tg, 'normal', 'shielded', 2400);
  sh.hp = sh.maxHp = 1e6; sh.spd = 0; sh.atkT = 999;
  const shield0 = sh.shield;
  const hp0 = sh.hp;
  tg.hold('Space'); tick(tg, 1); tg.release('Space');
  tick(tg, 40);
  eq(sh.hp, hp0, '打在盾上时血量一点没掉');
  ok(sh.shield < shield0, '盾值被扣了', shield0 + ' → ' + Math.round(sh.shield));

  // 再生的：会回血
  const env2 = fresh(1);
  const { tg: t2 } = env2;
  const rg = makeZ(t2, 'normal', 'regen', 2400);
  rg.spd = 0; rg.atkT = 999;
  rg.hp = rg.maxHp * 0.3;
  const low = rg.hp;
  tick(t2, 120);
  ok(rg.hp > low, '再生的僵尸在回血', Math.round(low) + ' → ' + Math.round(rg.hp));

  // 爆裂的：死后炸一圈，连锁伤到旁边的僵尸
  const env3 = fresh(1);
  const { tg: t3 } = env3;
  const vo = makeZ(t3, 'normal', 'volatile', 2400);
  vo.spd = 0; vo.atkT = 999; vo.hp = 1;
  const near = t3.spawnAt('normal', 2440); near.spd = 0; near.atkT = 999;
  near.hp = near.maxHp = 1e6;
  const nearHp = near.hp;
  const iVo = t3.zombies().indexOf(vo);
  t3.damageAt(iVo, 5);                          // 直接打死它 → killZombie → 爆炸
  ok(!t3.zombies().includes(vo), '爆裂僵尸死了');
  ok(near.hp < nearHp, '死后炸到了旁边的僵尸', Math.round(nearHp) + ' → ' + Math.round(near.hp));

  // 燃烧的：死后留下火焰带
  const env4 = fresh(1);
  const { tg: t4 } = env4;
  const hz0 = t4.hazards().length;
  const bu = makeZ(t4, 'normal', 'burning', 2400);
  bu.hp = 1;
  t4.damageAt(t4.zombies().indexOf(bu), 5);
  ok(t4.hazards().length > hz0, '燃烧僵尸死后留下了一团火',
    hz0 + ' → ' + t4.hazards().length + ' 处危险区');
}

// ─────────────────────────────────────────────────────
section('③ 闪避翻滚：Shift 触发、有无敌帧、有冷却');
{
  const env = fresh(1);
  const { tg } = env;
  eq(tg.dodge().cd, 0, '开局冷却好了');
  const x0 = tg.player().x;
  tg.hold('ShiftLeft');
  tick(tg, 1);
  tg.release('ShiftLeft');
  ok(tg.dodge().t > 0, '按 Shift 进入翻滚');
  ok(tg.player().invuln > 0, '翻滚期间有无敌帧', 'invuln ' + tg.player().invuln.toFixed(2));
  ok(tg.dodge().cd > 0, '进入冷却', tg.dodge().cd.toFixed(2) + 's');

  tick(tg, 25);
  ok(Math.abs(tg.player().x - x0) > 80, '确实位移了一段', Math.round(Math.abs(tg.player().x - x0)) + 'px');

  // 冷却期间不能连滚
  const cdNow = tg.dodge().cd;
  tg.hold('ShiftLeft'); tick(tg, 1); tg.release('ShiftLeft');
  ok(tg.dodge().cd <= cdNow, '冷却期间再按 Shift 不会重置/连滚');

  // 无敌帧真的能挡伤害
  const env2 = fresh(1);
  const { tg: t2 } = env2;
  t2.player().hp = 100;
  t2.hold('ShiftLeft'); tick(t2, 1); t2.release('ShiftLeft');
  t2.hitPlayer(50);
  eq(t2.player().hp, 100, '翻滚的无敌帧挡掉了伤害');
}

// ─────────────────────────────────────────────────────
section('④ 连杀：连续击杀累加，超时归零，金币有加成');
{
  const env = fresh(1);
  const { tg } = env;
  eq(tg.combo(), 0, '开局 0 连杀');

  for (let k = 0; k < 6; k++) {
    const z = tg.spawnAt('normal', 2200);
    z.hp = z.maxHp = 1e6; z.spd = 0; z.atkT = 999;
    const i = tg.zombies().indexOf(z);
    tg.killAt(i);
  }
  eq(tg.combo(), 6, '连杀 6');
  ok(tg.coins().length > 0, '掉金币了');
  ok(tg.coins().some(c => c.v > 2), '第 5 连之后金币单价变高（基础单价 2 = 6/3）',
    '最高 ' + Math.max(...tg.coins().map(c => c.v)));

  tick(tg, 60 * 4);                            // 等 4 秒（连杀窗口 3 秒）
  eq(tg.combo(), 0, '超过 3 秒没有新击杀 → 归零');
}

// ─────────────────────────────────────────────────────
section('⑤ 噪音：开枪推高、时间衰减、高噪音刷怪更快');
{
  const env = fresh(1);
  const { tg } = env;
  eq(tg.noise(), 0, '开局安静');
  tg.giveWeapons(['pump']);                    // 霰弹枪最吵
  tg.zombies().length = 0;
  tg.hold('Space'); tick(tg, 3); tg.release('Space');
  const loud = tg.noise();
  ok(loud > 20, '开枪把噪音推上去了', Math.round(loud));

  const before = tg.noise();
  tick(tg, 60);
  ok(tg.noise() < before, '噪音会随时间衰减', Math.round(before) + ' → ' + Math.round(tg.noise()));

  // 近战很安静
  const env2 = fresh(1);
  const { tg: t2 } = env2;
  t2.giveWeapons(['bat']);
  t2.hold('Space'); tick(t2, 2); t2.release('Space');
  ok(t2.noise() < 15, '挥砍几乎是安静的', Math.round(t2.noise()));

}

// ─────────────────────────────────────────────────────
section('⑤b 噪音越高刷怪越快（直接比同一张图的两轮）');
{
  function run(keepLoud) {
    const env = load();
    const { tg } = env;
    tg.startLevel(1);
    tg.setState('play');
    tg.place(600);
    let spawned = 0, seen = 0;
    for (let i = 0; i < 60 * 90; i++) {
      if (keepLoud) tg.addNoise(14);
      tg.step(1 / 60);
      const n = tg.zombies().length;
      if (n > seen) spawned += n - seen;
      seen = n;
      if (n > 0) { tg.zombies().length = 0; seen = 0; }   // 清场，只数"刷了多少"
    }
    return spawned;
  }
  const quiet = run(false);
  const loud = run(true);
  ok(loud > quiet, '高噪音下刷出的僵尸更多', '安静 ' + quiet + ' 只 → 吵闹 ' + loud + ' 只');
}

// ─────────────────────────────────────────────────────
section('⑥ 追逐者：杀不死、会追你、撞到就重伤');
{
  const env = fresh(3, { x: 2000 });           // 第 3 关有追逐者
  const { tg } = env;
  ok(!!tg.stalker(), '第 3 关生成了追逐者');
  const s = tg.stalker();
  const d0 = Math.abs(s.x - tg.player().x);
  tick(tg, 60 * 3);
  const d1 = Math.abs(s.x - tg.player().x);
  ok(d1 < d0, '它确实在朝玩家靠近', Math.round(d0) + 'px → ' + Math.round(d1) + 'px');

  // 撞到玩家会重伤
  const env2 = fresh(3, { x: 2000 });
  const { tg: t2 } = env2;
  const st = t2.stalker();
  t2.player().hp = 100;
  st.x = t2.player().x;
  st.z = t2.player().z;
  tick(t2, 3);
  ok(t2.player().hp < 100, '被它撞到会重伤', 'HP ' + Math.round(t2.player().hp));
  ok(st.slamT > 0, '撞完之后它会短暂停顿（给你逃跑的窗口）');

  // 第 1 关没有
  const env3 = fresh(1);
  eq(env3.tg.stalker(), null, '第 1 关没有追逐者');
}

// ─────────────────────────────────────────────────────
section('⑦ 移动平台：会动，站着的人跟着走');
{
  let found = 0, vertical = 0, horizontal = 0;
  for (let n = 1; n <= 22; n++) {
    const env = load();
    env.tg.startLevel(n);
    const mv = env.tg.floors().filter(f => f.move);
    found += mv.length;
    for (const f of mv) (f.move.axis === 'y' ? vertical++ : horizontal++);
  }
  ok(found > 0, '22 张地图里确实生成了移动平台', found + ' 块（升降 ' + vertical + ' / 横移 ' + horizontal + '）');
  ok(vertical > 0 && horizontal > 0, '两种轴向都有');

  // 竖直升降：站在上面的玩家会跟着上下
  const env = load();
  const { tg } = env;
  // 单张图可能随机不出升降平台（每块平台 24% 概率），扫遍所有地图找一块
  let mv = null, mvMap = 0;
  for (let n = 1; n <= 22 && !mv; n++) {
    tg.startLevel(n);
    const f = tg.floors().find(f => f.move && f.move.axis === 'y');
    if (f) { mv = f; mvMap = n; }
  }
  ok(!!mv, '找到了升降平台（第 ' + mvMap + ' 关）');
  if (mv) {
    tg.noWave();
    tg.zombies().length = 0;
    tg.place((mv.x0 + mv.x1) / 2, mv.z);
    tick(tg, 2);
    const zA = tg.player().z, fA = mv.z;
    tick(tg, 55);
    ok(Math.abs(tg.player().z - mv.z) < 1.5, '玩家一直站在平台上（z 跟着平台走）',
      '玩家 ' + tg.player().z.toFixed(1) + ' vs 平台 ' + mv.z.toFixed(1));
    ok(Math.abs(mv.z - fA) > 1, '平台确实动了', fA.toFixed(1) + ' → ' + mv.z.toFixed(1));
  }
}

// ─────────────────────────────────────────────────────
section('⑧ 天气变体：每局随机，且真的影响游戏');
{
  const env = load();
  const { tg } = env;
  const W = tg.weathers();
  ok(Object.keys(W).length >= 4, '至少 4 种天气', Object.keys(W).join(' '));
  ok(Object.values(W).every(w => w.name && w.fogMul), '每种天气都有名字和雾倍率');

  // 同一张户外地图多开几局，应该抽到不止一种天气
  const seen = new Set();
  for (let i = 0; i < 40; i++) { tg.startLevel(1); seen.add(tg.weather()); }
  ok(seen.size >= 2, '第 1 关的天气池会抽出不同结果', [...seen].join('/'));

  // 室内图固定晴天
  for (let i = 0; i < 6; i++) { tg.startLevel(9); eq(tg.weather(), 'clear', '室内图（地铁隧道）永远是晴天'); break; }
  tg.startLevel(9);
  eq(tg.weather(), 'clear', '室内图固定晴天');

  // 雾倍率真的接进了 drawFog（间接验证：wmods 有值）
  tg.startLevel(1);
  ok(tg.wmods() && typeof tg.wmods().fogMul === 'number', '天气的雾倍率已就位', String(tg.wmods().fogMul));
}

// ─────────────────────────────────────────────────────
section('⑨ 昼夜推进：越靠近栅栏天色越暗');
{
  const env = fresh(1, { noStalker: true });
  const { tg } = env;
  tg.place(200);
  tick(tg, 2);
  const t0 = tg.dayT();
  tg.place(tg.fenceX() * 0.5);
  tick(tg, 2);
  const t1 = tg.dayT();
  tg.place(tg.fenceX() - 50);
  tick(tg, 2);
  const t2 = tg.dayT();
  ok(t0 < t1 && t1 < t2, '天色随推进度单调变暗', [t0, t1, t2].map(v => v.toFixed(2)).join(' → '));
  ok(t2 > 0.9, '快到栅栏时已经是最暗', t2.toFixed(2));
}

summary();
