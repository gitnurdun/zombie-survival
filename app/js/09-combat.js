// js/09-combat.js —— 由 tools/split.js 从单文件版拆出。
// 分段：战斗

'use strict';
// ============================== 战斗 ==============================
function attack() {
  const w = curWeapon();
  if (w.cd > 0) return;
  // 超级武器：8 种各自的机制，不进普通弹道/弹药那套（冷却也由 fireSuper 自己设）
  if (w.def.superWeapon) { fireSuper(w); return; }
  if (w.def.melee) { meleeSwing(w); return; }
  if (w.ammo <= 0) { SFX.deny(); return; }
  // 「全自动」Perk 只对自动武器生效；射速越快冷却越短
  w.cd = w.def.rate / ((w.def.auto && P) ? P.rateMul : 1);
  w.ammo -= w.def.flame ? 0.22 : 1;
  const a = player.aim;
  if (w.def.flame) {
    (SFX[w.def.sfx] || SFX.flamer)();
    for (let i = 0; i < 3; i++) {
      const ang = a + rand(-0.14, 0.14);
      parts.push({
        type: 'fire', x: player.x + Math.cos(a) * 34, y: GROUND - player.h + 34 - player.z + Math.sin(a) * 34,
        vx: Math.cos(ang) * rand(320, 460), vy: Math.sin(ang) * rand(320, 460) - 30,
        life: rand(0.35, 0.55), max: 0.55, size: rand(7, 13), t: 0,
      });
    }
    G.shake = Math.min(G.shake + 0.6, 4);
    return;
  }
  if (w.def.chain) {
    (SFX[w.def.sfx] || SFX.tesla)();
    fireLightning(w);
    return;
  }
  (SFX[w.def.sfx] || SFX.pistol)();
  // 噪音：开枪会吸引僵尸，近战安静 —— 这是「打还是不打」这个决策的依据
  addNoise(w.def.pellets ? 44 : (w.def.explode ? 58 : 26));
  const muzzleX = player.x + Math.cos(a) * 36, muzzleY = GUN_Y - player.z;
  const elev = Math.max(0, player.z);              // 比最低地面高出多少
  // 「霰弹专精」只对多弹丸武器生效
  const pellets = (w.def.pellets || 1) + (w.def.pellets && P ? P.pelletAdd : 0);
  for (let i = 0; i < pellets; i++) {
    const ang = a + rand(-w.def.spread, w.def.spread);
    const sp = w.def.spd * rand(0.94, 1.06);
    const vx = Math.cos(ang) * sp;
    bullets.push({
      x: muzzleX, y: muzzleY, vx,
      // 纯水平弹道、不受重力（若保留 sin(ang) 的垂直分量，spread 会让弹道漂移十几像素）。
      // 但从高处（高台 / 空中）开枪时，让弹道在 FALL_DIST 内斜向下压回 GUN_Y 再恢复水平 ——
      // 否则站在高台上会从所有地面僵尸的头顶飞过去，高台就变成废物了。
      vy: elev > 0 ? elev / FALL_DIST * Math.abs(vx) : 0,
      grav: 0, dmg: w.def.dmg, life: 1.2,
      air: !player.onGround,   // 开枪时人在空中（跳起或下落）→ 这一发算打头
      noArmor: !!w.def.noArmor,// 破甲武器无视重甲尸的正面减伤
      // Perk：暴击 / 穿透
      crit: (w.def.crit || 0) + (P ? P.critAdd : 0),
      critMul: (w.def.critMul || 2) * (P ? P.critDmgMul : 1),
      pierce: (w.def.pierce || 0) + (P ? P.pierceAdd : 0),
      hitSet: null,
    });
  }
  G.flashT = 0.06;
  G.shake = Math.min(G.shake + (w.def.id === 'shotgun' ? 6 : 2.2), 12);
  const sa = a + Math.PI / 2;
  parts.push({ type: 'shell', x: player.x, y: muzzleY, vx: Math.cos(sa) * rand(50, 110), vy: -rand(150, 260), grav: 900, life: 0.8, max: 0.8, size: 3 });
}
function meleeSwing(w) {
  w.cd = w.def.rate;
  player.swingT = 0.22;
  (SFX[w.def.sfx] || SFX.swing)();   // 七种近战各有各的手感
  addNoise(6);   // 近战是安静的
  const dir = Math.cos(player.aim) >= 0 ? 1 : -1;
  let hitAny = false;
  eachZombieRev((z, i) => {
    const dx = z.x - player.x;
    if (dx * dir > 0 && Math.abs(dx) < 80 + z.w / 2 && Math.abs(z.z - player.z) < 70) {
      hitAny = true;
      damageZombie(z, i, w.def.dmg * (P ? P.meleeMul : 1), false, dir * 300, w.def.noArmor);   // 「近战狂人」
    }
  });
  for (let i = props.length - 1; i >= 0; i--) {
    const p = props[i];
    const dx = p.x - player.x;
    if (dx * dir > 0 && Math.abs(dx) < 80 + p.w / 2 && Math.abs(p.z - player.z) < 70) {
      hitAny = true;
      damageProp(p, i, w.def.dmg);
    }
  }
  if (hitAny) SFX.melee();
}
function fireLightning(w) {
  const a = player.aim;
  const sx = player.x + Math.cos(a) * 30, sy = GROUND - player.h + 34 - player.z + Math.sin(a) * 30;
  const cands = [];
  for (const z of zombies) {
    const dx = z.x - player.x;
    if (dx * Math.cos(a) < -30) continue;
    const d = Math.hypot(dx, (z.y() - sy) * 0.6);
    if (d < 620) cands.push({ z, d });
  }
  cands.sort((p, q) => p.d - q.d);
  const targets = cands.slice(0, 4).map(c => c.z);
  if (targets.length === 0) { G.shake = Math.min(G.shake + 2, 8); return; }
  let px = sx, py = sy;
  const pts = [[px, py]];
  const hitSet = [];
  for (const z of targets) {
    pts.push([z.x, z.y() - z.h / 2]);
    hitSet.push(z);
    px = z.x; py = z.y() - z.h / 2;
  }
  arcs.push({ pts, life: 0.18, max: 0.18 });
  eachZombieRev((z, i) => {
    if (hitSet.includes(z)) damageZombie(z, i, w.def.dmg, false, (z.x > player.x ? 1 : -1) * 140);
  });
  G.shake = Math.min(G.shake + 5, 12);
}