import { escapeHtml, withBasePath } from './utils.js';

export function generateRss(config, posts) {
  const siteUrl = String(config.url || '').replace(/\/$/, '');
  const absoluteUrl = (path) => `${siteUrl}${withBasePath(path, config.__basePath || '')}`;
  const items = posts
    .slice(0, 20)
    .map(
      (post) => `    <item>
      <title>${escapeHtml(post.title)}</title>
      <link>${escapeHtml(absoluteUrl(post.url))}</link>
      <guid isPermaLink="true">${escapeHtml(absoluteUrl(post.url))}</guid>
      <pubDate>${new Date(post.date).toUTCString()}</pubDate>
      <description>${escapeHtml(post.excerpt || '')}</description>
    </item>`
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeHtml(config.title)}</title>
    <link>${escapeHtml(siteUrl)}</link>
    <description>${escapeHtml(config.description)}</description>
    <language>${config.language}</language>
    <atom:link href="${escapeHtml(absoluteUrl('/rss.xml'))}" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>`;
}
