import { renderLayout } from './layout.js';

export function renderAbout(config, html, theme = 'anime-sakura') {
  const callsignInfo = config.callsign
    ? `
    <div class="about-card card-glass">
      <h2>📡 业余无线电信息</h2>
      <div class="callsign-display">${config.callsign}</div>
      <dl class="info-list">
        <dt>呼号</dt>
        <dd>${config.callsign}</dd>
        <dt>姓名</dt>
        <dd>${config.author}</dd>
        ${config.email ? `
        <dt>邮箱</dt>
        <dd><a href="mailto:${config.email}">${config.email}</a></dd>
        ` : ''}
      </dl>
    </div>
    `
    : '';

  const content = `
    <div class="page-header">
      <h1 class="page-title">👋 关于</h1>
    </div>
    
    <div class="about-content">
      <div class="about-main card-glass">
${html}
      </div>
      
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
