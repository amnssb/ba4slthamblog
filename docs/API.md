# API Documentation - API 文档

**Base URL**: `http://localhost:3456`

---

## Table of Contents - 目录

1. [Posts - 文章管理](#posts)
2. [Logs - 通联日志](#logs)
3. [Config - 配置](#config)
4. [Friends - 友链](#friends)
5. [Images - 图片](#images)
6. [About - 关于页面](#about)
7. [AI - AI API](#ai)
8. [Build - 构建](#build)

---

## Posts - 文章管理

### Get All Posts - 获取所有文章

**Endpoint**: `GET /api/posts`

**Description**: 获取所有文章列表，按日期降序排列

**Response**:

```json
[
  {
    "title": "Hello World",
    "date": "2024-01-20",
    "tags": ["daily", "blog"],
    "category": "daily",
    "summary": "文章摘要...",
    "cover": "https://example.com/cover.jpg",
    "path": "posts/daily/hello-world.md",
    "filename": "hello-world.md"
  }
]
```

### Get Single Post - 获取单篇文章

**Endpoint**: `GET /api/posts/*`

**Parameters**:
- `*`: 文章路径，如 `posts/daily/hello-world.md`

**Response**:

```json
{
  "content": "---\ntitle: Hello World\n---\n文章内容...",
  "path": "posts/daily/hello-world.md"
}
```

### Export Post - 导出文章

**Endpoint**: `GET /api/posts/*/export`

**Description**: 导出文章为 JSON 格式，用于跨站同步

**Response**:

```json
{
  "source": {
    "site": "ham-radio-blog",
    "url": "/posts/daily/hello-world",
    "exportedAt": "2024-01-20T10:30:00.000Z"
  },
  "post": {
    "title": "Hello World",
    "date": "2024-01-20",
    "category": "daily",
    "tags": ["daily", "blog"],
    "summary": "文章摘要",
    "cover": "https://example.com/cover.jpg",
    "content": "原始 Markdown 内容",
    "html": "<p>渲染后的 HTML</p>",
    "slug": "posts/daily/hello-world"
  },
  "meta": {
    "version": "1.0",
    "type": "cross-site-export"
  }
}
```

### Create/Update Post - 创建/更新文章

**Endpoint**: `POST /api/posts`

**Request Body**:

```json
{
  "path": "posts/daily/hello-world.md",
  "content": "---\ntitle: Hello World\n---\n文章内容..."
}
```

**Response**:

```json
{
  "success": true
}
```

### Delete Post - 删除文章

**Endpoint**: `DELETE /api/posts/*`

**Response**:

```json
{
  "success": true
}
```

---

## Logs - 通联日志

### Get All Logs - 获取所有通联日志

**Endpoint**: `GET /api/logs`

**Response**:

```json
[
  {
    "callsign": "BA1ABC",
    "frequency": "14.250",
    "mode": "SSB",
    "date": "2024-01-20",
    "time": "10:30",
    "rst": "59",
    "notes": "通联记录",
    "path": "logs/2024-01-20.json"
  }
]
```

### Get Single Log - 获取单条通联日志

**Endpoint**: `GET /api/logs/*`

### Create/Update Log - 创建/更新通联日志

**Endpoint**: `POST /api/logs`

**Request Body**:

```json
{
  "path": "logs/2024-01-20.json",
  "data": {
    "callsign": "BA1ABC",
    "frequency": "14.250",
    "mode": "SSB",
    "date": "2024-01-20",
    "time": "10:30",
    "rst": "59"
  }
}
```

### Delete Log - 删除通联日志

**Endpoint**: `DELETE /api/logs/*`

---

## Config - 配置

### Get Config - 获取配置

**Endpoint**: `GET /api/config`

**Response**:

```json
{
  "title": "BA4SLT",
  "subtitle": "业余无线电博客",
  "description": "业余无线电博客的描述",
  "author": "BA4SLT",
  "callsign": "BA4SLT",
  "email": "email@example.com",
  "url": "https://your-blog.com",
  "postsPerPage": 10,
  "favicon": "https://example.com/favicon.ico",
  "theme": "anime-sakura",
  "giscus": {
    "repo": "user/repo",
    "repoId": "R_xxxxx",
    "category": "General",
    "categoryId": "DIC_xxxxx"
  },
  "ai": {
    "provider": "deepseek",
    "apiKey": "sk-xxxxx",
    "model": "deepseek-chat",
    "customUrl": ""
  },
  "nav": [
    { "label": "首页", "url": "/" },
    { "label": "通联日志", "url": "/logs/" }
  ]
}
```

### Update Config - 更新配置

**Endpoint**: `POST /api/config`

**Request Body**: 与 GET 响应相同的结构

**Response**:

```json
{
  "success": true
}
```

---

## Friends - 友链

### Get Friends - 获取友链列表

**Endpoint**: `GET /api/friends`

**Response**:

```json
[
  {
    "name": "友链名称",
    "url": "https://friend-blog.com",
    "avatar": "https://friend-blog.com/avatar.jpg",
    "description": "友链描述"
  }
]
```

### Update Friends - 更新友链列表

**Endpoint**: `POST /api/friends`

---

## Images - 图片

### Upload Image - 上传图片

**Endpoint**: `POST /api/upload`

**Content-Type**: `multipart/form-data`

**Form Fields**:
- `image`: 图片文件

**Response**:

```json
{
  "success": true,
  "url": "/images/1716215450000-photo.jpg",
  "path": "/path/to/images/1716215450000-photo.jpg"
}
```

### Get Images - 获取图片列表

**Endpoint**: `GET /api/images`

**Response**:

```json
[
  {
    "name": "1716215450000-photo.jpg",
    "url": "/images/1716215450000-photo.jpg"
  }
]
```

### Delete Image - 删除图片

**Endpoint**: `DELETE /api/images/:filename`

---

## About - 关于页面

### Get About - 获取关于页面

**Endpoint**: `GET /api/about`

**Response**:

```json
{
  "content": "关于页面内容..."
}
```

### Update About - 更新关于页面

**Endpoint**: `POST /api/about`

**Request Body**:

```json
{
  "content": "新的关于页面内容"
}
```

---

## AI - AI API

### Test AI Connection - 测试 AI 连接

**Endpoint**: `POST /api/ai/test`

**Request Body**:

```json
{
  "provider": "deepseek",
  "apiKey": "sk-xxxxx",
  "model": "deepseek-chat",
  "customUrl": ""
}
```

**Response**:

```json
{
  "success": true
}
```

### Generate Summary - 生成摘要

**Endpoint**: `POST /api/ai/summary`

**Request Body**:

```json
{
  "content": "文章内容，用于生成摘要...",
  "provider": "deepseek",
  "apiKey": "sk-xxxxx",
  "model": "deepseek-chat",
  "customUrl": ""
}
```

**Response**:

```json
{
  "summary": "生成的摘要内容..."
}
```

---

## Build - 构建

### Build Site - 构建站点

**Endpoint**: `POST /api/build`

**WebSocket Events** - WebSocket 事件

When build succeeds:

```json
{
  "type": "build",
  "status": "success"
}
```

When build fails:

```json
{
  "type": "build",
  "status": "error",
  "message": "Error message"
}
```

When file changes:

```json
{
  "type": "reload",
  "file": "/path/to/changed/file"
}
```

---

## WebSocket - WebSocket

**Connect to**: `ws://localhost:3456`

WebSocket server sends build events and file change events.

---

## Error Handling - 错误处理

All endpoints return errors in the format:

```json
{
  "error": "Error message description"
}
```

**HTTP Status Codes**:
- `200` - Success
- `400` - Bad Request
- `404` - Not Found
- `500` - Server Error

---

## Example Usage - 使用示例

### JavaScript

```javascript
async function fetchPosts() {
  const response = await fetch('http://localhost:3456/api/posts');
  const posts = await response.json();
  console.log(posts);
}

async function savePost(path, content) {
  const response = await fetch('http://localhost:3456/api/posts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, content })
  });
  return await response.json();
}
```

### cURL

```bash
# 获取文章
curl http://localhost:3456/api/posts

# 保存文章
curl -X POST http://localhost:3456/api/posts \
  -H "Content-Type: application/json" \
  -d '{"path": "posts/test.md", "content": "---\ntitle: Test\n---\nContent"}'
```

---
