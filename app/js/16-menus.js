// js/16-menus.js —— 角色 / Perk / 图鉴 / 成就 四个界面 + 成就判定
// 这些界面都是 DOM 覆盖层（和货架、关卡选择一样），由 show()/hide() 控制。
'use strict';

// ============================== 角色 ==============================
function openChars() {
  hide('levels'); show('chars');
  renderChars();
  G.state = 'menu';
}
function renderChars() {
  const total = Object.keys(CHARS).filter(id => charUnlocked(id)).length;
  document.getElementById('charHint').textContent =
    `已解锁 ${total} / ${Object.keys(CHARS).length} · 当前：${CHARS[S.curChar].name}`;
  document.getElementById('charRow').innerHTML = Object.keys(CHARS).map(id => {
    const c = CHARS[id];
    const ok = charUnlocked(id);
    const sel = S.curChar === id;
    const w = c.weapons.map(([wid, lv]) => WEAPONS[wid].lv[lv - 1].name || WEAPONS[wid].name).join(' + ');
    return `<div class="ccard ${sel ? 'sel' : ''} ${ok ? '' : 'lock'}" data-c="${id}">
      <div class="cn">${c.name}</div>
      <div class="cd">${c.desc}<br><span style="color:#7fb0d0">起始：${w}</span></div>
      <div class="cs">HP ${c.hp}${c.medkits ? ' · 医疗包 ×' + c.medkits : ''}${
        c.bonus.meleeMul ? ' · 近战强' : ''}${c.bonus.rateMul ? ' · 射速快' : ''}${
        c.bonus.healMul ? ' · 回血多' : ''}${c.bonus.shopMul ? ' · 商店便宜' : ''}${
        c.bonus.ammoMul ? ' · 弹药翻倍' : ''}</div>
      <div class="cu">${ok ? (sel ? '★ 使用中' : '点击选用') : '🔒 ' + c.unlockText}</div>
    </div>`;
  }).join('');
  document.getElementById('charRow').querySelectorAll('.ccard').forEach(el => {
    el.addEventListener('click', () => {
      const id = el.dataset.c;
      if (!charUnlocked(id)) { toast('还没解锁 —— ' + CHARS[id].unlockText); SFX.deny(); return; }
      S.curChar = id;
      writeSave();
      SFX.buy();
      renderChars();
    });
  });
}

// ============================== Perk ==============================
function openPerks() {
  hide('levels'); show('perks');
  renderPerks();
  G.state = 'menu';
}
function perkEquipped() { return (S.perkSlots || []).filter(Boolean); }
function renderPerks() {
  const eq = perkEquipped();
  document.getElementById('perkHint').textContent =
    `已装备 ${eq.length} / 3　·　${eq.map(id => PERKS[id].name + ' Lv' + (S.perkLv[id] || 0)).join('　') || '（还没装）'}`;
  document.getElementById('perkCols').innerHTML = PERK_CATS.map(([cat, label]) => {
    const list = Object.values(PERKS).filter(p => p.cat === cat);
    return `<div class="pcol"><h3>${label}</h3>` + list.map(p => {
      const lv = S.perkLv[p.id] || 0;
      const on = eq.includes(p.id);
      const maxed = lv >= p.max;
      const cost = maxed ? 0 : p.cost[lv];
      let price;
      if (maxed) price = `<span class="pc max">已满级</span>`;
      else if (lv === 0) price = `<span class="pc ${S.cash < cost ? 'no' : ''}">解锁 $${cost}</span>`;
      else price = `<span class="pc ${S.cash < cost ? 'no' : ''}">升级到 Lv${lv + 1} · $${cost}</span>`;
      return `<div class="pcard ${on ? 'on' : ''} ${maxed ? 'max' : ''}" data-p="${p.id}">
        <div class="pn">${p.name}<span class="lv">${'●'.repeat(lv)}${'○'.repeat(p.max - lv)}</span></div>
        <div class="pd">${p.desc}</div>
        ${price}
      </div>`;
    }).join('') + '</div>';
  }).join('');
  document.getElementById('perkCols').querySelectorAll('.pcard').forEach(el => {
    const id = el.dataset.p;
    el.addEventListener('click', () => buyOrEquipPerk(id));
    el.addEventListener('contextmenu', e => { e.preventDefault(); unequipPerk(id); });
  });
}
function buyOrEquipPerk(id) {
  const p = PERKS[id];
  const lv = S.perkLv[id] || 0;
  const eq = perkEquipped();
  // 已经装满 3 个且这个还没装备 → 先提示
  if (!eq.includes(id) && eq.length >= 3) { toast('只能装备 3 个 —— 先卸下一个'); SFX.deny(); return; }
  if (lv < p.max) {
    const cost = p.cost[lv];
    if (S.cash < cost) { toast('金币不够'); SFX.deny(); return; }
    S.cash -= cost;
    S.perkLv[id] = lv + 1;
    if (!eq.includes(id)) {
      const slot = S.perkSlots.indexOf(null);
      if (slot >= 0) S.perkSlots[slot] = id;
    }
    toast(p.name + ' → Lv' + (lv + 1));
  } else {
    // 已满级：只做装备 / 卸下
    if (eq.includes(id)) { unequipPerk(id); return; }
  }
  writeSave(); SFX.levelUp();
  renderPerks();
}
function unequipPerk(id) {
  const i = S.perkSlots.indexOf(id);
  if (i < 0) return;
  S.perkSlots[i] = null;
  writeSave(); SFX.swap();
  renderPerks();
}

// ============================== 图鉴 ==============================
let codexTab = 'weapon';
function openCodex() {
  hide('levels'); show('codex');
  renderCodex();
  G.state = 'menu';
}
function renderCodex() {
  document.getElementById('codexTabs').querySelectorAll('.tab').forEach(t => {
    t.classList.toggle('on', t.dataset.ct === codexTab);
  });
  const row = document.getElementById('codexRow');
  let html = '';
  if (codexTab === 'weapon') {
    html = WEP_ORDER.map(id => {
      const d = WEAPONS[id];
      const lv = S.owned[id] || 0;
      const seen = lv > 0;
      const st = seen ? Object.assign({}, d, d.lv[lv - 1]) : d;
      const icon = seen ? weaponIcon(id, lv) : '';
      const ammo = d.melee ? '不耗弹' : (d.recover ? '回收' : (d.ammoType === 'cell' ? '能量' : '实弹'));
      return `<div class="xcard ${seen ? '' : 'lock'}">
        <div class="xi">${icon ? `<img src="${icon}" alt="">` : '?'}</div>
        <div class="xn">${seen ? (st.name || d.name) : '???'}</div>
        <div class="xd">${seen ? `${CAT_NAME[d.cat]} · ${ammo}<br>伤害 ${st.dmg} · 间隔 ${st.rate}s${st.pellets ? ' · ' + st.pellets + ' 弹丸' : ''}${st.pierce ? ' · 穿透 ' + st.pierce : ''}` : '购买后解锁'}</div>
        <div class="xr">${seen ? 'Lv' + lv + (lv >= 3 ? ' · 满级' : ' · 下一级 $' + d.upCost[lv - 1]) : '售价 $' + d.price}</div>
      </div>`;
    }).join('');
  } else if (codexTab === 'zombie') {
    html = Object.keys(ZTYPES).map(id => {
      const t = ZTYPES[id];
      const seen = !!S.seen.z[id];
      const A = seen ? AFFIXES : {};
      return `<div class="xcard ${seen ? '' : 'lock'}">
        <div class="xi"><div style="width:44px;height:44px;border-radius:50%;background:${seen ? t.skin : '#2a2f26'};box-shadow:0 0 14px ${seen ? t.skin + '66' : 'transparent'}"></div></div>
        <div class="xn">${seen ? t.name : '???'}</div>
        <div class="xd">${seen
          ? `血量 ${t.hp} · 速度 ${t.spd}<br>伤害 ${t.dmg} · 掉落 $${t.cash}<br>${
              t.armor ? '■ 正面弹开子弹'
              : t.boss ? '■ 三阶段 Boss'
              : t.gas ? '■ 死后留下扩散的毒雾'
              : t.aura && t.aura.type === 'heal' ? `■ 光环：${t.aura.r}px 内的僵尸每秒回 ${t.aura.v} 血`
              : t.aura ? `■ 光环：${t.aura.r}px 内的僵尸加速 ${Math.round(t.aura.v * 100)}%`
              : t.ranged && t.ranged.lead ? '■ 预判走位投掷骨刺'
              : t.ranged ? '■ 远程攻击'
              : t.explode ? '■ 贴身自爆'
              : t.pounce ? '■ 蓄力扑击'
              : t.canStack ? '■ 会踩同伴肩上'
              : '■ 近战'}`
          : `第 ${t.from} 关登场`}</div>
        <div class="xr">${seen ? '出场：第 ' + t.from + ' 关起' : '待遭遇'}</div>
      </div>`;
    }).join('');
  } else {
    html = Object.keys(PROP_KINDS).map(id => {
      const d = PROP_KINDS[id];
      const seen = !!S.seen.p[id];
      return `<div class="xcard ${seen ? '' : 'lock'}">
        <div class="xi"><div style="width:38px;height:38px;border-radius:6px;background:${seen ? (d.col || '#6a6a70') : '#2a2f26'}"></div></div>
        <div class="xn">${seen ? d.name : '???'}</div>
        <div class="xd">${seen
          ? (d.solid ? `可打碎 · ${d.hp} HP<br>掉落：${{ ammo:'弹药', mixed:'弹药/金币/医疗包', cash:'金币', medkit:'医疗包', none:'无' }[d.drop] || '无'}${d.explode ? '<br>⚠ 会爆炸' : ''}` : '纯装饰')
          : '打碎后解锁'}</div>
        <div class="xr">${seen ? (d.solid ? '可破坏' : '装饰') : '?'}</div>
      </div>`;
    }).join('');
  }
  row.innerHTML = html;
}

// ============================== 成就 ==============================
function openAch() {
  hide('levels'); show('ach');
  renderAch();
  G.state = 'menu';
}
function renderAch() {
  const got = ACHIEVEMENTS.filter(a => S.ach[a.id]).length;
  document.getElementById('achHint').textContent = `${got} / ${ACHIEVEMENTS.length} · 达成后一次性发金币`;
  document.getElementById('achRow').innerHTML = ACHIEVEMENTS.map(a => {
    const on = !!S.ach[a.id];
    return `<div class="acard ${on ? 'got' : ''}">
      <div class="an">${a.name}${on ? '<span class="tick">✔</span>' : ''}</div>
      <div class="ad">${a.desc}</div>
      <div class="ar">+$${a.reward}</div>
    </div>`;
  }).join('');
}
// 关卡结算时检查一次（不是每帧）。run 是本局的增量统计。
function checkAch(run) {
  const out = [];
  for (const a of ACHIEVEMENTS) {
    if (S.ach[a.id]) continue;
    let ok = false;
    switch (a.kind) {
      case 'kills':      ok = S.stats.kills >= a.n; break;
      case 'crits':      ok = S.stats.crits >= a.n; break;
      case 'props':      ok = S.stats.propBreaks >= a.n; break;
      case 'mapClear':   ok = !!S.cleared[a.n]; break;
      case 'allMaps':    ok = Object.keys(S.cleared).length >= a.n; break;
      case 'noMedClear': ok = !!(run && run.win && run.noMedkit); break;
      case 'combo':      ok = (S.stats.bestCombo || 0) >= a.n; break;
      case 'boss':       ok = !!(run && run.bossKilled); break;
      case 'deaths':     ok = S.stats.deaths >= a.n; break;
      case 'fullSlots':  ok = S.slots.every(Boolean); break;
      case 'lowNoise':   ok = !!(run && run.win && run.peakNoise <= 40); break;
      case 'infected':   ok = !!(run && run.win && run.infected); break;
    }
    if (ok) {
      S.ach[a.id] = Date.now();
      S.cash += a.reward;
      out.push(a);
    }
  }
  if (out.length) { writeSave(); SFX.ach(); }
  return out;
}

// ============================== 接线 ==============================
function backFromSub() {
  hide('chars'); hide('perks'); hide('codex'); hide('ach');
  openLevels();
}
document.getElementById('navChars').addEventListener('click', openChars);
document.getElementById('navPerks').addEventListener('click', openPerks);
document.getElementById('navCodex').addEventListener('click', openCodex);
document.getElementById('navAch').addEventListener('click', openAch);
document.getElementById('charsBack').addEventListener('click', backFromSub);
document.getElementById('perksBack').addEventListener('click', backFromSub);
document.getElementById('codexBack').addEventListener('click', backFromSub);
document.getElementById('achBack').addEventListener('click', backFromSub);
document.getElementById('codexTabs').querySelectorAll('.tab').forEach(t => {
  t.addEventListener('click', () => { codexTab = t.dataset.ct; renderCodex(); });
});
