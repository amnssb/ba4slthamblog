# 跨站点文章同步指南

## 功能说明

这个功能允许你将本博客（业余无线电站）的文章导出，然后导入到你的个人博客站点。

## 导出文章

### 方法一：管理后台导出

1. 登录博客管理后台
2. 进入"文章管理"页面
3. 每篇文章卡片上都有"📤 导出"按钮
4. 点击导出，会下载一个 JSON 文件

### 方法二：API 直接访问

```
GET /api/posts/{文章路径}/export
```

例如：
```
GET /api/posts/daily/hello-world.md/export
```

## 导出文件格式

导出的 JSON 文件包含以下内容：

```json
{
  "source": {
    "site": "ham-radio-blog",
    "url": "/posts/daily/hello-world",
    "exportedAt": "2024-01-20T10:30:00.000Z"
  },
  "post": {
    "title": "文章标题",
    "date": "2024-01-20",
    "category": "daily",
    "tags": ["tag1", "tag2"],
    "summary": "文章摘要",
    "cover": "https://example.com/cover.jpg",
    "content": "原始 Markdown 内容",
    "html": "渲染后的 HTML",
    "slug": "daily/hello-world"
  },
  "meta": {
    "version": "1.0",
    "type": "cross-site-export"
  }
}
```

## 在个人博客导入

### 导入脚本示例

```javascript
// import-post.js
const fs = require('fs');
const path = require('path');

function importPost(exportFilePath) {
  const data = JSON.parse(fs.readFileSync(exportFilePath, 'utf-8'));
  
  // 构建 Frontmatter
  const frontmatter = `---
title: ${data.post.title}
date: ${data.post.date}
category: ${data.post.category}
tags: [${data.post.tags.join(', ')}]
${data.post.summary ? `summary: ${data.post.summary}` : ''}
${data.post.cover ? `cover: ${data.post.cover}` : ''}
source: ${data.source.site}
original_url: ${data.source.url}
---

${data.post.content}

---
*本文转载自 [${data.source.site}](${data.source.url})*
`;

  // 保存到个人博客的文章目录
  const outputPath = path.join('content', 'posts', 'reposts', `${data.post.slug}.md`);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, frontmatter, 'utf-8');
  
  console.log(`Imported: ${outputPath}`);
}

// 使用
importPost('./export-hello-world.json');
```

### 显示效果

在个人博客中，这些文章会显示为"转载"，并带有来源链接。

## 自动化同步

如果你想定期同步，可以创建一个定时任务：

```bash
# 导出所有文章
curl http://your-ham-blog/api/posts.json > /tmp/all-posts.json

# 处理并导入到个人博客
node import-script.js
```

## 注意事项

1. 导出的文章包含原始 Markdown，可以在个人博客重新渲染
2. 建议保留 `source` 字段，标明文章来源
3. 图片链接可能需要处理（如果使用了相对路径）
4. 可以修改 `category` 为"转载"或"业余无线电"等
