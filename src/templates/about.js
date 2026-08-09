import { renderLayout } from './layout.js';
import { escapeHtml, safeUrl } from '../lib/utils.js';

export function renderAbout(config, html, theme = 'anime-sakura') {
  const callsignInfo = config.callsign
    ? `
    <div class="about-card card-glass">
      <h2>业余无线电信息</h2>
      <div class="callsign-display">${escapeHtml(config.callsign)}</div>
      <dl class="info-list">
        <dt>呼号</dt>
        <dd>${escapeHtml(config.callsign)}</dd>
        <dt>姓名</dt>
        <dd>${escapeHtml(config.author)}</dd>
        ${config.email ? `
        <dt>邮箱</dt>
        <dd><a href="${safeUrl(`mailto:${config.email}`)}">${escapeHtml(config.email)}</a></dd>
        ` : ''}
      </dl>
    </div>
    `
    : '';

  const content = `
    <header class="page-header page-header-split">
      <div>
        <p class="eyebrow">STATION PROFILE</p>
        <h1 class="page-title">关于</h1>
      </div>
      <p class="page-header-note">记录电波里的相遇，也整理技术与日常。</p>
    </header>

    <div class="about-content">
      <article class="about-main">
${html}
      </article>

      ${callsignInfo}
    </div>
  `;

  return renderLayout(config, {
    title: '关于',
    content,
    toc: null,
    theme,
    pathname: '/about/',
  });
}
