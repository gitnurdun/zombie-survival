// js/17-super.js —— 超级武器空投
// 分段：数据表 · 空投箱 · 装备与计时 · 8 种效果 · 绘制

'use strict';
// ============================== 超级武器 ==============================
// 触发：① 血量跌破 25%（每次关卡尝试最多 1 次）② Boss 每次切换阶段
// 形式：带降落伞的铁箱从天而降，走过去按 E 打开。
// 落点：独立第 4 槽（`4` 键或 X 循环到），不占原有的 3 把枪；计时 20 秒后消失。
//
// 两种范式，别让 8 种都变成"伤害更高的枪"：
//   auto:true  —— 召唤物，拿到就自动干活（直升机 / 无人机群）
//   auto:false —— 按住空格才生效（其余 6 种）
const SUPER_WEAPONS = {
  orbital: { name: '轨道激光', col: '#8ce8ff', dur: 20, rate: 0.05, auto: false,
             desc: '天降光柱，向前横扫' },
  heli:    { name: '加特林直升机', col: '#e8c559', dur: 20, rate: 0.075, auto: true,
             desc: '直升机跟着你向下倾泻子弹' },
  firestorm: { name: '火焰风暴', col: '#ff8a3a', dur: 20, rate: 0.5, auto: false,
             desc: '向两侧喷出推进的火墙' },
  blackhole: { name: '黑洞发生器', col: '#b48ae0', dur: 20, rate: 1.5, auto: false,
             desc: '召出黑洞吸住僵尸，再炸开' },
  thor:    { name: '雷神之锤', col: '#9fd8ff', dur: 20, rate: 0.75, auto: false,
             desc: '巨型闪电链，跳跃 20 个目标' },
  ice:     { name: '冰冻风暴', col: '#8ce0ff', dur: 20, rate: 8.0, auto: false,
             desc: '全屏冰冻 8 秒' },
  drones:  { name: '无人机群', col: '#9ab87a', dur: 20, rate: 0.26, auto: true,
             desc: '5 架无人机环绕你自动射击' },
  nuke:    { name: '核弹', col: '#ffffff', dur: 20, rate: 1.0, auto: false, once: true,
             desc: '一次性，全屏巨伤 + 白屏' },
};
const SUPER_IDS = Object.keys(SUPER_WEAPONS);

// 俄罗斯轮盘式抽奖 —— 拿到什么是不可预测的，这正是"体验一下"的乐趣
function rollSuperId() { return choice(SUPER_IDS); }

function makeSuperWeapon(id) {
  const d = SUPER_WEAPONS[id];
  return {
    baseId: 'super_' + id, superId: id, lv: 1, cd: 0, ammo: Infinity,
    def: { name: d.name, superWeapon: true, melee: false, rate: d.rate, col: d.col },
  };
}

// ============================== 空投箱 ==============================
// 每次关卡尝试只自动掉一次（防止玩家故意压血白嫖）；Boss 阶段切换不计入这个额度。
function tryDropSuper(cause) {
  if (G.state !== 'play' || G.cleared) return false;
  if (cause === 'panic') {
    if (G.panicDropped) return false;
    G.panicDropped = true;
  }
  if (G.drop) return false;                    // 天上已经有一个了，别叠
  const id = rollSuperId();
  const x = clamp(player.x + player.facing * 130, 200, G.fenceX - 200);
  G.drop = { x, y: GROUND - 620, z: 0, vy: 0, landed: false, t: 0, id };
  G.banner = '补 给 已 投 放'; G.bannerT = 2.2;
  G.flashT = 0.22;
  SFX.drop();
  return true;
}
function updateDrop(dt) {
  const d = G.drop;
  if (!d) return;
  d.t += dt;
  if (!d.landed) {
    d.vy = Math.min(d.vy + 900 * dt, 150);     // 降落伞：很快到终端速度
    d.y += d.vy * dt;
    if (Math.random() < dt * 8) {
      parts.push({ type: 'spark', x: d.x + rand(-16, 16), y: d.y - 34, vx: rand(-24, 24), vy: rand(-40, -10), life: 0.4, max: 0.4, size: 1.6 });
    }
    if (d.y >= GROUND - 14) {
      d.y = GROUND - 14; d.landed = true;
      SFX.crate(); G.shake = Math.min(G.shake + 5, 10);
      for (let k = 0; k < 14; k++) {
        parts.push({ type: 'spark', x: d.x, y: GROUND - 4, vx: rand(-190, 190), vy: rand(-180, -30), grav: 700, life: 0.4, max: 0.4, size: rand(1.5, 3) });
      }
    }
  } else if (Math.random() < dt * 3) {
    // 落地后的黄光/绳烟
    parts.push({ type: 'spark', x: d.x + rand(-12, 12), y: GROUND - 22, vx: rand(-12, 12), vy: rand(-46, -18), life: 0.7, max: 0.7, size: 1.4 });
  }
  // 5 分钟没人捡就撤走，免得一直挂在场上
  if (d.t > 300) G.drop = null;
}
function nearDrop() {
  const d = G.drop;
  if (!d || !d.landed) return null;
  return Math.abs(player.x - d.x) < 46 ? d : null;
}
function takeDrop() {
  const d = nearDrop();
  if (!d) return false;
  G.drop = null;
  equipSuper(d.id);
  return true;
}

// ============================== 装备 · 计时 ==============================
function resetSuperFx(id) {
  G.superFx = { beamD: 180, beamDir: 1, shotT: 0, rotorT: 0, fireT: 0, iceT: 0, holes: [] };
}
function equipSuper(id) {
  player.super = { id, t: SUPER_WEAPONS[id].dur, w: makeSuperWeapon(id) };
  player.superOn = true;                        // 拿到就直接切过去，不用玩家自己按
  resetSuperFx(id);
  G.banner = '超级武器 · ' + SUPER_WEAPONS[id].name; G.bannerT = 2.8;
  G.flashT = 0.3; G.shake = Math.min(G.shake + 6, 12);
  SFX.crate(); SFX.levelUp();
  texts.push({ x: player.x, y: GROUND - player.h - 40 - player.z, txt: SUPER_WEAPONS[id].name, col: SUPER_WEAPONS[id].col, life: 1.6, max: 1.6, vy: -40 });
}
function dropSuper() {
  player.super = null;
  player.superOn = false;
  G.superFx = { beamD: 180, beamDir: 1, shotT: 0, rotorT: 0, fireT: 0, iceT: 0, holes: [] };
}
function selectSuper() {
  if (!player.super) return;
  player.superOn = true;
  SFX.swap();
}
// 每帧推进：计时、冷却、自动型召唤物
function updateSuper(dt) {
  const su = player.super;
  if (!su) return;
  su.t -= dt;                                   // ← 少了这一行，20 秒倒计时就永远是 20
  su.w.cd = Math.max(0, su.w.cd - dt);
  const fx = G.superFx || (resetSuperFx(su.id), G.superFx);
  const def = SUPER_WEAPONS[su.id];

  // —— 自动型：不用按键，拿到就干活 ——
  if (def.auto) {
    if (def === SUPER_WEAPONS.heli) updateHeli(dt);
    else if (def === SUPER_WEAPONS.drones) updateDrones(dt);
  }

  // —— 轨道激光的横向扫描 ——
  if (def === SUPER_WEAPONS.orbital) {
    fx.beamD += fx.beamDir * 150 * dt;
    if (fx.beamD > 460) { fx.beamD = 460; fx.beamDir = -1; }
    if (fx.beamD < 130) { fx.beamD = 130; fx.beamDir = 1; }
    fx.rotorT -= dt;
    if (fx.rotorT <= 0) { fx.rotorT = 0.45; SFX.orbital(); }
  }
  // —— 火焰风暴：持续喷火（火焰粒子自带伤害判定，见 11-update.js）——
  // 按 0.05 秒一批来喷，不是每帧喷 —— 每帧 4 颗的话场上会同时挂着近 200 颗火粒子，
  // 而 fire 粒子每帧都要和每一只僵尸做一次碰撞，那是白烧的性能。
  if (def === SUPER_WEAPONS.firestorm && keys.Space) {
    fx.fireT = (fx.fireT || 0) - dt;
    if (fx.fireT <= 0) {
      fx.fireT = 0.05;
      for (const dir of [-1, 1]) {
        const bx = player.x + dir * (110 + rand(0, 70));
        for (let k = 0; k < 3; k++) {
          parts.push({ type: 'fire', x: bx, y: GROUND - rand(4, 96), vx: dir * rand(90, 280), vy: rand(-90, -10),
                       life: rand(0.4, 0.75), max: 0.75, size: rand(9, 17), t: 0 });
        }
      }
    }
  }
  // —— 黑洞：吸引 + 到点炸开 ——
  if (fx.holes.length) {
    for (let i = fx.holes.length - 1; i >= 0; i--) {
      const h = fx.holes[i];
      h.t -= dt;
      for (const z of zombies) {
        const dx = h.x - z.x;
        if (Math.abs(dx) > h.r) continue;
        z.x += Math.sign(dx) * Math.min(Math.abs(dx), 320 * dt * (1 - Math.abs(dx) / h.r));
      }
      if (h.t <= 0) {
        fx.holes.splice(i, 1);
        explodeAt(h.x, h.z, { r: 230, dmg: 130 }, GROUND - h.z);
      }
    }
  }
  // —— 冰冻风暴：只留视觉计时（僵尸靠 z.freezeT 静止）——
  if (fx.iceT > 0) fx.iceT -= dt;

  if (su.t <= 0) {
    G.banner = def.name + ' 用完了'; G.bannerT = 1.6;
    SFX.deny();
    dropSuper();
  }
}

// ============================== 8 种效果：开火 ==============================
// 由 attack() 调用 —— 只有 auto:false 的才会走到这里
function fireSuper(w) {
  const su = player.super;
  if (!su) return;
  const fx = G.superFx || (resetSuperFx(su.id), G.superFx);
  const id = su.id;
  const dir = player.facing;
  w.cd = w.def.rate;

  // ① 轨道激光 —— 按住持续输出，光柱自己横扫
  if (id === 'orbital') {
    const bx = player.x + dir * fx.beamD;
    let hit = 0;
    eachZombieRev((z, j) => {
      if (Math.abs(z.x - bx) > 46 + z.w / 2) return;
      damageZombie(z, j, 190 * w.def.rate, true, 0, true, true);
      hit++;
    });
    for (let j = props.length - 1; j >= 0; j--) {
      const p = props[j];
      if (p.def.solid && Math.abs(p.x - bx) < 34 + p.w / 2) damageProp(p, j, 190 * w.def.rate);
    }
    if (hit) G.shake = Math.min(G.shake + 0.5, 6);
    return;
  }

  // ② 火焰风暴 —— 粒子本体在 updateSuper 里（那段才是伤害来源），
  // 这里只负责音效和"点着了"的状态：射速 2/秒，所以声音不会糊成一片。
  if (id === 'firestorm') {
    SFX.flamer();
    for (const z of zombies) {
      // `z.burnT || 0` —— 新刷出来的僵尸没有这个字段，
      // Math.max(undefined, 1.6) 是 NaN，而 NaN > 0 为假，就永远烧不起来。
      if (Math.abs(z.x - player.x) < 230) z.burnT = Math.max(z.burnT || 0, 1.6);
    }
    G.shake = Math.min(G.shake + 1.2, 6);
    return;
  }

  // ③ 黑洞发生器
  if (id === 'blackhole') {
    if (fx.holes.length >= 2) return;
    const x = clamp(player.x + dir * 260, 80, G.fenceX - 40);
    fx.holes.push({ x, z: player.z, t: 2.6, max: 2.6, r: 430 });
    SFX.vortex();
    G.shake = Math.min(G.shake + 4, 10);
    return;
  }

  // ④ 雷神之锤 —— 跳跃 20 个目标的闪电链
  if (id === 'thor') {
    SFX.thunder();
    const sx = player.x + Math.cos(player.aim) * 30;
    const sy = GROUND - player.h + 34 - player.z;
    const cands = zombies.filter(z => (z.x - player.x) * dir > -40)
                         .map(z => ({ z, d: Math.hypot(z.x - player.x, (z.y() - sy) * 0.6) }))
                         .sort((a, b) => a.d - b.d).slice(0, 20);
    const pts = [[sx, sy]];
    let px = sx, py = sy;
    const hitSet = [];
    for (const c of cands) {
      const zx = c.z.x, zy = c.z.y() - c.z.h / 2;
      // 折线中间打个拐点，看起来才像电弧而不像折尺
      pts.push([(px + zx) / 2 + rand(-26, 26), (py + zy) / 2 + rand(-34, 34)]);
      pts.push([zx, zy]);
      hitSet.push(c.z);
      px = zx; py = zy;
    }
    if (!cands.length) pts.push([sx + dir * 400, sy]);
    arcs.push({ pts, life: 0.3, max: 0.3 });
    eachZombieRev((z, j) => {
      const i = hitSet.indexOf(z);
      if (i < 0) return;
      damageZombie(z, j, 95, false, (z.x > player.x ? 1 : -1) * (160 - i * 6), true);
    });
    G.shake = Math.min(G.shake + 9, 20); G.flashT = 0.16;
    return;
  }

  // ⑤ 冰冻风暴 —— 全屏冻住 8 秒
  if (id === 'ice') {
    SFX.freeze();
    for (const z of zombies) z.freezeT = 8;
    fx.iceT = 8;
    G.flashT = 0.4; G.shake = Math.min(G.shake + 5, 12);
    G.banner = '全 场 冻 结'; G.bannerT = 1.6;
    return;
  }

  // ⑥ 核弹 —— 一次性
  if (id === 'nuke') {
    SFX.nuke();
    G.flashT = 1.4; G.shake = 26;
    eachZombieRev((z, j) => { damageZombie(z, j, 99999, false, (z.x > player.x ? 1 : -1) * 500, true); });
    for (let j = props.length - 1; j >= 0; j--) damageProp(props[j], j, 99999);
    for (const h of houses) if (h.type !== 'safe') damageHouse(h, 220);
    player.invuln = Math.max(player.invuln, 1.0);   // 自己别被自己的核弹送走
    decals.push({ x: player.x, r: 120 });
    parts.push({ type: 'nukeRing', x: player.x, y: GROUND - 40 - player.z, vx: 0, vy: 0, life: 0.9, max: 0.9, size: 40 });
    texts.push({ x: player.x, y: GROUND - 160, txt: '核 爆', col: '#ffffff', life: 1.4, max: 1.4, vy: -30 });
    dropSuper();
    return;
  }
}

// —— 自动型 ①：加特林直升机 ——
function updateHeli(dt) {
  const fx = G.superFx;
  fx.shotT -= dt;
  fx.rotorT = (fx.rotorT || 0) - dt;
  if (fx.rotorT <= 0) { fx.rotorT = 0.1; SFX.rotor(); }
  if (fx.shotT > 0) return;
  fx.shotT = SUPER_WEAPONS.heli.rate;
  // 找最近的僵尸，从空中朝它打一发（子弹自带"高处压回腰线"的弹道，见 09-combat.js）
  let best = null, bd = 1e9;
  for (const z of zombies) {
    const d = Math.abs(z.x - player.x);
    if (d < bd && d > 60) { bd = d; best = z; }
  }
  const hx = player.x - player.facing * 60;
  const hz = GROUND - 300;
  const dir = best ? Math.sign(best.x - hx) || 1 : player.facing;
  // 屏幕坐标 y 越小越高。从这里压回腰线 GUN_Y 需要往下走 GUN_Y - hz（正数）——
  // 写成 hz - GUN_Y 会让子弹朝天飞，伤害永远是 0。
  const elev = GUN_Y - hz;
  bullets.push({
    x: hx, y: hz - player.z * 0, vx: dir * 1150,
    vy: elev / FALL_DIST * 1150, grav: 0, dmg: 30, life: 1.2,
    air: true,                                       // 从天而降 = 打头
    noArmor: true, crit: 0, critMul: 2, pierce: 0, hitSet: null,
  });
  SFX.gatling();
  G.shake = Math.min(G.shake + 0.7, 8);
  parts.push({ type: 'spark', x: hx + dir * 24, y: hz, vx: rand(-70, 70), vy: rand(-70, 70), life: 0.14, max: 0.14, size: 3 });
}

// —— 自动型 ②：无人机群 ——
function updateDrones(dt) {
  const fx = G.superFx;
  fx.shotT -= dt;
  if (fx.shotT > 0) return;
  fx.shotT = SUPER_WEAPONS.drones.rate;
  const n = 5;
  let fired = 0;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + G.time * 1.6;
    const dx = player.x + Math.cos(a) * 78;
    const dy = GROUND - 150 - player.z + Math.sin(a) * 34;
    const elev = GUN_Y - dy;                         // 同上：往下压才是正的
    // 谁近就打谁，找不到就按朝向盲射
    let best = null, bd = 1e9;
    for (const z of zombies) {
      const d = Math.hypot(z.x - dx, (z.y() - 40) - dy);
      if (d < bd) { bd = d; best = z; }
    }
    const dir = best ? (Math.sign(best.x - dx) || 1) : player.facing;
    bullets.push({
      x: dx, y: dy, vx: dir * 900, vy: elev / FALL_DIST * 900, grav: 0, dmg: 19, life: 1.0,
      air: false, noArmor: false, crit: 0.1, critMul: 2, pierce: 0, hitSet: null,
    });
    fired++;
  }
  if (fired) SFX.drone();
}

// ============================== 绘制 ==============================
function drawSuper() {
  const su = player.super;
  if (!su) return;
  const fx = G.superFx;
  const id = su.id;
  const bob = Math.sin(G.time * 3) * 3;

  // ① 轨道激光：一道贯穿天地的光柱 + 脚底灼烧环
  if (id === 'orbital') {
    const bx = (player.x + player.facing * fx.beamD) - cam.x + VW / 2;
    const flick = 0.72 + Math.sin(G.time * 40) * 0.28;
    const g = ctx.createLinearGradient(0, 0, 0, GROUND);
    g.addColorStop(0, 'rgba(140,232,255,0)');
    g.addColorStop(0.25, `rgba(140,232,255,${0.55 * flick})`);
    g.addColorStop(1, `rgba(210,250,255,${0.95 * flick})`);
    ctx.fillStyle = g;
    ctx.fillRect(bx - 34, -20, 68, GROUND + 20);
    ctx.fillStyle = `rgba(255,255,255,${0.9 * flick})`;
    ctx.fillRect(bx - 11, -20, 22, GROUND + 20);
    ctx.fillStyle = 'rgba(140,232,255,0.5)';
    ctx.beginPath(); ctx.ellipse(bx, GROUND - 4, 62, 15, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath(); ctx.ellipse(bx, GROUND - 4, 26, 7, 0, 0, TAU); ctx.fill();
  }

  // ② 加特林直升机
  if (id === 'heli') {
    const hx = (player.x - player.facing * 60) - cam.x + VW / 2;
    const hy = (GROUND - 300) - player.z + bob;
    ctx.save(); ctx.translate(hx, hy);
    ctx.fillStyle = '#2a3038';
    ctx.beginPath(); ctx.ellipse(0, 0, 52, 20, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#3c4650';
    ctx.beginPath(); ctx.ellipse(26, -2, 22, 13, 0, 0, TAU); ctx.fill();    // 机头
    ctx.fillStyle = '#8ce8ff';
    ctx.beginPath(); ctx.ellipse(34, -2, 8, 6, 0, 0, TAU); ctx.fill();      // 座舱玻璃
    ctx.fillStyle = '#1a1e24';
    ctx.fillRect(-56, -6, 26, 9);                                            // 尾梁
    ctx.fillRect(-62, -16, 7, 20);                                           // 尾桨
    ctx.fillStyle = '#5a6470';
    ctx.fillRect(-14, 16, 6, 26);                                            // 起落橇
    ctx.fillRect(8, 16, 6, 26);
    // 机炮
    ctx.fillStyle = '#20242a';
    ctx.fillRect(-6, 14, 34, 8);
    // 主旋翼：半透明扫过的圆盘 + 两道桨叶
    ctx.fillStyle = 'rgba(200,220,255,0.10)';
    ctx.beginPath(); ctx.ellipse(0, -20, 78, 9, 0, 0, TAU); ctx.fill();
    const ra = G.time * 26;
    ctx.strokeStyle = 'rgba(230,240,255,0.55)'; ctx.lineWidth = 3;
    for (let i = 0; i < 2; i++) {
      const a = ra + i * Math.PI;
      ctx.beginPath(); ctx.moveTo(0, -20);
      ctx.lineTo(Math.cos(a) * 74, -20 + Math.sin(a) * 9); ctx.stroke();
    }
    ctx.restore();
    // 曳光弹
    if (G.superFx.shotT > SUPER_WEAPONS.heli.rate - 0.04) {
      ctx.strokeStyle = 'rgba(255,225,140,0.9)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(hx - player.facing * 8, hy + 18);
      ctx.lineTo(hx + player.facing * 90, hy + 18 + 22); ctx.stroke();
    }
  }

  // ③ 火焰风暴：底部横向的火光
  if (id === 'firestorm' && keys.Space) {
    ctx.fillStyle = 'rgba(255,140,40,0.12)';
    ctx.fillRect(0, GROUND - 150, VW, 150);
  }

  // ④ 黑洞
  for (const h of fx.holes) {
    const hx = h.x - cam.x + VW / 2, hy = GROUND - 60 - h.z;
    const k = h.t / h.max;
    const r = 34 + Math.sin(G.time * 12) * 4 + (1 - k) * 26;
    ctx.fillStyle = 'rgba(20,8,30,0.9)';
    ctx.beginPath(); ctx.arc(hx, hy, r, 0, TAU); ctx.fill();
    ctx.strokeStyle = `rgba(180,138,224,${0.5 + 0.5 * Math.sin(G.time * 18)})`; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(hx, hy, r + 8, 0, TAU); ctx.stroke();
    // 吸积盘：几圈往里收的粒子
    for (let i = 0; i < 10; i++) {
      const a = G.time * 4 + i * 0.63;
      const rr = r + 40 + ((i * 13 + G.time * 90) % 100);
      ctx.fillStyle = 'rgba(216,180,255,0.5)';
      ctx.beginPath(); ctx.arc(hx + Math.cos(a) * rr, hy + Math.sin(a) * rr * 0.6, 2.4, 0, TAU); ctx.fill();
    }
  }

  // ⑤ 冰冻风暴：全屏蓝调 + 屏幕角上的霜
  if (fx.iceT > 0) {
    ctx.fillStyle = `rgba(120,200,255,${0.14 * clamp(fx.iceT / 8, 0, 1)})`;
    ctx.fillRect(0, 0, VW, VH);
    ctx.strokeStyle = 'rgba(200,240,255,0.45)'; ctx.lineWidth = 2;
    for (const c of [[0, 0, 1, 1], [VW, 0, -1, 1], [0, VH, 1, -1], [VW, VH, -1, -1]]) {
      ctx.beginPath();
      ctx.moveTo(c[0], c[1]);
      ctx.lineTo(c[0] + c[2] * 190, c[1]);
      ctx.lineTo(c[0], c[1] + c[3] * 150);
      ctx.stroke();
    }
  }

  // ⑥ 无人机群：5 架环绕
  if (id === 'drones') {
    const n = 5;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + G.time * 1.6;
      const dx = (player.x - cam.x + VW / 2) + Math.cos(a) * 78;
      const dy = (GROUND - 150 - player.z) + Math.sin(a) * 34;
      ctx.save(); ctx.translate(dx, dy);
      ctx.fillStyle = '#3a4a38';
      ctx.fillRect(-11, -5, 22, 10);
      ctx.fillStyle = '#9ab87a';
      ctx.beginPath(); ctx.arc(0, 2, 4, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(200,230,180,0.7)'; ctx.lineWidth = 2;
      const ra = G.time * 30 + i;
      for (const s of [-1, 1]) {
        ctx.beginPath(); ctx.moveTo(s * 12, -4);
        ctx.lineTo(s * (12 + Math.cos(ra) * 7), -4 + Math.sin(ra) * 4); ctx.stroke();
      }
      ctx.restore();
    }
  }
}

// 空投箱：降落伞 + 铁箱 + 落地后的黄光
function drawDrop() {
  const d = G.drop;
  if (!d) return;
  const x = d.x - cam.x + VW / 2, y = d.y;
  if (x < -120 || x > VW + 120) return;
  const pulse = 0.5 + 0.5 * Math.sin(G.time * 6);
  if (d.landed) {
    ctx.fillStyle = `rgba(232,197,89,${0.18 + 0.16 * pulse})`;
    ctx.beginPath(); ctx.ellipse(x, GROUND - 6, 62, 18, 0, 0, TAU); ctx.fill();
  } else {
    // 伞盖
    ctx.fillStyle = 'rgba(232,240,220,0.92)';
    ctx.beginPath();
    ctx.moveTo(x - 46, y - 56);
    ctx.quadraticCurveTo(x, y - 116, x + 46, y - 56);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(150,160,140,0.9)'; ctx.lineWidth = 1.5;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath(); ctx.moveTo(x, y - 90);
      ctx.lineTo(x + i * 46, y - 56); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(210,215,200,0.85)';
    ctx.beginPath();
    ctx.moveTo(x - 44, y - 57); ctx.lineTo(x - 15, y - 16);
    ctx.moveTo(x + 44, y - 57); ctx.lineTo(x + 15, y - 16);
    ctx.stroke();
  }
  // 铁箱
  ctx.fillStyle = '#3c4450';
  ctx.fillRect(x - 17, y - 18, 34, 32);
  ctx.fillStyle = '#59626e';
  ctx.fillRect(x - 17, y - 18, 34, 7);
  ctx.strokeStyle = '#e8c559'; ctx.lineWidth = 2;
  ctx.strokeRect(x - 16.5, y - 17.5, 33, 31);
  // 箱面的十字标记
  ctx.fillStyle = '#e8c559';
  ctx.fillRect(x - 9, y - 6, 18, 4);
  ctx.fillRect(x - 2, y - 13, 4, 18);
  // 提示
  if (d.landed && Math.abs(player.x - d.x) < 46) {
    ctx.textAlign = 'center';
    ctx.font = 'bold 13px "Microsoft YaHei", sans-serif';
    ctx.fillStyle = `rgba(232,197,89,${0.6 + 0.4 * pulse})`;
    ctx.fillText('[ E ] 打开补给箱 · ' + SUPER_WEAPONS[d.id].name, x, y - 34);
  }
}
