/**
 * Detect unbalanced Liquid block tags (a classic cause of section compile
 * failure → Shopify strips templates that use the section).
 * Ignores the {% schema %}..{% endschema %} JSON body.
 */
const fs = require('fs');

const PAIRS = {
  if: 'endif',
  unless: 'endunless',
  for: 'endfor',
  case: 'endcase',
  capture: 'endcapture',
  comment: 'endcomment',
  form: 'endform',
  paginate: 'endpaginate',
  tablerow: 'endtablerow',
  style: 'endstyle',
  stylesheet: 'endstylesheet',
  javascript: 'endjavascript',
  raw: 'endraw',
  schema: 'endschema',
  liquid: null, // inline
};
const OPENERS = new Set(Object.keys(PAIRS).filter((k) => PAIRS[k]));
const CLOSERS = new Set(Object.values(PAIRS).filter(Boolean));
const NEUTRAL = new Set(['else', 'elsif', 'when', 'break', 'continue', 'render', 'include', 'assign', 'echo', 'increment', 'decrement', 'section', 'sections', 'layout', 'cycle', 'liquid', 'paginate']);

function checkFile(file) {
  let src = fs.readFileSync(file, 'utf8');
  // strip schema JSON body (still count the schema/endschema tags separately, but easier: remove content between)
  const issues = [];
  const stack = [];
  const tagRe = /\{%-?\s*(\w+)/g;
  let m;
  let inLiquidBlock = false;
  while ((m = tagRe.exec(src))) {
    const tag = m[1];
    if (tag === 'schema') {
      // skip to endschema
      const end = src.indexOf('endschema', m.index);
      if (end === -1) {
        issues.push('unclosed schema');
        break;
      }
      tagRe.lastIndex = end;
      continue;
    }
    if (tag === 'comment') {
      const end = src.indexOf('endcomment', m.index);
      if (end === -1) {
        issues.push('unclosed comment');
        break;
      }
      tagRe.lastIndex = end;
      continue;
    }
    if (tag === 'raw') {
      const end = src.indexOf('endraw', m.index);
      if (end === -1) {
        issues.push('unclosed raw');
        break;
      }
      tagRe.lastIndex = end;
      continue;
    }
    if (OPENERS.has(tag)) stack.push({ tag, idx: m.index });
    else if (CLOSERS.has(tag)) {
      const wantOpen = Object.keys(PAIRS).find((k) => PAIRS[k] === tag);
      const top = stack.pop();
      if (!top) issues.push(`extra ${tag} (no opener) near char ${m.index}`);
      else if (top.tag !== wantOpen) issues.push(`mismatched: ${tag} closes ${top.tag} (opened char ${top.idx}) near char ${m.index}`);
    }
  }
  for (const s of stack) {
    const line = src.slice(0, s.idx).split('\n').length;
    issues.push(`unclosed ${s.tag} opened at line ${line}`);
  }
  return issues;
}

const files = process.argv.slice(2);
let total = 0;
for (const f of files) {
  const issues = checkFile(f);
  console.log(`\n### ${f}: ${issues.length}`);
  issues.forEach((i) => console.log('   [X] ' + i));
  total += issues.length;
}
console.log('\nTOTAL:', total);
