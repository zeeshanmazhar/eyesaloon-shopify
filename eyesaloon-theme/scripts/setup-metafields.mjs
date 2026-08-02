const API_VERSION = '2025-07';

async function loadEnv() {
  try {
    const { readFile } = await import('node:fs/promises');
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
const dryRun = process.argv.includes('--dry-run');

if ((!store || !token) && !dryRun) {
  console.error('Missing SHOPIFY_STORE or SHOPIFY_ADMIN_TOKEN. Copy .env.example to .env and export the values before running.');
  process.exit(1);
}

const productDefinitions = [
  ['Lens width (mm)', 'lens_width_mm', 'number_integer', [{ name: 'min', value: '40' }, { name: 'max', value: '62' }]],
  ['Bridge (mm)', 'bridge_mm', 'number_integer', [{ name: 'min', value: '10' }, { name: 'max', value: '28' }]],
  ['Temple (mm)', 'temple_mm', 'number_integer', [{ name: 'min', value: '120' }, { name: 'max', value: '160' }]],
  ['Lens height (mm)', 'lens_height_mm', 'number_integer', [{ name: 'min', value: '25' }, { name: 'max', value: '60' }]],
  ['Frame shape', 'frame_shape', 'single_line_text_field', []],
  ['Material', 'material', 'single_line_text_field', []],
  ['Face shapes', 'face_shapes', 'list.single_line_text_field', []],
  ['Gender', 'gender', 'single_line_text_field', []],
  ['Try-on 3D model', 'model_3d', 'file_reference', []],
  ['360 spin frames', 'spin_frames', 'list.file_reference', []],
  ['Prescription compatible', 'rx_compatible', 'boolean', []],
  ['Fit note', 'fit_note', 'single_line_text_field', []],
];

const lensPackageFields = [
  { key: 'title_en', name: 'Title EN', type: 'single_line_text_field', required: true },
  { key: 'title_ur', name: 'Title UR', type: 'single_line_text_field', required: false },
  { key: 'description', name: 'Description', type: 'multi_line_text_field', required: false },
  { key: 'price_addon', name: 'Price add-on', type: 'number_integer', required: true },
  { key: 'rx_min', name: 'Rx min', type: 'number_decimal', required: false },
  { key: 'rx_max', name: 'Rx max', type: 'number_decimal', required: false },
  { key: 'sort', name: 'Sort', type: 'number_integer', required: false },
  { key: 'active', name: 'Active', type: 'boolean', required: true },
];

async function graphql(query, variables = {}) {
  if (dryRun) {
    console.log(JSON.stringify({ query, variables }, null, 2));
    return {};
  }

  const response = await fetch(`https://${store}/admin/api/${API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': token,
    },
    body: JSON.stringify({ query, variables }),
  });

  const json = await response.json();
  if (!response.ok || json.errors) {
    throw new Error(JSON.stringify(json.errors || json, null, 2));
  }
  return json.data;
}

async function ensureProductMetafield([name, key, type, validations]) {
  const mutation = `#graphql
    mutation CreateMetafieldDefinition($definition: MetafieldDefinitionInput!) {
      metafieldDefinitionCreate(definition: $definition) {
        createdDefinition { id key namespace }
        userErrors { field message code }
      }
    }
  `;

  const definition = {
    name,
    namespace: 'eyesaloon',
    key,
    type,
    ownerType: 'PRODUCT',
    validations,
  };

  const data = await graphql(mutation, { definition });
  const errors = data.metafieldDefinitionCreate?.userErrors || [];
  const ignorable = errors.every((error) => error.code === 'TAKEN' || /already exists/i.test(error.message));

  if (errors.length && !ignorable) {
    throw new Error(`${key}: ${errors.map((error) => error.message).join(', ')}`);
  }

  console.log(`${errors.length ? 'exists' : 'created'} product metafield eyesaloon.${key}`);
}

async function ensureLensPackageMetaobject() {
  const mutation = `#graphql
    mutation CreateMetaobjectDefinition($definition: MetaobjectDefinitionCreateInput!) {
      metaobjectDefinitionCreate(definition: $definition) {
        metaobjectDefinition { id type }
        userErrors { field message code }
      }
    }
  `;

  const definition = {
    type: 'lens_package',
    name: 'Lens package',
    fieldDefinitions: lensPackageFields.map((field) => ({
      key: field.key,
      name: field.name,
      type: field.type,
      required: field.required,
    })),
  };

  const data = await graphql(mutation, { definition });
  const errors = data.metaobjectDefinitionCreate?.userErrors || [];
  const ignorable = errors.every((error) => error.code === 'TAKEN' || /already exists/i.test(error.message));

  if (errors.length && !ignorable) {
    throw new Error(`lens_package: ${errors.map((error) => error.message).join(', ')}`);
  }

  console.log(`${errors.length ? 'exists' : 'created'} metaobject lens_package`);
}

for (const definition of productDefinitions) {
  await ensureProductMetafield(definition);
}

await ensureLensPackageMetaobject();
