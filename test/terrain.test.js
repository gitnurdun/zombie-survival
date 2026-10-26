'use strict';
// 多层地形验收：平台落地、走出边缘下落、从高台射击仍能命中地面僵尸。
// 跑法：node test/terrain.test.js
const { load, ok, eq, near, section, summary, step } = require('./harness');

const GROUND = 610;
const FLOOR_H = 88;                 // 与游戏里的常量一致
const JUMP_APEX = 560 * 560 / 3000; // ≈ 104.5 —— 一跳的最大高度

function fresh() {
  const env = load();
  env.tg.start();
  env.tg.waveClear();
  env.tg.clearFloors();       // 本节测的是平台物理本身，先清空自动生成的高台
  env.tg.props().length = 0;  // 清掉路边物件（会挡住子弹）
  env.tg.place(2000);
  env.tg.setState('play');
  return env;
}

// ─────────────────────────────────────────────────────
section('1. 层高必须跳得上去');
{
  ok(FLOOR_H < JUMP_APEX, '层高 ' + FLOOR_H + ' < 跳跃顶点 ' + JUMP_APEX.toFixed(1),
    '余量 ' + (JUMP_APEX - FLOOR_H).toFixed(1) + 'px');
  ok(JUMP_APEX - FLOOR_H > 10, '余量足够（> 10px），不会因为浮点误差跳不上去');
}

// ─────────────────────────────────────────────────────
section('2. 基础地面 + 关卡自动生成高台');
{
  const { tg } = fresh();
  eq(tg.floors().length, 1, '清空后只剩一块铺满全图的最低地面');
  eq(tg.player().z, 0, '出生在最低地面');
  eq(tg.player().onGround, true, 'onGround = true');
  eq(tg.player().floor.z, 0, '当前平台 z = 0');

  // 不清空的话，resetGame → buildFloors() 应该已经撒出一堆高台
  const env2 = load();
  env2.tg.start();
  const fs = env2.tg.floors();
  const plats = fs.filter(f => !f.base);
  ok(plats.length > 0, 'buildFloors 自动生成了高台', plats.length + ' 块');
  eq(fs[0].base, true, '第一块永远是铺满全图的最低地面');
  ok(fs[0].x0 === 0 && fs[0].x1 >= 4400, '最低地面覆盖全程');
  ok(plats.every(p => p.z === 88 || p.z === 176), '高台高度只能是 1 层或 2 层',
    [...new Set(plats.map(p => p.z))].join(','));
  ok(plats.every(p => p.x1 > p.x0), '每块平台的区间合法');
}

// ─────────────────────────────────────────────────────
section('3. 跳上高台');
{
  const { tg } = fresh();
  tg.addFloor(2200, 2600, FLOOR_H);
  tg.place(2400);                      // 站到高台正下方
  eq(tg.player().z, 0, '在地面时 z = 0（高台在头顶不影响）');

  tg.hold('KeyW'); step(tg, 1); tg.release('KeyW');
  let g = 0;
  while (!tg.player().onGround && g++ < 300) step(tg, 1);

  eq(tg.player().onGround, true, '落回某个平台上');
  eq(tg.player().z, FLOOR_H, '落在高台上：z = ' + FLOOR_H);
  eq(tg.player().floor.z, FLOOR_H, 'player.floor 指向高台');
}

// ─────────────────────────────────────────────────────
section('4. 高台下方走过不受影响');
{
  const { tg } = fresh();
  tg.addFloor(2200, 2600, FLOOR_H);
  tg.place(2400);
  step(tg, 30);
  eq(tg.player().z, 0, '在高台正下方走 30 帧仍然是 z = 0（不会被吸上去）');
  eq(tg.player().onGround, true, 'onGround 保持 true');
}

// ─────────────────────────────────────────────────────
section('5. 走出高台边缘会掉下去');
{
  const { tg } = fresh();
  tg.addFloor(2200, 2600, FLOOR_H);
  tg.place(2400, FLOOR_H);
  eq(tg.player().z, FLOOR_H, '先站到高台上');

  tg.hold('KeyD');                     // 一路向右走出边缘（x > 2600）
  let g = 0;
  while (tg.player().x < 2620 && g++ < 300) step(tg, 1);
  eq(tg.player().onGround, false, '走出边缘后 onGround = false');

  g = 0;
  while (!tg.player().onGround && g++ < 300) step(tg, 1);
  tg.release('KeyD');
  eq(tg.player().z, 0, '自由落体回到最低地面');
  eq(tg.player().floor.base, true, 'player.floor 指回基础地面');
}

// ─────────────────────────────────────────────────────
section('6. 从高台射击仍然打得到地面僵尸');
{
  const { tg } = fresh();
  tg.addFloor(2200, 2600, FLOOR_H);
  tg.place(2400, FLOOR_H);
  tg.giveWeapons(['pistol']);
  tg.player().weapons[0].def.crit = 0;    // 手枪自带 10% 暴击，不关掉这里会随机量到 32

  const z = tg.spawnAt('normal', 2750);   // 地面上的僵尸，在高台右侧
  z.hp = z.maxHp = 1e6;
  z.spd = 0; z.atkT = 999;
  const before = z.hp;

  tg.hold('KeyD'); step(tg, 3); tg.release('KeyD');
  tg.hold('Space'); step(tg, 1); tg.release('Space');

  const b = tg.bullets()[0];
  ok(!!b, '开枪成功');
  eq(b.air, false, '站在高台上不算"在空中"→ 这一发不是爆头');
  // 注意：开枪和子弹推进在同一帧里发生，所以这里读到的 y 已经前进了一帧
  near(b.y, (GROUND - 74 + 34 - FLOOR_H) + b.vy / 60, 0.5,
    '枪口从 482 出发（570 - 88），本帧已前进一小段');
  ok(b.vy > 0, '从高处射出时子弹斜向下（vy > 0）', 'vy = ' + b.vy.toFixed(1));

  step(tg, 40);
  const dmg = before - z.hp;
  eq(dmg, 16, '命中地面僵尸，普通伤害 16（没有从头顶飞过去）');
  ok(b.y === GROUND - 74 + 34, '子弹最终压回腰部高度 570 后转平', 'y = ' + b.y.toFixed(1));
}

// ─────────────────────────────────────────────────────
section('7. 从地面射击高台上的僵尸');
{
  const { tg } = fresh();
  tg.addFloor(2200, 2600, FLOOR_H);
  tg.place(2100);
  tg.giveWeapons(['pistol']);

  const z = tg.spawnAt('normal', 2400);
  z.hp = z.maxHp = 1e6;
  z.spd = 0; z.atkT = 999;
  z.z = FLOOR_H;                        // 把它放到高台上
  const before = z.hp;

  tg.hold('KeyD'); step(tg, 1);
  tg.hold('Space'); step(tg, 1); tg.release('Space');
  step(tg, 40);

  const dmg = before - z.hp;
  ok(dmg > 0, '站着平射也能打中高台上的僵尸（靠 V_TOL 的上下宽容度）', '伤害 ' + dmg);
}

// ─────────────────────────────────────────────────────
section('8. 跳跃仍然是爆头，站在高台上不是');
{
  const a = fresh();
  const { tg } = a;
  tg.giveWeapons(['pistol']);
  tg.place(2000);
  tg.hold('KeyW'); step(tg, 8);
  tg.hold('Space'); step(tg, 1); tg.release('Space'); tg.release('KeyW');
  eq(tg.bullets()[0].air, true, '跳跃中开枪 → air = true（爆头）');

  const b = fresh();
  const { tg: tg2 } = b;
  tg2.addFloor(1900, 2300, FLOOR_H);
  tg2.place(2100, FLOOR_H);
  tg2.giveWeapons(['pistol']);
  tg2.hold('Space'); step(tg2, 1); tg2.release('Space');
  eq(tg2.bullets()[0].air, false, '站在高台上开枪 → air = false（不是爆头）');
}

summary();
