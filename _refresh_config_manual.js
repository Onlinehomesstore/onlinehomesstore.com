/**
 * Refresh CONFIG_MANUAL_UPLOAD for Shopify color scheme / preview fix.
 * Run: node _refresh_config_manual.js
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const theme = __dirname;
const out = path.join(theme, 'CONFIG_MANUAL_UPLOAD');

execFileSync(process.execPath, [path.join(theme, '_verify_color_schemes.js')], {
  stdio: 'inherit',
  cwd: theme,
});

if (fs.existsSync(out)) fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'config'), { recursive: true });

for (const file of ['settings_schema.json', 'settings_data.json']) {
  fs.copyFileSync(path.join(theme, 'config', file), path.join(out, 'config', file));
}

const readme = `UNIK CARE — Color scheme config fix
====================================

Shopify error:
"To preview your changes, color schemes must be defined in settings_data and settings_schema files."

Upload BOTH files from config/ to your live theme (Edit code → Config):

1) settings_schema.json  — defines color scheme structure (color_scheme_group)
2) settings_data.json    — defines scheme-1 … scheme-5 color values under current.color_schemes

Steps:
1. Shopify Admin → Online Store → Themes → … → Edit code
2. Open Config → settings_schema.json → paste entire file → Save
3. Open Config → settings_data.json → paste entire file → Save
   (If you have store-specific values you must keep, merge only the "color_schemes" block into "current".)
4. Refresh the theme customizer — the red preview error should disappear.

Alternative: upload the full UNIK CARE.zip theme package (includes these config files).
`;

fs.writeFileSync(path.join(out, 'README.txt'), readme);
console.log('Refreshed:', out);
