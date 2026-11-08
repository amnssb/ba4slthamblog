/*
友链：data/friends.json。缺文件就当还没加过友链。
调用示例：
  const friends = readFriends(dataDir)
  writeFriends(dataDir, friends)
*/

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

function friendsFile(dataDir) {
  return join(dataDir, 'friends.json');
}

export function readFriends(dataDir) {
  const file = friendsFile(dataDir);
  if (!existsSync(file)) return [];            // 第一次运行还没有这个文件
  const friends = JSON.parse(readFileSync(file, 'utf-8'));
  if (!Array.isArray(friends)) {
    throw new Error('friends.json 必须是数组');
  }
  return friends;
}

export function writeFriends(dataDir, friends) {
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
  writeFileSync(friendsFile(dataDir), JSON.stringify(friends, null, 2), 'utf-8');
}
