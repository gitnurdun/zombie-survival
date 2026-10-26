'use strict';
// 本轮反馈的五条验收：
//   ① 房屋间距拉开 ② 高台不压房屋 ③ 进屋后玩家消失
//   ④ 路上有垃圾桶/灌木/小草且能打碎掉补给 ⑤ 上层路段上有僵尸
// 跑法：node test/world.test.js
const { load, ok, eq, section, summary, step: stepN, resetCtxStats } = require('./harness');

function fresh() {
  const env = load();
  env.tg.start();
  env.tg.waveClear();
  env.tg.noWave();
  env.tg.setState('play');
  return env;
}
const platforms = tg => tg.floors().filter(f => !f.base);
// 只挑地面层(z=0)的物件 —— 高台上的东西要站在同一层才捡得到，那是另一条规则
const groundProp = (tg, kind) => tg.props().find(p => p.kind === kind && p.z === 0);

// ─────────────────────────────────────────────────────
section('① 房屋间距拉开（原来 160~320px 太密）');
{
  const { tg } = fresh();
  const hs = tg.houses().slice().sort((a, b) => a.x - b.x);
  // 路段化之后房屋数量随地图性格变化：开阔图可能只有 2 栋，密集图有 8 栋
  ok(hs.length >= 2, '关卡至少有 2 栋房屋（头段保底 1 栋可进的 + 随机段）', hs.length + ' 栋');

  let minGap = Infinity;
  for (let i = 1; i < hs.length; i++) {
    minGap = Math.min(minGap, hs[i].x - (hs[i - 1].x + hs[i - 1].w));
  }
  ok(minGap >= 400, '相邻房屋之间至少留 400px 空档', '最小间隙 ' + minGap + 'px');
}

// ─────────────────────────────────────────────────────
section('② 高台不与房屋重叠');
{
  let worst = null;
  for (let i = 0; i < 12; i++) {          // 多跑几局，因为路段是随机的
    const { tg } = fresh();
    const hs = tg.houses();
    const bad = platforms(tg).find(f => hs.some(h => f.x1 > h.x && f.x0 < h.x + h.w));
    if (bad) { worst = bad; break; }
  }
  ok(!worst, '12 局里没有任何高台压在房屋上',
    worst ? ('平台 ' + worst.x0 + '-' + worst.x1) : '');

  // 多层地形是核心机制，不能看运气 —— 每一局都至少要有高台。
  // 早期用"随机撒点 + 撞到房子就挪"的写法，实测出现过整关 0 块。
  // 现在高台由路段的 floors 字段决定，数量随地图性格变化（开阔图少、垂直图多）。
  let minPlats = Infinity, maxPlats = 0, sum = 0;
  for (let i = 0; i < 20; i++) {
    const n = platforms(fresh().tg).length;
    minPlats = Math.min(minPlats, n); maxPlats = Math.max(maxPlats, n); sum += n;
  }
  ok(minPlats >= 1, '20 局每一局都至少有 1 块高台', '最少 ' + minPlats + ' 块，最多 ' + maxPlats + ' 块');
  ok(sum / 20 >= 3, '平均每局至少 3 块高台', '平均 ' + (sum / 20).toFixed(1) + ' 块');
}

// ─────────────────────────────────────────────────────
section('①b 绝大多数房子进得去（原来 9 栋只有 2 栋能进）');
{
  // 用聚合口径：段路化之后房屋数量随地图变化（开阔图可能只有 2-3 栋），
  // 单局的占比波动大，但有意义的保证是"每局一定有可进的房子"（由 maps.test 覆盖）。
  let safe = 0, tot = 0, anyDeco = false, minSafe = Infinity;
  for (let i = 0; i < 20; i++) {
    const hs = fresh().tg.houses();
    const s = hs.filter(h => h.type === 'safe').length;
    safe += s; tot += hs.length;
    if (hs.some(h => h.type === 'deco')) anyDeco = true;
    minSafe = Math.min(minSafe, s);
  }
  ok(safe / tot >= 0.6, '20 局整体可进入的房子占比 ≥ 60%',
    Math.round(safe / tot * 100) + '%');
  ok(minSafe >= 1, '没有任何一局是可进的房子都没有', '单局最少 ' + minSafe + ' 栋');
  ok(anyDeco, '仍然保留了少数危房做视觉变化');

  const { tg } = fresh();
  const hs = tg.houses();
  ok(hs.every(h => h.type === 'safe' || h.type === 'deco'),
    '房屋类型只有 安全屋 / 危房 两种');
}

// ─────────────────────────────────────────────────────
section('③ 进屋后玩家不再被绘制');
{
  const env = fresh();
  const { tg } = env;
  const h = tg.houses().find(x => x.type === 'safe');
  tg.place(h.x + h.w / 2);

  // ctx.scale 只出现在 drawPlayer 和 drawZombie 里。清空所有会用到它的东西，
  // 剩下的 scale 调用次数就等于"玩家这一帧被画了几次"。
  tg.zombies().length = 0;
  tg.parts().length = 0;
  const t0 = Date.now() + 30000;
  let f = 0;

  resetCtxStats(env.ctxStats);
  tg.frame(t0 + (f++) * 16);
  const outsideScale = env.ctxStats.scale || 0;
  eq(outsideScale, 1, '站在屋外时，这一帧画了 1 次玩家（1 次 ctx.scale）');

  tg.tap('KeyW'); tg.frame(t0 + (f++) * 16); tg.release('KeyW');
  eq(tg.player().inside, h, '已进屋');

  tg.zombies().length = 0;
  tg.parts().length = 0;
  resetCtxStats(env.ctxStats);
  tg.frame(t0 + (f++) * 16);
  eq(env.ctxStats.scale || 0, 0, '进屋后这一帧完全没有 ctx.scale → 玩家消失了');

  // 出来之后又会被画
  tg.tap('KeyW'); tg.frame(t0 + (f++) * 16); tg.release('KeyW');
  eq(tg.player().inside, null, '又出来了');
  tg.zombies().length = 0;
  tg.parts().length = 0;
  resetCtxStats(env.ctxStats);
  tg.frame(t0 + (f++) * 16);
  eq(env.ctxStats.scale || 0, 1, '出来后玩家重新被绘制');
}

// ─────────────────────────────────────────────────────
section('④ 路边场景物件：灌木 / 小草 / 垃圾桶');
{
  const { tg } = fresh();
  const ps = tg.props();
  ok(ps.length > 0, '路上生成了物件', ps.length + ' 个');

  const kinds = new Set(ps.map(p => p.kind));
  ok(kinds.has('grass'), '有杂草');
  ok(kinds.has('bush'), '有灌木');
  ok(kinds.has('trash'), '有垃圾桶');
  ok(ps.filter(p => p.def.solid).length > 0, '有可打碎的物件',
    ps.filter(p => p.def.solid).length + ' 个可打碎');

  // 矮物件必须是纯装饰 —— 水平弹道固定在 y=570，h ≤ 40 的根本打不到
  const short = ps.filter(p => p.h <= 40);
  ok(short.every(p => !p.def.solid),
    '所有 h ≤ 40 的矮物件都是装饰性的（打不到它们）',
    short.map(p => p.kind + ':' + p.h).join(','));
}

// ─────────────────────────────────────────────────────
section('④b 打碎垃圾桶 → 掉弹药箱 → 走过去补弹');
{
  const { tg } = fresh();
  tg.giveWeapons(['pistol']);
  const p = groundProp(tg, 'trash');
  ok(!!p, '找到了一个地面上的垃圾桶');
  eq(p.def.solid, true, '垃圾桶可打碎');
  eq(p.z, 0, '它在地面层');

  // 只留这一个物件，否则中间隔着别的箱子会先把子弹吃掉
  tg.props().length = 0;
  tg.props().push(p);
  tg.bullets().length = 0;
  tg.items().length = 0;
  tg.player().weapons[0].ammo = 5;
  tg.place(p.x - 260);

  tg.hold('Space');
  for (let i = 0; i < 30; i++) { tg.step(1 / 60); tg.setState('play'); }
  tg.release('Space');

  ok(!tg.props().includes(p), '垃圾桶被打碎了');
  const ammoBox = tg.items().find(i => i.type === 'ammo');
  ok(!!ammoBox, '掉出了弹药箱', ammoBox ? (ammoBox.cat + ' ×' + ammoBox.amt) : '没掉');
  if (!ammoBox) { summary(); process.exit(1); }
  // 掉落类型是随机的（62% 实弹 / 38% 能量）。这里专门验证"类型匹配才补得进去"，
  // 所以把它改成实弹 —— 不匹配的情况由 ④c 覆盖。
  ammoBox.cat = 'bullet';

  // 走过去捡
  const before = tg.player().weapons[0].ammo;
  tg.place(ammoBox.x);
  for (let i = 0; i < 5; i++) { tg.step(1 / 60); tg.setState('play'); }
  ok(tg.player().weapons[0].ammo > before, '走过去自动补了实弹',
    before + ' → ' + tg.player().weapons[0].ammo);
}

// ─────────────────────────────────────────────────────
section('④c 弹药分两类：实弹箱补不到能量武器');
{
  const { tg } = fresh();
  tg.giveWeapons(['tesla']);              // 能量武器
  const before = tg.player().weapons[0].ammo;
  const box = { type: 'ammo', x: tg.player().x, y: 0, z: 0, t: 0, life: 5, cat: 'bullet', amt: 20 };
  tg.items().push(box);
  for (let i = 0; i < 3; i++) { tg.step(1 / 60); tg.setState('play'); }
  eq(tg.player().weapons[0].ammo, before, '扛着实弹箱走过 → 能量弹药一点没涨（反而换了 $10）');
}

// ─────────────────────────────────────────────────────
section('⑤ 上层路段上有僵尸');
{
  const { tg } = fresh();
  // 让玩家站在一块高台正中间，僵尸就在附近刷。高度可能是 88（一层）或 176（两层）
  const f = platforms(tg)[0];
  ok(!!f, '找到一块高台', f ? ('z=' + f.z) : '一块都没有');
  if (!f) { summary(); process.exit(1); }
  const cx = (f.x0 + f.x1) / 2;
  // 僵尸在玩家两侧 700~840px 处刷新，随机生成的高台没这么宽，所以临时铺一块宽的
  tg.addFloor(cx - 950, cx + 950, f.z);
  tg.place(cx, f.z);

  for (let i = 0; i < 80; i++) tg.spawn('normal');
  const onPlatform = tg.zombies().filter(z => z.z > 0);
  ok(onPlatform.length > 0, '刷出了站在高台上的僵尸', onPlatform.length + ' / 80');
  ok(onPlatform.every(z => z.z === f.z), '它们的高度就是该平台的高度',
    [...new Set(onPlatform.map(z => z.z))].join(','));
}

// ─────────────────────────────────────────────────────
section('⑤b 高台挡住地面僵尸：同层才打得到');
{
  const { tg } = fresh();
  const f = platforms(tg)[0];
  if (!f) { ok(false, '需要一块高台'); summary(); process.exit(1); }
  tg.place((f.x0 + f.x1) / 2, f.z);          // 玩家站在高台上

  const z = tg.spawnAt('normal', (f.x0 + f.x1) / 2 + 20);
  z.z = 0; z.spd = 0; z.atkT = 0;            // 钉在地面、贴着玩家
  const hp0 = tg.player().hp;

  stepN(tg, 180);                            // 3 秒
  eq(tg.player().hp, hp0, '地面僵尸咬不到高台上的玩家（高度差 > 30）');

  // 把僵尸搬到同一层，应该马上咬得到
  z.z = f.z; z.floor = f; z.spd = 0;
  stepN(tg, 180);
  ok(tg.player().hp < hp0, '同层之后就咬得到了', 'HP ' + Math.round(tg.player().hp));
}

// ─────────────────────────────────────────────────────
section('⑤c 高台上的僵尸会走到边缘掉下来');
{
  const { tg } = fresh();
  const f = platforms(tg)[0];
  if (!f) { ok(false, '需要一块高台'); summary(); process.exit(1); }
  tg.place(f.x0 - 300, 0);                   // 玩家在高台左边的地面

  const z = tg.spawnAt('normal', f.x1 - 30);
  z.z = f.z; z.onGround = true; z.floor = f;
  z.spd = 60;                                // 给个速度，别太慢
  eq(z.z, f.z, '先站在高台上');

  let guard = 0;
  while (z.z > 0 && guard++ < 900) stepN(tg, 1);
  eq(z.z, 0, '走到边缘后掉到了地面（' + guard + ' 帧）');
  eq(z.onGround, true, '落地后恢复 onGround');
}

// ─────────────────────────────────────────────────────
section('⑥ 僵尸砸几下房子就失去兴趣去游走（不会一直砸到塌）');
{
  const { tg } = fresh();
  const h = tg.houses().find(x => x.type === 'safe');
  tg.place(h.x + h.w / 2);
  tg.tap('KeyW'); stepN(tg, 1); tg.release('KeyW');
  eq(tg.player().inside, h, '玩家已在屋里');

  const doorX = h.x + h.w / 2;
  const z = tg.spawnAt('normal', doorX + 60);   // 给正常速度，让它能走开
  z.atkT = 0;

  let maxDist = 0, hits = 0, lastHp = h.hp;
  for (let i = 0; i < 60 * 30; i++) {            // 观察 30 秒
    stepN(tg, 1);
    const zz = tg.zombies()[0];
    if (zz) maxDist = Math.max(maxDist, Math.abs(zz.x - doorX));
    if (h.hp < lastHp) { hits++; lastHp = h.hp; }
  }

  ok(maxDist > 90, '僵尸确实离开门口去游走了', '最远走到 ' + Math.round(maxDist) + 'px 外');
  // 一直砸的话 30 秒能砸 30 / 0.9 ≈ 33 下；砸几下就游走的话会明显更少
  ok(hits < 22, '30 秒内砸墙次数明显少于「一直砸」', hits + ' 下（一直砸会是 ~33 下）');
  ok(hits > 0, '但它确实砸过', hits + ' 下');
  ok(h.hp > 0, '房子没被砸塌（玩家可以安心喘口气）', 'HP ' + Math.round(h.hp));
}

// ─────────────────────────────────────────────────────
section('⑥b 游走一阵之后还会回来砸');
{
  const { tg } = fresh();
  const h = tg.houses().find(x => x.type === 'safe');
  tg.place(h.x + h.w / 2);
  tg.tap('KeyW'); stepN(tg, 1); tg.release('KeyW');

  const z = tg.spawnAt('normal', h.x + h.w / 2 + 60);
  z.atkT = 0;
  let guard = 0;
  while ((z.boredT || 0) <= 0 && guard++ < 60 * 60) stepN(tg, 1);
  ok((z.boredT || 0) > 0, '僵尸进入了游走状态', 'boredT = ' + (z.boredT || 0).toFixed(1) + 's');

  guard = 0;
  while ((z.boredT || 0) > 0 && guard++ < 60 * 60) stepN(tg, 1);
  ok((z.boredT || 0) <= 0, '游走结束');

  const hp0 = h.hp;
  guard = 0;
  while (h.hp >= hp0 && guard++ < 60 * 20) stepN(tg, 1);
  ok(h.hp < hp0, '回到门口后继续砸墙', hp0 + ' → ' + Math.round(h.hp));
}

summary();
