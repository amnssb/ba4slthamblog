import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { escapeHtml, withBasePath } from '../lib/utils.js';

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
  
  const navLinks = config.nav
    .map(item => `          <a href="${withBasePath(item.url, basePath)}" class="nav-link">${item.icon || ''} ${item.text}</a>`)
    .join('\n');

  const mobileNavLinks = config.nav
    .map(item => `    <a href="${withBasePath(item.url, basePath)}" class="nav-link">${item.icon || ''} ${item.text}</a>`)
    .join('\n');

  return `<!DOCTYPE html>
<html lang="${config.language}">
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
  ${config.favicon ? `<link rel="icon" href="${escapeHtml(config.favicon)}" type="image/x-icon">` : `<link rel="icon" href="${withBasePath('/favicon.svg', basePath)}" type="image/svg+xml">`}
  <link rel="alternate" type="application/rss+xml" href="${withBasePath('/rss.xml', basePath)}">
  <link rel="stylesheet" href="${withBasePath('/style.css', basePath)}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
${buildThemeVars(themeConfig)}
</head>
<body data-theme="${theme}" data-background="${config.background?.type || 'default'}">
  <!-- Particle Background -->
  <canvas id="particle-canvas"></canvas>
  
  <!-- Navigation -->
  <nav class="nav-glass">
    <a href="${withBasePath('/', basePath)}" class="nav-brand">${config.title}</a>
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
      <p>&copy; ${new Date().getFullYear()} ${config.author}</p>
      <p class="footer-callsign">${config.callsign || ''}</p>
    </div>
  </footer>

  <!-- Back to Top -->
  <button class="back-to-top" id="back-to-top" aria-label="返回顶部">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M18 15l-6-6-6 6"/>
    </svg>
  </button>

  <script src="${withBasePath('/script.js', basePath)}"></script>
</body>
</html>`;
}
