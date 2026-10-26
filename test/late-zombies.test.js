'use strict';
// 第 11~22 关的四种新敌人验收：
//   ① 腐胀胖尸 —— 死后留下的毒雾会扩散、会持续掉血
//   ② 骨刺投手 —— 朝"你将会在的地方"扔，匀速直线跑必中
//   ③ 尖叫者   —— 范围内僵尸跑快 55%，出范围自动失效
//   ④ 护士尸   —— 范围内僵尸持续回血
// 以及：四种都不违反"地面僵尸 h ≥ 56"这条硬约束（否则子弹会从头顶飞过）
// 跑法：node test/late-zombies.test.js
const { load, ok, eq, near, section, summary, step: stepN } = require('./harness');

function fresh() {
  const env = load();
  env.tg.start();
  env.tg.waveClear();
  env.tg.noWave();
  env.tg.setState('play');
  env.tg.clearFloors();
  env.tg.place(2000);
  return env;
}
// 不动、不咬人的靶子
function dummy(tg, type, x, hp) {
  const z = tg.spawnAt(type, x);
  z.spd = 0; z.atkT = 9999; z.pounceT = 9999; z.shootT = 9999;
  if (hp !== undefined) z.hp = z.maxHp = hp;
  return z;
}
const d = (a, b) => Math.abs(a - b);

// ─────────────────────────────────────────────────────
section('① 硬约束：地面僵尸 h ≥ 56（否则平射会从头顶飞过）');
{
  const { tg } = fresh();
  const Z = tg.ztypes();
  const bad = [];
  for (const id of Object.keys(Z)) {
    const t = Z[id];
    if (t.boss) continue;
    if (t.h < 56) bad.push(id + ' h=' + t.h);
    if (t.w > 130) bad.push(id + ' w=' + t.w + '（过宽，判定框会吃掉半屏）');
  }
  eq(bad.length, 0, '14 种僵尸全部满足几何约束', bad.join(', '));

  const newOnes = ['bloater', 'thrower', 'screamer', 'nurse'];
  for (const id of newOnes) {
    ok(Z[id].h >= 56 && Z[id].dmg > 0 && Z[id].cash > 0, id + ' 的 h / 伤害 / 掉落都配齐了',
      'h=' + Z[id].h + ' dmg=' + Z[id].dmg + ' $' + Z[id].cash);
  }
}

// ─────────────────────────────────────────────────────
section('② 腐胀胖尸：死后留下会扩散的毒雾');
{
  const { tg } = fresh();
  const z = dummy(tg, 'bloater', tg.player().x + 300, 40);
  eq(tg.hazards().length, 0, '活着的时候地上是干净的');

  tg.damageAt(tg.zombies().indexOf(z), 999);
  eq(tg.zombies().indexOf(z), -1, '被打死了');
  const hs = tg.hazards();
  eq(hs.length, 1, '留下一片毒雾');
  eq(hs[0].type, 'gas', '类型是 gas（不是酸池也不是火带）');
  // 拿着引用而不是反复 hs[0] —— 毒雾 9 秒后自己会过期消失
  const gas = hs[0];

  const r0 = gas.r;
  stepN(tg, 60);
  ok(gas.r > r0, '毒雾会扩散（站着等它散掉是不行的）',
    r0.toFixed(0) + ' → ' + gas.r.toFixed(0));
  stepN(tg, 60 * 6);
  ok(gas.r <= 170 + 1, '扩散到上限就停，不会淹掉整张图',
    gas.r.toFixed(0) + ' (rMax = 170)');
  ok(gas.r >= 165, '而且确实扩到了上限附近', gas.r.toFixed(0));
}
{
  const { tg } = fresh();
  // 贴身打死：毒雾初始半径 78，判定用 r*0.85，站太远第一秒吃不到
  const z = dummy(tg, 'bloater', tg.player().x + 40, 40);
  tg.damageAt(tg.zombies().indexOf(z), 999);
  const hp0 = tg.player().hp;
  stepN(tg, 90);
  ok(tg.player().hp < hp0, '站在毒雾里会掉血',
    hp0 + ' → ' + Math.round(tg.player().hp));
  // 跑开
  tg.place(tg.player().x - 900);
  const hp1 = tg.player().hp;
  stepN(tg, 90);
  eq(tg.player().hp, hp1, '跑出范围就没事了（不是全屏伤害）');
}

// ─────────────────────────────────────────────────────
section('③ 骨刺投手：朝「你将会在的地方」扔');
{
  const { tg } = fresh();
  const z = dummy(tg, 'thrower', tg.player().x + 400);
  z.shootT = 0;
  stepN(tg, 3);
  const q = tg.zprojs()[0];
  ok(!!q, '扔出来了');
  eq(q.elem, 'bone', '是骨刺，不是酸液');
  // 投手在玩家右边，所以骨头往左飞
  ok(q.vx < 0, '朝玩家方向飞（投手在右侧 → vx 为负）', 'vx = ' + q.vx.toFixed(0));

  // 落地不留东西：骨刺是硬的
  const hz0 = tg.hazards().length;
  for (let i = 0; i < 300 && tg.zprojs().length; i++) stepN(tg, 1);
  eq(tg.zprojs().length, 0, '骨刺最终落地消失');
  eq(tg.hazards().length, hz0, '落地不留酸池/火带（这是它和喷吐者的区别）');
}
{
  // 骨头会落在哪：解 q.y + vy·t + ½gt² = 目标高度，取正根。
  // ⚠ 别拿 vx 当判据 —— throwAt 里 T = |dx| / spd，所以 vx = dx/T 恒等于 ±spd，
  //   预判改变的是**弧线**（飞得更久、更平），不是横向速度。第一版就是这么测错的。
  const GRAV = 900;                       // 和 PROJ_GRAV 一致
  function aimX(q, ty) {
    const a = 0.5 * GRAV, b = q.vy, c = q.y - ty;
    const disc = b * b - 4 * a * c;
    if (disc < 0) return null;
    const t = (-b + Math.sqrt(disc)) / (2 * a);
    return q.x + q.vx * t;
  }
  function throwRun(playerMoving) {
    const tg = fresh().tg;
    // 投手放左边，玩家往右跑 = 边跑边拉开距离
    const z = dummy(tg, 'thrower', tg.player().x - 520);
    z.shootT = 0;
    if (playerMoving) tg.hold('KeyD');
    let q = null, px = 0;
    for (let i = 0; i < 10 && !q; i++) { stepN(tg, 1); q = tg.zprojs()[0]; px = tg.player().x; }
    const vxNow = tg.player().vx;
    if (playerMoving) tg.release('KeyD');
    return { q, px, vxNow };
  }
  const still = throwRun(false);
  const run = throwRun(true);
  ok(!!still.q && !!run.q, '两种情况都扔出来了');
  eq(still.vxNow, 0, '站着那次玩家不动');
  ok(Math.abs(run.vxNow) > 100, '跑动那次玩家确实在动（否则这个测试没有意义）',
    'vx = ' + run.vxNow.toFixed(0));

  const ty = 610 - 44;                    // GROUND - player.z - 44，玩家 z = 0
  const stillAim = aimX(still.q, ty), runAim = aimX(run.q, ty);
  near(stillAim - still.px, 0, 12,
    '站着不动时，骨头瞄的就是你现在站的位置', '偏差 ' + (stillAim - still.px).toFixed(1) + 'px');
  ok(runAim - run.px > 90,
    '跑动时骨头落在你前方一大截 —— 匀速直线跑必中，想躲只能变向或起跳',
    '瞄在身前 ' + (runAim - run.px).toFixed(0) + 'px 处');
}

// ─────────────────────────────────────────────────────
section('④ 尖叫者：范围内的僵尸跑快 55%，出范围自动失效');
{
  const { tg } = fresh();
  const s = dummy(tg, 'screamer', tg.player().x + 600);
  s.spd = 0;                               // 尖叫者自己站着不动好测量
  s.def.spd = 0;
  const near_ = tg.spawnAt('normal', tg.player().x + 660);
  const far_ = tg.spawnAt('normal', tg.player().x + 660 + 900);   // 远在光环外
  for (const z of [near_, far_]) { z.spd = 100; z.atkT = 9999; }
  const n0 = near_.x, f0 = far_.x;
  stepN(tg, 30);
  const moved = d(near_.x, n0), farMoved = d(far_.x, f0);
  ok(moved > farMoved * 1.3,
    '光环内的走得明显更快（实测比值 ' + (moved / farMoved).toFixed(2) + '）',
    '范围内 ' + moved.toFixed(1) + 'px vs 范围外 ' + farMoved.toFixed(1) + 'px');
  ok(near_.hasteT > 0, '光环内的拿到了加速标记');
  eq(far_.hasteT > 0, false, '范围外的没有');

  // 把尖叫者挪走 → 标记 0.25 秒后自动失效
  s.x += 5000;
  stepN(tg, 30);
  ok(!(near_.hasteT > 0), '离开光环后标记失效（不用维护进出名单）');
}
{
  // 范围是 320px，边界外一点点就不该吃到
  const { tg } = fresh();
  const s = dummy(tg, 'screamer', tg.player().x + 2000);
  const inside = tg.spawnAt('normal', s.x + 300);
  const outside = tg.spawnAt('normal', s.x + 340);
  stepN(tg, 4);
  ok(inside.hasteT > 0, '光环半径内的吃到了');
  eq(outside.hasteT > 0, false, '半径外 20px 的没吃到（不是全屏光环）');
}
{
  const { tg } = fresh();
  const s = dummy(tg, 'screamer', tg.player().x + 500);
  const hp0 = s.hp;
  stepN(tg, 60);
  eq(s.hp, hp0, '尖叫者不会自己回血（回血是护士尸的活）');
  ok(tg.zombies().includes(s), '它也不会自爆');
}

// ─────────────────────────────────────────────────────
section('⑤ 护士尸：范围内的僵尸持续回血');
{
  const { tg } = fresh();
  const n = dummy(tg, 'nurse', tg.player().x + 1200);
  const hurt = tg.spawnAt('normal', n.x + 200);
  hurt.spd = 0; hurt.atkT = 9999;
  hurt.hp = 20;
  const out = tg.spawnAt('normal', n.x + 900);   // 光环外
  out.spd = 0; out.atkT = 9999;
  out.hp = 20;

  const h0 = hurt.hp, o0 = out.hp;
  stepN(tg, 60);
  ok(hurt.hp > h0, '光环内的僵尸在回血',
    h0 + ' → ' + hurt.hp.toFixed(1) + '（+16/秒）');
  eq(out.hp, o0, '光环外的没回血');
  ok(hurt.healT > 0, '被治疗的僵尸带上了视觉标记');

  // 回血有上限，不会超过最大生命
  stepN(tg, 60 * 10);
  ok(hurt.hp <= hurt.maxHp + 0.001, '回血不会超过最大生命值',
    hurt.hp.toFixed(1) + ' / ' + hurt.maxHp);
}
{
  // 医疗包和护士尸不冲突：护士尸只治僵尸，不治玩家
  const { tg } = fresh();
  const n = dummy(tg, 'nurse', tg.player().x + 60);
  tg.player().hp = 40;
  const hp0 = tg.player().hp;
  stepN(tg, 90);
  eq(tg.player().hp, hp0, '护士尸不会给玩家回血（别想太多）');
}

// ─────────────────────────────────────────────────────
section('⑥ 四种新怪各自的音效都接上了');
{
  const { tg } = fresh();
  const src = require('fs').readFileSync(
    require('path').join(__dirname, '..', 'app', 'js', '02-audio.js'), 'utf8');
  const body = src.slice(src.indexOf('groan('), src.indexOf('giant()'));
  for (const id of ['bloater', 'thrower', 'screamer', 'nurse']) {
    ok(body.includes("case '" + id + "'"), id + ' 在 groan() 里有自己的叫声分支');
  }
  ok(typeof tg.sfxKeys().shriek === 'function', '尖叫者的音波有专门的 SFX.shriek()');
}

// ─────────────────────────────────────────────────────
section('⑦ 图鉴里四种新怪都能正确描述');
{
  const { tg } = fresh();
  const Z = tg.ztypes();
  ok(Z.bloater.gas.rMax > Z.bloater.gas.r, '胖尸的毒雾定义了扩散目标半径',
    Z.bloater.gas.r + ' → ' + Z.bloater.gas.rMax);
  eq(!!Z.thrower.ranged.lead, true, '骨刺投手标了 lead（预判走位）');
  eq(Z.screamer.aura.type, 'haste', '尖叫者是加速光环');
  eq(Z.nurse.aura.type, 'heal', '护士尸是回血光环');
  // 死亡/光环字段的类型要认得出
  for (const id of ['bloater', 'thrower', 'screamer', 'nurse']) {
    const t = Z[id];
    const tag = t.gas ? '毒雾' : t.aura && t.aura.type === 'heal' ? '回血光环'
      : t.aura ? '加速光环' : t.ranged && t.ranged.lead ? '预判投掷' : '?';
    ok(tag !== '?', id + ' 能被图鉴归到某一类机制', tag);
  }
}

// ─────────────────────────────────────────────────────
section('⑧ 四种新怪在真实帧里都能画出来 + 一起上不崩');
{
  const { tg } = fresh();
  const ids = ['bloater', 'thrower', 'screamer', 'nurse'];
  for (const id of ids) {
    const env = fresh();
    for (let i = 0; i < 3; i++) dummy(env.tg, id, env.tg.player().x + 200 + i * 120);
    let broke = null;
    try { for (let i = 0; i < 60; i++) { env.tg.frame(i * 16.7); env.tg.setState('play'); } }
    catch (e) { broke = e.message; }
    ok(!broke, id + ' 连跑 60 个真实帧不报错', broke || '');
  }
  // 混在一起 + 全屏压力
  const env = fresh();
  for (let i = 0; i < 24; i++) dummy(env.tg, ids[i % 4], env.tg.player().x + (i - 12) * 70);
  let broke = null;
  try { for (let i = 0; i < 300; i++) { env.tg.frame(i * 16.7); env.tg.setState('play'); } }
  catch (e) { broke = e.message; }
  ok(!broke, '24 只新怪同屏 + 光环互相作用，跑 300 帧不报错', broke || '');

  // 顺手确认光环确实是 O(n²) 也扛得住
  const t0 = Date.now();
  for (let i = 0; i < 600; i++) { env.tg.frame(i * 16.7); env.tg.setState('play'); }
  const per = (Date.now() - t0) / 600;
  ok(per < 4, '每帧耗时仍在预算内', per.toFixed(2) + ' ms/帧（60fps 预算 16.7）');
}

summary();
