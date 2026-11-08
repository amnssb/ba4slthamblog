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
  return next;
}
