import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { escapeHtml, safeUrl, withBasePath } from '../lib/utils.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../..');
const themeCache = new Map();

function loadTheme(theme) {
  if (themeCache.has(theme)) return themeCache.get(theme);

  const themePath = join(ROOT, 'themes', theme, 'theme.json');
  let themeConfig = {};
  try {
    themeConfig = JSON.parse(readFileSync(themePath, 'utf-8'));
  } catch (error) {
    console.warn(`Theme "${theme}" could not be loaded: ${error.message}`);
  }
  themeCache.set(theme, themeConfig);
  return themeConfig;
}

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

function normalizePath(path = '/') {
  const value = String(path).split(/[?#]/, 1)[0] || '/';
  return value !== '/' ? `${value.replace(/\/+$/, '')}/` : '/';
}

function isCurrentNavItem(itemUrl, pathname) {
  if (!itemUrl || /^(?:https?:)?\/\//i.test(itemUrl)) return false;
  const target = normalizePath(itemUrl);
  const current = normalizePath(pathname);
  return target === '/' ? current === '/' : current === target || current.startsWith(target);
}

function renderNavLinks(items, basePath, pathname) {
  return items
    .map((item) => {
      const text = escapeHtml(item.text || '');
      const icon = item.icon ? `<span class="nav-icon">${escapeHtml(item.icon)}</span>` : '';
      const current = isCurrentNavItem(item.url, pathname);
      return `          <a href="${safeUrl(item.url, basePath)}" class="nav-link${current ? ' is-current' : ''}"${current ? ' aria-current="page"' : ''}>${icon} ${text}</a>`;
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
  
  const themeConfig = loadTheme(theme);
  
  const colors = themeConfig.colors || {};
  const basePath = config.__basePath || '';
  const assetVersion = config.__assetVersion ? `?v=${encodeURIComponent(config.__assetVersion)}` : '';
  const assetUrl = (path) => `${withBasePath(path, basePath)}${assetVersion}`;
  const pageDescription = description || config.description;
  const siteUrl = (config.url || '').replace(/\/$/, '');
  const pagePath = withBasePath(pathname, basePath);
  const pageUrl = siteUrl ? `${siteUrl}${pagePath}` : pagePath;
  const imagePath = withBasePath(image, basePath);
  const imageUrl = image.startsWith('http') ? image : `${siteUrl}${imagePath}`;
  
  const navItems = config.nav || [];
  const navLinks = renderNavLinks(navItems, basePath, pathname);
  const searchEnabled = config.features?.search?.enabled !== false;
  const pwaEnabled = config.features?.pwa?.enabled !== false;
  const mobileNavLinks = renderNavLinks(navItems, basePath, pathname);
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
  <meta name="color-scheme" content="light dark">
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
  <link rel="icon" href="${escapeHtml(safeFavicon)}">
  ${pwaEnabled ? `<link rel="manifest" href="${assetUrl('/manifest.json')}">` : ''}
  <link rel="alternate" type="application/rss+xml" href="${withBasePath('/rss.xml', basePath)}">
  <link rel="stylesheet" href="${assetUrl('/style.css')}">
  <meta name="referrer" content="strict-origin-when-cross-origin">
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; img-src 'self' https: data:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'self' 'unsafe-inline' https://giscus.app; connect-src 'self' https://api.openai.com https://api.deepseek.com https://api.moonshot.cn https://api.siliconflow.cn; frame-src https://giscus.app;">
${themeVars}
  <script>
    try {
      const savedTheme = localStorage.getItem('theme');
      const useDarkTheme = savedTheme === 'dark' || (!savedTheme && matchMedia('(prefers-color-scheme: dark)').matches);
      document.documentElement.classList.toggle('dark-mode', useDarkTheme);
    } catch {}
  </script>
</head>
<body data-theme="${safeTheme}" data-background="${safeBackground}" data-search-index="${assetUrl('/search-index.json')}" data-service-worker="${assetUrl('/service-worker.js')}" data-pwa="${pwaEnabled}" data-base-path="${escapeHtml(basePath)}">
  <!-- Particle Background -->
  <canvas id="particle-canvas"></canvas>
  
  <!-- Navigation -->
  <nav class="nav-glass">
    <a href="${withBasePath('/', basePath)}" class="nav-brand">${escapeHtml(config.title)}</a>
    <div class="nav-links">
${navLinks}
    </div>
    ${searchEnabled ? '<button class="search-toggle" id="search-toggle" type="button" aria-label="搜索" aria-haspopup="dialog" aria-controls="site-search">⌕</button>' : ''}
    <button class="theme-toggle" id="theme-toggle" type="button" aria-label="切换主题" aria-pressed="false">
      <span class="theme-icon-light">☀️</span>
      <span class="theme-icon-dark">🌙</span>
    </button>
    <button class="nav-toggle" type="button" aria-label="菜单" aria-expanded="false" aria-controls="mobile-navigation">
      <span></span>
      <span></span>
      <span></span>
    </button>
  </nav>

  <!-- Mobile Navigation -->
  <div class="nav-mobile" id="mobile-navigation">
${mobileNavLinks}
  </div>

  ${searchEnabled ? `
  <dialog class="search-dialog" id="site-search">
    <form method="dialog" class="search-dialog-header">
      <label for="site-search-input">搜索文章和日志</label>
      <button type="submit" aria-label="关闭搜索">×</button>
    </form>
    <input id="site-search-input" type="search" autocomplete="off" placeholder="输入标题、标签或关键词">
    <div class="search-results" id="site-search-results" role="listbox" aria-live="polite"></div>
  </dialog>` : ''}

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

  <script src="${assetUrl('/script.js')}" defer></script>
</body>
</html>`;
}
