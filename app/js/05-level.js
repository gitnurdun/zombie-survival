// js/05-level.js —— 由 tools/split.js 从单文件版拆出。
// 分段：房屋 · 关卡构建 · 关卡 / 地图 · 路段库

'use strict';
// ============================== 房屋 ==============================
// ============================== 关卡构建 ==============================
// 关卡 =【头段·固定】+【中段·从地图的 segs 里随机抽 4~6 个】+【尾段·固定（空街 + 栅栏 + 货架）】
// 每张地图的 segs 组合决定了它的"地形性格"：医院是长走廊、学校是叠层、公路是天桥。
function buildLevel(m) {
  G.map = m;
  houses = []; floors = []; props = []; hazards = [];
  floors.push({ x0: 0, x1: 0, z: 0, base: true });     // 占位，最后统一铺满全图

  // 头段：出生点，先来一段没有高台的平地热身
  let x = placeSegment(SEG('head', [880, 880], 'none', 0.7, 0), 0, true);
  x = placeSegment(SEG('head2', [1040, 1040], 'single', 1.0, 1, 1), x, true);   // 头段保底 1 栋可进房

  // 中段：随机抽。forceSeg 是"保底路段" —— 保证这张图的核心地形一定会出现
  // （比如学校主打垂直，就必须有叠层段，不能因为随机抽不到而变成一张平地图）
  const n = irand(4, 6);
  const order = [];
  for (let i = 0; i < n; i++) order.push(choice(m.segs));
  if (m.forceSeg && n > 2) order[irand(1, n - 1)] = m.forceSeg;
  for (const sid of order) x = placeSegment(SEGMENTS[sid], x);

  // 尾段：一段空街 + 栅栏，再走 1500px 到货架（这段不刷僵尸，留长一点才有"到达"的感觉）
  x = placeSegment(SEG('tail', [760, 760], 'none', 0.5, 0), x, true);
  G.fenceX = x + 40;
  x += 1500;

  // 兜底：任何"主打开阔"的地图都可能随机出一栋可进的房子都没有。
  // 安全屋是这游戏的核心喘息点，不能看运气 —— 没有就把一栋危房改成可进的。
  if (!houses.some(h => h.type === 'safe' && !h.dead)) {
    const d = houses.find(h => h.type === 'deco');
    if (d) { d.type = 'safe'; d.hp = d.maxHp = 160; }
    else houses.push({ x: 620, w: 270, h: 215, type: 'safe', seed: Math.random(),
                       hp: 160, maxHp: 160, refreshes: 0, refreshT: 0, hitT: 0, dead: false });
  }

  WORLD_W = Math.round(x + 320);
  G.shelfX = WORLD_W - 260;
  floors[0].x1 = WORLD_W;                              // 最低地面铺满全图
  G.cleared = false; G.shelfOpened = false;
  G.boss = null; G.bossDone = false;

  // ── 应用这张地图的机关 ──
  const g = m.gimmick;
  G.mods = {
    lowGrav:  g === 'lowGrav',
    ice:      g === 'ice',
    storm:    g === 'storm',
    acidRain: g === 'acidRain',
    cold:     g === 'cold',
    meteor:   g === 'meteor',
  };
  // 低重力：重力减到 41%，起跳速度降一点 —— 结果是一跳更高、滞空翻倍
  G.gravity = g === 'lowGrav' ? 620 : 1500;
  G.jumpV   = g === 'lowGrav' ? 470 : 560;
  G.wind = 0; G.coldT = 0; G.rainT = undefined; G.meteorT = undefined;

  // ── 天气变体：同一张地图每局随机一种（室内图固定晴天）──
  G.weather = rollWeather(m);
  G.wmods = WEATHERS[G.weather] || WEATHERS.clear;

  // ── 一直追着你的那只 ──
  G.stalkerOn = !!m.stalker;
  G.stalker = null;
  if (G.stalkerOn) spawnStalker();

  // 地图自带的永久危险区（加油站/隧道/研究所）
  for (let i = 0; i < (m.hazards || 0); i++) {
    hazards.push({
      type: Math.random() < 0.6 ? 'acid' : 'fire',
      x: rand(1500, Math.max(1800, G.fenceX - 700)),
      z: 0, r: 54, t: 0, tick: 0, life: 99999,
    });
  }
}
function SEG(name, w, floors, props, houses, forceSafe) {
  return { name, w, floors, props, houses, forceSafe: forceSafe || 0 };
}

// 铺一个路段，返回这一段结束时的世界 x
function placeSegment(seg, x0, noMovers) {
  const m = G.map;
  const w = irand(seg.w[0], seg.w[1]);
  const wall = x0 + 40, warr = x0 + w - 40;
  const F1 = FLOOR_H, F2 = FLOOR_H * 2;
  const c = (wall + warr) / 2;

  // ── 1) 先放房屋 ──
  // 有高台的路段把场地一分为二：房子占左半边、高台占右半边。
  // （之前是先放高台再放房子，结果房子每次都因为"高台不压房屋"的避让被全部跳过 ——
  //   实测关卡 1/2/3/6/8/10 一栋房子都没有。）
  const both = seg.houses > 0 && seg.floors !== 'none';
  const hZone = both ? [wall, c - 30] : [wall, warr];
  const fZone = both ? [c + 30, warr] : [wall, warr];
  const doorPad = [];
  for (let i = 0; i < seg.houses; i++) {
    const hw2 = irand(230, 300);
    const room = (hZone[1] - hZone[0]) - 120 - hw2;
    if (room < 0 && !both) break;
    const hx = room >= 0
      ? hZone[0] + 60 + room * (i + 0.5) / seg.houses + rand(-35, 35)
      : c - hw2 / 2;                                   // 实在放不下就压中线
    // forceSafe 指定的前几栋一定是可进的（头段保证每关至少有地方躲）
    const type = (i < (seg.forceSafe || 0)) ? 'safe' : (Math.random() < 0.78 ? 'safe' : 'deco');
    houses.push({
      x: hx, w: hw2, h: irand(190, 240), type, seed: Math.random(),
      hp: type === 'safe' ? 160 : 0, maxHp: 160,
      refreshes: 0, refreshT: 0, hitT: 0, dead: false,
    });
    doorPad.push(hx + hw2 / 2);
  }

  // ── 2) 再放高台（在自己的半区里，顺带避开已经放好的房子）──
  // 两成的平台会变成"移动平台"：竖直升降的工地电梯 / 左右滑动的吊桥。
  // 只在中间路段开，而且只在单层形态上 —— 免得和叠层的上层打架。
  const canMove = !noMovers && ['one', 'single', 'bridge', 'towers'].includes(seg.floors);
  const moveP = m.movers === undefined ? 0.55 : m.movers;
  const push = (a, b, z) => {
    if (b - a < 180) return;
    if (houses.some(h => b > h.x - 90 && a < h.x + h.w + 90)) return;
    const f = { x0: a, x1: b, z, seed: Math.random() };
    if (canMove && Math.random() < moveP) {
      // 水平滑动的平台只在左右都有空地时才开，免得滑进房子里
      const roomX = !houses.some(h => (a - 155) < h.x + h.w + 70 && (b + 155) > h.x - 70);
      if (roomX && Math.random() < 0.45) {
        f.move = { axis: 'x', range: rand(60, 130), spd: rand(0.5, 1.1) };
        f.x0Base = a; f.w = b - a;
      } else {
        f.move = { axis: 'y', range: rand(26, 58), spd: rand(0.7, 1.5) };
        f.z0 = z;
      }
      f.t = rand(0, TAU);
    }
    floors.push(f);
  };
  const [fa, fb] = fZone;
  const fc = (fa + fb) / 2;
  switch (seg.floors) {
    case 'one':    { const hw = Math.min(rand(140, 240), (fb - fa) / 2 - 20); push(fc - hw, fc + hw, F1); break; }
    case 'single': { const bw = Math.min(rand(320, 460), fb - fa); push(fc - bw / 2, fc + bw / 2, F1); break; }
    case 'stack':  { const hw = Math.min(rand(170, 260), (fb - fa) / 2 - 20);
                     push(fc - hw, fc + hw, F1);
                     push(fc - hw * 0.62, fc + hw * 0.62, F2); break; }
    case 'valley': { const gap = rand(260, 420);
                     push(fa, fc - gap / 2, F1); push(fc + gap / 2, fb, F1); break; }
    case 'bridge': { push(fa, fb, F1); break; }
    case 'towers': { const tw = Math.min(rand(150, 220), (fb - fa) / 2 - 60);
                     push(fa + 40, fa + 40 + tw, F1);
                     push(fb - 40 - tw, fb - 40, F1); break; }
    default: break;   // 'none'
  }

  // ── 可破坏物件：按固定节奏铺，保证弹药来源（商店不卖弹药，不能看运气）──
  // 过滤掉拼错的 id，避免整关卡死
  const pool   = m.props.filter(id => PROP_KINDS[id]);
  const solids = pool.filter(id => PROP_KINDS[id].solid);
  const deco   = pool.filter(id => !PROP_KINDS[id].solid);
  if (solids.length) {
    const cell = Math.max(150, Math.round(215 / seg.props));
    let ci = 0;
    for (let px = wall; px < warr; px += cell) {
      if (doorPad.some(d => Math.abs(px - d) < 92)) continue;
      const id = solids[ci++ % solids.length];
      const d = PROP_KINDS[id];
      props.push({ kind: id, def: d, x: px + rand(-28, 28), z: 0, w: d.w, h: d.h,
                   hp: d.hp || 1, maxHp: d.hp || 1, hitT: 0, seed: Math.random() });
    }
  }
  // ── 装饰：随机撒 ──
  if (deco.length) {
    for (let px = wall; px < warr; px += irand(170, 350)) {
      if (doorPad.some(d => Math.abs(px - d) < 72)) continue;
      const id = choice(deco);
      const d = PROP_KINDS[id];
      props.push({ kind: id, def: d, x: px, z: 0, w: d.w, h: d.h,
                   hp: 1, maxHp: 1, hitT: 0, seed: Math.random() });
    }
  }
  // ── 高台上也放点东西，玩家才有动力跳上去 ──
  if (solids.length) {
    for (const f of floors) {
      if (f.base || f.x0 < x0 || f.x1 > x0 + w) continue;
      const num = Math.max(1, Math.floor((f.x1 - f.x0) / 280));
      for (let i = 0; i < num; i++) {
        const px = f.x0 + 80 + (f.x1 - f.x0 - 160) * (i + 0.5) / num;
        const id = choice(solids);
        const d = PROP_KINDS[id];
        props.push({ kind: id, def: d, x: px, z: f.z, w: d.w, h: d.h,
                     hp: d.hp || 1, maxHp: d.hp || 1, hitT: 0, seed: Math.random() });
      }
    }
  }
  return x0 + w;
}
function doorOf(h) { return { x: h.x + h.w / 2, w: 52, h: 96 }; }

// 高台撒点。正式的「路段系统」（固定头段 + 随机中段 + 固定尾段）会替换掉它，
// 但先把层高、跳跃手感、绘制跑通。
// 高台的摆放已经移进 placeSegment() —— 每个路段自带 floors 形态（none/one/stack/valley/
// bridge/towers），不再依赖"随机撒点 + 撞到房子就让位"。之前那种写法出现过整关 0 块高台，
// 路段化之后这个问题从结构上就不存在了。
// ============================== 关卡 / 地图 ==============================
// 每张地图有独立的：天空色板、地面材质、路灯样式、可破坏物件池、路段组合、危险区数量。
// skyKind: outdoor（户外，画天空+远景）/ tunnel（地铁洞壁）/ lab（室内墙面）
// tex:    ground 的纹理画法   lamp: 路灯样式
const MAPS = [
  { n:1, name:'村庄小径', diff:'★', time:'黄昏 · 晴',
    note:'教学关。地形平缓、房子多，先熟悉跳跃进屋和打碎道具补给。',
    skyKind:'outdoor', sky:['#2a1a2e','#6b3328','#c8722f'], skyline:'#2a1e18', hills:true,
    stars:0, moon:0, cloud:0, fogCol:'70,52,36', fogAmt:0.26,
    ground:'#40372a', road:'#4e4232', tex:'dirt', lamp:'street', lampCol:'#ffd88a',
    segs:['open','deck','deck','yard','clutter'], forceSeg:'deck', props:['grass','bush','pot','trash','crate','tomb','hay'],weather:['clear','rain','fog'], hazards:0, blind:false },

  { n:2, name:'玉米农场', diff:'★★', time:'正午 · 烈日',
    note:'开阔、掩体少，僵尸从很远就能看见你。干草堆和玉米秆是唯一能挡子弹的东西。',
    skyKind:'outdoor', sky:['#3f7fc4','#79b0dd','#cfe2ee'], skyline:'#4a6a3a', hills:true,
    stars:0, moon:0, cloud:1, fogCol:'200,215,230', fogAmt:0.14,
    ground:'#6b5a2e', road:'#7d6a38', tex:'dirt', lamp:'none',
    segs:['open','open','clutter','deck','valley'], props:['corn','hay','grass','bush','crate'],weather:['clear','fog'], hazards:0, blind:false },

  { n:3, name:'废弃公路', diff:'★★', time:'阴天',
    note:'笔直的柏油路，卡车顶连成一线。视野极好，但也意味着没有遮蔽。',
    skyKind:'outdoor', sky:['#4a4f57','#6b7078','#9aa0a6'], skyline:'#3a3e44', hills:true,
    stars:0, moon:0, cloud:0, fogCol:'120,124,130', fogAmt:0.30,
    ground:'#2e2e30', road:'#3a3a3c', tex:'asphalt', lamp:'street', lampCol:'#c8d0d8',
    segs:['bridge','stack','open','corridor','clutter'], forceSeg:'stack', props:['carWreck','barrel','barrier','tire','trash','grass'],
    weather:['fog','rain','clear'], stalker:true,

    hazards:0, blind:false },

  { n:4, name:'加油站便利店', diff:'★★★', time:'深夜 · 霓虹',
    note:'油罐会爆，别站在旁边开枪。霓虹灯是这片黑里唯一的坐标。',
    skyKind:'outdoor', sky:['#080c1c','#141c34','#28304a'], skyline:'#121828', hills:true,
    stars:1, moon:1, cloud:0, fogCol:'30,40,70', fogAmt:0.30,
    ground:'#2a2a2e', road:'#34343a', tex:'asphalt', lamp:'neon', lampCol:'#ff6ab0',
    segs:['corridor','block','clutter','deck','open'], props:['fuelTank','shelf','freezer','barrel','trash','crate','neon'],weather:['clear','night'], hazards:1, blind:false },

  { n:5, name:'镇上医院', diff:'★★★', time:'雨夜',
    note:'长走廊 + 病房隔间，狭窄地形里近战比枪好用。医护兵就困在这里。',
    skyKind:'outdoor', sky:['#0c1018','#161e2c','#243040'], skyline:'#0e1420', hills:true,
    stars:0, moon:0, cloud:0, fogCol:'70,90,110', fogAmt:0.40, rain:1,
    ground:'#3e4448', road:'#4a5054', tex:'tile', lamp:'fluorescent', lampCol:'#cfe8f0',
    segs:['corridor','stack','block','towers','valley'], forceSeg:'stack', props:['bed','cabinet','trash','crate','glass'],weather:['rain','storm'], hazards:0, blind:false },

  { n:6, name:'中学操场', diff:'★★★★', time:'清晨',
    note:'跑道 + 双层教学楼。高台最多的一张图，跳上跳下的走位空间最大。',
    skyKind:'outdoor', sky:['#5a4a7a','#a06a80','#e8a878'], skyline:'#4a3a52', hills:true,
    stars:0, moon:0, cloud:1, fogCol:'200,170,170', fogAmt:0.18,
    ground:'#8a3a34', road:'#9c443c', tex:'track', lamp:'street', lampCol:'#ffd0a0',
    segs:['deck','stack','towers','stack','bridge','block'], forceSeg:'stack', props:['locker','desk','hoop','trash','crate','grass'],weather:['clear','fog'], hazards:0, blind:false },

  { n:7, name:'警察局', diff:'★★★★', time:'夜 · 警灯',
    note:'武器柜给弹药，拘留室给你躲避的空间。警灯一直在闪，注意别被晃花。',
    skyKind:'outdoor', sky:['#0a0e1a','#141a2e','#20283c'], skyline:'#0e1220', hills:true,
    stars:1, moon:0, cloud:0, fogCol:'30,40,70', fogAmt:0.30, siren:1,
    ground:'#34383e', road:'#40444a', tex:'tile', lamp:'fluorescent', lampCol:'#dfe8f0',
    segs:['corridor','block','corridor','deck','clutter'], props:['policeCar','locker','desk','trash','crate','barrier'],weather:['clear','night'], hazards:0, blind:false },

  { n:8, name:'军事检查站', diff:'★★★★★', time:'黎明',
    note:'沙袋掩体阵 + 铁丝网。僵尸从两侧同时压过来，沙袋挡子弹也挡它们。',
    skyKind:'outdoor', sky:['#1e2a3e','#4a5a6e','#c08a5a'], skyline:'#2a3444', hills:true,
    stars:0, moon:0, cloud:0, fogCol:'110,120,140', fogAmt:0.28,
    ground:'#6a5f48', road:'#79704f', tex:'sand', lamp:'none',
    segs:['open','bridge','clutter','open','towers','block'], props:['sandbag','ammoBox','barrel','barrier','tire','grass'],weather:['fog','clear'], hazards:0, blind:false },

  { n:9, name:'地铁隧道', diff:'★★★★★', time:'地下 · 无光',
    note:'视野受限 —— 只能看清手电筒范围。声音是你的第二个眼睛。',
    skyKind:'tunnel', sky:['#05070a','#0a0e14','#121820'], skyline:'#0a0e14', hills:false,
    stars:0, moon:0, cloud:0, fogCol:'10,14,20', fogAmt:0.5,
    ground:'#2a2c30', road:'#33353a', tex:'concrete', lamp:'fluorescent', lampCol:'#8fd0e0',
    segs:['corridor','corridor','valley','clutter','bridge'], props:['bench','gate','trash','tire','crate'],
    hazards:1, blind:true },

  { n:10, name:'生化研究所', diff:'★★★★★★', time:'室内 · 冷白',
    note:'最终关。培养舱、多层实验区，以及走廊尽头的病毒源头。',
    skyKind:'lab', sky:['#0e1418','#161e24','#1e2a32'], skyline:'#131a20', hills:false,
    stars:0, moon:0, cloud:0, fogCol:'20,30,40', fogAmt:0.35,
    ground:'#3a4248', road:'#454e56', tex:'panel', lamp:'fluorescent', lampCol:'#a8e0ff',
    segs:['stack','block','corridor','towers','deck','stack'], forceSeg:'stack', props:['pod','labTable','sample','cabinet','crate','tire'], boss:true,
    hazards:1, blind:false },

  // ══════════════════ 第二幕：离开地球 ══════════════════
  // planet 决定关卡选择里的分组；biome 是地貌标签；gimmick 是这张图独有的机关。
  { n:11, planet:'earth', biome:'雪地', name:'雪原公路', diff:'★★★★★★', time:'暴雪 · 白昼',
    note:'脚下随时在打滑，急停是奢侈。雪堆能挡子弹，也藏着补给。',
    gimmick:'ice',
    skyKind:'outdoor', sky:['#5c6c82','#8a9aac','#cfd8e0'], skyline:'#6a7684', hills:true,
    stars:0, moon:0, cloud:1, fogCol:'220,230,242', fogAmt:0.44, rain:1,
    ground:'#b8c4d0', road:'#ccd6e0', tex:'sand', lamp:'street', lampCol:'#e8f0ff',
    segs:['bridge','open','valley','deck','clutter','towers'], forceSeg:'bridge',
    props:['hay','crate','barrel','tire','trash','grass'], weather:['storm','fog','clear'], hazards:0, blind:false },

  { n:12, planet:'earth', biome:'山地', name:'山林小径', diff:'★★★★★★', time:'清晨 · 薄雾',
    note:'全图地形起伏最大的一张。高台连着高台，会走位就能一直待在头顶。',
    gimmick:null,
    skyKind:'outdoor', sky:['#3a5a44','#6a8a6a','#a8c0a0'], skyline:'#2e4a36', hills:true,
    stars:0, moon:0, cloud:1, fogCol:'160,190,165', fogAmt:0.36,
    ground:'#3a4a2e', road:'#46582f', tex:'dirt', lamp:'none',
    segs:['towers','stack','valley','towers','bridge','stack'], forceSeg:'towers',
    props:['grass','bush','corn','crate','hay','trash'], weather:['fog','clear','rain'], hazards:0, blind:false },

  { n:13, planet:'earth', biome:'沙漠', name:'沙漠公路', diff:'★★★★★★', time:'午后 · 沙尘',
    note:'风一直把你往一边推，弹道也会被吹偏。能见度差，僵尸到跟前才看得见。',
    gimmick:'storm',
    skyKind:'outdoor', sky:['#a07a44','#c8a468','#e8d0a0'], skyline:'#8a6a3c', hills:true,
    stars:0, moon:0, cloud:0, fogCol:'210,180,130', fogAmt:0.52,
    ground:'#b09a68', road:'#c2aa74', tex:'sand', lamp:'none',
    segs:['open','open','bridge','clutter','valley','towers'],
    props:['barrier','tire','crate','barrel','sandbag','grass'], weather:['clear','fog'], hazards:1, blind:false },

  { n:14, planet:'earth', biome:'洞穴', name:'地下洞穴', diff:'★★★★★★', time:'地下 · 深穴',
    note:'伸手不见五指，只有手电范围。地形高低落差大，掉下去要绕回来。',
    gimmick:null, blind:true,
    skyKind:'tunnel', sky:['#0a0806','#14100c','#201a14'], skyline:'#100c08', hills:false,
    stars:0, moon:0, cloud:0, fogCol:'10,8,6', fogAmt:0.6,
    ground:'#2e2820', road:'#39322a', tex:'concrete', lamp:'fluorescent', lampCol:'#c8a060',
    segs:['valley','corridor','towers','valley','clutter','stack'],
    props:['tomb','crate','barrel','tire','trash','grass'], stalker:true, hazards:1, blind:true },

  { n:15, planet:'moon',  biome:'月面', name:'月球基地', diff:'★★★★★★', time:'月球 · 静海',
    note:'重力只有地球的六分之一 —— 一跳老高、落得老慢，整张图的节奏都变了。',
    gimmick:'lowGrav',
    skyKind:'outdoor', sky:['#05060c','#0a0c16','#141826'], skyline:'#0e1018', hills:true,
    stars:1, moon:0, cloud:0, fogCol:'30,34,50', fogAmt:0.16,
    ground:'#8a8a92', road:'#9a9aa2', tex:'sand', lamp:'fluorescent', lampCol:'#dfe8ff',
    segs:['towers','stack','bridge','open','towers','deck'], forceSeg:'towers',
    props:['crate','barrel','tire','trash','labTable','pod'], hazards:0, blind:false },

  { n:16, planet:'mars',  biome:'荒漠', name:'火星红沙', diff:'★★★★★★', time:'火星 · 尘暴',
    note:'沙尘暴加上陨石雨。天上掉石头的时候，找个高台底下躲着。',
    gimmick:'meteor',
    skyKind:'outdoor', sky:['#5a2a1a','#8a4526','#c8703a'], skyline:'#4a2014', hills:true,
    stars:0, moon:0, cloud:0, fogCol:'190,110,70', fogAmt:0.44,
    ground:'#7a3a22', road:'#8e4629', tex:'sand', lamp:'none',
    segs:['open','valley','towers','clutter','bridge','yard'],
    props:['crate','barrel','tire','sandbag','labTable','tomb'], weather:['clear','storm'], hazards:1, blind:false },

  { n:17, planet:'venus', biome:'酸雨', name:'金星酸雨', diff:'★★★★★★', time:'金星 · 酸云',
    note:'酸雨一阵一阵地落，地面会一片片变成腐蚀区。永远在找下一块干净的地。',
    gimmick:'acidRain',
    skyKind:'outdoor', sky:['#3a3a12','#6a6a20','#a8a838'], skyline:'#2e2e0e', hills:true,
    stars:0, moon:0, cloud:1, fogCol:'170,170,70', fogAmt:0.52, rain:1,
    ground:'#4a4a22', road:'#56562a', tex:'dirt', lamp:'none',
    segs:['corridor','deck','clutter','valley','stack','block'],
    props:['barrel','fuelTank','crate','tomb','bush','trash'], hazards:1, blind:false },

  { n:18, planet:'jupiter', biome:'轨道站', name:'木星轨道站', diff:'★★★★★★', time:'空间站 · 人造重力',
    note:'站内重力没调好 —— 走起来轻飘飘的。金属地板会把脚步声传得很远。',
    gimmick:'lowGrav',
    skyKind:'lab', sky:['#0c1020','#141a30','#1e2844'], skyline:'#101828', hills:false,
    stars:0, moon:0, cloud:0, fogCol:'30,44,80', fogAmt:0.30,
    ground:'#3a4458', road:'#454f66', tex:'panel', lamp:'fluorescent', lampCol:'#8fb8ff',
    segs:['stack','corridor','block','stack','yard','deck'], forceSeg:'stack',
    props:['labTable','sample','cabinet','locker','crate','pod'], hazards:1, blind:false },

  { n:19, planet:'saturn', biome:'碎片带', name:'土星碎片带', diff:'★★★★★★', time:'星环 · 碎石',
    note:'漂浮的碎石不断砸下来，落地还会烧一阵。整张图没有真正安全的地方。',
    gimmick:'meteor',
    skyKind:'outdoor', sky:['#0a0a12','#1a1428','#3a2e4a'], skyline:'#141020', hills:true,
    stars:1, moon:0, cloud:0, fogCol:'60,50,90', fogAmt:0.30,
    ground:'#4a4458', road:'#565068', tex:'concrete', lamp:'fluorescent', lampCol:'#c8b0ff',
    segs:['bridge','towers','open','stack','valley','towers'], forceSeg:'bridge',
    props:['crate','barrel','labTable','sample','tire','trash'], weather:['clear','night'], stalker:true, hazards:1, blind:false },

  { n:20, planet:'titan', biome:'甲烷湖', name:'泰坦甲烷湖', diff:'★★★★★★', time:'泰坦 · 橙雾',
    note:'湖面结了冰，冰下面是不该踩的东西。滑，而且一滑就滑进湖里。',
    gimmick:'ice',
    skyKind:'outdoor', sky:['#4a3418','#7a5526','#c08a44'], skyline:'#3a2a14', hills:true,
    stars:0, moon:0, cloud:1, fogCol:'200,140,70', fogAmt:0.46,
    ground:'#6a5a34', road:'#7a683c', tex:'sand', lamp:'none',
    segs:['bridge','valley','clutter','open','bridge','deck'], forceSeg:'bridge',
    props:['barrel','crate','fuelTank','tomb','bush','tire'], weather:['fog','clear'], hazards:2, blind:false },

  { n:21, planet:'pluto', biome:'冰原', name:'冥王星冰原', diff:'★★★★★★', time:'冥王星 · 极夜',
    note:'零下两百度。血一直在掉，只能靠打碎补给自己续命 —— 别磨蹭。',
    gimmick:'cold',
    skyKind:'outdoor', sky:['#04060c','#080e1a','#101828'], skyline:'#080c14', hills:true,
    stars:1, moon:1, cloud:0, fogCol:'40,60,90', fogAmt:0.26,
    ground:'#8a9aa8', road:'#9aaab8', tex:'tile', lamp:'street', lampCol:'#cfe8ff',
    segs:['open','bridge','towers','open','stack','valley'], forceSeg:'bridge',
    props:['crate','trash','barrel','tire','hay','bush'], weather:['clear','night'], stalker:true, hazards:0, blind:false },

  { n:22, planet:'deep',  biome:'深空', name:'深空观察站', diff:'★★★★★★', time:'深空 · 静默',
    note:'最后的地方。陨石、低重力、还有走廊尽头那个东西 —— 全都在这儿等你。',
    gimmick:'meteor',
    skyKind:'lab', sky:['#050510','#0c0a1c','#161428'], skyline:'#0a0818', hills:false,
    stars:1, moon:0, cloud:0, fogCol:'30,26,60', fogAmt:0.34,
    ground:'#2e2a44', road:'#383352', tex:'panel', lamp:'fluorescent', lampCol:'#b090ff',
    segs:['stack','towers','block','bridge','corridor','stack'], forceSeg:'stack', boss:true,
    props:['pod','sample','labTable','cabinet','crate','tire'], stalker:true, hazards:2, blind:true },
];

// 星球分组（关卡选择界面按这个分组显示）
const PLANETS = [
  { id:'earth',  name:'地 球',       desc:'村庄、农场、公路 —— 一切开始的地方' },
  { id:'moon',   name:'月 球',       desc:'六分之一重力，一跳老高' },
  { id:'mars',   name:'火 星',       desc:'红色荒漠，沙尘与陨石' },
  { id:'venus',  name:'金 星',       desc:'硫酸云层下的窒息之地' },
  { id:'jupiter',name:'木星轨道',    desc:'人造重力没调好的空间站' },
  { id:'saturn', name:'土星',        desc:'星环里的碎石带' },
  { id:'titan',  name:'泰 坦',       desc:'甲烷湖，一滑就进去' },
  { id:'pluto',  name:'冥王星',      desc:'零下两百度的极夜冰原' },
  { id:'deep',   name:'深 空',       desc:'离太阳最远的一个站' },
];

// ============================== 关卡机关 ==============================
// 每张地图独有的全局修正。低重力/冰面直接改物理，其余是周期性的。
const GIMMICKS = {
  lowGrav:  { name:'低重力', desc:'跳跃更高、滞空更久' },
  ice:      { name:'冰面',   desc:'脚下打滑，起步和急停都变难' },
  storm:    { name:'沙尘暴', desc:'能见度降低，横向风一直在推你' },
  acidRain: { name:'酸雨',   desc:'每隔几秒地表落下一片酸池' },
  cold:     { name:'极寒',   desc:'持续掉血（最低掉到 5），逼你找补给' },
  meteor:   { name:'陨石带', desc:'天上不断掉陨石，落地还留一团火' },
};

// ============================== 路段库 ==============================
// 关卡 =【头段·固定】+【中段·从地图的 segs 里随机抽】+【尾段·固定（栅栏+货架）】
// floors 决定高台形态 —— 每张地图的 segs 组合决定了它的"地形性格"。
const SEGMENTS = {
  open:    { name:'开阔地', w:[820, 1080], floors:'none',   props:1.2, houses:0 },   // 无高台，纯走位
  deck:    { name:'双层',   w:[1000,1400], floors:'one',    props:1.0, houses:1 },   // 一块高台 + 一栋房
  stack:   { name:'叠层',   w:[1100,1500], floors:'stack',  props:1.0, houses:0 },   // 高台上再叠一层
  yard:    { name:'场院',   w:[1000,1300], floors:'single', props:1.5, houses:1 },   // 一块大高台，道具多
  valley:  { name:'凹地',   w:[900, 1200], floors:'valley', props:1.1, houses:0 },   // 两侧高中间低
  bridge:  { name:'天桥',   w:[1200,1700], floors:'bridge', props:0.8, houses:0 },   // 一条长高台贯穿
  corridor:{ name:'走廊',   w:[900, 1300], floors:'none',   props:0.7, houses:2 },   // 窄，房间多
  clutter: { name:'杂物堆', w:[800, 1100], floors:'none',   props:2.2, houses:0 },   // 满是可打碎的物件
  towers:  { name:'双塔',   w:[1000,1400], floors:'towers', props:0.9, houses:0 },   // 两块窄而高的台子
  block:   { name:'街区',   w:[1200,1600], floors:'one',    props:1.3, houses:2 },   // 房子密集
};
const LEVELS = MAPS;   // 兼容旧名字
