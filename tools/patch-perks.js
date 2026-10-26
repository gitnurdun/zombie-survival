'use strict';
// 一次性工具：把属性聚合表 P 接进战斗代码的各个读取点。
// 用法：node tools/patch-perks.js
const fs = require('fs');
const path = require('path');
const J = f => path.join(__dirname, '..', 'app', 'js', f);

function patch(file, pairs) {
  let s = fs.readFileSync(J(file), 'utf8');
  for (const [a, b, label] of pairs) {
    if (!s.includes(a)) { console.log('  MISS [' + file + '] ' + (label || a.slice(0, 50))); continue; }
    s = s.replace(a, b);
  }
  fs.writeFileSync(J(file), s);
}

console.log('接线：');

// ── 战斗（09-combat.js）──
patch('09-combat.js', [
  ['  w.cd = w.def.rate;\n  w.ammo -= w.def.flame ? 0.22 : 1;',
   '  // 「全自动」Perk 只对自动武器生效；射速越快冷却越短\n' +
   '  w.cd = w.def.rate / ((w.def.auto && P) ? P.rateMul : 1);\n' +
   '  w.ammo -= w.def.flame ? 0.22 : 1;', '射速'],

  ['  for (let i = 0; i < (w.def.pellets || 1); i++) {',
   '  // 「霰弹专精」只对多弹丸武器生效\n' +
   '  const pellets = (w.def.pellets || 1) + (w.def.pellets && P ? P.pelletAdd : 0);\n' +
   '  for (let i = 0; i < pellets; i++) {', '弹丸数'],

  ['      air: !player.onGround,   // 开枪时人在空中（跳起或下落）→ 这一发算打头\n      noArmor: !!w.def.noArmor,// 破甲武器无视重甲尸的正面减伤',
   '      air: !player.onGround,   // 开枪时人在空中（跳起或下落）→ 这一发算打头\n' +
   '      noArmor: !!w.def.noArmor,// 破甲武器无视重甲尸的正面减伤\n' +
   '      // Perk：暴击 / 穿透\n' +
   '      crit: (w.def.crit || 0) + (P ? P.critAdd : 0),\n' +
   '      critMul: (w.def.critMul || 2) * (P ? P.critDmgMul : 1),\n' +
   '      pierce: (w.def.pierce || 0) + (P ? P.pierceAdd : 0),\n' +
   '      hitSet: null,', '暴击/穿透字段'],

  ['      damageZombie(z, i, w.def.dmg, false, dir * 300, w.def.noArmor);',
   '      damageZombie(z, i, w.def.dmg * (P ? P.meleeMul : 1), false, dir * 300, w.def.noArmor);   // 「近战狂人」', '近战伤害'],
]);

// ── 命中判定（11-update.js）──
patch('11-update.js', [
  ['        const z = zombies[j];\n        const zy = z.y();\n        // 判定框上下各放宽 V_TOL，兼容跳跃射击和站在高台上射击（见 V_TOL 处的说明）\n        if (b.x > z.x - z.w / 2 - 2 && b.x < z.x + z.w / 2 + 2 &&\n            b.y > zy - z.h - V_TOL && b.y < zy + V_TOL) {',
   '        const z = zombies[j];\n' +
   '        if (b.hitSet && b.hitSet.indexOf(z) >= 0) continue;   // 穿透弹不重复打同一只\n' +
   '        const zy = z.y();\n' +
   '        // 判定框上下各放宽 V_TOL，兼容跳跃射击和站在高台上射击（见 V_TOL 处的说明）\n' +
   '        if (b.x > z.x - z.w / 2 - 2 && b.x < z.x + z.w / 2 + 2 &&\n' +
   '            b.y > zy - z.h - V_TOL && b.y < zy + V_TOL) {', '穿透去重'],

  ['          const headshot = !!b.air && !z.def.noHeadshot;\n          damageZombie(z, j, b.dmg, headshot, b.vx * 0.16, b.noArmor, true);   // 最后一参 = 这是子弹\n          dead = true;\n          break;',
   '          const headshot = !!b.air && !z.def.noHeadshot;\n' +
   '          let dmg = b.dmg, crit = false;\n' +
   '          if (b.crit > 0 && Math.random() < b.crit) { dmg *= (b.critMul || 2); crit = true; }\n' +
   '          damageZombie(z, j, dmg, headshot, b.vx * 0.16, b.noArmor, true);   // 最后一参 = 这是子弹\n' +
   '          if (crit) texts.push({ x: z.x, y: z.y() - z.h - 30, txt: \'暴击!\', col: \'#ff5a3a\', life: 0.6, max: 0.6, vy: -70 });\n' +
   '          if (b.pierce > 0) {                    // 「穿透弹」：扣一层继续飞\n' +
   '            b.pierce--;\n' +
   '            (b.hitSet || (b.hitSet = [])).push(z);\n' +
   '            continue;\n' +
   '          }\n' +
   '          dead = true;\n' +
   '          break;', '暴击+穿透'],
]);

// ── 击杀结算（08-zombies.js）──
patch('08-zombies.js', [
  ['  const cmul = 1 + Math.floor(G.combo / 5) * 0.35;      // 5 连 +35%，10 连 +70%…',
   '  const cmul = (1 + Math.floor(G.combo / 5) * 0.35) * (P ? P.cashMul : 1);   // 连杀 ×「幸运儿」', '金币加成'],

  ['  SFX.die();\n  if (Math.random() < 0.045) items.push({ type: \'bat\', x: z.x, y: GROUND - 40 - rand(0, 40), t: 0, life: 18 });\n  if (Math.random() < 0.05) items.push({ type: \'medkit\', x: z.x, y: GROUND - 18, t: 0, life: 18 });',
   '  SFX.die();\n  // 「拾荒者」提高掉落率\n' +
   '  const dk = P ? P.dropMul : 1;\n' +
   '  if (Math.random() < 0.045 * dk) items.push({ type: \'bat\', x: z.x, y: GROUND - 40 - rand(0, 40), t: 0, life: 18 });\n' +
   '  if (Math.random() < 0.05 * dk) items.push({ type: \'medkit\', x: z.x, y: GROUND - 18, t: 0, life: 18 });\n' +
   '  // 「吸血鬼」击杀回血\n' +
   '  if (P && P.lifesteal > 0) player.hp = Math.min(player.maxHp, player.hp + P.lifesteal);', '掉落+吸血'],

  ['    const max = w.def.ammoMax || 120;\n    const before = w.ammo;\n    w.ammo = Math.min(max, w.ammo + amt);',
   '    const max = w.def.ammoMax || 120;\n    const before = w.ammo;\n    w.ammo = Math.min(max, w.ammo + amt * (P ? P.ammoMul : 1));   // 「弹药腰带」', '弹药加成'],
]);

// ── 医疗包回血量 ──
patch('11-update.js', [
  ['        player.hp = Math.min(player.maxHp, player.hp + 30);\n        texts.push({ x: it.x, y: it.y - 20, txt: \'+30 HP\', col: \'#7ce07c\', life: 1, max: 1, vy: -50 });',
   '        const heal = Math.round(30 * (P ? P.healMul : 1));   // 「护士 Mira」的回血加成\n' +
   '        player.hp = Math.min(player.maxHp, player.hp + heal);\n' +
   '        texts.push({ x: it.x, y: it.y - 20, txt: \'+\' + heal + \' HP\', col: \'#7ce07c\', life: 1, max: 1, vy: -50 });', '医疗包'],
]);

console.log('完成。');
