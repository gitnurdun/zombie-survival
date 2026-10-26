// js/06-props.js —— 由 tools/split.js 从单文件版拆出。
// 分段：场景物件

'use strict';
// ============================== 场景物件 ==============================
// 路边的杂物。solid 的能被子弹打碎并掉落补给 —— 商店不卖弹药，这是主要来源。
// 注意：水平弹道固定在 y=570，物件底边在 y=610，所以 h ≤ 40 的物件打不到，
// 草/灌木/轮胎因此一律做成纯装饰（不出现在碰撞里）。
// shape 指向 9 个绘制函数之一（plant/drum/box/slab/machine/bed/arch/sign/pod）——
// 29 种物件靠 size + col + accent 参数化，不用写 29 段绘制代码。
// solid 的物件 h 必须 ≥ 44：子弹固定在 y=570、物件底边在 y=610，矮于 40 会被直接飞过。
const PROP_KINDS = {
  // ── 纯装饰（不进碰撞）──
  grass:  { name:'杂草',     shape:'plant',  w:38, h:22,  solid:false, col:'#4e7a3a' },
  bush:   { name:'灌木',     shape:'plant',  w:60, h:42,  solid:false, col:'#4a7a38' },
  corn:   { name:'玉米秆',   shape:'plant',  w:46, h:64,  solid:false, col:'#a8b03a', tall:true },
  tire:   { name:'轮胎',     shape:'slab',   w:54, h:28,  solid:false, col:'#1e1e1e' },
  glass:  { name:'输液架',   shape:'arch',   w:30, h:70,  solid:false, col:'#b8c8d0' },
  neon:   { name:'霓虹招牌', shape:'sign',   w:52, h:100, solid:false, col:'#ff6ab0' },
  hoop:   { name:'篮球架',   shape:'arch',   w:56, h:112, solid:false, col:'#8a8a92' },
  gate:   { name:'闸机',     shape:'arch',   w:62, h:58,  solid:false, col:'#5a6068' },

  // ── 可打碎 ──
  trash:  { name:'垃圾桶',   shape:'drum',   w:38, h:56,  solid:true, hp:12, drop:'ammo',   col:'#4a5054' },
  crate:  { name:'木箱',     shape:'box',    w:46, h:50,  solid:true, hp:16, drop:'mixed',  col:'#6b5433' },
  barrel: { name:'油桶',     shape:'drum',   w:40, h:62,  solid:true, hp:22, drop:'cash',   col:'#8a3a26', explode:{ r:130, dmg:42 } },
  fuelTank:{name:'油罐',     shape:'drum',   w:56, h:84,  solid:true, hp:34, drop:'cash',   col:'#b03a20', explode:{ r:190, dmg:62 } },
  pot:    { name:'花盆',     shape:'drum',   w:34, h:46,  solid:true, hp:8,  drop:'none',   col:'#8a5a3a' },
  tomb:   { name:'墓碑',     shape:'slab',   w:44, h:58,  solid:true, hp:20, drop:'none',   col:'#6a6a70' },
  hay:    { name:'干草堆',   shape:'plant',  w:70, h:60,  solid:true, hp:20, drop:'mixed',  col:'#c8a848' },
  carWreck:{name:'报废车',   shape:'machine',w:150,h:74,  solid:true, hp:60, drop:'mixed',  col:'#5a5a62' },
  policeCar:{name:'警车',    shape:'machine',w:150,h:74,  solid:true, hp:70, drop:'ammo',   col:'#2a3a6a' },
  barrier:{ name:'路障',     shape:'slab',   w:76, h:48,  solid:true, hp:18, drop:'none',   col:'#d05a2a' },
  sandbag:{ name:'沙袋',     shape:'slab',   w:80, h:52,  solid:true, hp:26, drop:'none',   col:'#9a8a5a' },
  shelf:  { name:'货架',     shape:'box',    w:88, h:96,  solid:true, hp:24, drop:'mixed',  col:'#7a6a4a' },
  freezer:{ name:'冰柜',     shape:'machine',w:80, h:92,  solid:true, hp:30, drop:'ammo',   col:'#c8d0d4' },
  bed:    { name:'病床',     shape:'bed',    w:112,h:56,  solid:true, hp:20, drop:'medkit', col:'#c8ccd0' },
  bench:  { name:'长椅',     shape:'bed',    w:104,h:44,  solid:true, hp:18, drop:'none',   col:'#6a5a3a' },
  cabinet:{ name:'药柜',     shape:'box',    w:52, h:80,  solid:true, hp:22, drop:'medkit', col:'#c0c8c4' },
  locker: { name:'储物柜',   shape:'box',    w:54, h:88,  solid:true, hp:24, drop:'mixed',  col:'#5a6a72' },
  desk:   { name:'课桌',     shape:'box',    w:64, h:46,  solid:true, hp:14, drop:'none',   col:'#a08a5a' },
  ammoBox:{ name:'弹药箱',   shape:'box',    w:52, h:44,  solid:true, hp:16, drop:'ammo',   col:'#4a5a32' },
  pod:    { name:'培养舱',   shape:'pod',    w:56, h:120, solid:true, hp:40, drop:'medkit', col:'#3a6a7a' },
  labTable:{name:'实验台',   shape:'box',    w:92, h:56,  solid:true, hp:22, drop:'mixed',  col:'#8a9098' },
  sample: { name:'样本柜',   shape:'box',    w:50, h:84,  solid:true, hp:24, drop:'mixed',  col:'#6a7a86' },
};
// 物件的摆放已经移进 placeSegment() —— 每个路段按自己地图的 props 池来铺，
// 可打碎的按固定节奏（弹药来源不能看运气），装饰的随机撒，高台上再补一批。
function damageProp(p, i, dmg) {
  if (!p.def.solid) return;
  p.hp -= dmg;
  p.hitT = 0.1;
  if (p.hp > 0) return;
  breakProp(p, i);
}
function breakProp(p, i) {
  props.splice(i, 1);
  S.stats.propBreaks = (S.stats.propBreaks || 0) + 1;   // 「拆迁办」成就
  if (S.seen && S.seen.p) S.seen.p[p.kind] = 1;         // 图鉴解锁（老存档可能没有 p）
  // 碎片
  for (let k = 0; k < 12; k++) {
    parts.push({ type: 'spark', x: p.x + rand(-p.w / 2, p.w / 2), y: GROUND - p.z - rand(0, p.h), vx: rand(-180, 180), vy: rand(-260, -40), grav: 800, life: rand(0.4, 0.8), max: 0.8, size: rand(2, 4) });
  }
  SFX.hit();
  // 掉落
  const drop = p.def.drop;
  if (drop === 'ammo') {
    items.push({ type:'ammo', x:p.x, y: GROUND - p.z - 16, z: p.z, t:0, life:16, cat: Math.random() < 0.62 ? 'bullet' : 'cell', amt: 14 });
  } else if (drop === 'mixed') {
    const r = Math.random();
    if (r < 0.55) items.push({ type:'ammo', x:p.x, y: GROUND - p.z - 16, z:p.z, t:0, life:16, cat: Math.random()<0.62?'bullet':'cell', amt:16 });
    else if (r < 0.85) coins.push({ x:p.x, y: GROUND - p.z - 30, vy:0, vx:0, v: irand(4, 11), t:0, life:16 });
    else items.push({ type:'medkit', x:p.x, y: GROUND - p.z - 18, z:p.z, t:0, life:16 });
  } else if (drop === 'cash') {
    for (let k = 0; k < 3; k++) coins.push({ x:p.x + rand(-14,14), y: GROUND - p.z - 30, vy: rand(-160,-60), vx: rand(-60,60), v: irand(5,12), t:0, life:16 });
  }
  // 油桶：炸
  if (p.def.explode) {
    const e = p.def.explode;
    SFX.giant(); G.shake = 16;
    for (let k = 0; k < 40; k++) parts.push({ type:'fire', x:p.x, y: GROUND - p.z - 20, vx: rand(-420,420), vy: rand(-420,60), life: rand(0.3,0.6), max:0.6, size: rand(8,16), t:0 });
    // 油桶炸死一只「爆裂的」会接着连锁炸，数组会在调用栈深处被削短 —— 用 eachZombieRev
    eachZombieRev((z, j) => {
      const d = Math.hypot(z.x - p.x, z.z - p.z);
      if (d < e.r) damageZombie(z, j, e.dmg * (1 - d / e.r * 0.5), false, (z.x > p.x ? 1 : -1) * 260);
    });
  }
}
function drawProps() {
  const dark = 'rgba(0,0,0,0.45)';
  for (const p of props) {
    const sx = p.x - cam.x + VW / 2;
    if (sx < -200 || sx > VW + 200) continue;
    const c = p.def.col || '#6a6a70';
    const acc = p.def.accent || c;
    ctx.save();
    ctx.translate(sx, GROUND - p.z);
    if (p.hitT > 0) ctx.globalAlpha = 0.55;
    // 地面投影（所有物件共用）
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath(); ctx.ellipse(0, 2, p.w * 0.42, 5, 0, 0, TAU); ctx.fill();

    switch (p.def.shape) {
      case 'plant': {
        if (p.kind === 'hay') {                    // 干草堆：捆起来的草垛
          ctx.fillStyle = c;
          ctx.beginPath(); ctx.ellipse(0, -p.h * 0.45, p.w * 0.45, p.h * 0.42, 0, 0, TAU); ctx.fill();
          ctx.strokeStyle = '#7a5a20'; ctx.lineWidth = 3;
          for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.moveTo(-p.w*0.35, -p.h*0.45 + k*14); ctx.lineTo(p.w*0.35, -p.h*0.55 + k*14); ctx.stroke(); }
          ctx.fillStyle = 'rgba(255,240,180,0.25)';
          ctx.beginPath(); ctx.ellipse(-p.w*0.14, -p.h*0.62, p.w*0.2, p.h*0.14, 0, 0, TAU); ctx.fill();
          break;
        }
        const tall = p.def.tall;
        ctx.strokeStyle = c; ctx.lineWidth = tall ? 4 : 3; ctx.lineCap = 'round';
        const n = tall ? 4 : 5;
        for (let i = -(n >> 1); i <= (n >> 1); i++) {
          const bx = i * (p.w / (n + 1));
          ctx.beginPath(); ctx.moveTo(bx, 0);
          if (tall) { ctx.lineTo(bx + i * 3, -p.h + 6); ctx.stroke(); }
          else { ctx.quadraticCurveTo(bx + i * 5, -p.h * 0.6, bx + i * 9, -p.h - (i === 0 ? 6 : 0)); ctx.stroke(); }
        }
        if (p.kind === 'bush') {                   // 灌木：几个重叠的圆
          for (let i = 0; i < 3; i++) {
            ctx.fillStyle = i === 1 ? '#3f6b31' : c;
            ctx.beginPath(); ctx.arc(-p.w * 0.22 + i * p.w * 0.22, -p.h * 0.45 - (i === 1 ? 6 : 0), p.w * 0.26, 0, TAU); ctx.fill();
          }
        }
        if (tall) {                                 // 玉米：叶子 + 穗
          ctx.fillStyle = acc;
          for (let i = -1; i <= 1; i += 2) {
            ctx.beginPath(); ctx.ellipse(i * 12, -p.h * 0.6, 12, 5, i * 0.4, 0, TAU); ctx.fill();
          }
          ctx.fillStyle = '#e8d060';
          ctx.beginPath(); ctx.ellipse(0, -p.h * 0.82, 6, 14, 0, 0, TAU); ctx.fill();
        }
        break;
      }
      case 'drum': {
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.moveTo(-p.w / 2, -p.h); ctx.lineTo(p.w / 2, -p.h);
        ctx.lineTo(p.w / 2 - 4, 0); ctx.lineTo(-p.w / 2 + 4, 0);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.13)';
        ctx.fillRect(-p.w / 2 + 4, -p.h + 5, 6, p.h - 10);
        ctx.fillStyle = acc;
        ctx.fillRect(-p.w / 2 - 3, -p.h - 7, p.w + 6, 8);
        ctx.strokeStyle = dark; ctx.lineWidth = 2.5;
        ctx.strokeRect(-p.w / 2 - 3, -p.h - 7, p.w + 6, 8);
        if (p.def.explode) {
          ctx.fillStyle = '#e8c559'; ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center';
          ctx.fillText('!', 0, -p.h * 0.45);
        }
        break;
      }
      case 'box': {
        ctx.fillStyle = c; ctx.fillRect(-p.w / 2, -p.h, p.w, p.h);
        ctx.strokeStyle = dark; ctx.lineWidth = 3;
        ctx.strokeRect(-p.w / 2 + 1.5, -p.h + 1.5, p.w - 3, p.h - 3);
        ctx.strokeStyle = 'rgba(255,255,255,0.10)'; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-p.w / 2, -p.h); ctx.lineTo(p.w / 2, 0);
        ctx.moveTo(p.w / 2, -p.h); ctx.lineTo(-p.w / 2, 0);
        ctx.stroke();
        if (p.def.drop === 'medkit') {              // 药柜：白十字
          ctx.fillStyle = '#e05a5a';
          ctx.fillRect(-3, -p.h * 0.62, 6, 22); ctx.fillRect(-11, -p.h * 0.62 + 8, 22, 6);
        }
        break;
      }
      case 'slab': {
        ctx.fillStyle = c;
        if (p.kind === 'tire') {
          ctx.beginPath(); ctx.ellipse(0, -p.h / 2, p.w / 2, p.h / 2, 0, 0, TAU); ctx.fill();
          ctx.strokeStyle = dark; ctx.lineWidth = 3; ctx.stroke();
          ctx.fillStyle = 'rgba(0,0,0,0.6)';
          ctx.beginPath(); ctx.ellipse(0, -p.h / 2, p.w / 2 - 7, p.h / 2 - 6, 0, 0, TAU); ctx.fill();
        } else {
          ctx.beginPath();
          ctx.moveTo(-p.w / 2, 0); ctx.lineTo(-p.w / 2 + 5, -p.h);
          ctx.lineTo(p.w / 2 - 5, -p.h); ctx.lineTo(p.w / 2, 0);
          ctx.closePath(); ctx.fill();
          ctx.strokeStyle = dark; ctx.lineWidth = 3; ctx.stroke();
          if (p.kind === 'barrier') { ctx.fillStyle = '#f0e8d8'; for (let k = -1; k <= 1; k++) ctx.fillRect(k * 24 - 6, -p.h + 7, 12, p.h - 15); }
          if (p.kind === 'sandbag') { ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 2; for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.moveTo(k * 26, 0); ctx.lineTo(k * 26, -p.h); ctx.stroke(); } }
          if (p.kind === 'tomb') { ctx.fillStyle = 'rgba(255,255,255,0.13)'; ctx.fillRect(-p.w*0.3, -p.h*0.7, p.w*0.2, 14); }
        }
        break;
      }
      case 'machine': {
        const bh = p.h * 0.72, by = -p.h;
        ctx.fillStyle = c; ctx.fillRect(-p.w / 2, by, p.w, bh);
        ctx.strokeStyle = dark; ctx.lineWidth = 3;
        ctx.strokeRect(-p.w / 2 + 1.5, by + 1.5, p.w - 3, bh - 3);
        ctx.fillStyle = 'rgba(150,200,230,0.5)';
        ctx.fillRect(-p.w / 2 + 14, by + 12, p.w * 0.36, bh * 0.42);
        ctx.fillStyle = '#17171a';
        ctx.beginPath(); ctx.arc(-p.w * 0.28, -p.h * 0.14, 15, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.arc(p.w * 0.28, -p.h * 0.14, 15, 0, TAU); ctx.fill();
        if (p.kind === 'policeCar') {
          const s = Math.floor(G.time * 4) % 2;
          ctx.fillStyle = s ? '#c0392b' : '#4a90d0';
          ctx.fillRect(-32, by - 12, 26, 12);
          ctx.fillStyle = s ? '#4a90d0' : '#c0392b';
          ctx.fillRect(6, by - 12, 26, 12);
        }
        break;
      }
      case 'bed': {
        ctx.fillStyle = c; ctx.fillRect(-p.w / 2, -p.h * 0.62, p.w, p.h * 0.3);
        ctx.strokeStyle = dark; ctx.lineWidth = 3;
        ctx.strokeRect(-p.w / 2 + 1.5, -p.h * 0.62 + 1.5, p.w - 3, p.h * 0.3 - 3);
        ctx.strokeStyle = '#8a9098'; ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(-p.w / 2 + 9, -p.h * 0.32); ctx.lineTo(-p.w / 2 + 9, 0);
        ctx.moveTo(p.w / 2 - 9, -p.h * 0.32); ctx.lineTo(p.w / 2 - 9, 0);
        ctx.stroke();
        if (p.kind === 'bed') { ctx.fillStyle = '#eef2f6'; ctx.fillRect(-p.w / 2 + 6, -p.h * 0.66, p.w * 0.3, p.h * 0.2); }
        break;
      }
      case 'arch': {
        ctx.strokeStyle = c; ctx.lineWidth = 7; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -p.h); ctx.lineTo(p.w * 0.5, -p.h); ctx.stroke();
        if (p.kind === 'hoop') {
          ctx.strokeStyle = '#e8a030'; ctx.lineWidth = 4;
          ctx.beginPath(); ctx.arc(p.w * 0.42, -p.h + 15, 12, 0, TAU); ctx.stroke();
        }
        if (p.kind === 'gate') { ctx.fillStyle = c; ctx.fillRect(p.w * 0.28, -p.h, 16, p.h); }
        if (p.kind === 'glass') { ctx.fillStyle = 'rgba(200,240,255,0.4)'; ctx.fillRect(-6, -p.h * 0.7, 12, 16); }
        break;
      }
      case 'sign': {
        ctx.fillStyle = '#3a3a40'; ctx.fillRect(-3, -p.h, 6, p.h);
        const glow = 0.65 + 0.35 * Math.sin(G.time * 5 + p.seed * 6);
        ctx.globalAlpha *= glow;
        ctx.fillStyle = c; ctx.fillRect(-p.w / 2, -p.h, p.w, 34);
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
        ctx.strokeRect(-p.w / 2 + 1, -p.h + 1, p.w - 2, 32);
        ctx.globalAlpha = 1;
        break;
      }
      case 'pod': {
        ctx.fillStyle = '#2a3038'; ctx.fillRect(-p.w / 2, -12, p.w, 12);
        ctx.fillStyle = 'rgba(120,220,240,0.28)'; ctx.fillRect(-p.w / 2 + 4, -p.h + 8, p.w - 8, p.h - 22);
        ctx.strokeStyle = '#8ad0e0'; ctx.lineWidth = 3;
        ctx.strokeRect(-p.w / 2 + 4, -p.h + 8, p.w - 8, p.h - 22);
        const bob = Math.sin(G.time * 1.6 + p.seed * 9) * 8;
        ctx.fillStyle = 'rgba(150,240,255,0.45)';
        ctx.beginPath(); ctx.ellipse(0, -p.h * 0.55 + bob, 13, 20, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#5a6068'; ctx.fillRect(-p.w / 2, -p.h, p.w, 10);
        break;
      }
    }
    ctx.restore();
  }
}
