import { escapeHtml } from './utils.js';

export function generateRss(config, posts) {
  const items = posts
    .slice(0, 20)
    .map(
      (post) => `    <item>
      <title>${escapeHtml(post.title)}</title>
      <link>${config.url}${post.url}</link>
      <guid>${config.url}${post.url}</guid>
      <pubDate>${new Date(post.date).toUTCString()}</pubDate>
      <description>${escapeHtml(post.excerpt || '')}</description>
    </item>`
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeHtml(config.title)}</title>
    <link>${config.url}</link>
    <description>${escapeHtml(config.description)}</description>
    <language>${config.language}</language>
    <atom:link href="${config.url}/rss.xml" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>`;
}
