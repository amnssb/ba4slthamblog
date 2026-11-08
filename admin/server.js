/*
管理后台入口：接住本机请求，检查路径和正文，再交给文章、日志、配置这些主体。
错误只在这里分成「用户能改的」和「程序故障」。
调用：node admin/server.js
浏览器打开 http://127.0.0.1:3456
*/

import { execFile } from 'child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import { createServer } from 'http';
import { basename, dirname, extname, join } from 'path';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import chokidar from 'chokidar';
import express from 'express';
import multer from 'multer';
import { WebSocketServer } from 'ws';
import { aiSettings, callAI } from './ai.js';
import { readAbout, writeAbout } from '../src/about.js';
import { mergeConfig, readConfig, redactConfig, writeConfig } from '../src/config.js';
import { fail } from '../src/lib/fail.js';
import { resolveInside } from '../src/lib/files.js';
import { readFriends, writeFriends } from '../src/friend.js';
import { listLogs } from '../src/log.js';
import { exportPost, listPosts, readPostSource } from '../src/post.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PATHS = {
  CONTENT: join(ROOT, 'content'),
  LOGS: join(ROOT, 'content', 'logs'),
  PUBLIC: join(ROOT, 'public'),
  DIST: join(ROOT, 'dist'),
  PUBLIC_IMAGES: join(ROOT, 'public', 'images'),
  DATA: join(ROOT, 'data'),
};
const PORT = process.env.PORT || 3456;
const HOST = process.env.HOST || '127.0.0.1';
const MAX_JSON_SIZE = '1mb';
const MAX_MARKDOWN_SIZE = 1024 * 1024;
const MAX_LOG_SIZE = 128 * 1024;
const MAX_FRIENDS = 300;
const ENV_AI_API_KEY = process.env.AI_API_KEY || '';
const execFileAsync = promisify(execFile);

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

app.disable('x-powered-by');
app.use(express.json({ limit: MAX_JSON_SIZE }));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Cache-Control', req.path.startsWith('/api/') ? 'no-store' : 'no-cache');
  next();
});
app.use((req, res, next) => {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
  const origin = req.get('origin');
  if (!origin) return next();                     // 没有 Origin 的本机请求，例如 curl，仍然放行
  try {
    const originUrl = new URL(origin);
    if (originUrl.host === req.get('host') && ['http:', 'https:'].includes(originUrl.protocol)) {
      return next();
    }
  } catch {
    // 下面统一拒绝
  }
  return res.status(403).json({ error: 'Invalid request origin' });
});
app.use(express.static(join(dirname(fileURLToPath(import.meta.url)), 'public'), {
  index: 'index.html',
  extensions: ['html'],
}));
app.use('/images', (req, res, next) => {
  if (!/\.(jpg|jpeg|png|gif|webp)$/i.test(req.path)) return res.status(404).end();
  next();
}, express.static(PATHS.PUBLIC_IMAGES, { fallthrough: false, index: false }));
app.use('/preview', express.static(PATHS.DIST, { index: 'index.html' }));

function route(handler) {
  return (req, res, next) => {
    try {
      Promise.resolve(handler(req, res, next)).catch(next);
    } catch (error) {
      next(error);
    }
  };
}

function assertExtension(filePath, allowed) {
  if (!allowed.includes(extname(filePath).toLowerCase())) {
    throw new Error('Invalid file type');
  }
}

function located(root, targetPath, extensions) {
  try {
    const filePath = resolveInside(root, targetPath);
    assertExtension(filePath, extensions);
    return filePath;
  } catch (error) {
    if (error.status) throw error;
    throw fail(400, 'Invalid path');                // 扩展名不对也按路径错误回去，和原来的接口一致
  }
}

function sanitizeUploadName(name) {
  const parsedExt = extname(name).toLowerCase();
  const safeBase = basename(name, parsedExt)
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'image';
  return `${safeBase}${parsedExt}`;
}

function imageFileFilter(req, file, cb) {
  const allowedExt = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);
  const allowedMime = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
  const ext = extname(file.originalname).toLowerCase();
  if (allowedExt.has(ext) && allowedMime.has(file.mimetype)) cb(null, true);
  else cb(new Error('Only jpg, png, gif and webp images are allowed'));
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadPath = join(PATHS.PUBLIC, 'images');
      if (!existsSync(uploadPath)) mkdirSync(uploadPath, { recursive: true });
      cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
      cb(null, `${Date.now()}-${sanitizeUploadName(file.originalname)}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: imageFileFilter,
});

const faviconUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, PATHS.PUBLIC),
    filename: (req, file, cb) => {
      const ext = file.originalname.split('.').pop().toLowerCase();
      if (['ico', 'png', 'jpg', 'jpeg', 'svg'].includes(ext)) cb(null, 'favicon.ico');
      else cb(new Error('Invalid favicon format'), null);
    },
  }),
  limits: { fileSize: 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/x-icon', 'image/vnd.microsoft.icon', 'image/png', 'image/jpeg'];
    if (allowed.includes(file.mimetype) || file.originalname.match(/\.(ico|png|jpg|jpeg)$/i)) cb(null, true);
    else cb(new Error('Only .ico, .png, .jpg files are allowed'));
  },
});

let wsClients = [];
wss.on('connection', (ws) => {
  wsClients.push(ws);
  ws.on('close', () => {
    wsClients = wsClients.filter((client) => client !== ws);
  });
});

function broadcast(message) {
  wsClients = wsClients.filter((client) => client.readyState === 1);
  wsClients.forEach((client) => client.send(JSON.stringify(message)));
}

chokidar.watch([PATHS.CONTENT, join(ROOT, 'config.json')], {
  ignored: /node_modules/,
  persistent: true,
}).on('change', (path) => {
  broadcast({ type: 'reload', file: path });          // 文件改了就让打开着的后台刷新
});

// --- 文章 ---

app.get('/api/posts', route((req, res) => {
  res.json(listPosts(PATHS.CONTENT));
}));

app.get('/api/posts/*', route((req, res, next) => {
  if (req.path.endsWith('/export')) return next();    // 导出走下面那一条，不要当成读原文
  const filePath = located(PATHS.CONTENT, req.params[0], ['.md']);
  if (!existsSync(filePath)) throw fail(404, 'Not found');
  const source = readPostSource(filePath);
  res.json({ ...source, path: req.params[0] });
}));

app.get('/api/posts/*/export', route((req, res) => {
  const filePath = located(PATHS.CONTENT, req.params[0], ['.md']);
  if (!existsSync(filePath)) throw fail(404, 'Not found');
  res.json(exportPost(filePath, req.params[0]));
}));

app.post('/api/posts', route((req, res) => {
  const { path: filePath, content } = req.body || {};
  if (!filePath || typeof filePath !== 'string' || typeof content !== 'string' || Buffer.byteLength(content, 'utf8') > MAX_MARKDOWN_SIZE) {
    throw fail(400, 'Invalid payload');
  }
  const fullPath = located(PATHS.CONTENT, filePath, ['.md']);
  mkdirSync(dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, content, 'utf-8');
  res.json({ success: true });
}));

app.delete('/api/posts/*', route((req, res) => {
  const filePath = located(PATHS.CONTENT, req.params[0], ['.md']);
  if (!existsSync(filePath)) throw fail(404, 'Not found');
  unlinkSync(filePath);
  res.json({ success: true });
}));

// --- 通联日志 ---

app.get('/api/logs', route((req, res) => {
  res.json(listLogs(PATHS.LOGS));
}));

app.get('/api/logs/*', route((req, res) => {
  const filePath = located(PATHS.LOGS, req.params[0], ['.json']);
  if (!existsSync(filePath)) throw fail(404, 'Not found');
  res.json(JSON.parse(readFileSync(filePath, 'utf-8')));
}));

app.post('/api/logs', route((req, res) => {
  const { path: filePath, data } = req.body || {};
  if (!filePath || typeof filePath !== 'string' || !data || typeof data !== 'object') {
    throw fail(400, 'Invalid payload');
  }
  const serialized = JSON.stringify(data, null, 2);
  if (Buffer.byteLength(serialized, 'utf8') > MAX_LOG_SIZE) throw fail(400, 'Invalid payload');
  const fullPath = located(PATHS.LOGS, filePath, ['.json']);
  mkdirSync(dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, serialized, 'utf-8');
  res.json({ success: true });
}));

app.delete('/api/logs/*', route((req, res) => {
  const filePath = located(PATHS.LOGS, req.params[0], ['.json']);
  if (!existsSync(filePath)) throw fail(404, 'Not found');
  unlinkSync(filePath);
  res.json({ success: true });
}));

// --- 配置、友链、关于 ---

app.get('/api/config', route((req, res) => {
  res.json(redactConfig(readConfig(ROOT), ENV_AI_API_KEY));
}));

app.post('/api/config', route((req, res) => {
  if (!req.body || typeof req.body !== 'object') {
    throw fail(400, 'Invalid payload');
  }
  writeConfig(ROOT, mergeConfig(readConfig(ROOT), req.body));
  res.json({ success: true });
}));

app.get('/api/friends', route((req, res) => {
  res.json(readFriends(PATHS.DATA));
}));

app.post('/api/friends', route((req, res) => {
  if (!Array.isArray(req.body) || req.body.length > MAX_FRIENDS) {
    throw fail(400, 'Invalid friends payload');
  }
  writeFriends(PATHS.DATA, req.body);
  res.json({ success: true });
}));

app.get('/api/about', route((req, res) => {
  const about = readAbout(PATHS.CONTENT);
  if (!about) throw fail(404, 'About page not found');
  res.json(about);
}));

app.post('/api/about', route((req, res) => {
  const { content } = req.body || {};
  if (typeof content !== 'string' || Buffer.byteLength(content, 'utf8') > MAX_MARKDOWN_SIZE) {
    throw fail(400, 'Invalid content');
  }
  writeAbout(PATHS.CONTENT, content);
  res.json({ success: true });
}));

// --- 图片 ---

app.post('/api/upload', upload.single('image'), route((req, res) => {
  if (!req.file) throw fail(400, 'No file uploaded');
  res.json({ success: true, url: `/images/${req.file.filename}` });
}));

app.get('/api/images', route((req, res) => {
  const imagesDir = join(PATHS.PUBLIC, 'images');
  if (!existsSync(imagesDir)) return res.json([]);
  res.json(readdirSync(imagesDir)
    .filter((name) => /\.(jpg|jpeg|png|gif|webp)$/i.test(name))
    .map((name) => ({ name, url: `/images/${name}` })));
}));

app.delete('/api/images/:filename', route((req, res) => {
  const filename = basename(req.params.filename);
  if (filename !== req.params.filename || !/\.(jpg|jpeg|png|gif|webp)$/i.test(filename)) {
    throw fail(400, 'Invalid filename');
  }
  const imagePath = join(PATHS.PUBLIC, 'images', filename);
  if (!existsSync(imagePath)) throw fail(404, 'Image not found');
  unlinkSync(imagePath);
  res.json({ success: true });
}));

app.post('/api/favicon', faviconUpload.single('favicon'), route((req, res) => {
  if (!req.file) throw fail(400, 'No file uploaded');
  res.json({ success: true, url: '/favicon.ico' });
}));

app.delete('/api/favicon', route((req, res) => {
  const faviconPath = join(PATHS.PUBLIC, 'favicon.ico');
  if (existsSync(faviconPath)) unlinkSync(faviconPath);
  res.json({ success: true });
}));

// --- 摘要和构建 ---

app.post('/api/ai/test', route(async (req, res) => {
  const { provider, apiKey, model, customUrl } = req.body || {};
  const ai = aiSettings(readConfig(ROOT).ai || {}, { provider, apiKey, model, customUrl }, ENV_AI_API_KEY);
  if (!ai.apiKey) throw fail(400, 'API Key is required');
  await callAI(ai, 'Hello, this is a test.');
  res.json({ success: true });
}));

app.post('/api/ai/summary', route(async (req, res) => {
  const { content } = req.body || {};
  const ai = aiSettings(readConfig(ROOT).ai || {}, {}, ENV_AI_API_KEY);
  if (!ai.apiKey) throw fail(400, 'API Key is required');
  if (typeof content !== 'string' || !content.trim() || Buffer.byteLength(content, 'utf8') > 20000) {
    throw fail(400, 'Content is required');
  }
  const summary = await callAI(ai, [
    'Write a concise Chinese summary in 50-100 characters. Focus on the article core ideas:',
    '',
    content,
    '',
    'Summary:',
  ].join('\n'));
  res.json({ summary });
}));

app.post('/api/build', route(async (req, res) => {
  try {
    await execFileAsync('node', ['src/build.js'], {
      cwd: ROOT,
      env: { ...process.env, BLOG_BASE_PATH: '/preview' }, // 预览挂在 /preview 下，页面里的链接要带这个前缀
    });
    broadcast({ type: 'build', status: 'success' });
    res.json({ success: true });
  } catch (error) {
    broadcast({ type: 'build', status: 'error', message: error.message });
    throw error;                                     // 构建失败仍把原因回给界面
  }
}));

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  const uploadRejected = err instanceof multer.MulterError || err.message?.includes('allowed');
  const status = uploadRejected ? 400 : (Number(err.status) || 500);
  if (status >= 500) console.error(err);
  res.status(status).json({ error: err.message || 'Server error' });
});

server.listen(PORT, HOST, () => {
  console.log(`🌸 Ham Blog Admin running at http://localhost:${PORT}`);
});
