export function generateSitemap(config, pages) {
  const urls = pages
    .map(
      (page) => `  <url>
    <loc>${config.url}${page}</loc>
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
