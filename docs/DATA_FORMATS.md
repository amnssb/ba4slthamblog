# Data Formats - 数据格式文档

---

## Table of Contents - 目录

1. [Config - 配置文件](#config)
2. [Posts - 文章](#posts)
3. [Logs - 通联日志](#logs)
4. [Friends - 友链](#friends)
5. [Themes - 主题](#themes)

---

## Config - 配置文件

**Path**: `config.json`

### Schema:

```json
{
  "title": "BA4SLT",
  "subtitle": "业余无线电博客",
  "description": "个人博客的描述信息",
  "author": "BA4SLT",
  "callsign": "BA4SLT",
  "email": "your@email.com",
  "url": "https://your-blog.com",
  "postsPerPage": 10,
  "favicon": "https://example.com/favicon.ico",
  "theme": "anime-sakura",
  "features": {
    "search": { "enabled": true },
    "friends": { "enabled": true },
    "pwa": { "enabled": false }
  },
  "giscus": {
    "repo": "username/repo",
    "repoId": "R_xxxxx",
    "category": "Announcements",
    "categoryId": "DIC_xxxxx"
  },
  "ai": {
    "provider": "deepseek",
    "apiKey": "sk-xxxxx",
    "model": "deepseek-chat",
    "customUrl": ""
  },
  "nav": [
    {
      "label": "首页",
      "url": "/"
    },
    {
      "label": "通联日志",
      "url": "/logs/"
    }
  ]
}
```

### Fields - 字段说明

| Field | Type | Required | Description - 说明 |
|-------|------|----------|----------------|
| `title` | string | yes | Site title - 网站标题 |
| `subtitle` | string | no | Site subtitle - 网站副标题 |
| `description` | string | no | Site description - 网站描述 |
| `author` | string | no | Author name - 作者名称 |
| `callsign` | string | no | Callsign - 呼号 |
| `email` | string | no | Email - 邮箱 |
| `url` | string | no | Site URL - 网站链接 |
| `postsPerPage` | number | no | Posts per page - 每页文章数 |
| `favicon` | string | no | Favicon URL - Favicon 链接 |
| `theme` | string | no | Theme name - 主题名称 |
| `giscus` | object | no | Giscus comments config - Giscus 评论配置 |
| `giscus.repo` | string | no | Repository - 仓库 |
| `giscus.repoId` | string | no | Repository ID - 仓库 ID |
| `giscus.category` | string | no | Category - 分类 |
| `giscus.categoryId` | string | no | Category ID - 分类 ID |
| `ai` | object | no | AI Summary config - AI 摘要配置 |
| `ai.provider` | string | no | AI Provider - AI 提供商 (`deepseek`, `openai`, `kimi`, `custom`) |
| `ai.apiKey` | string | no | API Key |
| `ai.model` | string | no | Model name - 模型名称 |
| `ai.customUrl` | string | no | Custom API URL - 自定义 API 地址 |
| `nav` | array | no | Navigation items - 导航项目 |

---

## Posts - 文章

**Path**: `content/posts/*/*.md`

### Format - 格式

```markdown
---
title: 文章标题
date: 2024-01-20
tags: ["daily", "blog"]
category: daily
summary: "文章摘要（AI生成或手动填写）
cover: https://example.com/cover.jpg
---

文章内容，支持 Markdown 语法。
```

### Frontmatter Fields - Frontmatter 字段

| Field | Type | Required | Description - 说明 |
|-------|------|----------|----------------|
| `title` | string | yes | Article title - 文章标题 |
| `date` | string | yes | Date (YYYY-MM-DD) - 日期 |
| `category` | string | no | Category - 分类，默认从目录推断 |
| `tags` | array | no | Tags - 标签列表 |
| `summary` | string | no | Summary - 摘要 |
| `cover` | string | no | Cover image URL - 封面图片链接 |

### Example - 示例

**File**: `content/posts/daily/hello-world.md`

```markdown
---
title: Hello World
date: 2024-01-20
tags: ["daily", "blog"]
category: daily
summary: "这是我的第一篇博客文章，介绍我的博客。
cover: https://example.com/cover.jpg
---

# Hello World

欢迎来到我的博客！

这里分享我的业余无线电探索历程。
```

---

## Logs - 通联日志

**Path**: `content/logs/*.json`

### Format - 格式

```json
{
  "title": "通联日志标题",
  "callsign": "BA1ABC",
  "frequency": "14.250",
  "band": "20m",
  "mode": "SSB",
  "date": "2024-01-20",
  "time": "10:30",
  "timezone": "UTC+8",
  "rst": "59",
  "power": "100W",
  "antenna": "Dipole",
  "qsl": true,
  "qslSent": true,
  "qslReceived": true,
  "qslSentDate": "2024-01-21",
  "qslMethod": "Direct",
  "notes": "通联记录...",
  "station": {
    "grid": "PM01",
    "location": "北京"
  }
}
```

### Fields - 字段说明

| Field | Type | Required | Description - 说明 |
|-------|------|----------|----------------|
| `title` | string | no | Log title - 日志标题 |
| `callsign` | string | yes | Station callsign - 呼号 |
| `frequency` | string | yes | Frequency in MHz - 频率 |
| `mode` | string | yes | Mode (SSB, CW, FT8, etc.) - 模式 |
| `date` | string | yes | Date - 日期 |
| `time` | string | no | Time - 时间 |
| `rst` | string | no | Signal report - 信号报告 |
| `power` | string | no | Power - 功率 |
| `antenna` | string | no | Antenna - 天线 |
| `qsl` | boolean | no | Has QSL card - 是否有 QSL 卡 |
| `qslSent` | boolean | no | Sent QSL - 是否已发送 QSL |
| `qslReceived` | boolean | no | Received QSL - 是否已收到 QSL |
| `notes` | string | no | Notes - 备注 |
| `station.grid` | string | no | Station grid - 电台网格 |
| `station.location` | string | no | Station location - 电台位置 |

---

## Friends - 友链

**Path**: `data/friends.json`

### Format - 格式

```json
[
  {
    "name": "友链名称",
    "url": "https://friend-blog.com",
    "avatar": "https://friend-blog.com/avatar.jpg",
    "description": "友链描述"
  },
  {
    "name": "另一个友链",
    "url": "https://another.com",
    "avatar": "https://another.com/avatar.jpg",
    "description": "描述"
  }
]
```

### Fields - 字段说明

| Field | Type | Required | Description - 说明 |
|-------|------|----------|----------------|
| `name` | string | yes | Friend name - 友链名称 |
| `url` | string | yes | Friend URL - 友链地址 |
| `avatar` | string | no | Avatar URL - 头像链接 |
| `description` | string | no | Description - 描述 |

---

## Themes - 主题

**Path**: `themes/{theme-name}/theme.json`

### Format - 格式

```json
{
  "name": "anime-sakura",
  "description": "樱花主题",
  "version": "1.0",
  "author": "Author",
  "colors": {
    "primary": "#ec4899",
    "secondary": "#8b5cf6",
    "background": "#fff0f5",
    "surface": "#ffffff",
    "text": "#1f2937",
    "border": "#e5e7eb"
  }
}
```

### Structure - 主题结构

```
themes/
└── {theme-name}/
    ├── theme.json
    └── preview.png
```

---

## File Structure - 文件结构

```
ba4slthamblog/
├── config.json
├── content/
│   ├── posts/
│   │   └── {category}/
│   │       └── {slug}.md
│   ├── logs/
│   │   └── {slug}.json
│   └── pages/
│       └── about.md
├── data/
│   └── friends.json
├── public/
│   ├── images/
│   └── favicon.ico
├── themes/
│   └── {theme-name}/
│       ├── theme.json
│       └── preview.png
└── docs/
    └── ...
```
