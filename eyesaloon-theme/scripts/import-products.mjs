import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const API_VERSION = '2025-07';
const CSV_PATH = process.env.PRODUCTS_CSV || 'data/products.csv';
const IMAGE_DIR = process.env.PRODUCT_IMAGES_DIR || 'data/product-images';
const dryRun = process.argv.includes('--dry-run');
const publish = process.argv.includes('--publish');

async function loadEnv() {
  try {
    const source = await readFile('.env', 'utf8');
    for (const line of source.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
      const [key, ...valueParts] = trimmed.split('=');
      if (!process.env[key]) process.env[key] = valueParts.join('=').replace(/^["']|["']$/g, '');
    }
  } catch {
    // .env is optional; exported environment variables work too.
  }
}

await loadEnv();

const store = process.env.SHOPIFY_STORE;
const token = process.env.SHOPIFY_ADMIN_TOKEN;
const graphqlProxyUrl = process.env.SHOPIFY_GRAPHQL_PROXY_URL;

if ((!store || !token) && !graphqlProxyUrl && !dryRun) {
  console.error('Missing SHOPIFY_STORE/SHOPIFY_ADMIN_TOKEN or SHOPIFY_GRAPHQL_PROXY_URL. Copy .env.example to .env and set the values first.');
  process.exit(1);
}

function parseCsv(source) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];

    if (quoted) {
      if (char === '"' && next === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (char !== '\r') {
      field += char;
    }
  }

  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }

  const [headers, ...records] = rows.filter((candidate) => candidate.some((value) => value.trim() !== ''));
  return records.map((record) =>
    Object.fromEntries(headers.map((header, index) => [header.trim(), (record[index] || '').trim()])),
  );
}

async function graphql(query, variables = {}) {
  if (dryRun) {
    return {};
  }

  const response = await fetch(graphqlProxyUrl || `https://${store}/admin/api/${API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(graphqlProxyUrl ? {} : { 'X-Shopify-Access-Token': token }),
    },
    body: JSON.stringify({ query, variables }),
  });

  const json = await response.json();
  if (!response.ok || json.errors) {
    throw new Error(JSON.stringify(json.errors || json, null, 2));
  }
  return json.data;
}

async function findProductByHandle(handle) {
  const query = `#graphql
    query ProductByHandle($query: String!) {
      products(first: 1, query: $query) {
        nodes { id handle title variants(first: 1) { nodes { id } } }
      }
    }
  `;
  const data = await graphql(query, { query: `handle:${handle}` });
  return data.products.nodes[0] || null;
}

async function getOnlineStorePublicationId() {
  const query = `#graphql
    query Publications {
      publications(first: 20) {
        nodes { id name }
      }
    }
  `;
  const data = await graphql(query);
  return data.publications.nodes.find((publication) => /online store/i.test(publication.name))?.id;
}

async function publishProduct(productId) {
  const publicationId = await getOnlineStorePublicationId();
  if (!publicationId) {
    console.warn('No Online Store publication found; product left unpublished.');
    return;
  }

  const mutation = `#graphql
    mutation PublishProduct($id: ID!, $input: [PublicationInput!]!) {
      publishablePublish(id: $id, input: $input) {
        userErrors { field message }
      }
    }
  `;
  const data = await graphql(mutation, { id: productId, input: [{ publicationId }] });
  const errors = data.publishablePublish.userErrors;
  if (errors.length) throw new Error(`publish ${productId}: ${errors.map((error) => error.message).join(', ')}`);
}

function metafieldsFor(row) {
  const specs = [
    ['lens_width_mm', 'number_integer', row.lens_width_mm],
    ['bridge_mm', 'number_integer', row.bridge_mm],
    ['temple_mm', 'number_integer', row.temple_mm],
    ['lens_height_mm', 'number_integer', row.lens_height_mm],
    ['frame_shape', 'single_line_text_field', row.frame_shape],
    ['material', 'single_line_text_field', row.material],
    ['gender', 'single_line_text_field', row.gender],
    ['rx_compatible', 'boolean', row.rx_compatible],
    ['fit_note', 'single_line_text_field', row.fit_note],
  ];

  const metafields = specs
    .filter(([, , value]) => value !== undefined && value !== '')
    .map(([key, type, value]) => ({
      namespace: 'eyesaloon',
      key,
      type,
      value: String(value),
    }));

  if (row.face_shapes) {
    metafields.push({
      namespace: 'eyesaloon',
      key: 'face_shapes',
      type: 'list.single_line_text_field',
      value: JSON.stringify(row.face_shapes.split('|').join(',').split(',').map((value) => value.trim()).filter(Boolean)),
    });
  }

  return metafields;
}

async function uploadImage(filename) {
  if (dryRun) {
    return { mediaContentType: 'IMAGE', originalSource: `dry-run://${filename}`, alt: filename };
  }

  const filePath = path.join(IMAGE_DIR, filename);
  const fileStat = await stat(filePath);
  const mimeType = mimeFor(filename);

  const stagedMutation = `#graphql
    mutation StagedUploads($input: [StagedUploadInput!]!) {
      stagedUploadsCreate(input: $input) {
        stagedTargets {
          url
          resourceUrl
          parameters { name value }
        }
        userErrors { field message }
      }
    }
  `;

  const stagedData = await graphql(stagedMutation, {
    input: [
      {
        filename,
        mimeType,
        resource: 'IMAGE',
        fileSize: String(fileStat.size),
        httpMethod: 'POST',
      },
    ],
  });
  const errors = stagedData.stagedUploadsCreate.userErrors;
  if (errors.length) throw new Error(`stage ${filename}: ${errors.map((error) => error.message).join(', ')}`);

  const target = stagedData.stagedUploadsCreate.stagedTargets[0];
  const body = new FormData();
  for (const parameter of target.parameters) {
    body.append(parameter.name, parameter.value);
  }
  body.append('file', new Blob([await readFile(filePath)], { type: mimeType }), filename);

  const uploadResponse = await fetch(target.url, { method: 'POST', body });
  if (!uploadResponse.ok) {
    throw new Error(`upload ${filename}: HTTP ${uploadResponse.status} ${await uploadResponse.text()}`);
  }

  return { mediaContentType: 'IMAGE', originalSource: target.resourceUrl, alt: filename };
}

function mimeFor(filename) {
  const ext = path.extname(filename).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  throw new Error(`Unsupported image type for ${filename}. Use jpg, png, or webp.`);
}

async function createProduct(row, media) {
  const mutation = `#graphql
    mutation CreateProduct($product: ProductCreateInput!, $media: [CreateMediaInput!]) {
      productCreate(product: $product, media: $media) {
        product {
          id
          handle
          variants(first: 1) { nodes { id } }
        }
        userErrors { field message }
      }
    }
  `;

  if (dryRun) {
    console.log(`would create ${row.handle}: ${row.title_en}`);
    console.log(JSON.stringify({ row, media }, null, 2));
    return { id: `dry-run://${row.handle}`, variants: { nodes: [{ id: `dry-run://${row.handle}/variant` }] } };
  }

  const product = {
    title: row.title_en,
    handle: row.handle,
    vendor: row.vendor || 'Eyesaloon',
    productType: row.product_type || 'Frames',
    status: 'ACTIVE',
    tags: [row.frame_shape, row.material, row.gender, 'frames'].filter(Boolean),
    productOptions: [
      {
        name: 'Color',
        values: [{ name: row.option_color || 'Default' }],
      },
    ],
    metafields: metafieldsFor(row),
  };

  const data = await graphql(mutation, { product, media });
  const errors = data.productCreate.userErrors;
  if (errors.length) throw new Error(`${row.handle}: ${errors.map((error) => error.message).join(', ')}`);
  return data.productCreate.product;
}

async function updateInitialVariant(productId, variantId, row) {
  if (dryRun) return;

  const mutation = `#graphql
    mutation UpdateVariant($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
      productVariantsBulkUpdate(productId: $productId, variants: $variants) {
        productVariants { id price compareAtPrice }
        userErrors { field message }
      }
    }
  `;

  const data = await graphql(mutation, {
    productId,
    variants: [
      {
        id: variantId,
        price: row.price,
        compareAtPrice: row.compare_at || null,
        inventoryItem: {
          sku: row.sku || row.handle,
          tracked: false,
        },
      },
    ],
  });
  const errors = data.productVariantsBulkUpdate.userErrors;
  if (errors.length) throw new Error(`${row.handle} variant: ${errors.map((error) => error.message).join(', ')}`);
}

async function main() {
  const csv = await readFile(CSV_PATH, 'utf8');
  const rows = parseCsv(csv);

  if (!rows.length) {
    console.log(`No products found in ${CSV_PATH}`);
    return;
  }

  for (const row of rows) {
    if (!row.handle || !row.title_en || !row.price) {
      throw new Error(`Missing handle, title_en, or price in row: ${JSON.stringify(row)}`);
    }

    const existing = dryRun ? null : await findProductByHandle(row.handle);
    if (existing) {
      console.log(`exists ${row.handle} (${existing.id}); skipping`);
      continue;
    }

    const filenames = (row.image_filenames || '').split('|').map((value) => value.trim()).filter(Boolean);
    const media = [];
    for (const filename of filenames) {
      media.push(await uploadImage(filename));
    }

    const product = await createProduct(row, media);
    const variantId = product.variants.nodes[0]?.id;
    if (variantId) await updateInitialVariant(product.id, variantId, row);
    if (publish && !dryRun) await publishProduct(product.id);
    console.log(`created ${row.handle} (${product.id})`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
