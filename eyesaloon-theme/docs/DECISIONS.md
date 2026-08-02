# Decisions

## 2026-08-02 - Dawn scaffold with Eyesaloon token overlay

- Options considered: build a theme from Shopify Skeleton, fork Dawn, or write a theme from scratch.
- Choice: fork Dawn and add the Eyesaloon brand-token layer first.
- Why: Dawn gives stable Shopify OS 2.0 behavior for cart, predictive search, product media, localization, and app blocks while we progressively replace the visual system.

## 2026-08-02 - Keep Dawn settings during first scaffold

- Options considered: remove Dawn color and font settings immediately, or keep them temporarily while adding Eyesaloon settings.
- Choice: keep Dawn compatibility for the first scaffold and add Eyesaloon settings plus `snippets/css-variables.liquid`.
- Why: a full Dawn token refactor touches many sections and should be verified separately. The new CI color audit prevents additional hard-coded CSS colors while we migrate existing Dawn leftovers.

## 2026-08-02 - App scaffold waits for Shopify auth

- Options considered: scaffold the try-on app immediately, or wait for Zee's Shopify login.
- Choice: wait for Zee to run `shopify auth login`; `shopify app init` requires a device-code account flow.
- Why: the current Shopify CLI will not create the app project without account context. The current official template flag is `--template reactRouter`, replacing the older Remix label in the original plan.

## 2026-08-02 - Connect store preview before app identity

- Options considered: block all work until the Partner app exists, or push the theme and scaffold the app extension locally first.
- Choice: push `develop-preview` to `eyesaloon.myshopify.com` and scaffold `eyesaloon-tryon` with a `tryon-block` theme extension.
- Why: the Shopify theme connection can be verified independently. The app build is clean, but `shopify app dev` requires the Dev Dashboard `client_id` before the extension can be served into the theme editor.

## 2026-08-02 - App linked, dev store still required

- Options considered: use the newly created live store, create a CLI preview store, or use an organization-owned development store for `shopify app dev`.
- Choice: link the local app to `Eyesaloon Tryon` via Shopify CLI and keep the real store as the theme preview target for now.
- Why: Shopify accepts theme commands for `evevbw-yy.myshopify.com` / `eyesaloon.myshopify.com`, but `shopify app dev` rejects it because it is not a development store. The CLI-created preview store is also not attached to the `EyeSaloon` organization, so it cannot host app dev for this app.

## 2026-08-02 - App dev uses Eyesaloon development store

- Options considered: keep retrying the live store, or use Zee's new Partner development store.
- Choice: use `eyesaloon-wtps59lz.myshopify.com` for app dev and upload the `develop-preview` theme there as host theme `189729079578`.
- Why: Shopify app dev requires a development store. The CLI now serves the `try-on-block` theme app extension and the app preview against that store. A local `scripts/init-dev-db.mjs` initializes the SQLite Session table because Prisma's schema engine fails on this machine during `migrate deploy`.

## 2026-08-02 - M1 brand foundation shipped as Dawn-compatible layer

- Options considered: delete every Dawn color-scheme reference now, or keep the OS 2.0 color-scheme plumbing while overriding customer-facing surfaces with Eyesaloon tokens.
- Choice: keep the Dawn color-scheme group for section compatibility, remove the font-picker path, and make Eyesaloon tokens drive global typography, buttons, links, chips, badges, cards, footer, predictive search, and the M1 snippets.
- Why: many Dawn sections still expose `color_scheme` settings. Keeping that compatibility lets the theme validate and upload while the product/templates work continues. The CI color audit prevents new hard-coded colors outside the token allowlist.
