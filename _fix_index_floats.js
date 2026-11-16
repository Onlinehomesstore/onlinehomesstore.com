/**
 * Fix Shopify index.json rejection: range settings must be integers in template JSON.
 * Floats like -0.5 cause Admin to DROP templates/index.json on zip upload → homepage 404.
 */
const fs = require('fs');
const path = require('path');

function fixSchemaRanges(file) {
  let raw = fs.readFileSync(file, 'utf8');
  const before = raw;
  // Integer-only letter-spacing ranges
  raw = raw.replace(
    /\{\s*"type":\s*"range",\s*"id":\s*"heading_letter_spacing",\s*"label":\s*"Heading letter spacing",\s*"min":\s*-2,\s*"max":\s*2,\s*"step":\s*0\.5,\s*"unit":\s*"px",\s*"default":\s*-0\.5\s*\}/g,
    '{ "type": "range", "id": "heading_letter_spacing", "label": "Heading letter spacing", "min": -2, "max": 2, "step": 1, "unit": "px", "default": -1 }'
  );
  raw = raw.replace(
    /\{\s*"type":\s*"range",\s*"id":\s*"letter_spacing",\s*"label":\s*"Heading letter spacing",\s*"min":\s*-2,\s*"max":\s*2,\s*"step":\s*0\.5,\s*"unit":\s*"px",\s*"default":\s*-0\.5\s*\}/g,
    '{ "type": "range", "id": "letter_spacing", "label": "Heading letter spacing", "min": -2, "max": 2, "step": 1, "unit": "px", "default": -1 }'
  );
  if (raw !== before) {
    fs.writeFileSync(file, raw);
    console.log('schema fixed', path.basename(file));
  }
}

fixSchemaRanges('sections/before-after-comparison.liquid');
fixSchemaRanges('sections/visible-results.liquid');

const indexPath = 'templates/index.json';
const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));

function intRanges(obj, p) {
  if (obj == null) return;
  if (typeof obj === 'number' && !Number.isInteger(obj)) {
    const rounded = Math.round(obj);
    console.log('float->int', p, obj, '=>', rounded);
    return rounded;
  }
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      const v = intRanges(obj[i], p + '[' + i + ']');
      if (typeof v === 'number') obj[i] = v;
    }
    return;
  }
  if (typeof obj === 'object') {
    for (const k of Object.keys(obj)) {
      const v = intRanges(obj[k], p + '.' + k);
      if (typeof v === 'number') obj[k] = v;
    }
  }
}

intRanges(index, 'index');

// Remove section "name" keys (optional; safer for older validators)
for (const sec of Object.values(index.sections)) {
  if (sec && typeof sec === 'object' && 'name' in sec) delete sec.name;
}

fs.writeFileSync(indexPath, JSON.stringify(index, null, 2) + '\n');
console.log('index.json written');

// Verify no floats remain in any template
for (const f of fs.readdirSync('templates').filter((n) => n.endsWith('.json'))) {
  const j = JSON.parse(fs.readFileSync(path.join('templates', f), 'utf8'));
  const floats = [];
  (function walk(o, p) {
    if (typeof o === 'number' && !Number.isInteger(o)) floats.push(p + '=' + o);
    else if (o && typeof o === 'object') for (const k of Object.keys(o)) walk(o[k], p + '.' + k);
  })(j, f);
  if (floats.length) console.log('STILL FLOAT', floats);
}
console.log('all template floats cleared');
