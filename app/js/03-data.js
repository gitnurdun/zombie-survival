// js/03-data.js —— 由 tools/split.js 从单文件版拆出。
// 分段：数据

'use strict';
// ============================== 数据 ==============================
// v2：17 把武器，3 个类别，每把 3 级（满级变形）。
// 弹药分 2 类 —— bullet（实弹，热武器）/ cell（能量，科幻武器）。冷兵器不耗弹。
// 商店不卖弹药，只能靠打碎场景道具和安全屋刷新。
//
// 结构：顶层字段是 1 级数值，lv[] 里只写"该等级相对基础变化的字段"（绝对值，不用倍率，
// 方便直接读数值平衡）。makeWeapon 会把 lv[lv-1] 合并进 w.def —— 于是所有
// 现有战斗代码里的 w.def.dmg / w.def.rate 全都自动生效，一行都不用改。见 refreshWeapon。
// sfx = 复用哪个已有音效（没有的话回落到 generic）。
const WEAPONS = {
  // ═══════════ 冷兵器（不耗弹） ═══════════
  bat: { id:'bat', cat:'melee', name:'木棍', price:0, upCost:[350, 900], order:1,
    desc:'挥砍 · 击退 · 不耗弹药', shape:'club', L:42, col:'#8a6a42',
    melee:true, auto:true, dmg:26, rate:0.42, arc:80, kb:340,
    sfx:'swingL',
    lv:[ {name:'木棍'},
         {name:'棒球棒', dmg:34, arc:92, kb:400, col:'#a8823f'},
         {name:'狼牙棒', dmg:48, arc:104, kb:470, col:'#6a4e2c'} ] },

  axe: { id:'axe', cat:'melee', name:'消防斧', price:420, upCost:[500, 1300], order:2,
    desc:'重击 · 破甲 · 出手慢', shape:'axe', L:46, col:'#8a2f22',
    melee:true, auto:true, dmg:52, rate:0.72, arc:72, kb:280, noArmor:true,
    sfx:'swingH',
    lv:[ {name:'消防斧'},
         {name:'破门斧', dmg:68, rate:0.68},
         {name:'武士刀', dmg:86, rate:0.5, arc:96, col:'#c8ccd4'} ] },

  saw: { id:'saw', cat:'melee', name:'电锯', price:1100, upCost:[800, 1800], order:3,
    desc:'持续切割 · 贴身最强 · 要贴上去', shape:'saw', L:34, col:'#8a3a22',
    melee:true, auto:true, dmg:15, rate:0.09, arc:56, kb:60,
    sfx:'chainsaw',
    lv:[ {name:'电锯'},
         {name:'强化电锯', dmg:19},
         {name:'双刃电锯', dmg:24, arc:72, col:'#c0c8d0'} ] },

  shovel:{ id:'shovel', cat:'melee', name:'铁锹', price:300, upCost:[420, 1100], order:4,
    desc:'强击退 · 把僵尸铲飞', shape:'shovel', L:50, col:'#7a6a52',
    melee:true, auto:true, dmg:30, rate:0.62, arc:76, kb:900,
    sfx:'shovelS',
    lv:[ {name:'铁锹'},
         {name:'工兵铲', dmg:38, kb:1050},
         {name:'破城铲', dmg:50, rate:0.55, arc:88, kb:1250} ] },

  dart: { id:'dart', cat:'melee', name:'飞镖', price:520, upCost:[600, 1500], order:5,
    desc:'投掷 · 穿透 · 无限回收', shape:'dart', L:16, col:'#c0c8d4',
    recover:true, auto:true, dmg:22, rate:0.3, spd:760, spread:0.05, kb:0.5, sfx:'dartS',
    lv:[ {name:'飞镖'},
         {name:'手里剑', dmg:30, rate:0.26},
         {name:'回旋刃', dmg:40, rate:0.22, spd:880} ] },

  machete:{ id:'machete', cat:'melee', name:'大砍刀', price:680, upCost:[550, 1400], order:6,
    desc:'挥砍范围大 · 最均衡的近战', shape:'machete', L:52, col:'#9aa4ae',
    melee:true, auto:true, dmg:40, rate:0.5, arc:100, kb:300,
    sfx:'swingM',
    lv:[ {name:'大砍刀'},
         {name:'开山刀', dmg:54, arc:112},
         {name:'刈草机', dmg:70, rate:0.42, arc:132} ] },

  sword: { id:'sword', cat:'melee', name:'长剑', price:1500, upCost:[1100, 2600], order:7,
    desc:'出手快 · 暴击高', shape:'sword', L:58, col:'#d0d8e0',
    melee:true, auto:true, dmg:46, rate:0.36, arc:96, kb:260, crit:0.22, critMul:2.5,
    sfx:'swingS',
    lv:[ {name:'长剑'},
         {name:'巨剑', dmg:64, arc:120, kb:340},
         {name:'裁决之刃', dmg:84, rate:0.3, arc:140, crit:0.3} ] },

  // ═══════════ 热武器（实弹） ═══════════
  pistol:{ id:'pistol', cat:'gun', name:'手枪', price:150, upCost:[400, 1200], order:1,
    desc:'单发 · 精准 · 弹药便宜', shape:'pistol', L:20, col:'#1c1c20',
    ammoType:'bullet', ammoMax:120, startAmmo:48, sfx:'pistol',
    dmg:16, rate:0.28, spd:980, spread:0.012, crit:0.10, critMul:2, kb:1,
    lv:[ {name:'手枪'},
         {name:'战术手枪', dmg:20, rate:0.23, ammoMax:160, crit:0.13},
         {name:'沙漠之鹰', dmg:34, rate:0.31, crit:0.22, critMul:2.5, pierce:1, col:'#b0aeb8'} ] },

  uzi: { id:'uzi', cat:'gun', name:'冲锋枪', price:750, upCost:[600, 1500], order:2,
    desc:'全自动 · 泼水般倾泻', shape:'smg', L:24, col:'#25252a',
    ammoType:'bullet', ammoMax:240, startAmmo:120, sfx:'uzi',
    dmg:8, rate:0.085, spd:880, spread:0.07, auto:true, kb:0.4,
    lv:[ {name:'冲锋枪'},
         {name:'冲锋枪Mk2', dmg:10, spread:0.055},
         {name:'双持UZI', dmg:13, rate:0.07, ammoMax:360} ] },

  pump: { id:'pump', cat:'gun', name:'泵动霰弹', price:400, upCost:[500, 1400], order:3,
    desc:'一次 8 弹丸 · 大击退', shape:'shotgun', L:32, col:'#3a2a1c',
    ammoType:'bullet', ammoMax:60, startAmmo:24, sfx:'pump',
    dmg:9, rate:0.9, spd:820, spread:0.2, pellets:8, kb:2.6,
    lv:[ {name:'泵动霰弹'},
         {name:'战斗霰弹', dmg:11, rate:0.72},
         {name:'战术霰弹', dmg:13, pellets:11, rate:0.62, ammoMax:80} ] },

  magnum:{ id:'magnum', cat:'gun', name:'左轮', price:900, upCost:[700, 1700], order:4,
    desc:'高伤 · 穿透 · 出手慢', shape:'revolver', L:22, col:'#2a2a30',
    ammoType:'bullet', ammoMax:48, startAmmo:24, sfx:'magnum',
    dmg:34, rate:0.55, spd:1050, spread:0.01, crit:0.18, critMul:2.4, pierce:1, kb:1.8,
    lv:[ {name:'左轮'},
         {name:'大威力左轮', dmg:46},
         {name:'马格南', dmg:62, pierce:2, crit:0.26, col:'#c8c0a0'} ] },

  minigun:{ id:'minigun', cat:'gun', name:'转管机枪', price:2200, upCost:[1500, 3200], order:5,
    desc:'加特林 · 射速拉满 · 拖慢移动', shape:'minigun', L:38, col:'#3a3a42',
    ammoType:'bullet', ammoMax:600, startAmmo:300, sfx:'minigun', slow:0.75,
    dmg:9, rate:0.045, spd:900, spread:0.11, auto:true, kb:0.3,
    lv:[ {name:'转管机枪'},
         {name:'预热转管', dmg:11, spread:0.09},
         {name:'火神炮', dmg:14, rate:0.035, ammoMax:900} ] },

  rpg: { id:'rpg', cat:'gun', name:'火箭筒', price:2600, upCost:[1800, 3800], order:6,
    desc:'爆炸 · 范围伤害 · 会炸到自己', shape:'rpg', L:40, col:'#4a5a32',
    ammoType:'bullet', ammoMax:24, startAmmo:10, sfx:'rpg',
    dmg:90, rate:1.5, spd:520, kb:3, explode:{ r:150, dmg:90, selfHurt:0.4 },
    lv:[ {name:'火箭筒'},
         {name:'集束火箭', dmg:120, explode:{r:170, dmg:120, selfHurt:0.4}},
         {name:'多联集束', dmg:150, rate:1.2, explode:{r:200, dmg:150, selfHurt:0.35}} ] },

  // ═══════════ 科幻武器（能量） ═══════════
  tesla: { id:'tesla', cat:'scifi', name:'特斯拉电弧枪', price:1500, upCost:[900, 2200], order:1,
    desc:'闪电链 · 跳跃 4 目标 · 无视护甲', shape:'energy', L:40, col:'#2a3a5a', accent:'#6ab0ff',
    ammoType:'cell', ammoMax:80, startAmmo:40, sfx:'tesla',
    dmg:46, rate:0.8, chain:4, chainRange:620, noArmor:true, kb:1.4,
    lv:[ {name:'特斯拉电弧枪'},
         {name:'高压电弧枪', dmg:60, chain:5},
         {name:'风暴发生器', dmg:78, chain:7, chainRange:820, rate:0.64, accent:'#a0d8ff'} ] },

  cryo: { id:'cryo', cat:'scifi', name:'冷冻射线', price:1200, upCost:[800, 1900], order:2,
    desc:'减速 · 冻住僵尸', shape:'energy', L:34, col:'#22405a', accent:'#8fd8ff',
    ammoType:'cell', ammoMax:240, startAmmo:120, sfx:'cryo',
    dmg:14, rate:0.06, auto:true, freeze:1.6, beam:true, kb:0.3,
    lv:[ {name:'冷冻射线'},
         {name:'冰霜射线', dmg:19, freeze:2.0},
         {name:'冰霜炮', dmg:26, freeze:2.6, accent:'#c8f0ff'} ] },

  plasma:{ id:'plasma', cat:'scifi', name:'等离子切割器', price:1900, upCost:[1200, 2800], order:3,
    desc:'穿透 · 融化护甲', shape:'energy', L:30, col:'#3a2a4a', accent:'#c07aff',
    ammoType:'cell', ammoMax:120, startAmmo:60, sfx:'plasma',
    dmg:40, rate:0.4, spd:700, spread:0.03, pierce:2, noArmor:true, crit:0.14, kb:1.2,
    lv:[ {name:'等离子切割器'},
         {name:'等离子步枪', dmg:52, pierce:3},
         {name:'裂解炮', dmg:68, pierce:4, crit:0.20, accent:'#e0a0ff'} ] },

  flamer:{ id:'flamer', cat:'scifi', name:'火焰喷射器', price:1700, upCost:[1000, 2400], order:4,
    desc:'持续火焰 · 点燃僵尸', shape:'flamer', L:36, col:'#4a3020', accent:'#ff8a3a',
    ammoType:'cell', ammoMax:240, startAmmo:120, sfx:'flamer',
    dmg:34, rate:0.03, auto:true, flame:true, kb:0.2,
    lv:[ {name:'火焰喷射器'},
         {name:'燃烧喷射器', dmg:44},
         {name:'地狱火', dmg:56, rate:0.025, accent:'#ffcc60'} ] },
};
// 商店 / 图鉴的显示顺序
const WEP_ORDER = ['bat','axe','saw','shovel','dart','machete','sword',
                   'pistol','uzi','pump','magnum','minigun','rpg',
                   'tesla','cryo','plasma','flamer'];
const CAT_NAME = { melee:'冷兵器', gun:'热武器', scifi:'科幻武器' };
const CAT_OF  = { melee:'冷兵器（不耗弹）', gun:'热武器（实弹）', scifi:'科幻武器（能量）' };
// v2 速度下调 ×0.8（玩家同步 250→190）。瘦尸原本 240，和玩家几乎一样快，是最劝退的部分。
// from  = 从第几关开始出现 —— 不做"一上来所有类型全有"，每关逐步解锁新敌人。
// smash = 砸安全屋的伤害倍率；climb = 能否站上高台；armor = 正面减伤（跳射/破甲武器无视）
// 注意 h ≥ 56：子弹固定在 y=570、僵尸脚在 y=610，矮于 40px 会被水平弹道直接飞过。
const ZTYPES = {
  normal:  { name:'村民僵尸',   from:1,  hp:46,  spd:42,  w:34, h:64,  dmg:8,  cash:6,  atk:0.9, kb:1,    skin:'#7fae5a', eye:'#fff',    smash:1 },
  fast:    { name:'瘦尸',       from:2,  hp:26,  spd:192, w:30, h:60,  dmg:6,  cash:9,  atk:0.6, kb:1.3,  skin:'#9c8a4a', eye:'#ff3020', smash:1,
             canStack:true },   // 会踩到别的僵尸肩上够到高台
  spitter: { name:'酸液喷吐者', from:3,  hp:52,  spd:34,  w:38, h:66,  dmg:7,  cash:16, atk:1.2, kb:0.5,  skin:'#6f8a4a', eye:'#b0ff40', smash:1,
             ranged:{ cd:2.6, spd:380, dmg:9, elem:'acid', keep:330 } },
  heavy:   { name:'重甲尸',     from:4,  hp:180, spd:27,  w:44, h:70,  dmg:18, cash:18, atk:1.1, kb:0.12, skin:'#6e8a72', eye:'#ffd050', smash:2, armor:0.45 },
  bomber:  { name:'自爆尸',     from:5,  hp:60,  spd:78,  w:40, h:62,  dmg:4,  cash:22, atk:0.8, kb:0.6,  skin:'#8a5a3a', eye:'#ff8020', smash:1,
             explode:{ r:120, dmg:30, fuse:0.7 } },
  giant:   { name:'巨型尸',     from:6,  hp:900, spd:35,  w:76, h:118, dmg:30, cash:80, atk:1.3, kb:0.05, skin:'#5e9450', eye:'#ff3020', smash:3, noHeadshot:true },
  crawler: { name:'变异犬',     from:7,  hp:34,  spd:236, w:56, h:56,  dmg:9,  cash:12, atk:0.5, kb:1.1,  skin:'#7a6a52', eye:'#ff4020', smash:1, shape:'beast', climb:true },
  burner:  { name:'燃烧者',     from:8,  hp:66,  spd:32,  w:38, h:66,  dmg:8,  cash:20, atk:1.2, kb:0.5,  skin:'#8a5a2a', eye:'#ffb040', smash:1,
             ranged:{ cd:3.2, spd:340, dmg:7, elem:'fire', keep:370 } },
  leaper:  { name:'跳跃者',     from:9,  hp:70,  spd:64,  w:36, h:66,  dmg:14, cash:24, atk:1.0, kb:0.6,  skin:'#5a7a6a', eye:'#80ffd0', smash:1,
             pounce:{ cd:3.0, spd:430 } },
  boss:    { name:'病毒体·母巢', from:10, hp:4000, spd:30, w:110, h:170, dmg:40, cash:900, atk:1.6, kb:0.02, skin:'#4a7a44', eye:'#ff2020', smash:3, noHeadshot:true,
             boss:true },

  // ── 第 11~22 关的四种新敌人 ──
  // 前面 10 关每关解锁一种，但 11 关往后原本一个新敌人都没有 —— 12 张图威胁曲线是平的。
  // 这四种全是"改变你怎么打"的类型，不是数值更大的村民僵尸。
  bloater: { name:'腐胀胖尸',   from:11, hp:320, spd:21,  w:54, h:82,  dmg:26, cash:30, atk:1.7, kb:0.06, skin:'#8a9a52', eye:'#d0ff60', smash:2.5,
             // 死了才最危险：原地留一片不断扩大的毒雾。别在它旁边开枪打死它。
             gas:{ r:78, rMax:170, dmg:5, life:9 } },
  thrower: { name:'骨刺投手',   from:13, hp:82,  spd:30,  w:40, h:70,  dmg:11, cash:24, atk:1.2, kb:0.4,  skin:'#a8a08a', eye:'#c8e0ff', smash:1,
             // lead:true = 朝「你将会在的地方」扔。直线跑必中，必须变向或起跳。
             ranged:{ cd:2.4, spd:600, dmg:15, elem:'bone', keep:430, lead:true } },
  screamer:{ name:'尖叫者',     from:16, hp:115, spd:31,  w:38, h:68,  dmg:7,  cash:28, atk:2.0, kb:0.3,  skin:'#b06a8a', eye:'#ffffff', smash:1,
             // 自己不危险，危险的是它让周围所有僵尸跑快 55%。优先点掉。
             aura:{ type:'haste', r:320, v:0.55 }, shriek:{ cd:2.6 } },
  nurse:   { name:'护士尸',     from:21, hp:140, spd:37,  w:38, h:68,  dmg:9,  cash:34, atk:1.4, kb:0.4,  skin:'#d8e0e4', eye:'#ff5050', smash:1,
             // 冥王星冰原你在一直掉血、它在给别人回血 —— 图的就是这个对照。
             aura:{ type:'heal', r:270, v:16 } },
};
// 刷怪权重。ramp = 关卡内推进度对权重的影响（正数越往后越多，负数越往后越少）
const ZSPAWN = {
  normal:  { w: 10, ramp: -4.5 },
  fast:    { w: 4.5, ramp: 0 },
  spitter: { w: 3,   ramp: 0 },
  heavy:   { w: 3,   ramp: 2 },
  bomber:  { w: 2.2, ramp: 0 },
  giant:   { w: 1,   ramp: 1.6 },
  crawler: { w: 4,   ramp: 0 },
  burner:  { w: 2.4, ramp: 0 },
  leaper:  { w: 2.4, ramp: 0 },
  bloater: { w: 2.0, ramp: 1.4 },   // 越靠近栅栏越常见
  thrower: { w: 2.6, ramp: 0.5 },
  screamer:{ w: 1.6, ramp: 1.0 },   // 后期一堆加速僵尸比多一只精英怪可怕
  nurse:   { w: 1.6, ramp: 0.7 },
};
// 某一关首次登场的新敌人（用于开场提示和关卡选择卡片）
function newTypesAt(level) {
  return Object.keys(ZTYPES).filter(id => ZTYPES[id].from === level);
}

// ============================== Perk ==============================
// 12 个选 3 装备，每个 3 级。走「属性聚合表」：computePerkStats() 一次性算好，
// 战斗代码只读 P.xxx —— 12 perk × 3 级 = 36 条逻辑，不聚合就得改 30+ 处调用点。
const PERKS = {
  armor:  { id:'armor',  name:'防弹背心', cat:'surv', max:3, cost:[250, 700, 1600],
            desc:'最大生命 +30/级',                 stat:{ hpAdd:30 } },
  sprint: { id:'sprint', name:'疾跑',     cat:'surv', max:3, cost:[250, 700, 1600],
            desc:'移动速度 +10%/级',               stat:{ spdMul:0.10 } },
  vamp:   { id:'vamp',   name:'吸血鬼',   cat:'surv', max:3, cost:[300, 800, 1800],
            desc:'击杀回血 0.8/级',                stat:{ lifesteal:0.8 } },
  cd:     { id:'cd',     name:'冷却专家', cat:'surv', max:3, cost:[300, 800, 1800],
            desc:'闪避冷却 -15%/级',               stat:{ cdCut:0.15 } },
  auto:   { id:'auto',   name:'全自动',   cat:'fire', max:3, cost:[300, 850, 1900],
            desc:'自动武器射速 +12%/级',           stat:{ rateMul:0.12 } },
  pellet: { id:'pellet', name:'霰弹专精', cat:'fire', max:3, cost:[350, 900, 2000],
            desc:'霰弹 +1 弹丸/级',                stat:{ pelletAdd:1 } },
  crit:   { id:'crit',   name:'爆头大师', cat:'fire', max:3, cost:[400, 1000, 2200],
            desc:'暴击率 +6%、暴击伤害 +25%/级',   stat:{ critAdd:0.06, critDmgAdd:0.25 } },
  melee:  { id:'melee',  name:'近战狂人', cat:'fire', max:3, cost:[300, 800, 1800],
            desc:'近战伤害 +30%/级',               stat:{ meleeMul:0.30 } },
  pierce: { id:'pierce', name:'穿透弹',   cat:'fire', max:3, cost:[500, 1200, 2600],
            desc:'子弹额外穿透 +1 目标/级',        stat:{ pierceAdd:1 } },
  belt:   { id:'belt',   name:'弹药腰带', cat:'scav', max:3, cost:[250, 700, 1600],
            desc:'拾取弹药 +25%/级',               stat:{ ammoMul:0.25 } },
  scav:   { id:'scav',   name:'拾荒者',   cat:'scav', max:3, cost:[300, 800, 1800],
            desc:'道具掉率 +15%/级',               stat:{ dropMul:0.15 } },
  lucky:  { id:'lucky',  name:'幸运儿',   cat:'scav', max:3, cost:[350, 900, 2000],
            desc:'金币掉落 +20%/级',               stat:{ cashMul:0.20 } },
};
const PERK_CATS = [['surv', '生存'], ['fire', '火力'], ['scav', '拾荒']];

// ============================== 角色 ==============================
// 4 个通关解锁 + 1 个隐藏（击杀 Boss）。bonus 用和 P 一样的字段名，直接乘/加进聚合表。
const CHARS = {
  hank: { id:'hank', name:'老农 Hank', hp:120, medkits:0, weapons:[['bat', 1]],
    bonus:{ meleeMul:1.15 }, unlock:0, unlockText:'初始可用',
    pal:{ jacket:'#5a4632', skin:'#d8b490', hair:'#3a2c1c' },
    desc:'活了六十年的老农。挥了一辈子锄头，近战比谁都有劲。' },
  reyes:{ id:'reyes', name:'退伍兵 Reyes', hp:90, medkits:0, weapons:[['pistol', 1], ['bat', 1]],
    bonus:{ rateMul:1.10 }, unlock:3, unlockText:'通关第 3 关',
    pal:{ jacket:'#3c4a3a', skin:'#c8a078', hair:'#2a2a2a' },
    desc:'从战场上回来的。枪法还在，但身子骨不如从前。' },
  mira: { id:'mira', name:'护士 Mira', hp:100, medkits:3, weapons:[['bat', 1]],
    bonus:{ healMul:1.5 }, unlock:6, unlockText:'通关第 6 关',
    pal:{ jacket:'#c8d0d8', skin:'#e0c0a0', hair:'#5a4a3a' },
    desc:'医院里唯一活下来的人。她比谁都知道怎么把人拼回去。' },
  ozzy: { id:'ozzy', name:'机械师 Ozzy', hp:100, medkits:0, weapons:[['saw', 1]],
    bonus:{ shopMul:0.85 }, unlock:9, unlockText:'通关第 9 关',
    pal:{ jacket:'#4a4a52', skin:'#b09070', hair:'#6a5a3a' },
    desc:'能把报废的电锯修好的人。他认识所有老板，东西都能便宜点。' },
  duke: { id:'duke', name:'疯子 Duke', hp:70, medkits:0, weapons:[['bat', 1]],
    bonus:{ ammoMul:2 }, unlock:0, unlockText:'击杀病毒体·母巢', hidden:true,
    pal:{ jacket:'#6a2a2a', skin:'#c09878', hair:'#1a1a1a' },
    desc:'没人知道他从哪来。背着一整箱弹药，一边笑一边往前冲。' },
};
const charUnlocked = id => {
  const c = CHARS[id];
  if (!c) return false;
  if (c.hidden) return !!S.demonUnlocked;
  return c.unlock === 0 || (S.unlocked > c.unlock) || !!S.cleared[c.unlock];
};

// ============================== 属性聚合 ==============================
// 把所有已装备的 Perk（×等级）+ 当前角色的加成，一次性算成一张扁平表。
// 战斗代码只读 P.xxx，完全不关心这些数是从哪来的。
function computePerkStats() {
  const P = {
    hpAdd:0, spdMul:1, lifesteal:0, cdCut:0,
    rateMul:1, pelletAdd:0, critAdd:0, critDmgMul:1, meleeMul:1, pierceAdd:0,
    ammoMul:1, dropMul:1, cashMul:1, healMul:1, shopMul:1,
  };
  for (const id of (S.perkSlots || [])) {
    if (!id) continue;
    const lv = S.perkLv[id] || 0;
    if (!lv || !PERKS[id]) continue;
    const st = PERKS[id].stat;
    const add = (k, v) => { P[k] += v; };
    if (st.hpAdd) add('hpAdd', st.hpAdd * lv);
    if (st.lifesteal) add('lifesteal', st.lifesteal * lv);
    if (st.pelletAdd) add('pelletAdd', st.pelletAdd * lv);
    if (st.pierceAdd) add('pierceAdd', st.pierceAdd * lv);
    if (st.critAdd) add('critAdd', st.critAdd * lv);
    if (st.critDmgAdd) add('critDmgMul', st.critDmgAdd * lv);
    // 「+10%/级」是线性叠加：1 级 1.10，3 级 1.30
    if (st.spdMul) P.spdMul += st.spdMul * lv;
    if (st.cdCut) P.cdCut += st.cdCut * lv;
    if (st.rateMul) P.rateMul += st.rateMul * lv;
    if (st.meleeMul) { for (let i = 0; i < lv; i++) P.meleeMul += st.meleeMul; }
    if (st.ammoMul) { for (let i = 0; i < lv; i++) P.ammoMul += st.ammoMul; }
    if (st.dropMul) { for (let i = 0; i < lv; i++) P.dropMul += st.dropMul; }
    if (st.cashMul) { for (let i = 0; i < lv; i++) P.cashMul += st.cashMul; }
  }
  P.cdMul = clamp(1 - P.cdCut, 0.3, 1);
  // 角色加成（bonus 用和 P 相同的字段名）
  const C = CHARS[S.curChar] || CHARS.hank;
  for (const k in (C.bonus || {})) {
    const v = C.bonus[k];
    if (k === 'hpAdd' || k === 'pelletAdd' || k === 'pierceAdd' || k === 'critAdd' || k === 'lifesteal') P[k] += v;
    else P[k] = (P[k] || 1) * v;
  }
  return P;
}
let P = null;   // 当前生效的聚合表；建关时刷新（见 resetGame）

// ============================== 成就 ==============================
// 数据驱动：kind 用 switch 在 checkAch() 里求值，加一条成就 = 加一行数据。
// 在关卡结算时统一检查一次（不是每帧）。
const ACHIEVEMENTS = [
  { id:'k100',    name:'初次收割',   kind:'kills',     n:100,   reward:300,
    desc:'累计击杀 100 只僵尸' },
  { id:'k1000',   name:'清道夫',     kind:'kills',     n:1000,  reward:800,
    desc:'累计击杀 1000 只僵尸' },
  { id:'k10000',  name:'尸潮终结者', kind:'kills',     n:10000, reward:4000,
    desc:'累计击杀 10000 只僵尸' },
  { id:'c100',    name:'一枪一个',   kind:'crits',     n:100,   reward:500,
    desc:'累计暴击 100 次' },
  { id:'c1000',   name:'枪枪爆头',   kind:'crits',     n:1000,  reward:2000,
    desc:'累计暴击 1000 次' },
  { id:'m1',      name:'逃出村庄',   kind:'mapClear',  n:1,     reward:200,
    desc:'通关第 1 关' },
  { id:'m3',      name:'拿到枪了',   kind:'mapClear',  n:3,     reward:400,
    desc:'通关第 3 关' },
  { id:'m6',      name:'深入险境',   kind:'mapClear',  n:6,     reward:700,
    desc:'通关第 6 关' },
  { id:'m10',     name:'地表尽头',   kind:'mapClear',  n:10,    reward:2000,
    desc:'通关第 10 关' },
  { id:'m22',     name:'最远的地方', kind:'mapClear',  n:22,    reward:5000,
    desc:'通关第 22 关 · 深空观察站' },
  { id:'allmaps', name:'全境通关',   kind:'allMaps',   n:22,    reward:8000,
    desc:'通关全部 22 张地图' },
  { id:'prop200', name:'拆迁办',     kind:'props',     n:200,   reward:400,
    desc:'打碎 200 个场景物件' },
  { id:'noMed',   name:'硬汉',       kind:'noMedClear',n:1,     reward:600,
    desc:'整关不使用医疗包通关' },
  { id:'combo20', name:'停不下来',   kind:'combo',     n:20,    reward:700,
    desc:'打出 20 连杀' },
  { id:'combo40', name:'屠杀机器',   kind:'combo',     n:40,    reward:1800,
    desc:'打出 40 连杀' },
  { id:'bosskill',name:'源 头',      kind:'boss',      n:1,     reward:1500,
    desc:'击杀病毒体 · 母巢' },
  { id:'deaths1', name:'第一次',     kind:'deaths',    n:1,     reward:100,
    desc:'第一次被吃掉' },
  { id:'deaths50',name:'屡败屡战',   kind:'deaths',    n:50,    reward:900,
    desc:'累计死亡 50 次' },
  { id:'fullgear',name:'装备齐全',   kind:'fullSlots', n:1,     reward:800,
    desc:'3 个装备槽全部装满' },
  { id:'silent',  name:'安静地走',   kind:'lowNoise',  n:1,     reward:900,
    desc:'整关噪音不超过 40 通关（多打近战）' },
  { id:'infected',name:'疫 情',      kind:'infected', n:1,     reward:2500,
    desc:'开启感染模式通关任意一关' },
];

// ============================== 僵尸词缀 ==============================
// 精英怪系统：10 种僵尸 × 7 种词缀 = 70 种组合。
// 词缀只改数值和一个"死亡/受击/持续"的钩子，复用现有代码（爆炸、火焰、护甲判定）。
// 出现概率随关卡和关卡内推进度上升（见 rollAffix）。
const AFFIXES = {
  burning:   { name:'燃烧的', col:'#ff7a2a', hpMul:1.0, spdMul:1.0, onDeath:'fire' },
  shocking:  { name:'电击的', col:'#7ad0ff', hpMul:1.0, spdMul:1.0, zap:1 },
  shielded:  { name:'带盾的', col:'#c8c8d8', hpMul:1.15, spdMul:0.9, shield:26 },
  swift:     { name:'迅捷的', col:'#a0f0a0', hpMul:0.8, spdMul:1.4 },
  giantized: { name:'巨化的', col:'#c080d0', hpMul:2.2, spdMul:0.85, scale:1.35 },
  volatile:  { name:'爆裂的', col:'#ffb040', hpMul:0.9, spdMul:1.05, onDeath:'boom' },
  regen:     { name:'再生的', col:'#70e0a0', hpMul:1.1, spdMul:1.0, regen:2.5 },
};
const AFFIX_KEYS = Object.keys(AFFIXES);
// 一只僵尸挂词缀的概率：第 1 关基本没有，越往后越常见，关卡后半段再涨一截
function affixChance(level, p) {
  const base = clamp((level - 2) * 0.018, 0, 0.20);
  return base + base * p * 0.8;
}
function rollAffix(level, p) {
  if (Math.random() > affixChance(level, p)) return null;
  return choice(AFFIX_KEYS);
}

// ============================== 天气变体 ==============================
// 一张地图有 2~3 种天气，互相影响视野 / 弹道 / 僵尸速度。一张图当三张用。
const WEATHERS = {
  clear:  { name:'晴',   col:null,             fogMul:1.0, wind:0,    spdMul:1.0,  rain:0 },
  rain:   { name:'雨',   col:'rgba(40,60,90,0.20)', fogMul:1.35, wind:20,  spdMul:1.08, rain:1 },
  fog:    { name:'雾',   col:'rgba(150,160,175,0.16)', fogMul:1.9, wind:0,  spdMul:0.94, rain:0 },
  storm:  { name:'暴雨', col:'rgba(30,45,70,0.30)', fogMul:1.7, wind:62, spdMul:1.16, rain:1, lightning:true },
  night:  { name:'夜',   col:'rgba(6,8,22,0.34)', fogMul:1.5, wind:0,   spdMul:1.0,  rain:0 },
};
function rollWeather(m) {
  if (m.skyKind !== 'outdoor') return 'clear';       // 室内图没有天气
  const pool = m.weather || ['clear'];
  return choice(pool);
}
// 颜色插值（昼夜推进用）
function lerpColor(a, b, t) {
  const pa = [1, 3, 5].map(i => parseInt(a.substr(i, 2), 16));
  const pb = [1, 3, 5].map(i => parseInt(b.substr(i, 2), 16));
  const c = pa.map((v, i) => Math.round(lerp(v, pb[i], t)));
  return '#' + c.map(v => clamp(v, 0, 255).toString(16).padStart(2, '0')).join('');
}
