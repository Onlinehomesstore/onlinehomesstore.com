const fs = require('fs');
const path = require('path');

function schema(file) {
  const t = fs.readFileSync(file, 'utf8');
  const m = t.match(/\{%\s*schema\s*%\}([\s\S]*?)\{%\s*endschema\s*%\}/);
  return JSON.parse(m[1]);
}

const data = JSON.parse(fs.readFileSync('templates/index.json', 'utf8'));
const issues = [];

for (const [sid, sec] of Object.entries(data.sections)) {
  const sch = schema(path.join('sections', `${sec.type}.liquid`));
  const smap = Object.fromEntries((sch.settings || []).filter((s) => s.id).map((s) => [s.id, s]));
  for (const [k, v] of Object.entries(sec.settings || {})) {
    const s = smap[k];
    if (!s) {
      issues.push(`${sid}.${k} UNKNOWN setting`);
      continue;
    }
    if (s.type === 'range' && typeof v === 'number') {
      if (v < s.min || v > s.max) issues.push(`${sid}.${k} range OOB ${v}`);
      else if (((v - (s.min || 0)) / (s.step || 1)) % 1 !== 0) issues.push(`${sid}.${k} bad step ${v}`);
    }
    if ((s.type === 'select' || s.type === 'radio') && v !== '' && v != null) {
      const opts = (s.options || []).map((o) => String(o.value));
      if (!opts.includes(String(v))) issues.push(`${sid}.${k} bad select ${JSON.stringify(v)}`);
    }
  }
  const bmap = Object.fromEntries((sch.blocks || []).map((b) => [b.type, b]));
  for (const [bid, block] of Object.entries(sec.blocks || {})) {
    const bt = bmap[block.type];
    if (!bt) {
      issues.push(`${sid}.${bid} unknown block type ${block.type}`);
      continue;
    }
    const bsm = Object.fromEntries((bt.settings || []).filter((s) => s.id).map((s) => [s.id, s]));
    for (const [k, v] of Object.entries(block.settings || {})) {
      const s = bsm[k];
      if (!s) {
        issues.push(`${sid}.${bid}.${k} UNKNOWN`);
        continue;
      }
      if (s.type === 'range' && typeof v === 'number') {
        if (v < s.min || v > s.max) issues.push(`${sid}.${bid}.${k} range OOB ${v}`);
        else if (((v - (s.min || 0)) / (s.step || 1)) % 1 !== 0) issues.push(`${sid}.${bid}.${k} bad step ${v}`);
      }
      if ((s.type === 'select' || s.type === 'radio') && v !== '' && v != null) {
        const opts = (s.options || []).map((o) => String(o.value));
        if (!opts.includes(String(v))) issues.push(`${sid}.${bid}.${k} bad select ${JSON.stringify(v)}`);
      }
    }
  }
}
console.log('schema mismatch issues:', issues.length);
issues.forEach((i) => console.log(' -', i));
process.exit(issues.length ? 1 : 0);
