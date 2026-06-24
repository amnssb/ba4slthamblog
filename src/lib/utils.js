export function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fff]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function formatDate(dateStr) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return String(dateStr ?? '');
  return d.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

export function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function truncate(str, len = 160) {
  const value = String(str ?? '');
  if (value.length <= len) return value;
  return value.slice(0, len) + '...';
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

export function safeUrl(path = '/', basePath = '') {
  const value = String(path ?? '').trim();
  const resolved = withBasePath(value, basePath);

  if (
    /^https?:\/\//i.test(resolved) ||
    resolved.startsWith('//') ||
    resolved.startsWith('/') ||
    resolved.startsWith('#') ||
    resolved.startsWith('mailto:') ||
    resolved.startsWith('tel:')
  ) {
    return resolved;
  }

  return normalizeBasePath(basePath) || '/';
}

export function serializeJsonForScript(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003C')
    .replace(/>/g, '\\u003E')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}
