import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { readAbout, writeAbout } from '../src/about.js';
import { mergeConfig, publicConfig, redactConfig } from '../src/config.js';
import { readFriends } from '../src/friend.js';
import { resolveInside } from '../src/lib/files.js';
import { listLogs, readLogs } from '../src/log.js';
import { exportPost, listPosts, readPosts } from '../src/post.js';

function site() {
  const root = mkdtempSync(join(tmpdir(), 'ham-blog-'));
  const content = join(root, 'content');
  mkdirSync(join(content, 'posts', 'a', 'b'), { recursive: true });
  mkdirSync(join(content, 'logs'), { recursive: true });
  writeFileSync(join(content, 'posts', 'a', 'b', 'note.md'), [
    '---',
    'title: Nested',
    'date: 2024-01-02',
    'tags: ham',
    '---',
    '',
    'Body',
    '',
  ].join('\n'));
  writeFileSync(join(content, 'posts', 'a', 'older.md'), [
    '---',
    'title: Older',
    'date: 2024-01-01',
    'tags: [one, "two"]',
    'category: kept',
    '---',
    '',
    'Older body',
    '',
  ].join('\n'));
  writeFileSync(join(content, 'logs', 'morning.json'), JSON.stringify({
    date: '2024-05-01', callsign: 'BA4SLT', time: '9:00', band: '2m', mode: 'FM',
  }));
  writeFileSync(join(content, 'logs', 'later.json'), JSON.stringify({
    date: '2024-05-01', callsign: 'BA4SBF', time: '10:00', band: '70cm', mode: 'SSB',
  }));
  return { root, content, logs: join(content, 'logs') };
}

test('posts keep one category rule for the site and the admin list', () => {
  const fixture = site();
  try {
    const listed = listPosts(fixture.content);
    const built = readPosts(fixture.content);

    assert.deepEqual(listed.map((post) => post.title), ['Nested', 'Older']);
    assert.deepEqual(built.map((post) => post.title), ['Nested', 'Older']);
    assert.equal(listed[0].category, 'a/b');
    assert.equal(built[0].category, 'a/b');
    assert.equal(listed[1].category, 'kept');
    assert.deepEqual(listed[0].tags, ['ham']);
    assert.equal(listed[0].path, 'posts/a/b/note.md');
    assert.equal(built[0].url, '/a/b/note/');
    assert.equal(built[0].prev.title, 'Older');
    assert.equal(built[0].next, null);

    const exported = exportPost(join(fixture.content, 'posts', 'a', 'b', 'note.md'), 'posts/a/b/note.md');
    assert.equal(exported.post.category, 'default');
    assert.equal(exported.source.url, '/posts/posts/a/b/note');
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('logs use the same clock order in the site and the admin list', () => {
  const fixture = site();
  try {
    const built = readLogs(fixture.logs);
    const listed = listLogs(fixture.logs);
    assert.deepEqual(built.map((log) => log.callsign), ['BA4SBF', 'BA4SLT']);
    assert.deepEqual(listed.map((log) => log.callsign), ['BA4SBF', 'BA4SLT']);
    assert.equal(listed[0].path, 'later.json');
    assert.equal(built[0].url, '/logs/later/');
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('config keeps a saved key when the form sends a blank one', () => {
  const existing = { title: 'BA4SLT', ai: { apiKey: 'saved-key', model: 'demo' } };
  const merged = mergeConfig(existing, { title: 'BA4SLT', ai: { apiKey: '', model: 'demo', hasApiKey: true } });
  assert.equal(merged.ai.apiKey, 'saved-key');
  assert.equal(merged.ai.hasApiKey, undefined);

  const visible = redactConfig(merged, '');
  assert.equal(visible.ai.apiKey, '');
  assert.equal(visible.ai.hasApiKey, true);
  assert.equal(publicConfig(merged).ai, undefined);
});

test('missing friends are an empty list and paths cannot leave their directory', () => {
  const fixture = site();
  try {
    const dataDir = join(fixture.root, 'data');
    assert.deepEqual(readFriends(dataDir), []);
    mkdirSync(dataDir);
    writeFileSync(join(dataDir, 'friends.json'), '{}');
    assert.throws(() => readFriends(dataDir), /数组/);

    const inside = resolveInside(fixture.root, 'content/posts/a/older.md');
    assert.equal(inside, join(fixture.root, 'content/posts/a/older.md'));
    assert.throws(() => resolveInside(fixture.root, '../outside'), (error) => error.status === 400);
    assert.throws(() => resolveInside(fixture.root, '/etc/passwd'), (error) => error.status === 400);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('about editor receives the page body without its frontmatter', () => {
  const fixture = site();
  try {
    assert.equal(readAbout(fixture.content), null);
    writeAbout(fixture.content, '---\ntitle: 关于\n---\n\n你好\n');
    assert.equal(readAbout(fixture.content).content, '你好');
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});
