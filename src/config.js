/*
站点配置：只读写根目录的 config.json。
密钥不进页面，也不从后台接口原样返回。
调用示例：
  const saved = readConfig(root)
  const site = publicConfig(saved)          // 构建页面用，没有 ai
  const visible = redactConfig(saved, process.env.AI_API_KEY)
  const next = mergeConfig(saved, incoming)
  writeConfig(root, next)
*/

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { fail } from './lib/fail.js';
import { showcaseOrigin } from './showcase.js';

export function readConfig(root) {
  return JSON.parse(readFileSync(join(root, 'config.json'), 'utf-8'));
}

export function writeConfig(root, config) {
  writeFileSync(join(root, 'config.json'), JSON.stringify(config, null, 2), 'utf-8');
}

export function assertSiteConfig(config) {
  if (!config.title || typeof config.title !== 'string') {
    throw new Error('config.json: title must be a non-empty string');
  }
  if (config.url && !/^https?:\/\//i.test(config.url)) {
    throw new Error('config.json: url must start with http:// or https://');
  }
  if (config.qslShowcase != null) {
    if (typeof config.qslShowcase !== 'object' || Array.isArray(config.qslShowcase)) {
      throw new Error('config.json: qslShowcase must be an object');
    }
    const siteUrl = config.qslShowcase.siteUrl;
    if (siteUrl != null && String(siteUrl).trim() && !showcaseOrigin(siteUrl)) {
      throw new Error('config.json: qslShowcase.siteUrl must be an http(s) URL');
    }
  }
}

export function publicConfig(config) {
  const { ai, ...site } = config;            // 页面模板拿不到密钥这一整段
  return site;
}

export function redactConfig(config, envKey = '') {
  const visible = JSON.parse(JSON.stringify(config));
  if (visible.ai) {
    visible.ai = {
      ...visible.ai,
      apiKey: '',                              // 后台只知道有没有密钥，看不到密钥本身
      hasApiKey: Boolean(config.ai.apiKey || envKey),
    };
  }
  return visible;
}

export function mergeConfig(existing, incoming) {
  const next = { ...existing, ...incoming };
  if (incoming.ai) {
    next.ai = { ...(existing.ai || {}), ...incoming.ai };
    if (!incoming.ai.apiKey && existing.ai?.apiKey) {
      next.ai.apiKey = existing.ai.apiKey;    // 空密钥表示沿用原来的，不要把已保存的密钥擦掉
    }
    delete next.ai.hasApiKey;                  // 这是返回给界面的标记，不写回文件
  }
  if (Object.prototype.hasOwnProperty.call(incoming, 'qslShowcase')) {
    next.qslShowcase = normalizeShowcase(existing.qslShowcase, incoming.qslShowcase);
  }
  return next;
}

function normalizeShowcase(existing, incoming) {
  if (incoming == null) return { ...(existing || {}), siteUrl: '' };
  if (typeof incoming !== 'object' || Array.isArray(incoming)) {
    throw fail(400, 'qslShowcase must be an object');
  }
  const siteUrl = String(incoming.siteUrl ?? '').trim();
  const origin = siteUrl ? showcaseOrigin(siteUrl) : '';
  if (siteUrl && !origin) throw fail(400, 'qslShowcase.siteUrl must be an http(s) URL');
  return { ...(existing || {}), ...incoming, siteUrl: origin };
}
