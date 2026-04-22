import { renderLayout } from './layout.js';
import { formatDate, truncate, withBasePath } from '../lib/utils.js';

export function renderTagIndex(config, tag, posts, theme = 'anime-sakura') {
  const basePath = config.__basePath || '';
  const postsHtml = posts
    .map(post => `
    <article class="post-card">
      <a href="${withBasePath(post.url, basePath)}" class="post-card-link">
        <div class="post-card-cover"></div>
        <div class="post-card-body">
          <h2 class="post-card-title">${post.title}</h2>
          <div class="post-card-meta">
            <time>${formatDate(post.date)}</time>
            <span>${post.category}</span>
          </div>
          <p class="post-card-excerpt">${truncate(post.summary || post.excerpt || '', 150)}</p>
        </div>
      </a>
    </article>`
    )
    .join('');

  const content = `
    <div class="page-header">
      <h1 class="page-title">🏷️ ${tag}</h1>
      <p class="page-description">共 ${posts.length} 篇文章</p>
    </div>
    <div class="posts-grid">
${postsHtml}
    </div>
  `;

  return renderLayout(config, {
    title: `标签: ${tag}`,
    content,
    toc: null,
    theme,
    description: `${tag} 标签下共 ${posts.length} 篇文章`,
    pathname: `/tag/${tag}/`,
  });
}

export function renderAllTags(config, tagMap, theme = 'anime-sakura') {
  const basePath = config.__basePath || '';
  const tagsHtml = Object.entries(tagMap)
    .sort((a, b) => b[1].length - a[1].length)
    .map(([tag, posts]) => `
    <a href="${withBasePath(`/tag/${tag}/`, basePath)}" class="tag tag-large">
      ${tag}
      <span class="tag-count">${posts.length}</span>
    </a>`
    )
    .join('');

  const content = `
    <div class="page-header">
      <h1 class="page-title">🏷️ 所有标签</h1>
      <p class="page-description">共 ${Object.keys(tagMap).length} 个标签</p>
    </div>
    <div class="tags-cloud-large">
${tagsHtml}
    </div>
  `;

  return renderLayout(config, {
    title: '所有标签',
    content,
    toc: null,
    theme,
    description: `共 ${Object.keys(tagMap).length} 个标签`,
    pathname: '/tags/',
  });
}
