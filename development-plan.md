# Eyesaloon — Shopify Store: Full Technical Development Plan (Agent-Executable)

> **Purpose:** Single source of truth for building the Eyesaloon online store. Written to be executed by an AI coding agent (Codex / Claude Code) with the owner (Zee) handling accounts and content. It contains everything the agent needs: a Shopify technical reference (Part B), the design system (Part C), and milestone-by-milestone implementation instructions with code (Part D). Work top to bottom. Do not skip milestone gates.

---

# PART A — PROJECT OVERVIEW

## A1. Summary

| | |
|---|---|
| **Business** | Eyesaloon — real optician shop in Bhakkar, Punjab, Pakistan, going online nationwide |
| **Products** | Frames (PKR 1,500–8,000), prescription lenses, sunglasses, contact lenses |
| **Positioning** | "A real optician, online" — trusted Rx fulfilment, honest own-label quality |
| **Platform** | Shopify Basic + custom theme (forked from Dawn) + custom app (virtual try-on, Rx uploads, WhatsApp webhooks) |
| **Market realities** | 70%+ mobile traffic, COD ~55%+ of orders, JazzCash/Easypaisa wallets, slow/variable networks, Urdu + English audience |
| **Primary brand color** | `#3550E9` (owner-specified) — ALL colors must be changeable from theme editor without code edits |
| **Design inspiration** | Behance minimalist ecommerce UI: Libre Franklin type, neutral warm palette, spacious rounded cards, pill chips |

## A2. Division of labor

| Role | Responsibilities |
|---|---|
| **Agent** | All code: theme, sections, CSS/JS, custom app, try-on extension, metafield setup scripts, data import scripts, performance, SEO, testing |
| **Zee** | Shopify account/billing, domain, payment gateway merchant accounts (bSecure/CartDNA JazzCash), courier accounts (Leopards/TCS/PostEx), photography, lens pricing data, Urdu copy review, approval at each gate, running interactive `shopify auth login` |
| **Both** | Product data entry (agent scripts it, Zee supplies data), device QA |

## A3. Milestone map & timeline

| Week | Milestone | Deliverable |
|---|---|---|
| 1 | **M0** Setup | Store, repos, CLI auth, app scaffold, CI |
| 1–2 | **M1** Theme foundation | Design tokens, fonts, header/footer, components, styleguide page → **GATE: Zee approves look** |
| 3–4 | **M2** Core templates | Home, collection, product (lens configurator), cart, content pages |
| 3–4 | **M6** Data model | Metafield definitions, metaobjects, import scripts (parallel with M2) |
| 4 | **M7** Payments/shipping/apps | COD, gateway, courier, WhatsApp webhook |
| 5 | **M8** QA + launch | Perf budgets met, test orders pass → **LAUNCH without try-on** |
| 6–7 | Media | 360° photography, first GLB models (Zee shoots, agent processes) |
| 8–11 | **M5** Try-on | Theme app extension live on best sellers |
| 12+ | Backlog | Reviews, face-shape recommendations, home-trial flow, lens-subscription reminders |

---

# PART B — SHOPIFY TECHNICAL REFERENCE (read before writing any code)

## B1. How a Shopify theme is structured

A theme is a directory of Liquid templates + JSON config. There is **no server-side code of your own in a theme** — Liquid is rendered by Shopify. Anything needing a backend (file uploads, APIs, webhooks) lives in the **custom app** (B6).

```
eyesaloon-theme/
├── assets/            # CSS, JS, fonts, images. Referenced via {{ 'file.css' | asset_url }}
├── config/
│   ├── settings_schema.json   # Defines theme editor settings (our color/typography tokens)
│   └── settings_data.json     # Current values chosen in the editor (do not hand-edit on main)
├── layout/
│   └── theme.liquid   # HTML shell: <head>, header/footer section groups, {{ content_for_layout }}
├── locales/
│   ├── en.default.json        # UI strings (storefront)
│   ├── ur.json                # Urdu translations
│   └── en.default.schema.json # Editor-facing strings
├── sections/          # Reusable page building blocks with {% schema %} (settings + blocks)
├── snippets/          # Partial templates, included via {% render 'name' %}
└── templates/         # JSON files mapping page types to sections
    ├── index.json             # Homepage: ordered list of sections
    ├── product.json
    ├── collection.json
    ├── cart.json
    ├── page.json / page.about.json  # alternate templates
    └── 404.json
```

Key mechanics the agent must use correctly:

- **JSON templates**: `templates/product.json` lists sections; merchants reorder them in the theme editor. New page sections MUST have a `{% schema %}` with `"presets"` to appear in the editor's "Add section" picker.
- **Section schema**: settings types include `text`, `richtext`, `color`, `image_picker`, `url`, `range`, `select`, `checkbox`, `video`, `collection`, `product`. Blocks let merchants add repeatable sub-items (e.g., trust badges).
- **Liquid objects** available: `product`, `collection`, `cart`, `shop`, `settings`, `section`, `block`, `localization`, `routes`. Product metafields: `product.metafields.eyesaloon.lens_width_mm.value`.
- **Native 3D**: Shopify products support GLB files as product **media** natively (`product.media`, `media.media_type == 'model'`) and Shopify ships model-viewer for them. Use this for the product-page 3D viewer — zero custom code. The try-on still reads a GLB from a metafield (it needs a known, optimized file).
- **Money**: `{{ product.price | money }}` respects store currency formatting. Set store currency PKR, format `Rs. {{amount_no_decimals}}` in Settings → Store details.
- **Forms**: Add-to-cart is `{% form 'product', product %}`. Custom fields named `properties[Label]` become **line item properties** visible on the order. Cart-level fields are `attributes[Label]`. This is how Rx data attaches to orders — no app needed for text data.
- **No checkout customization on Basic plan.** Checkout is Shopify-hosted and locked. Everything custom must happen pre-checkout (product page, cart) or post-order (webhooks, order status page scripts are also limited). Design around this.

## B2. Local development workflow

```bash
# One-time (Zee runs the login interactively)
npm install -g @shopify/cli@latest
shopify auth login --store eyesaloon.myshopify.com

# Theme workflow
shopify theme init eyesaloon-theme        # scaffolds from Dawn (latest)
cd eyesaloon-theme && git init && git remote add origin <repo>
shopify theme dev --store eyesaloon.myshopify.com   # local server w/ hot reload at 127.0.0.1:9292
shopify theme push --unpublished --theme "develop-preview"   # push to a named preview theme
shopify theme list                        # theme IDs
shopify theme pull --theme <id>           # pull editor-made settings changes back to repo
```

- **Git integration**: in Shopify admin → Online Store → Themes → Add theme → Connect from GitHub. Connect `main` → this becomes the production theme; every merge auto-deploys. Keep a second connected theme on `develop` as preview. **Never** edit the live theme in the admin code editor.
- **Important**: theme editor changes (settings_data.json, template JSON reordering) write commits to the connected branch. Pull/rebase before working.
- **Linting**: `shopify theme check` (Theme Check is bundled in the CLI). CI must run it on every PR.

## B3. Theme settings → CSS variables (the color-change requirement)

`config/settings_schema.json` (excerpt — agent writes the full version):

```json
[
  { "name": "theme_info", "theme_name": "Eyesaloon", "theme_version": "1.0.0",
    "theme_author": "Eyesaloon", "theme_documentation_url": "", "theme_support_url": "" },
  { "name": "Brand colors",
    "settings": [
      { "type": "color", "id": "color_primary",      "label": "Primary",            "default": "#3550E9" },
      { "type": "color", "id": "color_ink",          "label": "Headings text",      "default": "#111111" },
      { "type": "color", "id": "color_body",         "label": "Body text",          "default": "#4A4A4A" },
      { "type": "color", "id": "color_muted",        "label": "Muted text",         "default": "#B2B2B2" },
      { "type": "color", "id": "color_surface",      "label": "Surface",            "default": "#FFFFFF" },
      { "type": "color", "id": "color_surface_warm", "label": "Warm surface",       "default": "#F6F1EA" },
      { "type": "color", "id": "color_accent_warm",  "label": "Warm accent",        "default": "#B08D64" },
      { "type": "color", "id": "color_success",      "label": "Success",            "default": "#1E9E4A" },
      { "type": "color", "id": "color_error",        "label": "Error",              "default": "#D93025" }
    ] },
  { "name": "Shape",
    "settings": [
      { "type": "range", "id": "radius_card",   "label": "Card radius",   "min": 0, "max": 32, "step": 2, "unit": "px", "default": 20 },
      { "type": "range", "id": "radius_button", "label": "Button radius", "min": 0, "max": 24, "step": 2, "unit": "px", "default": 12 }
    ] },
  { "name": "Store details",
    "settings": [
      { "type": "text", "id": "whatsapp_number", "label": "WhatsApp number (intl format, no +)", "default": "92XXXXXXXXXX" },
      { "type": "range", "id": "prepaid_discount_pct", "label": "Prepaid discount %", "min": 0, "max": 15, "step": 1, "default": 5 }
    ] }
]
```

`snippets/css-variables.liquid` — rendered once in `theme.liquid` `<head>`. Derived shades come from Liquid color filters so ONE swatch drives hover/tint states:

```liquid
<style>
  :root {
    --color-primary: {{ settings.color_primary }};
    --color-primary-hover: {{ settings.color_primary | color_darken: 12 }};
    --color-primary-soft: {{ settings.color_primary | color_mix: settings.color_surface, 12 }};
    --color-ink: {{ settings.color_ink }};
    --color-body: {{ settings.color_body }};
    --color-muted: {{ settings.color_muted }};
    --color-surface: {{ settings.color_surface }};
    --color-surface-warm: {{ settings.color_surface_warm }};
    --color-accent-warm: {{ settings.color_accent_warm }};
    --color-success: {{ settings.color_success }};
    --color-error: {{ settings.color_error }};
    --radius-card: {{ settings.radius_card }}px;
    --radius-button: {{ settings.radius_button }}px;
    --radius-chip: 999px;
  }
</style>
```

**Standing rule:** grep for `#[0-9a-fA-F]{3,8}` in CSS during CI; any hex outside `css-variables.liquid` defaults fails the build (allowlist: SVG assets).

## B4. Metafields & metaobjects

- **Metafields** = typed custom fields on products/variants/etc. Define them programmatically (idempotent script) via Admin GraphQL:

```graphql
mutation {
  metafieldDefinitionCreate(definition: {
    name: "Lens width (mm)", namespace: "eyesaloon", key: "lens_width_mm",
    type: "number_integer", ownerType: PRODUCT,
    validations: [{name: "min", value: "40"}, {name: "max", value: "62"}]
  }) { createdDefinition { id } userErrors { field message } }
}
```

- Liquid access: `product.metafields.eyesaloon.lens_width_mm.value`. File metafields: `.value` is a generic file object (`.url`).
- **Metaobjects** = custom content types (our lens packages). Define `lens_package` with fields: `title_en` (single_line_text), `title_ur`, `description` (multi_line_text), `price_addon` (number_integer, PKR), `rx_min`/`rx_max` (number_decimal), `sort` (number_integer), `active` (boolean). Zee edits entries in Admin → Content → Metaobjects; the configurator reads them in Liquid via `shop.metaobjects.lens_package.values`.
- Set metafield values in bulk with `productUpdate`/`metafieldsSet` mutations from the import script (B7).

## B5. Custom app — what it is and why we need one

Themes can't run servers. The custom app (Remix template, Node) provides:
1. **Theme app extension** — the try-on app block embedded in the product template (M5).
2. **App proxy** — a storefront-reachable endpoint (`https://store.com/apps/eyesaloon/*` proxied to our app server) used for the Rx **photo upload** (product forms can't upload files natively). The app stores the image and returns a URL that the theme puts into a line item property.
3. **Webhooks** — `orders/create` → WhatsApp notification pipeline (M7).

Commands:

```bash
shopify app init eyesaloon-tryon --template remix
cd eyesaloon-tryon
shopify app generate extension --template theme_app_extension --name tryon-block
shopify app dev      # tunnels the app + serves the extension into the dev store
shopify app deploy   # releases app version (extension included)
```

Theme app extension structure (this is what ships to the theme editor):

```
extensions/tryon-block/
├── blocks/tryon.liquid      # the app block: {% schema %} with target "section" — merchants add it to product.json
├── assets/                  # tryon.js, tryon.css, mediapipe wasm, draco decoder (≤ 10 MB total, no single file > 10 MB)
├── snippets/
└── locales/
```

- App blocks render inside theme sections that declare `"blocks": [{"type": "@app"}]` in their schema — ensure the product template's main section does.
- Extensions are static assets + Liquid only; the heavy JS loads from the extension's `assets/`, CDN-served by Shopify.
- **Auth/API from the app**: the Remix template handles OAuth/session for Admin API automatically. For quick one-off scripts (B7), instead create an **admin custom app token**: Admin → Settings → Apps and sales channels → Develop apps → Create app → grant Admin API scopes (`write_products`, `read_orders`, `write_files`, etc.) → install → copy `shpat_...` token into `.env` (never commit).

```bash
curl -s -X POST "https://eyesaloon.myshopify.com/admin/api/2025-07/graphql.json" \
  -H "X-Shopify-Access-Token: $SHOPIFY_ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"query":"{ shop { name currencyCode } }"}'
```

## B6. Checkout, payments, shipping — what's configurable on Basic

- **COD**: Admin → Settings → Payments → Manual payment methods → "Cash on Delivery (COD)". No transaction fee. Rename user-facing label; add instructions ("You'll receive a WhatsApp confirmation before dispatch").
- **JazzCash/Easypaisa/cards**: via third-party gateway app (bSecure aggregator or CartDNA JazzCash) once Zee's merchant account is approved. Shopify adds ~2% fee on third-party gateway transactions (not on COD).
- **Shipping**: Settings → Shipping → create zones: Zone "West Punjab express" (Bhakkar, Mianwali, Layyah, D.G. Khan, Jhang postal codes) with free/flat fast rate; Zone "Pakistan" standard. Courier apps (Leopards/TCS/PostEx from Shopify App Store) handle booking/tracking/COD remittance.
- **Discounts**: prepaid discount implemented as an automatic discount (Admin → Discounts) limited to non-COD... **Note**: Shopify can't condition discounts on payment method natively. Practical approach: discount code `PREPAID5` auto-shown in cart with copy "use when paying online"; verify at fulfilment (cancel code abuse manually) OR use the gateway app's built-in card-discount feature if bSecure provides it. Log decision in DECISIONS.md after testing.
- **Order flow**: hold COD fulfilment until WhatsApp confirmation done (tag order `wa-confirmed` manually or via app; fulfil only tagged orders).

## B7. Scripts the agent must write (repo: `eyesaloon-theme/scripts/` or app repo)

| Script | Purpose |
|---|---|
| `setup-metafields.mjs` | Idempotently create all metafield + metaobject definitions (B4, D6) |
| `import-products.mjs` | CSV → products with options, variants, prices, metafields, images (uses `productSet` mutation; batches; resumable) |
| `import-lens-packages.mjs` | CSV → `lens_package` metaobject entries |
| `attach-media.mjs` | Upload 360° frame sequences + GLBs (stagedUploadsCreate → fileCreate → attach as product media/metafield) |
| `audit-colors.mjs` | CI guard: fail on hex codes outside `css-variables.liquid` |
| `perf-check.mjs` | Lighthouse CI against preview theme URLs, asserts budgets (D8) |

All scripts: Node 20+, `.env` for `SHOPIFY_ADMIN_TOKEN` + `SHOPIFY_STORE`, `--dry-run` flag, plain console logging. Commit CSV templates (`data/products.template.csv`) so Zee knows exactly what to fill.

## B8. Localization (English + Urdu)

- All theme strings via locale files: `{{ 'products.rx.upload_label' | t }}` — never hard-coded copy. Agent maintains `locales/en.default.json` and `locales/ur.json` together (add keys to both in the same PR).
- Enable Urdu: Admin → Settings → Languages → add Urdu → publish. Install Shopify **Translate & Adapt** app for content (product descriptions) translation UI. URLs become `/ur/...`; Liquid exposes `localization.language.iso_code` — use it to switch `dir="rtl"` and the Nastaliq font on Urdu pages:

```liquid
<html lang="{{ localization.language.iso_code }}" dir="{% if localization.language.iso_code == 'ur' %}rtl{% else %}ltr{% endif %}">
```

- CSS must use logical properties (`margin-inline-start`, not `margin-left`) so RTL works free.
- Language switcher in header + footer via `localization` form.

---

# PART C — DESIGN SYSTEM

## C1. Look & feel (from Behance inspo)

Minimalist, spacious, typography-led. Generous whitespace; 16–24px card/media radii; pill filter chips; full-width mobile CTAs; product cards = rounded image on warm surface → title → PKR price (compare-at struck) → color swatch dots, no borders, subtle hover lift. Hero: centered large heading + short subtext + single primary CTA on warm surface. Optional faint oversized ghost-text section backdrops ("EYESALOON") used sparingly. Sticky header: logo left / nav center / search·account·cart right.

## C2. Color tokens

See B3 for implementation. Values: primary `#3550E9`, ink `#111111`, body `#4A4A4A`, muted `#B2B2B2`, surface `#FFFFFF`, warm surface `#F6F1EA`, warm accent `#B08D64`, success `#1E9E4A`, error `#D93025`. Hover/soft variants derived via Liquid color filters. **Nothing hard-coded.**

## C3. Typography

- **Libre Franklin** (400/500/600), self-hosted woff2 in `assets/` (`@font-face` + `font-display: swap`; preload 400 & 600). **Noto Nastaliq Urdu** loaded only when `lang=ur`.
- Scale: h1 56–72px desktop / 34px mobile (600); h2 32/26 (600); h3 22/19 (500); body 16 (400); small 14/13. Expose base size + family as theme settings.

## C4. Components inventory (build in M1, showcase on /pages/styleguide)

`button` (primary/secondary/ghost, loading state), `chip` (pill, selectable), `product-card`, `price` (PKR "Rs. 2,500"), `badge` (sale/new/blue-cut), `rating-stars`, `announcement-bar`, `measurement-diagram` (SVG frame with labeled lens/bridge/temple), `trust-strip`, `whatsapp-fab` (floating `https://wa.me/{{ settings.whatsapp_number }}`), `steps` (1-2-3 ordering explainer), `swatch-dots`, `drawer` (cart/menu/filter), `skeleton` loaders.

---

# PART D — MILESTONE IMPLEMENTATION INSTRUCTIONS

## D0. M0 — Setup (Week 1)

**Zee (blocking, do first):**
- [ ] Shopify Basic (annual), store name Eyesaloon; buy + connect domain; store currency PKR, address = real shop address. *(Development store is created and connected for app/theme preview.)*
- [x] Create private GitHub repos `eyesaloon-theme`, `eyesaloon-tryon`; invite agent. *(Using monorepo `zeeshanmazhar/eyesaloon-shopify` with `eyesaloon-theme/` and `eyesaloon-tryon/`; branches `main` and `develop` pushed.)*
- [x] Run `shopify auth login` for the agent's environment (interactive device auth). *(Done for `sudozee@gmail.com`; store target `eyesaloon.myshopify.com`.)*
- [ ] Admin → Develop apps → create `eyesaloon-scripts` custom app, scopes: `read_products, write_products, read_orders, write_files, read_files, write_metaobjects, read_metaobjects` → install → put token in `.env`.
- [ ] START PAPERWORK: NTN/sales-tax, business bank account, courier COD contracts, bSecure/CartDNA merchant application (weeks of lead time).

**Agent:**
- [x] Theme scaffold + Git integration (B2): `main` = production theme, `develop` = preview theme. *(Local Dawn scaffold created; `develop-preview` is uploaded to dev store theme `#189729079578`; GitHub monorepo remote is connected and pushed.)*
- [x] CI (GitHub Actions): `shopify theme check` + `audit-colors.mjs` on PR.
- [x] App scaffold + extension scaffold (B5); verify `shopify app dev` serves the block into the dev store. *(Scaffold and `tryon-block` extension are built; app is linked as `Eyesaloon Tryon`; `shopify app dev` is running on `eyesaloon-wtps59lz.myshopify.com` with host theme `develop-preview`.)*
- [x] Create `docs/DECISIONS.md`, `data/` CSV templates, `.env.example`.

**GATE M0:** push to `develop` visibly updates preview theme; `{ shop { name } }` GraphQL query succeeds; app block appears in theme editor.

- Preview theme push succeeds on the development store: `https://eyesaloon-wtps59lz.myshopify.com?preview_theme_id=189729079578`.
- GraphQL gate succeeds on the development store through the Shopify CLI GraphiQL proxy: `{ shop { name myshopifyDomain } }` returns `eyesaloon` / `eyesaloon-wtps59lz.myshopify.com`. A long-lived `eyesaloon-scripts` Admin API token is still needed for non-dev-server automation.
- Theme app extension is built and served through `shopify app dev`; final visual confirmation happens in the theme editor.

## D1. M1 — Theme foundation (Weeks 1–2)

- [x] Implement B3 fully (settings schema, css-variables snippet). Refactor Dawn's `base.css` color usages onto the tokens; delete Dawn's own color-scheme settings to avoid two competing systems. *Acceptance: change primary in editor → all buttons/links/chips/badges restyle; CI hex-audit passes.* *(Implemented via brand token overrides and CI color audit; Dawn color-scheme compatibility remains for OS 2.0 section settings.)*
- [x] Fonts per C3. Remove Dawn's font-picker settings (we ship fixed brand fonts).
- [x] Header section: per C1 + WhatsApp FAB + announcement bar. Mobile drawer nav. Search → Shopify predictive search API (Dawn has it; restyle).
- [x] Footer: trust row (blocks: icon + text ×4), payment logos (COD/JazzCash/Easypaisa static SVGs), shop address + Google Maps link, language switcher, socials.
- [x] Components (C4) as snippets with a parameter API documented in comments, e.g. `{% render 'product-card', product: product, show_swatches: true %}`.
- [x] `templates/page.styleguide.json` + section rendering every component in both languages/directions.
- [x] Locale files: seed `en.default.json` + `ur.json` with all M1 strings (Zee reviews Urdu).

**GATE M1:** Zee approves styleguide on phone + desktop. No template work before approval.

- Implementation pushed to dev preview theme `#189729079578`.
- Zee approval is pending after reviewing the styleguide on phone and desktop.

## D2. M2 — Core templates (Weeks 3–4)

### Homepage (`templates/index.json`)
Sections, each with schema presets and editor-configurable content: `hero` (heading, subtext, CTA, image, warm-surface toggle, ghost-text toggle) · `category-tiles` (blocks: image + collection link ×4–6) · `featured-collection` (chip filters client-side on tags) · `trust-grid` (4 cards) · `how-it-works` (3 steps + optional video) · `testimonials` (blocks) · `social-feed` (lazy embed).

- [x] Hero, category tiles, featured collection, and how-it-works/trust foundation are implemented.
- [x] Client-side featured-collection tag chips, testimonials, and social-feed placeholders are implemented. Real social embed/photos remain.

### Collection (`templates/collection.json` + `sections/main-collection.liquid`)
- [ ] Shopify **Search & Discovery** app (free, first-party) → configure filters on metafields (D6): shape, material, gender, face_shapes, price. Storefront filtering then works via `collection.filters` in Liquid — render as pill chips (mobile: filter drawer). *(Theme styling is ready; Admin app/filter configuration still required. In-theme fallback quick filters for shape/material/gender/face shape are implemented for M2 testing.)*
- [x] Grid 2-col mobile / 4-col desktop; pagination (numbered, not infinite); sort dropdown; result count; empty state.

### Product (`templates/product.json`)
- [ ] **Gallery**: media carousel — images, native 3D model media if present (B1), 360° spin viewer (custom: preloads `spin_frames` file-list metafield images, drag/swipe scrubbing, ~24 frames, lazy). Try-on app block slot renders when the app provides it (M5) — main-product section schema must include `{"type": "@app"}` in blocks. *(Dawn gallery + native 3D + section schema app block support are present; concrete try-on app block must be added in the theme editor once available; custom 360 spin viewer foundation is implemented and waits on `spin_frames` media.)*
- [x] **Measurements panel**: `measurement-diagram` snippet fed by metafields; fit note logic (lens_width < 50 → "runs narrow" etc.).
- [ ] **Lens configurator** — THE core custom build. Custom section within product form:
  - Step 1 (radio cards): Frame only / With prescription lenses / With sunglass tint. Gated by `rx_compatible` metafield.
  - Step 2 (if Rx): three tabs — (a) type values: SPH/CYL/AXIS/ADD per eye + PD, HTML inputs with sane ranges; (b) upload photo: posts to app proxy `/apps/eyesaloon/rx-upload` (B5), gets URL back, stores in hidden field; (c) "WhatsApp after ordering" checkbox.
  - Step 3: lens package cards from `lens_package` metaobjects (filtered by Rx range), PKR add-on shown; selecting updates a running total display.
  - Implementation: all choices go into `properties[...]` inputs inside `{% form 'product' %}` (e.g. `properties[Rx SPH R]`, `properties[Lens Package]`, `properties[Rx Photo URL]`). **Price add-ons**: lens packages are a hidden variant/product added alongside — simplest robust pattern: each lens package = a variant of a hidden "Lens Package" product; configurator adds frame + package to cart together via AJAX Cart API (`/cart/add.js` with `items:[...]`), linked by a shared `properties[_config_id]`. Cart section groups items with same `_config_id` visually. Log alternatives considered in DECISIONS.md.
  - *Acceptance: admin order shows frame + lens package lines with all Rx properties; totals correct; works without JS for frame-only purchase.*
  - Current status: line-item property configurator is implemented inside the product form and frame-only works without JS. Hidden lens package product + AJAX grouped add is validated on the development store with test frame products; admin order checkout succeeded with a test payment.
  - Rx upload app route scaffold exists at `/apps/eyesaloon/rx-upload`; persistent storage/file upload wiring remains.
- [x] Trust strip, related frames (same `frame_shape`, exclude self, via Liquid or Search & Discovery related products). *(Dawn related-products + Eyesaloon trust surfaces are present; metafield-specific related logic remains for after D6 data.)*

### Cart (`sections/main-cart.liquid` + drawer)
- [x] Grouped configurator items; Rx status per line ("Rx attached ✓" / "via WhatsApp"); prepaid-discount banner (`settings.prepaid_discount_pct`); COD + wallets payment icons; sticky checkout CTA on mobile; empty state with category links; note field. *(Frame/package linked cart lines, Rx status, prepaid banner, COD/JazzCash/Easypaisa pills, sticky mobile checkout, empty state, and note field are implemented and validated with a test checkout.)*

### Content pages
- [ ] `page.rx-guide` (video embeds + illustrated steps, en/ur), `page.size-guide`, `page.about` (real shop photos, map, team), policy pages (7-day exchange, free remake, warranty — Zee supplies final text), `page.contact-lens-care`, 404 with search. *(Editable starter templates exist for rx-guide, size-guide, about, and contact-lens-care; final photos, video embeds, Urdu copy review, and policy text remain.)*

**GATE M2:** end-to-end on a real low-end Android over mobile data: browse → filter → configure Rx lenses (all 3 Rx modes) → cart → COD checkout → order visible in admin with complete data. Zee approves.

## D6. M6 — Data model + import (parallel with M2)

Metafield definitions (namespace `eyesaloon`, ownerType PRODUCT unless noted):

| Key | Type | Notes |
|---|---|---|
| `lens_width_mm`, `bridge_mm`, `temple_mm`, `lens_height_mm` | number_integer | measurements panel, try-on scale, filters |
| `frame_shape` | single_line_text w/ choices: round, square, rectangle, aviator, cat-eye, oval, geometric | filters, related |
| `material` | choices: TR90, acetate, metal, titanium, mixed | filters |
| `face_shapes` | list.single_line_text | filters, recommendations |
| `gender` | choices: men, women, unisex, kids | filters |
| `model_3d` | file_reference (GLB, try-on-optimized) | try-on block |
| `spin_frames` | list.file_reference | 360° viewer |
| `rx_compatible` | boolean | configurator gate |
| `fit_note` | single_line_text | "runs narrow" override |

- [x] `setup-metafields.mjs` creates all of the above + `lens_package` metaobject definition (B4) — idempotent, safe to rerun. *(Run successfully on the development store through Shopify CLI GraphiQL proxy.)*
- [ ] `import-products.mjs` from `data/products.csv` (template columns: handle, title_en, title_ur, price, compare_at, sku, color option values, all metafields, image filenames). Batch via `productSet`; resumable via a local state file. *(Importer is implemented and dry-run validated; real upload waits on Zee's CSV/images.)*
- [x] `setup-lens-packages.mjs` creates/updates hidden lens package product variants and `lens_package` metaobjects linked by `hidden_variant_id`. *(Run successfully on development store; hidden product `Eyesaloon Lens Packages` created.)*
- [ ] Configure Search & Discovery filters on these metafields after first import.
- [ ] Zee fills CSVs for 60–100 frames + lens packages + contact lenses.

## D7. M7 — Payments, shipping, integrations (Week 4)

- [ ] COD manual payment method (B6 wording). Test order.
- [ ] Gateway app install + test once merchant account approved (bSecure preferred: one integration = JazzCash + Easypaisa + cards). Document fee math in DECISIONS.md.
- [ ] Shipping zones per B6; courier app install; test label/booking flow.
- [ ] **WhatsApp pipeline v1 (launch-blocking):** app subscribes to `orders/create` webhook (Remix template: `shopify.app.toml` webhook config). Handler formats order summary (items, Rx properties, phone, address) → sends to shop's WhatsApp via WhatsApp **Business App** deep link queue (v1 = notification email/console + manual send) or directly via a Business API provider if Zee has one. Also: auto-tag order `needs-wa-confirm`. Staff confirm with customer, then tag `wa-confirmed`. Fulfilment SOP: only fulfil `wa-confirmed`.
- [ ] Order status page additions (Additional scripts field): WhatsApp contact button + "what happens next" copy.
- [ ] Notification email templates (order confirmation) reworded en/ur: mention WhatsApp confirmation + remake guarantee.

## D5. M5 — Virtual try-on (Weeks 8–11, after launch)

Architecture per B5 (theme app extension `tryon-block`).

- [ ] **Tracking**: MediaPipe Tasks Vision `FaceLandmarker` (WASM, self-hosted in extension assets), VIDEO mode, 468 landmarks + iris. All on-device; show "your camera never leaves your phone" copy.
- [ ] **Rendering**: Three.js module build. Anchor GLB at nose bridge (landmarks 168/6/197), orient from face transform matrix, scale from iris diameter (≈11.7mm real) vs `lens_width_mm` metafield → true scale. Head occluder mesh (invisible, depth-writing) so temples hide behind head.
- [ ] **Block Liquid** (`blocks/tryon.liquid`): reads `product.metafields.eyesaloon.model_3d`, renders a "Try On" button + modal shell only; ALL JS/WASM lazy-loads on first tap (zero cost to page load). Schema: `"target": "section"`, settings for button label.
- [ ] **Theming**: UI styled exclusively with `var(--color-*)` from the theme.
- [ ] **Fallback ladder**: no camera permission → selfie upload mode (static landmark detection on photo); no WebGL/WASM → hide block. Feature-detect, never error visibly.
- [ ] **Asset pipeline** (documented in `docs/3d-pipeline.md`): photogrammetry (Meshroom/RealityScan) or Blender base-mesh library (15–25 silhouettes re-textured per SKU) → Blender cleanup → glTF export → `gltf-transform` CLI: Draco + KTX2 + resize → ≤1.5 MB GLB → upload via `attach-media.mjs` to `model_3d` metafield.
- [ ] **Reference repos to study first**: `bensonruan/Virtual-Glasses-Try-on`, `alperenuzun/basic-virtual-tryon-glasses`.
- [ ] *Acceptance: ≥24 FPS on Redmi/Infinix-class Android; Chrome + iOS Safari; first-tap-to-camera < 4s on 4G; block absent when no GLB.*

Backlog v2: face-shape classification → recommendations; PD estimate capture prefills configurator.

## D8. M8 — QA, performance, SEO, launch (Week 5)

Performance budgets (CI-enforced via `perf-check.mjs` / Lighthouse CI on preview URLs):
- [ ] Lighthouse mobile perf ≥ 80 on home/collection/product; LCP ≤ 2.5s (Slow 4G sim); CLS < 0.1.
- [ ] JS ≤ 150 KB gzip on product page excluding try-on; no render-blocking third-party scripts; all below-fold images lazy; responsive `srcset` everywhere (`image_url` filter with widths).
SEO/analytics:
- [ ] JSON-LD: Product/Offer on product pages, LocalBusiness (shop address/hours/geo) sitewide, BreadcrumbList; meta titles/descriptions templates; `hreflang` en/ur (Shopify emits when Urdu published — verify).
- [ ] Meta Pixel + TikTok Pixel + GA4 via theme settings toggles (single `analytics.liquid` snippet, no tag-manager bloat).
- [ ] Urdu landing pages for key search terms (Zee validates: چشمہ آن لائن، نظر کا چشمہ، دھوپ کا چشمہ).
Launch checklist:
- [ ] 10 scripted test orders covering: COD, prepaid, each Rx mode, contacts, multi-item, discount code, cancel, refund, exchange tags.
- [ ] Color-change drill (B3 acceptance) recorded as video for the record.
- [ ] `robots`/sitemap verified, Search Console + Bing submitted; favicons + social share images from logo; password page off; publish `main` theme; DNS/SSL green.

---

# PART E — STANDING RULES FOR THE AGENT

1. **No hard-coded colors** (CI-enforced), **no hard-coded UI strings** (locale files), **no hard-coded prices/lens data** (metaobjects).
2. Mobile-first; verify on low-end Android before marking any task complete.
3. Graceful degradation everywhere: no GLB → no 3D UI; no camera → photo mode; no JS → frame-only purchase still works.
4. Small PRs to `develop` with preview screenshots; Zee approves at gates M0/M1/M2/M8; never push directly to `main`; never edit live theme in admin.
5. Log every non-obvious choice in `docs/DECISIONS.md` (date, options considered, choice, why).
6. Keep this file updated — check boxes as tasks complete; add discovered tasks under the right milestone rather than doing them silently.
7. Secrets only in `.env` (gitignored); `.env.example` documents required keys: `SHOPIFY_STORE`, `SHOPIFY_ADMIN_TOKEN`, `SHOPIFY_API_KEY/SECRET` (app), `WHATSAPP_*` (when provider chosen).
8. Shopify API version: pin `2025-07` everywhere; upgrade deliberately, not implicitly.
9. When Shopify docs are needed: shopify.dev is the canonical source — check it rather than guessing API shapes.
