import fs from 'fs';

const DEVICES = [
  { suffix: 'xl', label: 'Large Desktop' },
  { suffix: 'd', label: 'Desktop' },
  { suffix: 'l', label: 'Laptop' },
  { suffix: 'tl', label: 'Tablet Landscape' },
  { suffix: 'tp', label: 'Tablet Portrait' },
  { suffix: 'lm', label: 'Large Mobile' },
  { suffix: 'mm', label: 'Medium Mobile' },
  { suffix: 'sm', label: 'Small Mobile' },
];

function range(id, label, opts) {
  return {
    type: 'range',
    id,
    min: opts.min,
    max: opts.max,
    step: opts.step,
    unit: opts.unit || 'px',
    label,
    default: opts.default,
  };
}

function header(content) {
  return { type: 'header', content };
}

function checkbox(id, label, def = true) {
  return { type: 'checkbox', id, label, default: def };
}

function typoGroup(name, prefix, cfg) {
  const out = [header(`${name} — responsive sizes`)];
  for (const d of DEVICES) {
    out.push(range(`${prefix}_${d.suffix}`, `${d.label} ${name} (px)`, {
      min: cfg.min,
      max: cfg.max,
      step: cfg.step,
      default: cfg.defaults[d.suffix],
    }));
  }
  return out;
}

function spaceGroup(name, prefix, cfg) {
  const out = [header(`${name} — responsive`)];
  for (const d of DEVICES) {
    out.push(range(`${prefix}_${d.suffix}`, `${d.label} ${name}`, {
      min: cfg.min,
      max: cfg.max,
      step: cfg.step,
      unit: cfg.unit || 'px',
      default: cfg.defaults[d.suffix],
    }));
  }
  return out;
}

const sectionSettings = [
  ...typoGroup('Heading size', 'heading_size', {
    min: 24,
    max: 96,
    step: 2,
    defaults: { xl: 72, d: 64, l: 56, tl: 48, tp: 40, lm: 34, mm: 30, sm: 28 },
  }),
  ...typoGroup('Badge / subheading size', 'badge_size', {
    min: 10,
    max: 18,
    step: 1,
    defaults: { xl: 14, d: 13, l: 12, tl: 12, tp: 11, lm: 11, mm: 10, sm: 10 },
  }),
  ...typoGroup('Description size', 'desc_size', {
    min: 13,
    max: 24,
    step: 1,
    defaults: { xl: 19, d: 18, l: 17, tl: 16, tp: 15, lm: 15, mm: 14, sm: 14 },
  }),
  ...typoGroup('Button font size', 'btn_font_size', {
    min: 12,
    max: 20,
    step: 1,
    defaults: { xl: 16, d: 15, l: 15, tl: 14, lm: 14, mm: 13, sm: 13 },
  }),
  ...typoGroup('Trust line size', 'trust_size', {
    min: 11,
    max: 18,
    step: 1,
    defaults: { xl: 14, d: 13, l: 13, tl: 12, lm: 12, mm: 11, sm: 11 },
  }),
  ...typoGroup('Card title size', 'card_title_size', {
    min: 11,
    max: 18,
    step: 1,
    defaults: { xl: 15, d: 14, l: 14, tl: 13, tp: 13, lm: 12, mm: 12, sm: 11 },
  }),
  ...typoGroup('Card stat size', 'card_stat_size', {
    min: 16,
    max: 36,
    step: 2,
    defaults: { xl: 30, d: 28, l: 26, tl: 24, tp: 22, lm: 20, mm: 18, sm: 18 },
  }),
  ...typoGroup('Card body size', 'card_text_size', {
    min: 11,
    max: 16,
    step: 1,
    defaults: { xl: 14, d: 13, l: 13, tl: 12, lm: 12, mm: 11, sm: 11 },
  }),
  ...spaceGroup('Hero height (vh)', 'hero_height', {
    min: 70,
    max: 100,
    step: 1,
    unit: 'vh',
    defaults: { xl: 100, d: 100, l: 100, tl: 95, tp: 92, lm: 88, mm: 86, sm: 84 },
  }),
  ...spaceGroup('Top padding (px)', 'pad_top', {
    min: 0,
    max: 120,
    step: 4,
    defaults: { xl: 56, d: 48, l: 44, tl: 40, tp: 36, lm: 32, mm: 28, sm: 24 },
  }),
  ...spaceGroup('Bottom padding (px)', 'pad_bottom', {
    min: 0,
    max: 200,
    step: 4,
    defaults: { xl: 200, d: 180, l: 160, tl: 120, tp: 80, lm: 64, mm: 56, sm: 48 },
  }),
  ...spaceGroup('Left padding (px)', 'pad_left', {
    min: 0,
    max: 80,
    step: 4,
    defaults: { xl: 48, d: 40, l: 36, tl: 32, tp: 28, lm: 24, mm: 20, sm: 16 },
  }),
  ...spaceGroup('Right padding (px)', 'pad_right', {
    min: 0,
    max: 80,
    step: 4,
    defaults: { xl: 48, d: 40, l: 36, tl: 32, tp: 28, lm: 24, mm: 20, sm: 16 },
  }),
  ...spaceGroup('Content max width (px)', 'content_width', {
    min: 400,
    max: 960,
    step: 20,
    defaults: { xl: 760, d: 720, l: 680, tl: 620, tp: 560, lm: 100, mm: 100, sm: 100 },
  }),
  ...spaceGroup('Container max width (px)', 'container_width', {
    min: 1200,
    max: 1920,
    step: 20,
    defaults: { xl: 1920, d: 1680, l: 1440, tl: 100, tl: 100, tp: 100, lm: 100, mm: 100, sm: 100 },
  }),
  ...spaceGroup('Content gap (px)', 'content_gap', {
    min: 8,
    max: 40,
    step: 2,
    defaults: { xl: 24, d: 22, l: 20, tl: 18, tp: 16, lm: 14, mm: 12, sm: 12 },
  }),
  header('Product showcase — responsive'),
  ...DEVICES.flatMap((d) => [
    range(`product_x_${d.suffix}`, `${d.label} product horizontal (%)`, { min: 0, max: 100, step: 1, unit: '%', default: d.suffix === 'd' || d.suffix === 'xl' ? 50 : 50 }),
    range(`product_y_${d.suffix}`, `${d.label} product vertical (%)`, {
      min: 0,
      max: 100,
      step: 1,
      unit: '%',
      default: { xl: 54, d: 54, l: 56, tl: 58, tp: 62, lm: 68, mm: 70, sm: 72 }[d.suffix],
    }),
    range(`product_scale_${d.suffix}`, `${d.label} product scale (%)`, {
      min: 40,
      max: 140,
      step: 5,
      unit: '%',
      default: { xl: 110, d: 105, l: 95, tl: 85, tp: 72, lm: 62, mm: 56, sm: 50 }[d.suffix],
    }),
    range(`product_rotate_${d.suffix}`, `${d.label} product rotation (deg)`, {
      min: -15,
      max: 15,
      step: 1,
      unit: 'deg',
      default: 0,
    }),
  ]),
];

const floatCardBlockExtras = [
  header('Visibility by device'),
  ...DEVICES.map((d) => checkbox(`show_${d.suffix}`, `Show on ${d.label}`, !['mm', 'sm'].includes(d.suffix))),
  header('Position by device'),
  ...DEVICES.flatMap((d) => [
    range(`pos_x_${d.suffix}`, `${d.label} horizontal (%)`, { min: 0, max: 100, step: 1, unit: '%', default: 8 }),
    range(`pos_y_${d.suffix}`, `${d.label} vertical (%)`, { min: 0, max: 100, step: 1, unit: '%', default: 68 }),
    range(`width_${d.suffix}`, `${d.label} card width (px)`, { min: 160, max: 360, step: 10, unit: 'px', default: 260 }),
  ]),
];

const annoBlockExtras = [
  header('Visibility by device'),
  ...DEVICES.map((d) => checkbox(`show_${d.suffix}`, `Show on ${d.label}`, d.suffix !== 'sm')),
  header('Position by device'),
  ...DEVICES.flatMap((d) => [
    range(`pos_x_${d.suffix}`, `${d.label} horizontal (%)`, { min: 0, max: 100, step: 1, unit: '%', default: 72 }),
    range(`pos_y_${d.suffix}`, `${d.label} vertical (%)`, { min: 0, max: 100, step: 1, unit: '%', default: 38 }),
  ]),
];

fs.writeFileSync(new URL('../snippets/_ph-section-settings.json', import.meta.url), JSON.stringify(sectionSettings, null, 2));
fs.writeFileSync(new URL('../snippets/_ph-float-settings.json', import.meta.url), JSON.stringify(floatCardBlockExtras, null, 2));
fs.writeFileSync(new URL('../snippets/_ph-anno-settings.json', import.meta.url), JSON.stringify(annoBlockExtras, null, 2));
console.log('Generated', sectionSettings.length, 'section settings');
