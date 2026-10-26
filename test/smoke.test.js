'use strict';
// 冒烟测试：驱动真实帧（update + draw 全跑），确保渲染管线不报错。
// 单元测试只调 update，绘制里的错误只有这里能抓到。
// 跑法：node test/smoke.test.js
const { load, ok, eq, section, summary } = require('./harness');

function run(label, fn) {
  let err = null;
  try { fn(); } catch (e) { err = e; }
  ok(!err, label, err ? (err.message + '  @' + (err.stack.split('\n')[1] || '').trim()) : '');
  return err;
}

// ─────────────────────────────────────────────────────
section('冒烟：菜单场景');
{
  const env = load();
  const { tg } = env;
  const t0 = Date.now() + 1000;
  run('菜单场景连跑 60 帧', () => {
    tg.setState('menu');
    for (let i = 0; i < 60; i++) tg.frame(t0 + i * 16);
  });
}

// ─────────────────────────────────────────────────────
section('冒烟：游戏中跑 30 秒真实帧（含绘制 / 平台 / 安全屋 / 粒子）');
{
  const env = load();
  const { tg } = env;
  const t0 = Date.now() + 2000;
  let f = 0;

  run('开局 + 向右推进 + 持续射击，共 1800 帧（30 秒）', () => {
    tg.start();
    tg.giveWeapons(['pistol']);
    tg.hold('KeyD');
    tg.hold('Space');
    for (let i = 0; i < 1800; i++) {
      if (i === 600) { tg.hold('KeyW'); }          // 中途跳一段，触发平台落地
      if (i === 640) { tg.release('KeyW'); }
      tg.frame(t0 + (f++) * 16);
    }
    tg.release('KeyD');
    tg.release('Space');
  });

  // 跑完确认状态还正常
  ok(tg.player().x > 2000, '玩家确实往前走了', 'x = ' + Math.round(tg.player().x));
  ok(tg.player().hp > 0, '玩家还活着', 'HP = ' + Math.round(tg.player().hp));
  ok(tg.floors().filter(f => !f.base).length > 0, '场景里有高台');
}

// ─────────────────────────────────────────────────────
section('冒烟：进屋 → 被砸塌 → 弹出，全程真实帧');
{
  const env = load();
  const { tg } = env;
  const t0 = Date.now() + 5000;
  let f = 0;

  run('进屋、砸屋、倒塌、弹出，共 900 帧', () => {
    tg.start();
    tg.noWave();
    const h = tg.houses().find(x => x.type === 'safe');
    tg.place(h.x + h.w / 2);
    tg.frame(t0 + (f++) * 16);

    tg.tap('KeyW');
    tg.frame(t0 + (f++) * 16);
    tg.release('KeyW');

    const z = tg.spawnAt('normal', h.x + h.w / 2 + 30);
    z.atkT = 0; z.spd = 0;
    h.hp = 14;

    for (let i = 0; i < 900; i++) tg.frame(t0 + (f++) * 16);
  });

  eq(tg.player().inside, null, '最终不在屋里（房子塌了）');
  ok(tg.player().hp < 100, '被弹出时扣了血', 'HP = ' + Math.round(tg.player().hp));
}

// ─────────────────────────────────────────────────────
section('冒烟：暂停 / 静音 / 切枪 不报错');
{
  const env = load();
  const { tg } = env;
  const t0 = Date.now() + 9000;
  let f = 0;

  run('暂停中继续渲染 120 帧', () => {
    tg.start();
    tg.giveWeapons(['pistol', 'pump', 'uzi']);
    tg.setState('play');
    tg.frame(t0 + (f++) * 16);
    // 直接切几种状态，每种都渲染一遍
    for (const s of ['paused', 'play', 'shelf', 'play', 'result', 'play']) {
      tg.setState(s);
      for (let i = 0; i < 20; i++) tg.frame(t0 + (f++) * 16);
    }
  });
  eq(tg.state(), 'play', '状态机最终停在 playing');
}

summary();
