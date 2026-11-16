import fs from 'fs';

const DEVICES = [
  { suffix: 'xl', mq: '(min-width: 1920px)' },
  { suffix: 'd', mq: null },
  { suffix: 'l', mq: '(max-width: 1439px)' },
  { suffix: 'tl', mq: '(max-width: 1199px)' },
  { suffix: 'tp', mq: '(max-width: 989px)' },
  { suffix: 'lm', mq: '(max-width: 749px)' },
  { suffix: 'mm', mq: '(max-width: 575px)' },
  { suffix: 'sm', mq: '(max-width: 479px)' },
];

const VARS = [
  { key: 'heading-size', setting: 'heading_size', fallback: 'heading_size_desktop', unit: 'px', def: 64 },
  { key: 'badge-size', setting: 'badge_size', unit: 'px', def: 13 },
  { key: 'desc-size', setting: 'desc_size', unit: 'px', def: 18 },
  { key: 'btn-font-size', setting: 'btn_font_size', unit: 'px', def: 15 },
  { key: 'trust-size', setting: 'trust_size', unit: 'px', def: 13 },
  { key: 'card-title-size', setting: 'card_title_size', unit: 'px', def: 14 },
  { key: 'card-stat-size', setting: 'card_stat_size', unit: 'px', def: 28 },
  { key: 'card-text-size', setting: 'card_text_size', unit: 'px', def: 13 },
  { key: 'min-h', setting: 'hero_height', unit: 'svh', def: 100 },
  { key: 'pad-t', setting: 'pad_top', unit: 'px', def: 48 },
  { key: 'pad-b', setting: 'pad_bottom', unit: 'px', def: 180 },
  { key: 'pad-l', setting: 'pad_left', unit: 'px', def: 40 },
  { key: 'pad-r', setting: 'pad_right', unit: 'px', def: 40 },
  { key: 'content-w', setting: 'content_width', unit: 'px', def: 720 },
  { key: 'max-w', setting: 'container_width', unit: 'px', def: 1680 },
  { key: 'content-gap', setting: 'content_gap', unit: 'px', def: 22 },
  { key: 'product-x', setting: 'product_x', unit: '%', def: 50 },
  { key: 'product-y', setting: 'product_y', unit: '%', def: 54 },
  { key: 'product-scale', setting: 'product_scale', scale: true, def: 105 },
  { key: 'product-rotate', setting: 'product_rotate', unit: 'deg', def: 0 },
];

function liquidVal(v, d) {
  const fb = v.fallback ? ` | default: st.${v.fallback}` : '';
  const base = `st.${v.setting}_${d.suffix} | default: ${v.def}${fb ? '' : ''}`;
  if (v.scale) {
    return `{{ ${base.includes('st.') ? base : `st.${v.setting}_${d.suffix} | default: ${v.def}`} | divided_by: 100.0 }}`;
  }
  return `{{ st.${v.setting}_${d.suffix} | default: ${v.def}${v.fallback && d.suffix === 'd' ? ` | default: st.${v.fallback}` : ''} }}${v.unit === 'px' || v.unit === 'svh' || v.unit === '%' || v.unit === 'deg' ? v.unit : ''}`;
}

function block(d) {
  const lines = VARS.map((v) => {
    let val;
    if (v.scale) {
      val = `{{ st.${v.setting}_${d.suffix} | default: st.product_scale | default: ${v.def} | divided_by: 100.0 }}`;
      return `    --uc-ph-${v.key}: ${val};`;
    }
    const fb = v.fallback && d.suffix === 'd' ? ` | default: st.${v.fallback}` : '';
    val = `{{ st.${v.setting}_${d.suffix} | default: ${v.def}${fb} }}${v.unit}`;
    return `    --uc-ph-${v.key}: ${val};`;
  });
  return lines.join('\n');
}

let out = `{%- comment -%} Auto-generated responsive CSS vars for UC Premium Hero {%- endcomment -%}\n{%- assign st = section.settings -%}\n{%- style -%}\n`;

out += `#UcPh-{{ section.id }} {\n${block(DEVICES.find((d) => d.suffix === 'd'))}\n}\n\n`;

for (const d of DEVICES) {
  if (!d.mq) continue;
  out += `@media ${d.mq} {\n  #UcPh-{{ section.id }} {\n${block(d)}\n  }\n}\n\n`;
}

out += `{%- endstyle -%}\n`;

fs.writeFileSync(new URL('../snippets/uc-ph-responsive-css.liquid', import.meta.url), out);
console.log('Wrote uc-ph-responsive-css.liquid');
