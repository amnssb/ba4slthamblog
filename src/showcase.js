/*
hamqsl 对外展示。页面只放挂载点，浏览器再去读公开 JSON。
构建不请求 QSL 站点，站点打不开时页面照样生成。
地址留空就不输出组件，也不会去请求一个编出来的主机。
卡片图打不开时用主题渐变占位。最近动态为空就不渲染那一块。
呼号为空时用博客配置。线上换卡页是站点的 /apply。
库存字段在卡片对象里有才显示；公开的 station-cards 接口目前没有跨域头，页面不去请求它。
调用示例：
  const urls = showcaseUrls('https://qsl.example.com/', 8)
  const view = interpretShowcase(404, { code: 'QSL-PLUGIN-OFF' })
  mountShowcases(document)
*/

const RETRY_DELAYS = [60_000, 120_000, 300_000];
const MAX_RETRIES = RETRY_DELAYS.length;
const FETCH_TIMEOUT_MS = 8_000;
const GUARD_DELAY_MS = 9_000;
const GRID_FALLBACK = 'OM93nn';
const UPLOAD_PATH = /^\/uploads\/([A-Za-z0-9][A-Za-z0-9._-]{0,180})$/;
const COUNT_KEYS = ['cards_sent', 'cards_signed', 'cards_received', 'qso'];

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
    apply: `${origin}/apply`,
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
  for (const key of COUNT_KEYS) {
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
        status: readText(item.status, 24),
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
      const next = { card_version: cardVersion, image_path: imagePath };
      const available = readCount(item.available_inventory ?? item.available);
      const total = readCount(item.version_total ?? item.total);
      if (available != null) next.available = available;
      if (total != null) next.total = total;
      cards.push(next);
    }
  }

  return {
    station: {
      call_sign: readText(stationSrc.call_sign, 32),
      name: readText(stationSrc.name, 80),
      name_en: readText(stationSrc.name_en, 80),
      grid: readText(stationSrc.grid || stationSrc.grid_square || stationSrc.locator || stationSrc.maidenhead, 16),
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

function isEnglish(lang) {
  return /^en\b/i.test(String(lang || ''));
}

function copyFor(lang) {
  if (isEnglish(lang)) {
    return {
      title: 'QSL cards',
      apply: 'Request a card →',
      call: (call, grid) => `${call} · ${grid}`,
      sent: 'Sent',
      signed: 'Signed',
      received: 'Received',
      qso: 'QSO',
      recent: 'Recent',
      stock: (available, total) => (total == null ? `${available} left` : `${available} / ${total} left`),
      fail: 'QSL showcase is unavailable',
      off: 'Public showcase is off',
      go: (host) => `Open ${host}`,
      alt: (call, name) => `${call} QSL card: ${name}`,
      loading: 'Loading QSL showcase',
      thumb: (name) => `Show card ${name}`,
      justNow: 'just now',
      minutes: (n) => `${n} min ago`,
      hours: (n) => `${n} hr ago`,
      days: (n) => `${n} days ago`,
    };
  }
  return {
    title: 'QSL 卡片',
    apply: '申请换卡 →',
    call: (call, grid) => `呼号 ${call} · ${grid}`,
    sent: '已发出',
    signed: '已签收',
    received: '已收到',
    qso: 'QSO',
    recent: '最近动态',
    stock: (available, total) => (total == null ? `余 ${available}` : `余 ${available} / ${total}`),
    fail: 'QSL 展示暂时无法加载',
    off: '对外展示未开启',
    go: (host) => `前往 ${host}`,
    alt: (call, name) => `${call} QSL 卡面：${name}`,
    loading: '正在读取 QSL 展示',
    thumb: (name) => `切换到卡面 ${name}`,
    justNow: '刚刚',
    minutes: (n) => `${n} 分钟前`,
    hours: (n) => `${n} 小时前`,
    days: (n) => `${n} 天前`,
  };
}

const MARK = `<svg class="qsl-showcase-mark" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><g fill="currentColor"><circle cx="12" cy="5" r="2.6"/><circle cx="17.6" cy="9.2" r="2.6"/><circle cx="15.5" cy="15.8" r="2.6"/><circle cx="8.5" cy="15.8" r="2.6"/><circle cx="6.4" cy="9.2" r="2.6"/><circle cx="12" cy="11.2" r="1.7"/></g></svg>`;

function hostName(urls) {
  return String(urls?.origin || '').replace(/^https?:\/\//, '');
}

function externalLink(href, label) {
  if (!href) return '';
  return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`;
}

function stockText(copy, card) {
  if (!card || card.available == null) return '';
  return copy.stock(card.available, card.total ?? null);
}

function stationCall(station, fallbackCall) {
  return station?.call_sign || fallbackCall || '';
}

function stationGrid(station) {
  return station?.grid || GRID_FALLBACK;
}

function relativeTime(date, time, copy, now = Date.now()) {
  if (!date) return '';
  const stamp = Date.parse(`${date}T${time || '00:00'}:00+08:00`);
  if (Number.isNaN(stamp)) return date;
  const minutes = Math.round((now - stamp) / 60_000);
  if (minutes < 0) return date;
  if (minutes < 1) return copy.justNow;
  if (minutes < 60) return copy.minutes(minutes);
  const hours = Math.round(minutes / 60);
  if (hours < 24) return copy.hours(hours);
  const days = Math.round(hours / 24);
  if (days < 30) return copy.days(days);
  return date;
}

function statusText(row) {
  return row.status || row.mode || row.band || '';
}

function heroHtml(card, copy, call, origin) {
  const name = card?.card_version || '';
  const src = card ? cardImageUrl(origin, card.image_path) : '';
  const stock = stockText(copy, card);
  const alt = copy.alt(call || 'QSL', name || 'QSL');
  const photo = src
    ? `<img class="qsl-showcase-photo" data-qsl-hero src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" width="1080" height="720" loading="lazy" decoding="async">`
    : '';
  const overlay = name || stock
    ? `<p class="qsl-showcase-overlay"><span data-qsl-name>${escapeHtml(name)}</span>${stock ? `<span data-qsl-stock>${escapeHtml(stock)}</span>` : '<span data-qsl-stock hidden></span>'}</p>`
    : '<p class="qsl-showcase-overlay" hidden><span data-qsl-name></span><span data-qsl-stock hidden></span></p>';
  const readyClass = src ? '' : ' is-fallback';
  return `<div class="qsl-showcase-hero${readyClass}">
      ${photo}
      <div class="qsl-showcase-placeholder" aria-hidden="true"><strong>${escapeHtml(call || 'QSL')}</strong><span>QSL</span></div>
      ${overlay}
    </div>`;
}

function thumbsHtml(cards, copy, call, origin) {
  if (!cards || cards.length < 2) return '';
  const buttons = cards.map((card, index) => {
    const name = card.card_version || 'QSL';
    const src = cardImageUrl(origin, card.image_path);
    const stock = stockText(copy, card);
    const alt = copy.alt(call || 'QSL', name);
    const image = src
      ? `<img src="${escapeHtml(src)}" alt="" width="96" height="64" loading="lazy" decoding="async">`
      : `<span>${escapeHtml(name)}</span>`;
    return `<button type="button" class="qsl-showcase-thumb${index === 0 ? ' is-current' : ''}" data-qsl-thumb="${index}" data-src="${escapeHtml(src)}" data-name="${escapeHtml(name)}" data-stock="${escapeHtml(stock)}" data-alt="${escapeHtml(alt)}" aria-pressed="${index === 0 ? 'true' : 'false'}" aria-label="${escapeHtml(copy.thumb(name))}">${image}</button>`;
  }).join('');
  return `<div class="qsl-showcase-thumbs">${buttons}</div>`;
}

function statsHtml(copy, counts) {
  const items = [
    ['cards_sent', copy.sent],
    ['cards_signed', copy.signed],
    ['cards_received', copy.received],
    ['qso', copy.qso],
  ];
  const cells = items.map(([key, label]) => {
    const value = counts?.[key] ?? 0;
    return `<div class="qsl-showcase-stat"><strong data-qsl-count="${value}">${value}</strong><span>${escapeHtml(label)}</span></div>`;
  }).join('');
  return `<div class="qsl-showcase-stats">${cells}</div>`;
}

function activityHtml(copy, recent, now) {
  const rows = (recent || []).slice(0, 3);
  if (!rows.length) return '';
  const items = rows.map((row) => {
    const badge = statusText(row);
    const when = relativeTime(row.date, row.time, copy, now);
    const iso = row.date ? `${row.date}T${row.time || '00:00'}:00+08:00` : '';
    return `<li class="qsl-showcase-activity"><span class="qsl-showcase-activity-call">${escapeHtml(row.call_sign)}</span>${badge ? `<span class="qsl-showcase-chip">${escapeHtml(badge)}</span>` : ''}${when ? `<time datetime="${escapeHtml(iso)}">${escapeHtml(when)}</time>` : ''}</li>`;
  }).join('');
  return `<div class="qsl-showcase-activity-block"><h3>${escapeHtml(copy.recent)}</h3><ul>${items}</ul></div>`;
}

function panelHtml(copy, urls, call, grid, main) {
  const apply = externalLink(urls?.apply, copy.apply);
  return `<div class="qsl-showcase-panel">
      <div class="qsl-showcase-heading"><h2>${MARK}<span>${escapeHtml(copy.title)}</span></h2><p class="qsl-showcase-meta">${escapeHtml(copy.call(call, grid))}</p></div>
      ${apply ? apply.replace('<a ', '<a class="qsl-showcase-apply" ') : ''}
      <div class="qsl-showcase-main">${main}</div>
    </div>`;
}

function loadingHtml(copy, urls, call, grid) {
  const main = `<div class="qsl-showcase-skel-hero"></div><div class="qsl-showcase-skel-stats" aria-hidden="true"><i></i><i></i><i></i><i></i></div>`;
  return `${panelHtml(copy, urls, call, grid, main)}<p class="qsl-showcase-sr">${escapeHtml(copy.loading)}</p>`;
}

function noticeHtml(copy, urls, message) {
  const host = hostName(urls);
  const link = externalLink(urls?.origin, copy.go(host || 'QSL'));
  return `<div class="qsl-showcase-error"><p>${escapeHtml(message)}</p>${link ? `<p>${link}</p>` : ''}</div>`;
}

export function renderShowcaseBody(result, urls, variant = 'about', options = {}) {
  const copy = copyFor(options.lang);
  if (!result || result.state === 'off') return noticeHtml(copy, urls, copy.off);
  if (result.state !== 'ready' || !urls) return noticeHtml(copy, urls, copy.fail);

  const data = result.data || {};
  const station = data.station || {};
  const call = stationCall(station, readText(options.fallbackCall, 32));
  const grid = stationGrid(station);
  const cards = data.cards || [];
  const origin = urls.origin;
  const recent = activityHtml(copy, data.recent, options.now);
  const sideClass = recent ? 'qsl-showcase-side' : 'qsl-showcase-side is-stats-only';
  const main = `<div class="qsl-showcase-stage">${heroHtml(cards[0], copy, call, origin)}${thumbsHtml(cards, copy, call, origin)}</div><div class="${sideClass}">${statsHtml(copy, data.counts)}${recent}</div>`;
  return panelHtml(copy, urls, call, grid, main);
}

function showcaseGuardScript() {
  return `<script data-cfasync="false">
    window.setTimeout(function () {
      var nodes = document.querySelectorAll('[data-qsl-body]');
      for (var i = 0; i < nodes.length; i++) {
        var body = nodes[i];
        if (body.getAttribute('data-qsl-settled') === '1') continue;
        var section = body.closest('[data-qsl-showcase]');
        body.setAttribute('data-qsl-settled', '1');
        if (section && section.getAttribute('data-variant') === 'home') {
          section.setAttribute('hidden', '');
          body.textContent = '';
          continue;
        }
        var en = /^en/i.test(document.documentElement.lang || '');
        var site = section ? (section.getAttribute('data-site') || '') : '';
        var host = site.replace(/^https?:\/\//, '');
        var message = en ? 'QSL showcase is unavailable' : 'QSL 展示暂时无法加载';
        var label = en ? ('Open ' + host) : ('前往 ' + host);
        body.textContent = '';
        var box = document.createElement('div');
        box.className = 'qsl-showcase-error';
        var text = document.createElement('p');
        text.textContent = message;
        box.appendChild(text);
        if (site) {
          var line = document.createElement('p');
          var link = document.createElement('a');
          link.href = site;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          link.textContent = label;
          line.appendChild(link);
          box.appendChild(line);
        }
        body.appendChild(box);
      }
    }, ${GUARD_DELAY_MS});
  </script>`;
}

export function renderShowcaseWidget(config, { variant = 'about' } = {}) {
  const block = config?.qslShowcase;
  const urls = showcaseUrls(block?.siteUrl, block?.limit);
  if (!urls) return '';
  const kind = variant === 'home' ? 'home' : 'about';
  const lang = config.language || 'zh-CN';
  const copy = copyFor(lang);
  const fallbackCall = readText(config.callsign || config.title || '', 32) || 'BA4SLT';
  const body = loadingHtml(copy, urls, fallbackCall, GRID_FALLBACK);
  return `
    <section class="qsl-showcase qsl-showcase-${kind} card-glass" data-qsl-showcase data-site="${escapeHtml(urls.origin)}" data-limit="${urls.limit}" data-variant="${kind}" data-callsign="${escapeHtml(fallbackCall)}" data-lang="${escapeHtml(lang)}" aria-label="${escapeHtml(copy.title)}">
      <div data-qsl-body aria-live="polite" aria-busy="true">
        ${body}
      </div>
      <noscript>
        <style>.qsl-showcase [data-qsl-body]{display:none}</style>
        <p class="qsl-showcase-note">${externalLink(urls.apply, copy.apply)}</p>
      </noscript>
    </section>
    ${showcaseGuardScript()}`;
}

function markSettled(body) {
  if (typeof body?.setAttribute === 'function') body.setAttribute('data-qsl-settled', '1');
}

function markHero(img) {
  const hero = img?.closest?.('.qsl-showcase-hero');
  if (!hero?.classList) return;
  const ok = img.naturalWidth > 0;
  hero.classList.toggle('is-ready', ok);
  hero.classList.toggle('is-fallback', !ok);
}

function bindHero(root) {
  const img = root.querySelector('[data-qsl-hero]');
  if (!img) return;
  if (img.complete) markHero(img);
  else {
    img.addEventListener('load', () => markHero(img), { once: true });
    img.addEventListener('error', () => markHero(img), { once: true });
  }
}

function selectCard(root, button) {
  const stage = button.closest('.qsl-showcase-stage') || root;
  const hero = stage.querySelector('.qsl-showcase-hero');
  const img = stage.querySelector('[data-qsl-hero]');
  stage.querySelectorAll('[data-qsl-thumb]').forEach((el) => {
    const current = el === button;
    el.classList.toggle('is-current', current);
    el.setAttribute('aria-pressed', current ? 'true' : 'false');
  });
  const name = stage.querySelector('[data-qsl-name]');
  const stock = stage.querySelector('[data-qsl-stock]');
  if (name) name.textContent = button.getAttribute('data-name') || '';
  if (stock) {
    const text = button.getAttribute('data-stock') || '';
    stock.hidden = !text;
    stock.textContent = text;
  }
  const overlay = stage.querySelector('.qsl-showcase-overlay');
  if (overlay) overlay.hidden = !(button.getAttribute('data-name') || button.getAttribute('data-stock'));
  if (!hero) return;
  const src = button.getAttribute('data-src') || '';
  if (!src) {
    hero.classList.add('is-fallback');
    hero.classList.remove('is-ready');
    if (img) img.removeAttribute('src');
    return;
  }
  if (!img) return;
  hero.classList.remove('is-ready', 'is-fallback');
  img.alt = button.getAttribute('data-alt') || '';
  img.src = src;
  if (img.complete) markHero(img);
  else {
    img.addEventListener('load', () => markHero(img), { once: true });
    img.addEventListener('error', () => markHero(img), { once: true });
  }
}

function animateCounts(root) {
  if (typeof root.querySelectorAll !== 'function') return;
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const frame = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : null;
  root.querySelectorAll('[data-qsl-count]').forEach((el) => {
    const target = Number(el.getAttribute('data-qsl-count'));
    if (!Number.isFinite(target) || reduce || !frame) {
      el.textContent = String(target);
      return;
    }
    const start = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
    const clock = typeof performance !== 'undefined' && performance.now ? () => performance.now() : () => Date.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / 700);
      el.textContent = String(Math.round(target * (1 - (1 - t) ** 3)));
      if (t < 1) frame(tick);
    };
    frame(tick);
  });
}

function bindShowcaseMedia(root) {
  if (typeof root?.querySelectorAll !== 'function') return;
  bindHero(root);
  root.querySelectorAll('[data-qsl-thumb]').forEach((button) => {
    button.addEventListener('click', () => selectCard(root, button));
  });
  animateCounts(root);
}

function paintShowcase(section, body, result, urls) {
  const variant = section.getAttribute('data-variant') === 'home' ? 'home' : 'about';
  const failed = !result || result.state !== 'ready';
  const hide = variant === 'home' && failed;
  section.hidden = hide;
  markSettled(body);
  body.innerHTML = hide ? '' : renderShowcaseBody(result, urls, variant, {
    fallbackCall: section.getAttribute('data-callsign') || '',
    lang: section.getAttribute('data-lang') || '',
  });
  if (!hide) bindShowcaseMedia(body);
  if (typeof section.setAttribute === 'function') section.setAttribute('aria-busy', 'false');
  if (typeof body.setAttribute === 'function') body.setAttribute('aria-busy', 'false');
}

export async function refreshShowcase(section, options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const schedule = options.schedule || ((fn, ms) => setTimeout(fn, ms));
  const urls = showcaseUrls(section.getAttribute('data-site'), section.getAttribute('data-limit'));
  const body = section.querySelector('[data-qsl-body]');
  if (!urls || !body) return;

  if (typeof section.setAttribute === 'function') section.setAttribute('aria-busy', 'true');

  let attempt = 0;
  let generation = 0;

  async function run() {
    const ticket = ++generation;
    let response = null;
    let timer = null;
    try {
      const controller = typeof AbortController === 'function' ? new AbortController() : null;
      if (controller) timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      response = await fetchImpl(urls.feed, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        credentials: 'omit',
        ...(controller ? { signal: controller.signal } : {}),
      });
    } catch {
      if (timer) clearTimeout(timer);
      if (ticket !== generation) return;
      paintShowcase(section, body, { state: 'error', retry: true }, urls);
      arm(null);
      return;
    }
    if (timer) clearTimeout(timer);

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
