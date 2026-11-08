/*
关于页：content/pages/about.md。正文和 frontmatter 的切分只在这里做。
调用示例：
  const file = aboutFile(contentRoot)
  const about = readAbout(contentRoot)       // 没有页面时是 null
  writeAbout(contentRoot, markdown)
*/

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { parseFrontmatter } from './lib/markdown.js';

export function aboutFile(contentRoot) {
  return join(contentRoot, 'pages', 'about.md');
}

export function readAbout(contentRoot) {
  const file = aboutFile(contentRoot);
  if (!existsSync(file)) return null;
  const { body } = parseFrontmatter(readFileSync(file, 'utf-8'));
  return { content: body.trim() };             // 后台编辑框只放正文
}

export function writeAbout(contentRoot, content) {
  const file = aboutFile(contentRoot);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content, 'utf-8');
}
