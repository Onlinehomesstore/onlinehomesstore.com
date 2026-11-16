UNIK CARE — product page manual upload (Edit code on your live theme)

IMPORTANT: Upload sections BEFORE product.json.

Your OLD working product.json included quantity_tier blocks — do NOT paste that.
Use ONLY the product.json from this folder (no tier blocks; matches current hero schema).

1) sections/ — upload ALL .liquid files first (premium-product-hero.liquid MUST save OK)
2) snippets/
3) assets/
4) templates/product.json — LAST

FileSaveError: Section type premium-product-hero does not refer to an existing section file
→ sections/premium-product-hero.liquid is NOT saved on your theme yet.
product.json CANNOT be saved until every section file exists.

FIX (manual upload):
1) Edit code → sections → Add a new section
2) Name the file EXACTLY: premium-product-hero.liquid
3) Paste from PDP_MANUAL_UPLOAD/sections/premium-product-hero.liquid → Save (must succeed with no error)
4) Repeat for ALL 11 section files in PDP_MANUAL_UPLOAD/sections/
5) Upload snippets/ then assets/
6) ONLY THEN add templates/product.json

FIX (recommended):
Upload UNIK CARE.zip as a NEW theme → Publish.
Verify templates/product.json appears in Edit code.

After upload:
• Online Store → Themes → Customize → open any product → confirm PDP loads
• Products → Theme template → Default product

Prefer full theme zip instead:
  node theme/_build_zip.js  →  upload UNIK CARE.zip  →  Publish
