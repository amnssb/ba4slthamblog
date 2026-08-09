import { renderLayout } from './layout.js';
import { escapeHtml, formatDate, safeUrl, slugify, truncate, withBasePath } from '../lib/utils.js';

export function renderIndex(config, posts, pageNum, totalPages, tagMap, theme = 'anime-sakura') {
  const basePath = config.__basePath || '';
  const headerHtml = `
    <header class="site-intro">
      <div>
        <p class="eyebrow">AMATEUR RADIO NOTEBOOK</p>
        <h1 class="site-title">${escapeHtml(config.title)}</h1>
        ${config.subtitle ? `<p class="site-subtitle">${escapeHtml(config.subtitle)}</p>` : ''}
        <p class="site-description">${escapeHtml(config.description)}</p>
      </div>
      <div class="site-intro-call">
        <span>CALLSIGN</span>
        <strong>${escapeHtml(config.callsign || config.title)}</strong>
      </div>
    </header>
  `;

  const postsHtml = posts
    .map((post) => {
      const coverUrl = post.cover ? safeUrl(post.cover, basePath) : '';
      const coverHtml = coverUrl
        ? `<div class="post-card-cover" style="background-image: url('${escapeHtml(coverUrl)}')"></div>`
        : '<div class="post-card-cover"></div>';

      const tagsHtml = (post.tags || [])
        .map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`)
        .join(' ');

      return `
    <article class="post-card">
      <a href="${withBasePath(post.url, basePath)}" class="post-card-link">
        <div class="post-card-media">${coverHtml}</div>
        <div class="post-card-body">
          <span class="post-card-kicker">${escapeHtml(post.category || 'ARTICLE')}</span>
          <h2 class="post-card-title">${escapeHtml(post.title)}</h2>
          <div class="post-card-meta">
            <time datetime="${escapeHtml(post.date)}">${formatDate(post.date)}</time>
            <span>${escapeHtml(post.category)}</span>
          </div>
          <p class="post-card-excerpt">${escapeHtml(truncate(post.summary || post.excerpt || '', 150))}</p>
          <div class="post-card-tags">${tagsHtml}</div>
        </div>
      </a>
    </article>`;
    })
    .join('');

  const paginationHtml = totalPages > 1
    ? `<nav class="pagination">
${Array.from({ length: totalPages }, (_, i) => {
  const page = i + 1;
  const url = withBasePath(page === 1 ? '/' : `/page/${page}/`, basePath);
  const active = page === pageNum ? 'active' : '';
  return `        <a href="${url}" class="page-link ${active}">${page}</a>`;
}).join('\n')}
      </nav>`
    : '';

  const tagsCloud = Object.entries(tagMap)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 10)
    .map(([tag, postsForTag]) => {
      const pathTag = slugify(tag) || tag;
      return `<a href="${withBasePath(`/tag/${pathTag}/`, basePath)}" class="tag">${escapeHtml(tag)} <small>(${postsForTag.length})</small></a>`;
    })
    .join(' ');

  const content = `
${headerHtml}
    <div class="home-layout">
      <section class="content-section latest-posts">
        <div class="section-heading">
          <div>
            <p class="eyebrow">LATEST</p>
            <h2>最新文章</h2>
          </div>
          <span class="section-count">${posts.length} 篇</span>
        </div>
        <div class="posts-grid">
${postsHtml}
        </div>
${paginationHtml}
      </section>
      <aside class="tags-section">
        <p class="eyebrow">EXPLORE</p>
        <h2>热门标签</h2>
        <div class="tags-cloud">${tagsCloud}</div>
      </aside>
    </div>
  `;

  return renderLayout(config, {
    title: pageNum > 1 ? `第 ${pageNum} 页` : null,
    content,
    toc: null,
    theme,
    pathname: pageNum === 1 ? '/' : `/page/${pageNum}/`,
  });
}
