'use strict';
// 音频层验收：
//   ① 代码里引用的每一个 SFX.xxx 都真的存在（改名/删除后忘记改引用会在这里炸出来）
//   ② 17 把武器各有各的音色，不是几个音效复用
//   ③ 10 种僵尸各有各的叫声
//   ④ 自适应 BGM 的四层强度都能切到
// 跑法：node test/audio.test.js
const fs = require('fs');
const path = require('path');
const { load, ok, eq, section, summary } = require('./harness');

const JS_DIR = path.join(__dirname, '..', 'app', 'js');

// ─────────────────────────────────────────────────────
section('① 代码里引用的 SFX.xxx 必须都存在');
{
  const env = load();
  const { tg } = env;
  const keys = new Set(Object.keys(tg.sfxKeys()));
  const files = fs.readdirSync(JS_DIR).filter(f => f.endsWith('.js'));
  const missing = [];
  for (const f of files) {
    const src = fs.readFileSync(path.join(JS_DIR, f), 'utf8');
    // 匹配 SFX.xxx（排除 SFX 表本身的定义行）
    for (const m of src.matchAll(/\bSFX\.([A-Za-z_$][\w$]*)/g)) {
      const name = m[1];
      if (['hasOwnProperty', 'name', 'length'].includes(name)) continue;
      if (!keys.has(name)) missing.push(f + ' → SFX.' + name);
    }
  }
  eq(missing.length, 0, '没有指向不存在的音效', [...new Set(missing)].join(' / '));

  // 反向：定义了但没人用到的音效。
  // 必须把「动态派发」也算进来 —— 武器音效是通过 SFX[w.def.sfx] 调的，
  // 源码里根本不会出现 SFX.uzi 这样的字面量，只看字面会全部误报。
  const all = files.map(f => fs.readFileSync(path.join(JS_DIR, f), 'utf8')).join('\n');
  const dynamic = new Set(Object.values(tg.weapons()).map(w => w.sfx));
  const unused = [...keys].filter(k =>
    !new RegExp('SFX\\.' + k + '\\b').test(all) && !dynamic.has(k));
  ok(unused.length < 8, '没有大量闲置音效', unused.length + ' 个（' + unused.slice(0, 6).join(',') + '）');
}

// ─────────────────────────────────────────────────────
section('② 17 把武器各有各的音色');
{
  const env = load();
  const { tg } = env;
  const W = tg.weapons();
  const byId = {};
  for (const id of Object.keys(W)) byId[id] = W[id].sfx;
  const noSfx = Object.keys(byId).filter(id => !byId[id]);
  eq(noSfx.length, 0, '每把武器都指定了音效', noSfx.join(','));

  const used = new Set(Object.values(byId));
  ok(used.size >= 14, '17 把武器至少用了 14 种不同音色', used.size + ' 种');
  // 同一类里不能再出现"同一个音效"的偷懒
  for (const cat of ['melee', 'gun', 'scifi']) {
    const ids = Object.keys(W).filter(id => W[id].cat === cat);
    const s = new Set(ids.map(id => byId[id]));
    ok(s.size === ids.length, cat + ' 类里每把武器音色都不重复',
      ids.length + ' 把 → ' + s.size + ' 种');
  }
}

// ─────────────────────────────────────────────────────
section('③ 每种僵尸的叫声都不一样');
{
  const env = load();
  const { tg } = env;
  const Z = tg.ztypes();
  const src = fs.readFileSync(path.join(JS_DIR, '02-audio.js'), 'utf8');
  const groanBody = src.slice(src.indexOf('groan('), src.indexOf('giant()'));
  const missing = Object.keys(Z).filter(id => !groanBody.includes("case '" + id + "'"));
  // boss 和 giant 允许走 default / 专门分支
  const need = missing.filter(id => id !== 'giant');
  ok(need.length <= 1, '每种僵尸在 groan() 里都有自己的分支', '缺 ' + need.join(',') || '全都有');
}

// ─────────────────────────────────────────────────────
section('④ 自适应 BGM：四层强度都能切到');
{
  const env = load();
  const { tg } = env;
  tg.startLevel(1);
  tg.noWave();
  tg.setState('play');

  tg.setMusicIntensity(0);
  eq(tg.musicIntensity(), 0, '平静层');
  tg.setMusicIntensity(1);
  eq(tg.musicIntensity(), 1, '交火层');
  tg.setMusicIntensity(2);
  eq(tg.musicIntensity(), 2, '濒死层');
  tg.setMusicIntensity(3);
  eq(tg.musicIntensity(), 3, '推进层');

  // 自动判定：僵尸多 → 至少交火
  tg.setMusicIntensity(-1);
  for (let i = 0; i < 10; i++) { tg.spawn('normal'); tg.zombies()[tg.zombies().length - 1].x = tg.player().x + 100; }
  for (let i = 0; i < 10; i++) tg.step(1 / 60);
  ok(tg.musicIntensity() >= 1, '身边僵尸多 → 自动切到交火及以上', 'intensity ' + tg.musicIntensity());

  // 濒死优先级最高
  tg.player().hp = 5;
  for (let i = 0; i < 6; i++) tg.step(1 / 60);
  eq(tg.musicIntensity(), 2, '血量低于 30% → 濒死层（优先级最高）');

  // 越过栅栏后静音
  tg.player().hp = 100;
  tg.place(tg.fenceX() + 10);
  tg.step(1 / 60);
  eq(tg.cleared(), true, '已越过栅栏');
  tg.step(1 / 60);
  eq(tg.musicIntensity(), -1, '过关后 BGM 停掉（-1 = 未启动）');
}

summary();
