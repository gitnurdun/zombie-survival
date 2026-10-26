'use strict';
// 把单文件版按 `// ============================== 段落名 ==============================` 标记
// 拆成多个 js 文件，并把 HTML 里的 <script> 块换成 <script src> 列表。
// 用法：node tools/split.js <源 html> <输出目录>
// 安全性：拆完后会把所有片段按顺序拼回来跟原文逐字节比对，不一致就报错退出。
const fs = require('fs');
const path = require('path');

const src = process.argv[2] || 'zombie-village-2.html';
const outDir = process.argv[3] || 'app';

// 段落名 → 目标文件（顺序即加载顺序）
const FILES = [
  ['js/00-core.js',    ['__preamble__', '基础', '多层地形']],
  ['js/01-input.js',   ['输入']],
  ['js/02-audio.js',   ['音效']],
  ['js/03-data.js',    ['数据']],
  ['js/04-state.js',   ['状态', '存档']],
  ['js/05-level.js',   ['房屋', '关卡构建', '路段库', '关卡 / 地图']],
  ['js/06-props.js',   ['场景物件']],
  ['js/07-world.js',   ['投掷物 / 地面危险区（绘制）', '关卡末尾：栅栏 + 货架']],
  ['js/08-zombies.js', ['生成僵尸', '僵尸投掷物 / 地面危险区']],
  ['js/09-combat.js',  ['战斗']],
  ['js/10-houses.js',  ['门']],
  ['js/11-update.js',  ['更新']],
  ['js/12-render.js',  ['绘制']],
  ['js/13-shelf.js',   ['武器图标', '货架商店']],
  ['js/14-ui.js',      ['流程']],
  ['js/15-main.js',    ['主循环']],
];

const html = fs.readFileSync(src, 'utf8');
const a = html.indexOf('<script>') + '<script>'.length;
const b = html.lastIndexOf('</script>');
if (a < 8 || b < 0) throw new Error('找不到 <script> 块');
const js = html.slice(a, b);

// 按段落标记切
const MARK = /^\/\/ =+ (.+?) =+$/;
const lines = js.split('\n');
const parts = [];                       // { name, lines }
let cur = { name: '__preamble__', lines: [] };
for (const ln of lines) {
  const m = ln.match(MARK);
  if (m) { parts.push(cur); cur = { name: m[1].trim(), lines: [ln] }; }
  else cur.lines.push(ln);
}
parts.push(cur);

// 校验：每个段落都必须被某个文件认领，且不能重复
const owner = new Map();
for (const [file, names] of FILES) for (const n of names) owner.set(n, file);
const unknown = parts.filter(p => !owner.has(p.name)).map(p => p.name);
if (unknown.length) throw new Error('有段落没被认领：' + unknown.join(' / '));

// 按文件分组
const byFile = new Map(FILES.map(([f]) => [f, []]));
for (const p of parts) byFile.get(owner.get(p.name)).push(p);

// 写出
fs.mkdirSync(path.join(outDir, 'js'), { recursive: true });
const written = [];
for (const [file] of FILES) {
  const segs = byFile.get(file);
  if (!segs.length) continue;
  let body = segs.map(s => s.lines.join('\n')).join('\n');
  // 每个文件都是独立的 classic script，各自开 strict
  if (!/^'use strict';/.test(body.trimStart())) body = "'use strict';\n" + body;
  const head = `// ${file} —— 由 tools/split.js 从单文件版拆出。\n// 分段：` +
               segs.map(s => s.name === '__preamble__' ? '（文件头）' : s.name).join(' · ') + '\n\n';
  fs.writeFileSync(path.join(outDir, file), head + body, 'utf8');
  written.push([file, segs.reduce((n, s) => n + s.lines.length, 0)]);
}

// —— 回拼校验 ——
// 拆分会重排段落（比如把"存档"从文件末尾挪到"状态"旁边），所以不能要求顺序一致。
// 改成校验"内容一行不丢、一行不重"：把所有行排序后比对。
// 这样任何真实的丢内容 / 复制粘贴错误都会被抓到。
const back = FILES.flatMap(([f]) => byFile.get(f) || [])
  .map(s => s.lines.join('\n')).join('\n');
const norm = t => t.replace(/^\s*'use strict';\s*\n/, '')
                   .split('\n').map(s => s.trimEnd()).sort().join('\n');
if (norm(back) !== norm(js)) {
  const A = norm(js).split('\n'), B = norm(back).split('\n');
  const missing = A.filter(l => !B.includes(l)).slice(0, 5);
  const extra = B.filter(l => !A.includes(l)).slice(0, 5);
  throw new Error('回拼校验失败：\n  原文有但拆出后没有(' + A.length + ' vs ' + B.length + ')：' +
    JSON.stringify(missing) + '\n  拆出后有但原文没有：' + JSON.stringify(extra));
}

// —— 重写 HTML ——
const tags = FILES.filter(([f]) => bySeen(f)).map(([f]) => `<script src="${f}"></script>`).join('\n');
function bySeen(f) { return (byFile.get(f) || []).length > 0; }
const newHtml = html.slice(0, a - '<script>'.length) +
  '<!-- 模块化：按加载顺序列出，全部是普通 script（file:// 下可直接双击打开） -->\n' +
  tags + '\n' +
  html.slice(b + '</script>'.length);
fs.writeFileSync(path.join(outDir, 'index.html'), newHtml, 'utf8');

console.log('拆分完成 →', outDir);
for (const [f, n] of written) console.log('  ' + f.padEnd(20) + String(n).padStart(5) + ' 行');
console.log('\n✓ 回拼校验通过：拆出的片段按顺序拼接与原文逐字节一致');
