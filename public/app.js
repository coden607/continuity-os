// Continuity OS Universal App - Frontend Controller
(function () {
  'use strict';

  // --- State ---
  let allRecords = [];
  let uptimeSeconds = 0;
  let uptimeInterval = null;

  // --- Elements ---
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabPanels = document.querySelectorAll('.tab-panel');
  const themeToggle = document.getElementById('themeToggle');
  const systemStatusDot = document.getElementById('systemStatusDot');
  const systemStatusText = document.getElementById('systemStatusText');
  const statRecords = document.getElementById('statRecords');
  const statEvents = document.getElementById('statEvents');
  const statUptime = document.getElementById('statUptime');
  const infoNodeVersion = document.getElementById('infoNodeVersion');
  const infoSwStatus = document.getElementById('infoSwStatus');
  const eventsTableBody = document.getElementById('eventsTableBody');
  const eventBadge = document.getElementById('eventBadge');
  const recordsTableBody = document.getElementById('recordsTableBody');
  const recordFilterInput = document.getElementById('recordFilterInput');
  const btnFilterRecords = document.getElementById('btnFilterRecords');
  const btnQuickRecord = document.getElementById('btnQuickRecord');
  const btnRefreshStats = document.getElementById('btnRefreshStats');
  const newRecordModal = document.getElementById('newRecordModal');
  const btnOpenNewRecordModal = document.getElementById('btnOpenNewRecordModal');
  const btnCloseRecordModal = document.getElementById('btnCloseRecordModal');
  const btnCancelRecordModal = document.getElementById('btnCancelRecordModal');
  const newRecordForm = document.getElementById('newRecordForm');
  const dispatchForm = document.getElementById('dispatchForm');
  const dutyInput = document.getElementById('dutyInput');
  const btnSampleDuty = document.getElementById('btnSampleDuty');
  const dispatchResult = document.getElementById('dispatchResult');
  const settingsForm = document.getElementById('settingsForm');
  const settingAppName = document.getElementById('settingAppName');
  const settingAppVersion = document.getElementById('settingAppVersion');
  const toastContainer = document.getElementById('toastContainer');
  const apiResponseBox = document.getElementById('apiResponseBox');

  // --- Toasts ---
  function showToast(message, type = 'info') {
    if (!toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  // --- Theme Management ---
  function initTheme() {
    const saved = localStorage.getItem('theme') || 'dark';
    if (saved === 'light') {
      document.body.classList.add('light-theme');
      themeToggle.textContent = '☀️';
    } else {
      document.body.classList.remove('light-theme');
      themeToggle.textContent = '🌙';
    }
  }

  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const isLight = document.body.classList.toggle('light-theme');
      localStorage.setItem('theme', isLight ? 'light' : 'dark');
      themeToggle.textContent = isLight ? '☀️' : '🌙';
    });
  }

  // --- Service Worker ---
  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then(reg => {
          if (infoSwStatus) infoSwStatus.textContent = 'Active (Ready)';
        })
        .catch(err => {
          if (infoSwStatus) infoSwStatus.textContent = 'Fallback (Offline cache unavailable)';
        });
    } else {
      if (infoSwStatus) infoSwStatus.textContent = 'Not supported';
    }
  }

  // --- Navigation Tabs ---
  function initTabs() {
    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const tabTarget = btn.getAttribute('data-tab');
        tabButtons.forEach(b => b.classList.remove('active'));
        tabPanels.forEach(p => p.classList.remove('active'));

        btn.classList.add('active');
        const targetPanel = document.getElementById(`tab-${tabTarget}`);
        if (targetPanel) targetPanel.classList.add('active');

        // Refresh views on tab change
        if (tabTarget === 'records') loadRecords();
        if (tabTarget === 'dashboard') loadDashboard();
        if (tabTarget === 'settings') loadSettings();
      });
    });
  }

  // --- Formatting Helpers ---
  function formatUptime(seconds) {
    if (isNaN(seconds) || seconds < 0) return '0s';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hrs > 0) return `${hrs}h ${mins}m ${secs}s`;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  }

  function formatDate(isoString) {
    if (!isoString) return '-';
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' ' + date.toLocaleDateString();
    } catch {
      return isoString;
    }
  }

  // --- API Calls ---
  async function fetchJson(url, options = {}) {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json', ...options.headers },
      ...options,
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(errBody.error || `HTTP ${res.status}`);
    }
    return res.json();
  }

  // --- Dashboard ---
  async function loadDashboard() {
    try {
      const health = await fetchJson('/api/health');
      if (statRecords) statRecords.textContent = health.stats?.recordsCount ?? 0;
      if (statEvents) statEvents.textContent = health.stats?.eventsCount ?? 0;
      if (infoNodeVersion) infoNodeVersion.textContent = health.nodeVersion || 'Node 24';

      uptimeSeconds = Math.floor(health.uptime || 0);
      if (statUptime) statUptime.textContent = formatUptime(uptimeSeconds);

      if (systemStatusDot) systemStatusDot.style.backgroundColor = 'var(--accent-green)';
      if (systemStatusText) systemStatusText.textContent = 'Healthy';

      loadEvents();
    } catch (err) {
      if (systemStatusDot) systemStatusDot.style.backgroundColor = 'var(--accent-red)';
      if (systemStatusText) systemStatusText.textContent = 'Offline';
      showToast(`Health check failed: ${err.message}`, 'error');
    }
  }

  async function loadEvents() {
    try {
      const data = await fetchJson('/api/events?limit=15');
      const events = data.events || [];
      if (eventBadge) eventBadge.textContent = `${events.length} recent`;

      if (!eventsTableBody) return;
      if (events.length === 0) {
        eventsTableBody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">No activity recorded yet.</td></tr>';
        return;
      }

      eventsTableBody.innerHTML = events.map(ev => {
        const payloadStr = JSON.stringify(ev.payload || {});
        const preview = payloadStr.length > 50 ? payloadStr.slice(0, 47) + '...' : payloadStr;
        return `
          <tr>
            <td><code>${ev.id}</code></td>
            <td><span class="badge badge-primary">${ev.type}</span></td>
            <td><small>${formatDate(ev.created_at)}</small></td>
            <td><code title="${escapeHtml(payloadStr)}">${escapeHtml(preview)}</code></td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      if (eventsTableBody) {
        eventsTableBody.innerHTML = `<tr><td colspan="4" style="color: var(--accent-red);">Failed to load events: ${escapeHtml(err.message)}</td></tr>`;
      }
    }
  }

  // --- Records Management ---
  async function loadRecords() {
    try {
      const data = await fetchJson('/api/records?limit=100');
      allRecords = data.records || [];
      renderRecords(allRecords);
    } catch (err) {
      showToast(`Failed to load records: ${err.message}`, 'error');
      if (recordsTableBody) {
        recordsTableBody.innerHTML = `<tr><td colspan="5" style="color: var(--accent-red);">Error loading records: ${escapeHtml(err.message)}</td></tr>`;
      }
    }
  }

  function renderRecords(records) {
    if (!recordsTableBody) return;
    if (!records || records.length === 0) {
      recordsTableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">No records found. Click "+ New Record" to create one.</td></tr>';
      return;
    }

    recordsTableBody.innerHTML = records.map(r => {
      const statusBadge = r.status === 'active' ? 'badge-primary' : (r.status === 'completed' ? 'badge-success' : 'badge-secondary');
      return `
        <tr>
          <td><strong><code>${escapeHtml(r.id)}</code></strong></td>
          <td><span class="badge">${escapeHtml(r.type)}</span></td>
          <td><span class="badge ${statusBadge}">${escapeHtml(r.status)}</span></td>
          <td><small>${formatDate(r.updated_at)}</small></td>
          <td>
            <button class="btn btn-secondary btn-sm" onclick="window.viewRecordDetail('${escapeHtml(r.id)}')">View</button>
            <button class="btn btn-danger btn-sm" onclick="window.deleteRecordItem('${escapeHtml(r.id)}')">Delete</button>
          </td>
        </tr>
      `;
    }).join('');
  }

  function filterRecords() {
    const query = (recordFilterInput?.value || '').trim().toLowerCase();
    if (!query) {
      renderRecords(allRecords);
      return;
    }
    const filtered = allRecords.filter(r =>
      r.id.toLowerCase().includes(query) ||
      r.type.toLowerCase().includes(query) ||
      r.status.toLowerCase().includes(query) ||
      JSON.stringify(r.data).toLowerCase().includes(query)
    );
    renderRecords(filtered);
  }

  if (btnFilterRecords) btnFilterRecords.addEventListener('click', filterRecords);
  if (recordFilterInput) recordFilterInput.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') filterRecords();
  });

  // Modal handlers
  function openModal() {
    if (newRecordModal) newRecordModal.style.display = 'flex';
  }
  function closeModal() {
    if (newRecordModal) newRecordModal.style.display = 'none';
    if (newRecordForm) newRecordForm.reset();
  }

  if (btnOpenNewRecordModal) btnOpenNewRecordModal.addEventListener('click', openModal);
  if (btnCloseRecordModal) btnCloseRecordModal.addEventListener('click', closeModal);
  if (btnCancelRecordModal) btnCancelRecordModal.addEventListener('click', closeModal);

  if (newRecordForm) {
    newRecordForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const type = document.getElementById('recordTypeInput')?.value.trim();
      const status = document.getElementById('recordStatusInput')?.value || 'active';
      const rawJson = document.getElementById('recordJsonInput')?.value.trim();

      let data = {};
      if (rawJson) {
        try {
          data = JSON.parse(rawJson);
        } catch (err) {
          showToast('Invalid JSON in data payload: ' + err.message, 'error');
          return;
        }
      }

      try {
        await fetchJson('/api/records', {
          method: 'POST',
          body: JSON.stringify({ type, status, data }),
        });
        showToast(`Record created successfully`, 'success');
        closeModal();
        loadRecords();
        loadDashboard();
      } catch (err) {
        showToast(`Creation failed: ${err.message}`, 'error');
      }
    });
  }

  // Quick Sample Record Button
  if (btnQuickRecord) {
    btnQuickRecord.addEventListener('click', async () => {
      const sampleTypes = ['customer', 'task', 'agent-job', 'sensor', 'order'];
      const randomType = sampleTypes[Math.floor(Math.random() * sampleTypes.length)];
      const sampleData = {
        name: `Sample ${randomType.toUpperCase()} #${Math.floor(Math.random() * 1000)}`,
        createdVia: 'Quick Launch Button',
        metric: Math.round(Math.random() * 100)
      };

      try {
        await fetchJson('/api/records', {
          method: 'POST',
          body: JSON.stringify({
            type: randomType,
            status: 'active',
            data: sampleData
          })
        });
        showToast(`Added sample record (${randomType})`, 'success');
        loadDashboard();
      } catch (err) {
        showToast(`Failed: ${err.message}`, 'error');
      }
    });
  }

  if (btnRefreshStats) {
    btnRefreshStats.addEventListener('click', () => {
      loadDashboard();
      showToast('Dashboard stats refreshed', 'info');
    });
  }

  // --- AI Dispatcher ---
  const sampleDuties = [
    "Fix a small typo in public/index.html header badge",
    "Audit the entire repository for security flaws and produce a report",
    "Design and implement a multi-tenant billing engine with Stripe webhooks",
    "Run unit tests and check server response status codes",
    "Write a quick regex to validate phone numbers in North America"
  ];

  if (btnSampleDuty) {
    btnSampleDuty.addEventListener('click', () => {
      const randomDuty = sampleDuties[Math.floor(Math.random() * sampleDuties.length)];
      if (dutyInput) dutyInput.value = randomDuty;
    });
  }

  if (dispatchForm) {
    dispatchForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const duty = dutyInput?.value.trim();
      if (!duty) {
        showToast('Please enter a task or duty description', 'warning');
        return;
      }

      if (dispatchResult) {
        dispatchResult.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-muted);">Routing task through Continuity OS agent layers...</div>';
      }

      try {
        const start = performance.now();
        const res = await fetchJson('/api/dispatch', {
          method: 'POST',
          body: JSON.stringify({ duty })
        });
        const elapsed = Math.round(performance.now() - start);
        const plan = res.plan || {};

        if (dispatchResult) {
          dispatchResult.innerHTML = `
            <div style="display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap;">
              <span class="badge badge-primary">Tier: ${escapeHtml(plan.tier || 'unknown')}</span>
              <span class="badge badge-success">Route: ${escapeHtml(plan.route || 'direct')}</span>
              <span class="badge badge-secondary">${elapsed}ms</span>
            </div>
            <table style="font-size: 0.85rem; margin-bottom: 12px;">
              <tbody>
                <tr><td style="color: var(--text-muted); width: 120px;">Strategy</td><td><strong>${escapeHtml(plan.strategy || '-')}</strong></td></tr>
                <tr><td style="color: var(--text-muted);">Assigned Model</td><td><code>${escapeHtml(plan.model || plan.recommended_model || 'auto')}</code></td></tr>
                <tr><td style="color: var(--text-muted);">Persona Hint</td><td>${escapeHtml(plan.persona || '-')}</td></tr>
                <tr><td style="color: var(--text-muted);">Est. Tokens</td><td>${escapeHtml(String(plan.estimated_tokens || '~500'))}</td></tr>
              </tbody>
            </table>
            <div class="card-header" style="margin-top: 10px; margin-bottom: 6px;">
              <span style="font-size: 0.8rem; font-weight: 600; color: var(--text-muted);">DISPATCH PLAN JSON</span>
            </div>
            <pre class="code-box">${escapeHtml(JSON.stringify(plan, null, 2))}</pre>
          `;
        }
        showToast(`Task routed to tier: ${plan.tier}`, 'success');
        loadDashboard();
      } catch (err) {
        if (dispatchResult) {
          dispatchResult.innerHTML = `<div style="color: var(--accent-red); padding: 12px;">Routing error: ${escapeHtml(err.message)}</div>`;
        }
        showToast(`Dispatch failed: ${err.message}`, 'error');
      }
    });
  }

  // --- API Console Helper ---
  window.runApiCall = async function (endpoint, method = 'GET') {
    if (!apiResponseBox) return;
    apiResponseBox.textContent = `Executing ${method} ${endpoint}...`;
    const start = performance.now();
    try {
      const res = await fetch(endpoint, { method });
      const time = Math.round(performance.now() - start);
      const json = await res.json();
      apiResponseBox.textContent = `// HTTP ${res.status} (${time}ms)\n` + JSON.stringify(json, null, 2);
    } catch (err) {
      apiResponseBox.textContent = `// Error: ${err.message}`;
    }
  };

  // --- Record Actions (Global) ---
  window.viewRecordDetail = function (id) {
    const record = allRecords.find(r => r.id === id);
    if (!record) return;
    alert(`Record: ${record.id}\nType: ${record.type}\nStatus: ${record.status}\nData:\n${JSON.stringify(record.data, null, 2)}`);
  };

  window.deleteRecordItem = async function (id) {
    if (!confirm(`Are you sure you want to delete record ${id}?`)) return;
    try {
      await fetchJson(`/api/records/${id}`, { method: 'DELETE' });
      showToast(`Record ${id} deleted`, 'info');
      loadRecords();
      loadDashboard();
    } catch (err) {
      showToast(`Delete failed: ${err.message}`, 'error');
    }
  };

  // --- Settings Form ---
  async function loadSettings() {
    try {
      const data = await fetchJson('/api/settings');
      const settings = data.settings || {};
      if (settingAppName && settings['app.name']) settingAppName.value = settings['app.name'];
      if (settingAppVersion && settings['app.version']) settingAppVersion.value = settings['app.version'];
    } catch (err) {
      console.warn('Could not load settings:', err);
    }
  }

  if (settingsForm) {
    settingsForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const appName = settingAppName?.value.trim();
      const appVersion = settingAppVersion?.value.trim();
      try {
        await fetchJson('/api/settings', {
          method: 'POST',
          body: JSON.stringify({
            'app.name': appName,
            'app.version': appVersion
          })
        });
        showToast('Settings saved successfully', 'success');
      } catch (err) {
        showToast(`Failed to save settings: ${err.message}`, 'error');
      }
    });
  }

  // --- Utility ---
  function escapeHtml(str) {
    if (typeof str !== 'string') return String(str);
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // --- Init ---
  initTheme();
  initTabs();
  registerServiceWorker();
  loadDashboard();

  // Uptime tick
  uptimeInterval = setInterval(() => {
    uptimeSeconds++;
    if (statUptime) statUptime.textContent = formatUptime(uptimeSeconds);
  }, 1000);

})();
