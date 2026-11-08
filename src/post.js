/*
文章：content/posts 下的 Markdown。站点和后台都从这里读，分类和排序只定义一次。
调用示例：
  const listed = listPosts(contentRoot)     // 后台列表：frontmatter、相对路径
  const posts = readPosts(contentRoot)      // 构建：正文 HTML、网址、上下篇
  const file = exportPost(absPath, 'posts/daily/a.md')
*/

import { existsSync, readFileSync } from 'fs';
import { basename, join, relative } from 'path';
import { readDirRecursive } from './lib/files.js';
import { parseFrontmatter, processMarkdown } from './lib/markdown.js';
import { truncate } from './lib/utils.js';

function toPosix(filePath) {
  return filePath.replace(/\\/g, '/');                 // 网址和后台路径都用斜杠
}

function categoryOf(meta, slug) {
  const normalized = slug.split('\\').join('/');         // 按网址切，Windows 的 path.dirname 不认这种斜杠
  const slash = normalized.lastIndexOf('/');
  const dirName = slash === -1 ? '' : normalized.slice(0, slash);
  return meta.category || dirName || 'default';          // 没写分类就用文件夹；嵌套文件夹保留整段路径
}

function tagsOf(meta) {
  if (Array.isArray(meta.tags)) return meta.tags.filter(Boolean);
  if (meta.tags) return [meta.tags];                    // 只写了一个标签时也当成数组，后台才能直接 join
  return [];
}

function markdownFiles(contentRoot) {
  const postsRoot = join(contentRoot, 'posts');
  if (!existsSync(postsRoot)) return [];                // 还没有文章目录就是空列表，不算错
  return readDirRecursive(postsRoot)
    .filter((filePath) => filePath.endsWith('.md'))
    .map((filePath) => ({
      filePath,
      slug: toPosix(relative(postsRoot, filePath)).replace(/\.md$/, ''),
    }));
}

// --- 后台列表 ---

export function listPosts(contentRoot) {
  const posts = markdownFiles(contentRoot).map(({ filePath, slug }) => {
    const { meta } = parseFrontmatter(readFileSync(filePath, 'utf-8'));
    return {
      ...meta,
      tags: tagsOf(meta),
      category: categoryOf(meta, slug),
      path: toPosix(relative(contentRoot, filePath)),   // 相对于 content，例如 posts/daily/a.md
      filename: basename(filePath),
    };
  });
  posts.sort((a, b) => new Date(b.date) - new Date(a.date));
  return posts;
}

// --- 构建用的文章 ---

export function readPosts(contentRoot) {
  const posts = markdownFiles(contentRoot).map(({ filePath, slug }) => {
    const { meta, html, raw } = processMarkdown(filePath);
    const excerpt = truncate(
      raw.replace(/[#*`\[\]()>!_-]/g, '').replace(/\s+/g, ' ').trim(),
      200,
    );
    return {
      title: meta.title || 'Untitled',
      date: meta.date || '1970-01-01',
      tags: tagsOf(meta),
      category: categoryOf(meta, slug),
      url: slug === 'index' ? '/' : `/${slug}/`,
      html,
      excerpt,
      summary: meta.summary || null,
      path: filePath,
      cover: meta.cover || null,
      coverOrientation: meta.coverOrientation || 'auto',
    };
  });

  posts.sort((a, b) => new Date(b.date) - new Date(a.date));
  posts.forEach((post, index) => {
    post.prev = index < posts.length - 1 ? posts[index + 1] : null; // 数组里更旧的一篇
    post.next = index > 0 ? posts[index - 1] : null;                 // 数组里更新的一篇
  });
  return posts;
}

// --- 标签页 ---

export function tagMap(posts) {
  const map = {};
  for (const post of posts) {
    const names = [...post.tags];
    if (post.category && !names.includes(post.category)) names.push(post.category);
    for (const name of names) {
      if (!map[name]) map[name] = [];
      map[name].push(post);                           // 同一篇文章可以出现在多个标签页
    }
  }
  return map;
}

// --- 编辑器读取 ---

export function readPostSource(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const { meta, body } = parseFrontmatter(content);
  return {
    content,
    body,
    meta: { ...meta, tags: tagsOf(meta) },              // 标签统一成数组，后台不用再解析一遍
  };
}

// --- 跨站导出 ---

export function exportPost(filePath, requestPath) {
  const { meta, html, raw } = processMarkdown(filePath);
  const slug = String(requestPath).replace(/\.md$/, '').replace(/\\/g, '/');
  return {
    source: {
      site: 'ham-radio-blog',
      url: meta.url || `/posts/${slug}`,              // 旧导出地址，不是站点里的文章网址
      exportedAt: new Date().toISOString(),
    },
    post: {
      title: meta.title || 'Untitled',
      date: meta.date,
      category: meta.category || 'default',           // 导出文件已经发出去过，分类仍只看 frontmatter
      tags: meta.tags || [],
      summary: meta.summary || null,
      cover: meta.cover || null,
      content: raw,
      html,
      slug,
    },
    meta: {
      version: '1.0',
      type: 'cross-site-export',
    },
  };
}
