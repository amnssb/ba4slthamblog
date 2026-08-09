import test from 'node:test';
import assert from 'node:assert/strict';
import { mdToHtml, parseFrontmatter } from '../src/lib/markdown.js';

test('Markdown URLs are escaped once and unsafe protocols are rejected', () => {
  const html = mdToHtml([
    '[query](https://example.com/?a=1&b=2)',
    '',
    '[unsafe](javascript:alert(1))',
    '',
    '![unsafe image](javascript:alert(1))',
  ].join('\n'));

  assert.match(html, /href="https:\/\/example\.com\/\?a=1&amp;b=2"/);
  assert.doesNotMatch(html, /&amp;amp;/);
  assert.doesNotMatch(html, /javascript:/);
  assert.match(html, />unsafe<\/p>/);
});

test('raw HTML is rendered as text while Markdown code remains intact', () => {
  const html = mdToHtml([
    '<script>alert("x")</script>',
    '',
    '```html',
    '<div>&</div>',
    '```',
  ].join('\n'));

  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt;/);
  assert.match(html, /<pre><code class="language-html">&lt;div&gt;&amp;&lt;\/div&gt;/);
  assert.doesNotMatch(html, /&amp;lt;div/);
});

test('duplicate headings receive unique stable anchors', () => {
  const html = mdToHtml('## Hello & Radio\n\n## Hello & Radio');

  assert.match(html, /id="hello-radio"/);
  assert.match(html, /id="hello-radio-2"/);
});

test('frontmatter parses quoted values and inline lists', () => {
  const { meta, body } = parseFrontmatter([
    '---',
    'title: "Radio note"',
    'tags: [ham, "field day"]',
    '---',
    'Body',
  ].join('\n'));

  assert.equal(meta.title, 'Radio note');
  assert.deepEqual(meta.tags, ['ham', 'field day']);
  assert.equal(body, 'Body');
});
