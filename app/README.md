# 僵尸村庄2 · 代码结构

**入口：双击 `app/index.html`。** 零依赖、零构建、零外部资源 —— 所有图形都是 Canvas 程序化绘制，
所有音效都是 WebAudio 合成，没有任何图片 / 音频文件。

## 为什么是 18 个普通 `<script>` 而不是 ES module

ES module（`<script type="module">`）在 `file://` 下会被浏览器的 CORS 策略拦掉，双击打不开。
普通 `<script src>` 没有这个限制。所有文件共享同一个全局作用域，按下面的顺序依次加载 ——
**顺序不能乱**（后面依赖前面的常量）。

## 文件清单（按加载顺序）

| 文件 | 行数 | 内容 |
|---|---|---|
| `js/00-core.js` | ~75 | 画布 / 常量（`GROUND` `FLOOR_H` `GUN_Y`）× 多层地形平台系统（`floors` / `floorAt` / `stepOnFloors`） |
| `js/01-input.js` | ~65 | 纯键盘输入（`keys` 电平 / `pressed` 边沿）、换枪、暂停 / 重开快捷键 |
| `js/02-audio.js` | ~70 | WebAudio 合成音效表 `SFX`（无音频文件） |
| `js/03-data.js` | ~250 | **数据表**：17 把武器（×3 级）、10 种僵尸 + 刷怪权重、**7 种僵尸词缀 `AFFIXES`**、**5 种天气 `WEATHERS`**、颜色插值 `lerpColor` |
| `js/04-state.js` | ~90 | 全局状态数组、`G` 状态对象（含连杀 / 噪音 / 昼夜 / 天气 / 追逐者）、存档 `S` |
| `js/05-level.js` | ~470 | **关卡构建**：`MAPS`（22 张地图）× `SEGMENTS`（9 种路段）× `GIMMICKS`（6 种机关）× `PLANETS`（星球分组）× `buildLevel` / `placeSegment`（含移动平台）/ 刷怪器（受噪音影响） |
| `js/06-props.js` | ~250 | 场景物件：`PROP_KINDS`（30 种，靠 9 个形状参数化）× 打碎 / 掉落 / 绘制 |
| `js/07-world.js` | ~250 | 地面危险区、投掷物、陨石、沙尘暴、**天气 + 昼夜叠加 `drawAtmosphere`**、栅栏、货架的绘制 |
| `js/08-zombies.js` | ~300 | 僵尸 AI（游走 / 远程投掷 / 自爆 / 扑击 / **堆叠**）、**词缀效果**、刷怪器、爆炸、击杀结算（含**连杀**） |
| `js/09-combat.js` | ~105 | 开火 / 近战挥砍 / 闪电链 / 伤害结算（重甲护甲 + **护盾词缀**），**开枪推高噪音** |
| `js/10-houses.js` | ~85 | 安全屋：跳跃进出、物资刷新、被僵尸砸塌 |
| `js/11-update.js` | ~490 | **主更新**：玩家物理（含**闪避翻滚**）、子弹、僵尸、粒子、拾取、机关 `updateGimmicks`、**移动平台 `updatePlatforms`**、**追逐者 `updateStalker`**、连杀 / 噪音 / 昼夜 `updateMeters` |
| `js/12-render.js` | ~980 | **全部绘制**：天空（户外/隧道/室内）× 街道（7 种材质）× 房屋 × 僵尸（10 种 + 词缀光环）× 玩家 × HUD（连杀 / 噪音计 / 闪避冷却 / 追逐者警告） |
| `js/13-shelf.js` | ~250 | 武器图标（Canvas→dataURL 缓存）、货架商店（方向键 + Enter + U 撤销） |
| `js/14-ui.js` | ~180 | 流程：`resetGame` / `startLevel` / `winLevel` / 关卡选择（按星球分组）/ 菜单接线 |
| `js/15-main.js` | ~150 | 主循环 + `window.__tg` 测试钩子 |
| `js/16-menus.js` | ~230 | 角色 / Perk / 图鉴 / 成就 四个界面 + 成就判定 `checkAch()` |
| `js/17-super.js` | ~530 | **超级武器空投**：`SUPER_WEAPONS`（8 种）× 降落伞铁箱 × 第 4 临时槽 × 各效果的更新与绘制 |

## 数据在哪

想调数值基本只用改这三个文件：

- **`js/03-data.js`** —— 武器伤害 / 射速 / 价格 / 升级曲线；僵尸血量 / 速度 / 行为参数
- **`js/05-level.js`** —— 地图的配色、地面材质、物件池、路段组合、机关
- **`js/06-props.js`** —— 可打碎物件的血量与掉落

## 测试

```bash
node test/keyboard.test.js      # 键盘操作层
node test/terrain.test.js       # 多层地形物理
node test/safehouse.test.js     # 安全屋
node test/world.test.js         # 地图物件 / 高台 / 僵尸上高台
node test/level.test.js         # 关卡闭环（栅栏→货架→结算→存档）
node test/zombies.test.js       # 僵尸解锁曲线 + 各类型行为
node test/maps.test.js          # 22 张地图的视觉/地形/机关差异
node test/ui-gimmick.test.js    # 暂停菜单 + 6 种机关
node test/new-systems.test.js   # 僵尸词缀 / 翻滚 / 连杀 / 噪音 / 追逐者 / 移动平台 / 天气 / 昼夜
node test/audio.test.js         # 音效引用完整性 / 17 把武器音色 / 自适应 BGM
node test/boss.test.js          # Boss 三阶段 / 锁死栅栏 / 击杀解锁
node test/meta.test.js          # Perk 装备与生效 / 角色解锁 / 图鉴 / 成就 / 新手引导
node test/super.test.js         # 超级武器空投：触发 / 开箱 / 第 4 槽 / 8 种效果
node test/late-zombies.test.js  # 第 11~22 关的四种新敌人（毒雾 / 预判投掷 / 加速光环 / 回血光环）
node test/infected.test.js      # 感染模式：解锁 / 四个乘数 / 存档 / 成就
node test/menu-wiring.test.js   # 菜单接线：按钮只绑一次、真按下去效果只发生一次
node test/chain-explosion.test.js  # 连锁爆炸把 zombies 数组从循环底下抽走（真崩过）
node test/smoke.test.js         # 驱动真实帧跑渲染管线
```

## ⚠ 改代码时最容易踩的两个坑

**1. 遍历僵尸并可能打死它，不要裸写倒序循环。**

```js
// ✗ 会崩
for (let j = zombies.length - 1; j >= 0; j--) { const z = zombies[j]; ... }

// ✓ 用这个
eachZombieRev((z, j) => { ... });          // js/08-zombies.js
```

`damageZombie → killZombie` 之后，「爆裂的」词缀 / 自爆尸 / Boss 会**连锁爆炸**，
在更深的调用栈里又 `splice` 好几次，其中一些下标比外层循环手里的 `j` 还小。
数组瞬间缩到比 `j` 还短，下一次 `zombies[j]` 就是 `undefined` —— 实测
`TypeError: Cannot read properties of undefined (reading 'y')`，整局卡死。
**这是真发生过的崩溃**，`test/chain-explosion.test.js` 是它的回归测试，第 ⑤ 节还会
静态扫描源码，发现没加守卫的倒序循环就报红。三处豁免写法：走 `eachZombieRev`、
就地补 `if (!z) continue`、或在上面三行内标注 `不 splice` / `安全遍历`。

**2. 屏幕坐标 y 越小越高。** 从高处射出的子弹要往下压，`vy` 得是正的
（`GUN_Y - hz`，不是 `hz - GUN_Y`）。写反了子弹朝天飞、伤害恒为 0，而且不报错。

## 新增系统的关键数值（都在 `js/03-data.js` / `js/00-core.js`）

| 系统 | 关键常量 | 说明 |
|---|---|---|
| 僵尸词缀 | `AFFIXES` · `affixChance()` | 第 1 关 0%，第 10 关约 28%，第 18 关后半约 45% |
| 闪避翻滚 | `DODGE_SPD=620` `DODGE_CD=1.15` | Shift 触发，0.34 秒无敌帧 |
| 连杀 | `G.combo` / `G.comboT=3` | 每 5 连 +35% 金币，3 秒不击杀归零 |
| 噪音 | `NOISE_MAX=100` `NOISE_DECAY=16` | 开枪 +26（霰弹 +44，RPG +58），挥砍只 +6；噪音越高刷怪越快（实测 +54%） |
| 追逐者 | `MAPS[].stalker` | 5 张地图有；血量形同虚设、撞到你扣 26 血后停顿 1.3 秒 |
| 移动平台 | `placeSegment()` 里 55% 概率 | 升降（±26~58px）/ 横移（±60~130px） |
| Boss | `MAPS[].boss` | 第 10 / 22 关；栅栏锁死，三阶段 4000 HP |
| Perk | `PERKS` · `computePerkStats()` | 12 个选 3，每个 3 级；聚合表 `P` |
| 成就 | `ACHIEVEMENTS` · `checkAch()` | 20 个，通关结算时统一检查 |
| 超级武器 | `SUPER_WEAPONS` · `tryDropSuper()` | 8 种，每种 20 秒；濒死（<25% HP，每次尝试 1 次）+ Boss 每次换阶段各掉一个 |
| 第 4 临时槽 | `player.super` / `player.superOn` | `player.slot` 永远只有 0~2，超级槽是索引 `SLOTS`；`4` 键或 `X` 循环切 |
| 感染模式 | `INFECTED` · `inf()` · `G_INF` | 通关第 10 关解锁；HP×1.5 / 速度×1.15 / 刷怪间隔×0.8 / 金币×2，在 `startLevel()` 里定死 |
| 后期僵尸 | `ZTYPES.bloater/thrower/screamer/nurse` | 第 11 / 13 / 16 / 21 关各解锁一种（11 关往后原本一个新敌人都没有） |
| 光环 | `updateAuras()` · `def.aura` | 尖叫者（加速 55%、半径 320）· 护士尸（回血 16/s、半径 270）；O(n²) 扫描，n≤32 |

### 超级武器为什么单开一个文件

`17-super.js` 里 8 种效果刻意做成**两种范式**，否则它们就只是"伤害更高的枪"：

- `auto: true` —— 直升机 / 无人机群。召唤物，拿到就自动干活，不用按键。
- `auto: false` —— 其余 6 种。按住空格才生效，20 秒是你能用它的时间窗口。

两条接入点值得记一下：

1. **第 4 槽不碰 `player.slot`**。`player.slot` 永远只有 0~2，超级槽是虚拟索引 `SLOTS`，
   由 `player.superOn` 表达。`curWeapon()` 在 `superOn` 时返回一个**合成的武器对象**，
   于是 HUD 的名字/弹药、`attack()` 的分支全都走同一套读取 —— 没在别处再判断一次。
2. **子弹从高处射出时 `vy` 必须为正**。屏幕坐标 y 越小越高，`GUN_Y = 570` 在 `GROUND - 300 = 310`
   的**下方**，所以下压量是 `GUN_Y - hz`。写成 `hz - GUN_Y` 会让子弹朝天飞、伤害恒为 0
   （直升机刚写出来就是这个 bug，测试里量到 0 点伤害才发现）。

`test/harness.js` 是无头运行环境（Canvas / DOM / Audio 全套桩件），会**按顺序加载
`app/index.html` 里列出的所有脚本**，每个作为独立 script 在同一上下文执行 —— 和浏览器行为一致。

## tools/

- `tools/split.js` —— 当初把单文件版拆成模块用的脚本（含"内容不丢不重"的回拼校验），留作参考
- `tools/snapshot/single-file-v2.html` —— 拆分前的单文件快照，**已冻结不再维护**
