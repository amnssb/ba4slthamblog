#!/usr/bin/env python3
"""
静态博客构建脚本 - Python 版本
生成完整的 HTML 文件用于预览
"""

import json
import os
import re
from pathlib import Path
from datetime import datetime

# Paths
ROOT = Path(__file__).parent
DIST = ROOT / "dist"
CONTENT = ROOT / "content"
PUBLIC = ROOT / "public"
THEMES = ROOT / "themes"

def read_file(path):
    """读取文件内容"""
    try:
        return path.read_text(encoding='utf-8')
    except:
        return ""

def write_file(path, content):
    """写入文件"""
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding='utf-8')

def parse_markdown(content):
    """解析 Markdown frontmatter"""
    match = re.match(r'^---\r?\n(.*?)\r?\n---\r?\n(.*)$', content, re.DOTALL)
    if not match:
        return {}, content
    
    fm = match.group(1)
    body = match.group(2)
    
    meta = {}
    for line in fm.strip().split('\n'):
        if ':' in line:
            key, val = line.split(':', 1)
            key = key.strip()
            val = val.strip().strip('"').strip("'")
            if val.startswith('[') and val.endswith(']'):
                val = [v.strip().strip('"').strip("'") for v in val[1:-1].split(',')]
            meta[key] = val
    
    return meta, body

def md_to_html(md):
    """简单的 Markdown 转 HTML"""
    html = md
    # Headers
    html = re.sub(r'^### (.*$)', r'<h3 id="\1">\1</h3>', html, flags=re.MULTILINE)
    html = re.sub(r'^## (.*$)', r'<h2 id="\1">\1</h2>', html, flags=re.MULTILINE)
    html = re.sub(r'^# (.*$)', r'<h1>\1</h1>', html, flags=re.MULTILINE)
    # Bold/Italic
    html = re.sub(r'\*\*(.*?)\*\*', r'<strong>\1</strong>', html)
    html = re.sub(r'\*(.*?)\*', r'<em>\1</em>', html)
    # Code
    html = re.sub(r'`([^`]+)`', r'<code>\1</code>', html)
    html = re.sub(r'```(\w+)?\n(.*?)```', r'<pre><code>\2</code></pre>', html, flags=re.DOTALL)
    # Links
    html = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', r'<a href="\2">\1</a>', html)
    # Images
    html = re.sub(r'!\[([^\]]*)\]\(([^)]+)\)', r'<img src="\2" alt="\1">', html)
    # Lists
    html = re.sub(r'^\s*-\s+(.*$)', r'<li>\1</li>', html, flags=re.MULTILINE)
    html = re.sub(r'(<li>.*</li>\n?)+', r'<ul>\g<0></ul>', html)
    # Tables
    def parse_table(match):
        lines = match.group(0).strip().split('\n')
        if len(lines) < 3:
            return match.group(0)
        headers = [c.strip() for c in lines[0].split('|') if c.strip()]
        rows = []
        for line in lines[2:]:
            cells = [c.strip() for c in line.split('|') if c.strip()]
            if cells:
                rows.append(cells)
        
        th = ''.join(f'<th>{h}</th>' for h in headers)
        tr = ''.join(''.join(f'<td>{c}</td>' for c in row) for row in rows)
        return f'<table><thead><tr>{th}</tr></thead><tbody>{tr}</tbody></table>'
    
    html = re.sub(r'\|.*\|.*\|\n\|[-:\s|]+\|\n(?:\|.*\|.*\|\n?)+', parse_table, html)
    # Paragraphs
    html = re.sub(r'\n\n+', '</p><p>', html)
    html = '<p>' + html + '</p>'
    html = html.replace('<p></p>', '')
    
    return html

def escape_html(text):
    """转义 HTML 特殊字符"""
    return text.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace('"', '&quot;')

def format_date(date_str):
    """格式化日期"""
    try:
        d = datetime.strptime(date_str, '%Y-%m-%d')
        return d.strftime('%Y-%m-%d')
    except:
        return date_str

def generate_layout(config, title, content, theme='anime-sakura'):
    """生成页面布局"""
    page_title = f"{title} - {config['title']}" if title else config['title']
    
    nav_links = ''.join([
        f'          <a href="{item["url"]}" class="nav-link">{item.get("icon", "")} {item["text"]}</a>'
        for item in config.get('nav', [])
    ])
    
    return f'''<!DOCTYPE html>
<html lang="{config.get('language', 'zh-CN')}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{escape_html(page_title)}</title>
  <meta name="description" content="{escape_html(config.get('description', ''))}">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/style.css">
</head>
<body>
  <canvas id="particle-canvas"></canvas>
  
  <nav class="nav-glass">
    <a href="/" class="nav-brand">{config['title']}</a>
    <div class="nav-links">
{nav_links}
    </div>
    <button class="theme-toggle" id="theme-toggle">🌙</button>
  </nav>

  <main class="main-container">
    <div class="content-wrapper">
{content}
    </div>
  </main>

  <footer class="footer-glass">
    <div class="footer-content">
      <p>&copy; {datetime.now().year} {config.get('author', '')}</p>
      <p class="footer-callsign">{config.get('callsign', '')}</p>
    </div>
  </footer>

  <button class="back-to-top" id="back-to-top">↑</button>
  <script src="/script.js"></script>
</body>
</html>'''

def build():
    """主构建函数"""
    print("Building Ham Blog (Static Preview)...")
    
    # Clean dist
    import shutil
    if DIST.exists():
        shutil.rmtree(DIST)
    DIST.mkdir()
    
    # Copy assets
    import shutil
    if (ROOT / "src" / "assets" / "style.css").exists():
        shutil.copy(ROOT / "src" / "assets" / "style.css", DIST / "style.css")
    if (ROOT / "src" / "assets" / "script.js").exists():
        shutil.copy(ROOT / "src" / "assets" / "script.js", DIST / "script.js")
    if (PUBLIC / "favicon.svg").exists():
        shutil.copy(PUBLIC / "favicon.svg", DIST / "favicon.svg")
    
    # Read config
    config = json.loads(read_file(ROOT / "config.json"))
    
    # Read posts
    posts = []
    posts_dir = CONTENT / "posts"
    if posts_dir.exists():
        for md_file in posts_dir.rglob("*.md"):
            rel_path = md_file.relative_to(posts_dir)
            slug = str(rel_path.with_suffix('')).replace('\\', '/')
            url = f"/{slug}/"
            category = str(rel_path.parent).replace('\\', '/')
            if category == '.':
                category = 'default'
            
            content = read_file(md_file)
            meta, body = parse_markdown(content)
            html_body = md_to_html(body)
            
            # Generate excerpt
            excerpt = re.sub(r'[#*`\[\]()]', '', body[:300]).strip()
            
            posts.append({
                'title': meta.get('title', 'Untitled'),
                'date': meta.get('date', '1970-01-01'),
                'tags': meta.get('tags', []),
                'category': category,
                'url': url,
                'html': html_body,
                'excerpt': excerpt
            })
    
    # Sort by date
    posts.sort(key=lambda x: x['date'], reverse=True)
    
    print(f"Found {len(posts)} posts")
    
    # Generate tag map
    tag_map = {}
    for post in posts:
        for tag in post.get('tags', []):
            if tag not in tag_map:
                tag_map[tag] = []
            tag_map[tag].append(post)
    
    # Generate index page
    per_page = config.get('postsPerPage', 6)
    total_pages = max(1, (len(posts) + per_page - 1) // per_page)
    
    for page in range(1, total_pages + 1):
        start = (page - 1) * per_page
        page_posts = posts[start:start + per_page]
        
        posts_html = ''.join([
            f'''
    <article class="post-card">
      <a href="{p['url']}" class="post-card-link">
        <div class="post-card-cover"></div>
        <div class="post-card-body">
          <h2 class="post-card-title">{p['title']}</h2>
          <div class="post-card-meta">
            <time>{format_date(p['date'])}</time>
            <span>{p['category']}</span>
          </div>
          <p class="post-card-excerpt">{p['excerpt'][:150]}...</p>
          <div class="post-card-tags">
            {''.join(f'<span class="tag">{t}</span>' for t in p.get('tags', [])[:3])}
          </div>
        </div>
      </a>
    </article>''' for p in page_posts
        ])
        
        # Pagination
        pagination = ''
        if total_pages > 1:
            pages = ''.join([
                f'<a href="{"/" if i == 1 else f"/page/{i}/"}" class="page-link{" active" if i == page else ""}">{i}</a>'
                for i in range(1, total_pages + 1)
            ])
            pagination = f'<nav class="pagination">{pages}</nav>'
        
        # Tags cloud
        tags_html = ''.join([
            f'<a href="/tag/{tag}/" class="tag">{tag} <small>({len(posts)})</small></a>'
            for tag, posts in sorted(tag_map.items(), key=lambda x: -len(x[1]))[:10]
        ])
        
        content = f'''
    <div class="page-header">
      <h1 class="site-title">{config['title']}</h1>
      <p class="site-subtitle">{config.get('subtitle', '')}</p>
      <p class="site-description">{config['description']}</p>
    </div>
    <div class="posts-grid">
{posts_html}
    </div>
{pagination}
    <div class="tags-section card-glass">
      <h3>热门标签</h3>
      <div class="tags-cloud">
        {tags_html}
      </div>
    </div>
'''
        
        if page == 1:
            html = generate_layout(config, None, content)
            write_file(DIST / "index.html", html)
        else:
            html = generate_layout(config, f"第 {page} 页", content)
            write_file(DIST / f"page" / f"{page}" / "index.html", html)
    
    # Generate post pages
    for i, post in enumerate(posts):
        prev_post = posts[i + 1] if i < len(posts) - 1 else None
        next_post = posts[i - 1] if i > 0 else None
        
        tags_html = ''.join([f'<a href="/tag/{t}/" class="tag">{t}</a>' for t in post.get('tags', [])])
        
        prev_link = f'''<a href="{prev_post['url']}" class="post-nav-item prev"><div class="post-nav-label">← 上一篇</div><div class="post-nav-title">{prev_post['title']}</div></a>''' if prev_post else '<div></div>'
        next_link = f'''<a href="{next_post['url']}" class="post-nav-item"><div class="post-nav-label">下一篇 →</div><div class="post-nav-title">{next_post['title']}</div></a>''' if next_post else '<div></div>'
        
        content = f'''
    <article class="post-article">
      <header class="post-header">
        <h1 class="post-title">{post['title']}</h1>
        <div class="post-meta">
          <time>{format_date(post['date'])}</time>
          <span class="post-category">{post['category']}</span>
          <span class="post-tags-inline">{tags_html}</span>
        </div>
      </header>
      <div class="post-content">
{post['html']}
      </div>
      <footer class="post-nav">
        {prev_link}
        {next_link}
      </footer>
    </article>
'''
        
        html = generate_layout(config, post['title'], content)
        write_file(DIST / post['url'].strip('/') / "index.html", html)
    
    # Generate tag pages
    for tag, tag_posts in tag_map.items():
        posts_html = ''.join([
            f'''
    <article class="post-card">
      <a href="{p['url']}" class="post-card-link">
        <div class="post-card-cover"></div>
        <div class="post-card-body">
          <h2 class="post-card-title">{p['title']}</h2>
          <div class="post-card-meta">
            <time>{format_date(p['date'])}</time>
            <span>{p['category']}</span>
          </div>
          <p class="post-card-excerpt">{p['excerpt'][:150]}...</p>
        </div>
      </a>
    </article>''' for p in tag_posts
        ])
        
        content = f'''
    <div class="page-header">
      <h1 class="page-title">🏷️ {tag}</h1>
      <p class="page-description">共 {len(tag_posts)} 篇文章</p>
    </div>
    <div class="posts-grid">
{posts_html}
    </div>
'''
        
        html = generate_layout(config, f"标签: {tag}", content)
        write_file(DIST / "tag" / tag / "index.html", html)
    
    # Generate all tags page
    tags_html = ''.join([
        f'''<a href="/tag/{tag}/" class="tag tag-large">{tag} <span class="tag-count">{len(posts)}</span></a>'''
        for tag, posts in sorted(tag_map.items(), key=lambda x: -len(x[1]))
    ])
    
    content = f'''
    <div class="page-header">
      <h1 class="page-title">🏷️ 所有标签</h1>
      <p class="page-description">共 {len(tag_map)} 个标签</p>
    </div>
    <div class="tags-cloud-large">
{tags_html}
    </div>
'''
    
    html = generate_layout(config, "所有标签", content)
    write_file(DIST / "tags" / "index.html", html)
    
    # Generate about page
    about_md = CONTENT / "pages" / "about.md"
    if about_md.exists():
        meta, body = parse_markdown(read_file(about_md))
        about_html = md_to_html(body)
        
        callsign_card = ''
        if config.get('callsign'):
            callsign_card = f'''
    <div class="about-card card-glass">
      <h2>📡 业余无线电信息</h2>
      <div class="callsign-display">{config['callsign']}</div>
    </div>'''
        
        content = f'''
    <div class="page-header">
      <h1 class="page-title">👋 关于</h1>
    </div>
    <div class="about-content">
      <div class="about-main card-glass">
{about_html}
      </div>
      {callsign_card}
    </div>
'''
        
        html = generate_layout(config, "关于", content)
        write_file(DIST / "about" / "index.html", html)
    
    # Generate friends page
    friends_file = ROOT / "data" / "friends.json"
    if friends_file.exists():
        friends = json.loads(read_file(friends_file))
        
        friends_html = ''
        groups = {}
        for f in friends:
            g = f.get('group', 'other')
            if g not in groups:
                groups[g] = []
            groups[g].append(f)
        
        group_names = {'ham': 'HAM 友台', 'tech': '技术博客', 'life': '生活随笔', 'other': '其他友链'}
        
        for group, items in groups.items():
            cards = ''.join([
                f'''<a href="{f['url']}" class="friend-card" target="_blank" rel="noopener">
          <img class="friend-avatar" src="{f.get('avatar', '/favicon.svg')}" alt="{f['name']}" loading="lazy">
          <div class="friend-info">
            <div class="friend-name">{f['name']}</div>
            <div class="friend-desc">{f.get('desc', '')}</div>
          </div>
        </a>''' for f in items
            ])
            
            friends_html += f'''
    <section class="friends-group">
      <h2 class="group-title">{group_names.get(group, group)}</h2>
      <div class="friends-grid">
        {cards}
      </div>
    </section>'''
        
        content = f'''
    <div class="page-header">
      <h1 class="page-title">🔗 友情链接</h1>
      <p class="page-description">{len(friends)} 位朋友的站点</p>
    </div>
    <div class="friends-content">
{friends_html}
    </div>
'''
        
        html = generate_layout(config, "友情链接", content)
        write_file(DIST / "friends" / "index.html", html)
    
    print("Build complete!")
    print(f"Output: {DIST.absolute()}")
    print(f"{len(posts)} posts")
    print(f"{len(tag_map)} tags")
    print(f"\nOpen: {DIST / 'index.html'}")

if __name__ == "__main__":
    build()
