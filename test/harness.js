'use strict';
// 无头运行 zombie-village-2.html 里的 <script> 块。
// 用途：不打开浏览器就能通过 window.__tg 钩子做逐项自检。
// 所有 DOM / Canvas / Audio / rAF 都是最小桩件，只保证脚本能跑起来并能被驱动。
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// 默认测模块化版本；传 { html: '...' } 可以测别的（比如单文件版）
const HTML_PATH = path.join(__dirname, '..', 'app', 'index.html');

// stats 传进来时，每次调用 ctx 的方法都会在 stats 里计数 ——
// 这样测试可以断言"这一帧到底画了什么"。例如 ctx.scale 只在 drawPlayer 和
// drawZombie 里出现，清空僵尸后数 scale 就能判定玩家有没有被绘制。
function makeCtx(stats) {
  const grad = { addColorStop() {} };
  return new Proxy({}, {
    get(t, k) {
      if (k in t) return t[k];
      if (k === 'createRadialGradient' || k === 'createLinearGradient') return () => grad;
      if (k === 'measureText') return () => ({ width: 10 });
      return (...args) => { if (stats) stats[k] = (stats[k] || 0) + 1; };
    },
    set(t, k, v) { t[k] = v; return true; },
  });
}

function makeEl(id, stats) {
  const cls = new Set();
  // 元素上的监听器要真的记下来。
  // 早先这里是个空函数，于是"同一个按钮被 addEventListener 绑了两次"
  // （暂停按钮点了没反应、货架结算把击杀数算两遍）任何测试都看不见。
  const own = Object.create(null);
  return {
    id, style: {}, dataset: {}, textContent: '', innerHTML: '', value: '',
    classList: {
      add: c => cls.add(c), remove: c => cls.delete(c),
      contains: c => cls.has(c),
      toggle: c => (cls.has(c) ? cls.delete(c) : cls.add(c)),
    },
    addEventListener: (t, f) => { (own[t] || (own[t] = [])).push(f); },
    removeEventListener() {},
    // 测试用：数挂了多少个 / 真的派发一次
    _listeners: own,
    _count: t => (own[t] || []).length,
    _fire: (t, ev) => { (own[t] || []).forEach(f => f(ev || {})); },
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 720 }),
    getContext: () => makeCtx(stats),
    appendChild() {}, querySelectorAll: () => [], focus() {}, blur() {},
  };
}
function resetCtxStats(stats) { for (const k in stats) delete stats[k]; }

// opts.store：传上一次 load() 的 store 就能模拟"刷新页面"——localStorage 内容保留。
// opts.html ：要加载的 HTML（默认 app/index.html）
function load(opts = {}) {
  const htmlPath = opts.html || HTML_PATH;
  const html = fs.readFileSync(htmlPath, 'utf8');
  const dir = path.dirname(htmlPath);

  // 支持两种形态：单文件（内嵌 <script>…</script>）和模块化（多个 <script src>）。
  // 模块化时每个文件作为独立的 classic script 在同一上下文里依次执行 —— 和浏览器一模一样，
  // 顶层的 let/const 会进入共享的全局词法作用域，所以跨文件互相可见。
  const scripts = [];
  const re = /<script(?:\s[^>]*?src="([^"]+)")?[^>]*>([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    if (m[1]) scripts.push({ file: m[1], code: fs.readFileSync(path.join(dir, m[1]), 'utf8') });
    else if (m[2] && m[2].trim()) scripts.push({ file: path.basename(htmlPath), code: m[2] });
  }
  if (!scripts.length) throw new Error('在 ' + htmlPath + ' 里找不到任何 <script>');

  const els = Object.create(null);
  const store = opts.store || Object.create(null);
  const listeners = Object.create(null);
  const ctxStats = Object.create(null);
  const win = {};

  const doc = {
    hidden: false,
    getElementById: id => (els[id] || (els[id] = makeEl(id, ctxStats))),
    addEventListener: (t, f) => { (listeners[t] || (listeners[t] = [])).push(f); },
    removeEventListener() {},
    createElement: tag => makeEl(tag, ctxStats),
    body: makeEl('body', ctxStats),
  };

  const sandbox = {
    console, Math, Date, JSON, Object, Array, String, Number, Boolean, Error,
    isNaN, parseInt, parseFloat, Infinity, NaN,
    performance: { now: () => Date.now() },
    setTimeout, clearTimeout, setInterval, clearInterval,
    requestAnimationFrame: () => 0,
    cancelAnimationFrame() {},
    localStorage: {
      getItem: k => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: k => { delete store[k]; },
      clear: () => { for (const k in store) delete store[k]; },
    },
    document: doc,
  };

  // window 是个 Proxy：AudioContext 故意不给，initAudio() 会走 catch 把 AC 置 null，
  // 于是所有音效调用都变成空操作，测试里不会碰真音频。
  const windowProxy = new Proxy(win, {
    get(t, k) {
      if (k === 'addEventListener') return (type, fn) => { (listeners[type] || (listeners[type] = [])).push(fn); };
      if (k === 'removeEventListener') return () => {};
      if (k === 'innerWidth') return 1600;
      if (k === 'innerHeight') return 900;
      if (k === 'document') return doc;
      if (k === 'localStorage') return sandbox.localStorage;
      if (k === 'performance') return sandbox.performance;
      if (k === 'requestAnimationFrame') return sandbox.requestAnimationFrame;
      return t[k];
    },
    set(t, k, v) { t[k] = v; return true; },
    has(t, k) { return k in t; },
  });

  sandbox.window = windowProxy;
  sandbox.globalThis = sandbox;
  sandbox.self = windowProxy;

  vm.createContext(sandbox);
  for (const s of scripts) vm.runInContext(s.code, sandbox, { filename: s.file });

  const tg = win.__tg;
  if (!tg) throw new Error('脚本没有暴露 window.__tg');
  return { tg, win, els, store, listeners, ctxStats };
}

// —— 极简断言 ——
let pass = 0, fail = 0;
const failures = [];
function ok(cond, label, detail) {
  if (cond) { pass++; console.log('  ✓ ' + label); }
  else {
    fail++;
    failures.push(label + (detail ? '  → ' + detail : ''));
    console.log('  ✗ ' + label + (detail ? '  → ' + detail : ''));
  }
}
function eq(actual, expected, label) {
  ok(actual === expected, label, 'expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual));
}
function near(actual, expected, tol, label) {
  ok(Math.abs(actual - expected) <= tol, label,
    'expected ~' + expected + ' (±' + tol + '), got ' + actual);
}
function section(name) { console.log('\n' + name); }
function summary() {
  console.log('\n' + '─'.repeat(52));
  console.log(fail === 0 ? `全部通过：${pass} 项` : `通过 ${pass} 项，失败 ${fail} 项`);
  if (fail) { console.log('\n失败项：'); failures.forEach(f => console.log('  · ' + f)); }
  process.exitCode = fail === 0 ? 0 : 1;
}

// 通过真实的 keydown/keyup 监听器派发事件（X 切枪、1/2/3 直跳这类逻辑挂在监听器上，
// 不是 update() 轮询的，必须走这条路才能测到）
function keyDown(env, code) {
  (env.listeners.keydown || []).forEach(f => f({ code, repeat: false, preventDefault() {} }));
}
function keyUp(env, code) {
  (env.listeners.keyup || []).forEach(f => f({ code, repeat: false, preventDefault() {} }));
}
// 驱动 n 帧，并在每帧后把状态按回 'play'（旧波次逻辑清场后会自动切到 'calm'，测试里不需要那个）
function step(tg, n = 1, dt = 1 / 60) {
  for (let i = 0; i < n; i++) { tg.step(dt); tg.setState('play'); }
}

module.exports = { load, makeCtx, makeEl, ok, eq, near, section, summary, keyDown, keyUp, step, resetCtxStats };
