/*
构建入口：读文章、通联日志、友链和配置，写出 dist。数据怎么来的不在这里决定。
调用：node src/build.js
预览用的子路径：BLOG_BASE_PATH=/preview node src/build.js
*/

import { createHash } from 'crypto';
import { existsSync, readFileSync } from 'fs';
import { dirname, join, relative } from 'path';
import { fileURLToPath } from 'url';
import { aboutFile } from './about.js';
import { assertSiteConfig, publicConfig, readConfig } from './config.js';
import { readFriends } from './friend.js';
import { cleanDir, copyDir, readDirRecursive, writeTextFile } from './lib/files.js';
import { processMarkdown } from './lib/markdown.js';
import { renderManifest, renderServiceWorker } from './lib/pwa.js';
import { generateRss } from './lib/rss.js';
import { generateSearchIndex } from './lib/search.js';
import { generateSitemap } from './lib/sitemap.js';
import { normalizeBasePath, slugify, withBasePath } from './lib/utils.js';
import { readLogs } from './log.js';
import { readPosts, tagMap } from './post.js';
import { renderAbout } from './templates/about.js';
import { renderFriends } from './templates/friends.js';
import { renderIndex } from './templates/index.js';
import { renderLogEntry, renderLogsIndex } from './templates/logs.js';
import { renderPost } from './templates/post.js';
import { renderAllTags, renderTagIndex } from './templates/tag.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const CONTENT = join(ROOT, 'content');
const PUBLIC = join(ROOT, 'public');
const ASSETS = join(ROOT, 'src', 'assets');
const DATA = join(ROOT, 'data');

function toPosixPath(filePath) {
  return filePath.replace(/\\/g, '/');
}

function createBuildFingerprint(basePath, theme) {
  const hash = createHash('sha256');                   // 文件一变，页面里的 ?v= 就变，浏览器不会继续用旧样式
  const roots = [CONTENT, DATA, join(ROOT, 'src'), PUBLIC];
  const files = roots
    .flatMap((root) => existsSync(root) ? readDirRecursive(root) : [])
    .concat(
      join(ROOT, 'config.json'),
      join(ROOT, 'package.json'),
      join(ROOT, 'package-lock.json'),
      join(ROOT, 'themes', theme, 'theme.json'),
    )
    .filter((filePath) => existsSync(filePath))
    .sort();

  hash.update(basePath);
  for (const filePath of files) {
    hash.update(toPosixPath(relative(ROOT, filePath)));
    hash.update(readFileSync(filePath));
  }
  return hash.digest('hex').slice(0, 12);
}

function loadSite() {
  const saved = readConfig(ROOT);
  assertSiteConfig(saved);                             // 站点没有标题就不能生成页面
  const site = publicConfig(saved);                    // 页面里不带 ai 密钥
  const basePath = normalizeBasePath(process.env.BLOG_BASE_PATH || '');
  const theme = site.theme || 'anime-sakura';
  const themeConfig = JSON.parse(readFileSync(join(ROOT, 'themes', theme, 'theme.json'), 'utf-8'));
  return {
    config: {
      ...site,
      __basePath: basePath,
      __assetVersion: createBuildFingerprint(basePath, theme),
    },
    theme,
    themeConfig,
  };
}

function writePage(file, html) {
  writeTextFile(join(DIST, file), html);
}

function build() {
  const { config, theme, themeConfig } = loadSite();
  const posts = readPosts(CONTENT);
  const logs = readLogs(join(CONTENT, 'logs'));
  const tags = tagMap(posts);
  const aboutPath = aboutFile(CONTENT);
  const hasAbout = existsSync(aboutPath);
  const friends = readFriends(DATA);

  console.log('🌸 Building Ham Blog...');
  cleanDir(DIST);
  copyDir(ASSETS, DIST);                               // 样式和脚本
  copyDir(PUBLIC, DIST);                               // 图片和 favicon

  console.log(`📄 Found ${posts.length} posts`);
  console.log(`📡 Found ${logs.length} logs`);

  // --- 首页 ---
  const perPage = Math.max(1, Number(config.postsPerPage) || 6);
  const totalPages = Math.max(1, Math.ceil(posts.length / perPage));
  for (let page = 1; page <= totalPages; page++) {
    const pagePosts = posts.slice((page - 1) * perPage, page * perPage);
    const file = page === 1 ? 'index.html' : join('page', String(page), 'index.html');
    writePage(file, renderIndex(config, pagePosts, page, totalPages, tags, theme));
  }

  // --- 通联日志 ---
  writePage(join('logs', 'index.html'), renderLogsIndex(config, logs, theme));
  for (const log of logs) {
    writePage(join('logs', log.slug, 'index.html'), renderLogEntry(config, log, theme));
  }

  // --- 文章和标签 ---
  for (const post of posts) {
    writePage(join(post.url.slice(1), 'index.html'), renderPost(config, post, post.prev, post.next, theme));
  }
  for (const tag of Object.keys(tags)) {
    writePage(join('tag', slugify(tag) || tag, 'index.html'), renderTagIndex(config, tag, tags[tag], theme));
  }
  writePage(join('tags', 'index.html'), renderAllTags(config, tags, theme));

  // --- 关于、友链 ---
  if (!hasAbout) {
    console.log('⚠️ No about page found');
  } else {
    const { html } = processMarkdown(aboutPath);       // 文件在但解析失败就让构建停下来，不要当成没有这一页
    writePage(join('about', 'index.html'), renderAbout(config, html, theme));
  }

  if (config.features?.friends?.enabled !== false) {
    writePage(join('friends', 'index.html'), renderFriends(config, friends, theme));
    console.log(`🔗 Generated friends page with ${friends.length} links`);
  }

  // --- 订阅、索引、离线页 ---
  const feed = [...posts, ...logs].sort((a, b) => {
    const left = a.timestamp || new Date(a.date).getTime();
    const right = b.timestamp || new Date(b.date).getTime();
    return right - left;
  });
  writePage('rss.xml', generateRss(config, feed));

  const pages = [
    '/',
    ...posts.map((post) => post.url),
    '/logs/',
    ...logs.map((log) => log.url),
    ...Object.keys(tags).map((tag) => `/tag/${slugify(tag) || tag}/`),
    '/tags/',
    ...(hasAbout ? ['/about/'] : []),
    ...(config.features?.friends?.enabled !== false ? ['/friends/'] : []),
  ];
  writePage('sitemap.xml', generateSitemap(config, pages));

  if (config.features?.search?.enabled !== false) {
    const searchItems = [
      ...posts,
      ...logs.map((log) => ({
        title: log.title,
        url: log.url,
        date: log.date,
        tags: [log.band, log.mode, log.callsign].filter(Boolean),
        category: 'log',
        excerpt: log.excerpt,
      })),
    ].map((item) => ({
      ...item,
      url: withBasePath(item.url, config.__basePath),
    }));
    writePage('search-index.json', generateSearchIndex(searchItems));
  }

  if (config.features?.pwa?.enabled !== false) {
    writePage('manifest.json', JSON.stringify(renderManifest(config, themeConfig), null, 2));
    writePage('service-worker.js', renderServiceWorker(config));
  }

  console.log('✅ Build complete!');
  console.log(`📁 Output: ${DIST}`);
  console.log(`📝 ${posts.length} posts`);
  console.log(`📡 ${logs.length} logs`);
  console.log(`🏷️ ${Object.keys(tags).length} tags`);
  console.log(`🔗 ${friends.length} friends`);
}

try {
  build();
} catch (error) {
  console.error('❌ Build failed:', error);
  process.exit(1);
}
