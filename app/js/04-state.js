// js/04-state.js —— 由 tools/split.js 从单文件版拆出。
// 分段：状态 · 存档

'use strict';
// ============================== 状态 ==============================
const G = {
  state: 'menu', paused: false, time: 0, wave: 0,
  spawnT: 0,
  // 关卡推进：越过 fenceX = 本关结束（停刷）；再走到 shelfX = 开货架
  fenceX: 0, shelfX: 0, cleared: false, shelfOpened: false,
  banner: '', bannerT: 0, hurtT: 0, shake: 0, groanT: 3, flashT: 0,
  // —— 连杀 ——
  combo: 0, comboT: 0, bestCombo: 0,
  // —— 噪音：开枪会吸引僵尸，近战是安静的 ——
  noise: 0, noisePeak: 0,
  // —— 昼夜推进：0 = 开场天色，1 = 最暗 ——
  dayT: 0,
  // —— 天气（每局随机）——
  weather: 'clear',
  // —— 一直追着你的那只（杀不死的巨型僵尸）——
  stalker: null, stalkerOn: false,
};
let player, zombies, bullets, parts, coins, texts, decals, houses, arcs, items, cam, props;
// 僵尸投掷物（酸液/燃烧瓶）· 落地后的地面危险区 · 陨石（陨石带地图）
let zprojs, hazards, meteors;
const stars = [];
for (let i = 0; i < 90; i++) stars.push({ x: rand(0, VW * 2), y: rand(0, 320), s: rand(0.5, 1.8), tw: rand(0, TAU) });
const hills = [];
for (let x = 0; x < WORLD_W + VW; x += 130) hills.push({ x, h: rand(60, 170) });

// 把 lv[等级-1] 的覆盖字段合并进 w.def —— 于是所有 w.def.xxx 的读取
// （伤害、射速、弹速、弹丸数、弹药上限…）自动用上升级后的数值，
// 战斗代码一行都不用改。见 WEAPONS 顶部的说明。
function refreshWeapon(w) {
  w.def = Object.assign({}, w.base, w.base.lv[w.lv - 1] || {});
}
function makeWeapon(id, lv) {
  const w = { base: WEAPONS[id], lv: lv || 1, baseId: id, cd: 0 };
  refreshWeapon(w);
  // 冷兵器不耗弹；飞镖是"投掷后回收"，也不耗弹
  w.ammo = (w.def.melee || w.def.recover) ? Infinity : (w.def.startAmmo || 60);
  return w;
}
function upgradeWeapon(w) {
  if (w.lv >= w.base.lv.length) return false;
  w.lv++;
  refreshWeapon(w);          // 弹药留在 w.ammo 上，不受影响
  return true;
}
// 选中超级武器时返回它那个合成对象 —— HUD 的名字/弹药、attack() 的分支
// 全都走同一套读取，不用在别处再判断一次 superOn。
function curWeapon() {
  if (player.superOn && player.super) return player.super.w;
  return player.weapons[player.slot];
}

// ============================== 存档 ==============================
// 单一持久钱包：player.cash 是 S.cash 的访问器（见 resetGame），
// 所以打到的钱直接进存档、关卡失败也保留，不存在"本局钱 vs 存档钱"两本账。
const SAVE_KEY = 'zv2_save';
function defaultSave() {
  return {
    v: 1, cash: 50,
    owned: { bat: 1 },                 // 武器 id → 等级(1-3)，永久持有
    slots: ['bat', null, null],        // 3 个装备槽
    perkLv: {}, perkSlots: [null, null, null],
    chars: { hank: true }, curChar: 'hank', demonUnlocked: false,
    companionLv: 0,
    unlocked: 1,                       // 已解锁关卡数
    cleared: {},                       // 关卡号 → { stars, bestKills }
    infected: false,
    ach: {}, seen: { w: {}, z: {}, p: {} },
    tut: {},                          // 新手引导进度（第 1 关用）
    stats: { kills: 0, crits: 0, deaths: 0, levelsCleared: 0, propBreaks: 0, housesLost: 0 },
    cfg: { mute: false, music: true },
    level: 1,
  };
}
let S = defaultSave();
function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const o = JSON.parse(raw);
      S = Object.assign(defaultSave(), o);
      S.stats = Object.assign(defaultSave().stats, o.stats || {});
    }
  } catch (e) { S = defaultSave(); }
}
function writeSave() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) {} }

// ============================== 感染模式 ==============================
// 通关第 10 关解锁的二周目模式。四个乘数一次性列在这里，
// 战斗代码只读 inf() 的结果 —— 和 Perk 的聚合表同一套路子。
const INFECTED = { hpMul: 1.5, spdMul: 1.15, spawnMul: 0.8, cashMul: 2.0 };
const INFECTED_OFF = { hpMul: 1, spdMul: 1, spawnMul: 1, cashMul: 1 };
// 用一个冻结的开关值而不是到处读 S.infected：中途改设置不会让同一局前后不一致。
// 真正的值在 startLevel() 里定下来（见 14-ui.js）。
let G_INF = false;
function inf() { return G_INF ? INFECTED : INFECTED_OFF; }
// 解锁条件：打通过第 10 关（或测试阶段的全解锁开关打开）
function infectedUnlocked() { return TEST_UNLOCK_ALL || !!S.cleared[10] || S.unlocked > 10; }
