/**
 * Deep-fill missing locale keys from en.default.json (English fallback).
 * Fixes MatchingTranslations theme-check errors without overwriting translations.
 */
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'locales');
const enPath = path.join(dir, 'en.default.json');
const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));

function isPlainObject(v) {
  return v && typeof v === 'object' && !Array.isArray(v);
}

function fillMissing(target, source) {
  let added = 0;
  for (const [k, v] of Object.entries(source)) {
    if (!(k in target)) {
      target[k] = structuredClone(v);
      added++;
      continue;
    }
    if (isPlainObject(v) && isPlainObject(target[k])) {
      added += fillMissing(target[k], v);
    }
  }
  return added;
}

let files = 0;
let total = 0;
for (const name of fs.readdirSync(dir)) {
  if (!name.endsWith('.json') || name === 'en.default.json' || name.endsWith('.schema.json')) continue;
  // Skip schema locale companions
  if (name.includes('schema')) continue;
  const fp = path.join(dir, name);
  let data;
  try {
    data = JSON.parse(fs.readFileSync(fp, 'utf8'));
  } catch (e) {
    console.warn('skip invalid', name, e.message);
    continue;
  }
  const added = fillMissing(data, en);
  if (added) {
    fs.writeFileSync(fp, JSON.stringify(data, null, 2) + '\n');
    console.log(name, '+', added, 'keys');
    files++;
    total += added;
  }
}
console.log('Updated', files, 'locale files,', total, 'keys filled from en.default.json');
