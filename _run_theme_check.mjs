import { themeCheckRun } from '@shopify/theme-check-node';
import path from 'node:path';
import url from 'node:url';

const root = path.dirname(url.fileURLToPath(import.meta.url));

const { offenses } = await themeCheckRun(root, undefined, () => {});

const bySeverity = { 0: 'ERROR', 1: 'WARN', 2: 'INFO' };
const focus = process.argv.slice(2); // optional substring filters

const filtered = offenses.filter((o) => {
  if (o.severity !== 0) return false; // errors only
  if (!focus.length) return true;
  return focus.some((f) => (o.uri || '').includes(f));
});

const grouped = {};
for (const o of filtered) {
  const uri = (o.uri || '').replace(/^.*[\\/](sections|templates|snippets|layout|config|blocks)[\\/]/, '$1/');
  (grouped[uri] ||= []).push(o);
}

let n = 0;
for (const [uri, list] of Object.entries(grouped)) {
  console.log(`\n### ${uri} (${list.length} errors)`);
  for (const o of list) {
    const line = o.start?.line != null ? `L${o.start.line + 1}` : '';
    console.log(`  [${o.check}] ${line} ${o.message}`);
    n++;
  }
}
console.log(`\nTOTAL ERRORS (severity=error): ${n} of ${offenses.length} total offenses`);

// Also specifically report any template/section that has errors
const templateSectionErrors = offenses.filter(
  (o) => o.severity === 0 && /[\\/](templates|sections)[\\/]/.test(o.uri || '')
);
console.log(`Template/Section errors: ${templateSectionErrors.length}`);
