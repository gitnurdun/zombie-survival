// js/12-render.js —— 由 tools/split.js 从单文件版拆出。
// 分段：绘制

'use strict';
// ============================== 绘制 ==============================
function drawSky() {
  const m = G.map || MAPS[0];
  const [c0, c1, c2] = m.sky;

  if (m.skyKind === 'tunnel') {
    // ── 地铁隧道：水泥洞壁 + 顶部灯管 ──
    ctx.fillStyle = c0; ctx.fillRect(0, 0, VW, VH);
    const g = ctx.createLinearGradient(0, 0, 0, GROUND + 40);
    g.addColorStop(0, c0); g.addColorStop(0.5, c1); g.addColorStop(1, c2);
    ctx.fillStyle = g; ctx.fillRect(0, 0, VW, GROUND + 40);
    ctx.fillStyle = '#171b21';                       // 拱顶
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(VW, 0); ctx.lineTo(VW, 86);
    ctx.quadraticCurveTo(VW / 2, 196, 0, 86);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#2a3038'; ctx.lineWidth = 8;   // 管线
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(0, 34 + i * 15); ctx.lineTo(VW, 34 + i * 15); ctx.stroke(); }
    const ls = Math.floor((cam.x * 0.3 - VW / 2) / 340) * 340;
    for (let x = ls; x < cam.x * 0.3 + VW / 2 + 340; x += 340) {
      const px = x - cam.x * 0.3 + VW / 2;
      ctx.fillStyle = `rgba(150,220,240,${0.35 + 0.1 * Math.sin(G.time * 3 + x)})`;
      ctx.beginPath(); ctx.arc(px, 118, 130, 0, TAU); ctx.fill();
      ctx.fillStyle = '#cfe8f0'; ctx.fillRect(px - 58, 96, 116, 9);
    }
    return;
  }

  if (m.skyKind === 'lab') {
    // ── 生化研究所：冷白墙面 + 荧光灯带 + 面板缝 ──
    const g = ctx.createLinearGradient(0, 0, 0, GROUND + 40);
    g.addColorStop(0, c0); g.addColorStop(0.6, c1); g.addColorStop(1, c2);
    ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
    ctx.save(); ctx.translate(-(cam.x * 0.25) % 160, 0);
    ctx.strokeStyle = 'rgba(140,200,230,0.10)'; ctx.lineWidth = 2;
    for (let x = -160; x < VW + 200; x += 160) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, GROUND); ctx.stroke(); }
    for (let y = 60; y < GROUND; y += 90) { ctx.beginPath(); ctx.moveTo(-160, y); ctx.lineTo(VW + 200, y); ctx.stroke(); }
    ctx.restore();
    for (let i = 0; i < 3; i++) {                    // 顶部灯带
      const y = 40 + i * 26;
      ctx.fillStyle = `rgba(168,224,255,${0.14 - i * 0.04})`;
      ctx.fillRect(0, y, VW, 6);
    }
    const ls = Math.floor((cam.x * 0.4 - VW / 2) / 300) * 300;
    for (let x = ls; x < cam.x * 0.4 + VW / 2 + 300; x += 300) {
      const px = x - cam.x * 0.4 + VW / 2;
      ctx.fillStyle = 'rgba(168,224,255,0.10)';
      ctx.beginPath(); ctx.arc(px, 120, 170, 0, TAU); ctx.fill();
    }
    drawFog(m, 0.5);
    return;
  }

  // ── 户外 ──
  const g = ctx.createLinearGradient(0, 0, 0, GROUND);
  g.addColorStop(0, c0); g.addColorStop(0.55, c1); g.addColorStop(1, c2);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VW, GROUND + 40);

  if (m.stars) {                                     // 星星（视差 0.1）
    for (const st of stars) {
      const sx = (st.x - cam.x * 0.1) % (VW * 2);
      const px = sx < 0 ? sx + VW * 2 : sx;
      if (px > VW) continue;
      const tw = 0.5 + 0.5 * Math.sin(G.time * 2 + st.tw);
      ctx.globalAlpha = 0.30 + tw * 0.45;
      ctx.fillStyle = '#dce6ff';
      ctx.fillRect(px, st.y, st.s, st.s);
    }
    ctx.globalAlpha = 1;
  }
  if (m.moon) {                                      // 月亮
    const mx = 980 - cam.x * 0.05 % 300;
    ctx.fillStyle = '#e8e4c8';
    ctx.beginPath(); ctx.arc(mx, 110, 42, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(200,196,168,0.85)';
    ctx.beginPath(); ctx.arc(mx - 12, 100, 8, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(mx + 14, 122, 6, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(mx + 4, 92, 4, 0, TAU); ctx.fill();
  }
  if (m.cloud) {                                     // 云（视差 0.15）
    const cs = Math.floor((cam.x * 0.15 - VW) / 420) * 420;
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    for (let x = cs; x < cam.x * 0.15 + VW + 420; x += 420) {
      const px = x - cam.x * 0.15;
      const py = 90 + ((x / 420) % 3) * 46;
      for (let k = 0; k < 3; k++) {
        ctx.beginPath(); ctx.ellipse(px + k * 48, py + (k === 1 ? -14 : 0), 62 - k * 8, 24, 0, 0, TAU); ctx.fill();
      }
    }
  }
  // 远景（视差 0.25）—— 山丘或者建筑剪影
  ctx.fillStyle = m.skyline;
  ctx.beginPath();
  ctx.moveTo(0, GROUND);
  for (const h of hills) {
    const px = h.x - cam.x * 0.25;
    if (px < -200 || px > VW + 200) continue;
    ctx.lineTo(px, GROUND - 120 - h.h);
    ctx.lineTo(px + 65, GROUND - 60 - h.h * 0.7);
  }
  ctx.lineTo(VW, GROUND);
  ctx.closePath();
  ctx.fill();

  if (m.rain && G.state === 'play') {                // 雨丝
    ctx.strokeStyle = 'rgba(180,200,220,0.22)'; ctx.lineWidth = 1.5;
    for (let i = 0; i < 70; i++) {
      const px = (i * 137 - cam.x * 0.6 + G.time * 260) % (VW + 120) - 60;
      const py = (i * 211 + G.time * 900) % (GROUND + 40);
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px - 5, py + 22); ctx.stroke();
    }
  }
  if (m.siren) {                                     // 警灯
    const s = Math.floor(G.time * 3) % 2;
    ctx.fillStyle = s ? 'rgba(200,50,40,0.07)' : 'rgba(60,110,200,0.07)';
    ctx.fillRect(0, 0, VW, VH);
  }
  drawFog(m, 1);
}
function drawFog(m, scale) {
  scale *= (G.wmods && G.wmods.fogMul) || 1;   // 雾天 / 雨天能见度更低
  const fog = ctx.createLinearGradient(0, GROUND - 190, 0, GROUND);
  fog.addColorStop(0, `rgba(${m.fogCol},0)`);
  fog.addColorStop(1, `rgba(${m.fogCol},${m.fogAmt * scale})`);
  ctx.fillStyle = fog;
  ctx.fillRect(0, GROUND - 190, VW, 190);
}
function drawHouse(h) {
  const d = doorOf(h);
  const sx = h.x - cam.x + VW / 2;
  if (sx < -400 || sx > VW + 400) return;
  const top = GROUND - h.h;
  ctx.textAlign = 'center';

  // 受损程度：0 = 完好，1 = 将塌。四档表现 —— 裂纹 → 缺角 → 冒烟 → 整体倾斜
  const dmg = h.type === 'safe' ? 1 - clamp(h.hp / h.maxHp, 0, 1) : 0;

  ctx.save();
  if (dmg > 0.5) {                                  // 严重受损时楼体开始倾斜
    const cx = sx + h.w / 2;
    ctx.translate(cx, GROUND);
    ctx.rotate((dmg - 0.5) * 0.10 * (h.seed > 0.5 ? 1 : -1));
    ctx.translate(-cx, -GROUND);
  }

  // 墙
  ctx.fillStyle = dmg > 0.4 ? '#37301f' : '#3e3428';
  ctx.fillRect(sx, top, h.w, h.h);
  ctx.strokeStyle = '#241c12'; ctx.lineWidth = 4;
  ctx.strokeRect(sx + 2, top + 2, h.w - 4, h.h - 2);
  // 木板纹
  ctx.strokeStyle = 'rgba(20,15,8,0.35)'; ctx.lineWidth = 2;
  for (let y = top + 24; y < GROUND - 8; y += 26) {
    ctx.beginPath(); ctx.moveTo(sx + 6, y); ctx.lineTo(sx + h.w - 6, y); ctx.stroke();
  }
  // 裂纹
  if (dmg > 0.12) {
    ctx.strokeStyle = `rgba(10,7,4,${0.35 + dmg * 0.5})`;
    ctx.lineWidth = 2.5;
    const n = 2 + Math.floor(dmg * 7);
    for (let i = 0; i < n; i++) {
      const bx = sx + 20 + ((i * 97 + h.seed * 611) % Math.max(1, h.w - 44));
      const by = top + 16 + ((i * 71 + h.seed * 337) % Math.max(1, h.h - 44));
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + 14 - (i % 3) * 10, by + 18);
      ctx.lineTo(bx - 8 + (i % 4) * 7, by + 36);
      ctx.stroke();
    }
  }
  // 缺角
  if (dmg > 0.45) {
    ctx.fillStyle = 'rgba(12,9,5,0.88)';
    for (let i = 0; i < 3; i++) {
      const bx = sx + 12 + ((i * 131 + h.seed * 419) % Math.max(1, h.w - 46));
      ctx.beginPath();
      ctx.moveTo(bx, top + 2);
      ctx.lineTo(bx + 22 + (i % 2) * 14, top + 2);
      ctx.lineTo(bx + 8, top + 20 + (i % 3) * 12);
      ctx.closePath(); ctx.fill();
    }
  }
  // 屋顶
  ctx.fillStyle = '#2a2018';
  ctx.beginPath();
  ctx.moveTo(sx - 18, top);
  ctx.lineTo(sx + h.w / 2, top - 64);
  ctx.lineTo(sx + h.w + 18, top);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#1a140c'; ctx.lineWidth = 3; ctx.stroke();
  if (dmg > 0.3) {                                  // 屋顶缺口
    const gx = sx + h.w * (0.3 + h.seed * 0.3);
    ctx.fillStyle = 'rgba(6,4,3,0.9)';
    ctx.beginPath();
    ctx.moveTo(gx, top - 34); ctx.lineTo(gx + 30, top); ctx.lineTo(gx - 6, top);
    ctx.closePath(); ctx.fill();
  }

  // 门
  const dx = d.x - cam.x + VW / 2;
  ctx.fillStyle = '#171009';
  ctx.fillRect(dx - d.w / 2, GROUND - d.h, d.w, d.h);
  ctx.strokeStyle = '#241c12'; ctx.lineWidth = 4;
  ctx.strokeRect(dx - d.w / 2, GROUND - d.h, d.w, d.h);
  // 危房：门上钉着横板、边上加了立柱封死 —— 一眼看出进不去
  if (h.type !== 'safe') {
    ctx.strokeStyle = '#6b5433'; ctx.lineWidth = 7;
    ctx.beginPath();
    for (let k = 0; k < 3; k++) {
      const py = GROUND - d.h + 16 + k * (d.h - 34) / 2;
      ctx.moveTo(dx - d.w / 2 - 9, py); ctx.lineTo(dx + d.w / 2 + 9, py);
    }
    ctx.stroke();
    ctx.strokeStyle = '#3d2f1c'; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(dx - d.w / 2 - 10, GROUND - 10); ctx.lineTo(dx - d.w / 2 - 10, GROUND - d.h + 2);
    ctx.moveTo(dx + d.w / 2 + 10, GROUND - 10); ctx.lineTo(dx + d.w / 2 + 10, GROUND - d.h + 2);
    ctx.stroke();
  }

  // 安全屋没有文字门牌 —— 有没有物资只看窗户灯的颜色：绿 = 还有，蓝 = 已刷完
  const safeHas = h.type === 'safe' && h.refreshes < 2;
  if (h.type === 'safe' && G.state !== 'menu') {
    const pulse = 0.5 + 0.5 * Math.sin(G.time * 4);
    ctx.fillStyle = safeHas ? `rgba(120,230,140,${0.06 + pulse * 0.07})` : 'rgba(80,140,255,0.045)';
    ctx.beginPath(); ctx.arc(dx, GROUND - d.h / 2, 58, 0, TAU); ctx.fill();
  }

  // 窗（灯色 = 状态）。玩家在屋里时窗灯明显更亮、光晕更大 ——
  // 人物本身进屋后就不绘制了（见 drawPlayer），这是"人在里面"的唯一提示。
  // 危房（deco）的窗户是钉死的木板、里面全黑 —— 一眼就能看出这栋进不去。
  const insideMe = player.inside === h;
  const wn = h.w > 260 ? 3 : 2;
  const lamp = safeHas ? '124,232,146' : '96,156,255';   // 绿 = 还有物资；蓝 = 已刷完
  for (let i = 0; i < wn; i++) {
    const wx = sx + 26 + i * ((h.w - 52) / Math.max(1, wn - 1));
    if (Math.abs(wx - dx) < 50) continue;
    const wy = top + 52;
    if (h.type !== 'safe') {
      ctx.fillStyle = '#161009';
      ctx.fillRect(wx - 16, wy, 32, 30);
      ctx.strokeStyle = '#241c12'; ctx.lineWidth = 3;
      ctx.strokeRect(wx - 16, wy, 32, 30);
      ctx.strokeStyle = '#5a462c'; ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(wx - 17, wy + 9); ctx.lineTo(wx + 17, wy + 9);
      ctx.moveTo(wx - 17, wy + 22); ctx.lineTo(wx + 17, wy + 22);
      ctx.stroke();
      continue;
    }
    let flick = dmg > 0.5 ? 0.55 + 0.45 * Math.sin(G.time * 13 + i) : 1;   // 将塌时灯开始闪
    if (insideMe) flick *= 1.3;
    ctx.fillStyle = `rgba(${lamp},${clamp(0.78 * flick, 0, 1)})`;
    ctx.fillRect(wx - 16, wy, 32, 30);
    ctx.strokeStyle = '#241c12'; ctx.lineWidth = 3;
    ctx.strokeRect(wx - 16, wy, 32, 30);
    ctx.beginPath(); ctx.moveTo(wx - 16, wy + 15); ctx.lineTo(wx + 16, wy + 15);
    ctx.moveTo(wx, wy); ctx.lineTo(wx, wy + 30); ctx.stroke();
    ctx.fillStyle = `rgba(${lamp},${(insideMe ? 0.22 : 0.10) * flick})`;
    ctx.beginPath(); ctx.arc(wx, wy + 15, insideMe ? 64 : 44, 0, TAU); ctx.fill();
  }

  // 冒烟（受损后持续）
  if (dmg > 0.35 && G.state === 'play' && Math.random() < 0.3) {
    parts.push({ type: 'spark', x: h.x + rand(0, h.w), y: top + rand(-10, 30), vx: rand(-14, 14), vy: rand(-44, -20), grav: -8, life: rand(0.9, 1.6), max: 1.6, size: rand(5, 11), smoke: true });
  }
  // 受击闪白
  if (h.hitT > 0) {
    ctx.fillStyle = `rgba(255,220,180,${h.hitT * 2.2})`;
    ctx.fillRect(sx, top, h.w, h.h);
  }

  ctx.restore();

  // 血条：只在受损后、且玩家在附近时才显示（避免满屏 UI）
  if (h.type === 'safe' && dmg > 0.02 && Math.abs(player.x - h.x - h.w / 2) < 460) {
    const bw = 92, bx = sx + h.w / 2 - bw / 2, by = top - 78;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(bx, by, bw, 8);
    ctx.fillStyle = dmg > 0.6 ? '#d0402a' : '#d8a03a';
    ctx.fillRect(bx + 1, by + 1, (bw - 2) * (1 - dmg), 6);
  }
}
function drawStreet() {
  const m = G.map || MAPS[0];
  ctx.fillStyle = m.ground; ctx.fillRect(0, GROUND, VW, VH - GROUND);
  ctx.fillStyle = m.road;   ctx.fillRect(0, GROUND, VW, 12);
  ctx.save();
  ctx.translate(-cam.x + VW / 2, 0);
  const start = Math.floor((cam.x - VW / 2) / 90) * 90;
  const endX = cam.x + VW / 2 + 90;

  switch (m.tex) {
    case 'asphalt':                                   // 柏油：碎石 + 车道线
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      for (let x = start; x < endX; x += 46) ctx.fillRect(x, GROUND + 30 + ((x / 46) % 3) * 18, 26, 3);
      ctx.strokeStyle = 'rgba(230,220,150,0.16)'; ctx.lineWidth = 5;
      ctx.setLineDash([54, 46]);
      ctx.beginPath(); ctx.moveTo(start, GROUND + 56); ctx.lineTo(endX, GROUND + 56); ctx.stroke();
      ctx.setLineDash([]);
      break;
    case 'tile':                                      // 瓷砖：方格
      ctx.strokeStyle = 'rgba(0,0,0,0.26)'; ctx.lineWidth = 2;
      for (let gx = start; gx < endX; gx += 46) { ctx.beginPath(); ctx.moveTo(gx, GROUND); ctx.lineTo(gx, VH); ctx.stroke(); }
      for (let gy = GROUND + 22; gy < VH; gy += 22) { ctx.beginPath(); ctx.moveTo(start, gy); ctx.lineTo(endX, gy); ctx.stroke(); }
      break;
    case 'track':                                     // 塑胶跑道
      ctx.fillStyle = 'rgba(255,255,255,0.10)';
      for (let gy = GROUND + 20; gy < VH; gy += 34) ctx.fillRect(start, gy, VW + 200, 3);
      ctx.fillStyle = 'rgba(245,245,245,0.55)';
      for (let gx = start; gx < endX; gx += 130) ctx.fillRect(gx, GROUND + 12, 60, 6);
      break;
    case 'sand':                                      // 沙地：小石子
      ctx.fillStyle = 'rgba(255,240,200,0.07)';
      for (let x = start; x < endX; x += 30) ctx.fillRect(x, GROUND + 26 + ((x / 30) % 4) * 16, 16, 3);
      break;
    case 'concrete':                                  // 水泥：沉降缝
      ctx.strokeStyle = 'rgba(0,0,0,0.30)'; ctx.lineWidth = 2;
      for (let gy = GROUND + 26; gy < VH; gy += 30) { ctx.beginPath(); ctx.moveTo(start, gy); ctx.lineTo(endX, gy); ctx.stroke(); }
      break;
    case 'panel':                                     // 金属地板
      ctx.strokeStyle = 'rgba(160,220,255,0.10)'; ctx.lineWidth = 2;
      for (let gx = start; gx < endX; gx += 74) { ctx.beginPath(); ctx.moveTo(gx, GROUND); ctx.lineTo(gx, VH); ctx.stroke(); }
      ctx.fillStyle = 'rgba(140,220,255,0.20)';
      ctx.fillRect(start, GROUND + 48, VW + 200, 3);
      break;
    default:                                          // dirt：土路上的踩痕
      for (let x = start; x < endX; x += 90) {
        ctx.fillStyle = 'rgba(15,12,8,0.42)';
        ctx.fillRect(x + 10, GROUND + 18 + ((x / 90) % 3) * 16, 46, 8);
        ctx.fillStyle = 'rgba(50,44,36,0.55)';
        ctx.fillRect(x + 60, GROUND + 40 - ((x / 90) % 2) * 20, 18, 6);
      }
      break;
  }

  // 血迹 / 残骸
  for (const d of decals) {
    if (d.x < cam.x - VW / 2 - 60 || d.x > cam.x + VW / 2 + 60) continue;
    ctx.fillStyle = 'rgba(90,12,10,0.45)';
    ctx.beginPath(); ctx.ellipse(d.x, GROUND + 6, d.r, d.r * 0.3, 0, 0, TAU); ctx.fill();
  }
  ctx.restore();

  // 路灯 / 霓虹 / 荧光灯
  if (m.lamp === 'none') return;
  const spacing = m.lamp === 'neon' ? 380 : m.lamp === 'fluorescent' ? 440 : 520;
  const ls = Math.floor((cam.x - VW / 2) / spacing) * spacing;
  for (let x = ls; x < cam.x + VW / 2 + spacing; x += spacing) {
    const px = x - cam.x + VW / 2;
    if (m.lamp === 'fluorescent') {                  // 室内荧光灯：顶部的长灯管
      ctx.fillStyle = '#3a4048';
      ctx.fillRect(px - 46, 22, 92, 10);
      ctx.fillStyle = m.lampCol;
      ctx.fillRect(px - 42, 25, 84, 5);
      ctx.fillStyle = `rgba(${m.lamp === 'fluorescent' ? '200,235,245' : '255,220,130'},0.07)`;
      ctx.beginPath(); ctx.arc(px, 40, 150, 0, TAU); ctx.fill();
    } else {
      ctx.fillStyle = m.lamp === 'neon' ? '#2a2030' : '#1a1a20';
      ctx.fillRect(px - 4, GROUND - 150, 8, 150);
      ctx.fillRect(px - 4, GROUND - 150, 34, 6);
      const glow = m.lamp === 'neon' ? (0.6 + 0.4 * Math.sin(G.time * 4 + x)) : 1;
      ctx.fillStyle = m.lampCol;
      ctx.beginPath(); ctx.arc(px + 30, GROUND - 142, 7, 0, TAU); ctx.fill();
      ctx.globalAlpha = glow;
      const [r, g2, b] = m.lamp === 'neon' ? [255, 106, 176] : [255, 220, 130];
      ctx.fillStyle = `rgba(${r},${g2},${b},0.10)`;
      ctx.beginPath(); ctx.arc(px + 30, GROUND - 130, 92, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
}
function drawZombie(z) {
  const sx = z.x - cam.x + VW / 2;
  if (sx < -150 || sx > VW + 150) return;
  const feet = z.y();
  const s = z.type === 'giant' ? 1 : 1;
  const col = z.hitT > 0 ? '#ffffff' : z.def.skin;
  const dark = 'rgba(20,30,14,0.9)';
  ctx.save();
  ctx.translate(sx, feet);
  ctx.scale(z.dir, 1);
  // 影子
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.ellipse(0, 6, z.w * 0.55, 7, 0, 0, TAU); ctx.fill();

  if (z.def.shape === 'beast') {
    // ── 变异犬：低矮的四足剪影 ──
    const gait = Math.sin(z.walkT * 8);
    ctx.strokeStyle = dark; ctx.lineWidth = 6; ctx.lineCap = 'round';
    for (let k = 0; k < 2; k++) {
      const ph = k ? -gait : gait;
      ctx.beginPath(); ctx.moveTo(-z.w * 0.2, -z.h * 0.5); ctx.lineTo(-z.w * 0.3 + ph * 12, -2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(z.w * 0.2, -z.h * 0.5); ctx.lineTo(z.w * 0.3 - ph * 12, -2); ctx.stroke();
    }
    // 尾巴
    ctx.strokeStyle = col; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(-z.w * 0.42, -z.h * 0.58);
    ctx.quadraticCurveTo(-z.w * 0.74, -z.h * 0.8 + gait * 6, -z.w * 0.66, -z.h * 0.98 + gait * 10);
    ctx.stroke();
    // 躯干
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.ellipse(0, -z.h * 0.52, z.w * 0.46, z.h * 0.25, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = dark; ctx.lineWidth = 3; ctx.stroke();
    // 背刺
    ctx.fillStyle = '#3a3228';
    for (let k = -1; k <= 1; k++) {
      ctx.beginPath();
      ctx.moveTo(k * z.w * 0.16, -z.h * 0.7);
      ctx.lineTo(k * z.w * 0.16 + 5, -z.h * 0.86);
      ctx.lineTo(k * z.w * 0.16 - 5, -z.h * 0.86);
      ctx.closePath(); ctx.fill();
    }
    // 头
    const hx2 = z.w * 0.44, hy2 = -z.h * 0.68;
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(hx2, hy2, z.w * 0.21, 0, TAU); ctx.fill();
    ctx.strokeStyle = dark; ctx.lineWidth = 3; ctx.stroke();
    // 吻部
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.moveTo(hx2 + z.w * 0.12, hy2 - 3);
    ctx.lineTo(hx2 + z.w * 0.36, hy2 + 2);
    ctx.lineTo(hx2 + z.w * 0.12, hy2 + 8);
    ctx.closePath(); ctx.fill();
    // 眼
    ctx.fillStyle = z.def.eye;
    ctx.beginPath(); ctx.arc(hx2 + z.w * 0.05, hy2 - 4, z.w * 0.07, 0, TAU); ctx.fill();
  } else {
  const walk = Math.sin(z.walkT * 6);
  const walk2 = Math.sin(z.walkT * 6 + Math.PI);
  // 腿
  ctx.strokeStyle = dark; ctx.lineWidth = z.w * 0.16; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, -z.h * 0.42); ctx.lineTo(walk * z.w * 0.3, -2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, -z.h * 0.42); ctx.lineTo(walk2 * z.w * 0.3, -2); ctx.stroke();
  // 后臂（伸向前）
  const armY = -z.h * 0.72;
  ctx.strokeStyle = col; ctx.lineWidth = z.w * 0.15;
  ctx.beginPath(); ctx.moveTo(0, armY); ctx.lineTo(z.w * 0.55, armY - 4 + Math.sin(z.wob) * 5); ctx.stroke();
  // 身体
  ctx.fillStyle = z.hitT > 0 ? '#ffffff' : '#5a6a45';
  ctx.beginPath();
  ctx.roundRect(-z.w * 0.32, -z.h * 0.78, z.w * 0.64, z.h * 0.4, 8);
  ctx.fill();
  ctx.strokeStyle = dark; ctx.lineWidth = 3; ctx.stroke();
  // 破衣服血渍
  ctx.fillStyle = 'rgba(120,20,15,0.7)';
  ctx.beginPath(); ctx.arc(-z.w * 0.1, -z.h * 0.62, z.w * 0.12, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(z.w * 0.14, -z.h * 0.5, z.w * 0.09, 0, TAU); ctx.fill();
  // 前臂
  ctx.strokeStyle = col; ctx.lineWidth = z.w * 0.16;
  ctx.beginPath(); ctx.moveTo(0, armY); ctx.lineTo(z.w * 0.6, armY + 6 + Math.cos(z.wob) * 5); ctx.stroke();
  // 手掌
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.arc(z.w * 0.6, armY + 6 + Math.cos(z.wob) * 5, z.w * 0.1, 0, TAU); ctx.fill();
  // 头
  const hx = z.w * 0.08, hy = -z.h * 0.88;
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.arc(hx, hy, z.w * 0.26, 0, TAU); ctx.fill();
  ctx.strokeStyle = dark; ctx.lineWidth = 3; ctx.stroke();
  // 眼
  ctx.fillStyle = z.def.eye;
  ctx.beginPath(); ctx.arc(hx + z.w * 0.14, hy - 3, z.w * 0.07, 0, TAU); ctx.fill();
  ctx.fillStyle = '#111';
  ctx.beginPath(); ctx.arc(hx + z.w * 0.17, hy - 3, z.w * 0.03, 0, TAU); ctx.fill();
  // 嘴（血）
  ctx.fillStyle = '#7a1512';
  ctx.beginPath();
  ctx.moveTo(hx + z.w * 0.05, hy + z.w * 0.12);
  ctx.lineTo(hx + z.w * 0.25, hy + z.w * 0.12);
  ctx.lineTo(hx + z.w * 0.15, hy + z.w * 0.2);
  ctx.closePath(); ctx.fill();
  // 重甲
  if (z.type === 'heavy') {
    ctx.fillStyle = '#5a5a62';
    ctx.beginPath(); ctx.arc(hx, hy - 2, z.w * 0.29, Math.PI, TAU); ctx.fill();
    ctx.strokeStyle = '#333'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#4a4a52';
    ctx.fillRect(-z.w * 0.34, -z.h * 0.76, z.w * 0.68, z.h * 0.18);
    ctx.strokeStyle = '#2c2c30'; ctx.strokeRect(-z.w * 0.34, -z.h * 0.76, z.w * 0.68, z.h * 0.18);
  }
  if (z.type === 'giant') {
    ctx.strokeStyle = dark; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(hx - z.w * 0.05, hy - z.w * 0.14); ctx.lineTo(hx + z.w * 0.1, hy - z.w * 0.08); ctx.stroke();
  }
  // 自爆尸：鼓胀的肚子 + 引信火花
  if (z.def.explode) {
    ctx.fillStyle = 'rgba(150,90,50,0.85)';
    ctx.beginPath(); ctx.ellipse(z.w * 0.04, -z.h * 0.5, z.w * 0.42, z.h * 0.24, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#4a2a14'; ctx.lineWidth = 2.5; ctx.stroke();
    if (z.fuse > 0) {
      const f = 1 + Math.sin(G.time * 40) * 0.5;
      ctx.fillStyle = '#ffd070';
      ctx.beginPath(); ctx.arc(hx, hy - z.w * 0.3, 4 * f, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,140,40,0.5)';
      ctx.beginPath(); ctx.arc(hx, hy - z.w * 0.3, 9 * f, 0, TAU); ctx.fill();
    }
  }
  // 酸液喷吐者：鼓起的喉囊 + 绿色滴液
  if (z.def.ranged && z.def.ranged.elem === 'acid') {
    ctx.fillStyle = '#8fbf40';
    ctx.beginPath(); ctx.ellipse(hx + z.w * 0.06, hy + z.w * 0.2, z.w * 0.19, z.w * 0.16, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#4a6a20'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = 'rgba(140,220,60,0.55)';
    ctx.beginPath(); ctx.arc(hx + z.w * 0.22, hy + z.w * 0.3, 3, 0, TAU); ctx.fill();
  }
  // 燃烧者：手里的燃烧瓶
  if (z.def.ranged && z.def.ranged.elem === 'fire') {
    ctx.fillStyle = '#6a4a20';
    ctx.fillRect(z.w * 0.5, armY - 2, 12, 18);
    const fl = 1 + Math.sin(G.time * 12) * 0.4;
    ctx.fillStyle = '#ffb040';
    ctx.beginPath(); ctx.arc(z.w * 0.5 + 6, armY - 6, 5 * fl, 0, TAU); ctx.fill();
  }
  // 腐胀胖尸：撑破皮肤的肚子 + 从缝里渗出来的绿气
  if (z.def.gas) {
    const bl = 1 + Math.sin(G.time * 3 + z.wob) * 0.04;
    ctx.fillStyle = z.hitT > 0 ? '#ffffff' : '#a8b860';
    ctx.beginPath(); ctx.ellipse(0, -z.h * 0.42, z.w * 0.55 * bl, z.h * 0.30 * bl, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#4a5a24'; ctx.lineWidth = 3; ctx.stroke();
    ctx.strokeStyle = 'rgba(120,60,60,0.85)'; ctx.lineWidth = 2;      // 撑裂的皮肤纹
    for (let k = -1; k <= 1; k++) {
      ctx.beginPath();
      ctx.moveTo(k * z.w * 0.2, -z.h * 0.62);
      ctx.quadraticCurveTo(k * z.w * 0.3, -z.h * 0.42, k * z.w * 0.16, -z.h * 0.24);
      ctx.stroke();
    }
    ctx.fillStyle = `rgba(170,220,90,${0.35 + 0.25 * Math.sin(G.time * 5 + z.wob)})`;
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      ctx.arc(-z.w * 0.25 + k * z.w * 0.25, -z.h * (0.86 + k * 0.02), 4 + Math.sin(G.time * 4 + k) * 2, 0, TAU);
      ctx.fill();
    }
  }
  // 骨刺投手：背后一捆骨头，投掷时前臂抬起
  if (z.def.ranged && z.def.ranged.elem === 'bone') {
    ctx.strokeStyle = '#d8d4c0'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    for (let k = -1; k <= 1; k++) {
      ctx.beginPath();
      ctx.moveTo(-z.w * 0.3, -z.h * 0.6 + k * 6);
      ctx.lineTo(-z.w * 0.62 + Math.abs(k) * 5, -z.h * 0.86 + k * 9);
      ctx.stroke();
      ctx.fillStyle = '#f0ecd8';
      ctx.beginPath(); ctx.arc(-z.w * 0.62 + Math.abs(k) * 5, -z.h * 0.86 + k * 9, 3, 0, TAU); ctx.fill();
    }
    // 投掷的前摇：手往后拉
    if (z.shootT !== undefined && z.shootT < 0.45) {
      ctx.strokeStyle = '#f0ecd8'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(z.w * 0.3, -z.h * 0.78); ctx.lineTo(z.w * 0.1, -z.h * 0.95); ctx.stroke();
    }
  }
  // 尖叫者：仰头张到极限的嘴 + 一圈音波
  if (z.def.shriek) {
    ctx.fillStyle = '#2a0a18';
    ctx.beginPath(); ctx.ellipse(hx + z.w * 0.12, hy + z.w * 0.06, z.w * 0.2, z.w * 0.26, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#e060a0'; ctx.lineWidth = 2; ctx.stroke();
    // 音波环：离上次尖叫越久越淡（shriekT 是倒计时，不用另存状态）
    const cd = z.def.shriek.cd;
    const k = 1 - clamp((z.shriekT === undefined ? cd : z.shriekT) / cd, 0, 1);
    if (k > 0.02) {
      ctx.globalAlpha = (1 - k) * 0.6;
      for (let i = 0; i < 3; i++) {
        ctx.strokeStyle = '#ff9ad0'; ctx.lineWidth = 2.5 - i * 0.6;
        ctx.beginPath();
        ctx.arc(hx, hy, z.w * (0.5 + k * 2.6 + i * 0.7), -0.9, 0.9);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  }
  // 护士尸：白大褂 + 胸口红十字
  if (z.def.aura && z.def.aura.type === 'heal') {
    ctx.fillStyle = z.hitT > 0 ? '#ffffff' : '#eef2f4';
    ctx.beginPath(); ctx.roundRect(-z.w * 0.36, -z.h * 0.8, z.w * 0.72, z.h * 0.5, 5); ctx.fill();
    ctx.strokeStyle = '#9aa8ae'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#c0392b';                                   // 红十字
    ctx.fillRect(z.w * 0.02, -z.h * 0.74, z.w * 0.14, z.h * 0.06);
    ctx.fillRect(z.w * 0.065, -z.h * 0.78, z.w * 0.05, z.h * 0.14);
    ctx.fillStyle = '#eef2f4';                                   // 护士帽
    ctx.beginPath(); ctx.roundRect(hx - z.w * 0.2, hy - z.w * 0.3, z.w * 0.4, z.w * 0.16, 3); ctx.fill();
    ctx.strokeStyle = '#9aa8ae'; ctx.stroke();
  }
  // 跳跃者：蹲伏的后腿
  if (z.def.pounce) {
    ctx.strokeStyle = col; ctx.lineWidth = z.w * 0.18;
    ctx.beginPath(); ctx.moveTo(-z.w * 0.1, -z.h * 0.42); ctx.lineTo(-z.w * 0.55, -z.h * 0.2); ctx.lineTo(-z.w * 0.3, -2); ctx.stroke();
    if (z.lungeT > 0) {   // 扑击时身后拖一道残影
      ctx.strokeStyle = 'rgba(128,255,208,0.4)'; ctx.lineWidth = 3;
      for (let k = 1; k <= 3; k++) {
        ctx.beginPath(); ctx.moveTo(-z.w * 0.3 - k * 16, -z.h * 0.5); ctx.lineTo(-z.w * 0.3 - k * 16, -z.h * 0.25); ctx.stroke();
      }
    }
  }
  }   // ← 关掉 "beast / humanoid" 的分支
  ctx.restore();
  // Boss：插满管子 + 一颗发光的核心
  if (z.isBoss) {
    ctx.strokeStyle = '#3a6a4a'; ctx.lineWidth = 6; ctx.lineCap = 'round';
    for (let k = -2; k <= 2; k++) {
      ctx.beginPath();
      ctx.moveTo(k * z.w * 0.12, -z.h * 0.5);
      ctx.quadraticCurveTo(k * z.w * 0.32, -z.h * 0.76, k * z.w * 0.22, -z.h * 0.98);
      ctx.stroke();
    }
    const bp = 0.5 + 0.5 * Math.sin(G.time * 5);
    ctx.fillStyle = `rgba(180,60,255,${0.40 + bp * 0.40})`;
    ctx.beginPath(); ctx.arc(0, -z.h * 0.55, 24 + bp * 6, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,140,255,0.75)';
    ctx.beginPath(); ctx.arc(0, -z.h * 0.55, 12, 0, TAU); ctx.fill();
  }

  // 词缀光环：一眼看出这只是精英怪
  if (z.affix) {
    const A = AFFIXES[z.affix];
    const pulse = 0.5 + 0.5 * Math.sin(G.time * 4 + z.wob);
    if (z.shield > 0) {                          // 带盾的：多一层实心蓝罩
      ctx.globalAlpha = 0.16 + pulse * 0.20;
      ctx.fillStyle = '#9ac0ff';
      ctx.beginPath(); ctx.ellipse(sx, feet - z.h * 0.5, z.w * 0.92, z.h * 0.68, 0, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 0.30 + pulse * 0.35;
    ctx.strokeStyle = A.col; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(sx, feet - z.h * 0.5, z.w * 0.88, z.h * 0.64, 0, 0, TAU); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  // 正在被护士尸回血：一圈上浮的绿光
  if (z.healT > 0) {
    ctx.globalAlpha = 0.6;
    ctx.strokeStyle = '#7ce07c'; ctx.lineWidth = 2.5;
    const hk = (G.time * 0.8 + z.wob) % 1;
    ctx.beginPath(); ctx.ellipse(sx, feet - hk * z.h, z.w * 0.55, 5, 0, 0, TAU); ctx.stroke();
    ctx.fillStyle = '#7ce07c';
    ctx.beginPath(); ctx.arc(sx + Math.sin(G.time * 3 + z.wob) * z.w * 0.4, feet - hk * z.h, 2.5, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
  }
  // 光环主人自己脚下的一圈范围提示 —— 一眼看出"它在管着周围这些"
  if (z.def.aura) {
    const a = z.def.aura;
    const col2 = a.type === 'heal' ? '#7ce07c' : '#ff9ad0';
    ctx.globalAlpha = 0.18 + 0.10 * Math.sin(G.time * 2.5 + z.wob);
    ctx.strokeStyle = col2; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(sx, feet, a.r, a.r * 0.22, 0, 0, TAU); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  // 燃烧
  if (z.burnT > 0) {
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = 'rgba(255,120,30,0.35)';
    ctx.fillRect(sx - z.w / 2, feet - z.h, z.w, z.h);
    ctx.globalAlpha = 1;
  }
  // 血条
  if (z.hp < z.maxHp) {
    const bw = z.w * 1.4;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(sx - bw / 2, feet - z.h - 14, bw, 5);
    ctx.fillStyle = z.type === 'giant' ? '#e07a3a' : '#c0392b';
    ctx.fillRect(sx - bw / 2, feet - z.h - 14, bw * clamp(z.hp / z.maxHp, 0, 1), 5);
  }
}
function drawPlayer() {
  // 进屋即"消失" —— 屋里的状态完全由窗户灯的变化体现（见 drawHouse）
  if (player.inside) return;
  const sx = player.x - cam.x + VW / 2;
  const feet = GROUND - player.z;
  const dir = Math.cos(player.aim) >= 0 ? 1 : -1;
  const flash = G.hurtT > 0 && player.invuln <= 0 && Math.floor(G.hurtT * 20) % 2 === 0;
  ctx.save();
  ctx.translate(sx, feet);
  ctx.scale(dir, 1);
  ctx.globalAlpha = player.invuln > 0 ? (Math.floor(G.time * 12) % 2 ? 0.4 : 0.9) : 1;
  // 影子
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath(); ctx.ellipse(0, 6 + player.z * 0.15, 22, 7, 0, 0, TAU); ctx.fill();
  const walk = player.z > 0 ? 0.6 : Math.sin(player.walkT * 6);
  const walk2 = player.z > 0 ? -0.6 : Math.sin(player.walkT * 6 + Math.PI);
  // 腿
  ctx.strokeStyle = '#2c3440'; ctx.lineWidth = 9; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-2, -28); ctx.lineTo(walk * 14 - 2, -2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-2, -28); ctx.lineTo(walk2 * 14 - 2, -2); ctx.stroke();
  // 身体（夹克）
  ctx.fillStyle = flash ? '#ff6050' : '#5a4632';
  ctx.beginPath(); ctx.roundRect(-13, -62, 26, 36, 7); ctx.fill();
  ctx.strokeStyle = '#2a2018'; ctx.lineWidth = 3; ctx.stroke();
  ctx.fillStyle = '#463726';
  ctx.fillRect(-13, -48, 26, 6);
  // 头
  ctx.fillStyle = flash ? '#ff8070' : '#d8b490';
  ctx.beginPath(); ctx.arc(3, -72, 12, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#2a2018'; ctx.lineWidth = 3; ctx.stroke();
  // 头发
  ctx.fillStyle = '#3a2c1c';
  ctx.beginPath(); ctx.arc(1, -76, 11, Math.PI * 0.9, TAU * 0.55); ctx.fill();
  // 墨镜
  ctx.fillStyle = '#101014';
  ctx.fillRect(-6, -75, 19, 6);
  ctx.fillStyle = 'rgba(120,180,255,0.5)';
  ctx.fillRect(-4, -74, 6, 2);
  // 武器
  const w = curWeapon();
  const aimLocal = dir === 1 ? player.aim : Math.PI - player.aim;
  if (w.def.melee) {
    const swing = player.swingT > 0 ? (1 - player.swingT / 0.22) : 0;
    const sa = -1.2 + swing * 2.4;
    ctx.save();
    ctx.translate(6, -46);
    ctx.rotate(sa);
    ctx.strokeStyle = '#8a6a42'; ctx.lineWidth = 7; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(42, 0); ctx.stroke();
    ctx.strokeStyle = '#6a4e2c'; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(38, 0); ctx.lineTo(44, 0); ctx.stroke();
    if (player.swingT > 0) {
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, 46, -0.6, 0.9); ctx.stroke();
    }
    ctx.restore();
  } else {
    ctx.save();
    ctx.translate(8, -46);
    ctx.rotate(clamp(aimLocal, -1.3, 1.3));
    ctx.fillStyle = '#1c1c20';
    const L = w.def.id === 'lightning' ? 40 : w.def.id === 'flame' ? 36 : w.def.id === 'shotgun' ? 34 : w.def.id === 'smg' ? 26 : 20;
    ctx.fillRect(0, -4, L, 8);
    ctx.fillRect(4, -3, 10, 12);
    if (w.def.id === 'lightning') { ctx.fillStyle = '#4a5a8a'; ctx.fillRect(L - 6, -7, 6, 14); }
    if (w.def.id === 'flame') { ctx.fillStyle = '#7a3020'; ctx.fillRect(-8, -8, 10, 16); }
    if (G.flashT > 0) {
      ctx.fillStyle = 'rgba(255,240,170,0.95)';
      ctx.beginPath();
      ctx.moveTo(L + 2, 0); ctx.lineTo(L + 16, -7); ctx.lineTo(L + 22, 0); ctx.lineTo(L + 16, 7);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}
function drawEntities() {
  // 金币
  for (const c of coins) {
    const sx = c.x - cam.x + VW / 2;
    if (sx < -30 || sx > VW + 30) continue;
    if (c.life < 3 && Math.floor(c.life * 6) % 2 === 0) continue;
    const sc = Math.abs(Math.cos(c.t * 7));
    ctx.fillStyle = '#e8c030';
    ctx.beginPath(); ctx.ellipse(sx, c.y, 7 * sc + 1.5, 7, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#9a7a18'; ctx.lineWidth = 2; ctx.stroke();
    if (sc > 0.5) { ctx.fillStyle = '#9a7a18'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('$', sx, c.y + 3); }
  }
  // 道具
  for (const it of items) {
    const sx = it.x - cam.x + VW / 2;
    if (sx < -40 || sx > VW + 40) continue;
    if (it.life < 3 && Math.floor(it.life * 6) % 2 === 0) continue;
    if (it.type === 'bat') {
      const flap = Math.sin(it.t * 18) * 10;
      ctx.fillStyle = '#3a2a4a';
      ctx.beginPath();
      ctx.moveTo(sx, it.y);
      ctx.quadraticCurveTo(sx - 16, it.y - 8 - flap, sx - 24, it.y + 4 - flap * 0.5);
      ctx.quadraticCurveTo(sx - 12, it.y + 4, sx, it.y + 4);
      ctx.quadraticCurveTo(sx + 12, it.y + 4, sx + 24, it.y + 4 - flap * 0.5);
      ctx.quadraticCurveTo(sx + 16, it.y - 8 - flap, sx, it.y);
      ctx.fill();
      ctx.fillStyle = '#e8d8ff';
      ctx.beginPath(); ctx.arc(sx, it.y - 2, 3, 0, TAU); ctx.fill();
    } else {
      ctx.fillStyle = '#c0392b';
      ctx.fillRect(sx - 11, it.y - 11, 22, 22);
      ctx.strokeStyle = '#7a2018'; ctx.lineWidth = 2; ctx.strokeRect(sx - 11, it.y - 11, 22, 22);
      ctx.fillStyle = '#fff';
      ctx.fillRect(sx - 2.5, it.y - 7, 5, 14);
      ctx.fillRect(sx - 7, it.y - 2.5, 14, 5);
    }
  }
  // 僵尸
  for (const z of zombies) drawZombie(z);
  drawPlayer();
  // 子弹
  ctx.strokeStyle = '#ffe9a0'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  for (const b of bullets) {
    const sx = b.x - cam.x + VW / 2;
    const l = Math.hypot(b.vx, b.vy) || 1;
    ctx.beginPath();
    ctx.moveTo(sx, b.y);
    ctx.lineTo(sx - b.vx / l * 13, b.y - b.vy / l * 13);
    ctx.stroke();
  }
  // 电弧
  for (const a of arcs) {
    const al = a.life / a.max;
    ctx.strokeStyle = `rgba(160,200,255,${al})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let i = 0; i < a.pts.length - 1; i++) {
      const [x1, y1] = a.pts[i], [x2, y2] = a.pts[i + 1];
      const sx1 = x1 - cam.x + VW / 2, sx2 = x2 - cam.x + VW / 2;
      ctx.moveTo(sx1, y1);
      const segs = 5;
      for (let s = 1; s <= segs; s++) {
        const t = s / segs;
        const jx = s === segs ? 0 : rand(-14, 14);
        const jy = s === segs ? 0 : rand(-14, 14);
        ctx.lineTo(lerp(sx1, sx2, t) + jx, lerp(y1, y2, t) + jy);
      }
    }
    ctx.stroke();
    ctx.strokeStyle = `rgba(255,255,255,${al * 0.8})`;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  // 粒子
  for (const p of parts) {
    const sx = p.x - cam.x + VW / 2;
    if (sx < -60 || sx > VW + 60) continue;
    const al = clamp(p.life / p.max, 0, 1);
    if (p.type === 'fire') {
      const r = clamp(1 - p.life / p.max, 0, 1);
      ctx.globalAlpha = al;
      ctx.fillStyle = r < 0.4 ? '#fff0a0' : r < 0.7 ? '#ff9030' : '#c03018';
      ctx.beginPath(); ctx.arc(sx, p.y, p.size * (0.5 + r), 0, TAU); ctx.fill();
      if (r > 0.7) { ctx.globalAlpha = al * 0.3; ctx.fillStyle = '#555'; ctx.beginPath(); ctx.arc(sx, p.y - 6, p.size * r, 0, TAU); ctx.fill(); }
    } else if (p.type === 'blood') {
      ctx.globalAlpha = al;
      ctx.fillStyle = '#a01810';
      ctx.beginPath(); ctx.arc(sx, p.y, p.size, 0, TAU); ctx.fill();
    } else if (p.type === 'spark') {
      if (p.smoke) {                                  // 安全屋受损后冒的烟
        ctx.globalAlpha = al * 0.32;
        ctx.fillStyle = '#6a6258';
        ctx.beginPath(); ctx.arc(sx, p.y, p.size * (1 + (1 - al) * 1.5), 0, TAU); ctx.fill();
      } else {
        ctx.globalAlpha = al;
        ctx.fillStyle = '#ffe9b0';
        ctx.fillRect(sx - 1.5, p.y - 1.5, 3, 3);
      }
    } else if (p.type === 'shell') {
      ctx.globalAlpha = al;
      ctx.fillStyle = '#c8a028';
      ctx.fillRect(sx - 2, p.y - 1.5, 4, 3);
    } else if (p.type === 'head') {
      ctx.globalAlpha = al;
      ctx.fillStyle = p.skin;
      ctx.beginPath(); ctx.arc(sx, p.y, p.size, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(20,30,14,0.9)'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = p.eye;
      ctx.beginPath(); ctx.arc(sx + p.size * 0.4, p.y - 2, p.size * 0.25, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#a01810'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(sx - p.size * 0.5, p.y + p.size * 0.4); ctx.lineTo(sx - p.size, p.y + p.size * 0.7); ctx.stroke();
    } else if (p.type === 'corpse') {
      ctx.globalAlpha = al * 0.85;
      ctx.save();
      ctx.translate(sx, GROUND - 6);
      ctx.scale(-p.dir, 1);
      ctx.rotate(-0.1);
      ctx.fillStyle = p.skin;
      ctx.beginPath(); ctx.roundRect(-p.w * 0.5, -p.h * 0.22, p.w * 1.1, p.h * 0.22, 8); ctx.fill();
      ctx.strokeStyle = 'rgba(20,30,14,0.9)'; ctx.lineWidth = 3; ctx.stroke();
      ctx.beginPath(); ctx.arc(p.w * 0.62, -p.h * 0.1, p.w * 0.26, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
  // 漂浮文字
  ctx.font = 'bold 14px "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'center';
  for (const t of texts) {
    const sx = t.x - cam.x + VW / 2;
    ctx.globalAlpha = clamp(t.life / t.max, 0, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillText(t.txt, sx + 1, t.y + 1);
    ctx.fillStyle = t.col;
    ctx.fillText(t.txt, sx, t.y);
  }
  ctx.globalAlpha = 1;
}
function drawHUD() {
  ctx.textAlign = 'left';
  // HP
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(18, 16, 250, 64);
  ctx.font = 'bold 12px "Microsoft YaHei", sans-serif';
  ctx.fillStyle = '#cfd6c8';
  ctx.fillText('生命', 30, 34);
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(30, 40, 220, 13);
  const pct = clamp(player.hp / player.maxHp, 0, 1);
  ctx.fillStyle = pct > 0.5 ? '#5aa04a' : pct > 0.25 ? '#c0902a' : '#c0392b';
  ctx.fillRect(30, 40, 220 * pct, 13);
  ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1;
  ctx.strokeRect(30.5, 40.5, 219, 12);
  ctx.fillStyle = '#e8c559';
  ctx.fillText('金币 $' + player.cash, 30, 72);
  // 蝙蝠
  for (let i = 0; i < player.bats; i++) {
    ctx.fillStyle = '#b48ae0';
    ctx.beginPath();
    ctx.arc(170 + i * 20, 68, 6, 0, TAU); ctx.fill();
    ctx.fillRect(163 + i * 20, 64, 14, 3);
  }
  // 武器
  const w = curWeapon();
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(VW - 320, VH - 78, 302, 62);
  ctx.fillStyle = '#d9e2cf';
  ctx.font = 'bold 14px "Microsoft YaHei", sans-serif';
  ctx.fillText(w.def.name, VW - 36, VH - 54);
  ctx.font = 'bold 24px "Microsoft YaHei", sans-serif';
  const infAmmo = !Number.isFinite(w.ammo);   // 冷兵器 / 飞镖 都是 ∞
  ctx.fillStyle = !infAmmo && w.ammo <= 0 ? '#c0392b' : '#e8e2c8';
  ctx.fillText(infAmmo ? '∞' : Math.floor(w.ammo), VW - 36, VH - 26);
  // 槽位
  ctx.textAlign = 'center';
  // 固定显示 3 个槽位，空槽画成暗的
  for (let i = 0; i < SLOTS; i++) {
    const sx = VW - 286 + i * 55, sy = VH - 118;
    const sw = player.weapons[i];
    const on = i === player.slot && sw;
    ctx.fillStyle = on ? 'rgba(90,110,70,0.9)' : 'rgba(0,0,0,0.5)';
    ctx.fillRect(sx, sy, 48, 32);
    ctx.strokeStyle = on ? '#9ab87a' : 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(sx + 0.5, sy + 0.5, 47, 31);
    ctx.fillStyle = !sw ? 'rgba(125,138,118,0.3)' : (on ? '#e8e2c8' : '#7d8a76');
    ctx.font = 'bold 11px "Microsoft YaHei", sans-serif';
    ctx.fillText(String(i + 1), sx + 10, sy + 20);
    ctx.font = '10px "Microsoft YaHei", sans-serif';
    ctx.fillText(sw ? sw.def.name.slice(0, 3) : '—', sx + 30, sy + 20);
  }
  // ── 第 4 槽：超级武器。金色边框 + 倒计时环，只在不占常驻 3 槽 ──
  if (player.super) {
    const sx = VW - 286 + SLOTS * 55, sy = VH - 118;
    const on = player.superOn;
    const def = SUPER_WEAPONS[player.super.id];
    const k = clamp(player.super.t / def.dur, 0, 1);
    // 快没了就闪
    const blink = k < 0.25 ? 0.45 + 0.55 * Math.sin(G.time * 16) : 1;
    ctx.fillStyle = on ? `rgba(120,96,30,0.95)` : 'rgba(0,0,0,0.5)';
    ctx.fillRect(sx, sy, 48, 32);
    ctx.strokeStyle = `rgba(232,197,89,${blink})`;
    ctx.lineWidth = 2;
    ctx.strokeRect(sx + 0.5, sy + 0.5, 47, 31);
    // 倒计时环
    ctx.strokeStyle = `rgba(255,240,180,${blink})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(sx + 14, sy + 16, 10, -Math.PI / 2, -Math.PI / 2 + TAU * k); ctx.stroke();
    ctx.fillStyle = on ? '#ffe9a8' : '#c8a24a';
    ctx.font = 'bold 11px "Microsoft YaHei", sans-serif';
    ctx.fillText('4', sx + 32, sy + 13);
    ctx.font = '9px "Microsoft YaHei", sans-serif';
    ctx.fillText(def.name.slice(0, 4), sx + 30, sy + 26);
    // 每隔一段闪一次名字，提示"你手上还有这个"
    if (!on && Math.sin(G.time * 4) > 0.85) {
      ctx.font = 'bold 12px "Microsoft YaHei", sans-serif';
      ctx.fillStyle = 'rgba(232,197,89,0.8)';
      ctx.fillText('按 4 使用 ' + def.name, sx + 24, sy - 8);
    }
  }
  // 顶部：推进进度（到栅栏的距离）+ 击杀 + 金币
  const prog = clamp(player.x / G.fenceX, 0, 1);
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(VW / 2 - 160, 14, 320, 54);
  ctx.textAlign = 'center';
  ctx.font = 'bold 12px "Microsoft YaHei", sans-serif';
  ctx.fillStyle = G.cleared ? '#9fe8a8' : '#cfd6c8';
  ctx.fillText(G.cleared ? '已抵达安全区' : '推向栅栏', VW / 2 - 118, 33);
  const bx = VW / 2 - 56, bw = 200;
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(bx, 25, bw, 10);
  ctx.fillStyle = G.cleared ? '#6ad07a' : '#c8a24a';
  ctx.fillRect(bx + 1, 26, Math.max(0, (bw - 2) * prog), 8);
  ctx.fillStyle = '#e8e2c8';
  ctx.fillRect(bx + (bw - 4) * prog, 21, 3, 18);            // 玩家的位置标记
  ctx.fillStyle = G.cleared ? '#6ad07a' : '#8a9682';
  ctx.fillRect(bx + bw - 2, 20, 3, 20);                     // 右端 = 栅栏
  ctx.font = '11px "Microsoft YaHei", sans-serif';
  ctx.fillStyle = '#8a9682';
  ctx.fillText('击杀 ' + player.kills + '   ·   $' + player.cash, VW / 2, 57);
  // 门提示
  if (G.state === 'play' && !player.inside) {
    const h = nearDoorHouse();
    if (h && h.type === 'safe') {
      ctx.font = 'bold 13px "Microsoft YaHei", sans-serif';
      ctx.fillStyle = '#9fe8a8';
      ctx.fillText('[ ↑ ] 跳进屋 · 僵尸打不到你', VW / 2, GROUND - 130);
    }
  }
  // 屏幕外僵尸箭头
  for (const z of zombies) {
    const sx = z.x - cam.x + VW / 2;
    if (sx > -40 && sx < VW + 40) continue;
    const left = sx <= 0;
    const ax = left ? 26 : VW - 26;
    const col = z.type === 'giant' ? '#e07a3a' : '#d0402a';
    ctx.fillStyle = col;
    ctx.beginPath();
    if (left) { ctx.moveTo(ax - 12, 330); ctx.lineTo(ax + 8, 318); ctx.lineTo(ax + 8, 342); }
    else { ctx.moveTo(ax + 12, 330); ctx.lineTo(ax - 8, 318); ctx.lineTo(ax - 8, 342); }
    ctx.closePath(); ctx.fill();
    ctx.font = 'bold 11px "Microsoft YaHei", sans-serif';
    ctx.fillStyle = col;
    ctx.textAlign = left ? 'left' : 'right';
    ctx.fillText(z.type === 'giant' ? '巨型!' : Math.round(Math.abs(z.x - player.x)) + 'm', left ? 14 : VW - 14, 360);
  }
  // 横幅
  if (G.bannerT > 0) {
    const a = clamp(G.bannerT / 2.5, 0, 1);
    ctx.globalAlpha = Math.min(1, a * 2.2);
    ctx.textAlign = 'center';
    ctx.font = 'bold 42px "Microsoft YaHei", sans-serif';
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillText(G.banner, VW / 2 + 3, 180 + 3);
    ctx.fillStyle = '#e0d8c0';
    ctx.fillText(G.banner, VW / 2, 180);
    ctx.globalAlpha = 1;
  }
  drawBossBar();
  drawTutorial();

  // ── 感染模式标记：常驻左上角，免得打通关才发现自己开着 ──
  if (G_INF) {
    const p2 = 0.5 + 0.5 * Math.sin(G.time * 2.5);
    ctx.textAlign = 'left';
    ctx.font = 'bold 13px "Microsoft YaHei", sans-serif';
    ctx.fillStyle = `rgba(192,57,43,${0.65 + p2 * 0.35})`;
    ctx.fillText('☣ 感 染 模 式', 22, 100);
    ctx.font = '10px "Microsoft YaHei", sans-serif';
    ctx.fillStyle = 'rgba(200,140,130,0.75)';
    ctx.fillText('金币 ×2', 22, 116);
  }

  // ── 连杀 ──
  if (G.combo >= 3) {
    const a = clamp(G.comboT / 3, 0, 1);
    ctx.globalAlpha = 0.35 + a * 0.65;
    ctx.textAlign = 'center';
    ctx.font = 'bold 30px "Microsoft YaHei", sans-serif';
    ctx.fillStyle = G.combo >= 15 ? '#ff8a3a' : '#e8c559';
    ctx.fillText('x' + G.combo + ' 连杀', VW / 2, 122);
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(VW / 2 - 62, 132, 124, 5);
    ctx.fillStyle = '#e8c559';
    ctx.fillRect(VW / 2 - 61, 133, 122 * a, 3);
  }

  // ── 噪音计（左下角竖条）：开枪会把它推上去，僵尸会顺着声音来 ──
  const nz = clamp((G.noise || 0) / NOISE_MAX, 0, 1);
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(24, VH - 196, 15, 148);
  ctx.fillStyle = nz > 0.66 ? '#c0392b' : nz > 0.32 ? '#d8a03a' : '#4a7a4a';
  ctx.fillRect(26, VH - 194 + 144 * (1 - nz), 11, 144 * nz);
  ctx.textAlign = 'center';
  ctx.font = '10px "Microsoft YaHei", sans-serif';
  ctx.fillStyle = '#7d8a76';
  ctx.fillText('噪', 31, VH - 200);
  ctx.fillText('音', 31, VH - 189);
  if (nz > 0.66) {
    ctx.fillStyle = '#c0392b';
    ctx.font = 'bold 13px "Microsoft YaHei", sans-serif';
    ctx.fillText('!', 31, VH - 24);
  }

  // ── 闪避冷却 ──
  const dc = player.dodgeCd || 0;
  const dReady = dc <= 0;
  ctx.fillStyle = dReady ? 'rgba(118,200,140,0.85)' : 'rgba(0,0,0,0.55)';
  ctx.beginPath(); ctx.arc(VW - 348, VH - 42, 16, 0, TAU); ctx.fill();
  if (!dReady) {
    ctx.strokeStyle = '#7aa0c0'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(VW - 348, VH - 42, 16, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - dc / DODGE_CD)); ctx.stroke();
  }
  ctx.fillStyle = dReady ? '#0d1a0d' : '#6a7a8a';
  ctx.font = 'bold 9px "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('SHIFT', VW - 348, VH - 39);

  // ── 追逐者警告：它离得越近，顶部这条越红 ──
  if (G.stalker && !G.cleared) {
    const d = Math.abs(player.x - G.stalker.x);
    if (d < 1200) {
      const a = (1 - d / 1200) * 0.85;
      ctx.fillStyle = `rgba(190,20,16,${a})`;
      ctx.fillRect(0, 0, VW, 6);
      if (d < 520) {
        ctx.textAlign = 'center';
        ctx.font = 'bold 15px "Microsoft YaHei", sans-serif';
        ctx.fillStyle = `rgba(255,120,100,${0.5 + 0.5 * Math.sin(G.time * 8)})`;
        ctx.fillText('它就在后面', VW / 2, 92);
      }
    }
  }

  // 朝向指示（替代原来的鼠标准星）：脚下的箭头指出枪口方向
  const fx = player.x - cam.x + VW / 2;
  const fy = GROUND + 14;
  ctx.fillStyle = 'rgba(230,240,220,0.5)';
  ctx.beginPath();
  ctx.moveTo(fx + player.facing * 20, fy);
  ctx.lineTo(fx + player.facing * 7, fy - 6);
  ctx.lineTo(fx + player.facing * 7, fy + 6);
  ctx.closePath(); ctx.fill();
}
function drawNight() {
  const m = G.map || MAPS[0];
  if (m.blind) {
    // 地铁隧道：只看得清玩家周围一小圈。跳跃和声音就是你的第二双眼睛。
    const px = clamp(player.x - cam.x + VW / 2, -200, VW + 200);
    const py = clamp(GROUND - player.z - 44, -100, VH);
    const g = ctx.createRadialGradient(px, py, 34, px, py, 410);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.5, 'rgba(0,0,0,0.55)');
    g.addColorStop(1, 'rgba(0,0,0,0.95)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VW, VH);
  } else {
    const v = ctx.createRadialGradient(VW / 2, VH / 2, VH * 0.44, VW / 2, VH / 2, VH * 0.85);
    v.addColorStop(0, 'rgba(0,0,10,0)');
    v.addColorStop(1, `rgba(0,0,10,${clamp(m.fogAmt * 1.6, 0.2, 0.75)})`);
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, VW, VH);
  }
  if (G.hurtT > 0) {
    ctx.fillStyle = `rgba(140,10,5,${G.hurtT * 0.5})`;
    ctx.fillRect(0, 0, VW, VH);
  }
}
function draw() {
  ctx.save();
  const shx = rand(-G.shake, G.shake), shy = rand(-G.shake, G.shake) * 0.6;
  ctx.translate(Math.round(shx), Math.round(shy));
  drawSky();
  for (const h of houses) drawHouse(h);
  drawStreet();
  drawFloors();
  drawProps();
  drawHazards();
  drawFence();
  drawShelf();
  drawEntities();
  drawZProj();
  drawMeteors();
  drawStalker();
  drawSuper();      // 超级武器的世界层特效（光柱 / 直升机 / 黑洞 / 无人机）
  drawDrop();       // 空投箱
  drawStorm();
  drawAtmosphere();
  drawNight();
  ctx.restore();
  drawHUD();
}
