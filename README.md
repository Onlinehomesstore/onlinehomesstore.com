# Online Homes Store — Shopify theme

Premium baby toys storefront theme for **onlinehomesstore.com**.

This repository **is** the Shopify theme. Theme folders live at the **branch root** so Shopify → Online Store → Themes → Connect from GitHub can attach `main`.

```
layout/          theme.liquid
config/          settings_schema.json + settings_data.json
templates/       index, product, cart, pages, collections
sections/        OHS + shared UC modules
snippets/
assets/          includes ohs-brand-override.css
locales/
```

## Brand direction

- Niche: baby toys, educational toys, sensory play, wooden toys, soft toys, gifts
- Slogan: **Little Toys. Big Adventures.**
- Palette: warm white `#FFFDF7`, cream `#F5F1E8`, coral `#FF806E`, butter `#FFD95A`, mint `#9EDFC0`, sky `#8ECDF5`, lavender `#C8B5F0`, peach `#FFC6A5`
- Typography: **Fredoka** (headings) + **Nunito Sans** (body)
- Brand assets: `assets/ohs-logo-primary.svg`, `ohs-logo-mark.svg`, `ohs-favicon.svg`, lifestyle `ohs-*.jpg`

## Merchant setup checklist

1. Create dedicated collection handles when ready (homepage currently falls back to live collections `build-and-discover` / `stories-in-motion` / `all`):
   - Ideal: `baby-toys`, `wooden-toys`, `educational-toys`, `sensory-toys`, `soft-plush-toys`, `musical-toys`, `building-blocks`, `new-arrivals`, `best-sellers`, gift edits
2. Update **Navigation → main-menu** with: Home, Shop All, Baby Toys, Educational Toys, Sensory Toys, Wooden Toys, Soft Toys, Musical Toys, Gifts (header auto-falls back if the menu has fewer than 4 links)
3. Optional: upload a custom logo in the Okido header section; otherwise the SVG wordmark is used
4. Hero/category images already ship as theme assets; override in Theme Editor when you have custom photography
5. Set contact email / social links in the footer section settings
6. Keep product media accurate — do not replace real PDP photos with lifestyle placeholders

## Safe unpublished push (do not publish)

```powershell
.\push-theme.ps1 -Store onlinehomesstore.myshopify.com -ThemeId <UNPUBLISHED_THEME_ID>
```

`push-theme.ps1` runs `shopify theme push` **without** `--publish`. Preview in Admin, then publish manually only after approval.

See `THEME-UPDATE.md` and `docs/UPLOAD-GUIDE.md`.

## Demo catalog + images

Premium lifestyle/product images are stored in `assets/ohs-*.jpg`.

Import demo data from the `demo/` folder:

1. `demo/products.csv` ? Admin ? Products ? Import
2. Create collections using handles in `demo/collections.csv` (or automated collections by product tags)
3. After import, homepage grids automatically prefer live collections when they contain products

