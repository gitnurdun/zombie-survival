// js/13-shelf.js —— 由 tools/split.js 从单文件版拆出。
// 分段：武器图标 · 货架商店

'use strict';
// ============================== 武器图标 ==============================
// 全部程序化绘制后转 dataURL 缓存 —— 不引入任何图片文件。
const ICON_CACHE = {};
function weaponIcon(id, lv) {
  const key = id + ':' + (lv || 0);
  if (ICON_CACHE[key] !== undefined) return ICON_CACHE[key];
  let url = '';
  try {
    const c = document.createElement('canvas');
    c.width = 132; c.height = 60;
    const g = c.getContext('2d');
    const d = Object.assign({}, WEAPONS[id], WEAPONS[id].lv[(lv || 1) - 1] || {});
    const col = d.col || '#333', acc = d.accent || '#8a8a90';
    const L = (d.L || 30) * 1.7;
    g.translate(66, 30);
    g.lineJoin = 'round';
    const box = (x, y, w, h, c2) => { g.fillStyle = c2 || col; g.fillRect(x, y, w, h); };
    switch (d.shape) {
      case 'club': case 'machete': case 'sword':
        box(-8 - 22, -4, 24, 8, '#5a3a22');            // 柄
        box(-10, -3.5, L, 7);                           // 刃/棍身
        box(L - 10, -5.5, 10, 11, acc);                 // 前端加重
        break;
      case 'axe':
        box(-8 - 24, -3.5, 26, 7, '#5a3a22');
        box(-8, -3, 34, 6);
        g.fillStyle = acc;                              // 斧头
        g.beginPath(); g.moveTo(10, -16); g.lineTo(30, -6); g.lineTo(30, 6); g.lineTo(10, 16);
        g.closePath(); g.fill();
        break;
      case 'saw':
        box(-38, -7, 30, 14, '#5a3a22');
        box(-12, -8, 40, 16);
        box(4, -12, 26, 6, '#c8ccd4');
        g.fillStyle = '#2a2a30';
        for (let i = 0; i < 7; i++) g.fillRect(0 + i * 4, -14, 2, 4);
        break;
      case 'shovel':
        box(-42, -3, 40, 6, '#5a3a22');
        box(-4, -10, 24, 20, acc);
        break;
      case 'dart':
        g.fillStyle = col;
        g.beginPath(); g.moveTo(26, 0); g.lineTo(-8, -10); g.lineTo(-8, 10); g.closePath(); g.fill();
        g.fillStyle = acc; g.fillRect(-14, -3, 10, 6);
        break;
      case 'pistol':
        box(-18, -9, 44, 12); box(-13, 0, 12, 20);
        break;
      case 'smg':
        box(-26, -9, 52, 13); box(-7, 3, 12, 18); box(16, 3, 8, 15, acc);
        break;
      case 'shotgun':
        box(-44, -7, 88, 9);
        box(-44, -2, 28, 13, '#5a3a22');
        break;
      case 'revolver':
        box(-16, -9, 40, 12);
        g.fillStyle = '#8a8a90'; g.beginPath(); g.arc(-4, 0, 11, 0, TAU); g.fill();
        box(-16, 0, 11, 20);
        break;
      case 'minigun':
        box(-18, -13, 44, 26);
        g.fillStyle = '#2a2a30'; for (let i = 0; i < 4; i++) g.fillRect(26, -11 + i * 6, 20, 4);
        box(-6, 10, 14, 16, '#5a3a22');
        break;
      case 'rpg':
        box(-46, -10, 92, 20);
        box(24, -12, 16, 24, acc);
        break;
      case 'flamer':
        box(-34, -9, 56, 15);
        box(-18, 4, 13, 20, '#5a3a22');
        box(22, -14, 12, 20, acc);
        break;
      case 'energy': default:
        box(-38, -10, 72, 20);
        box(-16, -5, 30, 10, acc);
        g.fillStyle = acc; g.beginPath(); g.arc(32, 0, 9, 0, TAU); g.fill();
        break;
    }
    url = c.toDataURL();
  } catch (e) { url = ''; }
  ICON_CACHE[key] = url;
  return url;
}

// ============================== 货架商店 ==============================
// 纯键盘驱动：←→ 选物品，↑↓ 切分类，Enter 买/升级，U 撤销。
const SH = { cat: 0, idx: 0, undo: [] };
const CAT_KEYS = ['melee', 'gun', 'scifi'];
function shelfItems() { return WEP_ORDER.filter(id => WEAPONS[id].cat === CAT_KEYS[SH.cat]); }

function openShelf() {
  SH.cat = 0; SH.idx = 0; SH.undo.length = 0;
  G.state = 'shelf';
  renderShelf();
  show('shelf');
  SFX.buy();
}
function closeShelf() {
  hide('shelf');
  G.state = 'play';
  winLevel();          // 关掉货架 = 本关结束 → 结算
}
function renderShelf() {
  document.getElementById('shelfCash').textContent = '金币 $' + S.cash;
  document.getElementById('shelfTabs').innerHTML = CAT_KEYS.map((k, i) =>
    `<div class="tab ${i === SH.cat ? 'on' : ''}">${CAT_NAME[k]}</div>`).join('');

  const items = shelfItems();
  SH.idx = clamp(SH.idx, 0, Math.max(0, items.length - 1));
  document.getElementById('shelfRack').innerHTML = items.map((id, i) => {
    const d = WEAPONS[id];
    const lv = S.owned[id] || 0;
    const st = lv ? Object.assign({}, d, d.lv[lv - 1]) : d;
    const name = st.name || d.name;
    const ammo = d.melee ? '不耗弹' : (d.recover ? '回收' : (d.ammoType === 'cell' ? '能量' : '实弹'));
    let pr, cls = '';
    if (!lv) { pr = '购买 $' + d.price; cls = S.cash < d.price ? 'no' : ''; }
    else if (lv < d.lv.length) { pr = '升级 $' + d.upCost[lv - 1]; cls = S.cash < d.upCost[lv - 1] ? 'no' : 'own'; }
    else { pr = '已 满 级'; cls = 'own'; }
    const icon = weaponIcon(id, lv || 1);
    return `<div class="wcard ${i === SH.idx ? 'sel' : ''} ${lv >= d.lv.length ? 'max' : ''}">
      <div class="icon">${icon ? `<img src="${icon}" alt="">` : '—'}</div>
      <div class="nm">${name}</div>
      <div class="st">伤害 ${st.dmg} · ${st.rate}s<br>${ammo}${lv ? ' · Lv' + lv : ''}</div>
      <div class="pr ${cls}">${pr}</div></div>`;
  }).join('');

  document.getElementById('shelfSlots').innerHTML = '当前装备： ' + S.slots.map((id, i) =>
    `<b>${i + 1}</b> ${id ? (WEAPONS[id].lv[(S.owned[id] || 1) - 1].name || WEAPONS[id].name) : '空'}`
  ).join('   ');
}
function shelfNav(d) {
  if (d === 'up' || d === 'down') {
    SH.cat = (SH.cat + (d === 'up' ? -1 : 1) + CAT_KEYS.length) % CAT_KEYS.length;
    SH.idx = 0;
  } else {
    const n = shelfItems().length;
    SH.idx = (SH.idx + (d === 'left' ? -1 : 1) + n) % n;
  }
  SFX.swap();
  renderShelf();
}
function shelfConfirm() {
  const id = shelfItems()[SH.idx];
  if (!id) return;
  const d = WEAPONS[id];
  const lv = S.owned[id] || 0;
  if (!lv) {
    if (S.cash < d.price) { toast('金币不够'); SFX.deny(); return; }
    S.cash -= d.price;
    S.owned[id] = 1;
    S.seen.w[id] = 1;
    SH.undo.push({ id, kind: 'buy', cost: d.price });
    equipWeapon(id);
  } else if (lv < d.lv.length) {
    const cost = d.upCost[lv - 1];
    if (S.cash < cost) { toast('金币不够'); SFX.deny(); return; }
    S.cash -= cost;
    S.owned[id] = lv + 1;
    SH.undo.push({ id, kind: 'up', cost, from: lv });
    const w = player.weapons.find(v => v.baseId === id);
    if (w) upgradeWeapon(w);
  } else { toast('已经满级了'); SFX.deny(); return; }
  SFX.buy();
  writeSave();
  renderShelf();
}
function shelfUndo() {
  const a = SH.undo.pop();
  if (!a) { toast('没有可撤销的操作'); SFX.deny(); return; }
  S.cash += a.cost;
  if (a.kind === 'buy') {
    delete S.owned[a.id];
    const i = player.weapons.findIndex(w => w.baseId === a.id);
    if (i >= 0) player.weapons.splice(i, 1);
    for (let k = 0; k < S.slots.length; k++) if (S.slots[k] === a.id) S.slots[k] = null;
    syncLoadout();
  } else {
    S.owned[a.id] = a.from;
    const w = player.weapons.find(v => v.baseId === a.id);
    if (w) { w.lv = a.from; refreshWeapon(w); }
  }
  SFX.swap();
  writeSave();
  renderShelf();
}
function shelfEquipSlot(i) {
  const id = shelfItems()[SH.idx];
  if (!id || !S.owned[id]) { toast('先购买才能装备'); SFX.deny(); return; }
  S.slots[i] = id;
  syncLoadout();
  player.slot = Math.min(i, player.weapons.length - 1);
  SFX.swap();
  writeSave();
  renderShelf();
}
// 把新买的武器放进空槽，槽满了就替换当前槽
function equipWeapon(id) {
  let i = S.slots.indexOf(null);
  if (i < 0) i = clamp(player.slot, 0, S.slots.length - 1);
  S.slots[i] = id;
  syncLoadout();
  player.slot = Math.min(i, player.weapons.length - 1);
}
// 从存档的 3 个槽位重建玩家手上的武器
function syncLoadout() {
  const C = CHARS[S.curChar] || CHARS.hank;
  const list = S.slots.map(id => id ? [id, S.owned[id] || 1] : null);
  // 空槽用「角色的起始武器」填上 —— 这样换角色每一关都能立刻感觉到差别。
  // （早先只在完全没有已购武器时才用角色武器，结果买过一把枪之后角色选择就形同虚设了。）
  const start = C.weapons || [['bat', 1]];
  const used = new Set(list.filter(Boolean).map(x => x[0]));
  let si = 0;
  for (let i = 0; i < list.length; i++) {
    if (list[i]) continue;
    // 跳过已经装着的（Hank 的起始武器也是木棍，不去重会变成两把木棍）
    while (si < start.length && used.has(start[si][0])) si++;
    if (si >= start.length) break;
    list[i] = [start[si][0], start[si][1]];
    used.add(start[si][0]);
    si++;
  }
  let out = list.filter(Boolean);
  if (!out.length) out = [['bat', 1]];
  player.weapons = out.map(([id, lv]) => makeWeapon(id, lv));
  player.slot = clamp(player.slot, 0, player.weapons.length - 1);
}

let toastT = null;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.style.opacity = 1;
  clearTimeout(toastT);
  toastT = setTimeout(() => { el.style.opacity = 0; }, 1600);
}
function show(id) { document.getElementById(id).classList.remove('hidden'); }
function hide(id) { document.getElementById(id).classList.add('hidden'); }
function togglePause() {
  if (G.state !== 'play') return;
  G.paused = !G.paused;
  if (G.paused) {
    // 暂停面板带上当前进度，免得玩家忘了自己打到哪
    const m = G.map || MAPS[0];
    document.getElementById('pauseStats').innerHTML =
      `第 <b>${G.wave}</b> 关 · ${m.name}　<span style="color:#7d8a76">${m.time || ''}</span><br>` +
      `击杀 <b>${player.kills}</b>　·　金币 <b>$${S.cash}</b>　·　HP <b>${Math.round(player.hp)}</b>`;
    show('pause');
  } else hide('pause');
}
function restartLevel() {
  hide('pause');
  G.paused = false;
  startLevel(G.wave || 1);
}
function quitToLevels() {
  hide('pause');
  G.paused = false;
  openLevels();
}
