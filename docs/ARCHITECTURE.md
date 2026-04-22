# Architecture - 架构文档

---

## Overview - 概述

This blog system uses two components:

这个博客系统由两个组件组成：

1. **Static Site Generator (Node.js)** - 静态站点生成器
2. **Management Backend (Express.js)** - 管理后台

---

## System Diagram - 系统图

```
┌─────────────────────────────────────────────────────────────┐
│ User Browser - 用户浏览器                                      │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          │
                          │
                          │
                          │
                          │
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ Admin UI (index.html, app.js, style.css)                     │
│  └─ WebSocket (realtime preview)                            │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              │ REST API
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ Express Server (admin/server.js)                             │
│  ├─ Multer (file uploads)                                  │
│  ├─ Chokidar (file watch)                                 │
│  └─ WebSocket Server                                       │
└───────────────────┬─────────────────────────────────────────┘
                    │
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ File System - 文件系统                                        │
│  ├─ config.json                                             │
│  ├─ content/posts/*.md (articles)                          │
│  ├─ content/logs/*.json (QSO logs)                         │
│  └─ public/images/* (uploaded images)                       │
└───────────────────┬─────────────────────────────────────────┘
                    │
                    │ Build
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ src/build.js                                                 │
│  ├─ src/lib/markdown.js (parses Markdown)                 │
│  ├─ src/lib/utils.js (utilities)                           │
│  └─ src/templates/*.js (renders HTML)                     │
└───────────────────┬─────────────────────────────────────────┘
                    │
                    │ Output
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ dist/ (Generated static site)                               │
│  ├─ index.html                                              │
│  ├─ post/...                                                │
│  └─ assets/...                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Directory Structure - 目录结构

```
ba4slthamblog/
│
├── admin/                              # Admin Backend - 管理后台
│   ├── server.js                      # Express server
│   ├── package.json
│   └── public/                        # Management UI
│       ├── index.html
│       ├── app.js                    # Frontend JS
│       └── style.css
│
├── src/                                # Site Generator - 站点生成器
│   ├── build.js                      # Build script
│   ├── lib/                         # Library modules
│   │   ├── markdown.js             # Markdown parser
│   │   ├── utils.js                # Utility functions
│   │   ├── files.js                # File utilities
│   │   ├── rss.js                  # RSS generator
│   │   ├── sitemap.js              # Sitemap generator
│   │   └── search.js               # Search indexer
│   │
│   ├── templates/                   # Page templates
│   │   ├── layout.js              # Layout
│   │   ├── index.js               # Homepage
│   │   ├── post.js                # Post page
│   │   ├── logs.js                # Logs page
│   │   ├── tag.js                 # Tag page
│   │   ├── friends.js             # Friends page
│   │   └── about.js               # About page
│   │
│   └── assets/                     # Assets
│       ├── style.css             # Styles
│       └── script.js             # Scripts
│
├── content/                            # Content - 内容
│   ├── posts/                        # Articles
│   │   └── {category}/
│   │       └── {slug}.md
│   ├── logs/                         # QSO logs
│   │   └── {slug}.json
│   └── pages/                        # Pages
│       └── about.md
│
├── data/                               # Data - 数据
│   └── friends.json                 # Friends links
│
├── themes/                             # Themes - 主题
│   └── {theme-name}/
│       ├── theme.json
│       └── preview.png
│
├── public/                             # Public - 公共资源
│   ├── images/                       # Uploaded images
│   └── favicon.ico
│
├── dist/                               # Build output - 构建输出
│   └── (generated static site)
│
├── config.json                         # Site config
├── package.json
└── wrangler.toml                      # Cloudflare Pages config
```

---

## Core Modules - 核心模块

### Server Modules (admin/server.js)

The server is structured into these main sections:

服务器被组织成以下主要部分：

| Section | Description - 说明 |
|---------|----------------|
| `Configuration` | Path and port setup - 路径和端口设置 |
| `File Uploads` | Multer config for images and favicon - 文件上传配置 |
| `WebSocket Broadcast` | Live preview broadcast - 实时预览广播 |
| `Utility Functions` | `resolveContentPath`, `readJsonSafely`, etc. - 工具函数 |
| `Frontmatter Parser` | Parses YAML from Markdown - Frontmatter 解析器 |
| `File Watcher` | Chokidar to watch content files - 文件监听 |
| `AI API Caller` | Makes requests to OpenAI-compatible APIs - AI API 调用 |
| `Routes` | API endpoints - API 路由 |

### Static Site Generator (src/build.js)

Build pipeline:

构建流程：

```
1. Load config
2. Scan posts from content/posts/
3. Scan logs from content/logs/
4. Build pages:
   - Index
   - Posts
   - Tags
   - Logs
   - About
   - Friends
5. Generate RSS
6. Generate sitemap
7. Copy assets
```

---

## Data Flow - 数据流

### Article Editing - 文章编辑

```
User
  │
  │ Edit in Admin
  ▼
browser → app.js → fetch('/api/posts') → server.js
                                             │
                                             │ Write file
                                             ▼
                                    content/posts/daily/hello-world.md
                                             │
                                             │
                                             │ File changed (Chokidar)
                                             │
                                             └── Broadcast reload → WebSocket
                                                              │
User ←──────────────────────────────────────────────────────────┘
    (Live preview)
```

### Build - 构建

```
User clicks "Build"
    │
    └─ POST /api/build
        │
        ├─ exec: node src/build.js
        │
        ├─ Build dist/
        │
        └─ Broadcast build:success
```

---

## API Router - API 路由

All routes are defined in `admin/server.js`.

所有路由在 `admin/server.js` 中定义。

```
/api/
├── posts/
│   ├── GET         -> get all posts
│   ├── POST        -> create/update post
│   └── {path}/
│       ├── GET     -> get single post
│       ├── DELETE  -> delete post
│       └── export  -> export for sync
├── logs/
│   ├── GET         -> get all logs
│   ├── POST        -> create/update log
│   └── {path}/
│       ├── GET     -> get single log
│       └── DELETE  -> delete log
├── config/
│   ├── GET         -> get config
│   └── POST        -> update config
├── friends/
│   ├── GET         -> get friends
│   └── POST        -> update friends
├── about/
│   ├── GET         -> get about page
│   └── POST        -> update about page
├── upload/
│   └── POST        -> upload image
├── images/
│   ├── GET         -> list images
│   └── {filename}
│       └── DELETE  -> delete image
├── favicon/
│   ├── POST        -> upload favicon
│   └── DELETE      -> remove favicon
├── ai/
│   ├── test        -> test API
│   └── summary     -> generate summary
└── build/
    └── POST        -> trigger build
```

---

## Security Considerations - 安全注意事项

1. **Config File Protection**: `config.json` added to `.gitignore`
2. **Path Validation**: `resolveContentPath` and `resolveLogsPath` prevent directory traversal attacks
3. **Image Uploads**: Check file extensions and MIME types
4. **Frontend Does NOT Have Access**: No API keys exposed to frontend

1. **配置文件保护**：`config.json` 已添加到 `.gitignore`
2. **路径验证**：`resolveContentPath` 和 `resolveLogsPath` 防止目录遍历攻击
3. **图片上传**：检查文件扩展名和 MIME 类型
4. **前端无法访问**：API 密钥不会暴露给前端

---

## Extensibility - 可扩展性

### Adding a New Page - 添加新页面

1. Create template in `src/templates/{page-name}.js`
2. Add generation in `src/build.js`
3. Update config/navigation

### Adding a New API - 添加新 API

1. Add route handler in `admin/server.js`
2. Add fetch call in `admin/public/app.js`
3. Add UI in `admin/public/index.html`
