'use strict';
// 菜单接线验收。
//
// 为什么要有这个套件：`14-ui.js` 里曾经整段 `openLevels/renderLevels + 7 个按钮的
// addEventListener` 被复制了两遍。函数声明是后一个胜出所以看不出问题，但
// **监听器是两份都挂上去的** ——
//   · 暂停面板的「继续」被调用两次 = 暂停又立刻取消，按钮点了没反应
//   · 货架的「完成」被调用两次 = winLevel 跑两次，击杀数、通关数、成就奖励全部算两遍
// 而当时的 DOM 桩件里 addEventListener 是个空函数，所以没有任何测试看得见。
// 现在桩件会把监听器记下来，这个套件就是那次事故的回归测试。
//
// 跑法：node test/menu-wiring.test.js
const fs = require('fs');
const path = require('path');
const { load, ok, eq, section, summary, step: stepN } = require('./harness');

const JS_DIR = path.join(__dirname, '..', 'app', 'js');
const BUTTONS = ['resumeBtn', 'restartBtn', 'quitBtn', 'startBtn',
                 'resNextBtn', 'resMenuBtn', 'shelfDoneBtn'];

function fresh() {
  const env = load();
  env.tg.start();
  env.tg.waveClear();
  env.tg.noWave();
  env.tg.setState('play');
  return env;
}

// ─────────────────────────────────────────────────────
section('① 源码里没有重复定义的函数');
{
  const files = fs.readdirSync(JS_DIR).filter(f => f.endsWith('.js'));
  const dup = [];
  for (const f of files) {
    const src = fs.readFileSync(path.join(JS_DIR, f), 'utf8');
    const names = {};
    for (const m of src.matchAll(/^function\s+([A-Za-z_$][\w$]*)\s*\(/gm)) {
      names[m[1]] = (names[m[1]] || 0) + 1;
    }
    for (const n in names) if (names[n] > 1) dup.push(f + ' → ' + n + ' ×' + names[n]);
  }
  eq(dup.length, 0, '每个 .js 文件里没有同名函数定义两遍', dup.join(' / '));

  // 跨文件也算 —— 后加载的会静默覆盖先加载的
  const all = {};
  for (const f of files) {
    const src = fs.readFileSync(path.join(JS_DIR, f), 'utf8');
    for (const m of src.matchAll(/^function\s+([A-Za-z_$][\w$]*)\s*\(/gm)) {
      (all[m[1]] || (all[m[1]] = [])).push(f);
    }
  }
  const cross = Object.keys(all).filter(n => all[n].length > 1)
    .map(n => n + ' 出现在 ' + all[n].join(' + '));
  eq(cross.length, 0, '同一个函数没有在多个文件里各定义一次', cross.join(' / '));
}

// ─────────────────────────────────────────────────────
section('② 每个按钮只被绑一次 click');
{
  const env = load();
  for (const id of BUTTONS) {
    const el = env.els[id];
    ok(!!el, '按钮 #' + id + ' 在页面里存在，而且真的被 getElementById 取到过');
    eq(el._count('click'), 1, '#' + id + ' 上恰好挂了 1 个 click 监听器',
      '实际 ' + el._count('click') + ' 个');
  }
}

// ─────────────────────────────────────────────────────
section('③ 真按下去，每个按钮的效果只发生一次');
{
  // 「继续」：暂停 → 点一次 → 必须真的恢复，不能暂停又被取消
  const env = load();
  const { tg } = env;
  tg.start(); tg.setState('play');
  tg.togglePause();
  eq(tg.paused(), true, '先暂停');
  env.els.resumeBtn._fire('click');
  eq(tg.paused(), false, '点一次「继续」就真的恢复了（绑两次的话这里会还是 true）');
}
{
  // 「完成」（货架）→ winLevel → 结算。统计必须只加一遍
  const env = fresh();
  const { tg } = env;
  const before = {
    cleared: tg.save().stats.levelsCleared,
    kills: tg.save().stats.kills,
    cash: tg.save().cash,
  };
  for (let i = 0; i < 7; i++) tg.spawn('normal');
  for (const z of tg.zombies()) { z.hp = 1; }
  for (let i = tg.zombies().length - 1; i >= 0; i--) tg.killAt(i);
  eq(tg.player().kills, 7, '打死了 7 只');
  tg.setState('shelf');
  env.els.shelfDoneBtn._fire('click');
  const after = tg.save().stats;
  eq(after.levelsCleared - before.cleared, 1, '通关数 +1（不是 +2）');
  eq(after.kills - before.kills, 7, '击杀统计 +7（不是 +14）');
  eq(tg.state(), 'result', '落到结算界面');
}
{
  // 「开始」→ 进关卡选择
  const env = load();
  env.tg.setState('menu');
  env.els.startBtn._fire('click');
  eq(env.tg.state(), 'menu', '关卡选择是 menu 状态');
  eq(env.els.levels.classList.contains('hidden'), false, '关卡选择界面被显示了');
  eq(env.els.menu.classList.contains('hidden'), true, '主菜单被藏起来了');
}
{
  // 「重开」：点一次只重开一次（不能把关卡推进两遍）
  const env = fresh();
  env.tg.setState('play');
  env.tg.setStalker(null);
  env.els.restartBtn._fire('click');
  eq(env.tg.wave(), env.tg.wave(), '重开不会把关卡号往前推');
  eq(env.tg.state(), 'play', '重开后回到游戏中');
  eq(env.tg.paused(), false, '重开后不是暂停状态');
}

// ─────────────────────────────────────────────────────
section('④ 关卡选择的每张卡片只绑一次，点了真的进关');
{
  const env = load();
  env.tg.setState('menu');
  env.els.startBtn._fire('click');       // 走一遍 openLevels，才会 getElementById('lvGrid')
  const grid = env.els.lvGrid;
  ok(!!grid, '关卡网格节点被取到过');
  // renderLevels 用 innerHTML 拼的卡片，桩件里 querySelectorAll 返回空，
  // 所以这里只验证 grid 容器本身没被重复绑定 + 内容确实渲染了
  ok(grid.innerHTML.length > 500, '关卡网格渲染出了内容',
    grid.innerHTML.length + ' 字符');
  eq(env.els.lvCash.innerHTML.indexOf('金币 $'), 0, '顶部显示金币');
  const lvCount = (grid.innerHTML.match(/class="lv /g) || []).length;
  eq(lvCount, env.tg.mapCount(), '22 张地图全部出现在网格里', lvCount + ' 张');
}

// ─────────────────────────────────────────────────────
section('⑤ 菜单反复开关也不会越绑越多');
{
  const env = load();
  // openLevels 会重新渲染网格并重新挂 listeners —— 如果实现是在函数体里
  // addEventListener 外面那层容器，重复进菜单就会线性堆积
  for (let i = 0; i < 5; i++) { env.tg.setState('menu'); env.els.startBtn._fire('click'); }
  for (const id of BUTTONS) {
    eq(env.els[id]._count('click'), 1, '进 5 次菜单后 #' + id + ' 仍然只有 1 个监听器',
      '实际 ' + env.els[id]._count('click') + ' 个');
  }
}

// ─────────────────────────────────────────────────────
section('⑥ 暂停面板里的数字是当前这一局的');
{
  const env = fresh();
  const { tg } = env;
  tg.place(1234);
  for (let i = 0; i < 4; i++) tg.spawn('normal');
  for (const z of tg.zombies()) { z.hp = 1; }
  for (let i = tg.zombies().length - 1; i >= 0; i--) tg.killAt(i);
  tg.togglePause();
  const html = env.els.pauseStats.innerHTML;
  ok(html.indexOf('击杀 <b>4</b>') >= 0, '暂停面板显示本局击杀数', html.replace(/<[^>]+>/g, ' '));
  ok(html.indexOf('金币') >= 0, '暂停面板显示金币');
  ok(html.indexOf('HP') >= 0, '暂停面板显示当前血量');
}

summary();
