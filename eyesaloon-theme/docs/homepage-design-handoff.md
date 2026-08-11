# Eyesaloon Homepage — Design Handoff for Shopify Build

Source mockup: `eyesaloon-homepage.html` (static HTML/CSS/JS prototype, not production code — rebuild as a Shopify theme following the conventions below). This spec is written to sit alongside the existing `Eyesaloon — Shopify Store: Full Technical Development Plan`; it does not repeat that plan's Shopify mechanics (metafields, app extensions, checkout limits, etc.) — it only specifies what's new here: the homepage design itself.

---

## 1. Design tokens (must go in `settings_schema.json`, not hard-coded)

Per the project's standing rule ("no hard-coded colors, CI-enforced"), every value below must be a theme setting under `config/settings_schema.json`, consumed as CSS custom properties in `snippets/css-variables.liquid`.

| Token | Value | Notes |
|---|---|---|
| `--color-primary` | `#3550E9` | Brand blue — CTAs, links, active states |
| `--color-primary-hover` | `#2A41C4` | Darken 12% of primary |
| `--color-primary-soft` | `#EAEDFC` | Primary mixed ~6% into white — icon chips, step numbers |
| `--color-ink` | `#111111` | Headings, dark surfaces (announcement bar, footer, bold-statement sections) |
| `--color-body` | `#4A4A4A` | Body copy |
| `--color-muted` | `#B2B2B2` | Compare-at prices, timestamps, secondary labels |
| `--color-surface` | `#FFFFFF` | Default page/card background |
| `--color-surface-warm` | `#F6F1EA` | Warm cream — hero visual panel, alternating section backgrounds, product card background |
| `--color-accent-warm` | `#B08D64` | Star ratings, one product illustration accent (sparingly) |
| `--color-success` | `#1E9E4A` | WhatsApp FAB, checkmarks, "free remake" badge |
| `--color-error` | `#D93025` | Reserved (not used on homepage; form/cart validation elsewhere) |
| `--radius-card` | `20px` | Product cards, tiles, testimonial cards, split-visual panel |
| `--radius-button` | `12px` | Buttons |
| `--radius-chip` | `999px` (fixed, not a setting) | Filter chips, hero dots |
| Content max-width | `1240px` | `.wrap` container |
| Easing | `cubic-bezier(.22,1,.36,1)` | Used on every hover/transition/reveal — keep as a shared CSS var, not per-element magic numbers |

**Typography:** Libre Franklin, weights 400/500/600/700, self-hosted per the plan's C3 (the prototype loads it from Google Fonts for preview only — swap to self-hosted `woff2` + `font-display: swap` in production). Headings use `letter-spacing: -0.02em`.

| Element | Size (desktop → mobile) | Weight |
|---|---|---|
| Hero slide `h1` | `clamp(36px, 4.4vw, 60px)` | 600 |
| Section `h2` | `clamp(30px, 3.6vw, 44px)` | 600 |
| Split-feature `h2` | `clamp(30px, 3.4vw, 42px)` | 600 |
| Tile `h3` | `26px` | 600 |
| Step `h3` | `19px` | 600 |
| Body / subtext | `16px` | 400 |
| Eyebrow label | `12px`, `letter-spacing: 0.18em`, uppercase | 600 |
| Small (chips, trust inline, badges) | `13px` | 600 |

---

## 2. Page structure → `templates/index.json` sections

Build each block below as its own theme section with a `{% schema %}` block, sensible `presets`, and merchant-editable settings so this is not a locked one-off page. Order top to bottom:

1. **Announcement bar** (`sections/announcement-bar.liquid`) — single line, editable text + optional link, dark background.
2. **Header** (already exists in theme `layout/theme.liquid` / `sections/header.liquid` per the main plan — not homepage-specific, but see §4 for the exact icon/nav spec used in this design).
3. **`hero-carousel`** — the main new build. See §3, it's the most custom piece.
4. **`marquee-trust`** — scrolling trust strip.
5. **`category-tiles`** — asymmetric 2-column tile grid (1 tall + 2 stacked).
6. **`featured-collection`** — eyebrow + heading + filter chips + 4-up product grid.
7. **`split-feature`** — Rx-confidence statement with SVG measurement diagram, alternating layout-friendly (image/text side configurable).
8. **`how-it-works`** — 3-step numbered explainer.
9. **`trust-grid`** — 4-card icon/heading/subtext row.
10. **`testimonials`** — 3-up quote cards.
11. **Footer** (theme-level, not homepage-specific) — see §4 for content used here.
12. **WhatsApp FAB** — global, not a section; fixed-position snippet rendered in `theme.liquid`, reads `settings.whatsapp_number` per the main plan.

Every section needs `"presets"` in its schema so it's addable from "Add section" in the editor, and every repeatable unit (hero slides, category tiles, trust cards, testimonial cards, product cards) should be a **block**, not hard-coded markup, so Zee can add/remove/reorder without a code change.

---

## 3. Hero — carousel (the main custom build)

### Behavior
- 4 slides, auto-advance every **5000ms**, pauses on mouse-hover over the hero, resumes on mouse-leave.
- Manual controls: prev/next arrow buttons (circular, 40px, outline style) + dot indicators (8px circle → 26px pill when active, `--color-primary`).
- Touch swipe on mobile: horizontal drag >40px triggers prev/next; any manual interaction (arrow, dot, swipe) resets the autoplay timer so it doesn't jump immediately after a user action.
- Transition: outgoing/incoming slides cross-fade + slide horizontally (`opacity` + `translateX(28px)→0`, 600ms, shared easing curve). Only one slide is interactive at a time (`pointer-events: none` on inactive slides) — important for keyboard/screen-reader focus, see Accessibility below.
- Slides are absolutely positioned inside a fixed-height track (`460px` desktop, `720px`/`760px` at the two mobile breakpoints) so the layout doesn't jump as slide content length varies.

### Layout (per slide)
Two-column grid on desktop (text left, visual right, `64px` gap), stacks to single column centered on mobile (`≤900px`).

Left column: eyebrow label → `h1` (two lines, `<br>` forced break) → subtext (max-width 440px) → CTA row (primary pill button + ghost button) → inline trust row (3 checkmark items, small text).

Right column (`.hc-visual`): warm-surface rounded panel (`28px` radius) containing a centered product illustration, plus one or two **floating tag cards** absolutely positioned in the corners:
- `.float-tag.price` (bottom-left): bold price + small product name underneath.
- `.float-tag.rating` (top-right): star + rating value + review count.
- `.float-tag.badge` (top-right, used instead of rating on the Rx slide): checkmark icon + short claim, in success green.

### Slide content (as built in the prototype — replace SVG placeholders with real photography)

| # | Category | Eyebrow | Headline | Subtext | Primary CTA | Secondary CTA | Visual tag(s) |
|---|---|---|---|---|---|---|---|
| 1 | Frames | Prescription frames | "Frames that fit. Rx you can trust." | Own-label frames from Rs. 1,500, checked by an in-house optician before they ship. | Shop frames | How it works | Price: Rs. 2,200 — Bhakkar Round · Rating: ★4.8 (340) |
| 2 | Sunglasses | Sunglasses | "UV400 protection, everyday style." | Aviators, cat-eyes and classic shapes built for Punjab's sun — polarized options available. | Shop sunglasses | View collection | Price: Rs. 3,400 — Mianwali Aviator · Rating: ★4.7 (210) |
| 3 | Contacts | Contact lenses | "Daily and monthly, fitted right." | Soft lenses fitted to your prescription, with reminders when it's time to reorder. | Shop lenses | Lens guide | Price: From Rs. 1,200 per box |
| 4 | Rx confidence | Prescription, verified | "Your prescription, checked by a real optician." | Type your Rx, upload a photo, or confirm on WhatsApp — every order reviewed before it ships. | Verify your prescription | Rx guide | Badge: "Free remake if it's wrong" |

### Shopify implementation notes
- Model as `sections/hero-carousel.liquid` with `"blocks": [{"type": "slide", ...}]`, `max_blocks` unlimited (merchant can add more than 4 later — e.g. a seasonal sale slide).
- Per-slide block settings: `eyebrow` (text), `heading` (text, supports the forced line-break — either two text fields or a `richtext`/`textarea` with manual `<br>`), `subtext` (text), `primary_cta_label`/`primary_cta_link` (text + url), `secondary_cta_label`/`secondary_cta_link`, `image` (image_picker — **replace the SVG placeholder with a real product photo**, cropped/positioned to sit inside the warm panel), `tag_type` (select: price / badge), `tag_price`, `tag_product_name`, `tag_rating`, `tag_review_count`, `tag_badge_text`.
- Section-level settings: `autoplay_interval_ms` (range, default 5000), `autoplay_enabled` (checkbox, default true).
- **Accessibility (not in the prototype — add for production):** the track should be `aria-live="polite"` (or `"off"` while autoplaying, switching to `"polite"` on manual interaction, to avoid spamming screen readers every 5s), each slide `aria-hidden="true"` unless active, arrows and dots need `aria-label`s (already present in the prototype), and autoplay must pause automatically on `prefers-reduced-motion: reduce` and when the tab loses focus (`visibilitychange`).
- Graceful degradation: if JS fails to load, slide 1 should remain visible and fully usable (it's already the default `.active` state) — frame-only purchase / browsing must not depend on the carousel working, consistent with the plan's "no JS → still works" standing rule.

---

## 4. Header, footer, and global chrome

**Header** (sticky, `position: sticky; top: 0`, backdrop-blur `14px`, translucent white `rgba(255,255,255,0.85)`):
- Condenses on scroll: adds a box-shadow and reduces vertical padding from `22px` to `14px` once `window.scrollY > 20` (class `.shrink` toggled in JS — reimplement as a small vanilla-JS scroll listener in the theme, not a library).
- Logo: wordmark "EYESALOON" + small primary-color dot, left-aligned.
- Center nav (desktop only, hidden ≤900px — no mobile menu drawer built in this prototype, **the coding agent must add a mobile hamburger/drawer**, since the main plan requires one): Frames · Sunglasses · Contact lenses · Rx guide, each with an animated underline on hover.
- Right icon row: search, account, cart (with a small numeric badge, currently hard-coded `0` — bind to live cart count).

**Announcement bar:** single line, dark background, "Free lens remake if your Rx isn't right — a real optician, online" with the tail phrase in primary blue.

**Marquee (trust strip):** dark full-bleed band directly under the hero, infinitely scrolling row of text (`Real optician fitted · COD nationwide · 7-day exchange · Free Rx remake · WhatsApp confirmation ·`), CSS keyframe `translateX(0) → translateX(-50%)` over 26s, content duplicated once for seamless looping. Pause this on `prefers-reduced-motion`.

**Footer:** 4-column layout (brand+newsletter+payment badges | Shop links | Support links | Visit us/address), payment method badges (COD, JazzCash, Easypaisa, Cards) as simple bordered text pills, language switcher (EN / اردو), social row (Instagram, TikTok, WhatsApp — inline SVGs in the prototype, fine to keep as inline icons in production).

**WhatsApp FAB:** fixed bottom-right circular button, `56px`, green (`#1E9E4A`), links to `https://wa.me/{{ settings.whatsapp_number }}` per the main plan's B3/C4.

---

## 5. Section-by-section content and component detail

### Category tiles
Asymmetric grid: one tall tile (Prescription frames, primary-blue background, spans 2 rows) + two stacked smaller tiles (Sunglasses on warm cream, Contact lenses on a slightly darker cream `#EFEAE0`). Each tile: small line-icon top-right, heading, one-line description, text-arrow link ("Shop frames →"). Hover lifts `-6px`. On mobile, stacks to a single column, tall tile becomes normal height. **Block-ify this** — 3 blocks in the prototype, but schema should support N tiles with a `size` setting (large/small) so Zee can add a 4th (e.g. Kids) without code.

### Featured collection ("Bestsellers")
Eyebrow "Bestsellers" + heading "Honest quality, no 'master copies'" + subtext. Pill filter chips: All / Round / Square / Aviator / Cat-eye (currently client-side visual toggle only, no real filtering — wire this to **Search & Discovery** filters on the `frame_shape` metafield per the main plan's D2). 4-up product card grid: warm-surface card, white inner media panel with product illustration/photo, title, price row (current price bold + optional struck-through compare-at), 3 color swatch dots. Cards used: Bhakkar Round (Rs. 2,200, was Rs. 3,200), Layyah Square (Rs. 2,600), Mianwali Aviator (Rs. 3,400, was Rs. 4,500), D.G. Khan Cat-Eye (Rs. 2,800) — these are placeholder product names/prices for the mockup; pull real bestsellers from the catalog once imported (this should render actual `product-card` snippets bound to a collection, not static blocks).

### Split feature (Rx confidence)
Two-column: left = eyebrow "Prescription, verified" + heading "Your prescription. Checked by a real optician." + paragraph + 3-item checklist (type/upload Rx, in-house review, free remake). Right = warm-surface panel containing an SVG "measurement diagram" (dashed frame outline, two lens circles, labeled Lens width / Bridge / Temple) — this is exactly the `measurement-diagram` component already specified in the main plan's C4; reuse that component here rather than rebuilding it. Stacks and reorders (image above text) on mobile.

### How it works
3 numbered steps, no imagery: Choose your frame → Send your Rx → We fit and deliver. Each has a small circular number badge (primary-soft background, primary text) then heading + one-line description.

### Trust grid
4 equal cards, centered content: icon in a circular primary-soft badge, heading, one-line subtext. Cards: Real optician fitted / 7-day exchange / Free Rx remake / COD nationwide. 2-column on tablet, stays 2-column (not 1) on the smallest mobile width — check this still reads fine at 360px.

### Testimonials
3-up card grid on warm-surface section background, white cards, star rating row (accent-warm color, unicode stars in the prototype — consider an inline SVG star for production consistency), quote, name + city. Copy is placeholder — replace with real customer quotes once available; keep the "real optician / Rx trust" angle since that's the core brand differentiator per the market research.

---

## 6. Motion / interaction inventory (for the agent to reimplement, not copy verbatim JS)

| Interaction | Trigger | Behavior |
|---|---|---|
| Header shrink | `scroll` | Adds `.shrink` class past 20px scroll — reduces padding, adds shadow |
| Section reveal | `IntersectionObserver`, threshold 0.15 | Elements with `.reveal` fade up (`translateY(28px)→0`, opacity 0→1, 900ms) once 15% visible — respect `prefers-reduced-motion: reduce` (skip the transform, just fade or show instantly) |
| Filter chips | `click` | Toggles `.active` state, single-select — **must be wired to real filtering in Shopify**, this is currently decorative |
| Hero carousel | autoplay/arrows/dots/swipe | See §3 |
| Marquee | CSS keyframe, no JS | Continuous scroll, pause on `prefers-reduced-motion` |
| Card hover | `:hover` | `-6px` translateY lift + shadow on product cards, tiles, testimonial cards get no lift |
| Button hover | `:hover` | `-2px` translateY + (primary only) colored shadow |

---

## 7. Responsive breakpoints

Two breakpoints used throughout: **900px** (nav collapses, hero/grids go single/double column, section padding drops from 112px to 72px) and **560px** (grids collapse fully to 1 column, CTA buttons go full-width and stack vertically). Confirm these match whatever grid breakpoints the rest of the theme (product/collection templates) already uses, so the homepage doesn't feel out of step with the rest of the site.

---

## 8. Known gaps to close before this ships (prototype limitations)

- **No mobile nav drawer** — header nav just disappears ≤900px with no replacement trigger. Needs a hamburger + drawer per the main plan's D1.
- **All imagery is placeholder inline SVG line-art**, not real photography — every `.hc-visual`, `.product-media`, and tile background needs real product photos before this is customer-facing.
- **Filter chips and cart count are non-functional** in the prototype — need real Search & Discovery + AJAX cart wiring.
- **Fonts load from Google Fonts CDN** in the prototype for convenience — production must self-host per plan C3 (performance budget in D8 depends on this).
- **No accessibility attributes on the carousel beyond button `aria-label`s** — add `aria-live`, `aria-hidden` on inactive slides, and reduced-motion/tab-visibility pause behavior before launch.
- Copy throughout (testimonials, prices, product names) is placeholder for layout purposes — swap for real content, and remember **all UI strings must go through locale files** (`en.default.json` / `ur.json`), not hard-coded in Liquid, per the plan's standing rules.

---

## 9. Files

- `eyesaloon-homepage.html` — the interactive static prototype (open in a browser to see all motion/behavior described above).
- This document — implementation spec for the Shopify build.
