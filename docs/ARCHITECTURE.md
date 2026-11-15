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
│   ├── server.js                      # HTTP 入口：检查请求，调用 src 里的主体
│   ├── ai.js                          # 摘要接口
│   ├── package.json
│   └── public/                        # Management UI
│       ├── index.html
│       ├── app.js                    # Frontend JS
│       └── style.css
│
├── src/                                # 站点生成器。主体平铺在这一层
│   ├── build.js                      # 入口：读主体，写 dist
│   ├── post.js                       # 文章：扫描、分类、排序、导出
│   ├── log.js                        # 通联日志
│   ├── config.js                     # config.json，页面里不带密钥
│   ├── showcase.js                   # hamqsl 对外展示：地址、状态、页面片段
│   ├── friend.js                     # 友链
│   ├── about.js                      # 关于页
│   ├── lib/                         # 没有业务名词的小工具
│   │   ├── markdown.js             # Markdown 和 frontmatter，全项目只此一份
│   │   ├── utils.js                # Utility functions
│   │   ├── files.js                # 读写文件，并挡住逃出目录的路径
│   │   ├── fail.js                 # 带状态码的错误
│   │   ├── pwa.js                  # manifest 和 service worker
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

### 为什么是这个形状

站点和后台是两扇门，读写的是同一批文件。文章、通联日志、配置、友链、关于页各自一个文件，两边都调用它。分类、排序、frontmatter 不在第二个地方再写一遍。

页面模板留在 `src/templates/`。改版式和改一篇文章不是同一件事。首页、文章、标签、日志、友链、关于这几种页面长得不一样，数量也不增加，所以构建入口里直接写出来，不做扫描。

会不断增加的是文章和通联日志。加一篇就是往 `content/posts/` 或 `content/logs/` 放一个文件，不用改代码。

`content/`、`data/`、`config.json` 留在仓库里。它们是要部署的站点本身，不是程序重装以后还该单独留下来的用户数据。密钥不进页面：构建会丢掉整个 `ai` 段，后台接口只返回有没有密钥。密钥放环境变量 `AI_API_KEY`。

### Server Modules (admin/server.js)

`admin/server.js` 只做入口：中间件、静态文件、上传、WebSocket，然后检查请求并调用 `src/` 里的主体。摘要请求在 `admin/ai.js`。错误在这个入口分成用户能改的（400、404）和程序故障（500），两边都带原因。

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

QSL 对外展示不在构建时抓取。`qslShowcase.siteUrl` 为空就不输出组件，也不会请求别的主机。有地址时页面只放挂载点，浏览器再去读公开 JSON。插件未开启（404）不重试；5xx 才退避重试，并且不把失败画成一组 0。

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

1. **Config File**: `config.json` 是站点定义，留在仓库里。API 密钥放 `AI_API_KEY`，不要写进这个文件
2. **Path Validation**: `resolveInside` 挡住爬出内容目录的路径
3. **Image Uploads**: Check file extensions and MIME types
4. **Frontend Does NOT Have Access**: No API keys exposed to frontend

1. **配置文件**：`config.json` 是站点定义，留在仓库里。API 密钥放 `AI_API_KEY`
2. **路径验证**：`resolveInside` 防止目录遍历
3. **图片上传**：检查文件扩展名和 MIME 类型
4. **前端无法访问**：API 密钥不会暴露给前端

---

## Extensibility - 可扩展性

### Adding a Post or Log - 加一篇文章或一条日志

往 `content/posts/{分类}/{slug}.md` 或 `content/logs/{slug}.json` 放文件。构建和后台都会扫到，不用登记。

### Adding a New Page - 添加新页面

首页、文章页、标签页这几种页面不是同一类东西，所以仍然要动两处：

1. Create template in `src/templates/{page-name}.js`
2. Add generation in `src/build.js`

导航文字在 `config.json` 的 `nav` 里改，字段是 `text`、`url`、`icon`。

### Adding a New API - 添加新 API

1. 如果读写的是已有内容，调用 `src/` 里那个主体，不要再解析一遍
2. Add route handler in `admin/server.js`
3. Add fetch call in `admin/public/app.js`
4. Add UI in `admin/public/index.html`
