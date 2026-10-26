'use strict';
// 僵尸解锁曲线 + 新类型行为验收：
//   ① 第 1 关只有村民僵尸，每关只解锁一种新敌人
//   ② 重甲尸正面弹开子弹（跳射爆头 / 破甲武器除外）
//   ③ 自爆尸：贴上来点燃引信 → 爆炸伤玩家 + 连锁炸其他僵尸
//   ④ 酸液喷吐者：抛物线投掷 → 落地留酸池 → 踩上去持续掉血，跳起来就没事
//   ⑤ 变异犬：低矮四足，能站上高台
// 跑法：node test/zombies.test.js
const { load, ok, eq, section, summary } = require('./harness');

function fresh(level = 1, cash) {
  const env = load();
  env.tg.startLevel(level);
  if (cash !== undefined) env.tg.save().cash = cash;
  env.tg.noWave();              // 手动控制刷怪，避免干扰
  env.tg.setState('play');
  env.tg.props().length = 0;    // 清掉路边物件，免得挡住子弹
  env.tg.clearFloors();
  env.tg.place(2000);
  return env;
}
function tick(tg, n = 1) { for (let i = 0; i < n; i++) tg.step(1 / 60); }
function sample(tg, p, lv, n = 3000) {
  const c = {};
  for (let i = 0; i < n; i++) { const t = tg.pickType(p, lv); c[t] = (c[t] || 0) + 1; }
  return c;
}
const total = c => Object.values(c).reduce((a, b) => a + b, 0);
const share = (c, k) => (c[k] || 0) / total(c);

// ─────────────────────────────────────────────────────
section('① 每关只解锁一种新敌人');
{
  const env = fresh();
  const { tg } = env;
  const Z = tg.ztypes();
  const names = n => tg.newTypesAt(n).map(id => Z[id].name);

  eq(names(1).join(), '村民僵尸', '第 1 关解锁：村民僵尸');
  eq(names(6).join(), '巨型尸', '第 6 关解锁：巨型尸');
  eq(names(10).join(), '病毒体·母巢', '第 10 关解锁：Boss');
  // 11 关往后原本一个新敌人都没有，白白平了 12 张图的威胁曲线
  eq(names(11).join(), '腐胀胖尸', '第 11 关解锁：腐胀胖尸');
  eq(names(13).join(), '骨刺投手', '第 13 关解锁：骨刺投手');
  eq(names(16).join(), '尖叫者', '第 16 关解锁：尖叫者');
  eq(names(21).join(), '护士尸', '第 21 关解锁：护士尸');

  // 遍历全部关卡，不是写死的 10 —— 关卡数改了这条断言也不会悄悄失效
  const LVS = tg.mapCount();
  let bad = [];
  const seen = new Set();
  for (let lv = 1; lv <= LVS; lv++) {
    for (const id of tg.newTypesAt(lv)) {
      if (seen.has(id)) bad.push(id);
      seen.add(id);
    }
  }
  eq(bad.length, 0, '没有任何类型被重复解锁');
  eq(seen.size, Object.keys(Z).length, '所有僵尸类型都被某一关覆盖',
    seen.size + ' / ' + Object.keys(Z).length);
  // 后半程也不能是一路平推
  const late = [];
  for (let lv = 11; lv <= LVS; lv++) late.push(...tg.newTypesAt(lv));
  ok(late.length >= 4, '第 11 关往后仍然有新敌人登场（不是 12 张图一个样）',
    late.length + ' 种：' + late.map(id => Z[id].name).join('、'));
}

// ─────────────────────────────────────────────────────
section('② 低关卡不会出现后面的敌人');
{
  const env = fresh();
  const { tg } = env;
  const Z = tg.ztypes();
  let leaks = [];
  for (let lv = 1; lv <= 10; lv++) {
    for (let p = 0; p <= 1.001; p += 0.1) {
      for (let i = 0; i < 120; i++) {
        const t = tg.pickType(p, lv);
        if (Z[t].from > lv) leaks.push('第' + lv + '关出现了' + Z[t].name);
      }
    }
  }
  eq(leaks.length, 0, '11 个推进度 × 120 次抽样都抽不到未解锁的类型',
    leaks.slice(0, 3).join(' / '));
}

// ─────────────────────────────────────────────────────
section('③ 第 1 关只有村民僵尸（全程）');
{
  const env = fresh();
  const { tg } = env;
  const s = new Set();
  for (let p = 0; p <= 1.001; p += 0.05) for (let i = 0; i < 300; i++) s.add(tg.pickType(p, 1));
  eq([...s].join(), 'normal', '整关只抽得到 normal');
}

// ─────────────────────────────────────────────────────
section('④ 难度随推进度上升：后期基础僵尸变少、重型变多');
{
  const env = fresh();
  const { tg } = env;
  const early = sample(tg, 0.05, 8);
  const late  = sample(tg, 0.95, 8);
  ok(share(late, 'normal') < share(early, 'normal'), '后期村民僵尸占比下降',
    Math.round(share(early, 'normal') * 100) + '% → ' + Math.round(share(late, 'normal') * 100) + '%');
  ok(share(late, 'giant') > share(early, 'giant'), '后期巨型尸占比上升',
    Math.round(share(early, 'giant') * 100) + '% → ' + Math.round(share(late, 'giant') * 100) + '%');
  ok(share(late, 'heavy') > share(early, 'heavy'), '后期重甲尸占比上升');
}

// ─────────────────────────────────────────────────────
section('⑤ 重甲尸：正面弹开子弹');
{
  const env = fresh(4);
  const { tg } = env;
  tg.props().length = 0;

  function shoot(wepId, jump) {
    tg.bullets().length = 0;
    tg.giveWeapons([wepId]);
    const melee = tg.player().weapons[0].def.melee;
    // 近战要贴脸才够得着（挥砍范围 80 + z.w/2），远程放在 400px 外
    const z = tg.spawnAt('heavy', melee ? 2090 : 2400);
    z.hp = z.maxHp = 1e6; z.spd = 0; z.atkT = 999;
    const before = z.hp;
    if (jump) { tg.hold('KeyW'); tick(tg, 12); tg.release('KeyW'); }
    tg.hold('Space'); tick(tg, melee ? 3 : 1); tg.release('Space');
    tick(tg, 40);
    const dmg = before - z.hp;
    const i = tg.zombies().indexOf(z); if (i >= 0) tg.zombies().splice(i, 1);
    let g = 0; while (tg.player().z > 0 && g++ < 400) tick(tg, 1);
    return dmg;
  }

  eq(shoot('pistol', false), 0, '手枪站着平射 → 完全被弹开（0 伤害）');
  ok(shoot('pistol', true) > 0, '跳起来打头 → 打得进去');
  ok(shoot('tesla', false) > 0, '特斯拉（破甲）→ 直接打进去');
  ok(shoot('axe', false) > 0, '消防斧（破甲近战）→ 也打得进去');
}

// ─────────────────────────────────────────────────────
section('⑥ 自爆尸：点燃引信 → 爆炸');
{
  const env = fresh(5);
  const { tg } = env;
  tg.props().length = 0;
  const z = tg.spawnAt('bomber', 2030);   // 贴到玩家身边
  z.spd = 0;
  const hp0 = tg.player().hp;

  tick(tg, 6);
  ok(z.fuse > 0, '贴上来就点了引信', 'fuse = ' + z.fuse.toFixed(2));

  let guard = 0;
  while (tg.zombies().includes(z) && guard++ < 200) tick(tg, 1);
  ok(!tg.zombies().includes(z), '引信烧完后自爆（自己消失）');
  ok(tg.player().hp < hp0, '炸伤了玩家', hp0 + ' → ' + Math.round(tg.player().hp));

  // 连锁：旁边的僵尸也该被炸到
  const env2 = fresh(5);
  const { tg: t2 } = env2;
  t2.props().length = 0;
  t2.place(2000);
  const b = t2.spawnAt('bomber', 2030); b.spd = 0;
  const other = t2.spawnAt('normal', 2060); other.spd = 0; other.hp = other.maxHp = 1e6;
  const ohp = other.hp;
  for (let i = 0; i < 200 && t2.zombies().includes(b); i++) tick(t2, 1);
  ok(other.hp < ohp, '爆炸会连锁伤到旁边的僵尸', ohp + ' → ' + Math.round(other.hp));
}

// ─────────────────────────────────────────────────────
section('⑦ 酸液喷吐者：远程投掷 → 留酸池 → 踩上去掉血');
{
  const env = fresh(3);
  const { tg } = env;
  tg.props().length = 0;
  tg.giveWeapons(['pistol']);
  tg.place(2000);

  const z = tg.spawnAt('spitter', 2500);   // 在 keep 距离外
  z.spd = 0; z.shootT = 0.05;

  let guard = 0;
  while (tg.zprojs().length === 0 && guard++ < 300) tick(tg, 1);
  ok(tg.zprojs().length > 0, '喷吐者扔出了酸液', guard + ' 帧后');

  guard = 0;
  while (tg.hazards().length === 0 && guard++ < 600) tick(tg, 1);
  ok(tg.hazards().length > 0, '酸液落地留下一片酸池');

  // 走进去 → 持续掉血
  const hz = tg.hazards()[0];
  const hp0 = tg.player().hp;
  tg.place(hz.x);
  tick(tg, 60);                            // 1 秒
  ok(tg.player().hp < hp0, '站在酸池里会掉血', hp0 + ' → ' + Math.round(tg.player().hp));

  // 跳起来（z=88）就没事
  const env2 = fresh(3);
  const { tg: t2 } = env2;
  t2.player().hp = 100;
  t2.addFloor(1800, 2200, 88);          // 铺一块真高台，否则玩家会掉下去踩到酸池
  t2.hazards().push({ type: 'acid', x: 2000, z: 0, r: 54, t: 0, tick: 0, life: 9 });
  t2.place(2000, 88);
  tick(t2, 60);
  eq(t2.player().z, 88, '玩家确实站在高台上');
  eq(t2.player().hp, 100, '站在高台上就碰不到下面的酸池了（跳跃的用途之一）');
}

// ─────────────────────────────────────────────────────
section('⑧ 变异犬：低矮四足 + 能上高台');
{
  const env = fresh(7);
  const { tg } = env;
  const d = tg.ztypes().crawler;
  eq(d.shape, 'beast', '画成四足剪影');
  eq(d.climb, true, '能站上高台');
  ok(d.h >= 56, 'h ≥ 56（否则会被水平弹道从头顶飞过）', 'h = ' + d.h);
  ok(d.h < tg.ztypes().normal.h, '比村民僵尸矮', d.h + ' < ' + tg.ztypes().normal.h);
}

// ─────────────────────────────────────────────────────
section('⑨ 所有僵尸都满足 h ≥ 56 的几何约束');
{
  const env = fresh();
  const { tg } = env;
  const Z = tg.ztypes();
  const bad = Object.keys(Z).filter(id => Z[id].h < 56);
  eq(bad.length, 0, '没有被平射飞过的矮僵尸', bad.join(','));
  const badName = Object.keys(Z).filter(id => !Z[id].name);
  eq(badName.length, 0, '每种僵尸都有中文名（图鉴要用）');
}

summary();
