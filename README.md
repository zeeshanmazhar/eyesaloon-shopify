# Eyesaloon Shopify

Shopify monorepo for the Eyesaloon storefront and try-on app.

## Projects

- `eyesaloon-theme/` - Shopify OS 2.0 theme based on Dawn with the Eyesaloon design system.
- `eyesaloon-tryon/` - Shopify app and theme app extension for virtual try-on.

## Current Milestones

- M0 setup is complete locally, with GitHub and Admin API token gates tracked in `development-plan.md`.
- M1 theme foundation is implemented and pushed to the development store preview.

## Useful Commands

```sh
cd eyesaloon-theme
npm run ci

cd ../eyesaloon-tryon
shopify app build
npm run lint
npm run typecheck
```
