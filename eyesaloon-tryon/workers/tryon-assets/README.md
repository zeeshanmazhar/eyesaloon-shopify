# EyeSaloon Try-On Assets Worker

Tiny Cloudflare Worker for the virtual try-on runtime assets.

It serves:

- `manifest.json`
- MediaPipe Tasks Vision JS/WASM files from R2

The bucket can be empty during lightweight testing. In that state, the manifest returns `assets-not-installed`.

## Commands

Create the R2 bucket:

```bash
env PATH=/Users/zeeshanmazhar/.nvm/versions/node/v20.18.1/bin:/usr/bin:/bin:/usr/sbin:/sbin npx wrangler r2 bucket create eyesaloon-tryon-assets
```

Create the KV fallback namespace:

```bash
env PATH=/Users/zeeshanmazhar/.nvm/versions/node/v20.18.1/bin:/usr/bin:/bin:/usr/sbin:/sbin npx wrangler kv namespace create TRYON_ASSETS_KV --config workers/tryon-assets/wrangler.toml --binding TRYON_ASSETS_KV --use-remote
```

Deploy the Worker:

```bash
env PATH=/Users/zeeshanmazhar/.nvm/versions/node/v20.18.1/bin:/usr/bin:/bin:/usr/sbin:/sbin npx wrangler deploy -c workers/tryon-assets/wrangler.toml
```

The Worker is configured as a Cloudflare Custom Domain at:

```text
https://tryon-assets.eyesaloon.com
```

Upload assets after `npm run tryon:assets:install`:

```bash
env PATH=/Users/zeeshanmazhar/.nvm/versions/node/v20.18.1/bin:/usr/bin:/bin:/usr/sbin:/sbin npx wrangler r2 object put eyesaloon-tryon-assets/vision_bundle.mjs --file public/tryon-assets/vision_bundle.mjs
env PATH=/Users/zeeshanmazhar/.nvm/versions/node/v20.18.1/bin:/usr/bin:/bin:/usr/sbin:/sbin npx wrangler r2 object put eyesaloon-tryon-assets/wasm/vision_wasm_internal.js --file public/tryon-assets/wasm/vision_wasm_internal.js
env PATH=/Users/zeeshanmazhar/.nvm/versions/node/v20.18.1/bin:/usr/bin:/bin:/usr/sbin:/sbin npx wrangler r2 object put eyesaloon-tryon-assets/wasm/vision_wasm_internal.wasm --file public/tryon-assets/wasm/vision_wasm_internal.wasm
env PATH=/Users/zeeshanmazhar/.nvm/versions/node/v20.18.1/bin:/usr/bin:/bin:/usr/sbin:/sbin npx wrangler r2 object put eyesaloon-tryon-assets/wasm/vision_wasm_nosimd_internal.js --file public/tryon-assets/wasm/vision_wasm_nosimd_internal.js
env PATH=/Users/zeeshanmazhar/.nvm/versions/node/v20.18.1/bin:/usr/bin:/bin:/usr/sbin:/sbin npx wrangler r2 object put eyesaloon-tryon-assets/wasm/vision_wasm_nosimd_internal.wasm --file public/tryon-assets/wasm/vision_wasm_nosimd_internal.wasm
```

If R2 upload is blocked for the large `.wasm` files, upload only those files to KV using the same keys:

```bash
env PATH=/Users/zeeshanmazhar/.nvm/versions/node/v20.18.1/bin:/usr/bin:/bin:/usr/sbin:/sbin npx wrangler kv key put wasm/vision_wasm_internal.wasm --namespace-id 8699e146da284f5a87fa231e788bd251 --path public/tryon-assets/wasm/vision_wasm_internal.wasm --remote
env PATH=/Users/zeeshanmazhar/.nvm/versions/node/v20.18.1/bin:/usr/bin:/bin:/usr/sbin:/sbin npx wrangler kv key put meta/wasm/vision_wasm_internal.wasm '{"size":11756954}' --namespace-id 8699e146da284f5a87fa231e788bd251 --remote
env PATH=/Users/zeeshanmazhar/.nvm/versions/node/v20.18.1/bin:/usr/bin:/bin:/usr/sbin:/sbin npx wrangler kv key put wasm/vision_wasm_nosimd_internal.wasm --namespace-id 8699e146da284f5a87fa231e788bd251 --path public/tryon-assets/wasm/vision_wasm_nosimd_internal.wasm --remote
env PATH=/Users/zeeshanmazhar/.nvm/versions/node/v20.18.1/bin:/usr/bin:/bin:/usr/sbin:/sbin npx wrangler kv key put meta/wasm/vision_wasm_nosimd_internal.wasm '{"size":10960242}' --namespace-id 8699e146da284f5a87fa231e788bd251 --remote
```
