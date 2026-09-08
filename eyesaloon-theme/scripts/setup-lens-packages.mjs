import { readFile } from 'node:fs/promises';

const API_VERSION = '2025-07';
const SHOPIFY_CLI = process.env.SHOPIFY_CLI || 'shopify';
const LENS_PACKAGE_METAOBJECT_TYPE = process.env.LENS_PACKAGE_METAOBJECT_TYPE || 'eyesaloon_lens_package';
const CSV_PATH = process.env.LENS_PACKAGES_CSV || 'data/lens-packages.csv';
const HIDDEN_PRODUCT_HANDLE = process.env.LENS_PACKAGE_PRODUCT_HANDLE || 'eyesaloon-lens-packages';
const dryRun = process.argv.includes('--dry-run');
const skipMetaobjects = process.argv.includes('--skip-metaobjects') || process.env.LENS_PACKAGES_SKIP_METAOBJECTS === 'true';

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
const cliStore = process.env.SHOPIFY_CLI_STORE || (store && !token ? store : '');

if ((!store || !token) && !graphqlProxyUrl && !cliStore && !dryRun) {
  console.error('Missing SHOPIFY_STORE/SHOPIFY_ADMIN_TOKEN, SHOPIFY_GRAPHQL_PROXY_URL, or SHOPIFY_CLI_STORE.');
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

    if (char === '"') quoted = true;
    else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (char !== '\r') field += char;
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
    console.log(JSON.stringify({ query, variables }, null, 2));
    return {};
  }

  if (cliStore) {
    const { execFileSync } = await import('node:child_process');
    const output = execFileSync(
      SHOPIFY_CLI,
      ['store', 'execute', '--store', cliStore, '--query', query, '--variables', JSON.stringify(variables), '--json', '--allow-mutations'],
      { encoding: 'utf8', maxBuffer: 1024 * 1024 * 10 },
    );
    const jsonStart = output.indexOf('{');
    if (jsonStart === -1) throw new Error(output);
    return JSON.parse(output.slice(jsonStart));
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

async function upsertHiddenProduct(rows) {
  const mutation = `#graphql
    mutation SetLensPackageProduct($identifier: ProductSetIdentifiers, $input: ProductSetInput!) {
      productSet(identifier: $identifier, input: $input, synchronous: true) {
        product {
          id
          handle
          variants(first: 100) {
            nodes {
              id
              title
              selectedOptions { name value }
            }
          }
        }
        userErrors { field message code }
      }
    }
  `;

  const input = {
    title: 'Eyesaloon Lens Packages',
    handle: HIDDEN_PRODUCT_HANDLE,
    vendor: 'Eyesaloon',
    productType: 'Lens Package',
    status: 'ACTIVE',
    tags: ['hidden', 'lens-package'],
    productOptions: [
      {
        name: 'Package',
        position: 1,
        values: rows.map((row) => ({ name: row.title_en })),
      },
    ],
    variants: rows.map((row, index) => ({
      optionValues: [{ optionName: 'Package', name: row.title_en }],
      price: row.price_addon,
      sku: `ES-LENS-${String(index + 1).padStart(3, '0')}`,
      taxable: false,
      inventoryItem: { tracked: false },
    })),
  };

  if (dryRun) {
    console.log(`would upsert hidden product ${HIDDEN_PRODUCT_HANDLE}`);
    console.log(JSON.stringify(input, null, 2));
    return {
      id: `dry-run://${HIDDEN_PRODUCT_HANDLE}`,
      variants: {
        nodes: rows.map((row) => ({
          id: `dry-run://${row.handle}/variant`,
          selectedOptions: [{ name: 'Package', value: row.title_en }],
        })),
      },
    };
  }

  const data = await graphql(mutation, { identifier: { handle: HIDDEN_PRODUCT_HANDLE }, input });
  const errors = data.productSet.userErrors;
  if (errors.length) throw new Error(`lens package product: ${errors.map((error) => error.message).join(', ')}`);
  return data.productSet.product;
}

async function upsertLensPackageMetaobject(row, variantId) {
  const mutation = `#graphql
    mutation UpsertLensPackage($handle: MetaobjectHandleInput!, $metaobject: MetaobjectUpsertInput!) {
      metaobjectUpsert(handle: $handle, metaobject: $metaobject) {
        metaobject { id handle type }
        userErrors { field message code }
      }
    }
  `;

  const fields = [
    ['title_en', row.title_en],
    ['title_ur', row.title_ur],
    ['description', row.description],
    ['price_addon', row.price_addon],
    ['rx_min', row.rx_min],
    ['rx_max', row.rx_max],
    ['sort', row.sort],
    ['active', row.active || 'true'],
    ['hidden_variant_id', variantId],
  ]
    .filter(([, value]) => value !== undefined && value !== '')
    .map(([key, value]) => ({ key, value: String(value) }));

  if (dryRun) {
    console.log(`would upsert ${LENS_PACKAGE_METAOBJECT_TYPE} ${row.handle}`);
    console.log(JSON.stringify(fields, null, 2));
    return;
  }

  const data = await graphql(mutation, {
    handle: { type: LENS_PACKAGE_METAOBJECT_TYPE, handle: row.handle },
    metaobject: { fields },
  });
  const errors = data.metaobjectUpsert.userErrors;
  if (errors.length) throw new Error(`${row.handle}: ${errors.map((error) => error.message).join(', ')}`);
  console.log(`upserted ${LENS_PACKAGE_METAOBJECT_TYPE} ${row.handle}`);
}

const rows = parseCsv(await readFile(CSV_PATH, 'utf8'));
if (!rows.length) {
  console.log(`No lens packages found in ${CSV_PATH}`);
  process.exit(0);
}

const product = await upsertHiddenProduct(rows);
const variantsByPackage = new Map(
  product.variants.nodes.map((variant) => [
    variant.selectedOptions.find((option) => option.name === 'Package')?.value || variant.title,
    variant.id,
  ]),
);

for (const row of rows) {
  const variantId = variantsByPackage.get(row.title_en);
  if (!variantId) throw new Error(`No variant found for lens package ${row.title_en}`);
  if (skipMetaobjects) continue;
  await upsertLensPackageMetaobject(row, variantId);
}

console.log(`lens package product ready: ${product.id}`);
