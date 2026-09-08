const API_VERSION = '2025-07';
const SHOPIFY_CLI = process.env.SHOPIFY_CLI || 'shopify';
const LENS_PACKAGE_METAOBJECT_TYPE = process.env.LENS_PACKAGE_METAOBJECT_TYPE || 'eyesaloon_lens_package';

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
const graphqlProxyUrl = process.env.SHOPIFY_GRAPHQL_PROXY_URL;
const cliStore = process.env.SHOPIFY_CLI_STORE || (store && !token ? store : '');
const dryRun = process.argv.includes('--dry-run');

if ((!store || !token) && !graphqlProxyUrl && !cliStore && !dryRun) {
  console.error('Missing SHOPIFY_STORE/SHOPIFY_ADMIN_TOKEN, SHOPIFY_GRAPHQL_PROXY_URL, or SHOPIFY_CLI_STORE. Copy .env.example to .env and export the values before running.');
  process.exit(1);
}

const productDefinitions = [
  ['Lens width (mm)', 'lens_width_mm', 'number_integer', [{ name: 'min', value: '40' }, { name: 'max', value: '62' }]],
  ['Bridge (mm)', 'bridge_mm', 'number_integer', [{ name: 'min', value: '10' }, { name: 'max', value: '28' }]],
  ['Temple (mm)', 'temple_mm', 'number_integer', [{ name: 'min', value: '120' }, { name: 'max', value: '160' }]],
  ['Lens height (mm)', 'lens_height_mm', 'number_integer', [{ name: 'min', value: '25' }, { name: 'max', value: '60' }]],
  ['Frame width (mm)', 'frame_width_mm', 'number_integer', [{ name: 'min', value: '100' }, { name: 'max', value: '170' }]],
  ['Frame shape', 'frame_shape', 'single_line_text_field', []],
  ['Material', 'material', 'single_line_text_field', []],
  ['Face shapes', 'face_shapes', 'list.single_line_text_field', []],
  ['Gender', 'gender', 'single_line_text_field', []],
  ['Try-on 3D model', 'model_3d', 'file_reference', []],
  ['Try-on 2D transparent image', 'tryon_image_2d', 'file_reference', []],
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
  { key: 'hidden_variant_id', name: 'Hidden variant ID', type: 'single_line_text_field', required: false },
];

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
  const existing = await graphql(
    `#graphql
      query LensPackageDefinition($type: String!) {
        metaobjectDefinitionByType(type: $type) {
          id
          fieldDefinitions { key }
        }
      }
    `,
    { type: LENS_PACKAGE_METAOBJECT_TYPE },
  );
  const existingDefinition = existing.metaobjectDefinitionByType;

  if (existingDefinition) {
    const existingKeys = new Set(existingDefinition.fieldDefinitions.map((field) => field.key));
    const missingFields = lensPackageFields.filter((field) => !existingKeys.has(field.key));

    const updateData = await graphql(
      `#graphql
        mutation UpdateMetaobjectDefinition($id: ID!, $definition: MetaobjectDefinitionUpdateInput!) {
          metaobjectDefinitionUpdate(id: $id, definition: $definition) {
            metaobjectDefinition { id type }
            userErrors { field message code }
          }
        }
      `,
      {
        id: existingDefinition.id,
        definition: {
          access: {
            storefront: 'PUBLIC_READ',
          },
          ...(missingFields.length
            ? {
                fieldDefinitions: missingFields.map((field) => ({
                  create: {
                    key: field.key,
                    name: field.name,
                    type: field.type,
                    required: field.required,
                  },
                })),
              }
            : {}),
        },
      },
    );
    const updateErrors = updateData.metaobjectDefinitionUpdate.userErrors;
    if (updateErrors.length) {
      throw new Error(`${LENS_PACKAGE_METAOBJECT_TYPE} update: ${updateErrors.map((error) => error.message).join(', ')}`);
    }

    console.log(
      missingFields.length
        ? `updated metaobject ${LENS_PACKAGE_METAOBJECT_TYPE} (${missingFields.map((field) => field.key).join(', ')})`
        : `exists metaobject ${LENS_PACKAGE_METAOBJECT_TYPE}`,
    );
    return;
  }

  const mutation = `#graphql
    mutation CreateMetaobjectDefinition($definition: MetaobjectDefinitionCreateInput!) {
      metaobjectDefinitionCreate(definition: $definition) {
        metaobjectDefinition { id type }
        userErrors { field message code }
      }
    }
  `;

  const definition = {
    type: LENS_PACKAGE_METAOBJECT_TYPE,
    name: 'Lens package',
    access: {
      storefront: 'PUBLIC_READ',
    },
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
    throw new Error(`${LENS_PACKAGE_METAOBJECT_TYPE}: ${errors.map((error) => error.message).join(', ')}`);
  }

  console.log(`${errors.length ? 'exists' : 'created'} metaobject ${LENS_PACKAGE_METAOBJECT_TYPE}`);
}

for (const definition of productDefinitions) {
  await ensureProductMetafield(definition);
}

await ensureLensPackageMetaobject();
