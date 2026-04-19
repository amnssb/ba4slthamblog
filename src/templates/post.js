import { renderLayout } from './layout.js';
import { formatDate, truncate, withBasePath } from '../lib/utils.js';

export function renderPost(config, post, prevPost, nextPost, theme = 'anime-sakura') {
  const basePath = config.__basePath || '';
  const tagsHtml = post.tags
    .map(tag => `<a href="${withBasePath(`/tag/${tag}/`, basePath)}" class="tag">${tag}</a>`)
    .join(' ');

  const prevHtml = prevPost
    ? `<a href="${withBasePath(prevPost.url, basePath)}" class="post-nav-item prev">
         <div class="post-nav-label">← 上一篇</div>
         <div class="post-nav-title">${prevPost.title}</div>
       </a>`
    : '<div></div>';

  const nextHtml = nextPost
    ? `<a href="${withBasePath(nextPost.url, basePath)}" class="post-nav-item">
         <div class="post-nav-label">下一篇 →</div>
         <div class="post-nav-title">${nextPost.title}</div>
       </a>`
    : '<div></div>';

  const tocHtml = generateToc(post.html);

  const content = `
    <article class="post-article">
      <header class="post-header">
        <h1 class="post-title">${post.title}</h1>
        <div class="post-meta">
          <time datetime="${post.date}">${formatDate(post.date)}</time>
          <span class="post-category">${post.category}</span>
          <span class="post-tags-inline">${tagsHtml}</span>
        </div>
      </header>
      
      <div class="post-content">
${post.html}
      </div>
      
      <footer class="post-nav">
        ${prevHtml}
        ${nextHtml}
      </footer>
    </article>
  `;

  return renderLayout(config, {
    title: post.title,
    content,
    toc: tocHtml,
    theme,
    description: truncate(post.excerpt || config.description, 160),
    pathname: post.url,
    image: post.cover || '/favicon.svg',
    type: 'article',
  });
}

function generateToc(html) {
  const headings = html.match(/<h([2-3])[^>]*id="([^"]*)"[^>]*>([^<]*)<\/h\1>/g);
  if (!headings) return '';

  const items = headings
    .map(h => {
      const m = h.match(/<h([2-3])[^>]*id="([^"]*)"[^>]*>([^<]*)<\/h\1>/);
      if (!m) return '';
      const level = parseInt(m[1]);
      const id = m[2];
      const text = m[3];
      const indent = level === 2 ? 0 : 12;
      return `<li class="toc-item" style="padding-left:${indent}px"><a href="#${id}">${text}</a></li>`;
    })
    .filter(Boolean)
    .join('\n');

  return items
    ? `<h3 class="toc-title">目录</h3>
<ul class="toc-list">
${items}
</ul>`
    : '';
}
