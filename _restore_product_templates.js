/**
 * Restore + sanitize product templates from merchant's last working product.json
 * Usage: node _restore_product_templates.js
 */
const fs = require('fs');
const path = require('path');

const root = __dirname;
const srcPath = path.join(root, '_user_product_restore.json');

function extractSchema(file) {
  const t = fs.readFileSync(file, 'utf8');
  const m = t.match(/\{%\s*schema\s*%\}([\s\S]*?)\{%\s*endschema\s*%\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[1]);
  } catch (e) {
    return { __err: e.message };
  }
}

function sanitizeTemplate(data) {
  const report = [];
  const sections = data.sections || {};

  for (const [sid, sec] of Object.entries(sections)) {
    const file = path.join(root, 'sections', `${sec.type}.liquid`);
    if (!fs.existsSync(file)) {
      report.push(`DROP section ${sid} (missing sections/${sec.type}.liquid)`);
      delete sections[sid];
      data.order = (data.order || []).filter((x) => x !== sid);
      continue;
    }

    const schema = extractSchema(file);
    if (!schema || schema.__err) {
      report.push(`WARN bad schema ${sec.type}: ${schema && schema.__err}`);
      continue;
    }

    const settingIds = new Set((schema.settings || []).map((s) => s.id).filter(Boolean));
    const cleaned = {};
    for (const [k, v] of Object.entries(sec.settings || {})) {
      if (settingIds.has(k)) cleaned[k] = v;
      else report.push(`${sec.type}.settings.${k} stripped`);
    }

    for (const def of schema.settings || []) {
      if (def.type === 'range' && cleaned[def.id] != null) {
        let n = Number(cleaned[def.id]);
        if (Number.isFinite(n)) {
          if (def.min != null) n = Math.max(def.min, n);
          if (def.max != null) n = Math.min(def.max, n);
          if (def.step) n = Math.round(n / def.step) * def.step;
          cleaned[def.id] = n;
        }
      }
      if (def.type === 'select' && cleaned[def.id] != null) {
        const opts = (def.options || []).map((o) => o.value);
        if (opts.length && !opts.includes(cleaned[def.id])) {
          report.push(`${sec.type}.settings.${def.id} invalid -> default`);
          cleaned[def.id] = def.default;
        }
      }
    }
    sec.settings = cleaned;

    const blockDefs = Object.fromEntries((schema.blocks || []).map((b) => [b.type, b]));
    if (sec.blocks) {
      for (const [bid, block] of Object.entries(sec.blocks)) {
        const def = blockDefs[block.type];
        if (!def) {
          report.push(`${sec.type} drop block ${bid} type ${block.type}`);
          delete sec.blocks[bid];
          if (sec.block_order) sec.block_order = sec.block_order.filter((x) => x !== bid);
          continue;
        }
        const bids = new Set((def.settings || []).map((s) => s.id).filter(Boolean));
        const bc = {};
        for (const [k, v] of Object.entries(block.settings || {})) {
          if (bids.has(k)) bc[k] = v;
          else report.push(`${sec.type}.${block.type}.${k} stripped`);
        }
        for (const sdef of def.settings || []) {
          if (sdef.type === 'select' && bc[sdef.id] != null) {
            const opts = (sdef.options || []).map((o) => o.value);
            if (opts.length && !opts.includes(bc[sdef.id])) bc[sdef.id] = sdef.default;
          }
          if (sdef.type === 'range' && bc[sdef.id] != null) {
            let n = Number(bc[sdef.id]);
            if (Number.isFinite(n)) {
              if (sdef.min != null) n = Math.max(sdef.min, n);
              if (sdef.max != null) n = Math.min(sdef.max, n);
              bc[sdef.id] = n;
            }
          }
        }
        block.settings = bc;
      }
    }
  }

  // Ensure order only has existing sections
  data.order = (data.order || []).filter((id) => data.sections[id]);
  return report;
}

if (!fs.existsSync(srcPath)) {
  console.error('Missing', srcPath);
  process.exit(1);
}

const raw = fs.readFileSync(srcPath, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').trim();
const data = JSON.parse(raw);
const report = sanitizeTemplate(data);
const out = JSON.stringify(data, null, 2);

const aliases = ['product.json'];

for (const name of aliases) {
  fs.writeFileSync(path.join(root, 'templates', name), out);
  console.log('Wrote templates/' + name);
}

// Do NOT create product.safe.json — Shopify keeps it when product.json is rejected,
// which hides the real Default product template in the editor.
if (fs.existsSync(path.join(root, 'templates', 'product.safe.json'))) {
  fs.unlinkSync(path.join(root, 'templates', 'product.safe.json'));
  console.log('Removed templates/product.safe.json');
}

console.log('\nSanitize report (' + report.length + '):');
report.slice(0, 80).forEach((r) => console.log(' -', r));
if (report.length > 80) console.log(' ...', report.length - 80, 'more');
console.log('\nSections:', Object.keys(data.sections).join(', '));
console.log('Order:', data.order.join(' → '));
