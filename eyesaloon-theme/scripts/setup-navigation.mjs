const SHOPIFY_CLI = process.env.SHOPIFY_CLI || 'shopify';
const cliStore = process.env.SHOPIFY_CLI_STORE || process.env.SHOPIFY_STORE;

if (!cliStore) {
  console.error('Missing SHOPIFY_CLI_STORE or SHOPIFY_STORE.');
  process.exit(1);
}

const menus = [
  {
    handle: 'main-menu',
    title: 'Main menu',
    items: [
      { title: 'All frames', type: 'HTTP', url: '/collections/all' },
      { title: 'Sunglasses', type: 'HTTP', url: '/collections/all?filter.p.product_type=Sunglasses' },
      { title: 'Rx guide', type: 'HTTP', url: '/pages/rx-guide' },
      { title: 'Contact', type: 'HTTP', url: '/pages/contact' },
    ],
  },
  {
    handle: 'footer',
    title: 'Footer menu',
    items: [
      { title: 'Rx guide', type: 'HTTP', url: '/pages/rx-guide' },
      { title: 'Size guide', type: 'HTTP', url: '/pages/size-guide' },
      { title: 'Contact lens care', type: 'HTTP', url: '/pages/contact-lens-care' },
      { title: 'Policies', type: 'HTTP', url: '/pages/policies' },
      { title: 'About', type: 'HTTP', url: '/pages/about' },
      { title: 'Contact', type: 'HTTP', url: '/pages/contact' },
    ],
  },
];

async function graphql(query, variables = {}) {
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

async function findMenu(handle) {
  const data = await graphql(
    `#graphql
      query Menus {
        menus(first: 50) {
          nodes {
            id
            handle
            title
          }
        }
      }
    `,
  );
  return data.menus.nodes.find((menu) => menu.handle === handle) || null;
}

async function upsertMenu(menu) {
  const existing = await findMenu(menu.handle);
  const mutation = existing
    ? `#graphql
        mutation MenuUpdate($id: ID!, $title: String!, $handle: String, $items: [MenuItemUpdateInput!]!) {
          menuUpdate(id: $id, title: $title, handle: $handle, items: $items) {
            menu { id handle title }
            userErrors { field message }
          }
        }
      `
    : `#graphql
        mutation MenuCreate($title: String!, $handle: String!, $items: [MenuItemCreateInput!]!) {
          menuCreate(title: $title, handle: $handle, items: $items) {
            menu { id handle title }
            userErrors { field message }
          }
        }
      `;

  const variables = existing
    ? { id: existing.id, title: menu.title, handle: menu.handle, items: menu.items }
    : { title: menu.title, handle: menu.handle, items: menu.items };
  const data = await graphql(mutation, variables);
  const result = existing ? data.menuUpdate : data.menuCreate;
  const errors = result.userErrors;
  if (errors.length) throw new Error(`${menu.handle}: ${errors.map((error) => error.message).join(', ')}`);
  console.log(`${existing ? 'updated' : 'created'} menu ${menu.handle} (${result.menu.id})`);
}

for (const menu of menus) {
  await upsertMenu(menu);
}
