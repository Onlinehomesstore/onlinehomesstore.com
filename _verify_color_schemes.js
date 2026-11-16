/**
 * Verify color schemes exist in settings_schema + settings_data (Shopify preview requirement).
 * Run: node _verify_color_schemes.js
 */
const fs = require('fs');
const path = require('path');

const root = __dirname;
const schemaPath = path.join(root, 'config', 'settings_schema.json');
const dataPath = path.join(root, 'config', 'settings_data.json');
const issues = [];

const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

const colorsSection = schema.find((s) =>
  (s.settings || []).some((x) => x.type === 'color_scheme_group' && x.id === 'color_schemes')
);
if (!colorsSection) {
  issues.push('settings_schema.json missing color_scheme_group id="color_schemes"');
}

const current = data.current;
if (!current || typeof current !== 'object') {
  issues.push('settings_data.json missing "current" object');
} else if (!current.color_schemes || !Object.keys(current.color_schemes).length) {
  issues.push('settings_data.json current.color_schemes is missing or empty');
} else {
  for (const [id, scheme] of Object.entries(current.color_schemes)) {
    if (!scheme.settings || !scheme.settings.background || !scheme.settings.text) {
      issues.push(`settings_data.json color_schemes.${id} missing required settings`);
    }
  }
  if (!current.color_schemes['scheme-1']) {
    issues.push('settings_data.json must define scheme-1');
  }
}

if (issues.length) {
  console.error('COLOR SCHEME VERIFY FAIL:');
  issues.forEach((i) => console.error('  -', i));
  process.exit(1);
}

console.log('OK color schemes configured');
console.log('  schema: color_scheme_group present');
console.log('  data schemes:', Object.keys(current.color_schemes).join(', '));
