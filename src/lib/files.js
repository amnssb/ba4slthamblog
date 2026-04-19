import { readdirSync, readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync, rmSync, statSync } from 'fs';
import { join, relative, dirname } from 'path';

export function readDirRecursive(dir) {
  const result = [];
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      result.push(...readDirRecursive(fullPath));
    } else {
      result.push(fullPath);
    }
  }
  return result;
}

export function readTextFile(path) {
  return readFileSync(path, 'utf-8');
}

export function writeTextFile(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, 'utf-8');
}

export function copyDir(src, dest) {
  if (!existsSync(src)) return;
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
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true });
  }
  mkdirSync(dir, { recursive: true });
}
