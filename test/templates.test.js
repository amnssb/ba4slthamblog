import test from 'node:test';
import assert from 'node:assert/strict';
import { renderIndex } from '../src/templates/index.js';
import { renderLayout } from '../src/templates/layout.js';
import { renderPost } from '../src/templates/post.js';

const config = {
  title: 'BA4TEST',
  description: 'Test station',
  author: 'Operator',
  callsign: 'BA4TEST',
  language: 'zh-CN',
  url: 'https://example.com',
  nav: [
    { text: '首页', url: '/' },
    { text: '日志', url: '/logs/' },
  ],
  features: { search: { enabled: true }, pwa: { enabled: true }, comments: { enabled: false } },
  __basePath: '/radio',
  __assetVersion: 'abc123',
};

test('layout marks the current route and applies versioned base-path assets', () => {
  const html = renderLayout(config, {
    title: 'Logs',
    content: '<p>Content</p>',
    pathname: '/logs/',
  });

  assert.match(html, /href="\/radio\/logs\/" class="nav-link is-current" aria-current="page"/);
  assert.match(html, /href="\/radio\/style\.css\?v=abc123"/);
  assert.match(html, /data-search-index="\/radio\/search-index\.json\?v=abc123"/);
  assert.match(html, /document\.documentElement\.classList\.toggle/);
});

test('comments render only when explicitly enabled', () => {
  const post = {
    title: 'Post',
    date: '2026-08-09',
    category: 'daily',
    tags: [],
    html: '<p>Body</p>',
    excerpt: 'Body',
    url: '/daily/post/',
  };
  const giscus = {
    repo: 'owner/repo',
    repoId: 'repo-id',
    category: 'General',
    categoryId: 'category-id',
  };

  const disabled = renderPost({ ...config, giscus }, post, null, null);
  const enabled = renderPost({
    ...config,
    giscus,
    features: { ...config.features, comments: { enabled: true } },
  }, post, null, null);

  assert.doesNotMatch(disabled, /giscus\.app\/client\.js/);
  assert.match(enabled, /giscus\.app\/client\.js/);
});

test('home covers prioritize the first image and lazy-load the rest', () => {
  const posts = [
    { title: 'First', date: '2026-08-09', category: 'daily', tags: [], excerpt: '', url: '/first/', cover: 'https://example.com/first.jpg' },
    { title: 'Second', date: '2026-08-08', category: 'daily', tags: [], excerpt: '', url: '/second/', cover: 'https://example.com/second.jpg', coverOrientation: 'landscape' },
  ];
  const html = renderIndex(config, posts, 1, 1, {}, 'anime-sakura');

  assert.match(html, /first\.jpg" alt="" loading="eager" fetchpriority="high" decoding="async"/);
  assert.match(html, /second\.jpg" alt="" loading="lazy" decoding="async"/);
  assert.match(html, /data-cover-orientation="landscape"/);
});
