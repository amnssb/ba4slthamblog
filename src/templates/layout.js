import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { escapeHtml, safeUrl, withBasePath } from '../lib/utils.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../..');

function buildThemeVars(themeConfig) {
  const colors = themeConfig.colors || {};
  const darkColors = themeConfig.darkColors || {};
  const radius = themeConfig.radius || {};
  const glass = themeConfig.glass || {};
  const typography = themeConfig.typography || {};

  const lightVars = [
    ['primary', colors.primary],
    ['primary-dark', colors.primaryDark],
    ['secondary', colors.secondary],
    ['accent', colors.accent],
    ['bg', colors.background],
    ['bg-gradient', colors.backgroundGradient],
    ['surface', colors.surface],
    ['surface-hover', colors.surfaceHover],
    ['text', colors.text],
    ['text-muted', colors.textMuted],
    ['text-light', colors.textLight],
    ['border', colors.border],
    ['shadow', colors.shadow],
    ['radius-sm', radius.sm],
    ['radius-md', radius.md],
    ['radius-lg', radius.lg],
    ['radius-xl', radius.xl],
    ['radius-full', radius.full],
    ['glass-blur', glass.blur],
    ['glass-saturate', glass.saturate],
    ['font-title', typography.titleFont],
    ['font-body', typography.bodyFont],
    ['font-code', typography.codeFont],
  ].filter(([, value]) => value);

  const darkVars = [
    ['bg', darkColors.background],
    ['bg-gradient', darkColors.backgroundGradient],
    ['surface', darkColors.surface],
    ['surface-hover', darkColors.surfaceHover],
    ['text', darkColors.text],
    ['text-muted', darkColors.textMuted],
    ['border', darkColors.border],
  ].filter(([, value]) => value);

  const rootCss = lightVars.map(([name, value]) => `--${name}: ${value};`).join(' ');
  const darkCss = darkVars.map(([name, value]) => `--${name}: ${value};`).join(' ');

  return `
  <style>
    :root { ${rootCss} }
    .dark-mode { ${darkCss} }
  </style>`;
}

function renderNavLinks(items, basePath) {
  return items
    .map((item) => {
      const text = escapeHtml(item.text || '');
      const icon = item.icon ? `<span class="nav-icon">${escapeHtml(item.icon)}</span>` : '';
      return `          <a href="${safeUrl(item.url, basePath)}" class="nav-link">${icon} ${text}</a>`;
    })
    .join('\n');
}

export function renderLayout(config, {
  title,
  content,
  toc,
  theme = 'anime-sakura',
  description,
  pathname = '/',
  image = '/favicon.svg',
  type = 'website',
}) {
  const pageTitle = title ? `${title} - ${config.title}` : config.title;
  
  // Load theme
  const themePath = join(ROOT, 'themes', theme, 'theme.json');
  let themeConfig = {};
  try {
    themeConfig = JSON.parse(readFileSync(themePath, 'utf-8'));
  } catch {}
  
  const colors = themeConfig.colors || {};
  const basePath = config.__basePath || '';
  const pageDescription = description || config.description;
  const siteUrl = (config.url || '').replace(/\/$/, '');
  const pagePath = withBasePath(pathname, basePath);
  const pageUrl = siteUrl ? `${siteUrl}${pagePath}` : pagePath;
  const imagePath = withBasePath(image, basePath);
  const imageUrl = image.startsWith('http') ? image : `${siteUrl}${imagePath}`;
  
  const navLinks = renderNavLinks(config.nav || [], basePath);
  const mobileNavLinks = config.nav
    .map((item) => {
      const text = escapeHtml(item.text || '');
      const icon = item.icon ? `<span class="nav-icon">${escapeHtml(item.icon)}</span>` : '';
      return `    <a href="${safeUrl(item.url, basePath)}" class="nav-link">${icon} ${text}</a>`;
    })
    .join('\n');
  const safeBackground = escapeHtml(config.background?.type || 'default');
  const safeTheme = escapeHtml(theme);
  const safeFavicon = config.favicon ? safeUrl(config.favicon, basePath) : withBasePath('/favicon.svg', basePath);
  const themeVars = buildThemeVars(themeConfig);

  return `<!DOCTYPE html>
  <html lang="${escapeHtml(config.language || 'zh-CN')}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(pageTitle)}</title>
  <meta name="description" content="${escapeHtml(pageDescription)}">
  <meta name="author" content="${escapeHtml(config.author)}">
  <meta name="theme-color" content="${colors.primary || '#f472b6'}">
  <meta property="og:title" content="${escapeHtml(pageTitle)}">
  <meta property="og:description" content="${escapeHtml(pageDescription)}">
  <meta property="og:type" content="${escapeHtml(type)}">
  <meta property="og:url" content="${escapeHtml(pageUrl)}">
  <meta property="og:image" content="${escapeHtml(imageUrl)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(pageTitle)}">
  <meta name="twitter:description" content="${escapeHtml(pageDescription)}">
  <meta name="twitter:image" content="${escapeHtml(imageUrl)}">
  <link rel="canonical" href="${escapeHtml(pageUrl)}">
  <link rel="icon" href="${escapeHtml(safeFavicon)}" type="${config.favicon ? 'image/x-icon' : 'image/svg+xml'}">
  <link rel="alternate" type="application/rss+xml" href="${withBasePath('/rss.xml', basePath)}">
  <link rel="stylesheet" href="${withBasePath('/style.css', basePath)}">
  <meta name="referrer" content="strict-origin-when-cross-origin">
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; img-src 'self' https: data:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'self' 'unsafe-inline' https://giscus.app; connect-src 'self' https://api.openai.com https://api.deepseek.com https://api.moonshot.cn https://api.siliconflow.cn; frame-src https://giscus.app;">
${themeVars}
</head>
<body data-theme="${safeTheme}" data-background="${safeBackground}">
  <!-- Particle Background -->
  <canvas id="particle-canvas"></canvas>
  
  <!-- Navigation -->
  <nav class="nav-glass">
    <a href="${withBasePath('/', basePath)}" class="nav-brand">${escapeHtml(config.title)}</a>
    <div class="nav-links">
${navLinks}
    </div>
    <button class="theme-toggle" id="theme-toggle" aria-label="切换主题">
      <span class="theme-icon-light">☀️</span>
      <span class="theme-icon-dark">🌙</span>
    </button>
    <button class="nav-toggle" aria-label="菜单">
      <span></span>
      <span></span>
      <span></span>
    </button>
  </nav>

  <!-- Mobile Navigation -->
  <div class="nav-mobile">
${mobileNavLinks}
  </div>

  <!-- Main Content -->
  <main class="main-container">
    ${toc ? `<aside class="toc-glass">${toc}</aside>` : ''}
    <div class="content-wrapper">
${content}
    </div>
  </main>

  <!-- Footer -->
  <footer class="footer-glass">
    <div class="footer-content">
      <p>&copy; ${new Date().getFullYear()} ${escapeHtml(config.author || '')}</p>
      <p class="footer-callsign">${escapeHtml(config.callsign || '')}</p>
    </div>
  </footer>

  <!-- Back to Top -->
  <button class="back-to-top" id="back-to-top" aria-label="返回顶部">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M18 15l-6-6-6 6"/>
    </svg>
  </button>

  <script src="${withBasePath('/script.js', basePath)}" defer></script>
</body>
</html>`;
}
