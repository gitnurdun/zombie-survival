'use strict';
// 第 2 步验收：键盘操作层重构
// 覆盖：朝向派生 aim、严格水平弹道、3 武器槽、W 跳跃 / 空格开火、跳起爆头。
// 跑法：node test/keyboard.test.js
const { load, ok, eq, section, summary, keyDown, step } = require('./harness');

const GROUND = 610;
const PH = 74;
// 枪口高度：GROUND - player.h + 34 - player.z + sin(aim)*36，sin 恒为 0
const muzzleY = z => GROUND - PH + 34 - (z || 0);          // 570 - z

function fresh(opts = {}) {
  const env = load();
  env.tg.start();
  env.tg.waveClear();
  env.tg.noWave();            // 关掉刷怪（新的刷怪器一直在跑，会干扰测量）
  env.tg.clearFloors();       // 这套测的是平地手感，清掉自动生成的高台
  env.tg.props().length = 0;  // 清掉路边物件（它们会挡住子弹，是正确行为但会干扰测量）
  env.tg.place(2000);
  if (opts.weapons) env.tg.giveWeapons(opts.weapons);
  env.tg.setState('play');
  return env;
}

// ─────────────────────────────────────────────────────
section('1. 朝向 — A/D 决定 facing，aim 由 facing 派生');
{
  const { tg } = fresh();

  tg.hold('KeyD'); step(tg, 1);
  eq(tg.player().facing, 1, 'D → facing = 1');
  eq(tg.player().aim, 0, 'facing = 1 → aim = 0（cos = +1，枪口朝右）');
  tg.release('KeyD');

  tg.hold('KeyA'); step(tg, 1);
  eq(tg.player().facing, -1, 'A → facing = -1');
  eq(tg.player().aim, Math.PI, 'facing = -1 → aim = π（cos = -1，枪口朝左）');
  tg.release('KeyA');

  tg.hold('ArrowLeft'); step(tg, 1);
  eq(tg.player().facing, -1, '← 方向键与 A 等效');
  tg.release('ArrowLeft');

  tg.hold('ArrowRight'); step(tg, 1);
  eq(tg.player().facing, 1, '→ 方向键与 D 等效');
  tg.release('ArrowRight');

  step(tg, 5);
  eq(tg.player().facing, 1, '松开按键后朝向保持，不会重置');
}

// ─────────────────────────────────────────────────────
section('2. 弹道 — 严格水平，方向 = 朝向');
{
  const env = fresh({ weapons: ['pistol'] });
  const { tg } = env;

  tg.hold('KeyD'); step(tg, 1);
  tg.hold('Space'); step(tg, 1);
  tg.release('Space');

  let bs = tg.bullets();
  ok(bs.length > 0, '按住空格能开火', '子弹数 ' + bs.length);
  ok(bs.every(b => b.vy === 0), 'vy 恒为 0');
  ok(bs.every(b => b.grav === 0), 'grav 恒为 0（不受重力）');
  ok(bs.every(b => b.vx > 0), '朝向 +1 → vx > 0');

  const y0 = bs[0].y;
  eq(y0, muzzleY(0), '枪口高度 = 570（GROUND - player.h + 34）');

  step(tg, 20);
  ok(bs[0] && Math.abs(bs[0].y - y0) < 1e-9,
    '飞行 20 帧后高度完全不变（无 spread 漂移）',
    bs[0] ? (y0 + ' → ' + bs[0].y) : '子弹已飞出');

  tg.bullets().length = 0;
  tg.release('KeyD');
  tg.giveWeapons(['pistol']);
  tg.hold('KeyA'); step(tg, 1);
  tg.hold('Space'); step(tg, 1);
  tg.release('Space'); tg.release('KeyA');

  bs = tg.bullets();
  ok(bs.length > 0 && bs.every(b => b.vx < 0), '朝向 -1 → vx < 0');
  ok(bs.every(b => b.vy === 0), '反向射击 vy 同样为 0');
}

// ─────────────────────────────────────────────────────
section('3. 武器槽 — 3 槽上限、X 循环、1/2/3 直跳');
{
  const env = fresh({ weapons: ['pistol', 'pump', 'uzi'] });
  const { tg } = env;
  const p = tg.player();

  eq(p.weapons.length, 3, '能装备 3 把武器');
  eq(p.slot, 0, '初始在 0 号槽');

  keyDown(env, 'KeyX'); eq(p.slot, 1, 'X → 1 号槽');
  keyDown(env, 'KeyX'); eq(p.slot, 2, 'X → 2 号槽');
  keyDown(env, 'KeyX'); eq(p.slot, 0, 'X → 绕回 0 号槽');

  keyDown(env, 'Digit3'); eq(p.slot, 2, '3 → 直跳 2 号槽');
  keyDown(env, 'Digit1'); eq(p.slot, 0, '1 → 直跳 0 号槽');
  keyDown(env, 'Digit2'); eq(p.slot, 1, '2 → 直跳 1 号槽');

  const env2 = fresh();
  const { tg: tg2 } = env2;
  eq(tg2.player().weapons.length, 1, '开局只有木棍');
  keyDown(env2, 'KeyX');
  eq(tg2.player().slot, 0, '只有 1 把武器时 X 不会切到空槽');
  keyDown(env2, 'Digit2');
  eq(tg2.player().slot, 0, '1/2/3 点到空槽不生效');
  keyDown(env2, 'Digit1');
  eq(tg2.player().slot, 0, '重复点当前槽位不触发');
}

// ─────────────────────────────────────────────────────
section('4. 跳跃键 — W / ↑ 跳，空格不再跳');
{
  const { tg } = fresh();

  tg.hold('KeyW'); step(tg, 3);
  ok(tg.player().z > 0, 'W → 起跳', 'z = ' + tg.player().z.toFixed(1));
  tg.release('KeyW');

  let guard = 0;
  while (tg.player().z > 0 && guard++ < 400) step(tg, 1);
  eq(tg.player().z, 0, '重力把玩家带回地面（' + guard + ' 帧）');

  tg.hold('Space'); step(tg, 5);
  eq(tg.player().z, 0, '空格不再触发跳跃');
  tg.release('Space');

  tg.hold('ArrowUp'); step(tg, 3);
  ok(tg.player().z > 0, '↑ 与 W 等效');
  tg.release('ArrowUp');
}

// ─────────────────────────────────────────────────────
section('5. 空格开火 — 近战和枪械共用一个键');
{
  const a = fresh();
  a.tg.hold('Space'); step(a.tg, 1);
  ok(a.tg.player().swingT > 0, '手持近战时空格触发挥砍',
    'swingT = ' + a.tg.player().swingT.toFixed(3));
  a.tg.release('Space');

  const b = fresh({ weapons: ['pistol'] });
  b.tg.hold('Space'); step(b.tg, 1);
  ok(b.tg.bullets().length > 0, '手持枪械时空格射出一发子弹');
  b.tg.release('Space');

  // 按住不放时按武器射速连发
  const c = fresh({ weapons: ['uzi'] });
  c.tg.hold('Space');
  step(c.tg, 30);                       // 0.5s
  const n = c.tg.bullets().length;
  ok(n >= 5, '按住空格能连发（冲锋枪 0.5 秒打出 ' + n + ' 发）');
  c.tg.release('Space');
}

// ─────────────────────────────────────────────────────
section('6. 爆头 — 站着打身体，跳起来打头');
{
  const env = fresh({ weapons: ['pistol'] });
  const { tg } = env;

  // 几何事实记录：枪口恒在 y=570。普通僵尸 h=64（顶 546 / 脚 610），
  // 570 落在它高度的 37.5% 处 —— 上胸，不是头。所以站着平射必定是普通伤害。
  eq(muzzleY(0), 570, '站着时枪口 y = 570');

  function shootAt(type, zx, jump) {
    tg.bullets().length = 0;
    tg.giveWeapons(['pistol']);          // 重置冷却与弹药
    tg.player().weapons[0].def.crit = 0; // 关掉暴击再量伤害 —— 手枪自带 10% 暴击，不关会随机翻倍
    const z = tg.spawnAt(type, zx);
    z.hp = z.maxHp = 1e6;
    z.spd = 0; z.atkT = 999;             // 站住别动、别反击
    const before = z.hp;

    if (jump) {
      tg.hold('KeyW');
      step(tg, 12);                      // 跳到高处
      tg.release('KeyW');
      ok(tg.player().z > 12, '起跳高度足以被判定为"在空中"', 'z = ' + tg.player().z.toFixed(1));
    }

    tg.hold('Space'); step(tg, 1); tg.release('Space');
    const fired = tg.bullets()[0];
    const wasAir = !!fired && fired.air;
    step(tg, 30);                        // 让子弹飞过去

    const dmg = before - z.hp;
    const i = tg.zombies().indexOf(z);
    if (i >= 0) tg.zombies().splice(i, 1);
    let g = 0;
    while (tg.player().z > 0 && g++ < 400) step(tg, 1);   // 落地，为下一枪复位
    return { dmg, wasAir };
  }

  const body = shootAt('normal', 2300, false);
  const head = shootAt('normal', 2300, true);

  eq(body.wasAir, false, '站着开枪：子弹 air = false');
  eq(head.wasAir, true, '跳起开枪：子弹 air = true');
  eq(body.dmg, 16, '站着平射 → 普通伤害（手枪 16）');
  eq(head.dmg, 32, '跳起平射 → 爆头伤害（16 × 2）');
  ok(head.dmg === body.dmg * 2, '爆头正好是普通伤害的 2 倍');

  // 巨型尸 h=118：头在跳跃顶点之上，跳射也只能打身体
  const giant = shootAt('giant', 2400, true);
  eq(giant.dmg, 16, '巨型尸即使跳射也只吃普通伤害（noHeadshot）');
}

// ─────────────────────────────────────────────────────
section('7. 切窗口 — blur 清空按住的键');
{
  const env = fresh();
  const { tg } = env;

  // 手动触发注册在 window 上的 blur 监听
  tg.hold('KeyD');
  step(tg, 1);
  eq(tg.player().facing, 1, '按住 D 时朝右');
  const x0 = tg.player().x;

  (env.listeners.blur || []).forEach(f => f());
  step(tg, 10);
  eq(tg.player().vx, 0, 'blur 之后玩家不再继续向右冲（vx 归零）');
  ok(Math.abs(tg.player().x - x0) < 1, 'blur 之后位置几乎不动',
    'x ' + x0.toFixed(1) + ' → ' + tg.player().x.toFixed(1));
}

summary();
