/**
 * Scan for Shopify Liquid filter-in-named-arg anti-patterns.
 * Run: node _scan_liquid_args.js
 */
const fs = require('fs');
const path = require('path');

const bad = [];
for (const d of ['sections', 'snippets', 'layout']) {
  const dir = path.join(__dirname, d);
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.liquid'))) {
    const fp = path.join(dir, f);
    const t = fs.readFileSync(fp, 'utf8');
    const lines = t.split(/\r?\n/);
    lines.forEach((line, i) => {
      // skip comments / assigns
      if (/^\s*\{%-?\s*(comment|assign|liquid)/.test(line)) return;
      if (/^\s*\{%\s*comment/.test(line)) return;
      // named arg with filter pipe (common offenders)
      const m = line.match(
        /(alt|loading|class|scope|sizes|widths|fetchpriority):\s*[^,{%\n]+\|/
      );
      if (!m) return;
      // only flag if looks like image_tag / render / stylesheet_tag context
      const ctx = lines.slice(Math.max(0, i - 8), i + 1).join(' ');
      if (/image_tag|render\s|stylesheet_tag|script_tag/.test(ctx)) {
        bad.push(`${d}/${f}:${i + 1}  ${line.trim().slice(0, 140)}`);
      }
    });
  }
}

if (bad.length) {
  console.log('FOUND', bad.length, 'possible issues:\n');
  bad.forEach((b) => console.log(b));
  process.exitCode = 1;
} else {
  console.log('OK: no filter-in-named-arg patterns found');
}
