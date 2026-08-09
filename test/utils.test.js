import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeBasePath,
  safeUrl,
  serializeJsonForScript,
  withBasePath,
} from '../src/lib/utils.js';

test('base paths are normalized and applied to local routes', () => {
  assert.equal(normalizeBasePath('/radio/'), '/radio');
  assert.equal(withBasePath('/logs/', '/radio/'), '/radio/logs/');
  assert.equal(withBasePath('style.css', '/radio'), '/radio/style.css');
  assert.equal(withBasePath('https://example.com/a', '/radio'), 'https://example.com/a');
});

test('safeUrl keeps supported URLs and turns unknown schemes into local paths', () => {
  assert.equal(safeUrl('mailto:ham@example.com'), 'mailto:ham@example.com');
  assert.equal(safeUrl('javascript:alert(1)'), '/javascript:alert(1)');
  assert.equal(safeUrl('/about/', '/radio'), '/radio/about/');
});

test('embedded JSON cannot terminate its script element', () => {
  const json = serializeJsonForScript({ value: '</script><script>alert(1)</script>' });
  assert.doesNotMatch(json, /<\/script>/);
  assert.match(json, /\\u003C\/script/);
});
