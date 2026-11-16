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
- Palette: warm ivory `#FFFDF8`, soft cream `#F8F5EE`, muted terracotta `#C98770`
- Typography: Manrope

## Merchant setup checklist

1. Create collections with these handles (or update homepage links):
   - `baby-toys`, `rattles-teethers`, `soft-plush-toys`, `musical-toys`, `sensory-toys`
   - `activity-gyms-play-mats`, `educational-toys`, `wooden-toys`, `building-blocks`
   - `bath-toys`, `pretend-play`, `puzzles-games`, `new-arrivals`, `best-sellers`
   - Age: `0-6-months`, `6-12-months`, `1-2-years`, `2-3-years`, `3-5-years`, `5-plus-years`
   - Gifts / edits: `birthday-gifts`, `baby-shower-gifts`, `newborn-gifts`, `everyday-gifts`
   - Featured: `little-explorers`, `first-toys`, `learning-through-play`, `wooden-wonders`, `soft-and-cuddly`, `perfect-little-gifts`
2. Update **Navigation → main-menu** with: Home, Shop All, Baby Toys, Educational Toys, Sensory Toys, Wooden Toys, Soft Toys, New Arrivals, Best Sellers, Gifts
3. Replace logo/favicon in Theme settings
4. Add hero + category lifestyle images in the Theme Editor
5. Set contact email / social links in the footer section settings
6. Replace old hair-care products with baby toys catalog

## Local push

```powershell
.\push-theme.ps1
```

See `THEME-UPDATE.md` and `docs/UPLOAD-GUIDE.md`.
