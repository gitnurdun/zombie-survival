'use strict';
// 安全屋验收：跳进跳出、绝对安全、物资只刷 2 批、僵尸砸屋直至倒塌。
// 跑法：node test/safehouse.test.js
const { load, ok, eq, section, summary, step: stepN } = require('./harness');

function fresh() {
  const env = load();
  env.tg.start();
  env.tg.waveClear();
  env.tg.noWave();          // 关掉遗留的波次清场（它会每帧把安全屋刷新次数和血量重置）
  env.tg.setState('play');
  return env;
}
function firstSafe(tg) {
  return tg.houses().find(h => h.type === 'safe');
}
// 清掉刷出来的东西，方便单独验证某一批
function clearDrops(tg) { tg.items().length = 0; tg.coins().length = 0; }

// ─────────────────────────────────────────────────────
section('1. 关卡里有安全屋，且初始是完好 + 绿灯状态');
{
  const { tg } = fresh();
  const h = firstSafe(tg);
  ok(!!h, '关卡里生成了安全屋');
  eq(h.hp, h.maxHp, '初始满血');
  eq(h.refreshes, 0, '初始没刷过物资 → 窗户灯是绿色（还有物资）');
  eq(h.dead, false, '未倒塌');
}

// ─────────────────────────────────────────────────────
section('2. 门口按 ↑ 走进屋（不是跳起来）');
{
  const { tg } = fresh();
  const h = firstSafe(tg);
  tg.place(h.x + h.w / 2);               // 站到门口

  tg.tap('KeyW'); stepN(tg, 1);
  tg.release('KeyW');
  eq(tg.player().inside, h, '门口按 ↑ → 进入屋内');
  eq(tg.player().z, 0, '进屋不会跳起来');
  eq(tg.player().onGround, true, 'onGround 保持 true');
}

// ─────────────────────────────────────────────────────
section('3. 不在门口按 ↑ 仍然是正常跳跃');
{
  const { tg } = fresh();
  tg.place(120);                          // 远离任何门
  tg.tap('KeyW'); stepN(tg, 3);
  tg.release('KeyW');
  eq(tg.player().inside, null, '没有进屋');
  ok(tg.player().z > 0, '正常跳了起来', 'z = ' + tg.player().z.toFixed(1));
}

// ─────────────────────────────────────────────────────
section('4. 屋里僵尸打不到玩家');
{
  const { tg } = fresh();
  const h = firstSafe(tg);
  tg.place(h.x + h.w / 2);
  tg.tap('KeyW'); stepN(tg, 1); tg.release('KeyW');
  eq(tg.player().inside, h, '已在屋内');

  const z = tg.spawnAt('normal', h.x + h.w / 2 + 30);
  z.atkT = 0;
  const hpBefore = tg.player().hp;
  stepN(tg, 180);                         // 3 秒
  eq(tg.player().hp, hpBefore, '屋里 3 秒，HP 一点没掉');
  ok(h.hp < h.maxHp, '僵尸改成砸房子了', '房屋 HP ' + Math.round(h.hp) + '/' + h.maxHp);
}

// ─────────────────────────────────────────────────────
section('5. 屋内再跳一下出来');
{
  const { tg } = fresh();
  const h = firstSafe(tg);
  tg.place(h.x + h.w / 2);
  tg.tap('KeyW'); stepN(tg, 1); tg.release('KeyW');

  tg.tap('KeyW'); stepN(tg, 1); tg.release('KeyW');
  eq(tg.player().inside, null, '屋内按 ↑ → 出来');
  ok(Math.abs(tg.player().x - (h.x + h.w / 2)) < 2, '出来后站在门口');
}

// ─────────────────────────────────────────────────────
section('6. 物资最多刷 2 批');
{
  const { tg } = fresh();
  const h = firstSafe(tg);
  tg.place(h.x + h.w / 2);
  tg.tap('KeyW'); stepN(tg, 1); tg.release('KeyW');

  stepN(tg, 3);
  eq(h.refreshes, 1, '进屋立刻刷第 1 批');
  ok(tg.items().length + tg.coins().length > 0, '屋里确实出现了东西');

  stepN(tg, 9 * 60);                      // 再等 9 秒（刷新间隔 8 秒）
  eq(h.refreshes, 2, '8 秒后刷第 2 批');

  clearDrops(tg);
  stepN(tg, 30 * 60);                     // 再等 30 秒
  eq(h.refreshes, 2, '不会刷第 3 批');
  eq(tg.items().length + tg.coins().length, 0, '屋里不再有新物资');
}

// ─────────────────────────────────────────────────────
section('7. 房子被砸塌：玩家被弹出 + 受伤 + 房子消失');
{
  const { tg } = fresh();
  const h = firstSafe(tg);
  tg.place(h.x + h.w / 2);
  tg.tap('KeyW'); stepN(tg, 1); tg.release('KeyW');
  eq(tg.player().inside, h, '先进屋');

  const z = tg.spawnAt('normal', h.x + h.w / 2 + 30);
  z.atkT = 0;
  z.spd = 0;
  h.hp = 12;                              // 快进到快塌的状态

  let guard = 0;
  while (!h.dead && guard++ < 900) stepN(tg, 1);

  ok(h.dead, '房子最终倒塌了（' + guard + ' 帧）');
  eq(tg.houses().indexOf(h), -1, '倒塌的房子从 houses 列表移除');
  eq(tg.player().inside, null, '玩家被弹到屋外');
  ok(tg.player().hp < tg.player().maxHp, '玩家被弹出时受了伤',
    'HP = ' + Math.round(tg.player().hp) + ' / ' + tg.player().maxHp);
}

// ─────────────────────────────────────────────────────
section('8. 血量低的房子不再提供安全性（倒塌后僵尸能打到你了）');
{
  const { tg } = fresh();
  const h = firstSafe(tg);
  tg.place(h.x + h.w / 2);
  tg.tap('KeyW'); stepN(tg, 1); tg.release('KeyW');

  const z = tg.spawnAt('normal', h.x + h.w / 2 + 30);
  z.spd = 0; z.atkT = 0;
  tg.damageHouse(h, 999);                 // 直接砸塌
  eq(tg.player().inside, null, '砸塌瞬间被弹出来');

  const hpBefore = tg.player().hp;
  stepN(tg, 120);                         // 屋外待 2 秒
  ok(tg.player().hp < hpBefore, '出来后僵尸就能咬到你了',
    hpBefore + ' → ' + Math.round(tg.player().hp));
}

summary();
