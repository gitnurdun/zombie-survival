// js/07-world.js —— 由 tools/split.js 从单文件版拆出。
// 分段：投掷物 / 地面危险区（绘制） · 关卡末尾：栅栏 + 货架

'use strict';
// ============================== 投掷物 / 地面危险区（绘制） ==============================
function drawHazards() {
  for (const hz of hazards) {
    const sx = hz.x - cam.x + VW / 2;
    if (sx < -140 || sx > VW + 140) continue;
    const fade = clamp(hz.life / 1.2, 0, 1);
    const wob = Math.sin(hz.t * 6) * 3;
    if (hz.type === 'gas') {
      // 毒雾：一团不断翻滚、越摊越大的黄绿色气团，和贴地的酸池要一眼分得开
      ctx.globalAlpha = fade * 0.55;
      for (let k = 0; k < 6; k++) {
        const ph = hz.t * 0.9 + k * 1.05;
        const cx2 = sx + Math.cos(ph) * hz.r * 0.45;
        const cy2 = GROUND - 24 + Math.sin(ph * 1.3) * 14;
        const rr = hz.r * (0.45 + 0.18 * Math.sin(ph * 0.7));
        ctx.fillStyle = k % 2 ? 'rgba(150,200,70,0.55)' : 'rgba(110,170,60,0.45)';
        ctx.beginPath(); ctx.ellipse(cx2, cy2, rr, rr * 0.72, 0, 0, TAU); ctx.fill();
      }
      ctx.globalAlpha = fade * 0.30;
      ctx.fillStyle = '#c8e070';
      ctx.beginPath(); ctx.ellipse(sx, GROUND - 30 + wob, hz.r * 0.7, hz.r * 0.34, 0, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
    } else if (hz.type === 'fire') {
      ctx.globalAlpha = fade;
      for (let k = 0; k < 7; k++) {
        const bx = sx - hz.r * 0.7 + k * hz.r * 0.23 + Math.sin(hz.t * 7 + k) * 4;
        const bh = 22 + Math.sin(hz.t * 9 + k * 1.7) * 10;
        ctx.fillStyle = k % 2 ? 'rgba(255,150,40,0.75)' : 'rgba(255,90,20,0.6)';
        ctx.beginPath();
        ctx.moveTo(bx - 9, GROUND);
        ctx.quadraticCurveTo(bx - 4, GROUND - bh * 0.6, bx, GROUND - bh);
        ctx.quadraticCurveTo(bx + 4, GROUND - bh * 0.6, bx + 9, GROUND);
        ctx.closePath(); ctx.fill();
      }
      ctx.globalAlpha = 1;
    } else {
      ctx.globalAlpha = fade * 0.85;
      ctx.fillStyle = '#6aa02a';
      ctx.beginPath(); ctx.ellipse(sx, GROUND + 3, hz.r + wob, 11, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#9ad84a';
      ctx.beginPath(); ctx.ellipse(sx, GROUND + 1, hz.r * 0.6 + wob * 0.5, 6, 0, 0, TAU); ctx.fill();
      for (let k = 0; k < 3; k++) {     // 冒泡
        const bt = (hz.t * 1.6 + k * 0.33) % 1;
        ctx.globalAlpha = fade * (1 - bt) * 0.7;
        ctx.beginPath(); ctx.arc(sx - hz.r * 0.5 + k * hz.r * 0.5, GROUND - bt * 16, 3 + bt * 3, 0, TAU); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }
}
// 新手引导：第 1 关屏幕上逐步浮现按键提示，每完成一个动作就划掉一条。
// 不做独立的教程关 —— 那样既多维护一个关卡，又打断了节奏。
function drawTutorial() {
  const t = S.tut;
  if (G.wave !== 1 || !t || t.done) return;
  const list = [
    [!t.moved,   '← →',   '左右移动'],
    [!t.jumped,  '↑',     '跳跃（跳起来开枪 = 爆头）'],
    [!t.fired,   '空格',  '开火 / 挥砍'],
    [!t.entered, '↑',     '在亮绿灯的房子门口跳一下 = 进屋躲'],
    [!t.dodged,  'Shift', '翻滚（0.34 秒无敌，躲酸液和扑击）'],
  ].filter(x => x[0]).slice(0, 4);
  if (!list.length) return;
  const baseY = VH - 96;
  ctx.textAlign = 'left';
  list.forEach(([_, key, desc], i) => {
    const y = baseY + i * 24;
    const a = 0.55 + 0.35 * Math.sin(G.time * 3 - i * 0.7);   // 依次呼吸
    ctx.globalAlpha = 0.30 + a * 0.35;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(VW / 2 - 250, y - 15, 500, 21);
    ctx.globalAlpha = 0.75;
    ctx.font = 'bold 12px "Microsoft YaHei", sans-serif';
    ctx.fillStyle = '#e8c559';
    ctx.fillText(key, VW / 2 - 238, y);
    ctx.font = '12px "Microsoft YaHei", sans-serif';
    ctx.fillStyle = '#c9d4c0';
    ctx.fillText(desc, VW / 2 - 168, y);
  });
  ctx.globalAlpha = 1;
}

// 天气 + 昼夜：两次整屏叠加，画在所有东西之上、HUD 之下
function drawAtmosphere() {
  const W = G.wmods || { fogMul: 1 };
  if (W.col) { ctx.fillStyle = W.col; ctx.fillRect(0, 0, VW, VH); }
  if (W.lightning && Math.random() < 0.0045) { G.flashT = 0.28; SFX.giant(); }

  // 昼夜推进：越靠近栅栏天色越暗、边缘越沉
  const k = G.dayT || 0;
  if (k > 0.02 && !G.cleared) {
    ctx.fillStyle = `rgba(6,10,30,${k * 0.40})`;
    ctx.fillRect(0, 0, VW, VH);
    const v = ctx.createRadialGradient(VW / 2, VH / 2, VH * 0.30, VW / 2, VH / 2, VH * 0.95);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, `rgba(0,0,0,${k * 0.46})`);
    ctx.fillStyle = v; ctx.fillRect(0, 0, VW, VH);
  }
  // 雨 / 暴雨
  if (W.rain) {
    ctx.strokeStyle = 'rgba(180,200,220,0.22)'; ctx.lineWidth = 1.5;
    for (let i = 0; i < 62; i++) {
      const px = (i * 137 - cam.x * 0.6 + G.time * 280) % (VW + 120) - 60;
      const py = (i * 211 + G.time * 950) % VH;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px - 6, py + 24); ctx.stroke();
    }
  }
}
// 沙尘暴：整体加一层土黄 + 横向沙线（线条方向就是风的方向）
function drawStorm() {
  if (!G.mods || !G.mods.storm || G.cleared) return;
  const w = G.wind || 0;
  ctx.fillStyle = `rgba(206,178,120,${0.18 + Math.abs(w) / 78 * 0.10})`;
  ctx.fillRect(0, 0, VW, VH);
  ctx.strokeStyle = 'rgba(240,222,182,0.26)'; ctx.lineWidth = 2;
  for (let i = 0; i < 90; i++) {
    const px = (i * 173 - cam.x * 0.8 + G.time * (240 + w * 3)) % (VW + 220) - 110;
    const py = (i * 121 + G.time * 42) % VH;
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + 20 + w * 0.25, py + 2); ctx.stroke();
  }
}
function drawMeteors() {
  for (const mt of meteors) {
    const sx = mt.x - cam.x + VW / 2;
    if (sx < -80 || sx > VW + 80) continue;
    // 拖尾
    ctx.strokeStyle = 'rgba(255,150,60,0.35)'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(sx - mt.vy * 0.05, mt.y - mt.vy * 0.16); ctx.lineTo(sx, mt.y); ctx.stroke();
    ctx.save(); ctx.translate(sx, mt.y); ctx.rotate(mt.spin);
    ctx.fillStyle = '#4a4038';
    ctx.beginPath();
    for (let k = 0; k < 7; k++) {
      const a = k / 7 * TAU, rr = mt.r * (k % 2 ? 0.78 : 1);
      k ? ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#1e1a16'; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.fillStyle = 'rgba(255,140,50,0.55)';
    ctx.beginPath(); ctx.arc(-mt.r * 0.3, -mt.r * 0.3, mt.r * 0.4, 0, TAU); ctx.fill();
    ctx.restore();
  }
}
function drawZProj() {
  for (const q of zprojs) {
    const sx = q.x - cam.x + VW / 2;
    if (sx < -60 || sx > VW + 60) continue;
    if (q.elem === 'rock') {                       // Boss 阶段二掷的巨石
      ctx.save(); ctx.translate(sx, q.y); ctx.rotate(q.spin);
      ctx.fillStyle = '#5a5048';
      ctx.beginPath();
      for (let k = 0; k < 7; k++) { const an = k / 7 * TAU, rr = 16 * (k % 2 ? 0.8 : 1); k ? ctx.lineTo(Math.cos(an)*rr, Math.sin(an)*rr) : ctx.moveTo(Math.cos(an)*rr, Math.sin(an)*rr); }
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#2a241e'; ctx.lineWidth = 3; ctx.stroke();
      ctx.restore();
      const pulse2 = 0.5 + 0.5 * Math.sin(G.time * 8);
      ctx.fillStyle = "rgba(255,120,40," + (0.10 + pulse2 * 0.12) + ")";
      ctx.beginPath(); ctx.arc(sx, q.y, 30, 0, TAU); ctx.fill();
      continue;
    }
    if (q.elem === 'bone') {                       // 骨刺投手的骨头：翻滚着飞过来
      ctx.save(); ctx.translate(sx, q.y); ctx.rotate(q.spin);
      ctx.fillStyle = '#e8e4d4';
      ctx.fillRect(-13, -3, 26, 6);                                   // 骨干
      for (const e of [-1, 1]) {                                      // 两端的骨节
        ctx.beginPath(); ctx.arc(e * 12, -4, 4.5, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.arc(e * 12, 4, 4.5, 0, TAU); ctx.fill();
      }
      ctx.strokeStyle = '#a8a290'; ctx.lineWidth = 1.5;
      ctx.strokeRect(-13, -3, 26, 6);
      ctx.restore();
      ctx.strokeStyle = 'rgba(240,236,220,0.28)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(sx - q.vx * 0.04, q.y - q.vy * 0.04); ctx.lineTo(sx, q.y); ctx.stroke();
      continue;
    }
    if (q.elem === 'fire') {
      const fl = 1 + Math.sin(G.time * 18 + q.spin) * 0.35;
      ctx.fillStyle = 'rgba(255,160,50,0.7)';
      ctx.beginPath(); ctx.arc(sx, q.y - 8, 8 * fl, 0, TAU); ctx.fill();
      ctx.save(); ctx.translate(sx, q.y); ctx.rotate(q.spin);
      ctx.fillStyle = '#6a4a20'; ctx.fillRect(-6, -9, 12, 18);
      ctx.restore();
    } else {
      ctx.strokeStyle = 'rgba(140,220,60,0.35)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(sx - q.vx * 0.045, q.y - q.vy * 0.045); ctx.lineTo(sx, q.y); ctx.stroke();
      ctx.fillStyle = '#8fc03a';
      ctx.beginPath(); ctx.arc(sx, q.y, 8, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(190,255,110,0.6)';
      ctx.beginPath(); ctx.arc(sx - 2, q.y - 2, 4, 0, TAU); ctx.fill();
    }
  }
}

// ============================== 关卡末尾：栅栏 + 货架 ==============================
// 越过栅栏 = 本关结束（停刷僵尸）；再走一段就是武器货架（关卡结算商店）。
function drawFence() {
  const sx = G.fenceX - cam.x + VW / 2;
  if (sx < -240 || sx > VW + 400) return;
  const H = 156, top = GROUND - H;
  // 立柱
  ctx.fillStyle = '#4a3a24';
  for (let i = 0; i < 4; i++) ctx.fillRect(sx + i * 88 - 7, top, 14, H);
  // 横杆
  ctx.fillStyle = '#5e4a2e';
  ctx.fillRect(sx - 14, top + 20, 282, 14);
  ctx.fillRect(sx - 14, top + H - 54, 282, 14);
  // 铁丝网
  ctx.strokeStyle = 'rgba(180,190,200,0.26)'; ctx.lineWidth = 1.5;
  for (let i = 0; i < 19; i++) {
    const x = sx - 14 + i * 15;
    ctx.beginPath(); ctx.moveTo(x, top + 34); ctx.lineTo(x + 20, top + H - 40); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 20, top + 34); ctx.lineTo(x, top + H - 40); ctx.stroke();
  }
  // 牌子
  ctx.fillStyle = G.cleared ? '#7ad08a' : '#c8a24a';
  ctx.fillRect(sx + 36, top - 46, 182, 38);
  ctx.strokeStyle = '#2a1e0a'; ctx.lineWidth = 3;
  ctx.strokeRect(sx + 36, top - 46, 182, 38);
  ctx.fillStyle = '#2a1e0a';
  ctx.font = 'bold 18px "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('安 全 区', sx + 127, top - 20);
}
function drawShelf() {
  const sx = G.shelfX - cam.x + VW / 2;
  if (sx < -280 || sx > VW + 280) return;
  const W = 160, H = 134, top = GROUND - H;
  // 顶棚
  ctx.fillStyle = '#3a2c1c';
  ctx.fillRect(sx - W / 2 - 14, top - 18, W + 28, 18);
  // 架体
  ctx.fillStyle = '#5a4630';
  ctx.fillRect(sx - W / 2, top, W, H);
  ctx.strokeStyle = '#2e2418'; ctx.lineWidth = 4;
  ctx.strokeRect(sx - W / 2 + 2, top + 2, W - 4, H - 2);
  // 三层隔板 + 枪的剪影
  for (let r = 0; r < 3; r++) {
    const ry = top + 14 + r * 40;
    ctx.fillStyle = '#6e5638';
    ctx.fillRect(sx - W / 2 + 8, ry + 26, W - 16, 7);
    ctx.fillStyle = '#1e1e24';
    for (let k = 0; k < 3; k++) {
      const gx = sx - W / 2 + 24 + k * 40;
      const gh = 12 + ((k * 7 + r * 5) % 10);
      ctx.fillRect(gx, ry + 26 - gh, 30, 5);
      ctx.fillRect(gx + 6, ry + 26 - gh + 5, 8, 6);
    }
  }
  // 招牌
  ctx.fillStyle = '#e8c559';
  ctx.font = 'bold 20px "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('武 器 货 架', sx, top - 32);
  if (!G.shelfOpened) {
    const pulse = 0.5 + 0.5 * Math.sin(G.time * 4);
    ctx.fillStyle = `rgba(232,197,89,${0.10 + pulse * 0.10})`;
    ctx.beginPath(); ctx.arc(sx, GROUND - 46, 112, 0, TAU); ctx.fill();
  }
}

// 画成「悬空木板」而不是土坡 —— 因为僵尸是在最底层地面(z=0)走的，会从板子下面穿过去。
// 土坡造型会让僵尸看起来像穿模，悬空板就自然了。
function drawFloors() {
  const TH = 26;
  for (const f of floors) {
    if (f.base) continue;
    const x0 = f.x0 - cam.x + VW / 2, x1 = f.x1 - cam.x + VW / 2;
    if (x1 < -80 || x0 > VW + 80) continue;
    const ty = GROUND - f.z, w = x1 - x0;
    // 地面投影
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath(); ctx.ellipse((x0 + x1) / 2, GROUND + 4, w * 0.42, 9, 0, 0, TAU); ctx.fill();
    // 支撑柱
    ctx.fillStyle = '#2e2418';
    for (let i = 30; i < w - 30; i += 132) ctx.fillRect(x0 + i, ty + TH, 12, 48);
    // 板身
    ctx.fillStyle = '#4a3c2a';
    ctx.fillRect(x0, ty, w, TH);
    ctx.fillStyle = '#5c4b33';
    ctx.fillRect(x0, ty, w, 10);
    ctx.strokeStyle = '#241c12'; ctx.lineWidth = 3;
    ctx.strokeRect(x0 + 1.5, ty + 1.5, w - 3, TH - 3);
    // 顶面木纹
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    for (let i = 10; i < w - 16; i += 40) ctx.fillRect(x0 + i, ty + 3, 22, 3);
  }
}
