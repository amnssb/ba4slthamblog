import { readFileSync } from 'fs';
import { marked } from 'marked';
import { slugify } from './utils.js';

marked.setOptions({
  gfm: true,
  breaks: false,
  headerIds: true,
});

export function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) {
    return { meta: {}, body: content };
  }

  const yaml = match[1];
  const body = match[2];
  const meta = {};
  const lines = yaml.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) continue;

    const key = trimmed.slice(0, colonIdx).trim();
    let value = trimmed.slice(colonIdx + 1).trim();

    if (value.startsWith('[') && value.endsWith(']')) {
      value = value
        .slice(1, -1)
        .split(',')
        .map((v) => v.trim().replace(/^['"]|['"]$/g, ''))
        .filter(Boolean);
    } else {
      value = value.replace(/^['"]|['"]$/g, '');
    }

    meta[key] = value;
  }

  return { meta, body };
}

export function mdToHtml(md) {
  const html = marked.parse(md);

  // Ensure headings always have stable ids so TOC and anchor links work.
  return html.replace(/<h([1-6])>([\s\S]*?)<\/h\1>/g, (_, level, innerHtml) => {
    const text = innerHtml.replace(/<[^>]+>/g, '').trim();
    const id = slugify(text);
    return id
      ? `<h${level} id="${id}">${innerHtml}</h${level}>`
      : `<h${level}>${innerHtml}</h${level}>`;
  });
}

export function processMarkdown(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const { meta, body } = parseFrontmatter(content);
  const html = mdToHtml(body);
  return { meta, html, raw: body };
}
