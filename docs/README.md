# Blog Technical Documentation - 博客技术文档

---

## Table of Contents - 文档目录

| Document | Status | Description - 说明 |
|----------|--------|----------------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | ✅ Complete | System architecture and file structure - 系统架构和文件结构 |
| [API.md](./API.md) | ✅ Complete | REST API documentation - REST API 文档 |
| [DATA_FORMATS.md](./DATA_FORMATS.md) | ✅ Complete | Data formats and file schemas - 数据格式和文件架构 |
| DEVELOPMENT.md | ⏳ Planned | Development guide - 开发指南 |
| THEMES.md | ⏳ Planned | Theme development guide - 主题开发指南 |

---

## Project Overview - 项目概述

This is a static-site blog with a dynamic management backend.

这是一个静态站点博客，带有动态管理后台。

**Key Features - 主要功能**:
- ✅ Static site generator (Node.js) - 静态站点生成器
- ✅ Express.js management backend - Express.js 管理后台
- ✅ Live preview WebSocket - 实时预览 WebSocket
- ✅ Markdown articles with frontmatter - Markdown 文章和 Frontmatter
- ✅ QSO/ham radio logs - 通联日志
- ✅ Giscus comments integration - Giscus 评论集成
- ✅ AI-powered article summaries - AI 摘要
- ✅ Cross-site sync - 跨站同步
- ✅ Glassmorphism UI - 玻璃态 UI
- ✅ Theme support - 主题支持

---

## Getting Started - 快速开始

### Installation - 安装

```bash
# Clone or download project - 克隆或下载项目
cd ba4slthamblog

# Install blog dependencies - 安装博客依赖
npm install

# Install admin dependencies - 安装后台依赖
cd admin
npm install
```

### Start Admin Server - 启动管理后台

```bash
cd admin
node server.js
```

Now open http://localhost:3456 in your browser.

浏览器打开 http://localhost:3456

### Build Static Site - 构建静态站点

**Through Admin**: Click "Build" button in management UI.

通过管理后台：点击管理界面的 "Build" 按钮。

**Through CLI**:

```bash
npm run build
```

---

## Project Structure - 项目结构

```
ba4slthamblog/
├── admin/                    # Admin backend - 管理后台
│   ├── server.js            # Express server
│   ├── public/
│   │   ├── index.html       # Admin UI
│   │   ├── app.js           # Admin frontend logic
│   │   └── style.css        # Admin styles
│   └── package.json
│
├── content/                  # Content - 内容目录
│   ├── posts/               # Articles - 文章
│   ├── logs/                # Ham logs - 通联日志
│   └── pages/               # Pages - 页面
│
├── src/                      # Static site generator - 静态站点生成
│   ├── build.js             # Build script
│   ├── templates/           # Templates
│   ├── lib/                 # Libraries
│   └── assets/              # CSS/JS assets
│
├── themes/                   # Theme files - 主题文件
│
├── data/                     # Data files - 数据文件
│   └── friends.json         # Friends links
│
├── public/                   # Public assets - 公共资源
│   └── images/
│
├── docs/                     # Documentation - 文档
│   ├── README.md
│   ├── ARCHITECTURE.md
│   ├── API.md
│   └── DATA_FORMATS.md
│
├── config.json               # Configuration file - 配置
└── package.json
```

---

## Quick Reference - 快速参考

### Configuration - 配置

See [DATA_FORMATS.md](./DATA_FORMATS.md) for config schema.

查看 [DATA_FORMATS.md](./DATA_FORMATS.md) 了解配置格式。

### Admin API - 管理后台 API

See [API.md](./API.md) for complete API reference.

查看 [API.md](./API.md) 了解完整 API。

### Article Format - 文章格式

```markdown
---
title: Article Title
date: 2024-01-20
category: daily
tags: ["tag1", "tag2"]
summary: "Summary..."
cover: https://example.com/cover.jpg
---

Article content in Markdown...
```

---

## TODO - 待办

- [ ] Complete DEVELOPMENT.md
- [ ] Complete THEMES.md
- [ ] Add unit tests
- [ ] Add more themes
