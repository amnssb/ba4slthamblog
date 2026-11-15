import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeConfig } from '../src/config.js';
import {
  cardImageUrl,
  interpretShowcase,
  refreshShowcase,
  renderShowcaseBody,
  renderShowcaseWidget,
  retryDelayMs,
  showcaseClientSource,
  showcaseOrigin,
  showcaseUrls,
} from '../src/showcase.js';

const readyPayload = {
  code: 'QSL-0000',
  message: '成功',
  data: {
    station: {
      call_sign: '<img src=x onerror=alert(1)>',
      name: 'A&B',
      name_en: 'Demo',
      email: 'secret@example.com',
      address: 'secret road',
    },
    counts: { qso: 2, cards_sent: 1, cards_signed: 0, cards_received: 3 },
    recent: [{
      call_sign: '<script>alert(1)</script>',
      date: '2026-11-10',
      time: '08:15',
      band: '40m',
      mode: 'FT8',
      freq: '7.074',
      rst_sent: '-10',
      rst_rcvd: '-08',
      email: 'secret@example.com',
      remarks: 'private note',
    }],
    cards: [{
      card_version: '<b>bad</b>',
      image_path: '/uploads/ab12.png',
      address: 'secret road',
    }],
  },
};

function fakeSection(variant = 'about') {
  const body = { innerHTML: 'loading' };
  const attrs = {
    'data-site': 'https://qsl.ba4slt.cn/',
    'data-limit': '8',
    'data-variant': variant,
  };
  return {
    hidden: variant === 'home',
    body,
    getAttribute(name) { return attrs[name] ?? null; },
    setAttribute(name, value) { attrs[name] = value; },
    querySelector(selector) { return selector === '[data-qsl-body]' ? body : null; },
  };
}

function jsonResponse(status, payload, headers = {}) {
  return {
    status,
    headers: { get: (name) => headers[String(name).toLowerCase()] ?? null },
    json: async () => payload,
  };
}

test('showcase URLs use the site origin and a clamped limit', () => {
  const urls = showcaseUrls('https://qsl.ba4slt.cn/showcase/', 99);
  assert.equal(urls.origin, 'https://qsl.ba4slt.cn');
  assert.equal(urls.limit, 8);
  assert.equal(urls.feed, 'https://qsl.ba4slt.cn/api/public/ext/showcase?limit=8');
  assert.equal(urls.badge, 'https://qsl.ba4slt.cn/api/public/ext/showcase/badge.svg');
  assert.equal(urls.page, 'https://qsl.ba4slt.cn/showcase');
  assert.equal(showcaseUrls('https://qsl.example.com', 3).feed, 'https://qsl.example.com/api/public/ext/showcase?limit=3');
  assert.equal(showcaseUrls('https://user:pass@qsl.example.com'), null);
  assert.equal(showcaseOrigin(''), '');
  assert.equal(showcaseOrigin('javascript:alert(1)'), '');
});

test('card images are prefixed only for a single uploads filename', () => {
  const origin = 'https://qsl.ba4slt.cn';
  assert.equal(cardImageUrl(origin, '/uploads/ab12cd34.png'), 'https://qsl.ba4slt.cn/uploads/ab12cd34.png');
  assert.equal(cardImageUrl(`${origin}/`, ' /uploads/card.webp '), 'https://qsl.ba4slt.cn/uploads/card.webp');
  assert.equal(cardImageUrl(origin, ''), '');
  assert.equal(cardImageUrl(origin, '/uploads/sub/a.png'), '');
  assert.equal(cardImageUrl(origin, '/uploads/../secret.png'), '');
  assert.equal(cardImageUrl(origin, 'https://evil.example/uploads/a.png'), '');
  assert.equal(cardImageUrl(origin, '/uploads/a.png" onerror="alert(1)'), '');
  assert.equal(cardImageUrl('', '/uploads/a.png'), '');
});

test('plugin-off and server failures do not become an empty station', () => {
  const off = interpretShowcase(404, { code: 'QSL-PLUGIN-OFF', message: '插件未启用' });
  assert.deepEqual(off, { state: 'off', retry: false });

  const down = interpretShowcase(503, {
    code: 'QSL-503',
    data: { counts: { qso: 0, cards_sent: 0, cards_signed: 0, cards_received: 0 } },
  });
  assert.equal(down.state, 'error');
  assert.equal(down.retry, true);
  assert.equal(down.data, undefined);
  assert.equal(interpretShowcase(500, { code: 'QSL-500' }).retry, true);
  assert.equal(interpretShowcase(429, { code: 'QSL-429' }).retry, true);

  const urls = showcaseUrls('https://qsl.ba4slt.cn');
  const offHtml = renderShowcaseBody(off, urls, 'about');
  const downHtml = renderShowcaseBody(down, urls, 'about');
  assert.match(offHtml, /对外展示未开启/);
  assert.match(downHtml, /暂时读不到/);
  assert.doesNotMatch(offHtml, /qsl-showcase-count|badge\.svg|iframe/i);
  assert.doesNotMatch(downHtml, /qsl-showcase-count|badge\.svg|iframe/i);
});

test('a live payload escapes text, drops private fields, and prefixes card images', () => {
  const result = interpretShowcase(200, readyPayload);
  assert.equal(result.state, 'ready');
  assert.equal(result.data.counts.cards_signed, 0);
  assert.equal(result.data.station.email, undefined);
  assert.equal(result.data.recent[0].remarks, undefined);
  assert.equal(result.data.cards[0].address, undefined);

  const html = renderShowcaseBody(result, showcaseUrls('https://qsl.ba4slt.cn'), 'about');
  assert.match(html, /https:\/\/qsl\.ba4slt\.cn\/uploads\/ab12\.png/);
  assert.match(html, /https:\/\/qsl\.ba4slt\.cn\/api\/public\/ext\/showcase\/badge\.svg/);
  assert.match(html, /https:\/\/qsl\.ba4slt\.cn\/showcase/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(html, /&lt;b&gt;bad&lt;\/b&gt;/);
  assert.match(html, /A&amp;B/);
  assert.match(html, /src="https:\/\/qsl\.ba4slt\.cn\/uploads\/ab12\.png"/);
  assert.match(html, />0</);
  assert.match(html, /alt="&lt;img src=x onerror=alert\(1\)&gt; 的 QSL 展示"/);
  assert.doesNotMatch(html, /src="\/uploads\/|<script|<b>bad<\/b>|secret@example\.com|secret road/i);
  assert.doesNotMatch(html, /iframe/i);
});

test('an empty showcase URL renders nothing and does not name a host', () => {
  assert.equal(renderShowcaseWidget({}), '');
  assert.equal(renderShowcaseWidget({ qslShowcase: { siteUrl: '   ' } }), '');
  const home = renderShowcaseWidget({ qslShowcase: { siteUrl: 'https://qsl.ba4slt.cn/' } }, { variant: 'home' });
  const about = renderShowcaseWidget({ qslShowcase: { siteUrl: 'https://qsl.ba4slt.cn/' } }, { variant: 'about' });
  assert.match(home, /hidden/);
  assert.match(home, /data-site="https:\/\/qsl\.ba4slt\.cn"/);
  assert.match(home, /data-variant="home"/);
  assert.match(about, /data-variant="about"/);
  assert.doesNotMatch(about, / hidden/);
  assert.doesNotMatch(`${home}${about}`, /iframe|example\.invalid/i);
});

test('404 is not retried and 503 backs off no faster than 60 seconds', async () => {
  const offScheduled = [];
  const offSection = fakeSection('home');
  await refreshShowcase(offSection, {
    fetchImpl: async () => jsonResponse(404, { code: 'QSL-PLUGIN-OFF' }),
    schedule: (fn, ms) => offScheduled.push({ fn, ms }),
  });
  assert.equal(offScheduled.length, 0);
  assert.equal(offSection.hidden, true);
  assert.equal(offSection.body.innerHTML, '');

  const scheduled = [];
  let calls = 0;
  const section = fakeSection('about');
  await refreshShowcase(section, {
    fetchImpl: async () => {
      calls += 1;
      return jsonResponse(503, { code: 'QSL-503' }, { 'retry-after': '1' });
    },
    schedule: (fn, ms) => scheduled.push({ fn, ms }),
  });
  assert.equal(calls, 1);
  assert.equal(scheduled.length, 1);
  assert.ok(scheduled[0].ms >= 60_000);
  assert.match(section.body.innerHTML, /暂时读不到/);
  assert.doesNotMatch(section.body.innerHTML, /qsl-showcase-count/);
  assert.equal(retryDelayMs(jsonResponse(503, {}, { 'retry-after': '120' }), 0), 120_000);

  const home = fakeSection('home');
  await refreshShowcase(home, {
    fetchImpl: async () => jsonResponse(503, { code: 'QSL-503' }),
    schedule: () => {},
  });
  assert.equal(home.hidden, true);
  assert.equal(home.body.innerHTML, '');

  const ready = fakeSection('home');
  await refreshShowcase(ready, {
    fetchImpl: async () => jsonResponse(200, {
      code: 'QSL-0000',
      data: {
        station: { call_sign: 'BA4SLT', name: '电台' },
        counts: { qso: 2, cards_sent: 0, cards_signed: 0, cards_received: 1 },
        recent: [],
        cards: [],
      },
    }),
    schedule: () => {},
  });
  assert.equal(ready.hidden, false);
  assert.match(ready.body.innerHTML, /qsl-showcase-count/);
  assert.match(ready.body.innerHTML, />0</);
});

test('config keeps the showcase origin and rejects a non-http URL', () => {
  const merged = mergeConfig(
    { title: 'BA4SLT', qslShowcase: { siteUrl: 'https://old.example' } },
    { qslShowcase: { siteUrl: 'https://qsl.ba4slt.cn/' } },
  );
  assert.equal(merged.qslShowcase.siteUrl, 'https://qsl.ba4slt.cn');
  assert.throws(
    () => mergeConfig({ title: 'BA4SLT' }, { qslShowcase: { siteUrl: 'javascript:alert(1)' } }),
    /http/,
  );
  assert.match(showcaseClientSource('abc123'), /showcase\.js\?v=abc123/);
});
