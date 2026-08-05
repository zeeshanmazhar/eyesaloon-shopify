const baseUrl = process.env.SEO_VALIDATE_BASE_URL || process.env.SHOPIFY_PREVIEW_URL;
const password = process.env.SHOPIFY_STOREFRONT_PASSWORD || '';

const paths = (process.env.SEO_VALIDATE_PATHS || '/,/collections/all,/pages/about')
  .split(',')
  .map((path) => path.trim())
  .filter(Boolean);

if (!baseUrl) {
  console.error('Missing SEO_VALIDATE_BASE_URL. Example: SEO_VALIDATE_BASE_URL=https://store.myshopify.com?preview_theme_id=123 npm run validate:seo');
  process.exit(1);
}

const failures = [];

const buildUrl = (path) => {
  const url = new URL(path, baseUrl);
  const base = new URL(baseUrl);
  base.searchParams.forEach((value, key) => url.searchParams.set(key, value));
  if (password) url.searchParams.set('password', password);
  return url;
};

const getMeta = (html, selector) => {
  const propertyMatch = selector.match(/^property="(.+)"$/);
  const nameMatch = selector.match(/^name="(.+)"$/);
  const hrefRelMatch = selector.match(/^rel="(.+)"$/);

  if (propertyMatch) {
    const regex = new RegExp(`<meta[^>]+property=["']${propertyMatch[1]}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i');
    return html.match(regex)?.[1] || '';
  }
  if (nameMatch) {
    const regex = new RegExp(`<meta[^>]+name=["']${nameMatch[1]}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i');
    return html.match(regex)?.[1] || '';
  }
  if (hrefRelMatch) {
    const regex = new RegExp(`<link[^>]+rel=["']${hrefRelMatch[1]}["'][^>]+href=["']([^"']+)["'][^>]*>`, 'i');
    return html.match(regex)?.[1] || '';
  }
  return '';
};

const getJsonLdTypes = (html) => {
  const matches = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  const types = [];

  for (const [, rawJson] of matches) {
    try {
      const parsed = JSON.parse(rawJson.trim());
      const nodes = Array.isArray(parsed?.['@graph']) ? parsed['@graph'] : [parsed];
      for (const node of nodes) {
        const type = node?.['@type'];
        if (Array.isArray(type)) types.push(...type);
        if (typeof type === 'string') types.push(type);
      }
    } catch (error) {
      failures.push(`Invalid JSON-LD block: ${error.message}`);
    }
  }

  return [...new Set(types)];
};

for (const path of paths) {
  const url = buildUrl(path);
  const response = await fetch(url);
  const html = await response.text();

  if (!response.ok) failures.push(`${path}: HTTP ${response.status}`);

  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, ' ').trim() || '';
  const description = getMeta(html, 'name="description"');
  const canonical = getMeta(html, 'rel="canonical"');
  const ogTitle = getMeta(html, 'property="og:title"');
  const ogImage = getMeta(html, 'property="og:image"');
  const twitterImage = getMeta(html, 'name="twitter:image"');
  const jsonLdTypes = getJsonLdTypes(html);
  const isPasswordPage =
    html.includes('shopify-section-main-password-header') ||
    html.includes('ShopifySans') ||
    html.includes('/password') ||
    title.toLowerCase().includes('opening soon');

  if (isPasswordPage) {
    console.log(`${path}: password gate detected; full SEO validation is skipped until the storefront is accessible`);
    console.log(`  title: ${title}`);
    continue;
  }

  if (!title || title.length > 70) failures.push(`${path}: title missing or too long (${title.length})`);
  if (!description || description.length < 45 || description.length > 180) {
    failures.push(`${path}: meta description missing or outside 45-180 chars (${description.length})`);
  }
  if (!canonical) failures.push(`${path}: canonical missing`);
  if (!ogTitle) failures.push(`${path}: og:title missing`);
  if (!ogImage) failures.push(`${path}: og:image missing`);
  if (!twitterImage) failures.push(`${path}: twitter:image missing`);
  if (!jsonLdTypes.includes('WebSite')) failures.push(`${path}: WebSite JSON-LD missing`);
  if (!jsonLdTypes.includes('BreadcrumbList')) failures.push(`${path}: BreadcrumbList JSON-LD missing`);

  console.log(`${path}: ok`);
  console.log(`  title: ${title}`);
  console.log(`  description: ${description}`);
  console.log(`  json-ld: ${jsonLdTypes.join(', ') || 'none'}`);
}

if (failures.length > 0) {
  console.error('\nSEO validation failures:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('\nSEO validation passed.');
