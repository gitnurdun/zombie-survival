// js/11-update.js —— 由 tools/split.js 从单文件版拆出。
// 分段：更新

'use strict';
// ============================== 更新 ==============================
function update(dt) {
  G.time += dt;
  // 玩家
  let mv = 0;
  if (keys.KeyA || keys.ArrowLeft) mv -= 1;
  if (keys.KeyD || keys.ArrowRight) mv += 1;
  const spd = 190 * (P ? P.spdMul : 1);   // v2：250 → 190；Perk「疾跑」在这里生效
  if (!player.inside) {
    if (G.mods && G.mods.ice) {
      // 冰面：不直接赋值速度，而是朝目标加速/减速 —— 起步和急停都变难
      const target = mv * spd + player.kb;
      player.vx += (target - player.vx) * Math.min(1, dt * 1.9);
    } else {
      player.vx = mv * spd + player.kb;
    }
  }
  player.kb *= Math.pow(G.mods && G.mods.ice ? 0.42 : 0.01, dt);
  player.x = clamp(player.x + player.vx * dt, 50, WORLD_W - 50);
  // 沙尘暴：横向风一直在推你
  if (G.mods && G.mods.storm) {
    G.wind = (G.wind || 0) + rand(-70, 70) * dt;
    G.wind = clamp(G.wind, -78, 78);
    player.x = clamp(player.x + G.wind * dt, 50, WORLD_W - 50);
  }
  if (Math.abs(mv) > 0 && !player.inside) player.walkT += dt * 10; else if (player.onGround) player.walkT = 0;
  // 朝向：移动即转向。挥砍动作中锁住朝向，否则判定框会突然甩到背后
  if (mv !== 0 && !player.inside && player.swingT <= 0) player.facing = mv;
  // 跳跃/重力 —— 多层地形版（W / ↑ 专用，空格已经让给开火了）
  // 门口向上跳 = 进屋；屋内跳一下 = 出来。两者都只在「按下的那一帧」生效，不和按住连跳冲突。
  const jumpHold = keys.KeyW || keys.ArrowUp;
  const jumpTap = pressed.KeyW || pressed.ArrowUp;
  if (player.inside) {
    if (jumpTap) exitHouse();                              // 屋内跳一下 = 出去
  } else {
    const door = nearDoorHouse();
    if (jumpTap && door && door.type === 'safe') enterHouse(door);   // 门口跳 = 进去（不跳起来）
    else if (jumpHold && player.onGround) { player.vz = G.jumpV || 560; player.onGround = false; SFX.jump(); }
  }
  // —— 闪避翻滚：Shift 向朝向翻滚，带无敌帧。这是纯水平射击最缺的东西 ——
  // 面对酸液池 / 扑击 / 陨石时，你终于有一个"主动应对"的选项，而不只是跑。
  player.dodgeCd = Math.max(0, (player.dodgeCd || 0) - dt);
  if (keys.ShiftLeft || keys.ShiftRight) {
    if (player.dodgeCd <= 0 && player.dodgeT <= 0 && !player.inside) {
      player.dodgeT = 0.34;
      player.dodgeCd = DODGE_CD * (P ? P.cdMul : 1);
      player.vx = player.facing * DODGE_SPD;
      player.invuln = Math.max(player.invuln, 0.34);
      SFX.dodge(); G.shake = Math.min(G.shake + 2, 8);
      for (let k = 0; k < 10; k++) {
        parts.push({ type: 'spark', x: player.x, y: GROUND - player.z - rand(6, 60), vx: -player.facing * rand(40, 150), vy: rand(-40, 20), grav: 0, life: rand(0.18, 0.34), max: 0.34, size: rand(2, 4) });
      }
    }
  }
  if (player.dodgeT > 0) {
    player.dodgeT -= dt;
    // 必须直接改 x，不能只设 vx —— 下一帧开头 player.vx 会被 mv*spd 覆盖掉，
    // 位移就丢了（早先就是这么写的，实测翻滚位移是 0px）。
    const k = 0.35 + player.dodgeT * 1.6;                            // 前快后慢
    player.x = clamp(player.x + player.facing * DODGE_SPD * k * dt, 50, WORLD_W - 50);
    player.walkT += dt * 20;
  }
  stepOnFloors(player, dt, true);
  player.invuln = Math.max(0, player.invuln - dt);
  // 瞄准：只能水平，由朝向派生。保留 aim 弧度字段 → 所有下游绘制/战斗/闪电链代码零改动。
  // cos(0)=1 / cos(π)=-1 决定枪口朝向，sin() 恒为 0 让弹道水平。跳起时 z 抬高枪口 → 打中僵尸头部 = 爆头。
  player.aim = player.facing > 0 ? 0 : Math.PI;
  player.swingT = Math.max(0, player.swingT - dt);
  for (const w of player.weapons) w.cd = Math.max(0, w.cd - dt);
  // 开火：按住空格即按武器射速连发（attack() 内部用 w.cd 限速）
  if (keys.Space && !player.inside && G.state === 'play' && !G.paused) attack();

  // 安全屋：完全安全、想待多久待多久。但物资最多刷 2 批，而且房子会被僵尸砸塌（见 damageHouse）。
  // 不需要再叠一层限时 —— 房子自己就是倒计时。
  if (player.inside) {
    const h = player.inside;
    h.refreshT -= dt;
    if (h.refreshes < 2 && h.refreshT <= 0) {
      spawnHouseLoot(h);
      h.refreshes++;
      h.refreshT = 8;
    }
  }
  for (const h of houses) if (h.hitT > 0) h.hitT = Math.max(0, h.hitT - dt);
  for (const p of props) if (p.hitT > 0) p.hitT = Math.max(0, p.hitT - dt);

  // 子弹
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.x += b.vx * dt; b.y += b.vy * dt;
    b.vy += b.grav * dt;
    if (b.vy > 0 && b.y >= GUN_Y) { b.y = GUN_Y; b.vy = 0; }   // 高处射出的子弹压回腰部高度后转平
    b.life -= dt;
    let dead = b.life <= 0 || b.x < 20 || b.x > WORLD_W - 20;
    if (b.y >= GROUND) dead = true;
    if (!dead) {
      for (let j = zombies.length - 1; j >= 0; j--) {
        const z = zombies[j];
        // 连锁爆炸可能把数组削短到比 j 还小（见 eachZombieRev 的说明）。
        // 这个循环里有 break/continue，没法套 eachZombieRev，所以就地补一句。
        if (!z) continue;
        if (b.hitSet && b.hitSet.indexOf(z) >= 0) continue;   // 穿透弹不重复打同一只
        const zy = z.y();
        // 判定框上下各放宽 V_TOL，兼容跳跃射击和站在高台上射击（见 V_TOL 处的说明）
        if (b.x > z.x - z.w / 2 - 2 && b.x < z.x + z.w / 2 + 2 &&
            b.y > zy - z.h - V_TOL && b.y < zy + V_TOL) {
          // 爆头 = 开枪瞬间人在空中。巨型尸 h=118，头在跳跃顶点之上，跳射也够不到。
          const headshot = !!b.air && !z.def.noHeadshot;
          let dmg = b.dmg, crit = false;
          if (b.crit > 0 && Math.random() < b.crit) { dmg *= (b.critMul || 2); crit = true; }
          damageZombie(z, j, dmg, headshot, b.vx * 0.16, b.noArmor, true);   // 最后一参 = 这是子弹
          if (crit) texts.push({ x: z.x, y: z.y() - z.h - 30, txt: '暴击!', col: '#ff5a3a', life: 0.6, max: 0.6, vy: -70 });
          if (b.pierce > 0) {                    // 「穿透弹」：扣一层继续飞
            b.pierce--;
            (b.hitSet || (b.hitSet = [])).push(z);
            continue;
          }
          dead = true;
          break;
        }
      }
    }
    // 场景物件（僵尸优先 —— 挡在僵尸后面的箱子不该吃掉这一枪）
    if (!dead) {
      for (let j = props.length - 1; j >= 0; j--) {
        const p = props[j];
        if (!p.def.solid) continue;
        if (b.x > p.x - p.w / 2 - 2 && b.x < p.x + p.w / 2 + 2 &&
            b.y > GROUND - p.z - p.h && b.y < GROUND - p.z) {
          damageProp(p, j, b.dmg);
          dead = true;
          break;
        }
      }
    }
    if (dead) {
      if (b.y >= GROUND && b.life > 0) {
        decals.push({ x: b.x, r: 2.5 });
        for (let p = 0; p < 3; p++) parts.push({ type: 'spark', x: b.x, y: GROUND - 2, vx: rand(-90, 90), vy: rand(-160, -40), grav: 700, life: 0.25, max: 0.25, size: 1.6 });
      }
      bullets.splice(i, 1);
    }
  }

  // 僵尸
  for (let i = zombies.length - 1; i >= 0; i--) {
    const z = zombies[i];
    // 循环体里的 killZombie（自爆 / 烧死）会触发连锁爆炸，在更低的下标上再 splice 几次，
    // 数组可能缩到比 i 还短 —— 见 eachZombieRev 的说明
    if (!z) continue;
    z.hitT = Math.max(0, z.hitT - dt);
    // 「冰冻风暴」冻住的完全静止 —— 放在 Boss 分支之前，所以 Boss 一样会被冻住。
    // 只是不动，不是无敌：子弹、近战、火焰照常结算。
    if (z.freezeT > 0) { z.freezeT -= dt; continue; }
    // 「尖叫者」的加速标记（每帧由 updateAuras 续期，出范围 0.25 秒后自己失效）
    z.hasteT = Math.max(0, (z.hasteT || 0) - dt);
    z.healT = Math.max(0, (z.healT || 0) - dt);
    const zspd = z.spd * (z.hasteT > 0 ? (z.hasteMul || 1) : 1);
    // Boss 走自己的一套 AI（三阶段），不走普通僵尸那一坨
    if (z.isBoss) { updateBossAI(z, dt); continue; }

    // 「再生的」词缀：缓慢回血
    if (z.affix === 'regen' && z.hp < z.maxHp) z.hp = Math.min(z.maxHp, z.hp + AFFIXES.regen.regen * dt);

    // —— 僵尸堆叠：瘦尸会踩到别的僵尸肩上 ——
    // 只限瘦尸（canStack），而且链子最多两级（瘦尸踩瘦尸踩普通）。
    // 这让高台从"绝对安全"变成"暂时喘息"，但不会彻底废掉多层地形。
    if (z.def.canStack) {
      if (z.riding && (!zombies.includes(z.riding) || Math.abs(z.riding.x - z.x) > 70)) z.riding = null;
      if (!z.riding && player.z > 30 && !player.inside) {
        const host = zombies.find(o => o !== z && o.z < player.z - 20 &&
                                        Math.abs(o.x - z.x) < 40 &&
                                        (o.riding ? 0 : 1) + (o.def.canStack ? 0 : 1) >= 1 &&
                                        !o.ridingOf);
        if (host) { z.riding = host; if (!host.canStack) host.ridingOf = true; SFX.groan(0.25); }
      }
      if (z.riding) {
        z.x = z.riding.x;
        z.z = z.riding.z + z.riding.h;
        z.onGround = true; z.vz = 0;
        z.walkT += dt * 3;
      }
    }

    if (z.burnT > 0) {
      z.burnT -= dt;
      z.hp -= 9 * dt;
      if (Math.random() < dt * 14) parts.push({ type: 'fire', x: z.x + rand(-z.w / 3, z.w / 3), y: z.y() - rand(10, z.h), vx: rand(-20, 20), vy: rand(-90, -30), life: 0.3, max: 0.3, size: rand(4, 8), t: 0 });
      if (z.hp <= 0) { killZombie(z, i, false); continue; }
    }
    const targetX = player.inside ? doorOf(player.inside).x : player.x;
    const dx = targetX - z.x;
    z.atkT -= dt;
    z.wob += dt * 4;
    z.boredT = Math.max(0, (z.boredT || 0) - dt);

    if (z.boredT > 0) {
      // —— 游走：砸了几下之后失去兴趣，朝背离门的方向溜达一阵子 ——
      // 之前僵尸会站在门口一直砸到房子塌，既不合理也让安全屋失去了"喘息点"的意义。
      z.pound = false;
      z.dir = z.x < targetX ? -1 : 1;
      z.x += z.dir * zspd * 0.55 * dt;
      z.walkT += dt * (2 + zspd * 0.03);
      if (Math.random() < dt * 0.8) z.walkT = 0;      // 走走停停，像在闲逛
    } else {
      z.dir = dx >= 0 ? 1 : -1;
      // 必须在同一层才算"够得着" —— 否则站在高台上会被下面的僵尸隔空咬
      const sameLevel = Math.abs(z.z - player.z) < 30;
      const attacking = Math.abs(dx) < (z.w / 2 + player.w / 2 + 8) && !player.inside && sameLevel;
      const rg = z.def.ranged;

      // —— 自爆尸：贴上来就点引信 ——
      if (z.def.explode && !z.fuse && !player.inside &&
          Math.abs(dx) < 54 && Math.abs(z.z - player.z) < 44) {
        z.fuse = z.def.explode.fuse;
        SFX.fuse();
      }
      if (z.fuse > 0) {
        z.fuse -= dt;
        z.walkT += dt * 9;
        if (z.fuse <= 0) { explodeZombie(z, i); continue; }
      }

      // —— 远程僵尸：维持距离，抛物线投掷（能打到高台上，是高台唯一的威胁）——
      if (rg && !player.inside && !(z.fuse > 0)) {
        z.shootT = (z.shootT === undefined ? rand(0.6, 1.8) : z.shootT) - dt;
        if (z.shootT <= 0 && Math.abs(dx) < rg.keep + 260 && Math.abs(z.z - player.z) < 170) {
          z.shootT = rg.cd * rand(0.85, 1.2);
          throwAt(z, player.x, GROUND - player.z - 44, rg);
        }
      }

      // —— 跳跃者：中距离蓄力扑过来 ——
      if (z.def.pounce && !player.inside && sameLevel) {
        z.pounceT = (z.pounceT === undefined ? rand(1, 3) : z.pounceT) - dt;
        if (z.pounceT <= 0 && Math.abs(dx) > 70 && Math.abs(dx) < 430) {
          z.pounceT = z.def.pounce.cd;
          z.lungeT = 0.45;
          z.lungeDir = z.dir;
          SFX.jump();
        }
      }
      if (z.lungeT > 0) {
        z.lungeT -= dt;
        z.x += z.lungeDir * z.def.pounce.spd * dt;
        z.walkT += dt * 13;
      } else if (!attacking && !(z.fuse > 0)) {
        // 远程僵尸维持距离：太远就走近，太近就往后撤
        if (!rg || Math.abs(dx) > rg.keep) {
          z.x += z.dir * zspd * dt;
          z.walkT += dt * (2 + zspd * 0.05);
        } else if (Math.abs(dx) < rg.keep - 70) {
          z.x -= z.dir * zspd * dt * 0.9;
          z.walkT += dt * (2 + zspd * 0.05);
        }
      }
      if (attacking && z.atkT <= 0 && !(z.fuse > 0)) {
        z.atkT = z.def.atk;
        hurtPlayer(z.def.dmg * (1 + (G.wave - 1) * 0.05), z.dir * 150);
        // 「电击的」词缀：咬中的同时放一次短距离电弧
        if (z.affix === 'shocking') {
          arcs.push({ pts: [[z.x, z.y() - z.h * 0.6], [player.x, GROUND - player.z - 40]], life: 0.16, max: 0.16 });
          SFX.tesla();   // 电击词缀的电弧
          hurtPlayer(4, 0);
        }
      }
      // 玩家躲在屋里时，门口的僵尸会砸墙 —— 但只砸 2~4 下就失去兴趣去游走
      if (player.inside && Math.abs(z.x - targetX) < 70) {
        z.pound = true;
        if (z.atkT <= 0) {
          z.atkT = z.def.atk;
          damageHouse(player.inside, z.def.dmg * (z.def.smash || 1) * 0.7);
          if (z.poundLeft === undefined) z.poundLeft = irand(2, 4);
          if (--z.poundLeft <= 0) { z.boredT = rand(4, 9); z.poundLeft = undefined; }
        }
      } else z.pound = false;
    }
    z.vy = z.vy || 0;
    z.x += z.vy * dt;
    z.vy *= Math.pow(0.008, dt);
    stepOnFloors(z, dt, false);        // 走到平台边缘会掉下去，和玩家同一套物理
    z.x = clamp(z.x, 40, WORLD_W - 40);
  }

  // 僵尸投掷物 + 地面危险区
  updateZProj(dt);
  // 光环类（尖叫者的加速 / 护士尸的回血）—— 必须在僵尸移动之后、绘制之前
  updateAuras(dt);

  // 火焰粒子
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.life -= dt;
    if (p.life <= 0) { parts.splice(i, 1); continue; }
    p.x += p.vx * dt; p.y += p.vy * dt;
    if (p.grav) p.vy += p.grav * dt;
    if (p.type === 'fire') {
      p.vx *= Math.pow(0.25, dt); p.vy *= Math.pow(0.25, dt);
      p.vy -= 60 * dt;
      p.t += dt;
      if (p.y >= GROUND) p.life = Math.min(p.life, 0.1);
      // 必须用 eachZombieRev —— 火焰烧死一只「爆裂的」会连锁炸掉一整片，
      // 数组瞬间变短，裸循环会在下一次 zombies[j] 上取到 undefined 直接崩
      eachZombieRev((z, j) => {
        const zy = z.y();
        if (p.x > z.x - z.w / 2 - 6 && p.x < z.x + z.w / 2 + 6 && p.y > zy - z.h - 6 && p.y < zy + 4) {
          damageZombieFire(z, j, 26 * dt);
        }
      });
    }
    if ((p.type === 'blood' || p.type === 'shell' || p.type === 'head') && p.y >= GROUND) {
      p.y = GROUND; p.vy = -p.vy * 0.3; p.vx *= 0.5;
      if (Math.abs(p.vy) < 40) { p.vy = 0; p.grav = 0; p.vx = 0; }
      if (p.type === 'blood' && p.life > 0.15) p.life = Math.min(p.life, 0.35);
    }
  }

  // 金币
  for (let i = coins.length - 1; i >= 0; i--) {
    const c = coins[i];
    c.t += dt; c.life -= dt;
    c.vy += 900 * dt;
    c.y += c.vy * dt; c.x += c.vx * dt;
    if (c.y > GROUND - 8) { c.y = GROUND - 8; c.vy = -Math.abs(c.vy) * 0.45; c.vx *= 0.7; if (Math.abs(c.vy) < 60) c.vy = 0; }
    const dx = player.x - c.x, dy = (GROUND - 40 - player.z) - c.y;
    const d = Math.hypot(dx, dy);
    if (d < 110) { c.x += dx / d * 420 * dt; c.y += dy / d * 420 * dt; }
    if (d < 26) {
      player.cash += c.v;
      texts.push({ x: c.x, y: c.y - 10, txt: '+$' + c.v, col: '#e8c559', life: 0.6, max: 0.6, vy: -70 });
      SFX.coin();
      coins.splice(i, 1);
      continue;
    }
    if (c.life <= 0) coins.splice(i, 1);
  }

  // 道具（蝙蝠/医疗包）
  for (let i = items.length - 1; i >= 0; i--) {
    const it = items[i];
    it.t += dt; it.life -= dt;
    if (Math.abs(player.x - it.x) < 34 && Math.abs(player.z - (it.z || 0)) < 50) {
      if (it.type === 'bat') {
        if (player.bats < 3) { player.bats++; texts.push({ x: it.x, y: it.y - 20, txt: '蝙蝠 +1', col: '#b48ae0', life: 1, max: 1, vy: -50 }); SFX.bat(); }
        else { player.cash += 20; texts.push({ x: it.x, y: it.y - 20, txt: '+$20', col: '#e8c559', life: 1, max: 1, vy: -50 }); SFX.coin(); }
      } else if (it.type === 'ammo') {
        const n = grantAmmo(it.cat, it.amt);
        if (n > 0) {
          texts.push({ x: it.x, y: it.y - 20, txt: (it.cat === 'cell' ? '能量 +' : '弹药 +') + n, col: '#b0c8e0', life: 1, max: 1, vy: -50 });
          SFX.buy();
        } else {
          // 没有对应类型的枪 —— 换成一点钱，不至于白捡
          player.cash += 10;
          texts.push({ x: it.x, y: it.y - 20, txt: '用不上 +$10', col: '#8a9682', life: 1, max: 1, vy: -50 });
          SFX.coin();
        }
      } else {
        G.runNoMedkit = false;
        const heal = Math.round(30 * (P ? P.healMul : 1));   // 「护士 Mira」的回血加成
        player.hp = Math.min(player.maxHp, player.hp + heal);
        texts.push({ x: it.x, y: it.y - 20, txt: '+' + heal + ' HP', col: '#7ce07c', life: 1, max: 1, vy: -50 });
        SFX.buy();
      }
      items.splice(i, 1);
      continue;
    }
    if (it.life <= 0) items.splice(i, 1);
  }

  // 文字/电弧
  for (let i = texts.length - 1; i >= 0; i--) {
    const t = texts[i];
    t.life -= dt; t.y += (t.vy || -50) * dt;
    if (t.life <= 0) texts.splice(i, 1);
  }
  for (let i = arcs.length - 1; i >= 0; i--) {
    arcs[i].life -= dt;
    if (arcs[i].life <= 0) arcs.splice(i, 1);
  }

  // 刷怪（按推进距离收紧）+ 推进判定（越过栅栏 → 关卡结束）
  updateSpawner(dt);
  updateProgress(dt);
  updateGimmicks(dt);
  updatePlatforms(dt);
  updateStalker(dt);
  updateMeters(dt);
  updateMusic(dt);
  // 超级武器：计时 / 召唤物 / 黑洞 / 空投箱下落。
  // 濒死空投的判定放在 HP 已经扣完之后的这里，不然本帧挨的那一下要等下一帧才生效。
  updateSuper(dt);
  updateDrop(dt);
  if (!G.panicDropped && !G.cleared && player.hp > 0 && player.hp < player.maxHp * 0.25) tryDropSuper('panic');
  if (G.state === 'play' && !G.cleared) {
    G.groanT -= dt;
    if (G.groanT <= 0) {
      G.groanT = rand(2, 6);
      if (zombies.length > 0) {
        const z = choice(zombies);
        SFX.groan(clamp(1 - Math.abs(z.x - player.x) / 900, 0.15, 1), z.type);
      }
    }
  }

  G.bannerT = Math.max(0, G.bannerT - dt);
  G.hurtT = Math.max(0, G.hurtT - dt);
  G.flashT = Math.max(0, G.flashT - dt);
  G.shake = Math.max(0, G.shake - dt * 26);

  // 相机
  const tx = clamp(player.x + player.facing * 50, VW / 2, WORLD_W - VW / 2);
  cam.x = lerp(cam.x, tx, 1 - Math.pow(0.0008, dt));
}
// ============================== Boss：病毒体 · 母巢 ==============================
// 三阶段。Boss 直接放在 zombies 数组里（带 isBoss 标记），
// 这样子弹碰撞、绘制、爆炸、道具伤害全部复用现成代码，只在 AI 循环里分个支。
function spawnBoss() {
  if (G.boss) return;
  const t = ZTYPES.boss;
  const b = {
    type: 'boss', def: Object.assign({}, t), isBoss: true,
    x: clamp(player.x + 560, 600, G.fenceX - 120), z: 0, vz: 0,
    w: t.w, h: t.h, dir: -1,
    spd: t.spd,   // ⚠ 漏了这个 → b.x += dir * undefined * dt = NaN（测试逼出来的）
    hp: t.hp, maxHp: t.hp, phase: 1,
    onGround: true, floor: null, walkT: 0, wob: 0, hitT: 0, burn: 0, burnT: 0,
    atkT: 2, summonT: 6, boulderT: 5, chargeT: 5, slamT: 0, invulnT: 1.6,
    charging: false, chargeVx: 0, ridden: false,
  };
  b.y = () => GROUND - b.z;
  b.floor = floorAt(b.x, 1e9) || floors[0];
  b.z = b.floor.z;
  zombies.push(b);
  G.boss = b;
  G.banner = '病 毒 体 · 母 巢'; G.bannerT = 3.6;
  SFX.giant(); G.shake = 20;
  G.flashT = 0.3;
  zombies.forEach(o => { if (o !== b) o.hp = 0; });   // 清场，给 Boss 战一个干净的场地
}
function updateBossAI(b, dt) {
  b.walkT += dt * 2.0; b.wob += dt * 2.4;
  const dx = player.x - b.x;
  b.dir = dx >= 0 ? 1 : -1;

  // ── 阶段切换：掉到 66% / 33% 时换一套招式 ──
  const f = b.hp / b.maxHp;
  const want = f > 0.66 ? 1 : f > 0.33 ? 2 : 3;
  if (want !== b.phase) {
    b.phase = want;
    G.banner = ['', '阶 段 一', '阶 段 二', '阶 段 三 · 暴 走'][want];
    G.bannerT = 2.4; G.shake = 22; G.flashT = 0.35;
    SFX.giant(); SFX.boom();
    b.invulnT = 1.3;                                  // 变身期间短无敌
    // 每次变身丢一个超级武器箱 —— 打到阶段二/三正好弹尽粮绝，这是设计好的补给点
    tryDropSuper('boss');
    // 不 splice —— 这里只是把杂兵的血清零，真正移除发生在后面的主循环里，
    // 所以裸的倒序遍历在这里是安全的（测试会自动检查这个标注是否还在）
    for (let j = zombies.length - 1; j >= 0; j--) {
      if (zombies[j] && zombies[j] !== b) zombies[j].hp = 0;
    }
    for (let k = 0; k < 26; k++) {
      parts.push({ type: 'fire', x: b.x + rand(-40, 40), y: b.y() - rand(0, b.h), vx: rand(-320, 320), vy: rand(-340, 60), life: rand(0.3, 0.7), max: 0.7, size: rand(8, 16), t: 0 });
    }
  }
  if (b.invulnT > 0) { b.invulnT -= dt; return; }

  // ── 阶段三：无敌冲锋 ──
  if (b.charging) {
    b.x += b.chargeVx * dt;
    if (Math.abs(dx) < 74 && Math.abs(b.z - player.z) < 70 && !player.inside) {
      player.invuln = 0;
      hurtPlayer(34, b.dir * 430);
      b.charging = false; b.slamT = 1.1; G.shake = 26; SFX.boom();
    }
    if (b.x < 200 || b.x > G.fenceX + 400) b.charging = false;
    return;
  }
  if (b.slamT > 0) { b.slamT -= dt; return; }

  // ── 基础：跛行靠近 ──
  if (Math.abs(dx) > 160) b.x += b.dir * b.spd * dt;
  stepOnFloors(b, dt, false);

  // ── 阶段一：抛物线抛射酸液 ──
  b.atkT -= dt;
  if (b.atkT <= 0) {
    b.atkT = b.phase >= 3 ? 1.5 : b.phase >= 2 ? 2.1 : 2.7;
    throwAt(b, player.x, GROUND - player.z - 44, { spd: 430, dmg: 10 + b.phase * 2, elem: 'acid' });
  }
  // ── 阶段二：掷巨石 + 召唤小怪 ──
  if (b.phase >= 2) {
    b.boulderT -= dt;
    if (b.boulderT <= 0) {
      b.boulderT = rand(4.5, 7);
      throwAt(b, player.x, GROUND - 12, { spd: 320, dmg: 24, elem: 'rock' });
      SFX.spit();
    }
    b.summonT -= dt;
    if (b.summonT <= 0) {
      b.summonT = rand(9, 13);
      const kinds = ['normal', 'fast', 'crawler', 'bomber'];
      for (let k = 0; k < 3; k++) {
        spawnZombie(choice(kinds));
        const z = zombies[zombies.length - 1];
        if (z) { z.x = clamp(b.x + rand(-200, 200), 300, G.fenceX - 60); z.floor = floorAt(z.x, 1e9) || floors[0]; z.z = z.floor.z; }
      }
      G.banner = '它在召唤!'; G.bannerT = 1.4;
      SFX.giant();
    }
  }
  // ── 阶段三：蓄力冲锋 ──
  if (b.phase >= 3) {
    b.chargeT -= dt;
    if (b.chargeT <= 0 && Math.abs(dx) > 280) {
      b.chargeT = rand(4.5, 6.5);
      b.charging = true;
      b.chargeVx = b.dir * 760;
      G.banner = '它 冲 锋 了!'; G.bannerT = 1.3;
      SFX.giant();
    }
  }
}
function onBossDefeated(b) {
  G.boss = null;
  G.bossDone = true;
  G.banner = '病 毒 源 头 已 清 除 · 栅栏打开了'; G.bannerT = 3.6;
  G.shake = 26; G.flashT = 0.5;
  S.stats.levelsCleared += 0;
  if (!S.chars.duke) { S.chars.duke = true; S.demonUnlocked = true; }
  writeSave();
  SFX.clear(); SFX.boom();
}
function drawBossBar() {
  const b = G.boss;
  if (!b) return;
  const w = 620, x = (VW - w) / 2, y = 74;
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillRect(x - 4, y - 4, w + 8, 26);
  const f = clamp(b.hp / b.maxHp, 0, 1);
  ctx.fillStyle = f > 0.66 ? '#8a2fb0' : f > 0.33 ? '#c0392b' : '#ff4a1a';
  ctx.fillRect(x, y, w * f, 18);
  ctx.strokeStyle = '#e8c559'; ctx.lineWidth = 2;
  ctx.strokeRect(x - 3.5, y - 3.5, w + 7, 25);
  // 阶段刻度
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  for (const t of [0.33, 0.66]) { ctx.beginPath(); ctx.moveTo(x + w * t, y); ctx.lineTo(x + w * t, y + 18); ctx.stroke(); }
  ctx.textAlign = 'center';
  ctx.font = 'bold 13px "Microsoft YaHei", sans-serif';
  ctx.fillStyle = '#f0d8ff';
  ctx.fillText('病 毒 体 · 母 巢　—　阶段 ' + ['', '一', '二', '三'][b.phase], VW / 2, y - 10);
}

// ============================== 追着你的那只 ==============================
// 一只杀不死的巨型僵尸，从关卡开始就慢慢跟着你。
// 它比玩家慢（追不上），但一旦你停下来磨蹭，它就会赶到。
// 目的：把"慢慢磨"的打法变成"必须推进"，而且比倒计时更有压迫感。
function spawnStalker() {
  const t = ZTYPES.giant;
  const s = {
    type: 'giant', def: Object.assign({}, t),
    x: 120, z: 0, vz: 0, w: 98, h: 152, dir: 1,
    spd: 60, hp: 1e9, maxHp: 1e9, onGround: true, floor: null,
    walkT: 0, wob: 0, hitT: 0, atkT: 0, boredT: 0,
    stalker: true, slamT: 0, roarT: 4,
  };
  s.y = () => GROUND - s.z;
  s.floor = floorAt(s.x, 1e9) || floors[0];
  s.z = s.floor.z;
  G.stalker = s;
}
function updateStalker(dt) {
  const s = G.stalker;
  if (!s || G.cleared) return;
  s.walkT += dt * 3;
  s.wob += dt * 3;
  s.hitT = Math.max(0, s.hitT - dt);
  s.roarT -= dt;
  if (s.roarT <= 0) {
    s.roarT = rand(7, 13);
    SFX.giant();
    G.shake = Math.min(G.shake + 6, 14);
    texts.push({ x: s.x, y: s.y() - s.h - 20, txt: '……', col: '#c0392b', life: 1.2, max: 1.2, vy: -30 });
  }
  if (s.slamT > 0) { s.slamT -= dt; return; }        // 拍倒玩家后短暂停顿

  const targetX = player.inside ? doorOf(player.inside).x : player.x;
  s.dir = targetX > s.x ? 1 : -1;
  s.x += s.dir * s.spd * dt;
  stepOnFloors(s, dt, false);

  // 沿途撞飞普通僵尸（它不在乎撞到什么）
  eachZombieRev((o, j) => {
    if (Math.abs(o.x - s.x) < 56 && Math.abs(o.z - s.z) < 60) {
      damageZombie(o, j, 999, false, s.dir * 420);
    }
  });
  // 撞到玩家：重伤 + 击飞 + 短暂停顿
  if (!player.inside && Math.abs(player.x - s.x) < 62 && Math.abs(player.z - s.z) < 70) {
    player.invuln = 0;
    hurtPlayer(26, s.dir * 380);
    s.slamT = 1.3;
    G.shake = 22;
    SFX.boom();
  }
  // 玩家躲屋里也躲不掉 —— 它会砸墙
  if (player.inside && Math.abs(s.x - doorOf(player.inside).x) < 90) {
    s.x = doorOf(player.inside).x;
    if (s.atkT <= 0) { s.atkT = 1.1; damageHouse(player.inside, 34); }
  }
  s.atkT -= dt;
}
function drawStalker() {
  const s = G.stalker;
  if (!s) return;
  const sx = s.x - cam.x + VW / 2;
  if (sx < -220 || sx > VW + 220) return;
  const feet = s.y();
  ctx.save();
  ctx.translate(sx, feet);
  ctx.scale(s.dir, 1);
  // 压迫感的红色光晕
  const pulse = 0.5 + 0.5 * Math.sin(G.time * 3);
  ctx.fillStyle = `rgba(190,30,20,${0.10 + pulse * 0.10})`;
  ctx.beginPath(); ctx.ellipse(0, -s.h * 0.5, s.w * 1.15, s.h * 0.75, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath(); ctx.ellipse(0, 6, s.w * 0.6, 10, 0, 0, TAU); ctx.fill();
  const walk = Math.sin(s.walkT * 5);
  const dark = 'rgba(12,6,6,0.92)';
  ctx.strokeStyle = dark; ctx.lineWidth = s.w * 0.15; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, -s.h * 0.42); ctx.lineTo(walk * s.w * 0.3, -2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, -s.h * 0.42); ctx.lineTo(-walk * s.w * 0.3, -2); ctx.stroke();
  ctx.strokeStyle = '#5a1a14'; ctx.lineWidth = s.w * 0.13;
  ctx.beginPath(); ctx.moveTo(0, -s.h * 0.72); ctx.lineTo(s.w * 0.55, -s.h * 0.66 + Math.sin(s.wob) * 6); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, -s.h * 0.72); ctx.lineTo(s.w * 0.55, -s.h * 0.52 + Math.cos(s.wob) * 6); ctx.stroke();
  ctx.fillStyle = s.hitT > 0 ? '#fff' : '#4a1c16';
  ctx.beginPath(); ctx.roundRect(-s.w * 0.32, -s.h * 0.78, s.w * 0.64, s.h * 0.4, 12); ctx.fill();
  ctx.strokeStyle = dark; ctx.lineWidth = 4; ctx.stroke();
  ctx.fillStyle = '#3a1410';
  ctx.beginPath(); ctx.arc(s.w * 0.06, -s.h * 0.9, s.w * 0.24, 0, TAU); ctx.fill();
  ctx.strokeStyle = dark; ctx.lineWidth = 4; ctx.stroke();
  ctx.fillStyle = '#ff3020';
  ctx.beginPath(); ctx.arc(s.w * 0.18, -s.h * 0.92, 5 + pulse * 2, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(s.w * 0.02, -s.h * 0.92, 5 + pulse * 2, 0, TAU); ctx.fill();
  ctx.restore();
  // 屏幕边缘的血色提示：它在附近时会有
  const d = Math.abs(player.x - s.x);
  if (d < 900) {
    const a = (1 - d / 900) * 0.28;
    const g = ctx.createLinearGradient(0, 0, VW * 0.22, 0);
    g.addColorStop(0, `rgba(150,10,8,${a})`);
    g.addColorStop(1, 'rgba(150,10,8,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, VW * 0.22, VH);
  }
}

// ============================== 连杀 / 噪音 / 昼夜 ==============================
function addNoise(v) { G.noise = clamp((G.noise || 0) + v, 0, NOISE_MAX); }
function updateMeters(dt) {
  // 连杀：3 秒内没有新击杀就归零
  if (G.comboT > 0) { G.comboT -= dt; if (G.comboT <= 0) G.combo = 0; }
  // 噪音衰减 + 本局噪音峰值（成就「安静地走」要看这个）
  if (G.noise > 0) G.noise = Math.max(0, G.noise - NOISE_DECAY * dt);
  G.runPeakNoise = Math.max(G.runPeakNoise || 0, G.noise);
  // 昼夜推进：跟着推进度从开场天色走到最暗的深夜
  G.dayT = clamp(player.x / (G.fenceX || 1), 0, 1);

  // 新手引导：只在第 1 关，做完一个动作划掉一条
  if (G.wave === 1 && S.tut && !S.tut.done) {
    const t = S.tut;
    if (Math.abs(player.vx) > 25) t.moved = true;
    if (!player.onGround) t.jumped = true;
    if (player.swingT > 0 || bullets.length > 0) t.fired = true;
    if (player.inside) t.entered = true;
    if (player.dodgeT > 0) t.dodged = true;
    if (t.moved && t.jumped && t.fired && t.entered && t.dodged) { t.done = true; writeSave(); }
  }
}

// ============================== 移动平台 ==============================
// 高台不再是静态的：竖直升降的工地电梯、左右来回的卡车。
// 站在上面的玩家和僵尸会跟着一起动 —— 跳跃时机因此变成技术活。
function updatePlatforms(dt) {
  // 1) 先让所有移动平台走一步，并记下这一帧的位移量
  for (const f of floors) {
    if (!f.move) { f.dx = 0; f.dz = 0; continue; }
    const prevX0 = f.x0, prevZ = f.z;
    f.t = (f.t || 0) + dt * f.move.spd;
    const off = Math.sin(f.t + (f.seed || 0) * 6) * f.move.range;
    if (f.move.axis === 'y') f.z = f.z0 + off;
    else { f.x0 = f.x0Base + off; f.x1 = f.x0 + f.w; }
    f.dx = f.x0 - prevX0;
    f.dz = f.z - prevZ;
  }
  // 2) 站在移动平台上的东西跟着平台一起走（玩家 + 僵尸）
  for (const e of [player, ...zombies]) {
    const f = e.floor;
    if (!f || !f.move || !e.onGround) continue;
    if (f.move.axis === 'y') { e.z = f.z; e.vz = 0; }
    else e.x += f.dx;
  }
}

// ============================== 关卡机关 ==============================
// 每张地图可以有自己独特的机关（低重力/冰面/沙尘暴/酸雨/极寒/陨石）。
// 这些是「整张图的全局修正」—— 和僵尸的远程攻击、地面危险区是两套东西。
// 低重力和冰面直接改物理（见 stepOnFloors / updatePlayer），这里只管周期性的部分。
function updateGimmicks(dt) {
  const m = G.mods;
  if (!m || G.cleared) return;

  // 极寒：每秒掉一点血，但留 5 点不死 —— 逼你去找补给，而不是站着慢慢冻死
  if (m.cold && !player.inside) {
    G.coldT = (G.coldT || 0) + dt;
    if (G.coldT >= 1) {
      G.coldT -= 1;
      if (player.hp > 5) hurtPlayer(1.6, 0);
      parts.push({ type: 'spark', smoke: true, x: player.x + rand(-16, 16), y: GROUND - player.z - rand(50, 86), vx: rand(-16, 16), vy: -24, grav: -6, life: 1.2, max: 1.2, size: rand(4, 8) });
    }
  }
  // 酸雨：每隔一阵在玩家附近落一片酸池（可预测、可躲）
  if (m.acidRain) {
    G.rainT = (G.rainT === undefined ? 5 : G.rainT) - dt;
    if (G.rainT <= 0) {
      G.rainT = rand(5, 9);
      const hx = clamp(player.x + rand(-430, 430), 400, Math.max(500, G.fenceX - 200));
      hazards.push({ type: 'acid', x: hx, z: 0, r: 62, t: 0, tick: 0, life: 9 });
      SFX.spit();
    }
  }
  // 陨石带：天上不断掉石头
  if (m.meteor) {
    G.meteorT = (G.meteorT === undefined ? 2 : G.meteorT) - dt;
    if (G.meteorT <= 0) {
      G.meteorT = rand(1.6, 4.2);
      meteors.push({
        x: clamp(player.x + rand(-540, 540), 300, Math.max(400, G.fenceX - 200)),
        y: -70, vy: rand(420, 620), r: rand(14, 24), spin: rand(0, TAU),
      });
    }
  }
  for (let i = meteors.length - 1; i >= 0; i--) {
    const mt = meteors[i];
    mt.y += mt.vy * dt; mt.vy += 520 * dt; mt.spin += dt * 4;
    if (mt.y < GROUND - 6) continue;
    meteors.splice(i, 1);
    SFX.boom(); G.shake = Math.min(G.shake + 9, 16);
    for (let k = 0; k < 18; k++) {
      parts.push({ type: 'spark', x: mt.x, y: GROUND - rand(0, 20), vx: rand(-260, 260), vy: rand(-360, -60), grav: 800, life: rand(0.3, 0.8), max: 0.8, size: rand(2, 5) });
    }
    hazards.push({ type: 'fire', x: mt.x, z: 0, r: 46, t: 0, tick: 0, life: 3.5 });
    if (!player.inside && Math.abs(player.x - mt.x) < mt.r + 22 && player.z < 44) {
      hurtPlayer(18, (player.x > mt.x ? 1 : -1) * 200);
    }
  }
}
function damageZombieFire(z, j, dmg) {
  z.hp -= dmg;
  z.burnT = 2;
  z.hitT = 0.05;
  if (z.hp <= 0) killZombie(z, j, false);
}
