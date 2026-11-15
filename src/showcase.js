/*
hamqsl 对外展示。页面只放挂载点，浏览器再去读公开 JSON。
构建不请求 QSL 站点，站点打不开时页面照样生成。
地址留空就不输出组件，也不会去请求一个编出来的主机。
调用示例：
  const urls = showcaseUrls('https://qsl.example.com/', 8)
  const view = interpretShowcase(404, { code: 'QSL-PLUGIN-OFF' })
  mountShowcases(document)
*/

const RETRY_DELAYS = [60_000, 120_000, 300_000];
const MAX_RETRIES = RETRY_DELAYS.length;
const UPLOAD_PATH = /^\/uploads\/([A-Za-z0-9][A-Za-z0-9._-]{0,180})$/;
const COUNT_FIELDS = [
  ['qso', '通联'],
  ['cards_sent', '已寄出'],
  ['cards_signed', '对方签收'],
  ['cards_received', '收到卡片'],
];

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function readText(value, max) {
  if (typeof value !== 'string' && typeof value !== 'number') return '';
  return String(value)
    .replace(/[\u0000-\u001F\u007F\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, '')
    .trim()
    .slice(0, max);
}

function readCount(value) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) return null;
  return value;
}

export function showcaseOrigin(siteUrl) {
  const raw = String(siteUrl ?? '').trim();
  if (!raw) return '';
  let url;
  try {
    url = new URL(raw);
  } catch {
    return '';
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
  if (url.username || url.password) return '';
  if (!url.hostname) return '';
  const origin = url.origin;
  if (!/^https?:\/\/[^\s;]+$/.test(origin)) return '';
  return origin;
}

export function showcaseLimit(limit) {
  const value = Number(limit);
  if (!Number.isInteger(value) || value < 1 || value > 20) return 8;
  return value;
}

export function showcaseUrls(siteUrl, limit = 8) {
  const origin = showcaseOrigin(siteUrl);
  if (!origin) return null;
  const capped = showcaseLimit(limit);
  return {
    origin,
    limit: capped,
    feed: `${origin}/api/public/ext/showcase?limit=${capped}`,
    badge: `${origin}/api/public/ext/showcase/badge.svg`,
    page: `${origin}/showcase`,
  };
}

export function cardImageUrl(origin, imagePath) {
  const base = showcaseOrigin(origin);
  if (!base) return '';
  const path = String(imagePath ?? '').trim();
  const match = UPLOAD_PATH.exec(path);
  if (!match || match[1].includes('..')) return '';
  return `${base}${path}`;
}

export function sanitizeShowcase(data) {
  const source = data && typeof data === 'object' ? data : {};
  const stationSrc = source.station && typeof source.station === 'object' ? source.station : {};
  const countsSrc = source.counts && typeof source.counts === 'object' ? source.counts : {};
  const counts = {};
  for (const [key] of COUNT_FIELDS) {
    const value = readCount(countsSrc[key]);
    if (value != null) counts[key] = value;
  }

  const recent = Array.isArray(source.recent)
    ? source.recent.slice(0, 20).map((row) => {
      const item = row && typeof row === 'object' ? row : {};
      return {
        call_sign: readText(item.call_sign, 32),
        date: readText(item.date, 32),
        time: readText(item.time, 16),
        band: readText(item.band, 16),
        mode: readText(item.mode, 16),
        freq: readText(item.freq, 24),
        rst_sent: readText(item.rst_sent, 8),
        rst_rcvd: readText(item.rst_rcvd, 8),
      };
    }).filter((row) => Object.values(row).some(Boolean))
    : [];

  const cards = [];
  if (Array.isArray(source.cards)) {
    for (const card of source.cards.slice(0, 24)) {
      const item = card && typeof card === 'object' ? card : {};
      const imagePath = typeof item.image_path === 'string' ? item.image_path.trim() : '';
      const cardVersion = readText(item.card_version, 80);
      if (!imagePath && !cardVersion) continue;
      cards.push({ card_version: cardVersion, image_path: imagePath });
    }
  }

  return {
    station: {
      call_sign: readText(stationSrc.call_sign, 32),
      name: readText(stationSrc.name, 80),
      name_en: readText(stationSrc.name_en, 80),
    },
    counts,
    recent,
    cards,
  };
}

export function interpretShowcase(status, body) {
  const code = body && typeof body === 'object' ? readText(body.code, 40) : '';
  if (code === 'QSL-PLUGIN-OFF' || status === 404) {
    return { state: 'off', retry: false };
  }
  if (status === 200 && code === 'QSL-0000' && body && typeof body.data === 'object' && body.data) {
    return { state: 'ready', retry: false, data: sanitizeShowcase(body.data) };
  }
  const retry = status === 429 || status === 408 || status >= 500 || status === 0;
  return { state: 'error', retry };
}

export function retryDelayMs(response, attempt = 0, now = Date.now()) {
  const fallback = RETRY_DELAYS[Math.min(Math.max(attempt, 0), RETRY_DELAYS.length - 1)];
  let hinted = 0;
  const header = response?.headers?.get?.('retry-after');
  if (typeof header === 'string' && header.trim()) {
    const seconds = Number(header);
    if (Number.isFinite(seconds) && seconds >= 0) {
      hinted = seconds * 1000;
    } else {
      const when = Date.parse(header);
      if (!Number.isNaN(when)) hinted = when - now;
    }
  }
  return Math.min(Math.max(60_000, hinted, fallback), 10 * 60_000);
}

function pageLink(urls, label) {
  if (!urls?.page) return '';
  return `<a href="${escapeHtml(urls.page)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`;
}

function countsHtml(counts) {
  const cells = COUNT_FIELDS.map(([key, label]) => {
    const value = counts?.[key];
    if (value == null) return '';
    return `<div class="qsl-showcase-count"><strong>${value}</strong><span>${escapeHtml(label)}</span></div>`;
  }).join('');
  return cells ? `<div class="qsl-showcase-counts">${cells}</div>` : '';
}

function rstCell(row) {
  if (!row.rst_sent && !row.rst_rcvd) return '';
  return `${escapeHtml(row.rst_sent)}/${escapeHtml(row.rst_rcvd)}`;
}

function recentHtml(recent) {
  if (!recent.length) return '<p class="qsl-showcase-note">最近没有公开通联。</p>';
  const rows = recent.map((row) => `
        <tr>
          <td>${escapeHtml(row.call_sign)}</td>
          <td>${escapeHtml(row.date)}</td>
          <td>${escapeHtml(row.time)}</td>
          <td>${escapeHtml(row.band)}</td>
          <td>${escapeHtml(row.mode)}</td>
          <td>${escapeHtml(row.freq)}</td>
          <td>${rstCell(row)}</td>
        </tr>`).join('');
  return `
      <div class="qsl-showcase-log-wrap">
        <table class="qsl-showcase-log">
          <thead>
            <tr>
              <th scope="col">呼号</th>
              <th scope="col">日期</th>
              <th scope="col">时间</th>
              <th scope="col">波段</th>
              <th scope="col">模式</th>
              <th scope="col">频率</th>
              <th scope="col">RST</th>
            </tr>
          </thead>
          <tbody>${rows}
          </tbody>
        </table>
      </div>`;
}

function cardsHtml(cards, origin) {
  const figures = cards.map((card) => {
    const src = cardImageUrl(origin, card.image_path);
    const caption = card.card_version
      ? `<figcaption>${escapeHtml(card.card_version)}</figcaption>`
      : '';
    if (!src) {
      return card.card_version ? `<figure class="qsl-showcase-card">${caption}</figure>` : '';
    }
    return `
        <figure class="qsl-showcase-card">
          <a href="${escapeHtml(src)}" target="_blank" rel="noopener noreferrer">
            <img src="${escapeHtml(src)}" alt="${escapeHtml(card.card_version || 'QSL 卡片')}" loading="lazy" decoding="async">
          </a>
          ${caption}
        </figure>`;
  }).join('');
  return figures ? `<div class="qsl-showcase-cards">${figures}</div>` : '';
}

export function renderShowcaseBody(result, urls, variant = 'about') {
  if (!result || result.state === 'off') {
    return '<p class="qsl-showcase-note">对外展示未开启。</p>';
  }
  if (result.state !== 'ready' || !urls) {
    return `<p class="qsl-showcase-note">QSL 展示暂时读不到。${pageLink(urls, '打开 QSL 站')}</p>`;
  }

  const data = result.data || {};
  const station = data.station || {};
  const call = station.call_sign || '';
  const name = station.name || station.name_en || '';
  const badge = `
      <a class="qsl-showcase-badge" href="${escapeHtml(urls.page)}" target="_blank" rel="noopener noreferrer">
        <img src="${escapeHtml(urls.badge)}" width="480" height="132" alt="${escapeHtml(call ? `${call} 的 QSL 展示` : 'QSL 展示')}">
      </a>`;
  const nameHtml = name ? `<p class="qsl-showcase-station">${escapeHtml(name)}</p>` : '';
  const counts = countsHtml(data.counts);
  if (variant === 'home') {
    return `${badge}${nameHtml}${counts}<p class="qsl-showcase-note">${pageLink(urls, '查看展示页')}</p>`;
  }

  const cards = cardsHtml(data.cards || [], urls.origin);
  return `${badge}${nameHtml}${counts}
      <h3>最近通联</h3>
      ${recentHtml(data.recent || [])}
      ${cards ? `<h3>卡片</h3>${cards}` : ''}
      <p class="qsl-showcase-note">这些数字来自 QSL 站点，不是本站的通联日志。${pageLink(urls, '打开展示页')}</p>`;
}

export function renderShowcaseWidget(config, { variant = 'about' } = {}) {
  const block = config?.qslShowcase;
  const urls = showcaseUrls(block?.siteUrl, block?.limit);
  if (!urls) return '';
  const kind = variant === 'home' ? 'home' : 'about';
  const title = kind === 'home' ? 'QSL 展示' : 'QSL 卡对外展示';
  const hidden = kind === 'home' ? ' hidden' : '';
  return `
    <section class="qsl-showcase qsl-showcase-${kind} card-glass"${hidden} data-qsl-showcase data-site="${escapeHtml(urls.origin)}" data-limit="${urls.limit}" data-variant="${kind}" aria-label="${escapeHtml(title)}">
      <div class="qsl-showcase-head">
        <p class="eyebrow">LIVE QSL</p>
        <h2>${escapeHtml(title)}</h2>
      </div>
      <div data-qsl-body aria-live="polite">
        <p class="qsl-showcase-note">正在读取 QSL 展示…</p>
      </div>
      <noscript>
        <p class="qsl-showcase-note">${pageLink(urls, '打开 QSL 展示页')}</p>
      </noscript>
    </section>`;
}

function paintShowcase(section, body, result, urls) {
  const variant = section.getAttribute('data-variant') === 'home' ? 'home' : 'about';
  const hide = variant === 'home' && result?.state !== 'ready';
  section.hidden = hide;
  body.innerHTML = hide ? '' : renderShowcaseBody(result, urls, variant);
  if (typeof section.setAttribute === 'function') {
    section.setAttribute('aria-busy', 'false');
  }
}

export async function refreshShowcase(section, options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const schedule = options.schedule || ((fn, ms) => setTimeout(fn, ms));
  const urls = showcaseUrls(section.getAttribute('data-site'), section.getAttribute('data-limit'));
  const body = section.querySelector('[data-qsl-body]');
  if (!urls || !body) return;

  if (typeof section.setAttribute === 'function') {
    section.setAttribute('aria-busy', 'true');
  }

  let attempt = 0;
  let generation = 0;

  async function run() {
    const ticket = ++generation;
    let response = null;
    try {
      response = await fetchImpl(urls.feed, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        credentials: 'omit',
      });
    } catch {
      if (ticket !== generation) return;
      paintShowcase(section, body, { state: 'error', retry: true }, urls);
      arm(null);
      return;
    }

    if (ticket !== generation) return;
    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    const result = interpretShowcase(response.status, payload);
    paintShowcase(section, body, result, urls);
    if (result.retry) arm(response);
  }

  function arm(response) {
    if (attempt >= MAX_RETRIES) return;
    const delay = retryDelayMs(response, attempt);
    attempt += 1;
    schedule(() => { void run(); }, delay);
  }

  await run();
}

export function mountShowcases(doc, options = {}) {
  const nodes = doc.querySelectorAll?.('[data-qsl-showcase]') || [];
  for (const node of nodes) {
    if (node.getAttribute('data-qsl-mounted') === '1') continue;
    if (typeof node.setAttribute === 'function') node.setAttribute('data-qsl-mounted', '1');
    void refreshShowcase(node, options);
  }
}

export function showcaseClientSource(assetVersion = '') {
  const query = assetVersion ? `?v=${encodeURIComponent(assetVersion)}` : '';
  return `import { mountShowcases } from './showcase.js${query}';\nmountShowcases(document);\n`;
}
