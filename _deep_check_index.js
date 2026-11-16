const fs = require('fs');

function schema(file) {
  const t = fs.readFileSync(file, 'utf8');
  const m = t.match(/\{%\s*schema\s*%\}([\s\S]*?)\{%\s*endschema\s*%\}/);
  return JSON.parse(m[1]);
}

const raw = fs.readFileSync('templates/index.json');
const bom = raw[0] === 0xef && raw[1] === 0xbb && raw[2] === 0xbf;
const text = raw.toString('utf8');
const idx = JSON.parse(text);
const issues = [];

if (bom) issues.push('BOM present on index.json');
if (text.includes('\u0000')) issues.push('NUL byte in index.json');
if (/[\u2014\u2013]/.test(text)) issues.push('em/en dash in index.json');
if (/shopify:\/\/shop_images\//.test(text)) issues.push('shopify://shop_images lock in index.json');

for (const [sid, sec] of Object.entries(idx.sections)) {
  const f = `sections/${sec.type}.liquid`;
  if (!fs.existsSync(f)) {
    issues.push(`MISSING ${f}`);
    continue;
  }
  const sch = schema(f);
  if (sch.disabled_on?.templates?.includes('index')) issues.push(`${sid} disabled on index`);
  if (sch.enabled_on?.templates && !sch.enabled_on.templates.includes('index')) {
    issues.push(`${sid} not enabled on index`);
  }

  const smap = Object.fromEntries((sch.settings || []).filter((s) => s.id).map((s) => [s.id, s]));
  for (const [k, v] of Object.entries(sec.settings || {})) {
    const def = smap[k];
    if (!def) {
      issues.push(`UNKNOWN ${sid}.${k}`);
      continue;
    }
    validate(def, v, `${sid}.${k}`, issues);
  }

  const bmap = Object.fromEntries((sch.blocks || []).map((b) => [b.type, b]));
  for (const [bid, blk] of Object.entries(sec.blocks || {})) {
    const bdef = bmap[blk.type];
    if (!bdef) {
      issues.push(`UNKNOWN BLOCK ${sid}.${bid} ${blk.type}`);
      continue;
    }
    const bsmap = Object.fromEntries((bdef.settings || []).filter((s) => s.id).map((s) => [s.id, s]));
    for (const [k, v] of Object.entries(blk.settings || {})) {
      const def = bsmap[k];
      if (!def) {
        issues.push(`UNKNOWN ${sid}.${bid}.${k}`);
        continue;
      }
      validate(def, v, `${sid}.${bid}.${k}`, issues);
    }
  }

  if (sec.block_order) {
    for (const bid of sec.block_order) {
      if (!sec.blocks?.[bid]) issues.push(`orphan block_order ${sid}.${bid}`);
    }
  }
}

function validate(def, v, path, issues) {
  if (def.type === 'select' || def.type === 'radio') {
    const opts = (def.options || []).map((o) => String(o.value));
    if (v !== '' && v != null && !opts.includes(String(v))) {
      issues.push(`SELECT ${path}=${JSON.stringify(v)}`);
    }
  }
  if (def.type === 'range' && typeof v === 'number') {
    if (v < def.min || v > def.max) issues.push(`RANGE ${path}=${v}`);
    const step = def.step || 1;
    if (((v - (def.min || 0)) / step) % 1 !== 0) issues.push(`STEP ${path}=${v}`);
  }
  if (def.type === 'inline_richtext' && typeof v === 'string') {
    if (/<\/?(?:p|div|ul|ol|li|h[1-6]|br)\b/i.test(v)) {
      issues.push(`INLINE_BLOCK_TAG ${path}`);
    }
  }
  if (def.type === 'text' && typeof v === 'string' && /<[a-z]/i.test(v)) {
    issues.push(`HTML_IN_TEXT ${path}=${v.slice(0, 80)}`);
  }
  if (def.type === 'richtext' && typeof v === 'string') {
    if (/<br\s*\/?>/i.test(v) && !/<p[\s>]/i.test(v)) {
      issues.push(`RICHTEXT_BR ${path}`);
    }
  }
  if (def.type === 'collection' && typeof v === 'string' && v.startsWith('gid://')) {
    issues.push(`COLLECTION_GID ${path} (may fail cross-store upload)`);
  }
  if (def.type === 'product' && typeof v === 'string' && (v.includes('gid://') || v.includes('shopify://'))) {
    issues.push(`PRODUCT_REF ${path}=${v}`);
  }
}

console.log('issues', issues.length);
issues.forEach((i) => console.log(' -', i));
process.exit(issues.length ? 1 : 0);
