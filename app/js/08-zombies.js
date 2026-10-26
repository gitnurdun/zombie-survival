// js/08-zombies.js —— 由 tools/split.js 从单文件版拆出。
// 分段：生成僵尸 · 僵尸投掷物 / 地面危险区

'use strict';
// ============================== 生成僵尸 ==============================
function spawnZombie(type) {
  const t = ZTYPES[type];
  const side = Math.random() < 0.5 ? -1 : 1;
  let x = player.x + side * (VW / 2 + rand(60, 200));
  if (x < 60) x = player.x + VW / 2 + rand(60, 200);
  if (x > WORLD_W - 60) x = player.x - VW / 2 - rand(60, 200);
  x = clamp(x, 60, WORLD_W - 60);
  const hpScale = 1 + (G.wave - 1) * 0.13;
  // 上层路段上也会有僵尸 —— 该位置有高台时，45% 概率直接刷在上面。
  // 高台上的僵尸会照常朝玩家走，走到边缘就掉下来，形成"从天而降"的压迫感。
  const topF = floorAt(x, 1e9) || floors[0];
  const zf = (topF.z > 0 && Math.random() < 0.45) ? topF : floors[0];

  // 词缀：第 1 关基本没有，越往后越常见的精英怪
  const pk = clamp(x / (G.fenceX || 1), 0, 1);
  const af = t.boss ? null : rollAffix(G.wave, pk);
  const A = af ? AFFIXES[af] : null;
  const hpM = (A ? A.hpMul : 1) * hpScale * inf().hpMul;
  const sc = A && A.scale ? A.scale : 1;

  const z = {
    type, def: Object.assign({}, t), x, z: zf.z, vz: 0, onGround: true, floor: zf,
    w: t.w * sc, h: t.h * sc,
    affix: af, shield: A && A.shield ? A.shield : 0,
    hp: t.hp * hpM, maxHp: t.hp * hpM,
    spd: t.spd * (A ? A.spdMul : 1) * (G.wmods ? G.wmods.spdMul : 1) * inf().spdMul * rand(0.9, 1.1) * (1 + (G.wave - 1) * 0.015),
    dir: -side, walkT: rand(0, TAU), atkT: rand(0.3, 1), hitT: 0, burn: 0, burnT: 0,
    vy: 0, wob: rand(0, TAU),
    boredT: 0, poundLeft: undefined,   // 砸屋状态：砸够了就去游走（见 updateZombies）
    fuse: 0, shootT: undefined, pounceT: undefined, lungeT: 0, lungeDir: 1,   // 各类型的特殊行为
  };
  z.y = () => GROUND - z.z;
  S.seen.z[type] = 1;
  zombies.push(z);
}
// —— 刷怪：不再是"波次"，改成按推进距离收紧难度 ——
// 越往前走刷得越快、同屏越多、重甲和巨型越早出现。越过栅栏后彻底停刷。
// 从「本关已解锁」的类型里按权重抽。看不到的类型根本不会出现 ——
// 第 1 关只有村民僵尸，之后每关逐步解锁新敌人。
function pickZombieType(p, level) {
  const pool = [];
  let total = 0;
  for (const id in ZSPAWN) {
    if (ZTYPES[id].from > level) continue;
    const s = ZSPAWN[id];
    const w = Math.max(0.5, s.w + s.ramp * p);
    pool.push([id, w]);
    total += w;
  }
  if (!pool.length) return 'normal';
  let r = Math.random() * total;
  for (const [id, w] of pool) { r -= w; if (r <= 0) return id; }
  return pool[pool.length - 1][0];
}
function updateSpawner(dt) {
  if (G.noWave || G.cleared || G.state !== 'play') return;
  if (G.boss) return;          // Boss 战期间不刷杂兵 —— 它会自己召唤
  const p = clamp(player.x / G.fenceX, 0, 1);       // 0 = 起点，1 = 栅栏
  // 噪音会把僵尸引过来：刷怪间隔最多缩短 35%，同屏上限最多 +6。
  // 这就是「打还是不打」的实际代价 —— 火力全开等于把敌人叫过来。
  const nk = clamp((G.noise || 0) / NOISE_MAX, 0, 1);
  G.spawnT -= dt;
  if (G.spawnT > 0) return;
  G.spawnT = lerp(1.55, 0.42, p) * inf().spawnMul * (1 - nk * 0.35) * rand(0.75, 1.25);
  if (zombies.length >= Math.round(lerp(10, 26, p) + nk * 6)) return;
  spawnZombie(pickZombieType(p, G.wave));
}
// —— 推进：越过栅栏 = 本关结束（停刷、僵尸散开），再往前走到货架 ——
function updateProgress(dt) {
  const m = G.map || MAPS[0];
  if (!G.cleared && player.x >= G.fenceX) {
    // Boss 关：栅栏是锁死的 —— 必须先干掉它。这里把玩家挡在栅栏前。
    if (m.boss && !G.bossDone) {
      player.x = G.fenceX - 30;
      player.vx = 0;
      if (!G.boss) { spawnBoss(); G.banner = '栅 栏 锁 死 了'; G.bannerT = 2.6; }
      return;
    }
    G.cleared = true;
    G.banner = '已抵达安全区 · 不再有僵尸'; G.bannerT = 3;
    SFX.clear(); SFX.wave();
    for (const z of zombies) z.boredT = 999;        // 让场上的僵尸全部散开
  }
  if (G.cleared && !G.shelfOpened && player.x >= G.shelfX - 70) {
    G.shelfOpened = true;
    openShelf();
  }
}
// 兼容旧测试的入口：只重置刷怪计时并切回游戏中
function startWave(n) {
  G.wave = n;
  G.spawnT = 0.6;
  G.state = 'play';
  hide('menu'); hide('shelf'); hide('result'); hide('pause'); hide('levels');
  G.banner = '第 ' + n + ' 关 · 走到街道尽头的栅栏'; G.bannerT = 2.6;
  SFX.wave();
}

// ============================== 僵尸投掷物 / 地面危险区 ==============================
// 酸液喷吐者、燃烧者用抛物线把东西扔过来；落地后留下一片持续伤害的地面区域。
// 地面危险区是跳跃除爆头之外的另一个用途 —— 跳过去就没事。
const PROJ_GRAV = 900;
function throwAt(z, tx, ty, rg) {
  const sx = z.x + z.dir * 22, sy = z.y() - z.h * 0.78;
  let dx = tx - sx;
  let T = Math.max(0.4, Math.abs(dx) / rg.spd);            // 飞行时间
  if (rg.lead) {
    // 骨刺投手：朝「你将会在的地方」扔，不是朝你现在的位置。
    // 匀速直线跑必中 —— 想躲只能变向或者起跳，这就是它和其它远程僵尸的区别。
    tx += (player.vx || 0) * T;
    dx = tx - sx;
    T = Math.max(0.4, Math.abs(dx) / rg.spd);
  }
  zprojs.push({
    elem: rg.elem, x: sx, y: sy, t: 0, dmg: rg.dmg, spin: rand(0, TAU),
    vx: dx / T,
    vy: (ty - sy) / T - 0.5 * PROJ_GRAV * T,               // 抵消重力，T 秒后正好落到目标高度
  });
  SFX.spit();
}
function spillHazard(q) {
  // 骨刺是硬的，落地不留下任何东西 —— 没有酸池、没有火带，纯粹就是一根投掷物
  if (q.elem === 'bone') {
    SFX.land();
    for (let k = 0; k < 6; k++) {
      parts.push({ type: 'spark', x: q.x, y: GROUND - 3, vx: rand(-140, 140), vy: rand(-190, -40),
                   grav: 800, life: rand(0.25, 0.5), max: 0.5, size: rand(2, 4) });
    }
    return;
  }
  hazards.push({
    type: q.elem === 'fire' ? 'fire' : 'acid',
    x: q.x, z: 0, r: 54, t: 0, tick: 0,
    life: q.elem === 'fire' ? 4.5 : 6.5,
  });
  for (let k = 0; k < 10; k++) {
    parts.push({
      type: q.elem === 'fire' ? 'fire' : 'spark',
      x: q.x + rand(-14, 14), y: GROUND - rand(0, 10),
      vx: rand(-90, 90), vy: rand(-160, -30),
      grav: q.elem === 'fire' ? 0 : 700,
      life: rand(0.3, 0.7), max: 0.7, size: rand(3, 8), t: 0,
    });
  }
  SFX.land();
}
function updateZProj(dt) {
  for (let i = zprojs.length - 1; i >= 0; i--) {
    const q = zprojs[i];
    q.t += dt;
    q.x += q.vx * dt; q.y += q.vy * dt;
    q.vy += PROJ_GRAV * dt;
    q.spin += dt * 9;
    if (q.t > 7 || q.x < 20 || q.x > WORLD_W - 20) { zprojs.splice(i, 1); continue; }
    const py = GROUND - player.z - 44;
    if (!player.inside && Math.abs(q.x - player.x) < 26 && Math.abs(q.y - py) < 52) {
      hurtPlayer(q.dmg, q.vx > 0 ? 110 : -110);
      spillHazard(q);
      zprojs.splice(i, 1);
      continue;
    }
    if (q.y >= GROUND - 4) { spillHazard(q); zprojs.splice(i, 1); }
  }
  // 地面危险区：每 0.45 秒结算一次伤害（不能用每帧伤害，hurtPlayer 会被反复触发）
  for (let i = hazards.length - 1; i >= 0; i--) {
    const hz = hazards[i];
    hz.life -= dt; hz.tick -= dt; hz.t += dt;
    if (hz.life <= 0) { hazards.splice(i, 1); continue; }
    // 毒雾会慢慢扩散（rMax 由腐胀胖尸定义）——
    // 站在里面等它散掉是不行的，只会越等越大。
    if (hz.rMax && hz.r < hz.rMax) hz.r = Math.min(hz.rMax, hz.r + 26 * dt);
    if (hz.tick <= 0 && !player.inside &&
        Math.abs(player.x - hz.x) < hz.r * 0.85 && Math.abs(player.z - hz.z) < 44) {
      hz.tick = 0.45;
      hurtPlayer(hz.dmg !== undefined ? hz.dmg : (hz.type === 'fire' ? 7 : 6), 0);
    }
  }
}
// ============================== 光环：尖叫者 / 护士尸 ==============================
// 每帧一次 O(n²) 扫描。同屏上限 26~32 只，n² 也就一千次距离比较 ——
// 比给每只僵尸各写一套"找邻居"的缓存简单得多，也不值得为它建空间索引。
function updateAuras(dt) {
  for (const s of zombies) {
    const a = s.def.aura;
    if (!a) continue;
    for (const z of zombies) {
      if (z === s || Math.abs(z.x - s.x) > a.r) continue;
      if (a.type === 'heal') {
        if (z.hp < z.maxHp) { z.hp = Math.min(z.maxHp, z.hp + a.v * dt); z.healT = 0.15; }
      } else if (a.type === 'haste') {
        // 每帧续一次 0.25 秒的标记 —— 走出范围 0.25 秒后自动失效，
        // 不用维护"谁在谁的光环里"的进出名单。
        z.hasteT = 0.25; z.hasteMul = 1 + a.v;
      }
    }
    if (s.def.shriek) {
      s.shriekT = (s.shriekT === undefined ? rand(0.5, 1.6) : s.shriekT) - dt;
      if (s.shriekT <= 0) {
        s.shriekT = s.def.shriek.cd * rand(0.85, 1.2);
        SFX.shriek();
        // 音波环只是个视觉：真正的作用范围是 a.r
        for (let k = 0; k < 3; k++) {
          parts.push({ type: 'spark', x: s.x, y: s.y() - s.h * 0.8, vx: 0, vy: -rand(60, 130),
                       life: rand(0.3, 0.6), max: 0.6, size: rand(3, 6) });
        }
      }
    }
  }
}
// 爆炸效果本体（自爆尸和「爆裂的」词缀共用）。
// 不负责 splice —— 调用方处理。depth 用来挡住连环爆炸的递归。
let boomDepth = 0;
function explodeAt(x, zz, e, y0) {
  SFX.boom();
  G.shake = Math.min(G.shake + 18, 22);
  const fy = y0 === undefined ? GROUND - zz : y0;
  for (let k = 0; k < 34; k++) {
    parts.push({ type: 'fire', x: x + rand(-10, 10), y: fy - rand(0, 40), vx: rand(-360, 360), vy: rand(-380, 60), life: rand(0.25, 0.55), max: 0.55, size: rand(7, 14), t: 0 });
  }
  for (let k = 0; k < 20; k++) {
    parts.push({ type: 'blood', x, y: fy - rand(0, 40), vx: rand(-260, 260), vy: rand(-320, -40), grav: 800, life: rand(0.4, 0.9), max: 0.9, size: rand(2, 5) });
  }
  decals.push({ x, r: 34 });
  const d = Math.hypot(player.x - x, (player.z - zz) * 0.7);
  if (d < e.r && !player.inside) hurtPlayer(e.dmg * (1 - d / e.r * 0.5), (player.x > x ? 1 : -1) * 240);
  if (boomDepth > 4) return;
  boomDepth++;
  // boomDepth 挡住的主要是「爆裂的炸爆裂的」，但递归深度到上限之后仍然会
  // 在更深的帧里继续 splice —— 所以这里同样要走 eachZombieRev
  eachZombieRev((o, j) => {
    if (Math.hypot(o.x - x, o.z - zz) < e.r) damageZombie(o, j, e.dmg * 0.6, false, (o.x > x ? 1 : -1) * 200);
  });
  for (let j = props.length - 1; j >= 0; j--) {
    const p = props[j];
    if (p.def.solid && Math.hypot(p.x - x, p.z - zz) < e.r) damageProp(p, j, e.dmg);
  }
  boomDepth--;
}
// 自爆尸
function explodeZombie(z, i) {
  zombies.splice(i, 1);
  explodeAt(z.x, z.z, z.def.explode, z.y());
}
// ⚠ 遍历僵尸并可能打死它的时候，一定要用这个，不要裸写
//     for (let j = zombies.length - 1; j >= 0; j--) { const z = zombies[j]; ... }
//
// 原因：damageZombie → killZombie 之后，「爆裂的」词缀 / 自爆尸 / Boss 会**连锁爆炸**，
// 那些爆炸在更深的调用栈里又 splice 好几次，其中一些索引比外层循环手里的 j 还小。
// 数组于是瞬间缩到比 j 还短，下一次 zombies[j] 就是 undefined ——
// 实测是 `TypeError: Cannot read properties of undefined (reading 'y')`，整局游戏直接卡死。
// （触发条件：被烧死的那只正好挂在数组高位、而且它是「爆裂的」。）
//
// 下面这个函数每一步都重新读 zombies[i]，所以传出去的 i 永远等于该僵尸的真实下标，
// splice 不会删错人。数组缩水后可能漏掉或重复访问个别元素 —— 下一帧会补上，无所谓。
// 安全遍历 —— 这个循环**允许** fn 随便 splice，靠的就是每轮重读。
function eachZombieRev(fn) {
  for (let i = zombies.length - 1; i >= 0; i--) {
    const z = zombies[i];
    if (z) fn(z, i);
  }
}

function damageZombie(z, i, dmg, headshot, kb, noArmor, isBullet) {
  // 「带盾的」词缀：盾没破之前伤害完全进不去（破盾那一下也不吃伤害，只是盾碎）
  if (z.shield > 0) {
    z.shield -= dmg;
    z.hitT = 0.08;
    if (z.shield <= 0) {
      SFX.melee();
      texts.push({ x: z.x, y: z.y() - z.h - 14, txt: '破盾!', col: '#a8c8ff', life: 0.7, max: 0.7, vy: -60 });
      for (let k = 0; k < 16; k++) {
        parts.push({ type: 'spark', x: z.x, y: z.y() - z.h * 0.6, vx: rand(-260, 260), vy: rand(-240, -40), grav: 700, life: rand(0.3, 0.7), max: 0.7, size: rand(2, 4) });
      }
      G.shake = Math.min(G.shake + 5, 12);
    } else {
      SFX.hit();
      texts.push({ x: z.x, y: z.y() - z.h - 14, txt: '-' + Math.round(dmg), col: '#8ab0e0', life: 0.4, max: 0.4, vy: -40 });
    }
    return;
  }
  // 重甲尸：正面弹开子弹。跳射爆头、或者带 noArmor 的破甲武器（消防斧/特斯拉/等离子）才打得进去。
  // 近战、火焰、爆炸不算"正面飞来的子弹"，照常结算 —— 所以就算只有木棍也不是完全打不动。
  if (z.def.armor && isBullet && !headshot && !noArmor) {
    z.hitT = 0.06;
    texts.push({ x: z.x, y: z.y() - z.h - 14, txt: '铛! 弹开了', col: '#b8c0c8', life: 0.55, max: 0.55, vy: -50 });
    for (let k = 0; k < 4; k++) {
      parts.push({ type: 'spark', x: z.x + rand(-9, 9), y: z.y() - z.h * 0.6, vx: rand(50, 190) * (kb >= 0 ? -1 : 1), vy: rand(-150, -20), grav: 700, life: 0.25, max: 0.25, size: 2.2 });
    }
    SFX.hit();
    return;
  }
  const d = headshot ? dmg * 2 : dmg;
  z.hp -= d;
  z.hitT = 0.09;
  z.vy = (z.vy || 0) + (kb ? kb * 0.4 * z.def.kb : 0);
  texts.push({ x: z.x, y: z.y() - z.h - 14, txt: headshot ? '爆头! -' + Math.round(d) : '-' + Math.round(d), col: headshot ? '#ffcc40' : '#ff8878', life: 0.7, max: 0.7, vy: -60 });
  const by = z.y() - z.h * 0.7;
  for (let p = 0; p < (headshot ? 10 : 5); p++) {
    parts.push({ type: 'blood', x: z.x + rand(-8, 8), y: by + rand(-10, 10), vx: rand(-140, 140) + (kb ? kb * 0.3 : 0), vy: rand(-220, -40), grav: 800, life: rand(0.4, 0.9), max: 0.9, size: rand(2, 4.5) });
  }
  SFX.hit();
  if (headshot) SFX.head();
  if (z.hp <= 0) killZombie(z, i, headshot);
}
function killZombie(z, i, headshot) {
  if (z.isBoss) { zombies.splice(i, 1); player.kills++; onBossDefeated(z); return; }
  // 先移出数组再处理效果 —— 爆炸会按索引伤到其他僵尸，这里必须先把自己摘掉，
  // 否则索引会错位。（早先写成"爆裂的交给 explodeZombie 处理 splice"，结果它根本没被移除，
  // 变成一只血量归零却还在走的僵尸。）
  zombies.splice(i, 1);
  const volatileKill = z.affix === 'volatile';
  player.kills++;

  // —— 连杀：3 秒内连续击杀累加，每 5 连把金币掉落抬高一档 ——
  G.combo = (G.combo || 0) + 1;
  G.comboT = 3;
  G.bestCombo = Math.max(G.bestCombo || 0, G.combo);
  S.stats.bestCombo = Math.max(S.stats.bestCombo || 0, G.combo);
  // 连杀 ×「幸运儿」× 感染模式（×2 —— 这是玩家愿意打二周目的唯一理由）
  const cmul = (1 + Math.floor(G.combo / 5) * 0.35) * (P ? P.cashMul : 1) * inf().cashMul;

  const n = z.type === 'giant' ? 14 : (z.type === 'heavy' ? 6 : 3);
  for (let c = 0; c < n; c++) {
    coins.push({ x: z.x + rand(-14, 14), y: z.y() - z.h * 0.5, vy: rand(-320, -120), vx: rand(-90, 90),
                 v: Math.max(1, Math.round(z.def.cash / n * cmul)), t: 0, life: 14 });
  }
  for (let p = 0; p < (z.type === 'giant' ? 40 : 16); p++) {
    parts.push({ type: 'blood', x: z.x + rand(-12, 12), y: z.y() - z.h * rand(0.3, 0.9), vx: rand(-260, 260), vy: rand(-380, -60), grav: 800, life: rand(0.5, 1.1), max: 1.1, size: rand(2.5, 6) });
  }
  if (headshot) {
    parts.push({ type: 'head', x: z.x, y: z.y() - z.h + 12, vx: rand(-120, 120), vy: -420, grav: 900, life: 1.4, max: 1.4, size: z.w * 0.28, skin: z.def.skin, eye: z.def.eye });
  }
  if (!volatileKill) {
    parts.push({ type: 'corpse', x: z.x, y: z.y(), vx: rand(-40, 40), vy: 0, grav: 0, life: 1.3, max: 1.3, zt: z.type, dir: z.dir, w: z.w, h: z.h, skin: z.def.skin });
    decals.push({ x: z.x, r: z.type === 'giant' ? 46 : 22 + rand(0, 12) });
    if (decals.length > 260) decals.shift();
  }
  SFX.die();
  // 「拾荒者」提高掉落率
  const dk = P ? P.dropMul : 1;
  if (Math.random() < 0.045 * dk) items.push({ type: 'bat', x: z.x, y: GROUND - 40 - rand(0, 40), t: 0, life: 18 });
  if (Math.random() < 0.05 * dk) items.push({ type: 'medkit', x: z.x, y: GROUND - 18, t: 0, life: 18 });
  // 「吸血鬼」击杀回血
  if (P && P.lifesteal > 0) player.hp = Math.min(player.maxHp, player.hp + P.lifesteal);

  // —— 腐胀胖尸：死了才最危险，留一片会扩散的毒雾 ——
  if (z.def.gas) {
    hazards.push({ type: 'gas', x: z.x, z: z.z, r: z.def.gas.r, rMax: z.def.gas.rMax,
                   dmg: z.def.gas.dmg, t: 0, tick: 0, life: z.def.gas.life });
    SFX.spit();
    for (let k = 0; k < 24; k++) {
      parts.push({ type: 'spark', x: z.x + rand(-16, 16), y: z.y() - rand(0, 50),
                   vx: rand(-120, 120), vy: rand(-160, -20), grav: -30,
                   life: rand(0.6, 1.3), max: 1.3, size: rand(4, 9) });
    }
  }
  // —— 词缀的死亡效果 ——
  if (z.affix === 'burning') {
    hazards.push({ type: 'fire', x: z.x, z: z.z, r: 54, t: 0, tick: 0, life: 5 });
  } else if (volatileKill) {
    explodeAt(z.x, z.z, { r: 112, dmg: 26 }, z.y());     // 爆裂的：死后炸一圈
  }
}
function hurtPlayer(dmg, kb) {
  if (G.state !== 'play' || player.invuln > 0) return;
  player.hp -= dmg;
  player.vx += kb || 0;
  G.hurtT = 0.4;
  G.shake = Math.min(G.shake + 7, 14);
  SFX.hurt();
  if (player.hp <= 0) {
    player.hp = 0;
    if (player.bats > 0) {
      player.bats--;
      player.hp = 60;
      player.invuln = 2.5;
      G.banner = '蝙蝠救了你!';
      G.bannerT = 2;
      SFX.revive();
      for (const z of zombies) {
        z.vy = (z.x > player.x ? 1 : -1) * 420 * z.def.kb;
        z.atkT = 1.2;
      }
    } else loseLevel();
  }
}
