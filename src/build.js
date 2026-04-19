import { readFileSync, existsSync } from 'fs';
import { join, dirname, relative } from 'path';
import { fileURLToPath } from 'url';
import { readDirRecursive, writeTextFile, copyDir, cleanDir } from './lib/files.js';
import { processMarkdown } from './lib/markdown.js';
import { generateRss } from './lib/rss.js';
import { generateSearchIndex } from './lib/search.js';
import { generateSitemap } from './lib/sitemap.js';
import { truncate, normalizeBasePath, slugify } from './lib/utils.js';
import { renderPost } from './templates/post.js';
import { renderIndex } from './templates/index.js';
import { renderTagIndex, renderAllTags } from './templates/tag.js';
import { renderAbout } from './templates/about.js';
import { renderFriends } from './templates/friends.js';
import { renderLogsIndex, renderLogEntry } from './templates/logs.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DIST = join(ROOT, 'dist');
const CONTENT = join(ROOT, 'content');
const PUBLIC = join(ROOT, 'public');
const ASSETS = join(ROOT, 'src', 'assets');
const DATA = join(ROOT, 'data');

function readConfig() {
  return JSON.parse(readFileSync(join(ROOT, 'config.json'), 'utf-8'));
}

function toPosixPath(filePath) {
  return filePath.replace(/\\/g, '/');
}

function parseLogTimestamp(date, time = '') {
  const normalizedTime = String(time || '').trim();
  const utcMatch = normalizedTime.match(/^(\d{1,2}:\d{2})(?:\s*UTC)?$/i);
  if (utcMatch) {
    return new Date(`${date}T${utcMatch[1]}:00Z`).getTime();
  }

  const localMatch = normalizedTime.match(/^(\d{1,2}:\d{2})$/);
  if (localMatch) {
    return new Date(`${date}T${localMatch[1]}:00`).getTime();
  }

  return new Date(date).getTime();
}

function readLogs(logsRoot) {
  const logFiles = existsSync(logsRoot)
    ? readDirRecursive(logsRoot).filter((filePath) => filePath.endsWith('.json'))
    : [];

  return logFiles
    .map((filePath) => {
      const raw = JSON.parse(readFileSync(filePath, 'utf-8'));
      const relPath = toPosixPath(relative(logsRoot, filePath)).replace(/\.json$/, '');
      const slug = raw.slug || relPath || slugify(`${raw.date || ''}-${raw.callsign || raw.title || 'log'}`);
      const title = raw.title || [raw.date, raw.callsign, raw.band, raw.mode].filter(Boolean).join(' ');
      const url = `/logs/${slug}/`;
      const excerpt = truncate(
        (raw.notes || `${raw.frequency || ''} ${raw.mode || ''} ${raw.callsign || ''}`).replace(/\s+/g, ' ').trim(),
        160
      );

      return {
        ...raw,
        title: title || '未命名通联日志',
        slug,
        url,
        excerpt,
        type: 'log',
        timestamp: parseLogTimestamp(raw.date || '1970-01-01', raw.time || ''),
      };
    })
    .sort((a, b) => b.timestamp - a.timestamp);
}

function build() {
  const config = {
    ...readConfig(),
    __basePath: normalizeBasePath(process.env.BLOG_BASE_PATH || ''),
  };
  const postsRoot = join(CONTENT, 'posts');
  const logsRoot = join(CONTENT, 'logs');
  const hasAboutPage = existsSync(join(CONTENT, 'pages', 'about.md'));

  console.log('🌸 Building Ham Blog...');
  cleanDir(DIST);

  // Copy assets
  copyDir(ASSETS, DIST);
  copyDir(PUBLIC, DIST);

  // Read posts
  const postFiles = existsSync(postsRoot)
    ? readDirRecursive(postsRoot).filter(f => f.endsWith('.md'))
    : [];
  
  const allPosts = postFiles
    .map(filePath => {
      const { meta, html, raw } = processMarkdown(filePath);
      const relPath = toPosixPath(relative(postsRoot, filePath));
      const slug = relPath.replace(/\.md$/, '');
      const url = slug === 'index' ? '/' : `/${slug}/`;
      const dirName = toPosixPath(dirname(slug));
      const category = meta.category || (dirName === '.' ? 'default' : dirName);
      
      const excerpt = truncate(
        raw.replace(/[#*`\[\]()>!_-]/g, '').replace(/\s+/g, ' ').trim(),
        200
      );

      return {
        title: meta.title || 'Untitled',
        date: meta.date || '1970-01-01',
        tags: Array.isArray(meta.tags) ? meta.tags.filter(Boolean) : meta.tags ? [meta.tags] : [],
        category,
        url,
        html,
        excerpt,
        path: filePath,
        cover: meta.cover || null,
      };
    })
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const allLogs = readLogs(logsRoot);

  // Add prev/next links
  allPosts.forEach((post, i) => {
    post.prev = i < allPosts.length - 1 ? allPosts[i + 1] : null;
    post.next = i > 0 ? allPosts[i - 1] : null;
  });

  console.log(`📄 Found ${allPosts.length} posts`);
  console.log(`📡 Found ${allLogs.length} logs`);

  // Build tag map
  const tagMap = {};
  for (const post of allPosts) {
    const tags = [...post.tags];
    if (post.category && !tags.includes(post.category)) {
      tags.push(post.category);
    }
    for (const tag of tags) {
      if (!tagMap[tag]) tagMap[tag] = [];
      tagMap[tag].push(post);
    }
  }

  const theme = config.theme || 'anime-sakura';

  // Generate index pages
  const perPage = Math.max(1, Number(config.postsPerPage) || 6);
  const totalPages = Math.max(1, Math.ceil(allPosts.length / perPage));

  for (let page = 1; page <= totalPages; page++) {
    const start = (page - 1) * perPage;
    const pagePosts = allPosts.slice(start, start + perPage);
    const html = renderIndex(config, pagePosts, page, totalPages, tagMap, theme);
    const path = page === 1 ? 'index.html' : join('page', String(page), 'index.html');
    writeTextFile(join(DIST, path), html);
  }

  // Generate logs pages
  const logsIndexHtml = renderLogsIndex(config, allLogs, theme);
  writeTextFile(join(DIST, 'logs', 'index.html'), logsIndexHtml);

  for (const log of allLogs) {
    const html = renderLogEntry(config, log, theme);
    writeTextFile(join(DIST, 'logs', log.slug, 'index.html'), html);
  }

  // Generate post pages
  for (const post of allPosts) {
    const html = renderPost(config, post, post.prev, post.next, theme);
    writeTextFile(join(DIST, post.url.slice(1), 'index.html'), html);
  }

  // Generate tag pages
  for (const tag of Object.keys(tagMap)) {
    const html = renderTagIndex(config, tag, tagMap[tag], theme);
    writeTextFile(join(DIST, 'tag', tag, 'index.html'), html);
  }

  // Generate all tags page
  const allTagsHtml = renderAllTags(config, tagMap, theme);
  writeTextFile(join(DIST, 'tags', 'index.html'), allTagsHtml);

  // Generate about page
  const aboutPath = join(CONTENT, 'pages', 'about.md');
  try {
    const { html: contentHtml } = processMarkdown(aboutPath);
    const html = renderAbout(config, contentHtml, theme);
    writeTextFile(join(DIST, 'about', 'index.html'), html);
  } catch (e) {
    console.log('⚠️ No about page found');
  }

  // Generate friends page
  const friendsPath = join(DATA, 'friends.json');
  let friends = [];
  try {
    friends = JSON.parse(readFileSync(friendsPath, 'utf-8'));
  } catch {}
  
  if (config.features?.friends?.enabled !== false) {
    const friendsHtml = renderFriends(config, friends, theme);
    writeTextFile(join(DIST, 'friends', 'index.html'), friendsHtml);
    console.log(`🔗 Generated friends page with ${friends.length} links`);
  }

  // Generate RSS
  const rssItems = [...allPosts, ...allLogs].sort((a, b) => {
    const left = a.timestamp || new Date(a.date).getTime();
    const right = b.timestamp || new Date(b.date).getTime();
    return right - left;
  });
  const rss = generateRss(config, rssItems);
  writeTextFile(join(DIST, 'rss.xml'), rss);

  // Generate sitemap
  const pages = [
    '/',
    ...allPosts.map((p) => p.url),
    '/logs/',
    ...allLogs.map((log) => log.url),
    ...Object.keys(tagMap).map((t) => `/tag/${t}/`),
    '/tags/',
    ...(hasAboutPage ? ['/about/'] : []),
    ...(config.features?.friends?.enabled !== false ? ['/friends/'] : []),
  ];
  const sitemap = generateSitemap(config, pages);
  writeTextFile(join(DIST, 'sitemap.xml'), sitemap);

  // Generate search index
  if (config.features?.search?.enabled !== false) {
    const searchIndex = generateSearchIndex([
      ...allPosts,
      ...allLogs.map((log) => ({
        title: log.title,
        url: log.url,
        date: log.date,
        tags: [log.band, log.mode, log.callsign].filter(Boolean),
        category: 'log',
        excerpt: log.excerpt,
      })),
    ]);
    writeTextFile(join(DIST, 'search-index.json'), searchIndex);
  }

  // Generate manifest.json for PWA
  if (config.features?.pwa?.enabled !== false) {
    const manifest = {
      name: config.title,
      short_name: config.title,
      description: config.description,
      start_url: config.__basePath || '/',
      display: 'standalone',
      background_color: '#fef3f3',
      theme_color: '#f472b6',
      icons: [
        { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' }
      ]
    };
    writeTextFile(join(DIST, 'manifest.json'), JSON.stringify(manifest, null, 2));
  }

  console.log('✅ Build complete!');
  console.log(`📁 Output: ${DIST}`);
  console.log(`📝 ${allPosts.length} posts`);
  console.log(`📡 ${allLogs.length} logs`);
  console.log(`🏷️ ${Object.keys(tagMap).length} tags`);
  console.log(`🔗 ${friends.length} friends`);
}

try {
  build();
} catch (err) {
  console.error('❌ Build failed:', err);
  process.exit(1);
}
