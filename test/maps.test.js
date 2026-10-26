'use strict';
// 10 张地图的验收：视觉参数互不相同、每局都有可进房子和高台、全部跑通不报错。
// 跑法：node test/maps.test.js
const { load, ok, eq, section, summary } = require('./harness');

const env0 = load();
const tg0 = env0.tg;
const N = 22;                       // 第一幕 10 张（地球）+ 第二幕 12 张（雪原/山林/沙漠/洞穴 + 8 个星球）
function mapNames() { return Array.from({ length: N }, (_, i) => tg0.mapAt(i + 1)); }

// 反复开局，统计每张地图的生成结果
function roll(n, times = 12) {
  const out = [];
  for (let k = 0; k < times; k++) {
    tg0.startLevel(n);
    const fs = tg0.floors().filter(f => !f.base);
    out.push({
      floors: fs.length,
      layers: [...new Set(fs.map(f => f.z))].sort((a, b) => a - b),
      houses: tg0.houses().length,
      safe: tg0.houses().filter(h => h.type === 'safe').length,
      props: tg0.props().length,
      kinds: [...new Set(tg0.props().map(p => p.kind))].sort().join(','),
      hazards: tg0.hazards().length,
      len: Math.round(tg0.shelfX()),
    });
  }
  return out;
}
const avg = (r, k) => Math.round(r.reduce((a, b) => a + b[k], 0) / r.length);
const min = (r, k) => Math.min(...r.map(x => x[k]));

// ─────────────────────────────────────────────────────
section('① 10 张地图都有独立的元数据');
{
  ok(tg0.mapCount() === N, '一共 ' + N + ' 张地图');
  const names = mapNames();
  eq(new Set(names).size, N, '名字互不重复', names.join(' '));
  const times = Array.from({ length: N }, (_, i) => tg0.timeAt(i + 1));
  eq(new Set(times).size, N, '时间段互不重复（黄昏/正午/阴天/深夜/雨夜/清晨/夜/黎明/地下/室内）');
  const notes = Array.from({ length: N }, (_, i) => tg0.noteAt(i + 1));
  ok(notes.every(s => s && s.length > 10), '每张地图都有一句设计说明');
}

// ─────────────────────────────────────────────────────
section('② 每张地图的视觉参数都不一样');
{
  const skies = Array.from({ length: N }, (_, i) => tg0.skyAt(i + 1).join(','));
  eq(new Set(skies).size, N, '天空色板互不相同');
  const texs = Array.from({ length: N }, (_, i) => tg0.texAt(i + 1));
  ok(new Set(texs).size >= 5, '地面材质至少 5 种', [...new Set(texs)].join(' '));
  const lamps = Array.from({ length: N }, (_, i) => tg0.lampAt(i + 1));
  ok(new Set(lamps).size >= 3, '路灯样式至少 3 种', [...new Set(lamps)].join(' '));
  const kk = new Set(Array.from({ length: N }, (_, i) => tg0.skyKindAt(i + 1)));
  ok(kk.has('outdoor') && kk.has('tunnel') && kk.has('lab'), '户外/隧道/室内三种场景类型都有',
    [...kk].join(' '));
}

// ─────────────────────────────────────────────────────
section('③ 每张地图的物件池都不一样');
{
  const pools = Array.from({ length: N }, (_, i) => tg0.propPoolAt(i + 1).slice().sort().join(','));
  ok(new Set(pools).size >= 18, '物件池组合至少 18 种', new Set(pools).size + ' 种（共 ' + N + ' 张图）');
  const bad = [];
  for (let i = 1; i <= N; i++) {
    for (const id of tg0.propPoolAt(i)) if (!tg0.propKinds()[id]) bad.push('第' + i + '关:' + id);
  }
  eq(bad.length, 0, '物件池里没有拼错的 id（拼错会让整关卡死）', bad.join(' '));
}

// ─────────────────────────────────────────────────────
section('④ 每张地图的地形组合都不一样');
{
  const segs = Array.from({ length: N }, (_, i) => tg0.segPoolAt(i + 1).slice().sort().join(','));
  eq(new Set(segs).size, N, '路段组合互不相同');
  // 层高形态：学校/研究所/公路/医院 应该是多层图
  for (const n of [6, 10]) {
    const r = roll(n);
    ok(r.every(x => x.layers.includes(176)), '第' + n + '关每局都有二层平台（垂直空间最多）');
  }
  for (const n of [1, 2, 8]) {
    const r = roll(n);
    ok(r.every(x => x.layers.length === 1), '第' + n + '关每局都是单层（开阔地形）');
  }
  ok(tg0.segDefs().stack, '路段库里有"叠层"这种形态');
  eq(new Set(Object.keys(tg0.segDefs())).size >= 9, true, '路段库至少 9 种形态');
}

// ─────────────────────────────────────────────────────
section('⑤ 每局都有可进的房子和高台（不看运气）');
{
  const bad = [];
  for (let n = 1; n <= N; n++) {
    const r = roll(n, 14);
    if (min(r, 'safe') < 1) bad.push('第' + n + '关没有可进房子');
    if (min(r, 'floors') < 1) bad.push('第' + n + '关没有高台');
    if (min(r, 'props') < 10) bad.push('第' + n + '关物件太少');
  }
  eq(bad.length, 0, '14 局 × 10 张图：每局都可躲、可跳、有补给', bad.join(' / '));
}

// ─────────────────────────────────────────────────────
section('⑥ 每张地图的规模都在合理范围');
{
  for (let n = 1; n <= N; n++) {
    const r = roll(n, 6);
    const len = avg(r, 'len');
    ok(len > 8000 && len < 13000, '第' + n + '关长度 ' + len + 'px 在 8000~13000 之间');
  }
}

// ─────────────────────────────────────────────────────
section('⑦ 特殊地图的特殊机制');
{
  eq(tg0.blindAt(9), true, '第 9 关地铁隧道有视野限制');
  eq(tg0.blindAt(1), false, '第 1 关没有视野限制');
  eq(tg0.rainAt(5), 1, '第 5 关医院在下雨');
  eq(tg0.sirenAt(7), 1, '第 7 关警察局有警灯');
  const hz = [1, 2, 3, 5, 6, 7, 8].map(n => roll(n, 4).every(x => x.hazards === 0));
  ok(hz.every(Boolean), '没有特殊机制的地图不会随机出危险区');
  for (const n of [4, 9, 10]) {
    ok(roll(n, 4).every(x => x.hazards >= 1), '第' + n + '关有地图自带的危险区');
  }
}

// ─────────────────────────────────────────────────────
section('⑧ 测试模式：10 关全部解锁');
{
  const env = load();
  const tg = env.tg;
  tg.save().unlocked = 1;
  eq(tg.isLocked(10), false, '即使存档只解锁到第 1 关，第 10 关也能直接进（测试模式）');
  eq(tg.isLocked(1), false, '第 1 关当然能进');
}

// ─────────────────────────────────────────────────────
section('⑨ ' + N + ' 张地图全部跑通真实渲染');
{
  const env = load();
  const tg = env.tg;
  const fails = [];
  for (let n = 1; n <= N; n++) {
    try {
      tg.startLevel(n);
      tg.save().cash = 9000;
      const t0 = Date.now() + 100000 + n * 20000;
      tg.place(tg.fenceX() * 0.5);
      for (let i = 0; i < 300; i++) tg.frame(t0 + i * 16);       // 中段：刷怪 + 危险区 + 各类物件
      tg.place(tg.fenceX() + 10); tg.frame(t0 + 6000);           // 越线
      tg.place(tg.shelfX() - 60); tg.frame(t0 + 6100);           // 开货架
      for (let c = 0; c < 3; c++) {                              // 货架三个分类翻一遍
        for (let k = 0; k < 7; k++) { tg.shelfNav('right'); tg.shelfConfirm(); }
        tg.shelfNav('down');
      }
      tg.shelfUndo();
    } catch (e) { fails.push('第' + n + '关: ' + e.message); }
  }
  eq(fails.length, 0, N + ' 张地图的渲染 / 刷怪 / 通关 / 货架全流程无异常', fails.join(' / '));
}

summary();
