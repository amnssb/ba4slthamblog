# Frontend Documentation - 前端界面文档

---

## Overview - 概述

管理后台前端使用原生 HTML/CSS/JavaScript，无框架依赖。

**Files**: `admin/public/`
- `index.html` - 页面结构
- `app.js` - 交互逻辑
- `style.css` - 样式

---

## File Structure - 文件结构

```
admin/public/
├── index.html          # Main HTML structure
├── app.js             # JavaScript logic
└── style.css          # Styles (Glassmorphism design)
```

---

## HTML Structure - HTML 结构

### Views - 视图

管理后台包含以下视图（单页面应用）：

| View ID | Description | 说明 |
|---------|-------------|------|
| `view-dashboard` | Dashboard | 仪表盘 |
| `view-posts` | Article management | 文章管理 |
| `view-editor` | Article editor | 文章编辑器 |
| `view-logs` | QSO logs | 通联日志 |
| `view-log-editor` | Log editor | 日志编辑器 |
| `view-friends` | Friends links | 友链管理 |
| `view-about` | About page | 关于页面 |
| `view-images` | Image management | 图片管理 |
| `view-tags` | Tag management | 标签管理 |
| `view-nav` | Navigation menu | 导航菜单 |
| `view-settings` | Site settings | 站点设置 |
| `view-theme` | Theme settings | 主题设置 |

### Key HTML Elements - 关键 HTML 元素

#### Navigation Sidebar - 导航侧边栏

```html
<nav class="sidebar-nav">
  <a href="#dashboard" class="nav-item" data-view="dashboard">
    <span class="nav-icon">📊</span>
    <span class="nav-text">仪表盘</span>
  </a>
  <!-- ... -->
</nav>
```

#### Post Card - 文章卡片

```html
<div class="post-card glass" onclick="editPost('path')">
  <div class="post-card-header">
    <div class="post-card-cover"></div>
    <div class="post-card-info">
      <div class="post-card-title">Title</div>
      <div class="post-card-meta">Date · Category</div>
    </div>
  </div>
  <div class="post-card-tags">
    <span class="tag">tag1</span>
  </div>
  <div class="post-card-actions">
    <button class="glass-btn btn-sm" onclick="editPost('path')">编辑</button>
    <button class="glass-btn btn-sm" onclick="exportPost('path')">导出</button>
    <button class="glass-btn btn-sm btn-danger" onclick="deletePost('path')">删除</button>
  </div>
</div>
```

#### Editor Tabs - 编辑器标签

```html
<div class="editor-tabs">
  <button class="tab-btn active" data-tab="write">编辑</button>
  <button class="tab-btn" data-tab="preview">预览</button>
</div>
<div class="tab-content" id="tab-write">
  <textarea id="post-content"></textarea>
</div>
<div class="tab-content hidden" id="tab-preview">
  <div class="preview-content"></div>
</div>
```

---

## JavaScript Functions - JavaScript 函数

### Global State - 全局状态

```javascript
let posts = [];           // 文章列表
let logs = [];            // 通联日志列表
let friends = [];         // 友链列表
let config = {};          // 站点配置
let editingPost = null;   // 正在编辑的文章路径
let editingLog = null;    // 正在编辑的日志路径
```

### Core Functions - 核心函数

#### fetchJson(url, options)
通用请求函数

```javascript
async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || '请求失败');
  }
  return data;
}
```

#### switchView(view)
切换视图

```javascript
function switchView(view) {
  // Hide all views
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  // Show target view
  document.getElementById(`view-${view}`)?.classList.add('active');
  // Load data for the view
  switch(view) {
    case 'posts': loadPosts(); break;
    case 'logs': loadLogs(); break;
    // ...
  }
}
```

#### showToast(message, type)
显示提示

```javascript
function showToast(message, type = 'info') {
  // type: 'success', 'error', 'info'
  // Auto-dismiss after 3 seconds
}
```

### Post Management - 文章管理

```javascript
async function loadPosts()           // 加载文章列表
async function editPost(path)        // 编辑文章
async function savePost()            // 保存文章
async function deletePost(path)      // 删除文章
async function exportPost(path)      // 导出文章
function renderPostsList()           // 渲染文章列表
```

### Log Management - 通联日志管理

```javascript
async function loadLogs()            // 加载日志列表
async function editLog(path)         // 编辑日志
async function saveLog()             // 保存日志
async function deleteLog(path)       // 删除日志
function renderLogsTable()           // 渲染日志表格
```

### Settings - 设置

```javascript
async function loadSettings()        // 加载设置
async function generateSummary()     // AI 生成摘要
```

---

## CSS Classes - CSS 类

### Layout - 布局

| Class | Description | 说明 |
|-------|-------------|------|
| `.sidebar` | Left navigation | 左侧导航栏 |
| `.main-content` | Main area | 主内容区 |
| `.view` | View container | 视图容器 |
| `.glass` | Glassmorphism card | 玻璃态卡片 |

### Components - 组件

| Class | Description | 说明 |
|-------|-------------|------|
| `.btn-primary` | Primary button | 主要按钮 |
| `.glass-btn` | Glass button | 玻璃按钮 |
| `.glass-input` | Glass input | 玻璃输入框 |
| `.glass-textarea` | Glass textarea | 玻璃文本域 |
| `.tag` | Tag pill | 标签 |
| `.post-card` | Post card | 文章卡片 |

### Utilities - 工具

| Class | Description | 说明 |
|-------|-------------|------|
| `.hidden` | Hide element | 隐藏元素 |
| `.active` | Active state | 激活状态 |
| `.loading` | Loading state | 加载状态 |
| `.empty` | Empty state | 空状态 |

---

## WebSocket Events - WebSocket 事件

### Connection - 连接

```javascript
const ws = new WebSocket(`ws://${location.host}`);

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  switch(msg.type) {
    case 'reload':
      // File changed, reload preview
      break;
    case 'build':
      // Build status update
      if (msg.status === 'success') {
        showToast('构建成功', 'success');
      } else {
        showToast('构建失败: ' + msg.message, 'error');
      }
      break;
  }
};
```

---

## Adding New Features - 添加新功能

### Step 1: Add HTML - 添加 HTML

```html
<section id="view-new-feature" class="view">
  <div class="view-header">
    <h2 class="page-title">新功能</h2>
  </div>
  <div class="content">
    <!-- Your content -->
  </div>
</section>
```

### Step 2: Add Navigation - 添加导航

```html
<a href="#new-feature" class="nav-item" data-view="new-feature">
  <span class="nav-icon">🔧</span>
  <span class="nav-text">新功能</span>
</a>
```

### Step 3: Add JavaScript - 添加 JavaScript

```javascript
async function loadNewFeature() {
  const data = await fetchJson('/api/new-feature');
  // Render data
}

// In initNavigation() or switchView
case 'new-feature': loadNewFeature(); break;
```

### Step 4: Add API Route - 添加 API 路由

In `admin/server.js`:

```javascript
app.get('/api/new-feature', (req, res) => {
  // Return data
  res.json({ data: [] });
});
```

---

## Common Issues - 常见问题

### Issue: Config not loading - 配置未加载

**Solution**: Ensure config is loaded in DOMContentLoaded:

```javascript
document.addEventListener('DOMContentLoaded', async () => {
  config = await fetchJson('/api/config');
  // ...
});
```

### Issue: Form data not saving - 表单数据未保存

**Check**:
1. Input has correct `id`
2. JavaScript correctly reads value: `document.getElementById('field').value`
3. API endpoint exists and returns success

### Issue: View not switching - 视图未切换

**Check**:
1. View has correct `id`: `view-{name}`
2. Navigation has `data-view="{name}"`
3. `switchView()` is called correctly

---

## Best Practices - 最佳实践

1. **Always use `fetchJson`** for API calls - handles errors
2. **Use `showToast`** for user feedback
3. **Check element exists** before accessing: `element?.value`
4. **Prevent event bubbling** for nested click handlers
5. **Clean up WebSocket** on page unload
