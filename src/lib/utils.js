export function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fff]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

export function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function truncate(str, len = 160) {
  if (str.length <= len) return str;
  return str.slice(0, len) + '...';
}

export function getTagFromCategory(category) {
  return category || 'default';
}

export function normalizeBasePath(basePath = '') {
  if (!basePath || basePath === '/') return '';
  const normalized = `/${String(basePath).replace(/^\/+|\/+$/g, '')}`;
  return normalized === '/' ? '' : normalized;
}

export function withBasePath(path = '/', basePath = '') {
  if (!path) return normalizeBasePath(basePath) || '/';
  if (/^(https?:)?\/\//.test(path) || path.startsWith('#') || path.startsWith('mailto:')) {
    return path;
  }

  const normalizedBase = normalizeBasePath(basePath);
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}` || '/';
}
