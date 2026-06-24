import { renderLayout } from './layout.js';
import { escapeHtml, safeUrl, withBasePath } from '../lib/utils.js';

export function renderFriends(config, friends, theme = 'anime-sakura') {
  const basePath = config.__basePath || '';
  const groups = {};
  for (const friend of friends) {
    const group = friend.group || 'other';
    if (!groups[group]) groups[group] = [];
    groups[group].push(friend);
  }

  const groupNames = {
    ham: 'HAM 友台',
    tech: '技术博客',
    life: '生活随笔',
    other: '其他友链',
  };

  const groupsHtml = Object.entries(groups)
    .map(([group, items]) => `
    <section class="friends-group">
      <h2 class="group-title">${escapeHtml(groupNames[group] || group)}</h2>
      <div class="friends-grid">
        ${items.map((friend) => {
          const avatar = friend.avatar ? safeUrl(friend.avatar, basePath) : withBasePath('/favicon.svg', basePath);
          return `
        <a href="${safeUrl(friend.url, basePath)}" class="friend-card" target="_blank" rel="noopener noreferrer">
          <img class="friend-avatar" src="${escapeHtml(avatar)}" alt="${escapeHtml(friend.name)}" loading="lazy" decoding="async">
          <div class="friend-info">
            <div class="friend-name">${escapeHtml(friend.name)}</div>
            <div class="friend-desc">${escapeHtml(friend.desc || '')}</div>
          </div>
        </a>`;
        }).join('')}
      </div>
    </section>
  `).join('');

  const content = `
    <div class="page-header">
      <h1 class="page-title">友情链接</h1>
      <p class="page-description">${friends.length} 位朋友的站点</p>
    </div>

    <div class="friends-content">
${groupsHtml}
    </div>

    <div class="friends-apply card-glass">
      <h3>申请友链</h3>
      <p>欢迎交换友链，请通过以下方式联系。</p>
      <ul>
        <li>Email: ${escapeHtml(config.email || 'your@email.com')}</li>
        <li>本站信息</li>
        <li>名称: ${escapeHtml(config.title)}</li>
        <li>地址: ${escapeHtml(config.url)}</li>
        <li>描述: ${escapeHtml(config.description)}</li>
      </ul>
    </div>
  `;

  return renderLayout(config, {
    title: '友情链接',
    content,
    toc: null,
    theme,
    description: `${friends.length} 位朋友的站点`,
    pathname: '/friends/',
  });
}
