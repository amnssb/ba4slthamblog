/*
通联日志：content/logs 下的 JSON。排序只在这里算一次，站点和后台顺序一致。
调用示例：
  const logs = readLogs(logsRoot)    // 构建：标题、网址、摘要
  const listed = listLogs(logsRoot)   // 后台：原文件加上相对路径
*/

import { existsSync, readFileSync } from 'fs';
import { join, relative } from 'path';
import { readDirRecursive } from './lib/files.js';
import { slugify, truncate } from './lib/utils.js';

function toPosix(filePath) {
  return filePath.replace(/\\/g, '/');
}

function readJson(filePath) {
  try {
    return JSON.parse(readFileSync(filePath, 'utf-8'));
  } catch (error) {
    throw new Error(`无法读取日志 ${filePath}: ${error.message}`);
  }
}

export function parseLogTimestamp(date, time = '') {
  const normalizedTime = String(time || '').trim();
  const clock = normalizedTime.match(/^(\d{1,2}):(\d{2})(?:\s*UTC)?$/i);
  if (clock) {
    const hour = clock[1].padStart(2, '0');           // 9:00 拼出来不是合法 ISO，直接解析会得到 NaN
    return new Date(`${date}T${hour}:${clock[2]}:00Z`).getTime(); // 没写 UTC 也按 UTC，和原来可省略的后缀一致
  }
  return new Date(date).getTime();                     // 没有时分就只按日期
}

function loadLogs(logsRoot) {
  if (!existsSync(logsRoot)) return [];
  const logs = readDirRecursive(logsRoot)
    .filter((filePath) => filePath.endsWith('.json'))
    .map((filePath) => {
      const raw = readJson(filePath);
      const relPath = toPosix(relative(logsRoot, filePath)).replace(/\.json$/, '');
      const slug = raw.slug || relPath || slugify(`${raw.date || ''}-${raw.callsign || raw.title || 'log'}`);
      const title = raw.title || [raw.date, raw.callsign, raw.band, raw.mode].filter(Boolean).join(' ');
      return {
        raw,
        path: toPosix(relative(logsRoot, filePath)),
        record: {
          ...raw,
          title: title || '未命名通联日志',
          slug,
          url: `/logs/${slug}/`,
          excerpt: truncate(
            (raw.notes || `${raw.frequency || ''} ${raw.mode || ''} ${raw.callsign || ''}`).replace(/\s+/g, ' ').trim(),
            160,
          ),
          type: 'log',
          timestamp: parseLogTimestamp(raw.date || '1970-01-01', raw.time || ''),
        },
      };
    });
  logs.sort((a, b) => b.record.timestamp - a.record.timestamp);
  return logs;
}

export function readLogs(logsRoot) {
  return loadLogs(logsRoot).map((item) => item.record);
}

export function listLogs(logsRoot) {
  return loadLogs(logsRoot).map((item) => ({
    ...item.raw,
    path: item.path,                                    // 后台用这个路径再打开同一份文件
  }));
}
