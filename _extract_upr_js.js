/**
 * Extract inline product-reviews JS to assets/uc-product-reviews.js
 */
const fs = require('fs');
const path = require('path');

const fp = path.join(__dirname, 'sections', 'uc-product-reviews.liquid');
let t = fs.readFileSync(fp, 'utf8');
const start = t.indexOf('<script>');
const end = t.indexOf('</script>', start);
if (start < 0 || end < 0) {
  console.error('Inline script not found — abort');
  process.exit(1);
}

let body = t.slice(start + 8, end).trim();
// Strip outer IIFE wrapper if present
body = body.replace(/^\(function\s*\(\)\s*\{/, '').replace(/\}\)\s*\(\)\s*;?\s*$/, '');

body = body
  .replace(/document\.getElementById\('Upr-\{\{\s*uid\s*\}\}'\)/g, "document.getElementById(cfg.rootId)")
  .replace(/var productId = '\{\{\s*product\.id\s*\}\}';/g, 'var productId = cfg.productId;')
  .replace(/getElementById\('UprLightbox-\{\{\s*uid\s*\}\}'\)/g, 'getElementById(cfg.lightboxId)')
  .replace(/lb\.id = 'UprLightbox-\{\{\s*uid\s*\}\}';/g, 'lb.id = cfg.lightboxId;')
  .replace(
    /\{%-?\s*if form\.posted_successfully\?\s*-?%\}[\s\S]*?\{%-?\s*endif\s*-?%\}/g,
    "if (cfg.posted) {\n      if (formWrap) { formWrap.classList.remove('is-hidden'); formWrap.scrollIntoView({ behavior: 'smooth', block: 'center' }); }\n    }"
  );

const out = `/* Product reviews section — extracted for valid Liquid HTML */
(function () {
  function boot(cfg) {
    if (!cfg || !cfg.rootId) return;
${body}
  }

  function run() {
    document.querySelectorAll('script[data-upr-boot]').forEach(function (el) {
      boot({
        rootId: el.getAttribute('data-upr-root'),
        productId: el.getAttribute('data-upr-product-id'),
        lightboxId: el.getAttribute('data-upr-lightbox-id'),
        posted: el.getAttribute('data-upr-posted') === '1'
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
`;

fs.writeFileSync(path.join(__dirname, 'assets', 'uc-product-reviews.js'), out);

const replacement = `<script
  src="{{ 'uc-product-reviews.js' | asset_url }}"
  defer="defer"
  data-upr-boot
  data-upr-root="Upr-{{ uid }}"
  data-upr-product-id="{{ product.id }}"
  data-upr-lightbox-id="UprLightbox-{{ uid }}"
  data-upr-posted="{% if form.posted_successfully? %}1{% else %}0{% endif %}"
></script>`;

t = t.slice(0, start) + replacement + t.slice(end + 9);
fs.writeFileSync(fp, t);

const m = t.match(/\{%\s*schema\s*%\}([\s\S]*?)\{%\s*endschema\s*%\}/);
JSON.parse(m[1]);
console.log('OK: extracted reviews JS + liquid schema valid');
