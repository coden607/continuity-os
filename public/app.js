// Continuity OS Universal App - Core Client Controller
(function () {
  'use strict';

  // --- State ---
  let allRecords = [];
  let allSkills = [];
  let currentSkillCategory = 'all';
  let uptimeSeconds = 0;
  let uptimeInterval = null;

  // --- Elements ---
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabPanels = document.querySelectorAll('.tab-panel');
  const themeToggle = document.getElementById('themeToggle');
  const systemStatusDot = document.getElementById('systemStatusDot');
  const systemStatusText = document.getElementById('systemStatusText');
  const statRecords = document.getElementById('statRecords');
  const statSkills = document.getElementById('statSkills');
  const statUptime = document.getElementById('statUptime');
  const infoNodeVersion = document.getElementById('infoNodeVersion');
  const eventsTableBody = document.getElementById('eventsTableBody');
  const eventBadge = document.getElementById('eventBadge');
  const toastContainer = document.getElementById('toastContainer');
  const apiResponseBox = document.getElementById('apiResponseBox');

  // PRD Elements
  const prdListContainer = document.getElementById('prdListContainer');
  const btnReloadPrds = document.getElementById('btnReloadPrds');
  const prdDraftForm = document.getElementById('prdDraftForm');
  const prdProductName = document.getElementById('prdProductName');
  const prdProblem = document.getElementById('prdProblem');
  const prdHypothesis = document.getElementById('prdHypothesis');
  const prdAudience = document.getElementById('prdAudience');
  const prdMvp = document.getElementById('prdMvp');
  const btnFillSamplePrd = document.getElementById('btnFillSamplePrd');
  const prdFilenameInput = document.getElementById('prdFilenameInput');
  const prdViewerArea = document.getElementById('prdViewerArea');
  const btnCopyPrdContent = document.getElementById('btnCopyPrdContent');
  const btnSavePrdContent = document.getElementById('btnSavePrdContent');

  // Token Elements
  const tokenForm = document.getElementById('tokenForm');
  const tokenPromptInput = document.getElementById('tokenPromptInput');
  const tokenExpectedOutput = document.getElementById('tokenExpectedOutput');
  const tokenReportContainer = document.getElementById('tokenReportContainer');
  const btnSamplePromptSmall = document.getElementById('btnSamplePromptSmall');
  const btnSamplePromptLarge = document.getElementById('btnSamplePromptLarge');
  const btnSamplePromptDecision = document.getElementById('btnSamplePromptDecision');

  // Dispatch & Jev Elements
  const dispatchForm = document.getElementById('dispatchForm');
  const dutyInput = document.getElementById('dutyInput');
  const dispatchWithJev = document.getElementById('dispatchWithJev');
  const btnSampleDuty = document.getElementById('btnSampleDuty');
  const dispatchResult = document.getElementById('dispatchResult');
  const jevForm = document.getElementById('jevForm');
  const jevStateInput = document.getElementById('jevStateInput');
  const jevBankSelect = document.getElementById('jevBankSelect');

  // Skills Elements
  const skillsGrid = document.getElementById('skillsGrid');
  const skillSearchInput = document.getElementById('skillSearchInput');
  const skillCategoryFilters = document.getElementById('skillCategoryFilters');
  const skillModal = document.getElementById('skillModal');
  const skillModalTitle = document.getElementById('skillModalTitle');
  const skillModalCategory = document.getElementById('skillModalCategory');
  const skillModalContent = document.getElementById('skillModalContent');
  const btnCloseSkillModal = document.getElementById('btnCloseSkillModal');
  const btnDismissSkillModal = document.getElementById('btnDismissSkillModal');
  const btnCopySkillContent = document.getElementById('btnCopySkillContent');

  // Records & Settings Elements
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
  const settingAppName = document.getElementById('settingAppName');
  const settingAppVersion = document.getElementById('settingAppVersion');
  const settingOpenRouterKey = document.getElementById('settingOpenRouterKey');
  const settingAutonomyLevel = document.getElementById('settingAutonomyLevel');
  const settingWorkerConcurrency = document.getElementById('settingWorkerConcurrency');

  // Agentic Subsystem DOM Elements
  const archonGoalInput = document.getElementById('archonGoalInput');
  const btnArchonPlan = document.getElementById('btnArchonPlan');
  const btnArchonExec = document.getElementById('btnArchonExec');
  const archonOutput = document.getElementById('archonOutput');

  const ragDocInput = document.getElementById('ragDocInput');
  const btnRagIngest = document.getElementById('btnRagIngest');
  const ragQueryInput = document.getElementById('ragQueryInput');
  const btnRagSearch = document.getElementById('btnRagSearch');
  const ragOutput = document.getElementById('ragOutput');

  const guardrailTextInput = document.getElementById('guardrailTextInput');
  const btnRunGuardrail = document.getElementById('btnRunGuardrail');
  const guardrailOutput = document.getElementById('guardrailOutput');

  const btnAuditBrain = document.getElementById('btnAuditBrain');
  const btnExportCrew = document.getElementById('btnExportCrew');
  const btnExportLangGraph = document.getElementById('btnExportLangGraph');
  const btnExportLangChain = document.getElementById('btnExportLangChain');
  const btnExportLlamaIndex = document.getElementById('btnExportLlamaIndex');
  const brainFactoryOutput = document.getElementById('brainFactoryOutput');

  // Factory Worktree & Worker Elements
  const btnRefreshWorktrees = document.getElementById('btnRefreshWorktrees');
  const btnWorkerTick = document.getElementById('btnWorkerTick');
  const btnEnqueueFactoryTask = document.getElementById('btnEnqueueFactoryTask');
  const btnValidateHoldouts = document.getElementById('btnValidateHoldouts');
  const factoryIssueId = document.getElementById('factoryIssueId');
  const factoryTitle = document.getElementById('factoryTitle');
  const factoryBody = document.getElementById('factoryBody');
  const factoryOutput = document.getElementById('factoryOutput');

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
      if (themeToggle) themeToggle.textContent = '☀️';
    } else {
      document.body.classList.remove('light-theme');
      if (themeToggle) themeToggle.textContent = '🌙';
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
      navigator.serviceWorker.register('/sw.js').catch(() => {});
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
        if (tabTarget === 'dashboard') loadDashboard();
        if (tabTarget === 'prd') loadPrds();
        if (tabTarget === 'skills') loadSkills();
        if (tabTarget === 'records') loadRecords();
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

  function escapeHtml(str) {
    if (typeof str !== 'string') return String(str ?? '');
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // --- API Calls ---
  async function fetchJson(url, options = {}) {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
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
      if (statRecords) statRecords.textContent = health.stats?.recordsCount ?? health.stats?.records ?? 0;
      if (infoNodeVersion) infoNodeVersion.textContent = health.nodeVersion || 'Node 24';

      uptimeSeconds = Math.floor(health.uptime || 0);
      if (statUptime) statUptime.textContent = formatUptime(uptimeSeconds);

      if (systemStatusDot) systemStatusDot.style.backgroundColor = 'var(--accent-green)';
      if (systemStatusText) systemStatusText.textContent = 'Healthy';

      loadEvents();
    } catch (err) {
      if (systemStatusDot) systemStatusDot.style.backgroundColor = 'var(--accent-red)';
      if (systemStatusText) systemStatusText.textContent = 'Offline';
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
        const preview = payloadStr.length > 55 ? payloadStr.slice(0, 52) + '...' : payloadStr;
        return `
          <tr>
            <td><code>${ev.id}</code></td>
            <td><span class="badge badge-primary">${escapeHtml(ev.type)}</span></td>
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

  // --- PRD Planning Studio ---
  async function loadPrds() {
    if (!prdListContainer) return;
    try {
      const data = await fetchJson('/api/prds');
      const prds = data.prds || [];
      if (prds.length === 0) {
        prdListContainer.innerHTML = '<div style="color: var(--text-muted); font-size: 0.85rem;">No PRD documents in factory/prd/. Generate one below.</div>';
        return;
      }

      prdListContainer.innerHTML = prds.map(p => `
        <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 10px 12px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-weight: 600; font-size: 0.9rem;">${escapeHtml(p.title)}</div>
            <div style="color: var(--text-muted); font-size: 0.75rem;"><code>${escapeHtml(p.filename)}</code> · ${(p.size / 1024).toFixed(1)} KB</div>
          </div>
          <button class="btn btn-secondary btn-sm" onclick="window.viewPrd('${escapeHtml(p.filename)}')">Open</button>
        </div>
      `).join('');

      // Auto-open first PRD if viewer is empty
      if (prds.length > 0 && !prdViewerArea.value) {
        window.viewPrd(prds[0].filename);
      }
    } catch (err) {
      prdListContainer.innerHTML = `<div style="color: var(--accent-red); font-size: 0.85rem;">Error loading PRDs: ${escapeHtml(err.message)}</div>`;
    }
  }

  window.viewPrd = async function (filename) {
    try {
      const data = await fetchJson(`/api/prds/${encodeURIComponent(filename)}`);
      if (prdViewerArea) prdViewerArea.value = data.content || '';
      if (prdFilenameInput) prdFilenameInput.value = filename;
      showToast(`Loaded ${filename}`, 'info');
    } catch (err) {
      showToast(`Failed to load PRD: ${err.message}`, 'error');
    }
  };

  if (btnReloadPrds) btnReloadPrds.addEventListener('click', loadPrds);

  if (btnFillSamplePrd) {
    btnFillSamplePrd.addEventListener('click', () => {
      if (prdProductName) prdProductName.value = 'Universal Field Dispatch PWA';
      if (prdProblem) prdProblem.value = 'Independent emergency contractors lose 40% of customer calls when dispatchers or mechanics are on jobs. Missed calls immediately dial competitor auto shops or plumbers on Google.';
      if (prdHypothesis) prdHypothesis.value = 'If we trigger immediate automated SMS dispatch within 10 seconds of line busy, 20% of callers complete the request without customer churn.';
      if (prdAudience) prdAudience.value = 'Local auto towing, emergency plumbing, HVAC contractors in 607 area';
      if (prdMvp) prdMvp.value = '- Conditional carrier forward (*71) on busy\n- Automated SMS notification with callback link\n- 14-day free pilot with 11 safety gates\n- Zero hardware install';
    });
  }

  if (prdDraftForm) {
    prdDraftForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const body = {
          product: prdProductName?.value.trim(),
          problem: prdProblem?.value.trim(),
          hypothesis: prdHypothesis?.value.trim(),
          audience: prdAudience?.value.trim(),
          mvp: prdMvp?.value.trim(),
        };
        const res = await fetchJson('/api/prds/generate', { method: 'POST', body: JSON.stringify(body) });
        if (prdViewerArea) prdViewerArea.value = res.markdown;
        const slug = (body.product || 'PRD').toLowerCase().replace(/[^a-z0-9]+/g, '-');
        if (prdFilenameInput) prdFilenameInput.value = `PRD-${slug.toUpperCase()}.md`;
        showToast('PRD draft generated successfully', 'success');
      } catch (err) {
        showToast(`Generation failed: ${err.message}`, 'error');
      }
    });
  }

  if (btnCopyPrdContent) {
    btnCopyPrdContent.addEventListener('click', () => {
      if (!prdViewerArea || !prdViewerArea.value) return;
      navigator.clipboard.writeText(prdViewerArea.value);
      showToast('Markdown copied to clipboard', 'success');
    });
  }

  if (btnSavePrdContent) {
    btnSavePrdContent.addEventListener('click', async () => {
      const content = prdViewerArea?.value || '';
      const filename = (prdFilenameInput?.value || `PRD-${Date.now().toString(36).toUpperCase()}.md`).trim();
      const titleMatch = content.match(/^#\s+(.+)$/m);
      const title = titleMatch ? titleMatch[1].trim() : filename;

      if (!content) {
        showToast('PRD content is empty', 'warning');
        return;
      }

      try {
        await fetchJson('/api/prds', {
          method: 'POST',
          body: JSON.stringify({ filename, title, content }),
        });
        showToast(`Saved ${filename} to factory/prd/`, 'success');
        loadPrds();
      } catch (err) {
        showToast(`Save failed: ${err.message}`, 'error');
      }
    });
  }

  // --- Token Spend Optimizer ---
  if (tokenForm) {
    tokenForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = tokenPromptInput?.value.trim();
      const outputTokens = parseInt(tokenExpectedOutput?.value || '500', 10);
      if (!text) {
        showToast('Please enter prompt text to analyze', 'warning');
        return;
      }

      if (tokenReportContainer) {
        tokenReportContainer.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-muted);">Analyzing token efficiency and pricing tiers...</div>';
      }

      try {
        const res = await fetchJson('/api/tokens/analyze', {
          method: 'POST',
          body: JSON.stringify({ text, outputTokens }),
        });
        renderTokenReport(res.analysis);
      } catch (err) {
        if (tokenReportContainer) {
          tokenReportContainer.innerHTML = `<div style="color: var(--accent-red); padding: 12px;">Analysis error: ${escapeHtml(err.message)}</div>`;
        }
      }
    });
  }

  function renderTokenReport(data) {
    if (!tokenReportContainer) return;
    const costs = data.costs || {};
    const savings = data.savings_percentage || {};
    const recs = data.recommendations || [];

    tokenReportContainer.innerHTML = `
      <div style="display: flex; gap: 8px; margin-bottom: 14px; flex-wrap: wrap;">
        <span class="badge badge-primary">Input: ${data.input_tokens} tokens</span>
        <span class="badge badge-secondary">${data.char_count} chars</span>
        <span class="badge badge-success">Savings: ${savings.fast_vs_frontier}%</span>
      </div>

      <div style="background: rgba(35, 134, 54, 0.15); border: 1px solid var(--success); border-radius: var(--radius-sm); padding: 12px; margin-bottom: 14px;">
        <div style="font-size: 1.1rem; font-weight: 700; color: var(--success); margin-bottom: 4px;">
          💰 ${savings.fast_vs_frontier}% Cost Reduction Possible
        </div>
        <div style="font-size: 0.82rem; color: var(--text);">
          Frontier cost: <strong>$${costs.frontier}</strong> vs Fast/Small: <strong>$${costs.fast}</strong> vs Jev Decision: <strong>$${costs.jev}</strong>
        </div>
      </div>

      <table style="font-size: 0.85rem; margin-bottom: 14px;">
        <thead>
          <tr>
            <th>Execution Tier</th>
            <th>Est. Call Cost</th>
            <th>Per 1,000 Calls</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Frontier Heavy</strong> (Opus / O1)</td>
            <td style="color: var(--accent-red);">$${costs.frontier}</td>
            <td>$${(costs.frontier * 1000).toFixed(2)}</td>
          </tr>
          <tr>
            <td><strong>Standard</strong> (Sonnet / GPT-4o)</td>
            <td>$${costs.standard}</td>
            <td>$${(costs.standard * 1000).toFixed(2)}</td>
          </tr>
          <tr>
            <td><strong>Fast / Small</strong> (Flash / Haiku)</td>
            <td style="color: var(--success); font-weight: 700;">$${costs.fast}</td>
            <td>$${(costs.fast * 1000).toFixed(2)}</td>
          </tr>
          <tr>
            <td><strong>Jev System-One</strong> (Decision Gate)</td>
            <td style="color: var(--primary); font-weight: 700;">$${costs.jev}</td>
            <td>$${(costs.jev * 1000).toFixed(2)}</td>
          </tr>
        </tbody>
      </table>

      <h4 style="font-size: 0.85rem; font-weight: 700; margin-bottom: 8px;">Spend Discipline Recommendations</h4>
      <ul style="font-size: 0.8rem; color: var(--text-muted); padding-left: 18px; margin: 0;">
        ${recs.map(r => `<li style="margin-bottom: 4px;">${escapeHtml(r)}</li>`).join('')}
      </ul>
    `;
  }

  // Token Samples
  if (btnSamplePromptSmall) {
    btnSamplePromptSmall.addEventListener('click', () => {
      if (tokenPromptInput) tokenPromptInput.value = "Fix the typo in the header badge text in public/index.html from 'Beta' to 'Universal Engine'.";
    });
  }
  if (btnSamplePromptLarge) {
    btnSamplePromptLarge.addEventListener('click', () => {
      if (tokenPromptInput) tokenPromptInput.value = `You are a staff engineer. Review the following comprehensive architecture specification and verify all API security boundaries:
1. All database queries must run through parameterized statements in node:sqlite.
2. Webhooks must verify signature headers before execution.
3. Every external carrier forwarding event must be audited in the events table.
4. Output must cite specific file and line numbers. Do not include extraneous fluff or boilerplate. Keep code snippets minimal.`;
    });
  }
  if (btnSamplePromptDecision) {
    btnSamplePromptDecision.addEventListener('click', () => {
      if (tokenPromptInput) tokenPromptInput.value = "Decide whether to approve this PR merge: 15 passing tests, zero breaking changes, DNC compliance verified, no schema deletions.";
    });
  }

  // --- AI Dispatch & Jev Gate ---
  if (btnSampleDuty) {
    btnSampleDuty.addEventListener('click', () => {
      const sampleDuties = [
        "Audit the entire repository for security flaws and produce a report",
        "Design and implement a multi-tenant billing engine with Stripe webhooks",
        "Refactor the authentication endpoint to support OAuth tokens and add unit tests",
        "Classify incoming prospect call and route to recovery SMS",
        "Write unit tests for SQLite database schema"
      ];
      if (dutyInput) dutyInput.value = sampleDuties[Math.floor(Math.random() * sampleDuties.length)];
    });
  }

  if (dispatchForm) {
    dispatchForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const duty = dutyInput?.value.trim();
      const with_jev = dispatchWithJev ? dispatchWithJev.checked : true;
      if (!duty) {
        showToast('Please enter a task or duty prompt', 'warning');
        return;
      }

      if (dispatchResult) {
        dispatchResult.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-muted);">Routing task through Continuity OS agent layers...</div>';
      }

      try {
        const start = performance.now();
        const res = await fetchJson('/api/dispatch', {
          method: 'POST',
          body: JSON.stringify({ duty, with_jev }),
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
                <tr><td style="color: var(--text-muted); width: 120px;">Strategy</td><td><strong>${escapeHtml(plan.strategy || plan.why || '-')}</strong></td></tr>
                <tr><td style="color: var(--text-muted);">Assigned Model</td><td><code>${escapeHtml(plan.model || plan.model_tier || 'auto')}</code></td></tr>
                <tr><td style="color: var(--text-muted);">Persona Hint</td><td>${escapeHtml(plan.persona || '-')}</td></tr>
                <tr><td style="color: var(--text-muted);">Est. Tokens</td><td>${escapeHtml(String(plan.duty_tokens || '~500'))}</td></tr>
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
      }
    });
  }

  // Standalone Jev Gate Form
  if (jevForm) {
    jevForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const task = jevStateInput?.value.trim();
      const bank = jevBankSelect?.value || 'act-gate';
      if (!task) {
        showToast('Please enter an action or state to evaluate', 'warning');
        return;
      }

      if (dispatchResult) {
        dispatchResult.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-muted);">Evaluating action against Jev decision bank...</div>';
      }

      try {
        const start = performance.now();
        const res = await fetchJson('/api/jev', {
          method: 'POST',
          body: JSON.stringify({ task, bank }),
        });
        const elapsed = Math.round(performance.now() - start);
        const result = res.result || {};
        const policy = result.policy || {};
        const policyBadge = policy.action === 'act' ? 'badge-success' : (policy.action === 'ask_human' ? 'badge-primary' : 'badge-danger');

        if (dispatchResult) {
          dispatchResult.innerHTML = `
            <div style="display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap;">
              <span class="badge ${policyBadge}">Policy: ${escapeHtml(policy.action || 'unknown')}</span>
              <span class="badge badge-secondary">Bank: ${escapeHtml(bank)}</span>
              <span class="badge badge-secondary">${elapsed}ms</span>
            </div>
            <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 10px 14px; margin-bottom: 12px;">
              <div style="font-weight: 700; font-size: 0.95rem; margin-bottom: 4px;">Verdict Reason:</div>
              <div style="font-size: 0.85rem; color: var(--text-muted);">${escapeHtml(policy.reason || 'None provided')}</div>
            </div>
            <div class="card-header" style="margin-top: 10px; margin-bottom: 6px;">
              <span style="font-size: 0.8rem; font-weight: 600; color: var(--text-muted);">FULL JEV ANSWERS JSON</span>
            </div>
            <pre class="code-box">${escapeHtml(JSON.stringify(result, null, 2))}</pre>
          `;
        }
        showToast(`Jev verdict: ${policy.action}`, 'info');
        loadDashboard();
      } catch (err) {
        if (dispatchResult) {
          dispatchResult.innerHTML = `<div style="color: var(--accent-red); padding: 12px;">Jev error: ${escapeHtml(err.message)}</div>`;
        }
      }
    });
  }

  // --- Skills Catalog ---
  async function loadSkills() {
    if (!skillsGrid) return;
    try {
      const data = await fetchJson('/api/skills');
      allSkills = data.skills || [];
      if (statSkills) statSkills.textContent = allSkills.length;
      renderSkills();
    } catch (err) {
      skillsGrid.innerHTML = `<div style="color: var(--accent-red);">Failed to load skills catalog: ${escapeHtml(err.message)}</div>`;
    }
  }

  function renderSkills() {
    if (!skillsGrid) return;
    const search = (skillSearchInput?.value || '').trim().toLowerCase();
    const filtered = allSkills.filter(s => {
      const matchCat = currentSkillCategory === 'all' || s.category === currentSkillCategory;
      const matchSearch = !search || s.name.toLowerCase().includes(search) || s.description.toLowerCase().includes(search);
      return matchCat && matchSearch;
    });

    if (filtered.length === 0) {
      skillsGrid.innerHTML = '<div style="color: var(--text-muted); grid-column: 1/-1;">No skills found matching filter.</div>';
      return;
    }

    skillsGrid.innerHTML = filtered.map(s => `
      <div class="card" style="padding: 12px; cursor: pointer; transition: transform 0.1s ease, border-color 0.1s ease;" onclick="window.viewSkillDetail('${escapeHtml(s.name)}')">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
          <span style="font-weight: 700; font-size: 0.85rem; color: var(--primary);"><code>${escapeHtml(s.name)}</code></span>
          <span class="badge badge-secondary" style="font-size: 0.65rem;">${escapeHtml(s.category)}</span>
        </div>
        <p style="font-size: 0.78rem; color: var(--text-muted); line-height: 1.4; margin: 0; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;">
          ${escapeHtml(s.description || 'No description.')}
        </p>
      </div>
    `).join('');
  }

  window.viewSkillDetail = async function (name) {
    try {
      const data = await fetchJson(`/api/skills/${encodeURIComponent(name)}`);
      if (skillModalTitle) skillModalTitle.textContent = `Skill: ${name}`;
      if (skillModalContent) skillModalContent.textContent = data.content || '';
      if (skillModal) skillModal.style.display = 'flex';
    } catch (err) {
      showToast(`Failed to open skill: ${err.message}`, 'error');
    }
  };

  if (btnCloseSkillModal) btnCloseSkillModal.addEventListener('click', () => { if (skillModal) skillModal.style.display = 'none'; });
  if (btnDismissSkillModal) btnDismissSkillModal.addEventListener('click', () => { if (skillModal) skillModal.style.display = 'none'; });
  if (btnCopySkillContent) {
    btnCopySkillContent.addEventListener('click', () => {
      if (!skillModalContent) return;
      navigator.clipboard.writeText(skillModalContent.textContent);
      showToast('Skill markdown copied', 'success');
    });
  }

  if (skillSearchInput) skillSearchInput.addEventListener('input', renderSkills);

  if (skillCategoryFilters) {
    skillCategoryFilters.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      skillCategoryFilters.querySelectorAll('button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentSkillCategory = btn.getAttribute('data-cat') || 'all';
      renderSkills();
    });
  }

  // --- Records / CRM ---
  async function loadRecords() {
    try {
      const data = await fetchJson('/api/records?limit=100');
      allRecords = data.records || [];
      renderRecords(allRecords);
    } catch (err) {
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
      const statusBadge = r.status === 'qualified' ? 'badge-primary' : (r.status === 'contacted' ? 'badge-success' : 'badge-secondary');
      const name = r.data?.name || r.id;
      const phone = r.data?.phone ? ` · ${r.data.phone}` : '';
      return `
        <tr>
          <td>
            <strong><code>${escapeHtml(r.id)}</code></strong>
            <div style="font-size: 0.8rem; color: var(--text-muted);">${escapeHtml(name)}${escapeHtml(phone)}</div>
          </td>
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

  // Modal Handlers
  function openRecordModal() { if (newRecordModal) newRecordModal.style.display = 'flex'; }
  function closeRecordModal() {
    if (newRecordModal) newRecordModal.style.display = 'none';
    if (newRecordForm) newRecordForm.reset();
  }

  if (btnOpenNewRecordModal) btnOpenNewRecordModal.addEventListener('click', openRecordModal);
  if (btnCloseRecordModal) btnCloseRecordModal.addEventListener('click', closeRecordModal);
  if (btnCancelRecordModal) btnCancelRecordModal.addEventListener('click', closeRecordModal);

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
          showToast('Invalid JSON in payload: ' + err.message, 'error');
          return;
        }
      }

      try {
        await fetchJson('/api/records', {
          method: 'POST',
          body: JSON.stringify({ type, status, data }),
        });
        showToast('Record created successfully', 'success');
        closeRecordModal();
        loadRecords();
        loadDashboard();
      } catch (err) {
        showToast(`Creation failed: ${err.message}`, 'error');
      }
    });
  }

  if (btnQuickRecord) {
    btnQuickRecord.addEventListener('click', async () => {
      const sampleTypes = ['prospect', 'task', 'call_log', 'lead'];
      const randomType = sampleTypes[Math.floor(Math.random() * sampleTypes.length)];
      const sampleData = {
        name: `Sample ${randomType.toUpperCase()} #${Math.floor(Math.random() * 1000)}`,
        createdVia: 'Quick Button',
        metric: Math.round(Math.random() * 100),
      };

      try {
        await fetchJson('/api/records', {
          method: 'POST',
          body: JSON.stringify({ type: randomType, status: 'active', data: sampleData }),
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
      showToast('Telemetry refreshed', 'info');
    });
  }

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

  // --- Settings ---
  async function loadSettings() {
    try {
      const data = await fetchJson('/api/settings');
      const s = data.settings || {};
      if (settingAppName && s['app.name']) settingAppName.value = s['app.name'];
      if (settingAppVersion && s['app.version']) settingAppVersion.value = s['app.version'];
      if (settingOpenRouterKey && s['openrouter.api_key']) settingOpenRouterKey.value = s['openrouter.api_key'];
      if (settingAutonomyLevel && s['dark_factory.autonomy_level']) settingAutonomyLevel.value = s['dark_factory.autonomy_level'];
      if (settingWorkerConcurrency && s['agent.worker_concurrency']) settingWorkerConcurrency.value = s['agent.worker_concurrency'];
    } catch (err) {}
  }

  const settingsForm = document.getElementById('settingsForm');
  if (settingsForm) {
    settingsForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await fetchJson('/api/settings', {
          method: 'POST',
          body: JSON.stringify({
            'app.name': settingAppName?.value.trim() || 'Continuity OS · Universal Agentic Engine',
            'app.version': settingAppVersion?.value.trim() || '1.0.0',
            'openrouter.api_key': settingOpenRouterKey?.value.trim() || '',
            'dark_factory.autonomy_level': settingAutonomyLevel?.value.trim() || '4',
            'agent.worker_concurrency': settingWorkerConcurrency?.value.trim() || '4',
          }),
        });
        showToast('Settings saved successfully', 'success');
      } catch (err) {
        showToast(`Failed to save settings: ${err.message}`, 'error');
      }
    });
  }

  // --- Archon 2 Event Listeners ---
  if (btnArchonPlan) {
    btnArchonPlan.addEventListener('click', async () => {
      const goal = archonGoalInput?.value.trim();
      if (!goal) return showToast('Please enter a goal', 'error');
      archonOutput.innerHTML = '<pre class="code-box">Planning Archon 2 DAG...</pre>';
      try {
        const res = await fetchJson('/api/archon/plan', {
          method: 'POST',
          body: JSON.stringify({ goal }),
        });
        archonOutput.innerHTML = `<pre class="code-box">${escapeHtml(JSON.stringify(res, null, 2))}</pre>`;
        showToast(`Synthesized ${res.tasks.length} DAG tasks`, 'success');
      } catch (err) {
        archonOutput.innerHTML = `<pre class="code-box" style="color:var(--accent-red);">${escapeHtml(err.message)}</pre>`;
      }
    });
  }

  if (btnArchonExec) {
    btnArchonExec.addEventListener('click', async () => {
      const goal = archonGoalInput?.value.trim();
      if (!goal) return showToast('Please enter a goal', 'error');
      archonOutput.innerHTML = '<pre class="code-box">Executing Archon 2 multi-agent loop (Architect -> Builder -> Critic -> Verifier)...</pre>';
      try {
        const res = await fetchJson('/api/archon/execute', {
          method: 'POST',
          body: JSON.stringify({ goal }),
        });
        archonOutput.innerHTML = `<pre class="code-box">${escapeHtml(JSON.stringify(res, null, 2))}</pre>`;
        showToast(`Execution ${res.status}: ${res.steps_count} steps completed`, 'success');
      } catch (err) {
        archonOutput.innerHTML = `<pre class="code-box" style="color:var(--accent-red);">${escapeHtml(err.message)}</pre>`;
      }
    });
  }

  // --- RAG Docling Chunking & Search ---
  if (btnRagIngest) {
    btnRagIngest.addEventListener('click', async () => {
      const text = ragDocInput?.value.trim();
      if (!text) return showToast('Enter document text', 'error');
      ragOutput.innerHTML = '<pre class="code-box">Ingesting document with Docling parser...</pre>';
      try {
        const res = await fetchJson('/api/rag/ingest', {
          method: 'POST',
          body: JSON.stringify({ text, docId: 'doc_user_' + Date.now(), strategy: 'semantic' }),
        });
        ragOutput.innerHTML = `<pre class="code-box">${escapeHtml(JSON.stringify(res, null, 2))}</pre>`;
        showToast(`Indexed ${res.chunks_count} semantic chunks`, 'success');
      } catch (err) {
        ragOutput.innerHTML = `<pre class="code-box" style="color:var(--accent-red);">${escapeHtml(err.message)}</pre>`;
      }
    });
  }

  if (btnRagSearch) {
    btnRagSearch.addEventListener('click', async () => {
      const query = ragQueryInput?.value.trim();
      if (!query) return showToast('Enter search query', 'error');
      ragOutput.innerHTML = '<pre class="code-box">Searching vector store...</pre>';
      try {
        const res = await fetchJson('/api/rag/search', {
          method: 'POST',
          body: JSON.stringify({ query, limit: 3 }),
        });
        ragOutput.innerHTML = `<pre class="code-box">${escapeHtml(JSON.stringify(res, null, 2))}</pre>`;
        showToast(`Found ${res.hits.length} matches`, 'info');
      } catch (err) {
        ragOutput.innerHTML = `<pre class="code-box" style="color:var(--accent-red);">${escapeHtml(err.message)}</pre>`;
      }
    });
  }

  // --- Guardrails Screening ---
  if (btnRunGuardrail) {
    btnRunGuardrail.addEventListener('click', async () => {
      const text = guardrailTextInput?.value.trim();
      if (!text) return showToast('Enter text to screen', 'error');
      guardrailOutput.innerHTML = '<pre class="code-box">Evaluating guardrail rules...</pre>';
      try {
        const res = await fetchJson('/api/guardrails/check', {
          method: 'POST',
          body: JSON.stringify({ text }),
        });
        guardrailOutput.innerHTML = `<pre class="code-box">${escapeHtml(JSON.stringify(res, null, 2))}</pre>`;
        showToast(res.passed ? 'Guardrails passed' : 'Guardrail violations flagged', res.passed ? 'success' : 'error');
      } catch (err) {
        guardrailOutput.innerHTML = `<pre class="code-box" style="color:var(--accent-red);">${escapeHtml(err.message)}</pre>`;
      }
    });
  }

  // --- Second Brain & Dark Factory Operations ---
  if (btnAuditBrain) {
    btnAuditBrain.addEventListener('click', async () => {
      brainFactoryOutput.innerHTML = '<pre class="code-box">Auditing Second Brain memory...</pre>';
      try {
        const res = await fetchJson('/api/brain/audit');
        brainFactoryOutput.innerHTML = `<pre class="code-box">${escapeHtml(JSON.stringify(res, null, 2))}</pre>`;
        showToast(`Memory Health: ${res.health_score}% (${res.status})`, 'success');
      } catch (err) {
        brainFactoryOutput.innerHTML = `<pre class="code-box" style="color:var(--accent-red);">${escapeHtml(err.message)}</pre>`;
      }
    });
  }

  if (btnFactoryTriage) {
    btnFactoryTriage.addEventListener('click', async () => {
      brainFactoryOutput.innerHTML = '<pre class="code-box">Running Dark Factory issue triage...</pre>';
      try {
        const res = await fetchJson('/api/factory/triage', {
          method: 'POST',
          body: JSON.stringify({ issueId: '#105', title: 'Fix zero norm division in cosine search', body: 'Handle zero vector safely' }),
        });
        brainFactoryOutput.innerHTML = `<pre class="code-box">${escapeHtml(JSON.stringify(res, null, 2))}</pre>`;
        showToast(`Triage action: ${res.action}`, 'info');
      } catch (err) {
        brainFactoryOutput.innerHTML = `<pre class="code-box" style="color:var(--accent-red);">${escapeHtml(err.message)}</pre>`;
      }
    });
  }

  if (btnExportCrew) {
    btnExportCrew.addEventListener('click', async () => {
      brainFactoryOutput.innerHTML = '<pre class="code-box">Exporting CrewAI configuration...</pre>';
      try {
        const res = await fetchJson('/api/integrations/crewai');
        brainFactoryOutput.innerHTML = `<pre class="code-box">${escapeHtml(JSON.stringify(res, null, 2))}</pre>`;
        showToast('Exported CrewAI configuration', 'success');
      } catch (err) {
        brainFactoryOutput.innerHTML = `<pre class="code-box" style="color:var(--accent-red);">${escapeHtml(err.message)}</pre>`;
      }
    });
  }

  if (btnExportLangGraph) {
    btnExportLangGraph.addEventListener('click', async () => {
      brainFactoryOutput.innerHTML = '<pre class="code-box">Exporting LangGraph configuration...</pre>';
      try {
        const res = await fetchJson('/api/integrations/langgraph');
        brainFactoryOutput.innerHTML = `<pre class="code-box">${escapeHtml(JSON.stringify(res, null, 2))}</pre>`;
        showToast('Exported LangGraph configuration', 'success');
      } catch (err) {
        brainFactoryOutput.innerHTML = `<pre class="code-box" style="color:var(--accent-red);">${escapeHtml(err.message)}</pre>`;
      }
    });
  }

  if (btnExportLangChain) {
    btnExportLangChain.addEventListener('click', async () => {
      brainFactoryOutput.innerHTML = '<pre class="code-box">Exporting LangChain LCEL & Tools configuration...</pre>';
      try {
        const res = await fetchJson('/api/integrations/langchain');
        brainFactoryOutput.innerHTML = `<pre class="code-box">${escapeHtml(JSON.stringify(res, null, 2))}</pre>`;
        showToast('Exported LangChain configuration', 'success');
      } catch (err) {
        brainFactoryOutput.innerHTML = `<pre class="code-box" style="color:var(--accent-red);">${escapeHtml(err.message)}</pre>`;
      }
    });
  }

  if (btnExportLlamaIndex) {
    btnExportLlamaIndex.addEventListener('click', async () => {
      brainFactoryOutput.innerHTML = '<pre class="code-box">Exporting LlamaIndex query engine specification...</pre>';
      try {
        const res = await fetchJson('/api/integrations/llamaindex');
        brainFactoryOutput.innerHTML = `<pre class="code-box">${escapeHtml(JSON.stringify(res, null, 2))}</pre>`;
        showToast('Exported LlamaIndex configuration', 'success');
      } catch (err) {
        brainFactoryOutput.innerHTML = `<pre class="code-box" style="color:var(--accent-red);">${escapeHtml(err.message)}</pre>`;
      }
    });
  }

  // --- Autonomous Task Factory & Worktrees Event Listeners ---
  if (btnRefreshWorktrees) {
    btnRefreshWorktrees.addEventListener('click', async () => {
      factoryOutput.innerHTML = '<pre class="code-box">Listing active git worktrees...</pre>';
      try {
        const res = await fetchJson('/api/factory/worktrees');
        factoryOutput.innerHTML = `<pre class="code-box">${escapeHtml(JSON.stringify(res, null, 2))}</pre>`;
        showToast(`Active worktrees: ${res.worktrees?.length || 0}`, 'info');
      } catch (err) {
        factoryOutput.innerHTML = `<pre class="code-box" style="color:var(--accent-red);">${escapeHtml(err.message)}</pre>`;
      }
    });
  }

  if (btnEnqueueFactoryTask) {
    btnEnqueueFactoryTask.addEventListener('click', async () => {
      const issueId = factoryIssueId?.value.trim() || '#feat-101';
      const title = factoryTitle?.value.trim() || 'New Factory Task';
      const body = factoryBody?.value.trim() || '';

      factoryOutput.innerHTML = `<pre class="code-box">Enqueuing task ${escapeHtml(issueId)} into factory...</pre>`;
      try {
        const res = await fetchJson('/api/factory/tasks', {
          method: 'POST',
          body: JSON.stringify({ issueId, title, body }),
        });
        factoryOutput.innerHTML = `<pre class="code-box">${escapeHtml(JSON.stringify(res, null, 2))}</pre>`;
        showToast(`Task ${issueId} enqueued: ${res.job_id}`, 'success');
      } catch (err) {
        factoryOutput.innerHTML = `<pre class="code-box" style="color:var(--accent-red);">${escapeHtml(err.message)}</pre>`;
      }
    });
  }

  if (btnWorkerTick) {
    btnWorkerTick.addEventListener('click', async () => {
      factoryOutput.innerHTML = '<pre class="code-box">Worker tick initiated: claiming job, executing Archon 2 DAG in isolated worktree, running holdout tests, and generating PR...</pre>';
      try {
        const res = await fetchJson('/api/factory/worker/tick', { method: 'POST' });
        factoryOutput.innerHTML = `<pre class="code-box">${escapeHtml(JSON.stringify(res, null, 2))}</pre>`;
        if (res.pr_url) {
          showToast(`PR Created: ${res.pr_url}`, 'success');
        } else if (res.processed === false) {
          showToast('No pending factory jobs in queue', 'info');
        } else {
          showToast(`Job ${res.job_id || ''} finished: ${res.status}`, 'info');
        }
      } catch (err) {
        factoryOutput.innerHTML = `<pre class="code-box" style="color:var(--accent-red);">${escapeHtml(err.message)}</pre>`;
      }
    });
  }

  if (btnValidateHoldouts) {
    btnValidateHoldouts.addEventListener('click', async () => {
      factoryOutput.innerHTML = '<pre class="code-box">Running Phase A & B holdout validation gate...</pre>';
      try {
        const res = await fetchJson('/api/factory/validate', {
          method: 'POST',
          body: JSON.stringify({ baseRef: 'main', allowTestModification: true }),
        });
        factoryOutput.innerHTML = `<pre class="code-box">${escapeHtml(JSON.stringify(res, null, 2))}</pre>`;
        showToast(`Holdout Validation: ${res.passed ? 'PASSED' : 'FAILED'}`, res.passed ? 'success' : 'warning');
      } catch (err) {
        factoryOutput.innerHTML = `<pre class="code-box" style="color:var(--accent-red);">${escapeHtml(err.message)}</pre>`;
      }
    });
  }

  // --- Realtime SSE Stream ---
  let eventSource = null;
  function initEventStream() {
    if (!window.EventSource) return;
    try {
      eventSource = new EventSource('/api/stream');
      eventSource.onopen = () => {
        if (systemStatusDot) systemStatusDot.style.backgroundColor = 'var(--accent-green)';
        if (systemStatusText) systemStatusText.textContent = 'Live SSE';
      };
      eventSource.onmessage = (e) => {
        if (!e.data || e.data.startsWith(':')) return;
        try {
          const ev = JSON.parse(e.data);
          prependLiveEvent(ev);
        } catch {}
      };
      eventSource.onerror = () => {
        if (systemStatusDot) systemStatusDot.style.backgroundColor = 'var(--accent-orange)';
        if (systemStatusText) systemStatusText.textContent = 'Reconnecting';
      };
    } catch {}
  }

  function prependLiveEvent(ev) {
    if (!eventsTableBody) return;
    const row = document.createElement('tr');
    const payloadStr = JSON.stringify(ev.payload || {});
    const preview = payloadStr.length > 55 ? payloadStr.slice(0, 52) + '...' : payloadStr;
    row.innerHTML = `
      <td><code>${ev.id}</code></td>
      <td><span class="badge badge-success">${escapeHtml(ev.type)}</span></td>
      <td><small>${formatDate(ev.createdAt || new Date().toISOString())}</small></td>
      <td><code title="${escapeHtml(payloadStr)}">${escapeHtml(preview)}</code></td>
    `;
    eventsTableBody.insertBefore(row, eventsTableBody.firstChild);

    if (statEvents) {
      const current = parseInt(statEvents.textContent || '0', 10);
      statEvents.textContent = current + 1;
    }
  }

  // --- App Transformer Modal ---
  const transformModal = document.getElementById('transformModal');
  const btnOpenTransformModal = document.getElementById('btnOpenTransformModal');
  const btnCloseTransformModal = document.getElementById('btnCloseTransformModal');
  const btnCancelTransformModal = document.getElementById('btnCancelTransformModal');
  const btnExecuteTransform = document.getElementById('btnExecuteTransform');
  const transformAppNameInput = document.getElementById('transformAppNameInput');

  function openTransformModal() { if (transformModal) transformModal.style.display = 'flex'; }
  function closeTransformModal() { if (transformModal) transformModal.style.display = 'none'; }

  if (btnOpenTransformModal) btnOpenTransformModal.addEventListener('click', openTransformModal);
  if (btnCloseTransformModal) btnCloseTransformModal.addEventListener('click', closeTransformModal);
  if (btnCancelTransformModal) btnCancelTransformModal.addEventListener('click', closeTransformModal);

  if (btnExecuteTransform) {
    btnExecuteTransform.addEventListener('click', async () => {
      const selected = document.querySelector('input[name="transformPreset"]:checked');
      const preset = selected ? selected.value : 'crm';
      const appName = transformAppNameInput?.value.trim() || undefined;

      try {
        const res = await fetchJson('/api/app/transform', {
          method: 'POST',
          body: JSON.stringify({ preset, appName }),
        });
        showToast(`Transformed to [${preset.toUpperCase()}]: ${res.appName}`, 'success');
        closeTransformModal();
        loadDashboard();
        loadRecords();
        loadSettings();
      } catch (err) {
        showToast(`Transform failed: ${err.message}`, 'error');
      }
    });
  }

  // --- Init ---
  initTheme();
  initTabs();
  registerServiceWorker();
  loadDashboard();
  initEventStream();

  uptimeInterval = setInterval(() => {
    uptimeSeconds++;
    if (statUptime) statUptime.textContent = formatUptime(uptimeSeconds);
  }, 1000);

})();
