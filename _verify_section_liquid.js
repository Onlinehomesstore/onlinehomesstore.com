/**
 * Verify every product.json section file is present and Liquid-safe for Shopify upload.
 * Run: node _verify_section_liquid.js
 */
const fs = require('fs');
const path = require('path');
const { readShopifyJson } = require('./_shopify_json');

const root = __dirname;
const data = readShopifyJson(path.join(root, 'templates', 'product.json'));
const issues = [];

const floatMath = /(?:times|divided_by|plus|minus|modulo):\s*\d+\.\d+/;
const badNamedArg = /(alt|loading|class|scope|sizes|widths|fetchpriority|data-[a-z-]+):\s*[^,\n{%]+(?:\||\{\{)/;

for (const [sid, sec] of Object.entries(data.sections)) {
  const file = path.join(root, 'sections', `${sec.type}.liquid`);
  if (!fs.existsSync(file)) {
    issues.push(`MISSING sections/${sec.type}.liquid (required by ${sid})`);
    continue;
  }
  const text = fs.readFileSync(file, 'utf8');
  if (!/\{%\s*schema\s*%\}/.test(text)) {
    issues.push(`sections/${sec.type}.liquid has no {% schema %}`);
  }
  const schemaMatch = text.match(/\{%\s*schema\s*%\}([\s\S]*?)\{%\s*endschema\s*%\}/);
  if (schemaMatch) {
    try {
      const schema = JSON.parse(schemaMatch[1]);
      const walkSettings = (items, ctx) => {
        for (const item of items || []) {
          if (item.type === 'text' && item.id && item.default === '') {
            issues.push(`sections/${sec.type}.liquid schema: "${item.id}" has blank default (Shopify rejects this)`);
          }
          if (item.settings) walkSettings(item.settings, ctx);
        }
      };
      walkSettings(schema.settings, sec.type);
      for (const block of schema.blocks || []) {
        walkSettings(block.settings, `${sec.type} block ${block.type}`);
      }
    } catch (e) {
      issues.push(`sections/${sec.type}.liquid schema JSON invalid: ${e.message}`);
    }
  }
  text.split(/\r?\n/).forEach((line, i) => {
    if (floatMath.test(line)) {
      issues.push(`sections/${sec.type}.liquid:${i + 1} float literal in Liquid math`);
    }
    if (badNamedArg.test(line) && /image_tag|render\s/.test(line)) {
      issues.push(`sections/${sec.type}.liquid:${i + 1} filter in named arg`);
    }
  });
}

if (issues.length) {
  console.error('SECTION LIQUID VERIFY FAIL:');
  issues.forEach((i) => console.error('  -', i));
  process.exit(1);
}

console.log('OK all product section files present and Liquid-safe');
for (const sec of Object.values(data.sections)) {
  console.log('  sections/' + sec.type + '.liquid');
}
