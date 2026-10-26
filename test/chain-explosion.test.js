'use strict';
// 连锁爆炸把 zombies 数组从循环底下抽走 —— 回归测试。
//
// 事故经过：火焰粒子每帧要遍历僵尸做碰撞，写法是
//     for (let j = zombies.length - 1; j >= 0; j--) { const z = zombies[j]; ... }
// 单看没问题。但 damageZombieFire → killZombie → 「爆裂的」词缀 → explodeAt
// 会在更深的调用栈里**再 splice 好几次**，其中一些下标比外层循环手里的 j 还小。
// 数组瞬间缩到比 j 还短，下一次 zombies[j] 就是 undefined：
//     TypeError: Cannot read properties of undefined (reading 'y')
// 整个游戏卡死。
//
// 触发条件很具体：**被烧死的那只挂在数组高位、而且它是「爆裂的」**，
// 并且爆炸半径里还躺着一片残血的僵尸。所以正常玩几百局也未必撞上，
// 但它是真崩，不是掉帧。
//
// 修法：所有"遍历僵尸并可能打死它"的循环走 eachZombieRev（或就地补 !z 守卫）。
// 这个套件把每一条伤害路径都用同一套"高位爆裂 + 一片残血"的场景过一遍。
//
// 跑法：node test/chain-explosion.test.js
const { load, ok, eq, near, section, summary, step: stepN } = require('./harness');

// 造一排在 x 轴上紧挨着的残血僵尸，把「爆裂的」放在**最高位**（数组末尾）。
// 高位是关键：外层循环从后往前走到它的时候，爆炸会把它下面的一整片一起带走。
function setup(n = 12, volatileAt = 'last') {
  const env = load();
  const tg = env.tg;
  tg.start();
  tg.waveClear();
  tg.noWave();
  tg.setState('play');
  tg.clearFloors();
  tg.place(2000);
  const list = [];
  for (let i = 0; i < n; i++) {
    const z = tg.spawnAt('normal', 2000 + i * 6);
    z.spd = 0; z.atkT = 9999; z.pounceT = 9999;
    z.hp = 1;                       // 残血：爆炸能一路带走
    list.push(z);
  }
  const vi = volatileAt === 'last' ? n - 1 : 0;
  list[vi].affix = 'volatile';
  list[vi].hp = 1;
  return { env, tg, list, vol: list[vi] };
}
// 跑若干帧，返回错误信息或 null
function drive(tg, frames, before) {
  try {
    if (before) before();
    for (let i = 0; i < frames; i++) { tg.step(1 / 60); tg.setState('play'); }
    return null;
  } catch (e) { return e.message; }
}
const boom = tg => {
  // 先确认这一炸真的把一大片带走了，否则这个测试是空跑
  const before = tg.zombies().length;
  tg.damageAt(tg.zombies().indexOf(tg.zombies().find(z => z.affix === 'volatile')), 99999);
  return before;
};

// ─────────────────────────────────────────────────────
section('① 先确认这套场景真的会触发连锁（不是空跑）');
{
  const { tg, list } = setup();
  const n0 = tg.zombies().length;
  const idx = tg.zombies().indexOf(list[list.length - 1]);
  tg.damageAt(idx, 99999);            // 打死最高位那只「爆裂的」
  const n1 = tg.zombies().length;
  eq(n1, 0, '高位爆裂把整排一起带走了（' + n0 + ' → ' + n1 + '）—— 场景有效');
}

// ─────────────────────────────────────────────────────
section('② 火焰粒子烧死高位「爆裂的」→ 不崩');
{
  const { tg } = setup();
  // 火焰粒子盖住最高位那一只
  tg.parts().push({ type: 'fire', x: 2000 + 11 * 6, y: 610 - 20, vx: 0, vy: 0, life: 3, max: 3, size: 40, t: 0 });
  const err = drive(tg, 20);
  ok(!err, '火焰伤害路径不崩', err || '（修之前这里报 Cannot read properties of undefined）');
  eq(tg.zombies().length, 0, '而且确实炸干净了');
}

// ─────────────────────────────────────────────────────
section('③ 其它每一条会打死僵尸的路径都过一遍同样的场景');
{
  const paths = [
    ['子弹',   tg => { tg.giveWeapons(['pistol']); tg.player().weapons[0].def.crit = 0;
                       tg.hold('Space'); tg.step(1 / 60); tg.release('Space'); }],
    ['近战',   tg => { tg.giveWeapons(['bat']); tg.hold('Space'); tg.step(1 / 60); tg.release('Space'); }],
    ['特斯拉电弧枪', tg => { tg.giveWeapons(['tesla']); tg.hold('Space'); tg.step(1 / 60); tg.release('Space'); }],
    ['油桶爆炸', tg => {
        // 在僵尸堆中间摆一个会爆的物件，打碎它
        const props = tg.props();
        if (props.length) { tg.damagePropAt(0, 99999); }
      }],
    ['超级武器 · 轨道激光', tg => { tg.equipSuper('orbital'); tg.fireSuper(); }],
    ['超级武器 · 雷神之锤', tg => { tg.equipSuper('thor'); tg.fireSuper(); }],
    ['超级武器 · 核弹',     tg => { tg.equipSuper('nuke'); tg.fireSuper(); }],
  ];
  for (const [name, fire] of paths) {
    // 每条路径单独造场景：先把玩家挪到僵尸堆里，保证够得着
    const { tg } = setup();
    tg.place(2000 + 11 * 6 - 30);
    tg.player().facing = 1;
    tg.zombies().forEach(z => { z.hp = 1; });
    const err = drive(tg, 12, () => fire(tg));
    ok(!err, name + ' 路径不崩', err || '');
  }
}

// ─────────────────────────────────────────────────────
section('④ 场景反过来：低位爆裂 / 多只爆裂 / 自爆尸混在里面');
{
  {
    const { tg } = setup(12, 'first');
    tg.parts().push({ type: 'fire', x: 2000, y: 610 - 20, vx: 0, vy: 0, life: 3, max: 3, size: 40, t: 0 });
    ok(!drive(tg, 20), '「爆裂的」在最低位时也不崩');
  }
  {
    const { tg, list } = setup(16);
    for (let i = 0; i < list.length; i += 3) { list[i].affix = 'volatile'; list[i].hp = 1; }
    tg.parts().push({ type: 'fire', x: 2000 + 15 * 6, y: 610 - 20, vx: 0, vy: 0, life: 3, max: 3, size: 400, t: 0 });
    ok(!drive(tg, 30), '一堆「爆裂的」互相引爆也不崩');
  }
  {
    const { tg } = setup(10);
    for (let i = 0; i < 4; i++) {
      const b = tg.spawnAt('bomber', 2000 + i * 8);
      b.spd = 0; b.hp = 1; b.fuse = 0.01;      // 引信快到头
    }
    tg.parts().push({ type: 'fire', x: 2000, y: 610 - 20, vx: 0, vy: 0, life: 3, max: 3, size: 400, t: 0 });
    ok(!drive(tg, 40), '自爆尸连环炸也不崩');
  }
}

// ─────────────────────────────────────────────────────
section('⑤ 结构性检查：所有遍历僵尸的倒序循环都加了守卫');
{
  const fs = require('fs');
  const path = require('path');
  const dir = path.join(__dirname, '..', 'app', 'js');
  const bad = [];
  for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.js'))) {
    const lines = fs.readFileSync(path.join(dir, f), 'utf8').split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/^\s*\/\//.test(line)) continue;                 // 注释里提到的那种写法不算
      if (!/^\s*for \(let \w+ = zombies\.length - 1; /.test(line)) continue;
      const win = lines.slice(i, i + 7).join('\n');
      if (/if \(!\w+\) (continue|return)/.test(win)) continue;      // 就地守卫
      if (/eachZombieRev/.test(win)) continue;                       // 走了公共函数
      // 显式声明豁免：在上面三行内写「不 splice」（这个循环不删元素）
      // 或「安全遍历」（每轮重读下标，允许删）
      const above = lines.slice(Math.max(0, i - 3), i).join('\n');
      if (/不 splice|安全遍历/.test(above)) continue;
      bad.push(f + ':' + (i + 1) + '  ' + line.trim());
    }
  }
  ok(bad.length === 0,
    '每个倒序遍历僵尸的循环都有守卫（eachZombieRev / !z / 标注「不 splice」）',
    bad.join(' | '));

  // 反向：确认这个检查真的在扫东西（免得正则写错导致永远绿）
  const seen = [];
  for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.js'))) {
    const src = fs.readFileSync(path.join(dir, f), 'utf8');
    for (const m of src.matchAll(/^\s*for \(let \w+ = zombies\.length - 1; /gm)) seen.push(f);
  }
  ok(seen.length >= 4, '确实扫到了若干处倒序遍历（检查本身有效）', seen.length + ' 处');
  ok(seen.includes('08-zombies.js'), '其中包含 eachZombieRev 所在的那个文件');
}

summary();
