import { renderLayout } from './layout.js';
import { escapeHtml, formatDate, safeUrl, slugify, truncate, withBasePath } from '../lib/utils.js';

export function renderPost(config, post, prevPost, nextPost, theme = 'anime-sakura') {
  const basePath = config.__basePath || '';
  const tagsHtml = (post.tags || [])
    .map((tag) => `<a href="${withBasePath(`/tag/${slugify(tag) || tag}/`, basePath)}" class="tag">${escapeHtml(tag)}</a>`)
    .join(' ');

  const prevHtml = prevPost
    ? `<a href="${withBasePath(prevPost.url, basePath)}" class="post-nav-item prev">
         <div class="post-nav-label">上一篇</div>
         <div class="post-nav-title">${escapeHtml(prevPost.title)}</div>
       </a>`
    : '<div></div>';

  const nextHtml = nextPost
    ? `<a href="${withBasePath(nextPost.url, basePath)}" class="post-nav-item">
         <div class="post-nav-label">下一篇</div>
         <div class="post-nav-title">${escapeHtml(nextPost.title)}</div>
       </a>`
    : '<div></div>';

  const tocHtml = generateToc(post.html);

  const content = `
    <article class="post-article">
      <header class="post-header">
        <h1 class="post-title">${escapeHtml(post.title)}</h1>
        <div class="post-meta">
          <time datetime="${escapeHtml(post.date)}">${formatDate(post.date)}</time>
          <span class="post-category">${escapeHtml(post.category)}</span>
          <span class="post-tags-inline">${tagsHtml}</span>
        </div>
        ${renderSummary(post.summary)}
      </header>

      <div class="post-content">
${post.html}
      </div>

      <footer class="post-nav">
        ${prevHtml}
        ${nextHtml}
      </footer>

      ${renderGiscus(config)}
    </article>
  `;

  return renderLayout(config, {
    title: post.title,
    content,
    toc: tocHtml,
    theme,
    description: truncate(post.excerpt || config.description, 160),
    pathname: post.url,
    image: safeUrl(post.cover || '/favicon.svg', ''),
    type: 'article',
  });
}

function renderSummary(summary) {
  if (!summary) return '';

  return `
        <div class="post-summary-box">
          <details class="summary-details">
            <summary class="summary-toggle">
              <span class="summary-icon">i</span>
              <span class="summary-text">文章摘要</span>
              <span class="summary-arrow">v</span>
            </summary>
            <div class="summary-content">
              <p>${escapeHtml(summary)}</p>
            </div>
          </details>
        </div>
  `;
}

function renderGiscus(config) {
  if (config.features?.comments?.enabled !== true) return '';
  if (!config.giscus || !config.giscus.repo) return '';

  const { repo, repoId, category, categoryId } = config.giscus;
  if (!repoId || !categoryId) return '';

  return `
      <div class="giscus-comments">
        <h3 class="comments-title">评论</h3>
        <script src="https://giscus.app/client.js"
          data-repo="${escapeHtml(repo)}"
          data-repo-id="${escapeHtml(repoId)}"
          data-category="${escapeHtml(category || 'General')}"
          data-category-id="${escapeHtml(categoryId)}"
          data-mapping="pathname"
          data-strict="0"
          data-reactions-enabled="1"
          data-emit-metadata="0"
          data-input-position="bottom"
          data-theme="preferred_color_scheme"
          data-lang="zh-CN"
          crossorigin="anonymous"
          async>
        </script>
      </div>
  `;
}

function generateToc(html) {
  const headings = html.match(/<h([2-3])[^>]*id="([^"]*)"[^>]*>([\s\S]*?)<\/h\1>/g);
  if (!headings) return '';

  const items = headings
    .map((heading) => {
      const match = heading.match(/<h([2-3])[^>]*id="([^"]*)"[^>]*>([\s\S]*?)<\/h\1>/);
      if (!match) return '';
      const level = Number.parseInt(match[1], 10);
      const id = escapeHtml(match[2]);
      const text = escapeHtml(match[3].replace(/<[^>]+>/g, '').trim());
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
