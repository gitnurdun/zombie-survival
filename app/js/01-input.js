// js/01-input.js —— 由 tools/split.js 从单文件版拆出。
// 分段：输入

'use strict';
// ============================== 输入 ==============================
// 纯键盘操作：没有鼠标瞄准，枪口只能水平指向玩家的朝向。
// keys = 电平量（按住期间一直为 true）；pressed = 边沿量（只在按下的那一帧为 true，在 loop() 末尾清空）
const keys = {};
const pressed = {};
const SLOTS = 3;   // 武器槽位数

// 当前选中位的序号。超级武器落在「第 4 槽」= 索引 SLOTS，
// 但 player.slot 本身永远只有 0~2 —— 这样下游所有 player.weapons[player.slot] 的读取都不用动。
function curIdx() { return player.superOn ? SLOTS : player.slot; }
function cycleSlot() {
  const n = SLOTS + (player.super ? 1 : 0);
  for (let k = 1; k <= n; k++) {
    const i = (curIdx() + k) % n;
    if (i === SLOTS) { if (player.super) { selectSuper(); return; } }
    else if (player.weapons[i]) { player.slot = i; player.superOn = false; SFX.swap(); return; }
  }
}
function selectSlot(i) {
  if (!player.weapons[i]) return;
  if (i === player.slot && !player.superOn) return;
  player.slot = i; player.superOn = false; SFX.swap();
}
function toggleMute() {
  if (!master) return;
  master.gain.value = master.gain.value > 0 ? 0 : 0.45;
  toast(master.gain.value > 0 ? '音效开启' : '音效静音');
}

window.addEventListener('keydown', e => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (!e.repeat) pressed[e.code] = true;
  keys[e.code] = true;
  if (e.code === 'KeyP' || e.code === 'Escape') {
    if (G.state === 'play') togglePause();
    else if (G.state === 'shelf') closeShelf();
    else if (G.state === 'result') openLevels();
    else if (G.state === 'menu') { hide('levels'); show('menu'); }
  }
  // R = 重开本关。只在暂停时生效 —— 游戏中途误按 R 会直接丢掉本局进度，太伤了。
  if (e.code === 'KeyR' && G.paused && !e.repeat) restartLevel();
  if (G.state === 'shelf') {
    // 货架：纯方向键驱动（↑↓ 切分类，←→ 选物品）
    if (e.code === 'ArrowLeft') shelfNav('left');
    else if (e.code === 'ArrowRight') shelfNav('right');
    else if (e.code === 'ArrowUp') shelfNav('up');
    else if (e.code === 'ArrowDown') shelfNav('down');
    else if (e.code === 'Enter') shelfConfirm();
    else if (e.code === 'KeyU') shelfUndo();
    else if (e.code === 'Digit1' || e.code === 'Digit2' || e.code === 'Digit3') {
      shelfEquipSlot(+e.code.slice(5) - 1);
    }
  } else if (G.state === 'play' && !G.paused) {
    if (e.code === 'KeyE') interact();
    if (e.code === 'KeyX') cycleSlot();
    if (e.code === 'Digit4') selectSuper();       // 第 4 槽 = 超级武器
    const d = ['Digit1', 'Digit2', 'Digit3'].indexOf(e.code);
    if (d >= 0) selectSlot(d);
  }
  if (e.code === 'KeyM') toggleMute();
});
window.addEventListener('keyup', e => { keys[e.code] = false; });
// 切窗口时清空按住的键，否则回来会一直朝那个方向跑
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
window.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('visibilitychange', () => {
  if (document.hidden && G.state === 'play' && !G.paused) togglePause();
});
