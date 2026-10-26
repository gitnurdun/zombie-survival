// js/14-ui.js —— 由 tools/split.js 从单文件版拆出。
// 分段：流程

'use strict';
// ============================== 流程 ==============================
const STAR_KILLS = 120;          // 拿"击杀达标"那颗星的门槛
// ⚠ 测试阶段开关：所有关卡直接解锁，方便逐张审核地图。
// 改成 false 就恢复"逐关解锁"。
const TEST_UNLOCK_ALL = true;
const isLocked = n => !TEST_UNLOCK_ALL && n > S.unlocked;

function resetGame() {
  P = computePerkStats();          // 刷新属性聚合表（Perk + 角色）
  player = {
    x: 260, z: 0, vz: 0, vx: 0, kb: 0, w: 26, h: 74,
    // 角色的基础 HP + Perk 加成（角色的 HP 之前一直没接进来，选了没效果）
    hp: CHARS[S.curChar].hp + P.hpAdd, maxHp: CHARS[S.curChar].hp + P.hpAdd,
    aim: 0, facing: 1, weapons: [], slot: 0,
    kills: 0, bats: 0, invuln: 0, walkT: 0, swingT: 0,
    dodgeT: 0, dodgeCd: 0,          // 闪避翻滚（必须初始化，否则 undefined <= 0 是 false，永远滚不了）
    superOn: false, super: null,    // 第 4 槽：超级武器（不占 3 把常驻枪）
    inside: null, onGround: true, floor: null,
  };
  player.y = () => GROUND - player.z;
  // 单一持久钱包：player.cash 是 S.cash 的访问器。打到的钱直接进存档，
  // 关卡失败也保留 —— 不存在"本局钱 vs 存档钱"两本账。
  Object.defineProperty(player, 'cash', {
    get: () => S.cash,
    set: v => { S.cash = Math.max(0, Math.round(v)); },
    configurable: true,
  });
  syncLoadout();
  zombies = []; bullets = []; parts = []; coins = []; texts = []; decals = []; arcs = []; items = []; props = [];
  zprojs = []; hazards = []; meteors = [];
  G.time = 0; G.spawnT = 0;
  G.hurtT = 0; G.shake = 0; G.bannerT = 0; G.flashT = 0; G.paused = false; G.groanT = 3;
  // 超级武器：每次关卡尝试重置 —— 「濒死空投」的额度是按"尝试"算的，
  // 不重置的话压血白嫖一次就永久失效了（反过来不重置则会被反复白嫖）。
  G.panicDropped = false; G.drop = null; G.superFx = null;
  // buildLevel 负责：铺路段、摆高台和房屋、撒物件、地图自带危险区，
  // 以及算好关卡长度 / 栅栏位置 / 货架位置
  buildLevel(MAPS[clamp((G.wave || 1) - 1, 0, MAPS.length - 1)]);
  player.floor = floors[0];
  cam = { x: clamp(player.x, VW / 2, WORLD_W - VW / 2) };
}
function startLevel(n) {
  initAudio();
  if (AC && AC.state === 'suspended') AC.resume();
  S.level = n;
  G.wave = n;
  // 这一刻定死本关的难度模式 —— 之后再改设置也不会让同一局前后不一致
  G_INF = infectedUnlocked() && !!S.infected;
  resetGame();
  hide('menu'); hide('shelf'); hide('result'); hide('pause'); hide('levels');
  G.state = 'play';
  // 本关首次登场的新敌人会写在开场横幅里
  const nw = newTypesAt(n).filter(id => !ZTYPES[id].boss).map(id => ZTYPES[id].name);
  G.banner = `第 ${n} 关 · ${LEVELS[n - 1] ? LEVELS[n - 1].name : ''}` +
             (nw.length ? ` · 新敌人：${nw.join('、')}` : '');
  G.bannerT = nw.length ? 4.2 : 3.2;
  writeSave();
  SFX.wave();
}
// 星级：★ 活着走到栅栏　★ 击杀达标　★ 生命过半
function starsFor() {
  let s = 1;
  if (player.kills >= STAR_KILLS) s++;
  if (player.hp > player.maxHp * 0.5) s++;
  return s;
}
function winLevel() {
  const n = G.wave;
  const stars = starsFor();
  S.stats.levelsCleared++;
  S.stats.kills += player.kills;
  const prev = S.cleared[n];
  if (!prev || stars > prev.stars) S.cleared[n] = { stars, bestKills: player.kills };
  else prev.bestKills = Math.max(prev.bestKills || 0, player.kills);
  S.unlocked = Math.max(S.unlocked, Math.min(LEVELS.length, n + 1));
  // 结算时统一检查一次成就（不是每帧）
  const newAch = checkAch({ win: true, noMedkit: G.runNoMedkit !== false,
                            peakNoise: G.runPeakNoise || 0, bossKilled: !!G.bossDone,
                            infected: G_INF });
  writeSave();
  G.newAch = newAch;
  showResult(true, stars);
}
function loseLevel() {
  S.stats.deaths++;
  S.stats.kills += player.kills;
  checkAch({ win: false });
  writeSave();
  showResult(false, 0);
}
function showResult(win, stars) {
  G.state = 'result';
  const n = G.wave;
  const t = document.getElementById('resTitle');
  t.textContent = win ? '通 关' : '你 被 吃 掉 了';
  t.style.color = win ? '#9fe8a8' : '#c0392b';
  document.getElementById('resStars').innerHTML = win
    ? `第 ${n} 关 · ${LEVELS[n - 1] ? LEVELS[n - 1].name : ''}` : '';
  document.getElementById('resStars').innerHTML = win
    ? [0, 1, 2].map(i => i < stars ? '<b>★</b>' : '★').join(' ') : '★ ★ ★';
  document.getElementById('resStats').innerHTML =
    `击杀 <b>${player.kills}</b> 只 &nbsp;·&nbsp; 金币 <b>$${S.cash}</b><br>` +
    (win
      ? (player.kills >= STAR_KILLS ? '✔ 击杀达标' : `✘ 击杀 ${player.kills} / ${STAR_KILLS}`) + ' &nbsp; ' +
        (player.hp > player.maxHp * 0.5 ? '✔ 生命过半' : '✘ 生命不足一半')
      : '金币已全部保留，可直接升级装备再战');
  if (G.newAch && G.newAch.length) {
    document.getElementById('resStats').innerHTML +=
      '<br><br><span style="color:#e8c559">成就达成</span><br>' +
      G.newAch.map(a => '✔ ' + a.name + '　+$' + a.reward).join('<br>');
  }
  document.getElementById('resNextBtn').style.display = (win && n < LEVELS.length) ? '' : 'none';
  show('result');
}
function openLevels() {
  hide('menu'); hide('result'); hide('shelf'); hide('pause');
  renderLevels();
  show('levels');
  G.state = 'menu';
}
function renderLevels() {
  const infOn = infectedUnlocked() && !!S.infected;
  document.getElementById('lvCash').innerHTML = '金币 $' + S.cash
    + (TEST_UNLOCK_ALL ? ' &nbsp;<span style="color:#d08a5a;font-size:13px">测试模式：全部关卡已解锁</span>' : '')
    + ` &nbsp;<span class="infbtn ${infOn ? 'on' : ''}" id="infToggle">`
    + (infectedUnlocked()
        ? (infOn ? '☣ 感染模式：开' : '☣ 感染模式：关')
        : '☣ 感染模式（通关第 10 关解锁）')
    + '</span>'
    + (infOn ? ' <span style="color:#c0392b;font-size:13px">僵尸 HP×1.5 · 速度×1.15 · 刷怪×1.25 · 金币×2</span>' : '');
  const grid = document.getElementById('lvGrid');
  // 按星球分组显示（登山赛车那种按 stage 分组的思路）
  let html = '';
  for (const P of PLANETS) {
    const list = MAPS.filter(m => (m.planet || 'earth') === P.id);
    if (!list.length) continue;
    html += `<div class="pgrp"><div class="pname">${P.name}<span>${P.desc}</span></div><div class="prow">`;
    for (const L of list) {
      const lock = isLocked(L.n);
      const c = S.cleared[L.n];
      const nw = newTypesAt(L.n).filter(id => !ZTYPES[id].boss).map(id => ZTYPES[id].name);
      const boss = newTypesAt(L.n).some(id => ZTYPES[id].boss);
      const g = L.gimmick && GIMMICKS[L.gimmick];
      html += `<div class="lv ${lock ? 'lock' : ''}" data-lv="${L.n}">
        <div class="no">第 ${L.n} 关 · ${L.biome || ''} ${L.time}</div>
        <div class="nm">${L.name}</div>
        <div class="df">感染等级 ${L.diff}</div>
        <div class="nt">${L.note}</div>
        ${g ? `<div class="gmk">⚙ ${g.name}：${g.desc}</div>` : ''}
        <div class="st">${c ? '★'.repeat(c.stars) + '☆'.repeat(3 - c.stars) : '☆☆☆'}
          <span class="rc">${lock ? '未解锁' : (c ? '最佳击杀 ' + c.bestKills : '未通关')}</span></div>
        ${nw.length ? `<div class="nw">新敌人：${nw.join('、')}</div>` : ''}
        ${boss ? `<div class="boss">☠ 最终 Boss</div>` : ''}</div>`;
    }
    html += `</div></div>`;
  }
  grid.innerHTML = html;
  const it = document.getElementById('infToggle');
  if (it) it.addEventListener('click', () => {
    if (!infectedUnlocked()) { toast('通关第 10 关才能解锁感染模式'); SFX.deny(); return; }
    S.infected = !S.infected;
    writeSave();
    SFX.buy();
    renderLevels();            // 重渲染刷新按钮文字
  });
  grid.querySelectorAll('.lv').forEach(el => {
    el.addEventListener('click', () => {
      const n = +el.dataset.lv;
      if (isLocked(n)) { toast('还没解锁 —— 先打通第 ' + S.unlocked + ' 关'); SFX.deny(); return; }
      startLevel(n);
    });
  });
}

document.getElementById('resumeBtn').addEventListener('click', togglePause);
document.getElementById('restartBtn').addEventListener('click', restartLevel);
document.getElementById('quitBtn').addEventListener('click', quitToLevels);
document.getElementById('startBtn').addEventListener('click', openLevels);
document.getElementById('resNextBtn').addEventListener('click', () => startLevel(Math.min(LEVELS.length, G.wave + 1)));
document.getElementById('resMenuBtn').addEventListener('click', openLevels);
document.getElementById('shelfDoneBtn').addEventListener('click', closeShelf);
(function initMenu() {
  loadSave();
  if (!S.tut || typeof S.tut !== 'object') S.tut = {};
  const done = Object.keys(S.cleared).length;
  document.getElementById('menuHs').textContent = done
    ? `已通关 ${done} / ${LEVELS.length} 关 · 金币 $${S.cash}`
    : `金币 $${S.cash} · 从第 1 关开始`;
})();
