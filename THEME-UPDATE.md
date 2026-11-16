# UNIK CARE — Update theme WITHOUT losing images

## Why images disappear

Uploading a **new ZIP as a new theme** creates a fresh theme.
Section images you added in the Theme Editor live inside that theme’s settings.
A brand-new theme does not inherit them.

## Best method (recommended): Shopify CLI push

This updates your **existing** theme in place. Settings + uploaded images stay.

### 1) Install once (Windows PowerShell)

```powershell
npm install -g @shopify/cli @shopify/theme
```

### 2) Log in once

```powershell
cd "c:\Users\Ali Haseeb\Documents\UNIK CARE"
shopify auth login --store unik-care.myshopify.com
```

### 3) List themes and note the ID of your current live / working theme

```powershell
shopify theme list
```

### 4) Push updates into that theme (keeps images/settings)

```powershell
shopify theme push --theme THEME_ID --path .
```

Or use the helper script from the project root:

```powershell
.\push-theme.ps1
```

Use `--unpublished` only if you want a new draft theme.

---

## One-time page fix: Our Story

Your page URL is `/pages/our-story`, but it was using the default blank page template.

After this update:

1. Shopify Admin → **Online Store → Pages**
2. Open **Our Story**
3. On the right, set **Theme template** to **`our-story`**
4. Save

Also check menu links point to `/pages/our-story`.

---

## If you must upload a ZIP

1. **Do not** replace / delete the live theme first.
2. Upload ZIP as a **new unpublished** theme.
3. In Theme Editor, open the new theme and **manually re-select** images only where needed  
   (product images / Files library images are still in Shopify — re-pick them, don’t re-upload).
4. Publish only after checking Our Story + collection filters.

Better long-term: switch to CLI push above.

---

## Customer accounts domain (`account.unikcare.eu`)

Shopify uses this subdomain for **new customer accounts** (sign-in, orders, profile). Your store header now links correctly:

| State | Header icon goes to |
|--------|---------------------|
| Signed out | `routes.storefront_login_url` → `account.unikcare.eu`, then back to your store |
| Signed in | `routes.account_url` → customer account portal |

Mobile menu drawer also has **Sign in** and **Create account**.

### DNS on Hostinger (one-time)

In Hostinger DNS for `unikcare.eu`:

| Type | Name | Value |
|------|------|--------|
| CNAME | `account` | `shops.myshopify.com` |

- Do **not** add A records for `account` — CNAME only.
- TLS (“certificate not provisioned”) can take **15 minutes to 48 hours** after DNS propagates.
- In Shopify Admin → **Settings → Customer accounts**, confirm the custom domain shows **Connected**.

### After DNS is green

1. Test **Sign in** from the header — you should land on `account.unikcare.eu`, then return to the store.
2. Test **Create account** from the mobile menu.
3. After login, the account icon should open your order/profile portal.

No theme code changes needed when DNS completes — Shopify routes handle the subdomain automatically.

---

## Tip: keep media in Shopify Files

Prefer:

- Product media
- **Content → Files**
- Then pick those files in Theme Editor

Avoid one-off uploads that only exist inside a single theme’s settings when possible.
