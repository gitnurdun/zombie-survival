'use strict';
// 一次性工具：把 17 把武器的 sfx 字段各自指向独立的音色。
// 用法：node tools/patch-sfx.js
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'app', 'js', '03-data.js');
const MAP = {
  bat: 'swingL', axe: 'swingH', saw: 'chainsaw', shovel: 'shovelS',
  dart: 'dartS', machete: 'swingM', sword: 'swingS',
  pistol: 'pistol', uzi: 'uzi', pump: 'pump', magnum: 'magnum',
  minigun: 'minigun', rpg: 'rpg',
  tesla: 'tesla', cryo: 'cryo', plasma: 'plasma', flamer: 'flamer',
};

let src = fs.readFileSync(FILE, 'utf8');
let n = 0, miss = [];

for (const id of Object.keys(MAP)) {
  const want = MAP[id];
  // 每个武器块从 `  id: {` 开始，以 `] },` 结束（lv:[ ... ] },）
  const startRe = new RegExp('\\n  ' + id + ':\\s*\\{');
  const m = startRe.exec(src);
  if (!m) { miss.push(id); continue; }
  const start = m.index;
  const end = src.indexOf('] },', start);
  if (end < 0) { miss.push(id + '(找不到块尾)'); continue; }
  let body = src.slice(start, end + 4);
  if (/sfx:'/.test(body)) {
    body = body.replace(/sfx:'[^']*'/, "sfx:'" + want + "'");
  } else {
    // 插在 lv:[ 之前，和别的字段排在一起
    body = body.replace(/\n(\s*)lv:\[/, "\n$1sfx:'" + want + "',\n$1lv:[");
  }
  src = src.slice(0, start) + body + src.slice(end + 4);
  n++;
}
fs.writeFileSync(FILE, src);
console.log('更新了', n, '把武器');
if (miss.length) console.log('没找到：', miss.join(', '));
