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

function getLogTitle(log) {
  if (log.title) return log.title;
  return [log.date, log.callsign, log.band, log.mode].filter(Boolean).join(' ') || '未命名日志';
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
  initAbout();
  initImages();
  initTags();
  initNav();
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
    case 'about': loadAbout(); break;
    case 'images': loadImages(); break;
    case 'tags': loadTags(); break;
    case 'nav': loadNav(); break;
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
  filteredPosts = [...posts];
  
  updateFilterOptions();
  renderPostsList();
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

  // Post filters
  document.getElementById('post-search')?.addEventListener('input', filterPosts);
  document.getElementById('post-category-filter')?.addEventListener('change', filterPosts);
  document.getElementById('post-tag-filter')?.addEventListener('change', filterPosts);
  document.getElementById('btn-clear-post-filters')?.addEventListener('click', clearPostFilters);
}

function filterPosts() {
  const search = document.getElementById('post-search').value.toLowerCase();
  const category = document.getElementById('post-category-filter').value;
  const tag = document.getElementById('post-tag-filter').value;

  filteredPosts = posts.filter(post => {
    const matchesSearch = !search || post.title.toLowerCase().includes(search);
    const matchesCategory = !category || post.category === category;
    const matchesTag = !tag || (post.tags && post.tags.includes(tag));
    return matchesSearch && matchesCategory && matchesTag;
  });

  renderPostsList();
}

function clearPostFilters() {
  document.getElementById('post-search').value = '';
  document.getElementById('post-category-filter').value = '';
  document.getElementById('post-tag-filter').value = '';
  filteredPosts = [...posts];
  renderPostsList();
}

function renderPostsList() {
  const grid = document.getElementById('posts-grid');
  
  if (!filteredPosts.length) {
    grid.innerHTML = '<div class="empty">没有找到文章</div>';
    return;
  }

  grid.innerHTML = filteredPosts.map((post) => `
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
  `).join('');
}

function updateFilterOptions() {
  // Extract unique categories and tags
  const categories = [...new Set(posts.filter(p => p.category).map(p => p.category))];
  const allTags = [...new Set(posts.flatMap(p => p.tags || []))];

  const categorySelect = document.getElementById('post-category-filter');
  const tagSelect = document.getElementById('post-tag-filter');

  categorySelect.innerHTML = '<option value="">所有分类</option>' + 
    categories.map(c => `<option value="${c}">${c}</option>`).join('');

  tagSelect.innerHTML = '<option value="">所有标签</option>' + 
    allTags.map(t => `<option value="${t}">${t}</option>`).join('');
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
  
  // Check favicon
  updateFaviconPreview();
}

function updateFaviconPreview() {
  const img = document.getElementById('current-favicon');
  const placeholder = document.getElementById('favicon-placeholder');
  const urlInput = document.getElementById('favicon-url');
  
  const faviconUrl = config.favicon || '';
  if (urlInput) urlInput.value = faviconUrl;
  
  if (faviconUrl) {
    img.src = faviconUrl;
    img.onload = () => {
      img.style.display = 'block';
      placeholder.style.display = 'none';
    };
    img.onerror = () => {
      img.style.display = 'none';
      placeholder.style.display = 'block';
    };
  } else {
    img.style.display = 'none';
    placeholder.style.display = 'block';
  }
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
  
  // Favicon management
  const urlInput = document.getElementById('favicon-url');
  const saveBtn = document.getElementById('btn-save-favicon');
  const clearBtn = document.getElementById('btn-clear-favicon');
  
  saveBtn?.addEventListener('click', async () => {
    const url = urlInput?.value?.trim() || '';
    config.favicon = url;
    
    try {
      await fetchJson('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      showToast('图标链接已保存', 'success');
      updateFaviconPreview();
    } catch (error) {
      showToast('保存失败: ' + error.message, 'error');
    }
  });
  
  clearBtn?.addEventListener('click', async () => {
    if (!confirm('确定要清除网站图标吗？')) return;
    
    config.favicon = '';
    if (urlInput) urlInput.value = '';
    
    try {
      await fetchJson('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      showToast('图标已清除', 'success');
      updateFaviconPreview();
    } catch (error) {
      showToast('清除失败: ' + error.message, 'error');
    }
  });
}

const defaultTheme = {
  primary: '#f472b6',
  secondary: '#a78bfa',
  blur: 20,
  radius: 16,
  shadowOpacity: 0.1,
  bgType: 'gradient',
  bgGradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
};

async function loadTheme() {
  try {
    const saved = localStorage.getItem('ham-blog-theme');
    currentTheme = saved ? JSON.parse(saved) : { ...defaultTheme };
    applyTheme(currentTheme);
    renderThemeSettings();
  } catch (e) {
    currentTheme = { ...defaultTheme };
  }
}

function initTheme() {
  loadTheme();
  
  document.getElementById('btn-save-theme')?.addEventListener('click', saveTheme);
  document.getElementById('btn-reset-theme')?.addEventListener('click', resetTheme);
}

function renderThemeSettings() {
  const grid = document.getElementById('theme-settings-grid');
  if (!grid) return;
  
  grid.innerHTML = `
    <div class="form-group">
      <label>主色调</label>
      <input type="color" id="theme-primary" class="glass-input" value="${currentTheme.primary}">
    </div>
    <div class="form-group">
      <label>副色调</label>
      <input type="color" id="theme-secondary" class="glass-input" value="${currentTheme.secondary}">
    </div>
    <div class="form-group">
      <label>模糊度 (${currentTheme.blur}px)</label>
      <input type="range" id="theme-blur" min="5" max="50" value="${currentTheme.blur}">
    </div>
    <div class="form-group">
      <label>圆角 (${currentTheme.radius}px)</label>
      <input type="range" id="theme-radius" min="0" max="32" value="${currentTheme.radius}">
    </div>
  `;
  
  // Bind events
  ['primary', 'secondary', 'blur', 'radius'].forEach(key => {
    const el = document.getElementById(`theme-${key}`);
    if (el) {
      el.addEventListener('input', (e) => {
        currentTheme[key] = e.target.type === 'range' ? parseInt(e.target.value) : e.target.value;
        applyTheme(currentTheme);
        if (e.target.type === 'range') {
          e.target.previousElementSibling.textContent = e.target.previousElementSibling.textContent.replace(/\(\d+.*\)/, `(${currentTheme[key]}px)`);
        }
      });
    }
  });
}

function applyTheme(theme) {
  document.documentElement.style.setProperty('--primary', theme.primary);
  document.documentElement.style.setProperty('--secondary', theme.secondary);
  document.documentElement.style.setProperty('--blur', `${theme.blur}px`);
  document.documentElement.style.setProperty('--radius', `${theme.radius}px`);
}

function updateThemePreview() {
  applyTheme(currentTheme);
}

async function saveTheme() {
  localStorage.setItem('ham-blog-theme', JSON.stringify(currentTheme));
  
  // Also save to config for persistence across sessions
  try {
    config.theme = currentTheme;
    await fetchJson('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    showToast('主题设置已保存', 'success');
  } catch (error) {
    // localStorage 保存成功即可
    showToast('主题设置已保存（本地）', 'success');
  }
}

function resetTheme() {
  currentTheme = { ...defaultTheme };
  applyTheme(currentTheme);
  renderThemeSettings();
  localStorage.removeItem('ham-blog-theme');
  showToast('主题已重置为默认', 'info');
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

// ========================================
// About Page Editor
// ========================================
function initAbout() {
  // Tab switching
  document.querySelectorAll('#view-about .tab-btn').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelectorAll('#view-about .tab-btn').forEach((item) => item.classList.remove('active'));
      document.querySelectorAll('#view-about .tab-content').forEach((item) => item.classList.add('hidden'));
      button.classList.add('active');
      document.getElementById(`tab-${button.dataset.tab}`)?.classList.remove('hidden');
      if (button.dataset.tab === 'about-preview') {
        updateAboutPreview();
      }
    });
  });

  // Save button
  document.getElementById('btn-save-about')?.addEventListener('click', saveAbout);
}

// ========================================
// Images Manager
// ========================================
function initImages() {
  const uploadInput = document.getElementById('image-upload-input');
  const uploadBtn = document.getElementById('btn-upload-image');
  const uploadEmptyBtn = document.getElementById('btn-upload-empty');

  uploadBtn?.addEventListener('click', () => uploadInput?.click());
  uploadEmptyBtn?.addEventListener('click', () => uploadInput?.click());

  uploadInput?.addEventListener('change', async (e) => {
    const files = e.target.files;
    if (!files.length) return;

    for (const file of files) {
      const formData = new FormData();
      formData.append('image', file);

      try {
        await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });
        showToast(`上传成功: ${file.name}`, 'success');
      } catch (error) {
        showToast(`上传失败: ${file.name}`, 'error');
      }
    }

    await loadImages();
    uploadInput.value = '';
  });
}

async function loadImages() {
  try {
    const images = await fetchJson('/api/images');
    const grid = document.getElementById('images-grid');
    const emptyState = document.getElementById('images-empty');

    if (!images.length) {
      grid.innerHTML = '';
      emptyState.classList.remove('hidden');
      return;
    }

    emptyState.classList.add('hidden');
    grid.innerHTML = images.map((img) => `
      <div class="image-card glass">
        <img src="${img.url}" alt="${img.name}" loading="lazy">
        <div class="image-overlay">
          <button class="glass-btn btn-sm" onclick="copyImageUrl('${img.url}')">复制链接</button>
          <button class="glass-btn btn-sm btn-danger" onclick="deleteImage('${img.name}')">删除</button>
        </div>
        <div class="image-name">${img.name}</div>
      </div>
    `).join('');
  } catch (error) {
    showToast('加载图片失败', 'error');
  }
}

function copyImageUrl(url) {
  navigator.clipboard.writeText(url).then(() => {
    showToast('链接已复制', 'success');
  });
}

async function deleteImage(filename) {
  if (!confirm(`确定要删除 ${filename} 吗？`)) return;
  
  try {
    await fetchJson(`/api/images/${filename}`, { method: 'DELETE' });
    showToast('图片已删除', 'success');
    await loadImages();
  } catch (error) {
    showToast('删除失败: ' + error.message, 'error');
  }
}

// ========================================
// Tags Manager
// ========================================
let tagsData = {};

function initTags() {
  document.getElementById('btn-add-tag')?.addEventListener('click', addNewTag);
  document.getElementById('new-tag-input')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addNewTag();
  });
}

async function loadTags() {
  posts = await fetchJson('/api/posts');
  
  // 统计标签使用情况
  tagsData = {};
  posts.forEach(post => {
    if (post.tags) {
      post.tags.forEach(tag => {
        if (!tagsData[tag]) tagsData[tag] = { count: 0, posts: [] };
        tagsData[tag].count++;
        tagsData[tag].posts.push(post);
      });
    }
  });

  const container = document.getElementById('tags-container');
  const totalTags = Object.keys(tagsData).length;
  const usedTags = totalTags;

  document.getElementById('total-tags').textContent = totalTags;
  document.getElementById('used-tags').textContent = usedTags;

  if (totalTags === 0) {
    container.innerHTML = '<div class="empty">暂无标签，在文章中添加标签后会自动显示在这里</div>';
    return;
  }

  // 按使用次数排序
  const sortedTags = Object.entries(tagsData).sort((a, b) => b[1].count - a[1].count);

  container.innerHTML = `
    <div class="tags-grid-admin">
      ${sortedTags.map(([tag, data]) => `
        <div class="tag-card glass" data-tag="${tag}">
          <div class="tag-header">
            <span class="tag-name">${tag}</span>
            <span class="tag-count">${data.count} 篇文章</span>
          </div>
          <div class="tag-posts">
            ${data.posts.slice(0, 3).map(p => `
              <div class="tag-post-item" onclick="editPost('${p.path}')">${p.title}</div>
            `).join('')}
            ${data.posts.length > 3 ? `<div class="tag-post-more">还有 ${data.posts.length - 3} 篇...</div>` : ''}
          </div>
          <div class="tag-actions">
            <button class="glass-btn btn-sm" onclick="renameTag('${tag}')">重命名</button>
            <button class="glass-btn btn-sm btn-danger" onclick="deleteTag('${tag}')">删除</button>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

async function addNewTag() {
  const input = document.getElementById('new-tag-input');
  const tagName = input.value.trim();
  
  if (!tagName) {
    showToast('请输入标签名称', 'error');
    return;
  }
  
  if (tagsData[tagName]) {
    showToast('标签已存在', 'error');
    return;
  }
  
  // 新标签需要在文章中添加，这里只是提示
  showToast('标签需要在文章中添加，请编辑文章', 'info');
  input.value = '';
}

async function renameTag(oldTag) {
  const newTag = prompt(`将 "${oldTag}" 重命名为：`, oldTag);
  if (!newTag || newTag === oldTag) return;
  
  if (tagsData[newTag]) {
    showToast('目标标签已存在', 'error');
    return;
  }

  // 更新所有包含该标签的文章
  const postsToUpdate = tagsData[oldTag].posts;
  for (const post of postsToUpdate) {
    const newTags = post.tags.map(t => t === oldTag ? newTag : t);
    // 这里需要更新文章，简化处理
  }
  
  showToast('标签重命名功能需要批量更新文章', 'info');
  await loadTags();
}

async function deleteTag(tag) {
  if (!confirm(`确定删除标签 "${tag}" 吗？这将从所有文章中移除该标签。`)) return;
  
  // 从所有文章中移除该标签
  const postsToUpdate = tagsData[tag].posts;
  for (const post of postsToUpdate) {
    const newTags = post.tags.filter(t => t !== tag);
    // 更新文章
    const content = await fetchJson(`/api/posts/${post.path}`);
    const { meta, body } = parseFrontmatter(content.content);
    meta.tags = newTags;
    
    const newContent = `---
title: ${meta.title}
date: ${meta.date}
tags: [${newTags.join(', ')}]
category: ${meta.category}
---

${body}`;
    
    await fetchJson('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: post.path, content: newContent }),
    });
  }
  
  showToast('标签已删除', 'success');
  await loadTags();
}

// ========================================
// Navigation Manager
// ========================================
let navItems = [];

function initNav() {
  document.getElementById('btn-add-nav')?.addEventListener('click', addNavItem);
  document.getElementById('btn-save-nav')?.addEventListener('click', saveNav);
}

async function loadNav() {
  config = await fetchJson('/api/config');
  navItems = config.nav || [];
  renderNavList();
}

function renderNavList() {
  const container = document.getElementById('nav-items-list');
  
  if (navItems.length === 0) {
    container.innerHTML = '<div class="empty">暂无导航项</div>';
    return;
  }

  container.innerHTML = navItems.map((item, index) => `
    <div class="nav-item-row glass" data-index="${index}">
      <span class="nav-drag-handle">⋮⋮</span>
      <div class="nav-item-fields">
        <input type="text" class="glass-input nav-text" value="${item.text}" placeholder="显示文本" data-index="${index}">
        <input type="text" class="glass-input nav-url" value="${item.url}" placeholder="链接地址" data-index="${index}">
        <input type="text" class="glass-input nav-icon" value="${item.icon || ''}" placeholder="图标" data-index="${index}">
      </div>
      <button class="glass-btn btn-sm btn-danger" onclick="removeNavItem(${index})">删除</button>
    </div>
  `).join('');

  // 绑定输入事件
  container.querySelectorAll('.nav-text, .nav-url, .nav-icon').forEach(input => {
    input.addEventListener('change', updateNavItem);
  });
}

function updateNavItem(e) {
  const index = parseInt(e.target.dataset.index);
  const row = document.querySelector(`.nav-item-row[data-index="${index}"]`);
  
  navItems[index] = {
    text: row.querySelector('.nav-text').value,
    url: row.querySelector('.nav-url').value,
    icon: row.querySelector('.nav-icon').value,
  };
}

function addNavItem() {
  navItems.push({ text: '新菜单', url: '/', icon: '📄' });
  renderNavList();
}

function removeNavItem(index) {
  navItems.splice(index, 1);
  renderNavList();
}

async function saveNav() {
  // 更新配置
  config.nav = navItems;
  
  await fetchJson('/api/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  
  showToast('导航菜单已保存', 'success');
}

async function loadAbout() {
  try {
    const data = await fetchJson('/api/about');
    document.getElementById('about-content').value = data.content || '';
  } catch (error) {
    console.log('No about page found, using default');
    document.getElementById('about-content').value = '';
  }
}

function updateAboutPreview() {
  const content = document.getElementById('about-content').value;
  const html = content
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\n/g, '<br>');
  document.getElementById('about-preview-content').innerHTML = html;
}

async function saveAbout() {
  const content = document.getElementById('about-content').value.trim();

  if (!content) {
    showToast('请填写内容', 'error');
    return;
  }

  const frontmatter = `---
title: 关于
---

${content}`;

  try {
    await fetchJson('/api/about', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: frontmatter }),
    });
    showToast('关于页面已保存', 'success');
  } catch (error) {
    showToast('保存失败: ' + error.message, 'error');
  }
}
