let currentView = 'dashboard';
let posts = [];
let logs = [];
let friends = [];
let config = {};
let editingPost = null;
let editingLog = null;
let editingFriend = null;

function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\u4e00-\u9fff]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    return { meta: {}, body: content };
  }

  const meta = {};
  match[1].split('\n').forEach((line) => {
    const colon = line.indexOf(':');
    if (colon <= 0) return;

    const key = line.slice(0, colon).trim();
    let value = line.slice(colon + 1).trim();
    if (value.startsWith('[') && value.endsWith(']')) {
      value = value
        .slice(1, -1)
        .split(',')
        .map((item) => item.trim().replace(/^['"]|['"]$/g, ''))
        .filter(Boolean);
    } else {
      value = value.replace(/^['"]|['"]$/g, '');
    }
    meta[key] = value;
  });

  return { meta, body: match[2] };
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || '请求失败');
  }
  return data;
}

document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  initWebSocket();
  initPostEditor();
  initLogEditor();
  initFriends();
  initSettings();
  initTheme();
  loadDashboard();
});

function initNavigation() {
  document.querySelectorAll('.nav-item').forEach((item) => {
    item.addEventListener('click', (event) => {
      event.preventDefault();
      switchView(item.dataset.view);
    });
  });
}

function switchView(view) {
  document.querySelectorAll('.view').forEach((section) => section.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach((item) => item.classList.remove('active'));

  document.getElementById(`view-${view}`)?.classList.add('active');
  document.querySelector(`[data-view="${view}"]`)?.classList.add('active');
  currentView = view;

  switch (view) {
    case 'dashboard': loadDashboard(); break;
    case 'posts': loadPosts(); break;
    case 'logs': loadLogs(); break;
    case 'friends': loadFriends(); break;
    case 'settings': loadSettings(); break;
    case 'theme': updateThemePreview(); break;
  }
}

function initWebSocket() {
  const ws = new WebSocket(`ws://${location.host}`);
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === 'reload') {
      showToast('文件已更改，正在刷新...', 'info');
      setTimeout(() => location.reload(), 500);
      return;
    }

    if (data.type === 'build') {
      const status = document.getElementById('build-status');
      const icon = document.getElementById('build-icon');
      const text = document.getElementById('build-text');
      if (data.status === 'success') {
        status.classList.add('hidden');
        showToast('构建成功！', 'success');
      } else {
        icon.textContent = '❌';
        text.textContent = '构建失败';
        showToast(`构建失败: ${data.message}`, 'error');
      }
    }
  };
}

async function loadDashboard() {
  const [postsData, logsData, friendsData] = await Promise.all([
    fetchJson('/api/posts'),
    fetchJson('/api/logs'),
    fetchJson('/api/friends'),
  ]);

  posts = postsData;
  logs = logsData;
  friends = friendsData;

  const tags = new Set();
  posts.forEach((post) => post.tags?.forEach((tag) => tags.add(tag)));

  document.getElementById('stat-posts').textContent = posts.length;
  document.getElementById('stat-logs').textContent = logs.length;
  document.getElementById('stat-tags').textContent = tags.size;
  document.getElementById('stat-friends').textContent = friends.length;

  document.getElementById('recent-posts-list').innerHTML = posts.slice(0, 5).map((post) => `
    <div class="post-item-mini" onclick="editPost('${post.path}')">
      <span>${post.title}</span>
      <span class="mini-meta">${post.date}</span>
    </div>
  `).join('') || '<div class="empty">暂无文章</div>';

  document.getElementById('recent-logs-list').innerHTML = logs.slice(0, 5).map((log) => `
    <div class="post-item-mini" onclick="editLog('${log.path}')">
      <span>${getLogTitle(log)}</span>
      <span class="mini-meta">${log.date || ''} ${log.time || ''}</span>
    </div>
  `).join('') || '<div class="empty">暂无通联日志</div>';
}

async function loadPosts() {
  posts = await fetchJson('/api/posts');

  const grid = document.getElementById('posts-grid');
  grid.innerHTML = posts.map((post) => `
    <div class="post-card glass" onclick="editPost('${post.path}')">
      <div class="post-card-header">
        <div class="post-card-cover"${post.cover ? ` style="background-image:url('${post.cover}'); background-size:cover; background-position:center;"` : ''}></div>
        <div class="post-card-info">
          <div class="post-card-title">${post.title}</div>
          <div class="post-card-meta">${post.date} · ${post.category}</div>
        </div>
      </div>
      <div class="post-card-tags">
        ${post.tags?.map((tag) => `<span class="tag">${tag}</span>`).join('') || ''}
      </div>
      <div class="post-card-actions">
        <button class="glass-btn btn-sm" onclick="event.stopPropagation(); editPost('${post.path}')">编辑</button>
        <button class="glass-btn btn-sm btn-danger" onclick="event.stopPropagation(); deletePost('${post.path}')">删除</button>
      </div>
    </div>
  `).join('') || '<div class="empty">暂无文章</div>';
}

function editPost(path) {
  editingPost = path;
  const post = posts.find((item) => item.path === path);
  document.getElementById('editor-title').textContent = '编辑文章';
  document.getElementById('post-title').value = post?.title || '';
  document.getElementById('post-date').value = post?.date || new Date().toISOString().split('T')[0];
  document.getElementById('post-category').value = post?.category || 'daily';
  document.getElementById('post-tags').value = post?.tags?.join(', ') || '';

  fetchJson(`/api/posts/${path}`).then((data) => {
    const { meta, body } = parseFrontmatter(data.content);
    document.getElementById('post-content').value = body.trimStart();
    document.getElementById('post-cover-url').value = meta.cover || '';
  });

  switchView('editor');
}

function initPostEditor() {
  document.getElementById('btn-new-post')?.addEventListener('click', () => {
    editingPost = null;
    document.getElementById('editor-title').textContent = '新建文章';
    document.getElementById('post-title').value = '';
    document.getElementById('post-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('post-category').value = 'daily';
    document.getElementById('post-tags').value = '';
    document.getElementById('post-cover-url').value = '';
    document.getElementById('post-content').value = '';
    switchView('editor');
  });

  document.getElementById('btn-back')?.addEventListener('click', () => switchView('posts'));
  document.getElementById('btn-publish')?.addEventListener('click', savePost);
  document.getElementById('btn-draft')?.addEventListener('click', savePost);
  document.getElementById('btn-build')?.addEventListener('click', buildSite);
  document.getElementById('btn-preview')?.addEventListener('click', () => window.open('/preview/', '_blank'));

  document.querySelectorAll('#view-editor .tab-btn').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelectorAll('#view-editor .tab-btn').forEach((item) => item.classList.remove('active'));
      document.querySelectorAll('#view-editor .tab-content').forEach((item) => item.classList.add('hidden'));
      button.classList.add('active');
      document.getElementById(`tab-${button.dataset.tab}`)?.classList.remove('hidden');
      if (button.dataset.tab === 'preview') {
        updatePostPreview();
      }
    });
  });
}

function updatePostPreview() {
  const content = document.getElementById('post-content').value;
  const html = content
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\n/g, '<br>');
  document.getElementById('preview-content').innerHTML = html;
}

async function savePost() {
  const title = document.getElementById('post-title').value.trim();
  const date = document.getElementById('post-date').value;
  const category = document.getElementById('post-category').value;
  const tags = document.getElementById('post-tags').value.split(',').map((tag) => tag.trim()).filter(Boolean);
  const cover = document.getElementById('post-cover-url').value.trim();
  const content = document.getElementById('post-content').value.trim();

  if (!title || !content) {
    showToast('请填写标题和内容', 'error');
    return;
  }

  const frontmatter = [
    '---',
    `title: ${title}`,
    `date: ${date}`,
    `tags: [${tags.join(', ')}]`,
    `category: ${category}`,
    ...(cover ? [`cover: ${cover}`] : []),
    '---',
    '',
    content,
  ].join('\n');

  let path = editingPost;
  if (!path) {
    path = `posts/${category}/${slugify(title)}.md`;
  }

  await fetchJson('/api/posts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, content: frontmatter }),
  });

  showToast('文章已保存', 'success');
  await loadPosts();
  switchView('posts');
}

async function deletePost(path) {
  if (!confirm('确定要删除这篇文章吗？')) return;
  await fetchJson(`/api/posts/${path}`, { method: 'DELETE' });
  showToast('删除成功', 'success');
  await loadPosts();
}

async function loadLogs() {
  logs = await fetchJson('/api/logs');
  renderLogsTable(logs);
}

function renderLogsTable(data) {
  const tbody = document.getElementById('logs-tbody');
  const emptyState = document.getElementById('logs-empty');
  const stats = calculateLogStats(data);
  
  // Update stats
  document.getElementById('log-total').textContent = stats.total;
  document.getElementById('log-bands').textContent = stats.bands;
  document.getElementById('log-modes').textContent = stats.modes;
  
  if (!data.length) {
    tbody.innerHTML = '';
    emptyState.classList.remove('hidden');
    return;
  }
  
  emptyState.classList.add('hidden');
  
  tbody.innerHTML = data.map((log, index) => {
    const modeClass = getModeClass(log.mode);
    return `
      <tr onclick="editLog('${log.path}')">
        <td>${index + 1}</td>
        <td>${log.date || '-'}</td>
        <td>${log.time || '-'}</td>
        <td><span class="callsign">${log.callsign || '-'}</span></td>
        <td>${log.band || '-'}</td>
        <td>${log.frequency || '-'}</td>
        <td><span class="mode-badge ${modeClass}">${log.mode || '-'}</span></td>
        <td><span class="rst-badge">${log.rstSent || '-'}/${log.rstReceived || '-'}</span></td>
        <td>${truncate(log.qth || '-', 15)}</td>
        <td>
          <div class="log-actions" onclick="event.stopPropagation()">
            <button class="glass-btn btn-sm" onclick="editLog('${log.path}')">编辑</button>
            <button class="glass-btn btn-sm btn-danger" onclick="deleteLog('${log.path}')">删除</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function calculateLogStats(data) {
  const bands = new Set(data.map(l => l.band).filter(Boolean));
  const modes = new Set(data.map(l => l.mode).filter(Boolean));
  return {
    total: data.length,
    bands: bands.size,
    modes: modes.size
  };
}

function getModeClass(mode) {
  if (!mode) return '';
  const m = mode.toUpperCase();
  if (['SSB', 'LSB', 'USB'].includes(m)) return 'mode-ssb';
  if (['CW', 'MORSE'].includes(m)) return 'mode-cw';
  if (['FM'].includes(m)) return 'mode-fm';
  if (['AM'].includes(m)) return 'mode-am';
  if (['FT8', 'FT4', 'JT65', 'PSK31', 'RTTY', 'DIGITAL'].some(d => m.includes(d))) return 'mode-digital';
  return 'mode-other';
}

function truncate(str, maxLength) {
  if (!str || str.length <= maxLength) return str;
  return str.slice(0, maxLength) + '...';
}

function filterLogsAdmin() {
  const search = document.getElementById('log-search').value.toLowerCase();
  const dateFrom = document.getElementById('log-date-from').value;
  const dateTo = document.getElementById('log-date-to').value;
  const band = document.getElementById('log-filter-band').value;
  const mode = document.getElementById('log-filter-mode').value;
  
  const filtered = logs.filter(log => {
    // Search filter
    if (search) {
      const searchFields = [
        log.callsign || '',
        log.band || '',
        log.mode || '',
        log.qth || '',
        log.rig || ''
      ].join(' ').toLowerCase();
      if (!searchFields.includes(search)) return false;
    }
    
    // Date range
    if (dateFrom && log.date < dateFrom) return false;
    if (dateTo && log.date > dateTo) return false;
    
    // Band filter
    if (band && log.band !== band) return false;
    
    // Mode filter
    if (mode && !log.mode?.toUpperCase().includes(mode.toUpperCase())) return false;
    
    return true;
  });
  
  renderLogsTable(filtered);
}

function resetLogFilters() {
  document.getElementById('log-search').value = '';
  document.getElementById('log-date-from').value = '';
  document.getElementById('log-date-to').value = '';
  document.getElementById('log-filter-band').value = '';
  document.getElementById('log-filter-mode').value = '';
  renderLogsTable(logs);
}

function initLogEditor() {
  // New log button
  document.getElementById('btn-new-log')?.addEventListener('click', () => {
    editingLog = null;
    document.getElementById('log-editor-title').textContent = '新建通联日志';
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('log-date').value = today;
    document.getElementById('log-time').value = '';
    document.getElementById('log-callsign').value = '';
    document.getElementById('log-band').value = '';
    document.getElementById('log-frequency').value = '';
    document.getElementById('log-mode').value = '';
    document.getElementById('log-rst-sent').value = '';
    document.getElementById('log-rst-received').value = '';
    document.getElementById('log-qth').value = '';
    document.getElementById('log-rig').value = '';
    document.getElementById('log-antenna').value = '';
    document.getElementById('log-power').value = '';
    document.getElementById('log-notes').value = '';
    switchView('log-editor');
  });

  // New log from empty state
  document.getElementById('btn-new-log-empty')?.addEventListener('click', () => {
    editingLog = null;
    document.getElementById('log-editor-title').textContent = '新建通联日志';
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('log-date').value = today;
    document.getElementById('log-time').value = '';
    document.getElementById('log-callsign').value = '';
    document.getElementById('log-band').value = '';
    document.getElementById('log-frequency').value = '';
    document.getElementById('log-mode').value = '';
    document.getElementById('log-rst-sent').value = '';
    document.getElementById('log-rst-received').value = '';
    document.getElementById('log-qth').value = '';
    document.getElementById('log-rig').value = '';
    document.getElementById('log-antenna').value = '';
    document.getElementById('log-power').value = '';
    document.getElementById('log-notes').value = '';
    switchView('log-editor');
  });

  // Filter listeners
  document.getElementById('log-search')?.addEventListener('keyup', filterLogsAdmin);
  document.getElementById('log-date-from')?.addEventListener('change', filterLogsAdmin);
  document.getElementById('log-date-to')?.addEventListener('change', filterLogsAdmin);
  document.getElementById('log-filter-band')?.addEventListener('change', filterLogsAdmin);
  document.getElementById('log-filter-mode')?.addEventListener('change', filterLogsAdmin);
  document.getElementById('btn-reset-log-filters')?.addEventListener('click', resetLogFilters);

  document.getElementById('btn-back-log')?.addEventListener('click', () => switchView('logs'));
  document.getElementById('btn-save-log')?.addEventListener('click', saveLog);
}

function editLog(path) {
  editingLog = path;
  fetchJson(`/api/logs/${path}`).then((log) => {
    document.getElementById('log-editor-title').textContent = '编辑通联日志';
    document.getElementById('log-date').value = log.date || new Date().toISOString().split('T')[0];
    document.getElementById('log-time').value = log.time || '';
    document.getElementById('log-callsign').value = log.callsign || '';
    document.getElementById('log-band').value = log.band || '';
    document.getElementById('log-frequency').value = log.frequency || '';
    document.getElementById('log-mode').value = log.mode || '';
    document.getElementById('log-rst-sent').value = log.rstSent || '';
    document.getElementById('log-rst-received').value = log.rstReceived || '';
    document.getElementById('log-qth').value = log.qth || '';
    document.getElementById('log-rig').value = log.rig || '';
    document.getElementById('log-antenna').value = log.antenna || '';
    document.getElementById('log-power').value = log.power || '';
    document.getElementById('log-notes').value = log.notes || '';
    switchView('log-editor');
  });
}

async function saveLog() {
  const data = {
    date: document.getElementById('log-date').value,
    time: document.getElementById('log-time').value.trim(),
    callsign: document.getElementById('log-callsign').value.trim(),
    band: document.getElementById('log-band').value.trim(),
    frequency: document.getElementById('log-frequency').value.trim(),
    mode: document.getElementById('log-mode').value.trim(),
    rstSent: document.getElementById('log-rst-sent').value.trim(),
    rstReceived: document.getElementById('log-rst-received').value.trim(),
    qth: document.getElementById('log-qth').value.trim(),
    rig: document.getElementById('log-rig').value.trim(),
    antenna: document.getElementById('log-antenna').value.trim(),
    power: document.getElementById('log-power').value.trim(),
    notes: document.getElementById('log-notes').value.trim(),
  };

  if (!data.date || !data.callsign) {
    showToast('至少填写日期和对方呼号', 'error');
    return;
  }

  let path = editingLog;
  if (!path) {
    const slug = slugify([data.date, data.callsign, data.band, data.mode].filter(Boolean).join('-'));
    path = `${slug}.json`;
  }

  await fetchJson('/api/logs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, data }),
  });

  showToast('通联日志已保存', 'success');
  await loadLogs();
  switchView('logs');
}

async function deleteLog(path) {
  if (!confirm('确定要删除这条通联日志吗？')) return;
  await fetchJson(`/api/logs/${path}`, { method: 'DELETE' });
  showToast('删除成功', 'success');
  await loadLogs();
}

async function loadFriends() {
  friends = await fetchJson('/api/friends');
  document.getElementById('friends-grid').innerHTML = friends.map((friend, index) => `
    <div class="friend-card glass">
      <img class="friend-avatar" src="${friend.avatar || '/favicon.svg'}" alt="${friend.name}">
      <div class="friend-info">
        <div class="friend-name">${friend.name}</div>
        <div class="friend-desc">${friend.desc}</div>
        <span class="friend-group">${friend.group}</span>
      </div>
      <div class="friend-actions">
        <button class="glass-btn btn-sm" onclick="editFriend(${index})">编辑</button>
        <button class="glass-btn btn-sm btn-danger" onclick="deleteFriend(${index})">删除</button>
      </div>
    </div>
  `).join('') || '<div class="empty">暂无友链</div>';
}

function initFriends() {
  document.getElementById('btn-new-friend')?.addEventListener('click', () => {
    editingFriend = null;
    document.getElementById('friend-modal-title').textContent = '添加友链';
    document.getElementById('friend-name').value = '';
    document.getElementById('friend-url').value = '';
    document.getElementById('friend-desc').value = '';
    document.getElementById('friend-avatar').value = '';
    document.getElementById('friend-group').value = 'ham';
    document.getElementById('friend-modal').classList.remove('hidden');
  });

  document.getElementById('btn-cancel-friend')?.addEventListener('click', () => {
    document.getElementById('friend-modal').classList.add('hidden');
  });

  document.getElementById('btn-save-friend')?.addEventListener('click', saveFriend);
}

function editFriend(index) {
  editingFriend = index;
  const friend = friends[index];
  document.getElementById('friend-modal-title').textContent = '编辑友链';
  document.getElementById('friend-name').value = friend.name;
  document.getElementById('friend-url').value = friend.url;
  document.getElementById('friend-desc').value = friend.desc;
  document.getElementById('friend-avatar').value = friend.avatar || '';
  document.getElementById('friend-group').value = friend.group;
  document.getElementById('friend-modal').classList.remove('hidden');
}

async function saveFriend() {
  const friend = {
    name: document.getElementById('friend-name').value,
    url: document.getElementById('friend-url').value,
    desc: document.getElementById('friend-desc').value,
    avatar: document.getElementById('friend-avatar').value,
    group: document.getElementById('friend-group').value,
  };

  if (!friend.name || !friend.url) {
    showToast('请填写名称和 URL', 'error');
    return;
  }

  if (editingFriend !== null) {
    friends[editingFriend] = friend;
  } else {
    friends.push(friend);
  }

  await fetchJson('/api/friends', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(friends),
  });

  showToast('保存成功', 'success');
  document.getElementById('friend-modal').classList.add('hidden');
  await loadFriends();
}

async function deleteFriend(index) {
  if (!confirm('确定删除这个友链吗？')) return;
  friends.splice(index, 1);
  await fetchJson('/api/friends', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(friends),
  });
  showToast('删除成功', 'success');
  await loadFriends();
}

async function loadSettings() {
  config = await fetchJson('/api/config');
  document.getElementById('site-title').value = config.title || '';
  document.getElementById('site-subtitle').value = config.subtitle || '';
  document.getElementById('site-desc').value = config.description || '';
  document.getElementById('site-author').value = config.author || '';
  document.getElementById('site-callsign').value = config.callsign || '';
  document.getElementById('site-email').value = config.email || '';
  document.getElementById('site-url').value = config.url || '';
  document.getElementById('site-perpage').value = config.postsPerPage || 10;
}

function initSettings() {
  document.getElementById('btn-save-config')?.addEventListener('click', async () => {
    config.title = document.getElementById('site-title').value;
    config.subtitle = document.getElementById('site-subtitle').value;
    config.description = document.getElementById('site-desc').value;
    config.author = document.getElementById('site-author').value;
    config.callsign = document.getElementById('site-callsign').value;
    config.email = document.getElementById('site-email').value;
    config.url = document.getElementById('site-url').value;
    config.postsPerPage = parseInt(document.getElementById('site-perpage').value, 10);

    await fetchJson('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });

    showToast('配置已保存', 'success');
  });
}

function initTheme() {
  const primary = document.getElementById('theme-primary');
  const blur = document.getElementById('theme-blur');
  const radius = document.getElementById('theme-radius');

  primary?.addEventListener('input', updateThemePreview);
  blur?.addEventListener('input', (event) => {
    document.getElementById('blur-value').textContent = `${event.target.value}px`;
    updateThemePreview();
  });
  radius?.addEventListener('input', (event) => {
    document.getElementById('radius-value').textContent = `${event.target.value}px`;
    updateThemePreview();
  });

  document.getElementById('btn-save-theme')?.addEventListener('click', async () => {
    showToast('主题预设暂未持久化，后续可继续接到 theme.json', 'info');
  });
}

function updateThemePreview() {
  const primary = document.getElementById('theme-primary')?.value || '#f472b6';
  const blur = document.getElementById('theme-blur')?.value || 20;
  const radius = document.getElementById('theme-radius')?.value || 16;
  const preview = document.getElementById('theme-preview-box');
  if (preview) {
    preview.style.setProperty('--primary', primary);
    preview.style.setProperty('--blur', `${blur}px`);
    preview.style.setProperty('--radius', `${radius}px`);
  }
}

async function buildSite() {
  const status = document.getElementById('build-status');
  const text = document.getElementById('build-text');
  status.classList.remove('hidden');
  text.textContent = '构建中...';

  try {
    await fetchJson('/api/build', { method: 'POST' });
  } catch (error) {
    showToast(error.message || '构建请求失败', 'error');
    status.classList.add('hidden');
  }
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
