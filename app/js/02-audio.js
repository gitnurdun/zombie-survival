// js/02-audio.js —— 由 tools/split.js 从单文件版拆出。
// 分段：音效

'use strict';
// ============================== 音效 ==============================
let AC = null, master = null, noiseB = null;
function initAudio() {
  if (AC) return;
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    master = AC.createGain(); master.gain.value = 0.45; master.connect(AC.destination);
    noiseB = AC.createBuffer(1, AC.sampleRate, AC.sampleRate);
    const d = noiseB.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  } catch (e) { AC = null; }
}
function tone(f, dur, vol, type, f2, delay) {
  if (!AC) return;
  const t = AC.currentTime + (delay || 0);
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = type || 'sine';
  o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(1, f2), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + dur + 0.05);
}
function noiseHit(f, dur, vol, q, type, delay) {
  if (!AC) return;
  const t = AC.currentTime + (delay || 0);
  const src = AC.createBufferSource(); src.buffer = noiseB; src.loop = true;
  const flt = AC.createBiquadFilter();
  flt.type = type || 'bandpass'; flt.frequency.value = f; flt.Q.value = q || 1;
  const g = AC.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(flt); flt.connect(g); g.connect(master);
  src.start(t); src.stop(t + dur + 0.1);
}
const SFX = {
  // ══════════ 枪械：17 把武器各有各的音色 ══════════
  pistol()  { noiseHit(1700, 0.10, 0.20, 1.2); tone(150, 0.06, 0.13, 'triangle', 60); },
  uzi()     { noiseHit(2100, 0.055, 0.13, 1.7); tone(200, 0.03, 0.07, 'square', 95); },
  pump()    { noiseHit(560, 0.30, 0.40, 0.65); tone(80, 0.16, 0.30, 'triangle', 36);
              noiseHit(1300, 0.11, 0.11, 1.3, 'bandpass', 0.17); },      // 泵动上膛声
  magnum()  { noiseHit(880, 0.20, 0.34, 0.9); tone(118, 0.12, 0.24, 'square', 46);
              noiseHit(2400, 0.09, 0.15, 2.2, 'bandpass', 0.02); },
  minigun() { noiseHit(1250, 0.045, 0.15, 2.4); tone(108, 0.03, 0.08, 'square', 68); },
  rpg()     { noiseHit(420, 0.34, 0.22, 0.5, 'lowpass'); tone(180, 0.30, 0.15, 'sawtooth', 900); },
  tesla()   { noiseHit(2600, 0.16, 0.22, 3); tone(90, 0.18, 0.18, 'sawtooth', 40); },
  cryo()    { noiseHit(4400, 0.13, 0.10, 4, 'highpass'); tone(1900, 0.15, 0.06, 'sine', 700); },
  plasma()  { tone(760, 0.13, 0.14, 'sawtooth', 190); noiseHit(1900, 0.10, 0.12, 2.6); },
  flamer()  { noiseHit(470, 0.20, 0.11, 0.55, 'lowpass'); noiseHit(1900, 0.10, 0.05, 1.5, 'bandpass'); },
  // ══════════ 近战：七种手感 ══════════
  swingL()  { noiseHit(950, 0.085, 0.08, 2); },                                        // 木棍 / 轻挥
  swingM()  { noiseHit(640, 0.12, 0.11, 1.5); tone(180, 0.09, 0.07, 'triangle', 90); }, // 大砍刀
  swingH()  { noiseHit(480, 0.15, 0.14, 1.3); tone(140, 0.12, 0.11, 'triangle', 62); }, // 消防斧 / 巨剑
  swingS()  { noiseHit(3200, 0.13, 0.10, 5, 'bandpass'); tone(900, 0.10, 0.07, 'sine', 1500); }, // 长剑：金属鸣响
  chainsaw(){ noiseHit(330, 0.06, 0.10, 6.5, 'bandpass'); tone(92, 0.05, 0.09, 'sawtooth', 128); },
  shovelS() { noiseHit(300, 0.13, 0.15, 1.1, 'lowpass'); tone(115, 0.09, 0.11, 'square', 56); },
  dartS()   { noiseHit(3200, 0.06, 0.09, 3); },
  swing()   { noiseHit(900, 0.09, 0.08, 2, 'bandpass'); },   // 兜底
  melee()   { tone(140, 0.07, 0.2, 'square', 80); noiseHit(350, 0.08, 0.16, 1, 'lowpass'); },
  hit()     { tone(160, 0.05, 0.08, 'square', 95); },
  head()    { tone(300, 0.05, 0.14, 'square', 180); tone(520, 0.07, 0.1, 'square', undefined, 0.04); },
  die()     { tone(110, 0.28, 0.14, 'sawtooth', 40); noiseHit(400, 0.2, 0.12, 0.8, 'lowpass'); },
  hurt()    { noiseHit(260, 0.24, 0.3, 0.8, 'lowpass'); tone(72, 0.2, 0.24, 'triangle', 38); },
  coin()    { tone(990, 0.06, 0.1, 'square'); tone(1480, 0.09, 0.09, 'square', undefined, 0.05); },
  buy()     { tone(880, 0.07, 0.13, 'square'); tone(1320, 0.09, 0.11, 'square', undefined, 0.06); },
  deny()    { tone(160, 0.12, 0.15, 'square', 110); },
  swap()    { noiseHit(2800, 0.04, 0.1, 3); },
  door()    { noiseHit(220, 0.25, 0.2, 1, 'lowpass'); },
  breakIn() { noiseHit(150, 0.4, 0.35, 0.7, 'lowpass'); tone(60, 0.3, 0.25, 'triangle', 30); },
  wave()    { tone(196, 0.45, 0.18, 'sawtooth'); tone(147, 0.6, 0.18, 'sawtooth', undefined, 0.4); },
  clear()   { tone(523, 0.12, 0.15, 'sine'); tone(659, 0.12, 0.15, 'sine', undefined, 0.11); tone(784, 0.2, 0.15, 'sine', undefined, 0.22); },

  // ══════════ 僵尸：每种一种叫声 ══════════
  groan(v, type) {
    const vol = 0.10 * v;
    switch (type) {
      case 'fast':    tone(rand(190, 265), 0.32, vol * 1.1, 'sawtooth', rand(120, 180)); break;
      case 'heavy':   tone(rand(48, 68), 0.70, vol * 1.3, 'square', rand(34, 50)); break;
      case 'giant':   tone(rand(34, 48), 1.00, vol * 1.7, 'sawtooth', 24); break;
      case 'crawler': noiseHit(rand(680, 980), 0.20, vol, 3);                        // 犬吠
                      tone(rand(250, 340), 0.16, vol * 0.7, 'square', 150); break;
      case 'spitter': noiseHit(rand(560, 860), 0.42, vol * 1.3, 1.1, 'lowpass'); break;   // 喉囊咕噜
      case 'bomber':  tone(rand(720, 900), 0.06, vol, 'square');
                      tone(rand(720, 900), 0.06, vol, 'square', undefined, 0.11); break;   // 急促的咔哒
      case 'burner':  noiseHit(rand(1400, 2050), 0.30, vol, 1.6);                    // 噼啪
                      tone(rand(300, 430), 0.28, vol * 0.8, 'sawtooth', 190); break;
      case 'leaper':  tone(rand(420, 580), 0.20, vol * 1.2, 'square', rand(950, 1250)); break; // 尖啸
      case 'bloater': tone(rand(58, 78), 0.85, vol * 1.6, 'sawtooth', rand(40, 56));          // 又低又闷
                      noiseHit(rand(160, 300), 0.7, vol * 1.2, 0.7, 'lowpass'); break;
      case 'thrower': noiseHit(rand(1200, 1800), 0.22, vol, 2.4);                             // 骨头摩擦
                      tone(rand(180, 240), 0.24, vol * 0.8, 'square', 110); break;
      case 'screamer':tone(rand(760, 980), 0.55, vol * 1.4, 'sawtooth', rand(1500, 2100)); break; // 上扬的尖叫
      case 'nurse':   tone(rand(330, 420), 0.40, vol, 'sine', rand(240, 300));                // 低吟
                      noiseHit(rand(2200, 3000), 0.3, vol * 0.5, 3, 'highpass'); break;
      case 'boss':    tone(rand(28, 40), 1.4, vol * 2.2, 'sawtooth', 18);
                      noiseHit(90, 1.2, 0.30, 0.6, 'lowpass'); break;
      default:        tone(rand(65, 105), 0.55, vol, 'sawtooth', rand(45, 75));
    }
  },
  giant() { tone(50, 0.9, 0.3, 'sawtooth', 32); noiseHit(120, 0.7, 0.25, 0.7, 'lowpass'); },
  bat()   { tone(1400, 0.05, 0.08, 'square'); tone(1800, 0.05, 0.07, 'square', undefined, 0.06); },
  revive(){ tone(392, 0.15, 0.15, 'sine'); tone(523, 0.15, 0.15, 'sine', undefined, 0.14); tone(659, 0.3, 0.16, 'sine', undefined, 0.28); },
  jump()  { noiseHit(800, 0.08, 0.06, 2); },
  land()  { noiseHit(200, 0.09, 0.1, 1, 'lowpass'); },
  spit()  { noiseHit(1150, 0.17, 0.15, 2.2, 'bandpass'); tone(320, 0.15, 0.08, 'sawtooth', 130); },
  fuse()  { tone(1500, 0.05, 0.10, 'square'); tone(1500, 0.05, 0.10, 'square', undefined, 0.12); },
  boom()  { noiseHit(200, 0.55, 0.42, 0.55, 'lowpass'); tone(58, 0.45, 0.32, 'triangle', 26); },
  // 进度 / 成就
  ach()   { tone(659, 0.10, 0.14, 'sine'); tone(880, 0.10, 0.14, 'sine', undefined, 0.09);
            tone(1175, 0.26, 0.15, 'sine', undefined, 0.18); },
  levelUp(){ tone(523, 0.10, 0.13, 'sine'); tone(784, 0.18, 0.13, 'sine', undefined, 0.09); },
  dodge() { noiseHit(2600, 0.07, 0.10, 2.5); tone(600, 0.06, 0.06, 'sine', 1200); },

  // ══════════ 超级武器空投：8 种各一套 ══════════
  drop()    { noiseHit(300, 0.5, 0.10, 0.5, 'lowpass');                                  // 降落伞划过
              tone(220, 0.5, 0.05, 'sine', 160); },
  crate()   { noiseHit(520, 0.28, 0.22, 0.7); tone(96, 0.14, 0.16, 'triangle', 48);       // 铁箱砸地
              noiseHit(1300, 0.10, 0.10, 1.4, 'bandpass', 0.05); },
  orbital() { noiseHit(3400, 0.9, 0.09, 6, 'highpass');                                   // 轨道激光：持续啸叫
              tone(1400, 0.9, 0.10, 'sine', 2400); },
  gatling() { noiseHit(1150, 0.05, 0.13, 2.6); tone(102, 0.04, 0.07, 'square', 62); },    // 直升机加特林
  rotor()   { noiseHit(150, 0.11, 0.13, 0.5, 'lowpass'); noiseHit(700, 0.06, 0.05, 1.1); },// 旋翼
  drone()   { tone(1250, 0.07, 0.07, 'square', 1900); noiseHit(2800, 0.05, 0.05, 3); },
  thunder() { noiseHit(240, 0.7, 0.34, 0.45, 'lowpass'); tone(70, 0.5, 0.24, 'sawtooth', 32);
              noiseHit(5200, 0.14, 0.14, 4, 'highpass'); },                               // 雷神之锤
  freeze()  { noiseHit(5200, 0.5, 0.13, 5, 'highpass'); tone(2100, 0.45, 0.10, 'sine', 380);
              tone(1580, 0.45, 0.08, 'sine', 280, 0.05); },                               // 冰冻风暴
  vortex()  { noiseHit(180, 0.8, 0.20, 0.6, 'lowpass'); tone(46, 0.8, 0.18, 'sawtooth', 190); }, // 黑洞
  nuke()    { noiseHit(120, 1.1, 0.5, 0.4, 'lowpass'); tone(42, 0.9, 0.4, 'triangle', 18);
              noiseHit(3000, 0.5, 0.2, 2, 'highpass', 0.03); },

  // ── 尖叫者：一记上扬的、带颤音的尖叫，和它加速别人的作用一样刺耳 ──
  shriek()  { tone(620, 0.42, 0.20, 'sawtooth', 2300);
              tone(930, 0.40, 0.13, 'square', 3100, 0.02);
              noiseHit(3600, 0.35, 0.10, 5, 'highpass', 0.05); },
};

// ══════════════════ 自适应 BGM ══════════════════
// 没有音频文件，全部是振荡器 + 噪声合成。
// 四层强度自动切换：平静（低频 drone）→ 交火（drone + 底鼓）→
// 濒死（升高半音 + 心跳）→ 推进（鼓点加密 + 警报脉冲）。
const Music = {
  nodes: null, intensity: -1, nextBeat: 0, beat: 0, hb: 0, on: true,
  init() {
    if (!AC || this.nodes) return;
    const g = AC.createGain(); g.gain.value = 0.0001; g.connect(master);
    const flt = AC.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = 240; flt.Q.value = 5;
    const o1 = AC.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 55;
    const o2 = AC.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = 55.4;   // 轻微失谐，出"合唱"感
    const sub = AC.createOscillator(); sub.type = 'sine'; sub.frequency.value = 27.5;
    o1.connect(flt); o2.connect(flt); sub.connect(flt); flt.connect(g);
    o1.start(); o2.start(); sub.start();
    this.nodes = { g, o1, o2, sub, flt };
  },
  setIntensity(v) {
    // 注意：强度状态要先记下来，不能因为"没有音频环境"就整个跳过 ——
    // 否则无头测试里这套状态机永远看不到变化，改了也测不出来。
    if (v === this.intensity) return;
    this.intensity = v;
    if (!this.nodes) return;
    const t = AC.currentTime;
    // 濒死时整条低音升高半音，听着更焦躁
    const base = v >= 2 ? 58.3 : 55;
    [this.nodes.o1, this.nodes.o2].forEach((o, i) => o.frequency.setTargetAtTime(base + i * 0.4, t, 0.6));
    this.nodes.sub.frequency.setTargetAtTime(base / 2, t, 0.6);
    this.nodes.flt.frequency.setTargetAtTime(v >= 1 ? 320 : 240, t, 0.8);
    const want = v === 0 ? 0.055 : v === 1 ? 0.085 : v === 2 ? 0.10 : 0.095;
    this.nodes.g.gain.setTargetAtTime(this.on ? want : 0.0001, t, 0.7);
  },
  update(dt) {
    if (!AC || !this.nodes) return;
    const t = AC.currentTime;
    // 鼓点：按强度决定间隔
    const gap = this.intensity >= 3 ? 0.30 : this.intensity >= 1 ? 0.52 : 1.05;
    if (t >= this.nextBeat) {
      this.nextBeat = t + gap;
      this.beat++;
      if (this.intensity >= 1) {
        // 底鼓
        tone(56, 0.13, 0.16, 'sine', 30);
        if (this.beat % 4 === 0) noiseHit(1800, 0.05, 0.05, 1.5);        // 每 4 拍一记军鼓
      }
      if (this.intensity >= 3 && this.beat % 2 === 0) {                   // 推进：警报脉冲
        tone(880, 0.16, 0.045, 'square', 620);
      }
    }
    // 濒死：心跳
    if (this.intensity >= 2) {
      this.hb -= dt;
      if (this.hb <= 0) { this.hb = 0.85; tone(44, 0.16, 0.22, 'sine', 28); tone(40, 0.20, 0.16, 'sine', 24, 0.26); }
    }
  },
  stop() { if (this.nodes) this.nodes.g.gain.setTargetAtTime(0.0001, AC.currentTime, 0.4); },
};
function updateMusic(dt) {
  const m = G.map;
  if (!m || G.state !== 'play' || G.cleared) { Music.setIntensity(-1); Music.stop(); return; }
  if (AC) Music.init();
  // 强度判定（和音频环境无关，方便无头测试）
  const near = zombies.filter(z => Math.abs(z.x - player.x) < 760).length;
  let lv = 0;                                    // 平静
  if (near >= 6) lv = 1;                         // 交火
  if (G.dayT > 0.8) lv = Math.max(lv, 3);        // 推进：快推到栅栏了
  if (player.hp < player.maxHp * 0.3) lv = 2;    // 濒死优先级最高
  Music.setIntensity(lv);
  if (AC) Music.update(dt);
}
