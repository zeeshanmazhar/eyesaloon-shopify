# Product Import Data

Put real frame photos in `data/product-images/`.

Create `data/products.csv` from `data/products.template.csv`, then set each row's `image_filenames` to one or more exact filenames separated by `|`.

Example:

```csv
image_filenames
classic-rectangle-black-1.jpg|classic-rectangle-black-2.jpg
```

Run a no-upload validation first:

```sh
npm run import:products -- --dry-run
```

After `SHOPIFY_STORE` and `SHOPIFY_ADMIN_TOKEN` are set in `.env`, upload products:

```sh
npm run setup:metafields
npm run import:products -- --publish
```
