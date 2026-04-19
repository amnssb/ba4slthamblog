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

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const CONTENT = join(ROOT, 'content');
const LOGS = join(CONTENT, 'logs');
const PUBLIC = join(ROOT, 'public');
const DIST = join(ROOT, 'dist');
const PUBLIC_IMAGES = join(PUBLIC, 'images');

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.json());
app.use(express.static(join(__dirname, 'public')));
app.use('/images', express.static(PUBLIC_IMAGES));

// Multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = join(PUBLIC, 'images');
    if (!existsSync(uploadPath)) mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});
const upload = multer({ storage });

// WebSocket for live reload
let clients = [];
wss.on('connection', (ws) => {
  clients.push(ws);
  ws.on('close', () => {
    clients = clients.filter(c => c !== ws);
  });
});

function broadcast(msg) {
  clients = clients.filter((client) => client.readyState === 1);
  clients.forEach((client) => client.send(JSON.stringify(msg)));
}

function toPosixPath(filePath) {
  return filePath.replace(/\\/g, '/');
}

function resolveContentPath(targetPath = '') {
  const fullPath = resolve(CONTENT, targetPath);
  const contentRoot = resolve(CONTENT);

  if (!fullPath.startsWith(contentRoot)) {
    throw new Error('Invalid content path');
  }

  return fullPath;
}

function resolveLogsPath(targetPath = '') {
  const fullPath = resolve(LOGS, targetPath);
  const logsRoot = resolve(LOGS);

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

// Watch for file changes
const watcher = chokidar.watch([CONTENT, join(ROOT, 'config.json')], {
  ignored: /node_modules/,
  persistent: true
});

watcher.on('change', (path) => {
  broadcast({ type: 'reload', file: path });
});

// API Routes

// Get all posts
app.get('/api/posts', (req, res) => {
  const posts = [];
  const postsDir = join(CONTENT, 'posts');
  
  function scanDir(dir, category = '') {
    if (!existsSync(dir)) return;
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDir(path, entry.name);
      } else if (entry.name.endsWith('.md')) {
        const content = readFileSync(path, 'utf-8');
        const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
        const meta = {};
        if (fmMatch) {
          const lines = fmMatch[1].split('\n');
          lines.forEach(line => {
            const colon = line.indexOf(':');
            if (colon > 0) {
              const key = line.slice(0, colon).trim();
              let val = line.slice(colon + 1).trim();
              if (val.startsWith('[') && val.endsWith(']')) {
                val = val.slice(1, -1).split(',').map(v => v.trim().replace(/['"]/g, ''));
              } else {
                val = val.replace(/['"]/g, '');
              }
              meta[key] = val;
            }
          });
        }
        posts.push({
          ...meta,
          category: meta.category || category || 'default',
          path: toPosixPath(relative(CONTENT, path)),
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
  const logFiles = scanFilesRecursive(LOGS, (name) => name.endsWith('.json'));
  const logs = logFiles
    .map((filePath) => {
      const log = readJsonSafely(filePath, null);
      if (!log) return null;

      return {
        ...log,
        path: toPosixPath(relative(LOGS, filePath)),
      };
    })
    .filter(Boolean)
    .sort((a, b) => `${b.date || ''} ${b.time || ''}`.localeCompare(`${a.date || ''} ${a.time || ''}`));

  res.json(logs);
});

// Get single post
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

// Save post
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

// Delete post
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

// Get/Update config
app.get('/api/config', (req, res) => {
  const config = JSON.parse(readFileSync(join(ROOT, 'config.json'), 'utf-8'));
  res.json(config);
});

app.post('/api/config', (req, res) => {
  writeFileSync(join(ROOT, 'config.json'), JSON.stringify(req.body, null, 2), 'utf-8');
  res.json({ success: true });
});

// Get/Update friends
app.get('/api/friends', (req, res) => {
  const friendsPath = join(ROOT, 'data', 'friends.json');
  if (!existsSync(friendsPath)) {
    return res.json([]);
  }
  const friends = JSON.parse(readFileSync(friendsPath, 'utf-8'));
  res.json(friends);
});

app.post('/api/friends', (req, res) => {
  const dataDir = join(ROOT, 'data');
  if (!existsSync(dataDir)) mkdirSync(dataDir);
  writeFileSync(join(dataDir, 'friends.json'), JSON.stringify(req.body, null, 2), 'utf-8');
  res.json({ success: true });
});

// Upload image
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

// Get images
app.get('/api/images', (req, res) => {
  const imagesDir = join(PUBLIC, 'images');
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

// Delete image
app.delete('/api/images/:filename', (req, res) => {
  try {
    const filename = req.params.filename;
    // Prevent path traversal
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({ error: 'Invalid filename' });
    }
    
    const imagePath = join(PUBLIC, 'images', filename);
    if (!existsSync(imagePath)) {
      return res.status(404).json({ error: 'Image not found' });
    }
    
    unlinkSync(imagePath);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get about page
app.get('/api/about', (req, res) => {
  const aboutPath = join(CONTENT, 'pages', 'about.md');
  if (!existsSync(aboutPath)) {
    return res.status(404).json({ error: 'About page not found' });
  }
  const content = readFileSync(aboutPath, 'utf-8');
  // Parse frontmatter to get body
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  const body = match ? match[2] : content;
  res.json({ content: body.trim() });
});

// Save about page
app.post('/api/about', (req, res) => {
  try {
    const { content } = req.body;
    if (typeof content !== 'string') {
      return res.status(400).json({ error: 'Invalid content' });
    }

    const pagesDir = join(CONTENT, 'pages');
    console.log('Creating pages directory:', pagesDir);
    
    if (!existsSync(pagesDir)) {
      mkdirSync(pagesDir, { recursive: true });
      console.log('Pages directory created');
    }

    const aboutPath = join(pagesDir, 'about.md');
    console.log('Writing to:', aboutPath);
    writeFileSync(aboutPath, content, 'utf-8');
    console.log('About page saved successfully');
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving about page:', error);
    res.status(500).json({ error: error.message || 'Failed to save about page' });
  }
});

// Build
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

// Preview
app.use('/preview', express.static(DIST));

const PORT = process.env.PORT || 3456;
server.listen(PORT, () => {
  console.log(`🌸 Ham Blog Admin running at http://localhost:${PORT}`);
});
