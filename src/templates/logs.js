import { renderLayout } from './layout.js';
import { escapeHtml, formatDate, safeUrl, truncate, withBasePath } from '../lib/utils.js';

function getModeClass(mode) {
  if (!mode) return '';
  const value = String(mode).toUpperCase();
  if (['SSB', 'LSB', 'USB'].includes(value)) return 'mode-ssb';
  if (['CW', 'MORSE'].includes(value)) return 'mode-cw';
  if (value === 'FM') return 'mode-fm';
  if (value === 'AM') return 'mode-am';
  if (['FT8', 'FT4', 'JT65', 'PSK31', 'RTTY', 'DIGITAL'].some((item) => value.includes(item))) return 'mode-digital';
  return 'mode-other';
}

function dataAttr(value) {
  return escapeHtml(String(value || '').toLowerCase());
}

function renderLogTableRow(log, basePath, index) {
  const callsign = log.callsign || '-';
  const band = log.band || '-';
  const mode = log.mode || '-';
  const rst = `${log.rstSent || '-'}/${log.rstReceived || '-'}`;
  const country = log.qth || '-';
  const frequency = log.frequency || '-';
  const rowUrl = withBasePath(log.url, basePath);
  const searchText = [callsign, band, mode, country, log.rig || ''].join(' ');

  return `
    <tr class="log-table-row"
      data-href="${escapeHtml(rowUrl)}"
      data-search="${dataAttr(searchText)}"
      data-date="${escapeHtml(log.date || '')}"
      data-band="${escapeHtml(band)}"
      data-mode="${dataAttr(mode)}">
      <td class="log-col-num">${index + 1}</td>
      <td class="log-col-date">${formatDate(log.date)}</td>
      <td class="log-col-time">${escapeHtml(log.time || '-')}</td>
      <td class="log-col-callsign"><span class="callsign-badge">${escapeHtml(callsign)}</span></td>
      <td class="log-col-band">${escapeHtml(band)}</td>
      <td class="log-col-frequency">${escapeHtml(frequency)}</td>
      <td class="log-col-mode"><span class="mode-tag ${getModeClass(mode)}">${escapeHtml(mode)}</span></td>
      <td class="log-col-rst">${escapeHtml(rst)}</td>
      <td class="log-col-qth">${escapeHtml(truncate(country, 20))}</td>
      <td class="log-col-rig">${escapeHtml(truncate(log.rig || '-', 15))}</td>
    </tr>
  `;
}

function renderBandStats(logs) {
  const bandCount = {};
  const modeCount = {};

  for (const log of logs) {
    const band = log.band || '未知';
    const mode = log.mode || '未知';
    bandCount[band] = (bandCount[band] || 0) + 1;
    modeCount[mode] = (modeCount[mode] || 0) + 1;
  }

  const bandHtml = Object.entries(bandCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([band, count]) => `
      <div class="stat-pill">
        <span class="stat-pill-label">${escapeHtml(band)}</span>
        <span class="stat-pill-value">${count}</span>
      </div>
    `).join('');

  const modeHtml = Object.entries(modeCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([mode, count]) => `
      <div class="stat-pill ${getModeClass(mode)}">
        <span class="stat-pill-label">${escapeHtml(mode)}</span>
        <span class="stat-pill-value">${count}</span>
      </div>
    `).join('');

  return { bandHtml, modeHtml, total: logs.length };
}

export function renderLogsIndex(config, logs, theme = 'anime-sakura') {
  const basePath = config.__basePath || '';
  const { bandHtml, modeHtml, total } = renderBandStats(logs);
  const tableRows = logs.map((log, index) => renderLogTableRow(log, basePath, index)).join('');
  const emptyState = !logs.length ? `
    <div class="logs-empty-state">
      <div class="empty-icon">QSO</div>
      <h3>暂无通联记录</h3>
      <p>在后台添加第一条 QSO 记录后会显示在这里。</p>
    </div>
  ` : '';

  const content = `
    <div class="logs-page">
      <div class="page-header logs-header">
        <div class="logs-title-section">
          <h1 class="page-title">通联日志</h1>
          <p class="page-description">共 ${total} 条 QSO 记录</p>
        </div>
        <div class="logs-stats-section">
          <div class="logs-stat-item">
            <span class="logs-stat-number">${total}</span>
            <span class="logs-stat-label">总通联</span>
          </div>
        </div>
      </div>

      <div class="logs-stats-container card-glass">
        <div class="logs-stats-block">
          <h4>频段分布</h4>
          <div class="logs-stats-pills">${bandHtml}</div>
        </div>
        <div class="logs-stats-block">
          <h4>模式分布</h4>
          <div class="logs-stats-pills">${modeHtml}</div>
        </div>
      </div>

      <div class="logs-filter-bar card-glass" id="logs-filter-bar">
        <div class="filter-group">
          <label for="log-search">搜索</label>
          <input type="search" id="log-search" class="glass-input" placeholder="呼号、频段、模式、位置">
        </div>
        <div class="filter-group">
          <label for="log-date-from">日期从</label>
          <input type="date" id="log-date-from" class="glass-input">
        </div>
        <div class="filter-group">
          <label for="log-date-to">到</label>
          <input type="date" id="log-date-to" class="glass-input">
        </div>
        <div class="filter-group">
          <label for="log-filter-band">频段</label>
          <select id="log-filter-band" class="glass-input">
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
          <label for="log-filter-mode">模式</label>
          <select id="log-filter-mode" class="glass-input">
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
        <button class="glass-btn btn-secondary" id="log-reset-filters" type="button">重置</button>
      </div>

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
          <tbody id="logs-tbody">${tableRows}</tbody>
        </table>
        ${emptyState}
      </div>
    </div>

    <script>
      (() => {
        const rows = Array.from(document.querySelectorAll('.log-table-row'));
        const searchInput = document.getElementById('log-search');
        const dateFromInput = document.getElementById('log-date-from');
        const dateToInput = document.getElementById('log-date-to');
        const bandInput = document.getElementById('log-filter-band');
        const modeInput = document.getElementById('log-filter-mode');
        const countLabel = document.querySelector('.page-description');

        function filterLogs() {
          const search = searchInput.value.trim().toLowerCase();
          const dateFrom = dateFromInput.value;
          const dateTo = dateToInput.value;
          const band = bandInput.value;
          const mode = modeInput.value.toLowerCase();
          let visibleCount = 0;

          for (const row of rows) {
            const rowDate = row.dataset.date || '';
            const visible = (!search || row.dataset.search.includes(search))
              && (!dateFrom || rowDate >= dateFrom)
              && (!dateTo || rowDate <= dateTo)
              && (!band || row.dataset.band === band)
              && (!mode || row.dataset.mode.includes(mode));

            row.hidden = !visible;
            if (visible) {
              visibleCount += 1;
              row.querySelector('.log-col-num').textContent = visibleCount;
            }
          }

          if (countLabel) countLabel.textContent = \`共 \${visibleCount} 条 QSO 记录\`;
        }

        document.getElementById('logs-filter-bar')?.addEventListener('input', filterLogs);
        document.getElementById('logs-filter-bar')?.addEventListener('change', filterLogs);
        document.getElementById('log-reset-filters')?.addEventListener('click', () => {
          searchInput.value = '';
          dateFromInput.value = '';
          dateToInput.value = '';
          bandInput.value = '';
          modeInput.value = '';
          filterLogs();
        });
        document.getElementById('logs-tbody')?.addEventListener('click', (event) => {
          const row = event.target.closest('.log-table-row');
          if (row?.dataset.href) window.location.href = row.dataset.href;
        });
      })();
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
  const qslInfo = [
    { label: 'DATE', value: formatDate(log.date), icon: 'DATE' },
    { label: 'TIME', value: log.time || '--:--', icon: 'TIME' },
    { label: 'CALLSIGN', value: log.callsign || 'N/A', icon: 'CALL' },
    { label: 'BAND', value: log.band || '-', icon: 'BAND' },
    { label: 'FREQUENCY', value: log.frequency || '-', icon: 'FREQ' },
    { label: 'MODE', value: log.mode || '-', icon: 'MODE' },
    { label: 'RST SENT', value: log.rstSent || '-', icon: 'SENT' },
    { label: 'RST RCVD', value: log.rstReceived || '-', icon: 'RCVD' },
    { label: 'QTH', value: log.qth || '-', icon: 'QTH' },
    { label: 'OPERATOR', value: log.operator || config.callsign || '-', icon: 'OP' },
    { label: 'RIG', value: log.rig || '-', icon: 'RIG' },
    { label: 'ANTENNA', value: log.antenna || '-', icon: 'ANT' },
    { label: 'POWER', value: log.power || '-', icon: 'PWR' },
  ];

  const infoGrid = qslInfo.map((item) => `
    <div class="qsl-info-item">
      <div class="qsl-info-icon">${escapeHtml(item.icon)}</div>
      <div class="qsl-info-content">
        <span class="qsl-info-label">${escapeHtml(item.label)}</span>
        <span class="qsl-info-value">${escapeHtml(item.value)}</span>
      </div>
    </div>
  `).join('');

  const content = `
    <div class="log-detail-page">
      <div class="qsl-card-header card-glass">
        <div class="qsl-card-stamp">QSL</div>
        <div class="qsl-card-title">
          <h1>${escapeHtml(log.callsign || 'Unknown Station')}</h1>
          <p class="qsl-card-subtitle">
            ${escapeHtml(log.date || '--')} · ${escapeHtml(log.band || '-')} · ${escapeHtml(log.mode || '-')}
          </p>
        </div>
        <div class="qsl-card-badge ${getModeClass(log.mode)}">${escapeHtml(log.mode || '---')}</div>
      </div>

      <div class="qsl-info-grid card-glass">${infoGrid}</div>

      ${log.notes ? `
        <div class="qsl-notes card-glass">
          <h3>备注</h3>
          <p>${escapeHtml(log.notes).replace(/\n/g, '<br>')}</p>
        </div>
      ` : ''}

      <div class="qsl-navigation">
        <a href="${withBasePath('/logs/', basePath)}" class="glass-btn btn-secondary">返回日志列表</a>
      </div>
    </div>
  `;

  return renderLayout(config, {
    title: `QSO: ${log.callsign || 'Unknown'}`,
    content,
    toc: null,
    theme,
    description: truncate(log.notes || `${log.callsign || ''} ${log.frequency || ''} ${log.mode || ''}`.trim(), 160),
    pathname: safeUrl(log.url || '/logs/', basePath),
    type: 'article',
  });
}
