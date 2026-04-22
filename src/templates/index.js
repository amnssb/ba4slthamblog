import { renderLayout } from './layout.js';
import { formatDate, truncate, withBasePath } from '../lib/utils.js';

export function renderIndex(config, posts, pageNum, totalPages, tagMap, theme = 'anime-sakura') {
  const basePath = config.__basePath || '';
  const headerHtml = `
    <div class="page-header">
      <h1 class="site-title">${config.title}</h1>
      <p class="site-subtitle">${config.subtitle || ''}</p>
      <p class="site-description">${config.description}</p>
    </div>
  `;

  const postsHtml = posts
    .map(post => {
      const coverHtml = post.cover
        ? `<div class="post-card-cover" style="background-image: url('${withBasePath(post.cover, basePath)}')"></div>`
        : `<div class="post-card-cover"></div>`;

      const tagsHtml = post.tags
        .map(t => `<span class="tag">${t}</span>`)
        .join(' ');

      return `
    <article class="post-card">
      <a href="${withBasePath(post.url, basePath)}" class="post-card-link">
        ${coverHtml}
        <div class="post-card-body">
          <h2 class="post-card-title">${post.title}</h2>
          <div class="post-card-meta">
            <time>${formatDate(post.date)}</time>
            <span>${post.category}</span>
          </div>
          <p class="post-card-excerpt">${truncate(post.summary || post.excerpt || '', 150)}</p>
          <div class="post-card-tags">
            ${tagsHtml}
          </div>
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
    .map(([tag, count]) => `<a href="${withBasePath(`/tag/${tag}/`, basePath)}" class="tag">${tag} <small>(${count.length})</small></a>`)
    .join(' ');

  const content = `
${headerHtml}
    <div class="posts-grid">
${postsHtml}
    </div>
${paginationHtml}
    <div class="tags-section card-glass">
      <h3>热门标签</h3>
      <div class="tags-cloud">
        ${tagsCloud}
      </div>
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
