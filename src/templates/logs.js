import { renderLayout } from './layout.js';
import { formatDate, truncate, withBasePath, slugify } from '../lib/utils.js';

// 生成日志表格行
function renderLogTableRow(log, basePath, index) {
  const callsign = log.callsign || '-';
  const band = log.band || '-';
  const mode = log.mode || '-';
  const rst = `${log.rstSent || '-'}/${log.rstReceived || '-'}`;
  const country = log.qth || '-';
  const frequency = log.frequency || '-';
  
  // 根据模式显示不同颜色标签
  const modeClass = getModeClass(mode);
  
  return `
    <tr class="log-table-row" onclick="window.location.href='${withBasePath(log.url, basePath)}'">
      <td class="log-col-num">${index + 1}</td>
      <td class="log-col-date">${formatDate(log.date)}</td>
      <td class="log-col-time">${log.time || '-'}</td>
      <td class="log-col-callsign">
        <span class="callsign-badge">${callsign}</span>
      </td>
      <td class="log-col-band">${band}</td>
      <td class="log-col-frequency">${frequency}</td>
      <td class="log-col-mode">
        <span class="mode-tag ${modeClass}">${mode}</span>
      </td>
      <td class="log-col-rst">${rst}</td>
      <td class="log-col-qth">${truncate(country, 20)}</td>
      <td class="log-col-rig">${truncate(log.rig || '-', 15)}</td>
    </tr>
  `;
}

// 获取模式对应的CSS类
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

// 生成频段统计
function renderBandStats(logs) {
  const bandCount = {};
  const modeCount = {};
  
  logs.forEach(log => {
    const band = log.band || '未知';
    const mode = log.mode || '未知';
    bandCount[band] = (bandCount[band] || 0) + 1;
    modeCount[mode] = (modeCount[mode] || 0) + 1;
  });
  
  const bandHtml = Object.entries(bandCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([band, count]) => `
      <div class="stat-pill">
        <span class="stat-pill-label">${band}</span>
        <span class="stat-pill-value">${count}</span>
      </div>
    `).join('');
  
  const modeHtml = Object.entries(modeCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([mode, count]) => `
      <div class="stat-pill mode-${getModeClass(mode)}">
        <span class="stat-pill-label">${mode}</span>
        <span class="stat-pill-value">${count}</span>
      </div>
    `).join('');
  
  return { bandHtml, modeHtml, total: logs.length };
}

export function renderLogsIndex(config, logs, theme = 'anime-sakura') {
  const basePath = config.__basePath || '';
  const { bandHtml, modeHtml, total } = renderBandStats(logs);
  
  // 生成表格行
  const tableRows = logs.length
    ? logs.map((log, index) => renderLogTableRow(log, basePath, index)).join('')
    : '';
  
  // 空状态
  const emptyState = !logs.length ? `
    <div class="logs-empty-state">
      <div class="empty-icon">📡</div>
      <h3>暂无通联记录</h3>
      <p>在后台添加你的第一条 QSO 记录吧</p>
    </div>
  ` : '';

  const content = `
    <div class="logs-page">
      <!-- 页面头部 -->
      <div class="page-header logs-header">
        <div class="logs-title-section">
          <h1 class="page-title">📡 通联日志</h1>
          <p class="page-description">共 ${total} 条 QSO 记录</p>
        </div>
        <div class="logs-stats-section">
          <div class="logs-stat-item">
            <span class="logs-stat-number">${total}</span>
            <span class="logs-stat-label">总通联</span>
          </div>
        </div>
      </div>

      <!-- 统计卡片 -->
      <div class="logs-stats-container card-glass">
        <div class="logs-stats-block">
          <h4>频段分布</h4>
          <div class="logs-stats-pills">
            ${bandHtml}
          </div>
        </div>
        <div class="logs-stats-block">
          <h4>模式分布</h4>
          <div class="logs-stats-pills">
            ${modeHtml}
          </div>
        </div>
      </div>

      <!-- 搜索筛选栏 -->
      <div class="logs-filter-bar card-glass">
        <div class="filter-group">
          <label>搜索</label>
          <input type="text" id="log-search" class="glass-input" placeholder="呼号、频段、模式..." onkeyup="filterLogs()">
        </div>
        <div class="filter-group">
          <label>日期从</label>
          <input type="date" id="log-date-from" class="glass-input" onchange="filterLogs()">
        </div>
        <div class="filter-group">
          <label>到</label>
          <input type="date" id="log-date-to" class="glass-input" onchange="filterLogs()">
        </div>
        <div class="filter-group">
          <label>频段</label>
          <select id="log-filter-band" class="glass-input" onchange="filterLogs()">
            <option value="">全部</option>
            <option value="160m">160m</option>
            <option value="80m">80m</option>
            <option value="40m">40m</option>
            <option value="30m">30m</option>
            <option value="20m">20m</option>
            <option value="17m">17m</option>
            <option value="15m">15m</option>
            <option value="12m">12m</option>
            <option value="10m">10m</option>
            <option value="6m">6m</option>
            <option value="2m">2m</option>
            <option value="70cm">70cm</option>
          </select>
        </div>
        <div class="filter-group">
          <label>模式</label>
          <select id="log-filter-mode" class="glass-input" onchange="filterLogs()">
            <option value="">全部</option>
            <option value="SSB">SSB</option>
            <option value="CW">CW</option>
            <option value="FM">FM</option>
            <option value="AM">AM</option>
            <option value="FT8">FT8</option>
            <option value="FT4">FT4</option>
            <option value="JT65">JT65</option>
            <option value="RTTY">RTTY</option>
          </select>
        </div>
        <button class="glass-btn btn-secondary" onclick="resetFilters()">重置</button>
      </div>

      <!-- 日志表格 -->
      <div class="logs-table-container card-glass">
        <table class="logs-table" id="logs-table">
          <thead>
            <tr>
              <th class="log-col-num">#</th>
              <th class="log-col-date">日期</th>
              <th class="log-col-time">时间</th>
              <th class="log-col-callsign">呼号</th>
              <th class="log-col-band">频段</th>
              <th class="log-col-frequency">频率</th>
              <th class="log-col-mode">模式</th>
              <th class="log-col-rst">信号</th>
              <th class="log-col-qth">位置</th>
              <th class="log-col-rig">设备</th>
            </tr>
          </thead>
          <tbody id="logs-tbody">
            ${tableRows}
          </tbody>
        </table>
        ${emptyState}
      </div>
    </div>

    <script>
      // 原始日志数据
      const originalLogs = ${JSON.stringify(logs)};
      
      function filterLogs() {
        const search = document.getElementById('log-search').value.toLowerCase();
        const dateFrom = document.getElementById('log-date-from').value;
        const dateTo = document.getElementById('log-date-to').value;
        const band = document.getElementById('log-filter-band').value;
        const mode = document.getElementById('log-filter-mode').value;
        
        const rows = document.querySelectorAll('.log-table-row');
        let visibleCount = 0;
        
        rows.forEach((row, index) => {
          const log = originalLogs[index];
          if (!log) return;
          
          let visible = true;
          
          // 搜索匹配
          if (search) {
            const searchFields = [
              log.callsign || '',
              log.band || '',
              log.mode || '',
              log.qth || '',
              log.rig || ''
            ].join(' ').toLowerCase();
            visible = searchFields.includes(search);
          }
          
          // 日期范围
          if (visible && dateFrom && log.date < dateFrom) visible = false;
          if (visible && dateTo && log.date > dateTo) visible = false;
          
          // 频段筛选
          if (visible && band && log.band !== band) visible = false;
          
          // 模式筛选
          if (visible && mode && !log.mode?.toUpperCase().includes(mode.toUpperCase())) visible = false;
          
          row.style.display = visible ? '' : 'none';
          if (visible) {
            visibleCount++;
            row.querySelector('.log-col-num').textContent = visibleCount;
          }
        });
        
        // 更新计数
        document.querySelector('.page-description').textContent = \`共 \${visibleCount} 条 QSO 记录\`;
      }
      
      function resetFilters() {
        document.getElementById('log-search').value = '';
        document.getElementById('log-date-from').value = '';
        document.getElementById('log-date-to').value = '';
        document.getElementById('log-filter-band').value = '';
        document.getElementById('log-filter-mode').value = '';
        filterLogs();
      }
    </script>
  `;

  return renderLayout(config, {
    title: '通联日志',
    content,
    toc: null,
    theme,
    description: `共 ${total} 条通联日志记录`,
    pathname: '/logs/',
  });
}

export function renderLogEntry(config, log, theme = 'anime-sakura') {
  const basePath = config.__basePath || '';
  
  // QSL 卡片风格的信息展示
  const qslInfo = [
    { label: 'DATE', value: formatDate(log.date), icon: '📅' },
    { label: 'TIME', value: log.time || '--:--', icon: '🕐' },
    { label: 'CALLSIGN', value: log.callsign || 'N/A', icon: '📡' },
    { label: 'BAND', value: log.band || '-', icon: '📶' },
    { label: 'FREQUENCY', value: log.frequency || '-', icon: '📻' },
    { label: 'MODE', value: log.mode || '-', icon: '🔊' },
    { label: 'RST SENT', value: log.rstSent || '-', icon: '📤' },
    { label: 'RST RCVD', value: log.rstReceived || '-', icon: '📥' },
    { label: 'QTH', value: log.qth || '-', icon: '📍' },
    { label: 'OPERATOR', value: log.operator || config.callsign || '-', icon: '👤' },
    { label: 'RIG', value: log.rig || '-', icon: '⚡' },
    { label: 'ANTENNA', value: log.antenna || '-', icon: '📡' },
    { label: 'POWER', value: log.power || '-', icon: '⚡' },
  ];

  const infoGrid = qslInfo.map(item => `
    <div class="qsl-info-item">
      <div class="qsl-info-icon">${item.icon}</div>
      <div class="qsl-info-content">
        <span class="qsl-info-label">${item.label}</span>
        <span class="qsl-info-value">${item.value}</span>
      </div>
    </div>
  `).join('');

  const content = `
    <div class="log-detail-page">
      <!-- QSL 卡片头部 -->
      <div class="qsl-card-header card-glass">
        <div class="qsl-card-stamp">QSL</div>
        <div class="qsl-card-title">
          <h1>${log.callsign || 'Unknown Station'}</h1>
          <p class="qsl-card-subtitle">
            ${log.date || '--'} · ${log.band || '-'} · ${log.mode || '-'}
          </p>
        </div>
        <div class="qsl-card-badge ${getModeClass(log.mode)}">
          ${log.mode || '---'}
        </div>
      </div>

      <!-- QSL 信息网格 -->
      <div class="qsl-info-grid card-glass">
        ${infoGrid}
      </div>

      <!-- 备注区域 -->
      ${log.notes ? `
        <div class="qsl-notes card-glass">
          <h3>📝 备注</h3>
          <p>${log.notes.replace(/\n/g, '<br>')}</p>
        </div>
      ` : ''}

      <!-- 导航按钮 -->
      <div class="qsl-navigation">
        <a href="${withBasePath('/logs/', basePath)}" class="glass-btn btn-secondary">
          ← 返回日志列表
        </a>
      </div>
    </div>
  `;

  return renderLayout(config, {
    title: `QSO: ${log.callsign || 'Unknown'}`,
    content,
    toc: null,
    theme,
    description: truncate(log.notes || `${log.callsign || ''} ${log.frequency || ''} ${log.mode || ''}`.trim(), 160),
    pathname: log.url,
    type: 'article',
  });
}
