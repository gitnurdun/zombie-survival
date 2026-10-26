// js/00-core.js —— 由 tools/split.js 从单文件版拆出。
// 分段：（文件头） · 基础 · 多层地形


'use strict';
// ============================== 基础 ==============================
const VW = 1280, VH = 720;
const GROUND = 610;
// v2：从常量改成可变 —— 每个关卡按「路段拼接」的结果重新赋值（见 buildLevel）
let WORLD_W = 4400;
// 站在最低地面时的枪口高度 = GROUND - player.h + 34 = 570
const GUN_Y = GROUND - 74 + 34;
// 僵尸判定框在垂直方向上下各扩展这么多像素。
// 起因：子弹在几何上是一个点，而僵尸只有 60-70px 高。若按精确切片判定，
// 可爆头的跳跃高度窗口只有 ~18px（跳跃顶点却有 104px），得卡在起跳后 30ms 内开枪才打得到，
// 跳得稍高子弹还会从头顶飞过。放宽 70px 后，跳跃 / 站在高台上开枪都能稳定命中。
const V_TOL = 70;
// 站在高处开枪时，子弹在这么多水平距离内斜向下压回腰部高度（GUN_Y），之后恢复水平。
// 这样从高台或空中射击依然打得到地面的僵尸，视觉上也是"居高临下扫射"。
const FALL_DIST = 280;
// 层高（相邻两层的高度差）。一跳的最大高度是 vz²/(2g) = 560²/3000 ≈ 104.5px，
// 留约 16px 余量所以取 88 —— 再高就跳不上去了。
const FLOOR_H = 88;
// 闪避翻滚
const DODGE_SPD = 620, DODGE_CD = 1.15;
// 噪音：开枪会吸引僵尸，近战是安静的。0~100。
const NOISE_MAX = 100, NOISE_DECAY = 16;

// ============================== 多层地形 ==============================
// 平台 = 某个高度 z 上的一段可站立区间。z 越大越高（0 = 最低地面）。
// 最低地面本身也是一个铺满全图的平台，所以 floorAt 永远能返回至少一个结果。
let floors = [];
function floorAt(x, fromZ) {
  let best = null;
  for (const f of floors) {
    if (x < f.x0 || x > f.x1) continue;
    if (f.z > fromZ + 0.001) continue;   // 只考虑不高于 fromZ 的平台（脚下的）
    if (!best || f.z > best.z) best = f;
  }
  return best;
}
// 站在平台上的重力 —— 玩家和僵尸共用同一套逻辑。
// 只在下降时检测落地，所以从下面可以穿过平台往上跳；走出边缘会自由落体到更低的一层。
function stepOnFloors(e, dt, landSfx) {
  if (e.onGround) {
    const f = floorAt(e.x, e.z + 1);
    if (!f || f.z < e.z - 1) { e.onGround = false; e.vz = 0; }     // 脚下空了
  }
  if (!e.onGround) {
    const prevZ = e.z;
    e.vz -= (G.gravity || 1500) * dt;   // 低重力地图会改这个值（见 GIMMICKS）
    e.z += e.vz * dt;
    if (e.vz < 0) {
      const f = floorAt(e.x, prevZ);
      if (f && e.z <= f.z) {
        e.z = f.z; e.vz = 0; e.onGround = true; e.floor = f;
        if (landSfx) SFX.land();
      }
    }
  }
}
const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);
const irand = (a, b) => Math.floor(rand(a, b + 1));
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const choice = arr => arr[irand(0, arr.length - 1)];

const cvs = document.getElementById('game');
const ctx = cvs.getContext('2d');
function fitCanvas() {
  const s = Math.min(window.innerWidth / VW, window.innerHeight / VH);
  cvs.style.width = VW * s + 'px';
  cvs.style.height = VH * s + 'px';
}
window.addEventListener('resize', fitCanvas);
fitCanvas();
