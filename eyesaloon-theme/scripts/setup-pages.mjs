const SHOPIFY_CLI = process.env.SHOPIFY_CLI || 'shopify';
const cliStore = process.env.SHOPIFY_CLI_STORE || process.env.SHOPIFY_STORE;

if (!cliStore) {
  console.error('Missing SHOPIFY_CLI_STORE or SHOPIFY_STORE.');
  process.exit(1);
}

const pages = [
  {
    title: 'RX Guide',
    handle: 'rx-guide',
    templateSuffix: 'rx-guide',
    body: 'Eyesaloon prescription guide. Enter your prescription values, upload an RX photo, or confirm details on WhatsApp before lenses are made.',
  },
  {
    title: 'Size Guide',
    handle: 'size-guide',
    templateSuffix: 'size-guide',
    body: 'Find frame measurements for lens width, bridge, temple length, lens height, and overall frame width.',
  },
  {
    title: 'About Eyesaloon',
    handle: 'about',
    templateSuffix: 'about',
    body: 'Eyesaloon helps customers across Pakistan shop prescription eyewear, sunglasses, and contact lenses with optician-backed support.',
  },
  {
    title: 'Contact Lens Care',
    handle: 'contact-lens-care',
    templateSuffix: 'contact-lens-care',
    body: 'Care guidance for daily and monthly contact lenses, including cleaning, handling, wearing time, and reorder reminders.',
  },
  {
    title: 'Policies',
    handle: 'policies',
    templateSuffix: 'policies',
    body: 'Eyesaloon policy hub for exchange, remake, warranty, delivery, payment, and prescription support information.',
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

async function findPage(handle) {
  const data = await graphql(
    `#graphql
      query PageByHandle($query: String!) {
        pages(first: 1, query: $query) {
          nodes { id title handle }
        }
      }
    `,
    { query: `handle:${handle}` },
  );
  return data.pages.nodes[0] || null;
}

async function createPage(page) {
  const existing = await findPage(page.handle);
  if (existing) {
    console.log(`exists page ${page.handle} (${existing.id}); skipping`);
    return;
  }

  const data = await graphql(
    `#graphql
      mutation PageCreate($page: PageCreateInput!) {
        pageCreate(page: $page) {
          page { id title handle }
          userErrors { field message }
        }
      }
    `,
    {
      page: {
        ...page,
        isPublished: true,
      },
    },
  );
  const errors = data.pageCreate.userErrors;
  if (errors.length) throw new Error(`${page.handle}: ${errors.map((error) => error.message).join(', ')}`);
  console.log(`created page ${page.handle} (${data.pageCreate.page.id})`);
}

for (const page of pages) {
  await createPage(page);
}
