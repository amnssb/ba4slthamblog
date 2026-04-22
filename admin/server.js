/**
 * Ham Radio Blog - Admin Server
 * 业余无线电博客 - 管理后台服务器
 * 
 * @description Express server providing REST API and WebSocket for live preview
 * @module admin/server
 * 
 * @example
 * # Start the server
 * cd admin && npm install && node server.js
 */

import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { fileURLToPath } from 'url';
import { dirname, join, relative, resolve } from 'path';
import chokidar from 'chokidar';
import { exec } from 'child_process';
import { promisify } from 'util';
import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from 'fs';
import multer from 'multer';
import { processMarkdown } from '../src/lib/markdown.js';

// ==========================================
// CONFIGURATION - 配置
// ==========================================

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const PATHS = {
  CONTENT: join(ROOT, 'content'),
  LOGS: join(ROOT, 'content', 'logs'),
  PUBLIC: join(ROOT, 'public'),
  DIST: join(ROOT, 'dist'),
  PUBLIC_IMAGES: join(ROOT, 'public', 'images'),
  DATA: join(ROOT, 'data'),
};

const PORT = process.env.PORT || 3456;

// ==========================================
// EXPRESS & WEBSOCKET - Express 和 WebSocket
// ==========================================

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.json());
app.use(express.static(join(__dirname, 'public')));
app.use('/images', express.static(PATHS.PUBLIC_IMAGES));
app.use('/preview', express.static(PATHS.DIST));

// ==========================================
// FILE UPLOADS - 文件上传
// ==========================================

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = join(PATHS.PUBLIC, 'images');
    if (!existsSync(uploadPath)) mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});
const upload = multer({ storage });

const faviconStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, PATHS.PUBLIC);
  },
  filename: (req, file, cb) => {
    // Always save as favicon.ico for compatibility
    const ext = file.originalname.split('.').pop().toLowerCase();
    if (['ico', 'png', 'jpg', 'jpeg', 'svg'].includes(ext)) {
      cb(null, 'favicon.ico');
    } else {
      cb(new Error('Invalid favicon format'), null);
    }
  },
});

const faviconUpload = multer({ 
  storage: faviconStorage,
  limits: { fileSize: 1024 * 1024 }, // 1MB limit
  fileFilter: (req, file, cb) => {
    const allowed = ['image/x-icon', 'image/vnd.microsoft.icon', 'image/png', 'image/jpeg', 'image/svg+xml'];
    if (allowed.includes(file.mimetype) || file.originalname.match(/\.(ico|png|jpg|jpeg|svg)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Only .ico, .png, .jpg, .svg files are allowed'));
    }
  }
});

// ==========================================
// WEBSOCKET BROADCAST - WebSocket 广播
// ==========================================

let wsClients = [];

wss.on('connection', (ws) => {
  wsClients.push(ws);
  ws.on('close', () => {
    wsClients = wsClients.filter(c => c !== ws);
  });
});

function broadcast(msg) {
  wsClients = wsClients.filter((client) => client.readyState === 1);
  wsClients.forEach((client) => client.send(JSON.stringify(msg)));
}

// ==========================================
// UTILITY FUNCTIONS - 工具函数
// ==========================================

function toPosixPath(filePath) {
  return filePath.replace(/\\/g, '/');
}

function resolveContentPath(targetPath = '') {
  const fullPath = resolve(PATHS.CONTENT, targetPath);
  const contentRoot = resolve(PATHS.CONTENT);

  if (!fullPath.startsWith(contentRoot)) {
    throw new Error('Invalid content path');
  }

  return fullPath;
}

function resolveLogsPath(targetPath = '') {
  const fullPath = resolve(PATHS.LOGS, targetPath);
  const logsRoot = resolve(PATHS.LOGS);

  if (!fullPath.startsWith(logsRoot)) {
    throw new Error('Invalid log path');
  }

  return fullPath;
}

function readJsonSafely(filePath, fallback = {}) {
  try {
    return JSON.parse(readFileSync(filePath, 'utf-8'));
  } catch {
    return fallback;
  }
}

function scanFilesRecursive(dir, matcher, result = []) {
  if (!existsSync(dir)) return result;

  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      scanFilesRecursive(fullPath, matcher, result);
    } else if (matcher(entry.name, fullPath)) {
      result.push(fullPath);
    }
  }

  return result;
}

// ==========================================
// FRONTMATTER PARSER - Frontmatter 解析器
// ==========================================

function parseFrontmatter(content) {
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fmMatch) return {};

  const meta = {};
  const fmContent = fmMatch[1];

  const lines = fmContent.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Find first colon to handle URLs properly
    const colonIndex = line.indexOf(':');
    if (colonIndex <= 0) continue;

    const key = line.slice(0, colonIndex).trim();
    let val = line.slice(colonIndex + 1).trim();

    if (val.startsWith('[') && val.endsWith(']')) {
      val = val.slice(1, -1).split(',').map(v => v.trim().replace(/['"]/g, '')).filter(Boolean);
    } else {
      val = val.replace(/^['"]|['"]$/g, '');
    }
    meta[key] = val;
  }
  return meta;
}

// ==========================================
// FILE WATCHER - 文件监听
// ==========================================

const watcher = chokidar.watch([PATHS.CONTENT, join(ROOT, 'config.json')], {
  ignored: /node_modules/,
  persistent: true
});

watcher.on('change', (path) => {
  broadcast({ type: 'reload', file: path });
});

// ==========================================
// AI API CALLER - AI API 调用器
// ==========================================

async function callAIAPI(provider, apiKey, model, customUrl, prompt) {
  const providers = {
    deepseek: {
      url: 'https://api.deepseek.com/v1/chat/completions',
      defaultModel: 'deepseek-chat'
    },
    openai: {
      url: 'https://api.openai.com/v1/chat/completions',
      defaultModel: 'gpt-3.5-turbo'
    },
    kimi: {
      url: 'https://api.moonshot.cn/v1/chat/completions',
      defaultModel: 'moonshot-v1-8k'
    },
    custom: {
      url: customUrl,
      defaultModel: 'gpt-3.5-turbo'
    }
  };

  const providerConfig = providers[provider] || providers.custom;
  const url = providerConfig.url;

  if (!url) {
    throw new Error('Invalid provider or missing custom URL');
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model || providerConfig.defaultModel,
      messages: [
        { role: 'user', content: prompt }
      ],
      max_tokens: 200,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API error: ${error}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || '';
}

// ==========================================
// ROUTES - API 路由
// ==========================================

app.get('/api/posts', (req, res) => {
  const posts = [];
  const postsDir = join(PATHS.CONTENT, 'posts');
  
  function scanDir(dir, category = '') {
    if (!existsSync(dir)) return;
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDir(path, entry.name);
      } else if (entry.name.endsWith('.md')) {
        const content = readFileSync(path, 'utf-8');
        const meta = parseFrontmatter(content);
        
        posts.push({
          ...meta,
          category: meta.category || category || 'default',
          path: toPosixPath(relative(PATHS.CONTENT, path)),
          filename: entry.name
        });
      }
    }
  }
  
  scanDir(postsDir);
  posts.sort((a, b) => new Date(b.date) - new Date(a.date));
  res.json(posts);
});

app.get('/api/logs', (req, res) => {
  const logFiles = scanFilesRecursive(PATHS.LOGS, (name) => name.endsWith('.json'));
  const logs = logFiles
    .map((filePath) => {
      const log = readJsonSafely(filePath, null);
      if (!log) return null;
      return {
        ...log,
        path: toPosixPath(relative(PATHS.LOGS, filePath)),
      };
    })
    .filter(Boolean)
    .sort((a, b) => `${b.date || ''} ${b.time || ''}`.localeCompare(`${a.date || ''} ${a.time || ''}`));
  res.json(logs);
});

app.get('/api/posts/*', (req, res) => {
  let filePath;
  try {
    filePath = resolveContentPath(req.params[0]);
  } catch {
    return res.status(400).json({ error: 'Invalid path' });
  }

  if (!existsSync(filePath)) {
    return res.status(404).json({ error: 'Not found' });
  }
  const content = readFileSync(filePath, 'utf-8');
  res.json({ content, path: req.params[0] });
});

app.get('/api/logs/*', (req, res) => {
  let filePath;
  try {
    filePath = resolveLogsPath(req.params[0]);
  } catch {
    return res.status(400).json({ error: 'Invalid path' });
  }

  if (!existsSync(filePath)) {
    return res.status(404).json({ error: 'Not found' });
  }

  res.json(readJsonSafely(filePath, {}));
});

app.get('/api/posts/*/export', (req, res) => {
  let filePath;
  try {
    filePath = resolveContentPath(req.params[0]);
  } catch {
    return res.status(400).json({ error: 'Invalid path' });
  }

  if (!existsSync(filePath)) {
    return res.status(404).json({ error: 'Not found' });
  }

  const content = readFileSync(filePath, 'utf-8');
  const { meta, html, raw } = processMarkdown(filePath);
  const slug = req.params[0].replace(/\.md$/, '').replace(/\\/g, '/');
  
  const exportData = {
    source: {
      site: 'ham-radio-blog',
      url: meta.url || `/posts/${slug}`,
      exportedAt: new Date().toISOString(),
    },
    post: {
      title: meta.title || 'Untitled',
      date: meta.date,
      category: meta.category || 'default',
      tags: meta.tags || [],
      summary: meta.summary || null,
      cover: meta.cover || null,
      content: raw,
      html: html,
      slug: slug,
    },
    meta: {
      version: '1.0',
      type: 'cross-site-export',
    }
  };

  res.json(exportData);
});

app.post('/api/posts', (req, res) => {
  const { path: filePath, content } = req.body;
  if (!filePath || typeof filePath !== 'string' || typeof content !== 'string') {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  let fullPath;
  try {
    fullPath = resolveContentPath(filePath);
  } catch {
    return res.status(400).json({ error: 'Invalid path' });
  }

  const dir = dirname(fullPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(fullPath, content, 'utf-8');
  res.json({ success: true });
});

app.post('/api/logs', (req, res) => {
  const { path: filePath, data } = req.body;
  if (!filePath || typeof filePath !== 'string' || !data || typeof data !== 'object') {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  let fullPath;
  try {
    fullPath = resolveLogsPath(filePath);
  } catch {
    return res.status(400).json({ error: 'Invalid path' });
  }

  const dir = dirname(fullPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(fullPath, JSON.stringify(data, null, 2), 'utf-8');
  res.json({ success: true });
});

app.delete('/api/posts/*', (req, res) => {
  let filePath;
  try {
    filePath = resolveContentPath(req.params[0]);
  } catch {
    return res.status(400).json({ error: 'Invalid path' });
  }

  if (existsSync(filePath)) {
    unlinkSync(filePath);
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Not found' });
  }
});

app.delete('/api/logs/*', (req, res) => {
  let filePath;
  try {
    filePath = resolveLogsPath(req.params[0]);
  } catch {
    return res.status(400).json({ error: 'Invalid path' });
  }

  if (existsSync(filePath)) {
    unlinkSync(filePath);
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Not found' });
  }
});

app.get('/api/config', (req, res) => {
  const config = JSON.parse(readFileSync(join(ROOT, 'config.json'), 'utf-8'));
  res.json(config);
});

app.post('/api/config', (req, res) => {
  writeFileSync(join(ROOT, 'config.json'), JSON.stringify(req.body, null, 2), 'utf-8');
  res.json({ success: true });
});

app.get('/api/friends', (req, res) => {
  const friendsPath = join(PATHS.DATA, 'friends.json');
  if (!existsSync(friendsPath)) {
    return res.json([]);
  }
  const friends = JSON.parse(readFileSync(friendsPath, 'utf-8'));
  res.json(friends);
});

app.post('/api/friends', (req, res) => {
  if (!existsSync(PATHS.DATA)) mkdirSync(PATHS.DATA);
  writeFileSync(join(PATHS.DATA, 'friends.json'), JSON.stringify(req.body, null, 2), 'utf-8');
  res.json({ success: true });
});

app.post('/api/upload', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  res.json({ 
    success: true, 
    url: `/images/${req.file.filename}`,
    path: req.file.path
  });
});

app.get('/api/images', (req, res) => {
  const imagesDir = join(PATHS.PUBLIC, 'images');
  if (!existsSync(imagesDir)) {
    return res.json([]);
  }
  const images = readdirSync(imagesDir)
    .filter(f => /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(f))
    .map(f => ({
      name: f,
      url: `/images/${f}`
    }));
  res.json(images);
});

app.delete('/api/images/:filename', (req, res) => {
  try {
    const filename = req.params.filename;
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({ error: 'Invalid filename' });
    }
    
    const imagePath = join(PATHS.PUBLIC, 'images', filename);
    if (!existsSync(imagePath)) {
      return res.status(404).json({ error: 'Image not found' });
    }
    
    unlinkSync(imagePath);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/favicon', faviconUpload.single('favicon'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  res.json({ 
    success: true, 
    url: '/favicon.ico'
  });
});

app.delete('/api/favicon', (req, res) => {
  try {
    const faviconPath = join(PATHS.PUBLIC, 'favicon.ico');
    if (existsSync(faviconPath)) {
      unlinkSync(faviconPath);
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/about', (req, res) => {
  const aboutPath = join(PATHS.CONTENT, 'pages', 'about.md');
  if (!existsSync(aboutPath)) {
    return res.status(404).json({ error: 'About page not found' });
  }
  const content = readFileSync(aboutPath, 'utf-8');
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  const body = match ? match[2] : content;
  res.json({ content: body.trim() });
});

app.post('/api/about', (req, res) => {
  try {
    const { content } = req.body;
    if (typeof content !== 'string') {
      return res.status(400).json({ error: 'Invalid content' });
    }

    const pagesDir = join(PATHS.CONTENT, 'pages');
    if (!existsSync(pagesDir)) {
      mkdirSync(pagesDir, { recursive: true });
    }

    const aboutPath = join(pagesDir, 'about.md');
    writeFileSync(aboutPath, content, 'utf-8');
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to save about page' });
  }
});

app.post('/api/ai/test', async (req, res) => {
  const { provider, apiKey, model, customUrl } = req.body;
  
  if (!apiKey) {
    return res.status(400).json({ error: 'API Key is required' });
  }
  
  try {
    const response = await callAIAPI(provider, apiKey, model, customUrl, 'Hello, this is a test.');
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/ai/summary', async (req, res) => {
  const { content, provider, apiKey, model, customUrl } = req.body;
  
  if (!apiKey) {
    return res.status(400).json({ error: 'API Key is required' });
  }
  
  if (!content) {
    return res.status(400).json({ error: 'Content is required' });
  }
  
  const prompt = `请为以下文章生成一段简洁的摘要（50-100字），突出文章的核心内容和要点：

${content}

摘要：`;
  
  try {
    const summary = await callAIAPI(provider, apiKey, model, customUrl, prompt);
    res.json({ summary });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/build', (req, res) => {
  const execAsync = promisify(exec);
  execAsync('node src/build.js', {
    cwd: ROOT,
    env: {
      ...process.env,
      BLOG_BASE_PATH: '/preview',
    },
  })
    .then(() => {
      broadcast({ type: 'build', status: 'success' });
      res.json({ success: true });
    })
    .catch(err => {
      broadcast({ type: 'build', status: 'error', message: err.message });
      res.status(500).json({ error: err.message });
    });
});

// ==========================================
// START SERVER - 启动服务器
// ==========================================

server.listen(PORT, () => {
  console.log(`🌸 Ham Blog Admin running at http://localhost:${PORT}`);
});
