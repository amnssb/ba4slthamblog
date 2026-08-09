import { escapeHtml, withBasePath } from './utils.js';

export function generateSitemap(config, pages) {
  const siteUrl = String(config.url || '').replace(/\/$/, '');
  const urls = [...new Set(pages)]
    .map(
      (page) => `  <url>
    <loc>${escapeHtml(`${siteUrl}${withBasePath(page, config.__basePath || '')}`)}</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <priority>${page === '/' ? '1.0' : '0.8'}</priority>
  </url>`
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;
}
