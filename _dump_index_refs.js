const fs = require('fs');
const j = JSON.parse(fs.readFileSync('templates/index.json', 'utf8'));
const s = JSON.stringify(j);
console.log('index bytes', Buffer.byteLength(s));
const refs = [];
function walk(obj, path) {
  if (obj == null) return;
  if (typeof obj === 'string') {
    if (/shopify:\/\//.test(obj) || /gid:\/\//.test(obj)) refs.push(path + ' = ' + obj);
    return;
  }
  if (Array.isArray(obj)) return obj.forEach((v, i) => walk(v, path + '[' + i + ']'));
  if (typeof obj === 'object') Object.keys(obj).forEach((k) => walk(obj[k], path + '.' + k));
}
walk(j, 'index');
console.log('shopify/gid refs', refs.length);
refs.forEach((r) => console.log(' ', r));

for (const [id, sec] of Object.entries(j.sections)) {
  const st = sec.settings || {};
  for (const k of ['collection', 'product', 'blog', 'menu', 'page']) {
    if (st[k] != null && st[k] !== '') console.log(id, k, '=', st[k]);
  }
  for (const [bid, b] of Object.entries(sec.blocks || {})) {
    const bs = b.settings || {};
    for (const k of ['collection', 'product', 'blog', 'link', 'button_link', 'url', 'video_url']) {
      if (bs[k] != null && bs[k] !== '') console.log(id + '.' + bid, k, '=', String(bs[k]).slice(0, 120));
    }
  }
}
