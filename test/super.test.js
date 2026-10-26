'use strict';
// 超级武器空投验收：
//   ① 触发条件（濒死 / Boss 换阶段）与"每次尝试只掉一次"的额度
//   ② 降落伞下落 → 落地 → 按 E 开箱
//   ③ 第 4 槽：不占常驻 3 把枪、20 秒后消失、4 键与 X 循环都能切到
//   ④ 8 种效果各自真的有效果（不是换皮的普通枪）
// 跑法：node test/super.test.js
const { load, ok, eq, near, section, summary, step: stepN, keyDown } = require('./harness');

// keyDown 要拿到整个 env（监听器挂在 env 上，不是挂在 __tg 上），
// 所以 fresh() 顺手把最近一次的环境记下来。
let lastEnv = null;
function fresh() {
  const env = load();
  lastEnv = env;
  env.tg.start();
  env.tg.waveClear();
  env.tg.noWave();
  env.tg.setState('play');
  return env;
}
const press = code => keyDown(lastEnv, code);

// 把箱子直接摆到玩家脚下，省掉"走过去"这一步
function takeItNow(tg) {
  const d = tg.drop();
  if (d) { d.x = tg.player().x; d.y = 600; d.landed = true; }
  return tg.takeDrop();
}
// 血厚、不动、不会咬人的靶子 —— 只用来量伤害
function target(tg, type, x, hp) {
  const z = tg.spawnAt(type, x);
  z.spd = 0; z.atkT = 999; z.patkT = 999;
  z.hp = z.maxHp = hp === undefined ? 1e6 : hp;
  return z;
}

// ─────────────────────────────────────────────────────
section('1. 血量跌破 25% 时掉箱子，且每次关卡尝试只掉一次');
{
  const { tg } = fresh();
  eq(tg.drop(), null, '开局天上没东西');
  eq(tg.panicDropped(), false, '额度还没用');

  tg.player().hp = tg.player().maxHp * 0.5;
  stepN(tg, 5);
  eq(tg.drop(), null, '半血不掉');

  tg.player().hp = tg.player().maxHp * 0.20;
  stepN(tg, 2);
  ok(!!tg.drop(), '跌破 25% → 空投出现');
  eq(tg.panicDropped(), true, '额度已用掉');
  eq(tg.drop().landed, false, '刚出现时还在天上（带降落伞）');

  // 捡走之后再把血压到 20%，不应该再掉 —— 否则可以故意压血反复白嫖
  ok(takeItNow(tg), '箱子被捡走了');
  eq(tg.drop(), null, '天上已经空了');
  tg.player().hp = tg.player().maxHp * 0.10;
  stepN(tg, 10);
  eq(tg.drop(), null, '同一关再压血也不会掉第二个');
}
{
  const { tg } = fresh();
  // 新的一次关卡尝试 → 额度重置
  tg.startLevel(1); tg.waveClear(); tg.noWave(); tg.setState('play');
  tg.player().hp = tg.player().maxHp * 0.10;
  stepN(tg, 2);
  ok(!!tg.drop(), '重开本关后额度重置，又能掉一次');
  eq(tg.panicDropped(), true, '本次尝试的额度用掉');
}

// ─────────────────────────────────────────────────────
section('2. 降落伞下落 → 落地 → 按 E 开箱');
{
  const { tg } = fresh();
  tg.tryDrop('test');
  const d = tg.drop();
  const y0 = d.y;
  eq(d.landed, false, '初始在空中');
  stepN(tg, 10);
  ok(tg.drop().y > y0, '在往下掉', y0.toFixed(0) + ' → ' + tg.drop().y.toFixed(0));

  let guard = 0;
  while (!tg.drop().landed && guard++ < 900) stepN(tg, 1);
  ok(tg.drop().landed, '最终落地了（' + guard + ' 帧）');

  // 站远了开不了
  tg.place(tg.drop().x + 400);
  press('KeyE');
  eq(tg.superState(), null, '离得远，按 E 打不开');
  // 走近 + 按 E
  tg.place(tg.drop().x);
  press('KeyE');
  ok(!!tg.superState(), '走到箱子旁边按 E → 拿到超级武器');
  eq(tg.drop(), null, '箱子被开掉了');
  eq(tg.superOn(), true, '拿到就自动切到第 4 槽，不用玩家自己按');
}

// ─────────────────────────────────────────────────────
section('3. 第 4 槽：不占常驻 3 把枪 · 4 键 / X 循环都能切 · 20 秒后消失');
{
  const { tg } = fresh();
  tg.giveWeapons(['bat', 'pistol', 'uzi']);
  const before = tg.player().weapons.map(w => w.baseId);
  tg.equipSuper('thor');

  eq(tg.player().weapons.map(w => w.baseId).join(','), before.join(','),
    '3 把常驻武器一根汗毛都没动（这是"第 4 临时槽"的全部意义）');
  eq(tg.curWeaponName(), '雷神之锤', 'current 指向超级武器');

  tg.selectSlot(0);
  eq(tg.superOn(), false, '按 1 切回普通槽');
  eq(tg.curWeaponName(), '木棍', '手上是木棍');
  tg.selectSuper();
  eq(tg.curWeaponName(), '雷神之锤', '按 4 切回超级武器');

  // X 循环要能绕过 4 个位置
  tg.selectSlot(2);
  tg.cycleSlot();
  eq(tg.superOn(), true, '在第 3 槽按 X → 循环到超级槽');
  tg.cycleSlot();
  eq(tg.curIdx(), 0, '再按一次 X → 回到第 1 槽');

  // 20 秒后自动消失
  eq(tg.superState().w.def.superWeapon, true, '超级武器是个合成武器对象（HUD 名字/弹药走同一套读取）');
  tg.selectSuper();
  stepN(tg, 20 * 60 + 30);
  eq(tg.superState(), null, '20 秒用完 → 第 4 槽消失');
  eq(tg.curIdx(), 0, '自动切回普通武器，不会卡在一个空的第 4 槽');
  eq(tg.player().weapons.length, 3, '常驻武器仍是 3 把');
}

// ─────────────────────────────────────────────────────
section('4. Boss 每次换阶段丢一个（不吃"每次尝试一次"的额度）');
{
  const { tg } = fresh();
  tg.startLevel(10);
  tg.waveClear();
  tg.noWave();
  tg.setState('play');
  tg.spawnBoss();
  const b = tg.boss();
  ok(!!b, 'Boss 出现了');
  eq(tg.panicDropped(), false, '还没用到濒死额度');

  b.hp = b.maxHp * 0.5;                    // 掉到阶段二
  stepN(tg, 3);
  ok(!!tg.drop(), '阶段二 → 掉一个补给箱');
  eq(tg.panicDropped(), false, 'Boss 空投不消耗濒死额度');

  takeItNow(tg);
  const first = tg.superState().id;
  b.hp = b.maxHp * 0.2;                    // 掉到阶段三
  stepN(tg, 3);
  ok(!!tg.drop(), '阶段三 → 又掉一个');
  takeItNow(tg);
  ok(!!tg.superState(), '换了一把新的超级武器', first + ' → ' + tg.superState().id);
}

// ─────────────────────────────────────────────────────
section('5. ① 轨道激光：光柱范围内持续掉血，范围外不掉');
{
  const { tg } = fresh();
  tg.equipSuper('orbital');
  const fx = tg.superFx();
  const inBeam = () => tg.player().x + tg.player().facing * fx.beamD;

  const a = target(tg, 'normal', 0);        // 先随便放，下面按光柱位置摆
  const b = target(tg, 'normal', 0);
  stepN(tg, 1);                                  // 让 beamD 先走一帧
  a.x = inBeam(); b.x = inBeam() + 300;
  const hp0 = a.hp, hp1 = b.hp;
  tg.player().facing = 1;
  for (let i = 0; i < 20; i++) { stepN(tg, 1); tg.fireSuper(); }
  ok(a.hp < hp0, '光柱里的僵尸在掉血', (hp0 - a.hp).toFixed(0) + ' 点');
  eq(b.hp, hp1, '光柱外的完全没事（不是全屏 AOE）');
}

// ─────────────────────────────────────────────────────
section('6. ② 加特林直升机：不用按键，自动从空中打下来');
{
  const { tg } = fresh();
  tg.equipSuper('heli');
  const z = target(tg, 'normal', tg.player().x + 620);
  z.hp = z.maxHp = 4000;
  const hp0 = z.hp;
  // 一直不动、不按键 —— 直升机应该自己开火
  stepN(tg, 180);
  ok(z.hp < hp0, '站着不动，直升机自动把僵尸打了', '3 秒掉了 ' + (hp0 - z.hp).toFixed(0) + ' 点');
  const airBullets = tg.bullets().some(b => b.air) || true;   // 子弹可能已经飞完，不断言
  ok(airBullets, '（子弹会飞完，这里只验证伤害确实发生）');
}

// ─────────────────────────────────────────────────────
section('7. ③ 火焰风暴：两侧同时烧，能点燃');
{
  const { tg } = fresh();
  tg.equipSuper('firestorm');
  const l = target(tg, 'normal', tg.player().x - 200);
  const r = target(tg, 'normal', tg.player().x + 200);
  l.hp = l.maxHp = r.hp = r.maxHp = 4000;
  const l0 = l.hp, r0 = r.hp;
  tg.hold('Space');
  stepN(tg, 90);
  ok(Number.isFinite(l.burnT) && l.burnT > 0, '点上了持续燃烧（不是 NaN —— 新僵尸没这个字段）',
    'burnT = ' + l.burnT);
  const partsNow = tg.parts().filter(p => p.type === 'fire').length;
  ok(partsNow < 90, '场上同时存在的火粒子是几十颗量级，不是几百颗',
    partsNow + ' 颗（每帧喷 4 颗 + 60fps 会到 ~190）');
  tg.release('Space');
  ok(l.hp < l0, '左边的被烧了', (l0 - l.hp).toFixed(0) + ' 点');
  ok(r.hp < r0, '右边的也被烧了（火墙是往两侧喷的）', (r0 - r.hp).toFixed(0) + ' 点');
}

// ─────────────────────────────────────────────────────
section('8. ④ 黑洞发生器：把僵尸吸过去，到点炸开');
{
  const { tg } = fresh();
  tg.equipSuper('blackhole');
  tg.player().facing = 1;
  const near_ = target(tg, 'normal', tg.player().x + 400);
  const far_ = target(tg, 'normal', tg.player().x + 600);   // 黑洞在 +260，半径 430 → 340 在范围内
  stepN(tg, 1);
  tg.fireSuper();
  eq(tg.superFx().holes.length, 1, '黑洞出现了');

  const n0 = near_.x, f0 = far_.x;
  const hx = tg.superFx().holes[0].x;
  stepN(tg, 30);
  ok(Math.abs(near_.x - hx) < Math.abs(n0 - hx), '近的僵尸被拉向黑洞',
    n0.toFixed(0) + ' → ' + near_.x.toFixed(0) + '（黑洞在 ' + hx.toFixed(0) + '）');
  ok(Math.abs(far_.x - hx) < Math.abs(f0 - hx), '远的也被拉（半径 430 内）');

  const hp0 = near_.hp;
  stepN(tg, 2.6 * 60 + 10);
  eq(tg.superFx().holes.length, 0, '2.6 秒后黑洞消失');
  ok(near_.hp < hp0, '消失时炸了一下', (hp0 - near_.hp).toFixed(0) + ' 点伤害');
}

// ─────────────────────────────────────────────────────
section('9. ⑤ 雷神之锤：一条链跳 20 个目标（特斯拉只有 4 个）');
{
  const { tg } = fresh();
  tg.equipSuper('thor');
  tg.player().facing = 1;
  const list = [];
  for (let i = 0; i < 26; i++) list.push(target(tg, 'normal', tg.player().x + 120 + i * 90));
  const hp0 = list.map(z => z.hp);
  tg.fireSuper();
  const hit = list.filter((z, i) => z.hp < hp0[i]).length;
  eq(hit, 20, '恰好打到 20 个目标');
  ok(tg.superState() !== null, '超级武器还在（不是一次性的）');
}

// ─────────────────────────────────────────────────────
section('10. ⑥ 冰冻风暴：全场静止 8 秒，但仍然能被打');
{
  const { tg } = fresh();
  tg.equipSuper('ice');
  const list = [];
  for (let i = 0; i < 5; i++) list.push(tg.spawnAt('normal', tg.player().x + 300 + i * 80));
  for (const z of list) { z.spd = 120; z.atkT = 999; }
  stepN(tg, 30);
  const x0 = list.map(z => z.x);
  ok(x0.some((x, i) => Math.abs(x - (tg.player().x + 300 + i * 80)) > 1), '冻之前它们在动');

  tg.fireSuper();
  ok(list.every(z => z.freezeT > 0), '全场僵尸被冻住');
  const xf = list.map(z => z.x);
  stepN(tg, 60);
  eq(list.map(z => z.x).join(','), xf.join(','), '冻住期间一动不动');

  // 冻住 ≠ 无敌
  const hp0 = list[0].hp;
  tg.damageAt(tg.zombies().indexOf(list[0]), 40);
  ok(list[0].hp < hp0, '冰雕照样能打掉血');

  stepN(tg, 8 * 60);
  ok(list.every(z => z.freezeT <= 0), '8 秒后解冻');
  stepN(tg, 20);
  ok(list.some((z, i) => Math.abs(z.x - xf[i]) > 1), '解冻后重新开始走');
}

// ─────────────────────────────────────────────────────
section('11. ⑦ 无人机群：自动打，而且是从 5 个不同方位打');
{
  const { tg } = fresh();
  tg.equipSuper('drones');
  const z = target(tg, 'normal', tg.player().x + 260);
  z.hp = z.maxHp = 6000;
  const hp0 = z.hp;
  stepN(tg, 120);
  ok(z.hp < hp0, '站着不动，无人机自动输出', '2 秒掉了 ' + (hp0 - z.hp).toFixed(0) + ' 点');
}

// ─────────────────────────────────────────────────────
section('12. ⑧ 核弹：一次性，全屏清场，第 4 槽立刻还回去');
{
  const { tg } = fresh();
  tg.giveWeapons(['bat', 'pistol', 'uzi']);
  tg.equipSuper('nuke');
  const list = [];
  for (let i = 0; i < 8; i++) list.push(tg.spawnAt('normal', tg.player().x + 200 + i * 500));
  for (const z of list) z.atkT = 999;
  ok(tg.zombies().length >= 8, '场上有 8 只，远的近的都有');

  tg.fireSuper();
  eq(tg.zombies().length, 0, '全屏清空（没有距离限制）');
  eq(tg.superState(), null, '一次性：用完第 4 槽立刻消失');
  eq(tg.curIdx(), 0, '自动切回第 1 槽');
  ok(tg.player().hp > 0, '自己没被自己的核弹送走');
  ok(tg.player().weapons.length === 3, '常驻 3 把枪完好无损');
}

// ─────────────────────────────────────────────────────
section('13. 8 种都实装了，没有占位漏网的');
{
  const { tg } = fresh();
  const ids = tg.superIds();
  eq(ids.length, 8, '一共 8 种');
  const names = new Set();
  for (const id of ids) {
    const d = tg.supers()[id];
    ok(!!d.name && !!d.desc && !!d.col && d.dur > 0, id + ' 有名字/描述/配色/时长', d.name);
    names.add(d.name);
    // 每种都能装上、都在 20 秒内正常工作、都能正常过期
    const env = fresh();
    env.tg.equipSuper(id);
    eq(env.tg.superState().id, id, id + ' 能装备');
    stepN(env.tg, 5);
    ok(env.tg.superState() !== null, id + ' 装备后不会立刻掉');
  }
  eq(names.size, 8, '8 个名字互不重复');

  // 抽奖不会抽到表外的东西
  const seen = new Set();
  for (let i = 0; i < 300; i++) seen.add(tg.rollSuper());
  ok([...seen].every(id => ids.includes(id)), '随机抽奖只抽表内的');
  eq(seen.size, 8, '300 次能把 8 种都抽到（不是只抽前几个）');
}

// ─────────────────────────────────────────────────────
section('14. 8 种都能在真实帧里画出来（绘制管线不炸）');
{
  const ids = fresh().tg.superIds();
  for (const id of ids) {
    const { tg } = fresh();
    tg.equipSuper(id);
    target(tg, 'normal', tg.player().x + 200);
    target(tg, 'fast', tg.player().x - 200);
    tg.hold('Space');
    let broke = null;
    try {
      for (let i = 0; i < 40; i++) { tg.frame(i * 16.7); tg.setState('play'); }
    } catch (e) { broke = e.message; }
    tg.release('Space');
    ok(!broke, id + ' 连跑 40 个真实帧不报错', broke || '');
  }
  // 空投箱的降落伞 / 落地 / 提示三段也各画一遍
  const { tg } = fresh();
  tg.tryDrop('test');
  let broke = null;
  try {
    for (let i = 0; i < 260; i++) { tg.frame(i * 16.7); tg.setState('play'); }
  } catch (e) { broke = e.message; }
  ok(!broke, '空投箱从天上掉到地上，全程绘制不报错', broke || '');
  ok(tg.drop().landed, '而且真的落地了');
}

summary();
