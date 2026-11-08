/*
文件读写。路径不能逃出指定目录，这一条只在这里判断。
调用示例：
  const files = readDirRecursive(dir)
  writeTextFile(file, text)
  const safe = resolveInside(root, targetPath)
*/

import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'fs';
import { dirname, isAbsolute, join, relative, resolve } from 'path';
import { fail } from './fail.js';

export function readDirRecursive(dir) {
  const result = [];
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      result.push(...readDirRecursive(fullPath));       // 先走子目录，只收集文件
    } else {
      result.push(fullPath);
    }
  }
  return result;
}

export function writeTextFile(path, content) {
  mkdirSync(dirname(path), { recursive: true });        // 目标文件夹还没有就先建好
  writeFileSync(path, content, 'utf-8');
}

export function copyDir(src, dest) {
  if (!existsSync(src)) return;                         // 源目录不存在就跳过，不算构建失败
  const entries = readdirSync(src, { withFileTypes: true });
  mkdirSync(dest, { recursive: true });
  for (const entry of entries) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}

export function cleanDir(dir) {
  if (existsSync(dir)) rmSync(dir, { recursive: true });
  mkdirSync(dir, { recursive: true });                  // 清掉以后仍然留一个空目录
}

export function resolveInside(root, targetPath = '') {
  const fullPath = resolve(root, String(targetPath));
  const rel = relative(resolve(root), fullPath);
  if (rel.startsWith('..') || isAbsolute(rel)) {
    throw fail(400, 'Invalid path');                    // 用户传来的路径不能爬出这个目录
  }
  return fullPath;
}
