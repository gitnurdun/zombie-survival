// js/10-houses.js —— 由 tools/split.js 从单文件版拆出。
// 分段：门

'use strict';
// ============================== 门 ==============================
// E 键：货架 / 同伴 / 空投箱等交互（后续步骤接入）
// E 键：目前只有"打开超级武器补给箱"一件事，留这个入口给后面的同伴/机关。
function interact() { takeDrop(); }

// —— 进屋 / 出屋：都在门口或屋内按跳跃键触发（见 updatePlayer），不用单独的键 ——
function enterHouse(h) {
  player.inside = h;
  player.x = doorOf(h).x;
  player.z = 0; player.vz = 0; player.onGround = true;
  h.refreshT = 0;                       // 进屋立刻刷第一批物资
  SFX.door();
  G.banner = '安全屋 · 再跳一下出去'; G.bannerT = 1.6;
}
function exitHouse() {
  const h = player.inside;
  if (!h) return;
  player.inside = null;
  player.x = doorOf(h).x;
  SFX.door();
}
// 僵尸砸屋：房屋逐渐受损，砸塌了玩家会被弹出去并受伤
function damageHouse(h, dmg) {
  if (!h || h.type !== 'safe' || h.dead) return;
  h.hp -= dmg;
  h.hitT = 0.14;
  if (h.hp > 0) return;
  h.hp = 0; h.dead = true;
  SFX.breakIn();
  G.shake = 20;
  for (let i = 0; i < 46; i++) {
    parts.push({ type: 'spark', x: h.x + rand(0, h.w), y: GROUND - rand(0, h.h), vx: rand(-220, 220), vy: rand(-360, -60), grav: 800, life: rand(0.6, 1.4), max: 1.4, size: rand(2, 5) });
  }
  decals.push({ x: h.x + h.w / 2, r: 55 });
  if (player.inside === h) {
    player.inside = null;
    player.x = doorOf(h).x;
    player.z = 0; player.vz = 0; player.onGround = true;
    player.invuln = 0;
    hurtPlayer(12, (Math.random() < 0.5 ? -1 : 1) * 180);
    G.banner = '房子塌了!'; G.bannerT = 2;
  }
  const i = houses.indexOf(h);
  if (i >= 0) houses.splice(i, 1);
}
function nearDoorHouse() {
  for (const h of houses) {
    if (h.type === 'deco' || h.dead) continue;
    const d = doorOf(h);
    if (Math.abs(player.x - d.x) < 46 && player.z < 20) return h;
  }
  return null;
}
// 安全屋物资：每次刷新在屋内 3 个点随机撒东西，走过即自动拾取。
// 同一个房子最多刷 2 批（h.refreshes），刷完窗户灯变蓝。
function spawnHouseLoot(h) {
  for (let i = 0; i < 3; i++) {
    const x = h.x + 34 + (h.w - 68) * (i + 0.5) / 3 + rand(-12, 12);
    const r = Math.random();
    if (r < 0.38) {
      items.push({ type: 'medkit', x, y: GROUND - 18, z: 0, t: 0, life: 14 });
    } else if (r < 0.74) {
      items.push({ type: 'ammo', x, y: GROUND - 18, z: 0, t: 0, life: 14, cat: Math.random() < 0.62 ? 'bullet' : 'cell', amt: 20 });
    } else {
      coins.push({ x, y: GROUND - 46, vy: 0, vx: 0, v: 14, t: 0, life: 14 });
    }
  }
  SFX.buy();
}
// 给所有「弹药类型匹配」的已装备枪械补弹，返回实际补到的总数。
// 带 3 把科幻枪时打碎实弹箱会补到 0 —— 这就是 2 类弹药的设计意图。
function grantAmmo(cat, amt) {
  let total = 0;
  for (const w of player.weapons) {
    if (!w || w.def.melee) continue;
    if ((w.def.ammoType || 'bullet') !== cat) continue;
    const max = w.def.ammoMax || 120;
    const before = w.ammo;
    w.ammo = Math.min(max, w.ammo + amt * (P ? P.ammoMul : 1));   // 「弹药腰带」
    total += Math.round(w.ammo - before);
  }
  return total;
}
