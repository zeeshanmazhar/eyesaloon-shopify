# Eyesaloon Shopify Project Working Plan

Last updated: 2026-08-16

This document is the practical working plan for Eyesaloon. Use it as the day-to-day guide for what is done, what remains, how to run the project, and how future phases should be executed. The deeper technical specification remains in `development-plan.md`; this file is the cleaner operational version.

---

## 1. Project Overview

Eyesaloon is a Shopify storefront for prescription eyewear, sunglasses, contact lenses, lens packages, and future virtual try-on.

The project is a monorepo:

```text
shopify/
├── eyesaloon-theme/   # Shopify OS 2.0 theme based on Dawn
├── eyesaloon-tryon/   # Custom Shopify app + try-on theme app extension
└── development-plan.md
```

Current development store:

```text
Store: eyesaloon-wtps59lz.myshopify.com
Preview theme: develop-preview (#189729079578)
Preview URL: https://eyesaloon-wtps59lz.myshopify.com?preview_theme_id=189729079578
Store password: topres
```

Primary branch:

```text
develop
```

GitHub repo:

```text
zeeshanmazhar/eyesaloon-shopify.git
```

---

## 2. Current Status

### Done

- Shopify development store connected.
- Theme scaffolded from Dawn.
- Theme pushed to development preview.
- Monorepo structure created.
- Theme/app scaffolds created:
  - `eyesaloon-theme/`
  - `eyesaloon-tryon/`
- M0 setup is functionally complete for development.
- M1 theme foundation is implemented:
  - Eyesaloon color tokens
  - typography foundation
  - button/chip/card styling
  - header styling
  - footer styling
  - WhatsApp FAB support
  - color audit script
- M2 shopping flow foundation is implemented:
  - home page sections
  - collection grid
  - fallback quick filters
  - product page Rx configurator
  - hidden lens package product
  - grouped cart line items
  - checkout test succeeded
- Content page templates exist:
  - `/pages/rx-guide`
  - `/pages/size-guide`
  - `/pages/about`
  - `/pages/contact-lens-care`
  - `/pages/policies`
  - `/pages/contact`
- SEO foundation exists:
  - meta fallback logic
  - OG/social image fallback
  - JSON-LD snippets
  - analytics placeholders
  - SEO validation script
- Product import tooling exists:
  - metafield setup script
  - lens package setup script
  - product importer
  - CSV/image workflow
- Footer work has been committed:
  - commit `f87a8e3 Polish homepage and footer experience`

### Needs Confirmation

- Footer visual polish must be checked manually in browser after latest preview push.
- GitHub remote may still need the latest local commit pushed.
- Preview URL may require Shopify session or a refreshed theme ID if the old link stops working.

---

## 3. Immediate Next Actions

### Priority 1: Confirm Preview Access

1. Open:

   ```text
   https://eyesaloon-wtps59lz.myshopify.com?preview_theme_id=189729079578
   ```

2. Enter password:

   ```text
   topres
   ```

3. If the link fails, run:

   ```sh
   cd eyesaloon-theme
   PATH=/Users/zeeshanmazhar/.nvm/versions/node/v22.12.0/bin:$PATH shopify theme list --store eyesaloon-wtps59lz.myshopify.com
   ```

4. Confirm the current preview theme ID and update this document if it changed.

### Priority 2: Push Latest Commit To GitHub

Run from repo root:

```sh
git status
git log -1 --oneline
git push origin develop
```

Expected latest local commit:

```text
f87a8e3 Polish homepage and footer experience
```

### Priority 3: Footer QA

Check footer on desktop and mobile:

- Shop links are visible, not dark-on-dark.
- Support links are visible, not dark-on-dark.
- Column spacing feels balanced.
- Footer does not have a large empty lower area.
- WhatsApp icon does not show while number is still placeholder.
- Payment pills are readable.
- Footer links go to real pages.

If footer still looks wrong, fix only footer-related CSS/markup and push preview again.

---

## 4. Development Commands

### Theme

Use Node 22.12+ for Shopify CLI:

```sh
cd eyesaloon-theme
PATH=/Users/zeeshanmazhar/.nvm/versions/node/v22.12.0/bin:$PATH shopify theme check
PATH=/Users/zeeshanmazhar/.nvm/versions/node/v22.12.0/bin:$PATH node scripts/audit-colors.mjs
```

Push preview theme:

```sh
cd eyesaloon-theme
PATH=/Users/zeeshanmazhar/.nvm/versions/node/v22.12.0/bin:$PATH shopify theme push \
  --store eyesaloon-wtps59lz.myshopify.com \
  --theme 189729079578 \
  --allow-live \
  --path .
```

Run local theme dev:

```sh
cd eyesaloon-theme
PATH=/Users/zeeshanmazhar/.nvm/versions/node/v22.12.0/bin:$PATH shopify theme dev \
  --store eyesaloon-wtps59lz.myshopify.com
```

### App / Try-On

```sh
cd eyesaloon-tryon
PATH=/Users/zeeshanmazhar/.nvm/versions/node/v22.12.0/bin:$PATH npm run lint
PATH=/Users/zeeshanmazhar/.nvm/versions/node/v22.12.0/bin:$PATH npm run typecheck
PATH=/Users/zeeshanmazhar/.nvm/versions/node/v22.12.0/bin:$PATH shopify app build
```

Run app dev:

```sh
cd eyesaloon-tryon
PATH=/Users/zeeshanmazhar/.nvm/versions/node/v22.12.0/bin:$PATH shopify app dev \
  --store eyesaloon-wtps59lz.myshopify.com \
  --theme 189729079578 \
  --store-password topres \
  --use-localhost
```

### Product Import

```sh
cd eyesaloon-theme
PATH=/Users/zeeshanmazhar/.nvm/versions/node/v22.12.0/bin:$PATH npm run setup:metafields
PATH=/Users/zeeshanmazhar/.nvm/versions/node/v22.12.0/bin:$PATH npm run setup:lens-packages
PATH=/Users/zeeshanmazhar/.nvm/versions/node/v22.12.0/bin:$PATH npm run import:products -- --dry-run
PATH=/Users/zeeshanmazhar/.nvm/versions/node/v22.12.0/bin:$PATH npm run import:products -- --publish
```

Required before real product import:

- `eyesaloon-theme/.env`
- `SHOPIFY_STORE`
- `SHOPIFY_ADMIN_TOKEN`
- `data/products.csv`
- product images in `data/product-images/`

---

## 5. Remaining Work By Phase

## Phase A: Stabilize Current Storefront

Goal: Make the current theme clean, reviewable, and ready for real catalog work.

Tasks:

- [ ] Confirm current preview theme URL.
- [ ] Push latest commit to GitHub.
- [ ] Final footer visual QA.
- [ ] Final homepage visual QA.
- [ ] Check mobile header, drawer, footer, and sticky cart behavior.
- [ ] Confirm content pages are accessible.
- [ ] Confirm footer/header menus in Shopify Admin:
  - Main menu
  - Footer menu
- [ ] Update `README.md` with this working plan link.

Acceptance:

- Preview works.
- Footer links are visible and clickable.
- GitHub `develop` has the latest committed work.
- No new theme-check errors.

---

## Phase B: Real Product Catalog

Goal: Replace test/demo catalog with real Eyesaloon products.

Inputs needed from Zee:

- Real frame images.
- Product titles.
- Prices.
- Compare-at prices if any.
- SKUs.
- Frame dimensions:
  - lens width
  - bridge
  - temple
  - lens height
- Frame shape:
  - round
  - square
  - rectangle
  - aviator
  - cat-eye
  - oval
  - geometric
- Material:
  - TR90
  - acetate
  - metal
  - titanium
  - mixed
- Gender:
  - men
  - women
  - unisex
  - kids
- Face shape recommendations.
- Rx compatibility.

Tasks:

- [ ] Finalize `data/products.csv`.
- [ ] Place product images in `data/product-images/`.
- [ ] Dry-run importer.
- [ ] Remove temporary/test products.
- [ ] Import real products.
- [ ] Verify products in Admin.
- [ ] Verify product cards, collection pages, product pages, cart, and checkout.

Acceptance:

- Real products are visible.
- Product images load.
- Prices are correct.
- Metafields are populated.
- Rx configurator appears only where needed.
- Test products are gone.

---

## Phase C: Search, Filters, And Discovery

Goal: Make customers able to browse frames properly.

Tasks:

- [ ] Install/configure Shopify Search & Discovery app.
- [ ] Configure filters:
  - price
  - frame shape
  - material
  - gender
  - face shape
  - Rx compatible
- [ ] Replace fallback filtering where native filters are available.
- [ ] Test collection URLs with filter params.
- [ ] Test empty states.
- [ ] Test mobile filter drawer.

Acceptance:

- Filters work from real product metafields.
- Mobile filter UX is usable.
- No broken filter combinations.

---

## Phase D: Payments, COD, Shipping

Goal: Make the store operational for real Pakistan orders.

Inputs needed from Zee:

- Business registration status.
- Bank/payment account status.
- Courier account decisions.
- COD rules.
- Shipping rates.

Tasks:

- [ ] Enable COD manual payment method.
- [ ] Add COD instructions.
- [ ] Configure shipping zones:
  - Pakistan standard
  - optional fast/local zone
- [ ] Configure courier workflow.
- [ ] Test COD checkout.
- [ ] Later: install payment gateway app after merchant approval.
- [ ] Later: test JazzCash/Easypaisa/card gateway.

Acceptance:

- COD order can be placed.
- Shipping rate appears correctly.
- Admin order contains complete customer/order details.

---

## Phase E: WhatsApp Confirmation Flow

Goal: Orders that need confirmation are clearly handled before fulfillment.

Inputs needed from Zee:

- Real WhatsApp Business number.
- Confirmation process preference:
  - manual WhatsApp Business app
  - API provider later
- Staff SOP for confirming prescription and address.

Tasks:

- [ ] Add real WhatsApp number in theme settings.
- [ ] Verify footer/FAB WhatsApp links appear.
- [ ] Add order tag flow:
  - `needs-wa-confirm`
  - `wa-confirmed`
- [ ] Add `orders/create` webhook in app.
- [ ] Format order summary:
  - customer
  - phone
  - address
  - products
  - Rx properties
  - lens package
  - payment/shipping
- [ ] Start with v1 manual queue/log/email.
- [ ] Later integrate WhatsApp Business API provider if needed.
- [ ] Reword email notifications to mention WhatsApp confirmation.

Acceptance:

- New order creates a clear confirmation task.
- Staff can confirm before fulfillment.
- Rx details are easy to read.

---

## Phase F: Final Content

Goal: Replace starter copy/assets with final Eyesaloon content.

Inputs needed from Zee:

- Shop photos.
- Team/optician photos.
- Real city/shop details.
- Map link.
- Final policy text.
- Urdu copy review.
- Social profile URLs.

Tasks:

- [ ] Update About page.
- [ ] Update Policies page.
- [ ] Update Contact page.
- [ ] Add map link/details.
- [ ] Add final social links.
- [ ] Add final homepage imagery.
- [ ] Add real testimonials or remove placeholder testimonials.
- [ ] Add videos to Rx guide if available.

Acceptance:

- No placeholder content remains.
- Policies are legally/operationally approved by Zee.
- Urdu copy is reviewed.

---

## Phase G: SEO And Analytics

Goal: Make the store launch-ready for search and tracking.

Inputs needed from Zee:

- Final domain.
- Business name/address/phone.
- Social URLs.
- Logo/favicon/share image.
- GA4 ID.
- Meta Pixel ID.
- TikTok Pixel ID, if used.
- Search Console access.

Tasks:

- [ ] Add final logo/favicon/share image.
- [ ] Add GA4 ID.
- [ ] Add Meta Pixel ID.
- [ ] Add TikTok Pixel ID if needed.
- [ ] Add final business schema values.
- [ ] Publish Urdu language if ready.
- [ ] Verify sitemap.
- [ ] Submit Search Console.
- [ ] Submit Bing Webmaster Tools.
- [ ] Run SEO validation script after password is off.

Acceptance:

- Product pages have valid product metadata.
- Homepage/content pages have good titles/descriptions.
- Sitemap is submitted.
- Analytics fire correctly.

---

## Phase H: Virtual Try-On

Goal: Build open-source virtual try-on without paid Shopify plugins.

Principles:

- No paid try-on plugin.
- Camera feed stays on customer device.
- All heavy code lazy-loads only after customer clicks Try On.
- Product page stays fast without try-on.
- No GLB model means no try-on button.

Stack:

- MediaPipe Tasks Vision FaceLandmarker.
- Three.js.
- Open-source QR generator.
- GLB files for glasses.
- Shopify theme app extension.

Customer flow:

1. Customer opens product page.
2. Product has `eyesaloon.model_3d` metafield.
3. Try On button appears.
4. On desktop:
   - modal shows QR code
   - QR opens same product on phone with `?tryon=1&source=qr`
   - copy-link button is available
5. On mobile:
   - `?tryon=1` auto-opens try-on modal
   - customer grants camera permission
6. Browser detects face landmarks.
7. Three.js renders GLB glasses model on face.
8. Customer can close/retry.

Build checklist:

Stage H0 - Current foundation:

- [x] Shopify app scaffold exists in `eyesaloon-tryon/`.
- [x] Theme app extension exists in `extensions/tryon-block/`.
- [x] Product template accepts app blocks through `main-product.liquid`.
- [x] Metafields exist in `setup-metafields.mjs`:
  - `model_3d`
  - `lens_width_mm`
  - `bridge_mm`
  - `temple_mm`
  - `lens_height_mm`
- [x] Basic `blocks/tryon.liquid` app block shell exists.
- [x] Basic modal open/close JS exists.
- [x] Basic app block CSS exists.

Stage H1 - Lightweight storefront shell:

- [x] Read and expose product metafields to the browser:
  - `model_3d`
  - `lens_width_mm`
  - `bridge_mm`
  - `temple_mm`
  - `lens_height_mm`
- [x] Render Try On button only when a model exists; show editor-only warning when missing.
- [x] Build full modal state shell:
  - ready
  - desktop QR
  - loading
  - camera permission
  - active camera
  - no camera
  - unsupported browser
  - no model
- [x] Add copy-link button.
- [x] Add mobile auto-open when URL contains `?tryon=1`.
- [x] Add feature detection for secure context, camera, WebGL, and WASM.
- [x] Ensure camera stream stops when modal closes.
- [x] Keep schema-loaded JS tiny; lazy-load heavy code only after interaction.

Stage H2 - QR desktop-to-mobile handoff:

- [x] Choose QR generator package or vendored implementation.
- [x] Lazy-load QR generation only after desktop modal opens.
- [x] Generate QR target as canonical product URL with `?tryon=1&source=qr`.
- [x] Verify copy-link and QR target preserve the selected product URL.
- [ ] Test desktop Chrome QR flow to phone.

Stage H3 - Runtime bundle and asset strategy:

- [x] Document runtime bundle and asset strategy in `eyesaloon-tryon/docs/tryon-runtime-strategy.md`.
- [x] Measure current `three` and `@mediapipe/tasks-vision` package/runtime asset sizes in `eyesaloon-tryon/docs/tryon-library-size-audit.md`.
- [x] Choose initial bundling approach for extension runtime assets:
  - `tryon.js` stays as the small schema-loaded controller.
  - `tryon-qr.js` lazy-loads only for desktop QR.
  - `tryon-runtime.js` lazy-loads only after camera intent.
- [x] Add lightweight `tryon-runtime.js` stub and controller handoff.
- [ ] Add Three.js module build and GLTFLoader as a lazy runtime asset.
- [ ] Add MediaPipe Tasks Vision JS as a lazy runtime asset.
- [x] Add controlled app route contract for MediaPipe WASM/model assets at `/apps/eyesaloon/tryon-assets`.
- [x] Add whitelist-only MediaPipe asset installer with dry-run mode and byte ceilings.
- [x] Make `/apps/eyesaloon/tryon-assets/manifest.json` report installed/missing files.
- [x] Ignore heavy `public/tryon-assets/*` files in git while keeping `.gitkeep`.
- [x] Add deployment verification script for app-hosted MediaPipe assets.
- [x] Make lazy runtime fetch `manifest.json` and gracefully show missing tracking assets.
- [x] Verify local app route and runtime manifest handling with no heavy assets installed.
- [x] Choose deployment artifact source for MediaPipe assets:
  - `MEDIAPIPE_TASKS_VISION_SOURCE` points to an audited `@mediapipe/tasks-vision` package directory.
  - `npm run tryon:assets:prepare` copies and verifies whitelisted files during deployment.
- [ ] Install audited MediaPipe WASM/model assets into the app-hosted route, not the theme extension.
- [x] Verify app-hosted `.wasm` responses use `application/wasm` with temporary audited assets.
- [x] Keep theme app extension under Shopify's 10 MB total limit for the current shell.
- [x] Keep directly schema-loaded app block JS near Shopify's 10 KB suggested budget for the current shell.

Stage H4 - Camera and face tracking:

- [ ] Request camera permission only after customer clicks Try On or lands with `?tryon=1`.
- [ ] Render mirrored camera preview.
- [ ] Initialize MediaPipe FaceLandmarker in VIDEO mode.
- [ ] Prefer worker-based detection if main-thread detection misses performance budget.
- [ ] Handle no face, multiple faces, permission denied, insecure context, and unsupported browser states.
- [ ] Confirm all camera processing stays on device.

Stage H5 - GLB rendering and alignment:

- [ ] Load product GLB from `eyesaloon.model_3d`.
- [ ] Render with Three.js over the camera feed.
- [ ] Anchor frame to nose bridge / eye landmarks.
- [ ] Use face transform matrix where available for rotation.
- [ ] Scale using iris distance and frame measurements.
- [ ] Add smoothing to reduce jitter.
- [ ] Add basic invisible head occluder for temple depth.
- [ ] Clean up renderer, textures, and camera stream on close.

Stage H6 - 3D asset pipeline:

- [ ] Write `docs/3d-pipeline.md`.
- [ ] Define GLB requirements:
  - real-world units
  - origin/alignment point
  - forward/up axes
  - material/texture limits
  - max file size target
- [ ] Create or source first test GLB.
- [ ] Add `attach-media.mjs` or equivalent admin workflow.
- [ ] Attach GLB to one test product.
- [ ] Verify block is absent for products without GLB.

Stage H7 - QA and launch gate:

- [ ] Run app lint/typecheck/build.
- [ ] Test desktop Chrome.
- [ ] Test Android Chrome.
- [ ] Test iOS Safari.
- [ ] Verify desktop QR opens mobile try-on URL.
- [ ] Verify mobile camera opens from `?tryon=1`.
- [ ] Verify 24 FPS+ on low-end Android target.
- [ ] Verify first-tap-to-camera target under 4s on 4G.
- [ ] Verify feature hides or falls back cleanly without GLB/WebGL/camera support.
- [ ] Add analytics hooks for open, QR copy, camera granted, camera denied, and active tracking.

Later:

- [ ] Add selfie fallback mode.
- [ ] Add face-shape classification and recommendations.
- [ ] Use PD estimate to prefill configurator.

Acceptance:

- At least one product supports try-on.
- Desktop QR opens mobile try-on URL.
- Mobile camera opens from `?tryon=1`.
- Glasses track face at 24 FPS+ on a low-end Android target.
- Feature hides cleanly without GLB/WebGL/camera support.

---

## Phase I: Launch QA

Goal: Make the store ready to publish.

Test orders:

- [ ] Frame only + COD.
- [ ] Frame + prescription values + COD.
- [ ] Frame + Rx photo upload + COD.
- [ ] Frame + WhatsApp later + COD.
- [ ] Sunglasses.
- [ ] Contact lens product.
- [ ] Multi-item cart.
- [ ] Discount code.
- [ ] Cancel/refund flow.
- [ ] Exchange/remake tag flow.

Device QA:

- [ ] Desktop Chrome.
- [ ] Desktop Safari.
- [ ] iPhone Safari.
- [ ] Android Chrome.
- [ ] Low-end Android on mobile data.

Performance:

- [ ] Lighthouse mobile home.
- [ ] Lighthouse mobile collection.
- [ ] Lighthouse mobile product.
- [ ] Check LCP.
- [ ] Check CLS.
- [ ] Check product page JS weight.

Launch:

- [ ] Final domain connected.
- [ ] SSL green.
- [ ] Password disabled.
- [ ] Production theme published.
- [ ] Search Console submitted.
- [ ] First live test order placed.

---

## 6. Operating Rules

- Keep `development-plan.md` as the technical reference.
- Keep this file as the practical work tracker.
- Update this file after every completed phase.
- Log major decisions in `eyesaloon-theme/docs/DECISIONS.md`.
- Do not edit Shopify live theme code manually in Admin.
- Push to preview before user review.
- Commit after meaningful batches.
- Keep secrets out of Git.
- Do not hardcode storefront UI strings outside locale files.
- Do not hardcode colors outside approved token/theme files.
- Use Shopify Admin for real navigation/content when possible; theme fallbacks are allowed only to prevent broken UX.

---

## 7. Who Provides What

### Zee

- Final product CSV data.
- Final product images.
- Business/payment/courier accounts.
- WhatsApp Business number.
- Real policy text.
- Urdu copy approval.
- Social URLs.
- Final launch approval.

### Agent

- Theme code.
- App code.
- Import scripts.
- Product import execution.
- Preview pushes.
- SEO/analytics implementation.
- WhatsApp automation.
- Virtual try-on implementation.
- QA scripts/checklists.
- Documentation updates.

---

## 8. Current Recommended Next Step

Do this next:

1. Confirm the preview link/theme ID.
2. Push commit `f87a8e3` to GitHub if not already pushed.
3. Finish footer visual approval.
4. Move to real product catalog import.
