# Premium Shopify Theme — Workspace

## Structure

Theme folders are at the **repository root** (required for Shopify GitHub Connect).

```
UNIK CARE/
├── assets/             ← Dawn + UC CSS/JS
├── config/             ← settings_schema.json + settings_data.json
├── docs/               ← Architecture, upload guide, design system schema
├── layout/             ← theme.liquid
├── locales/            ← Dawn translations
├── sections/           ← Dawn + custom premium sections
├── snippets/           ← Dawn + UC snippets
├── templates/          ← JSON templates (product, index, cart, …)
├── shopify.theme.toml
└── WORKSPACE.md
```

---

## IMPORTANT — Where to Work

**Edit files in this repository root.** Do not recreate a nested `theme/` folder — Shopify GitHub Connect will reject the branch (`Branch isn't a valid theme`).

This is the live Dawn export from **unik-care.myshopify.com**, merged with the luxury UC design system:

- Warm ivory / Luxury Gold defaults (`#F7F4EF` / `#B68A35`)
- Cormorant Garamond + Manrope typography
- Theme Editor panels: **Design System — Typography / Brand Colors / …**
- Global injector: `snippets/uc-design-system.liquid` (rendered in `layout/theme.liquid`)
- Per-section overrides: `snippets/uc-section-colors.liquid`

---

## Design System Load Order (`layout/theme.liquid`)

```liquid
{{ 'uc-design-tokens.css' | asset_url | stylesheet_tag }}
{{ 'uc-components.css' | asset_url | stylesheet_tag }}
{{ 'uc-module-bridge.css' | asset_url | stylesheet_tag }}
{{ 'uc-showcase.css' | asset_url | stylesheet_tag }}
{% render 'uc-design-system' %}
```

Changing a color or font in **Theme settings → Design System** updates CSS variables
site-wide. Individual sections can still override via “Use global brand colors”.

---

## Uploading to Shopify

See [`docs/UPLOAD-GUIDE.md`](docs/UPLOAD-GUIDE.md).

Recommended: Shopify CLI from this folder:

```bash
shopify theme push
```

GitHub Connect: Online Store → Themes → Connect from GitHub → `haseebbuildsco/unikcare.eu` → `main`.

---

## Documentation

| File | Contents |
|---|---|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | CSS tokens, JS patterns, integrations |
| [`docs/UPLOAD-GUIDE.md`](docs/UPLOAD-GUIDE.md) | Upload steps, product template notes |
| [`docs/COMPONENTS.md`](docs/COMPONENTS.md) | Reusable component API |
| [`docs/CODING-STANDARDS.md`](docs/CODING-STANDARDS.md) | Naming + new-section checklist |
| [`docs/settings-schema-additions.json`](docs/settings-schema-additions.json) | Design System Theme Editor panels (already merged into `config/settings_schema.json`) |
| [`docs/section-colors-schema-template.json`](docs/section-colors-schema-template.json) | Copy into any section for per-section color overrides |
