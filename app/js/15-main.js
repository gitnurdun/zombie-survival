// js/15-main.js —— 由 tools/split.js 从单文件版拆出。
// 分段：主循环

'use strict';
// ============================== 主循环 ==============================
let last = performance.now();
function loop(t) {
  const dt = Math.min(0.05, (t - last) / 1000);
  last = t;
  if (G.state === 'play' && !G.paused) update(dt);
  for (const k in pressed) delete pressed[k];   // 清空按键边沿量（必须在 update 之后）
  if (G.state !== 'menu') draw();
  else {
    ctx.fillStyle = '#0a0d08';
    ctx.fillRect(0, 0, VW, VH);
    cam.x = WORLD_W / 2;
    drawSky();
    for (const h of houses) drawHouse(h);
    drawStreet();
    drawFloors();
    drawProps();
    drawFence();
    drawShelf();
    drawNight();
  }
  requestAnimationFrame(loop);
}
resetGame();
requestAnimationFrame(loop);

// 测试钩子
window.__tg = {
  start: () => startLevel(G.wave || 1),
  state: () => G.state,
  wave: () => G.wave,
  spawn: t => spawnZombie(t),
  // step 直接驱动一帧，并像 loop() 那样清空按键边沿量
  step: dt => { update(dt); for (const k in pressed) delete pressed[k]; },
  player: () => player,
  zombies: () => zombies,
  bullets: () => bullets,
  items: () => items,
  coins: () => coins,
  parts: () => parts,
  cam: () => cam,
  houses: () => houses,
  props: () => props,
  damageHouse: (h, d) => damageHouse(h, d),
  damageProp: (p, d) => { const i = props.indexOf(p); if (i >= 0) damageProp(p, i, d); },
  next: () => startWave(G.wave + 1),
  waveClear: () => { zombies.length = 0; G.state = 'play'; },
  fenceX: () => G.fenceX,
  shelfX: () => G.shelfX,
  pickType: (p, lv) => pickZombieType(p, lv),
  // —— 地图 / 路段查询（给测试用）——
  maps: () => MAPS,
  mapCount: () => MAPS.length,
  mapAt: n => (MAPS[n - 1] || {}).name,
  timeAt: n => (MAPS[n - 1] || {}).time,
  noteAt: n => (MAPS[n - 1] || {}).note,
  skyAt: n => (MAPS[n - 1] || {}).sky || [],
  texAt: n => (MAPS[n - 1] || {}).tex,
  lampAt: n => (MAPS[n - 1] || {}).lamp,
  skyKindAt: n => (MAPS[n - 1] || {}).skyKind,
  propPoolAt: n => (MAPS[n - 1] || {}).props || [],
  segPoolAt: n => (MAPS[n - 1] || {}).segs || [],
  blindAt: n => !!(MAPS[n - 1] || {}).blind,
  rainAt: n => (MAPS[n - 1] || {}).rain || 0,
  sirenAt: n => (MAPS[n - 1] || {}).siren || 0,
  // —— 暂停 / 机关 ——
  mods: () => G.mods,
  gravity: () => G.gravity,
  jumpV: () => G.jumpV,
  wind: () => G.wind,
  paused: () => G.paused,
  togglePause: () => togglePause(),
  restart: () => restartLevel(),
  quitToLevels: () => quitToLevels(),
  gimmicks: () => GIMMICKS,
  planets: () => PLANETS,
  propKinds: () => PROP_KINDS,
  segDefs: () => SEGMENTS,
  sfxKeys: () => SFX,
  perkStats: () => P,
  infected: () => G_INF,
  infectedOn: () => !!S.infected,
  infectedUnlocked: () => infectedUnlocked(),
  // 只改存档 —— 和关卡选择里那个开关做的事完全一样。
  // G_INF 由 startLevel() 定死，不要在这里顺手改，否则测出来的是钩子不是游戏。
  setInfected: v => { S.infected = !!v; writeSave(); },
  infMuls: () => inf(),
  damagePropAt: (i, d) => { if (props[i]) damageProp(props[i], i, d); },
  perks: () => PERKS,
  chars: () => CHARS,
  charUnlocked: id => charUnlocked(id),
  achList: () => ACHIEVEMENTS,
  checkAch: run => checkAch(run),
  openChars: () => openChars(),
  openPerks: () => openPerks(),
  openCodex: () => openCodex(),
  renderCodex: t => { codexTab = t; renderCodex(); },
  codexTab: () => codexTab,
  weapons: () => WEAPONS,
  musicIntensity: () => Music.intensity,
  setMusicIntensity: v => Music.setIntensity(v),
  isLocked: n => isLocked(n),
  curMap: () => G.map,
  newTypesAt: n => newTypesAt(n),
  zprojs: () => zprojs,
  hazards: () => hazards,
  meteors: () => meteors,
  stalker: () => G.stalker,
  boss: () => G.boss,
  bossDone: () => G.bossDone,
  spawnBoss: () => spawnBoss(),
  setStalker: v => { G.stalker = v; },
  combo: () => G.combo,
  noise: () => G.noise,
  addNoise: v => addNoise(v),
  setNoise: v => { G.noise = v; },
  killAt: i => { if (zombies[i]) killZombie(zombies[i], i, false); },
  damageAt: (i, d) => { if (zombies[i]) damageZombie(zombies[i], i, d, false, 0); },
  explodeAt: (x, z, r, d) => explodeAt(x, z, { r, dmg: d }, GROUND - z),
  hitPlayer: d => hurtPlayer(d, 0),
  weather: () => G.weather,
  // 和 buildLevel 里做的事一样：把天气和它的乘数一起定下来。
  // 测试里用来消掉"两局各随机一次天气"带来的系统偏差。
  setWeather: k => { G.weather = k; G.wmods = WEATHERS[k] || WEATHERS.clear; },
  wmods: () => G.wmods,
  weathers: () => WEATHERS,
  affixes: () => AFFIXES,
  dayT: () => G.dayT,
  platformsMoving: () => floors.filter(f => f.move).length,
  dodge: () => ({ cd: player.dodgeCd, t: player.dodgeT }),
  ztypes: () => ZTYPES,
  cleared: () => G.cleared,
  result: () => ({ state: G.state, els: {} }),
  stars: () => starsFor(),
  save: () => S,
  openShelf: () => openShelf(),
  shelf: () => SH,
  shelfNav: d => shelfNav(d),
  shelfConfirm: () => shelfConfirm(),
  shelfUndo: () => shelfUndo(),
  shelfEquip: i => shelfEquipSlot(i),
  next: () => { G.wave = Math.min(LEVELS.length, G.wave + 1); resetGame(); G.state = 'play'; },
  startLevel: n => startLevel(n),
  winLevel: () => winLevel(),
  loseLevel: () => loseLevel(),
  setState: s => { G.state = s; },
  // 驱动一整帧（含绘制），用来冒烟测试渲染管线
  frame: t => loop(t),
  // 关掉遗留的波次清场逻辑（它会每帧重置安全屋状态）。距离刷怪系统上线后就不需要了。
  noWave: () => { G.noWave = true; },
  // —— 键盘模拟 ——
  hold: c => { keys[c] = true; },                  // 按住（电平）
  release: c => { keys[c] = false; },              // 松开
  tap: c => { keys[c] = true; pressed[c] = true; },// 点一下（边沿）
  // —— 超级武器空投 ——
  supers: () => SUPER_WEAPONS,
  superIds: () => SUPER_IDS,
  superState: () => player.super,
  superOn: () => !!player.superOn,
  drop: () => G.drop,
  panicDropped: () => !!G.panicDropped,
  rollSuper: () => rollSuperId(),
  equipSuper: id => equipSuper(id),
  tryDrop: c => tryDropSuper(c),
  takeDrop: () => takeDrop(),
  selectSuper: () => selectSuper(),
  curIdx: () => curIdx(),
  selectSlot: i => selectSlot(i),
  cycleSlot: () => cycleSlot(),
  interact: () => interact(),
  superFx: () => G.superFx,
  fireSuper: () => { const w = player.super && player.super.w; if (w) fireSuper(w); },
  curWeaponName: () => curWeapon().def.name,
  // —— 便利方法 ——
  giveWeapons: ids => { player.weapons = ids.map(id => makeWeapon(id)); player.slot = 0; },
  place: (x, z) => {
    player.x = x; player.z = z || 0;
    player.vz = 0; player.onGround = true;
    player.floor = floorAt(player.x, player.z + 1) || floors[0];
  },
  // —— 多层地形 ——
  floors: () => floors,
  addFloor: (x0, x1, z) => { const f = { x0, x1, z }; floors.push(f); return f; },
  clearFloors: () => { floors = [{ x0: 0, x1: WORLD_W, z: 0, base: true }]; },
  spawnAt: (t, x, z) => {
    spawnZombie(t);
    const zz = zombies[zombies.length - 1];
    zz.x = x; zz.z = z || 0;
    return zz;
  },
};
