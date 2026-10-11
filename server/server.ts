import { createServer, IncomingMessage, ServerResponse, Server } from 'node:http';
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { join, extname, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { AppDatabase } from './db.ts';

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(__dirname, '..');
const PUBLIC_DIR = join(ROOT_DIR, 'public');
const DB_PATH = process.env.DATABASE_PATH || join(ROOT_DIR, 'data', 'app.db');
const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

export function createAppServer(database?: AppDatabase): { server: Server; db: AppDatabase } {
  const db = database || new AppDatabase(DB_PATH);

  // Seed default settings if missing
  if (!db.getSetting('app.name')) {
    db.setSetting('app.name', 'Continuity OS Universal App');
    db.setSetting('app.version', '1.0.0');
    db.setSetting('app.theme', 'system');
  }

  async function parseBody(req: IncomingMessage): Promise<any> {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', chunk => {
        body += chunk;
        if (body.length > 10 * 1024 * 1024) {
          reject(new Error('Payload too large (max 10MB)'));
        }
      });
      req.on('end', () => {
        if (!body) return resolve({});
        try {
          resolve(JSON.parse(body));
        } catch {
          resolve({ raw: body });
        }
      });
      req.on('error', reject);
    });
  }

  function sendJson(res: ServerResponse, status: number, data: any): void {
    res.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'SAMEORIGIN',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    });
    res.end(JSON.stringify(data, null, 2));
  }

  function serveStatic(res: ServerResponse, pathname: string): boolean {
    let filePath = join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);

    // Prevent directory traversal
    if (!filePath.startsWith(PUBLIC_DIR)) {
      return false;
    }

    if (existsSync(filePath) && statSync(filePath).isFile()) {
      const ext = extname(filePath).toLowerCase();
      const mime = MIME_TYPES[ext] || 'application/octet-stream';
      const content = readFileSync(filePath);

      res.writeHead(200, {
        'Content-Type': mime,
        'Content-Length': content.length,
        'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600',
        'X-Content-Type-Options': 'nosniff',
      });
      res.end(content);
      return true;
    }

    // SPA fallback to index.html if no extension
    if (!extname(pathname)) {
      const indexPath = join(PUBLIC_DIR, 'index.html');
      if (existsSync(indexPath)) {
        const content = readFileSync(indexPath);
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Length': content.length,
          'Cache-Control': 'no-cache',
          'X-Content-Type-Options': 'nosniff',
        });
        res.end(content);
        return true;
      }
    }

    return false;
  }

  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
      const method = req.method?.toUpperCase() || 'GET';
      const pathname = url.pathname;

      if (method === 'OPTIONS') {
        res.writeHead(204, {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        });
        return res.end();
      }

      // --- API Routes ---
      if (pathname.startsWith('/api/')) {
        // GET /api/health
        if (pathname === '/api/health' && method === 'GET') {
          return sendJson(res, 200, {
            status: 'ok',
            uptime: process.uptime(),
            timestamp: new Date().toISOString(),
            nodeVersion: process.version,
            memory: process.memoryUsage(),
            stats: db.getStats(),
          });
        }

        // GET /api/stats
        if (pathname === '/api/stats' && method === 'GET') {
          return sendJson(res, 200, db.getStats());
        }

        // --- Records CRUD ---
        if (pathname === '/api/records' && method === 'GET') {
          const type = url.searchParams.get('type') || undefined;
          const limit = parseInt(url.searchParams.get('limit') || '50', 10);
          return sendJson(res, 200, { records: db.listRecords(type, limit) });
        }

        if (pathname === '/api/records' && method === 'POST') {
          const body = await parseBody(req);
          const id = body.id || 'rec_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
          const type = body.type || 'generic';
          const data = body.data || body;
          const status = body.status || 'active';

          const record = db.saveRecord(id, type, data, status);
          return sendJson(res, 201, { record });
        }

        const recordMatch = pathname.match(/^\/api\/records\/([a-zA-Z0-9_\-]+)$/);
        if (recordMatch) {
          const id = recordMatch[1];
          if (method === 'GET') {
            const record = db.getRecord(id);
            if (!record) return sendJson(res, 404, { error: 'Record not found' });
            return sendJson(res, 200, { record });
          }

          if (method === 'DELETE') {
            const deleted = db.deleteRecord(id);
            if (!deleted) return sendJson(res, 404, { error: 'Record not found' });
            return sendJson(res, 200, { deleted: true, id });
          }
        }

        // --- Events ---
        if (pathname === '/api/events' && method === 'GET') {
          const limit = parseInt(url.searchParams.get('limit') || '25', 10);
          return sendJson(res, 200, { events: db.listEvents(limit) });
        }

        if (pathname === '/api/events' && method === 'POST') {
          const body = await parseBody(req);
          const type = body.type || 'custom.event';
          const payload = body.payload || body;
          const eventId = db.logEvent(type, payload);
          return sendJson(res, 201, { eventId, type });
        }

        // --- Settings ---
        if (pathname === '/api/settings' && method === 'GET') {
          return sendJson(res, 200, { settings: db.listSettings() });
        }

        if (pathname === '/api/settings' && method === 'POST') {
          const body = await parseBody(req);
          for (const [k, v] of Object.entries(body)) {
            db.setSetting(k, String(v));
          }
          return sendJson(res, 200, { settings: db.listSettings() });
        }

        // --- AI Dispatch Bridge ---
        if (pathname === '/api/dispatch' && method === 'POST') {
          const body = await parseBody(req);
          const duty = (body.duty || body.task || '').trim();
          const withJev = !!body.with_jev;
          if (!duty) {
            return sendJson(res, 400, { error: 'Missing duty parameter' });
          }

          const dispatchScript = join(ROOT_DIR, 'orchestration', 'dispatch.py');
          if (existsSync(dispatchScript)) {
            try {
              const args = [dispatchScript, '--duty', duty];
              if (withJev) args.push('--with-jev');
              const { stdout } = await execFileAsync('python3', args);
              const plan = JSON.parse(stdout.trim());
              db.logEvent('ai.dispatch', { duty, tier: plan.tier, route: plan.route, withJev });
              return sendJson(res, 200, { plan });
            } catch (err: any) {
              return sendJson(res, 500, { error: 'Dispatch script execution failed', details: err.message });
            }
          } else {
            return sendJson(res, 501, { error: 'orchestration/dispatch.py not found on host' });
          }
        }

        // --- PRDs & Planning Engine ---
        if (pathname === '/api/prds' && method === 'GET') {
          const prdDir = join(ROOT_DIR, 'factory', 'prd');
          const prds: any[] = [];
          if (existsSync(prdDir)) {
            const files = readdirSync(prdDir).filter(f => f.endsWith('.md'));
            for (const file of files) {
              const fullPath = join(prdDir, file);
              const content = readFileSync(fullPath, 'utf-8');
              const titleM = content.match(/^#\s+(.+)$/m);
              const title = titleM ? titleM[1].trim() : file;
              prds.push({
                id: file,
                title,
                filename: file,
                size: content.length,
                updatedAt: statSync(fullPath).mtime.toISOString(),
              });
            }
          }
          return sendJson(res, 200, { prds });
        }

        const prdMatch = pathname.match(/^\/api\/prds\/([a-zA-Z0-9_\-\.]+)$/);
        if (prdMatch && method === 'GET') {
          const prdFile = prdMatch[1];
          const fullPath = join(ROOT_DIR, 'factory', 'prd', prdFile);
          if (existsSync(fullPath)) {
            return sendJson(res, 200, {
              id: prdFile,
              content: readFileSync(fullPath, 'utf-8')
            });
          }
          return sendJson(res, 404, { error: 'PRD not found' });
        }

        if (pathname === '/api/prds' && method === 'POST') {
          const body = await parseBody(req);
          const title = (body.title || 'Untitled PRD').trim();
          const filename = (body.filename || `PRD-${Date.now().toString(36).toUpperCase()}.md`).replace(/[^a-zA-Z0-9_\-\.]/g, '_');
          const content = body.content || `# ${title}\n\n`;
          const prdDir = join(ROOT_DIR, 'factory', 'prd');
          mkdirSync(prdDir, { recursive: true });
          const fullPath = join(prdDir, filename);
          writeFileSync(fullPath, content, 'utf-8');
          db.saveRecord('prd_' + filename.replace(/\.md$/, ''), 'prd', { title, filename }, 'active');
          db.logEvent('prd.created', { filename, title });
          return sendJson(res, 201, { success: true, filename, title });
        }

        if (pathname === '/api/prds/generate' && method === 'POST') {
          const body = await parseBody(req);
          const problem = (body.problem || '').trim();
          const product = (body.product || 'New Universal Application').trim();
          const hypothesis = (body.hypothesis || '').trim();
          const audience = (body.audience || 'Target Users').trim();
          const mvp = (body.mvp || '').trim();
          const nonGoals = (body.nonGoals || '').trim();

          const generatedMd = `# PRD: ${product}

**Status:** Draft / Ready for Architecture Spec  
**Author:** Continuity OS Planning Studio  
**Target Audience:** ${audience}  

---

## 1. Problem Statement
${problem || 'State the core problem and why status quo solutions fail.'}

---

## 2. Evidence & Grounding
- Grounded in operational user friction and workflow observations.
- Conservative quantified impact.

---

## 3. Falsifiable Hypothesis
> **If** ${hypothesis || 'we deliver the automated core...'},  
> **Then** target users achieve measurable operational lift,  
> **Because** friction in the current manual workflow is removed.

---

## 4. User Personas
- **Primary Persona:** ${audience}
- **Secondary Persona:** System Operator / Administrator

---

## 5. MVP Scope & Boundaries
### In Scope:
${mvp || '- Core minimal viable functionality'}

### Non-Goals (Explicitly Out of Scope for MVP):
${nonGoals || '- Complex third-party integrations\n- Multi-region compliance certification'}

---

## 6. Success Metrics
- Specific, measurable adoption and reliability targets.
- Zero regression in core performance.
`;
          return sendJson(res, 200, { markdown: generatedMd, product });
        }

        // --- Token Spend Optimizer ---
        if (pathname === '/api/tokens/analyze' && method === 'POST') {
          const body = await parseBody(req);
          const promptText = (body.text || body.prompt || '').trim();
          const expectedOutput = parseInt(body.outputTokens || '500', 10);
          if (!promptText) {
            return sendJson(res, 400, { error: 'Missing text or prompt' });
          }

          const optScript = join(ROOT_DIR, 'orchestration', 'optimizer.py');
          if (existsSync(optScript)) {
            try {
              const { stdout } = await execFileAsync('python3', [optScript, promptText, '--output-tokens', String(expectedOutput)]);
              const analysis = JSON.parse(stdout.trim());
              return sendJson(res, 200, { analysis });
            } catch (err: any) {
              return sendJson(res, 500, { error: 'Token optimization analysis failed', details: err.message });
            }
          } else {
            return sendJson(res, 501, { error: 'orchestration/optimizer.py not found on host' });
          }
        }

        // --- Jev Decision Gateway ---
        if (pathname === '/api/jev' && method === 'POST') {
          const body = await parseBody(req);
          const state = (body.state || body.task || '').trim();
          const bank = (body.bank || 'mode-router').trim();
          const floor = body.floor ? String(body.floor) : '0.72';
          if (!state) {
            return sendJson(res, 400, { error: 'Missing state or task to evaluate' });
          }

          const openrouterKey = process.env.OPENROUTER_API_KEY || db.getSetting('openrouter.api_key') || '';
          const jevScript = join(ROOT_DIR, 'skills', 'jev-gate', 'scripts', 'decide.py');
          if (existsSync(jevScript)) {
            try {
              const args = [jevScript, '--state', state, '--bank', bank, '--floor', floor];
              const env = { ...process.env };
              if (openrouterKey) {
                env.OPENROUTER_API_KEY = openrouterKey;
              }
              const { stdout } = await execFileAsync('python3', args, { env });
              const result = JSON.parse(stdout.trim());
              result.openrouter_configured = !!openrouterKey;
              result.mode = openrouterKey ? 'openrouter-live' : 'offline-fallback';
              result.status_note = openrouterKey
                ? 'Operating via live OpenRouter System-One endpoint (typesafe/jev-1.13)'
                : 'Operating via local deterministic offline rubric fallback. Provide OPENROUTER_API_KEY in Settings or environment for live OpenRouter inference.';

              db.logEvent('jev.decision', { state, bank, policy: result.policy, mode: result.mode });
              return sendJson(res, 200, { result });
            } catch (err: any) {
              return sendJson(res, 500, { error: 'Jev decision evaluation failed', details: err.message });
            }
          } else {
            return sendJson(res, 501, { error: 'skills/jev-gate/scripts/decide.py not found' });
          }
        }

        // --- Skills Catalog & Runner ---
        if (pathname === '/api/skills' && method === 'GET') {
          const skillsDir = join(ROOT_DIR, 'skills');
          const skills: any[] = [];
          if (existsSync(skillsDir)) {
            const entries = readdirSync(skillsDir, { withFileTypes: true });
            for (const ent of entries) {
              if (ent.isDirectory()) {
                const skillMd = join(skillsDir, ent.name, 'SKILL.md');
                if (existsSync(skillMd)) {
                  const content = readFileSync(skillMd, 'utf-8');
                  const match = content.match(/^---\s*([\s\S]*?)\s*---/);
                  let name = ent.name;
                  let description = '';
                  let argumentHint = '';
                  if (match) {
                    const front = match[1];
                    const nameM = front.match(/name:\s*(.+)/);
                    const descM = front.match(/description:\s*(?:["']?)(.+?)(?:["']?)$/m);
                    const argM = front.match(/argument-hint:\s*(?:["']?)(.+?)(?:["']?)$/m);
                    if (nameM) name = nameM[1].trim();
                    if (descM) description = descM[1].trim();
                    if (argM) argumentHint = argM[1].trim();
                  }

                  let category = 'general';
                  if (ent.name.startsWith('plan-') || ent.name.includes('prd') || ent.name.includes('stories')) category = 'planning';
                  else if (ent.name.startsWith('piv-')) category = 'pivotal-loop';
                  else if (ent.name.startsWith('route-') || ent.name.includes('jev')) category = 'routing';
                  else if (ent.name.startsWith('prime-')) category = 'priming';
                  else if (ent.name.startsWith('legal-') || ent.name.startsWith('ny-')) category = 'legal-audit';
                  else if (ent.name.includes('factory')) category = 'factory';
                  else if (ent.name.includes('hook')) category = 'enforcement';
                  else if (ent.name.includes('brain') || ent.name.includes('memory')) category = 'memory';
                  else if (ent.name.includes('token')) category = 'spend-discipline';

                  skills.push({
                    name,
                    folder: ent.name,
                    description,
                    argumentHint,
                    category,
                  });
                }
              }
            }
          }
          return sendJson(res, 200, { total: skills.length, skills });
        }

        const skillMatch = pathname.match(/^\/api\/skills\/([a-zA-Z0-9_\-]+)$/);
        if (skillMatch && method === 'GET') {
          const skillName = skillMatch[1];
          const skillMd = join(ROOT_DIR, 'skills', skillName, 'SKILL.md');
          if (existsSync(skillMd)) {
            return sendJson(res, 200, {
              name: skillName,
              content: readFileSync(skillMd, 'utf-8')
            });
          }
          return sendJson(res, 404, { error: 'Skill not found' });
        }

        // --- Realtime SSE Stream ---
        if (pathname === '/api/stream' && method === 'GET') {
          res.writeHead(200, {
            'Content-Type': 'text/event-stream; charset=utf-8',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no',
            'Access-Control-Allow-Origin': '*',
          });
          res.write(': stream connected\n\n');

          const unsubscribe = db.onEvent((ev) => {
            res.write(`data: ${JSON.stringify(ev)}\n\n`);
          });

          const heartbeat = setInterval(() => {
            res.write(': heartbeat\n\n');
          }, 15000);

          req.on('close', () => {
            clearInterval(heartbeat);
            unsubscribe();
          });
          return;
        }

        // --- Authentication & API Keys ---
        if (pathname === '/api/auth/register' && method === 'POST') {
          const body = await parseBody(req);
          const { email, password, role } = body;
          if (!email || !password) return sendJson(res, 400, { error: 'Email and password required' });
          try {
            const user = db.createUser(email, password, role || 'user');
            return sendJson(res, 201, { user });
          } catch (err: any) {
            return sendJson(res, 400, { error: err.message });
          }
        }

        if (pathname === '/api/auth/login' && method === 'POST') {
          const body = await parseBody(req);
          const { email, password } = body;
          if (!email || !password) return sendJson(res, 400, { error: 'Email and password required' });
          const user = db.verifyUser(email, password);
          if (!user) return sendJson(res, 401, { error: 'Invalid credentials' });
          return sendJson(res, 200, { user, token: 'usr_' + Date.now().toString(36) });
        }

        if (pathname === '/api/auth/keys' && method === 'GET') {
          return sendJson(res, 200, { keys: db.listApiKeys() });
        }

        if (pathname === '/api/auth/keys' && method === 'POST') {
          const body = await parseBody(req);
          const name = body.name || 'Default Key';
          const perms = body.permissions || 'read,write';
          const key = db.createApiKey(name, body.userId, perms);
          return sendJson(res, 201, { key, name, permissions: perms });
        }

        // --- Background Job Queue ---
        if (pathname === '/api/jobs' && method === 'GET') {
          const status = url.searchParams.get('status') || undefined;
          const limit = parseInt(url.searchParams.get('limit') || '50', 10);
          return sendJson(res, 200, { jobs: db.listJobs(status, limit) });
        }

        if (pathname === '/api/jobs' && method === 'POST') {
          const body = await parseBody(req);
          const queue = body.queue || 'default';
          const payload = body.payload || body;
          const delayMs = parseInt(body.delayMs || '0', 10);
          const maxAttempts = parseInt(body.maxAttempts || '3', 10);
          const job = db.enqueueJob(queue, payload, delayMs, maxAttempts);
          return sendJson(res, 201, { job });
        }

        if (pathname === '/api/jobs/process-next' && method === 'POST') {
          const body = await parseBody(req);
          const queue = body.queue || undefined;
          const job = db.claimNextJob(queue);
          if (!job) return sendJson(res, 200, { claimed: false, message: 'No pending jobs in queue' });

          db.completeJob(job.id, { processedAt: new Date().toISOString() });
          return sendJson(res, 200, { claimed: true, job });
        }

        // --- Vector Store & Cosine Similarity ---
        if (pathname === '/api/vectors/upsert' && method === 'POST') {
          const body = await parseBody(req);
          const id = body.id || 'vec_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
          const collection = body.collection || 'default';
          const text = body.text || '';
          const embedding = body.embedding || [];
          const metadata = body.metadata || {};

          if (!Array.isArray(embedding) || embedding.length === 0) {
            return sendJson(res, 400, { error: 'Embedding must be non-empty array of numbers' });
          }

          db.upsertVector(id, collection, text, embedding, metadata);
          return sendJson(res, 201, { success: true, id, collection });
        }

        if (pathname === '/api/vectors/search' && method === 'POST') {
          const body = await parseBody(req);
          const embedding = body.embedding || [];
          const collection = body.collection || 'default';
          const topK = parseInt(body.topK || '5', 10);

          if (!Array.isArray(embedding) || embedding.length === 0) {
            return sendJson(res, 400, { error: 'Query embedding must be non-empty array of numbers' });
          }

          const matches = db.searchVectors(embedding, collection, topK);
          return sendJson(res, 200, { matches });
        }

        // --- Webhooks Ingestion ---
        const webhookMatch = pathname.match(/^\/api\/webhooks\/([a-zA-Z0-9_\-]+)$/);
        if (webhookMatch && method === 'POST') {
          const provider = webhookMatch[1];
          const body = await parseBody(req);
          const eventId = db.logEvent(`webhook.${provider}`, body);
          const job = db.enqueueJob('webhooks', { provider, body, eventId });
          return sendJson(res, 200, { received: true, provider, eventId, jobId: job.id });
        }

        // --- Universal App Scaffolder / Transformer ---
        if (pathname === '/api/app/transform' && method === 'POST') {
          const body = await parseBody(req);
          const preset = (body.preset || 'crm').toLowerCase();
          const appName = body.appName || `Continuity OS · ${preset.toUpperCase()} Engine`;

          db.setSetting('app.name', appName);
          db.setSetting('app.preset', preset);

          let createdCount = 0;
          if (preset === 'crm') {
            db.saveRecord('deal_001', 'deal', { name: 'Acme Enterprise Contract', value: 25000, stage: 'proposal' });
            db.saveRecord('contact_001', 'contact', { name: 'Alice Smith', email: 'alice@acme.com', company: 'Acme Corp' });
            createdCount = 2;
          } else if (preset === 'voice') {
            db.setSetting('voice.provider', 'webrtc_stream');
            db.setSetting('voice.sample_rate', '16000');
            db.saveRecord('voice_session_001', 'voice_session', { session_id: 'sess_101', status: 'completed', durationSec: 32 });
            createdCount = 1;
          } else if (preset === 'agent') {
            db.saveRecord('agent_task_001', 'task', { title: 'Autonomous repo security sweep', tier: 'code', status: 'queued' });
            createdCount = 1;
          } else if (preset === 'rag') {
            db.upsertVector('doc_1', 'kb', 'Continuous software factory guidance layer', [0.1, 0.4, 0.8, -0.2], { topic: 'software-factory' });
            createdCount = 1;
          } else if (preset === 'chat') {
            db.saveRecord('msg_001', 'message', { user: 'operator', channel: 'general', text: 'Welcome to the realtime chat room!' });
            createdCount = 1;
          } else if (preset === 'ecommerce') {
            db.saveRecord('prod_001', 'product', { title: 'Enterprise Agent License', price: 99, inventory: 500 });
            createdCount = 1;
          }

          db.logEvent('app.transformed', { preset, appName, createdCount });
          return sendJson(res, 200, { success: true, preset, appName, createdCount });
        }

        // --- Archon & Archon 2 Multi-Agent Engine ---
        if (pathname === '/api/archon/plan' && method === 'POST') {
          const body = await parseBody(req);
          const goal = (body.goal || '').trim();
          if (!goal) return sendJson(res, 400, { error: 'Missing goal' });
          const { stdout } = await execFileAsync('python3', [join(ROOT_DIR, 'orchestration', 'bridge.py'), 'archon-plan', '--goal', goal]);
          return sendJson(res, 200, JSON.parse(stdout));
        }

        if (pathname === '/api/archon/execute' && method === 'POST') {
          const body = await parseBody(req);
          const goal = (body.goal || '').trim();
          if (!goal) return sendJson(res, 400, { error: 'Missing goal' });
          const { stdout } = await execFileAsync('python3', [join(ROOT_DIR, 'orchestration', 'bridge.py'), 'archon-exec', '--goal', goal]);
          const result = JSON.parse(stdout);
          db.logEvent('archon.executed', { goal, status: result.status, stepsCount: result.steps_count });
          return sendJson(res, 200, result);
        }

        // --- Dark Factory Engine (Dan Shapiro Autonomy Levels 1-5) ---
        if (pathname === '/api/factory/triage' && method === 'POST') {
          const body = await parseBody(req);
          const issueId = body.issueId || '#1';
          const title = (body.title || '').trim();
          const issueBody = body.body || '';
          if (!title) return sendJson(res, 400, { error: 'Missing issue title' });
          const { stdout } = await execFileAsync('python3', [join(ROOT_DIR, 'orchestration', 'bridge.py'), 'factory-triage', '--issue-id', issueId, '--title', title, '--body', issueBody]);
          return sendJson(res, 200, JSON.parse(stdout));
        }

        if (pathname === '/api/factory/build' && method === 'POST') {
          const body = await parseBody(req);
          const issueId = body.issueId || '#1';
          const title = (body.title || '').trim();
          const changes = body.changes || 'Implemented solution';
          const { stdout } = await execFileAsync('python3', [join(ROOT_DIR, 'orchestration', 'bridge.py'), 'factory-build', '--issue-id', issueId, '--title', title, '--changes', changes]);
          return sendJson(res, 200, JSON.parse(stdout));
        }

        if (pathname === '/api/factory/worktrees' && method === 'GET') {
          const { stdout } = await execFileAsync('python3', [join(ROOT_DIR, 'orchestration', 'bridge.py'), 'factory-worktree-list']);
          return sendJson(res, 200, JSON.parse(stdout));
        }

        if (pathname === '/api/factory/pipeline/run' && method === 'POST') {
          const body = await parseBody(req);
          const issueId = body.issueId || '#factory-' + Date.now().toString(36);
          const title = (body.title || '').trim();
          const issueBody = body.body || '';
          const baseBranch = body.baseBranch || 'main';
          if (!title) return sendJson(res, 400, { error: 'Missing issue title' });
          const { stdout } = await execFileAsync('python3', [
            join(ROOT_DIR, 'orchestration', 'bridge.py'),
            'factory-pipeline-run',
            '--issue-id', issueId,
            '--title', title,
            '--body', issueBody,
            '--base-branch', baseBranch,
          ]);
          return sendJson(res, 200, JSON.parse(stdout));
        }

        // --- Second Brain Memory Engine (STATE vs EVENT + Anti-Rot Audit) ---
        if (pathname === '/api/brain/state' && method === 'GET') {
          const { stdout } = await execFileAsync('python3', [join(ROOT_DIR, 'orchestration', 'bridge.py'), 'brain-state']);
          return sendJson(res, 200, JSON.parse(stdout));
        }

        if (pathname === '/api/brain/ingest' && method === 'POST') {
          const body = await parseBody(req);
          const text = (body.text || '').trim();
          if (!text) return sendJson(res, 400, { error: 'Missing text to ingest' });
          const { stdout } = await execFileAsync('python3', [join(ROOT_DIR, 'orchestration', 'bridge.py'), 'brain-ingest', '--text', text]);
          return sendJson(res, 200, JSON.parse(stdout));
        }

        if ((pathname === '/api/brain/audit' && method === 'GET') || (pathname === '/api/brain/audit' && method === 'POST')) {
          const { stdout } = await execFileAsync('python3', [join(ROOT_DIR, 'orchestration', 'bridge.py'), 'brain-audit']);
          return sendJson(res, 200, JSON.parse(stdout));
        }

        // --- RAG, Vector & Docling / Paperclip Parsing Engine ---
        if (pathname === '/api/rag/ingest' && method === 'POST') {
          const body = await parseBody(req);
          const docId = (body.docId || 'doc_' + Date.now()).trim();
          const text = (body.text || '').trim();
          const strategy = body.strategy || 'semantic';
          if (!text) return sendJson(res, 400, { error: 'Missing document text' });
          const { stdout } = await execFileAsync('python3', [join(ROOT_DIR, 'orchestration', 'bridge.py'), 'rag-ingest', '--doc-id', docId, '--text', text, '--strategy', strategy]);
          return sendJson(res, 200, JSON.parse(stdout));
        }

        if (pathname === '/api/rag/search' && method === 'POST') {
          const body = await parseBody(req);
          const query = (body.query || '').trim();
          const limit = parseInt(body.limit || '5', 10);
          if (!query) return sendJson(res, 400, { error: 'Missing query' });
          const { stdout } = await execFileAsync('python3', [join(ROOT_DIR, 'orchestration', 'bridge.py'), 'rag-search', '--query', query, '--limit', String(limit)]);
          return sendJson(res, 200, JSON.parse(stdout));
        }

        // --- Guardrails & Pydantic Schema Screening ---
        if (pathname === '/api/guardrails/check' && method === 'POST') {
          const body = await parseBody(req);
          const text = (body.text || '').trim();
          const isOutput = !!body.isOutput;
          const context = body.context || '';
          if (!text) return sendJson(res, 400, { error: 'Missing text to check' });
          const args = [join(ROOT_DIR, 'orchestration', 'bridge.py'), 'guardrails-check', '--text', text];
          if (isOutput) args.push('--is-output');
          if (context) args.push('--context', context);
          const { stdout } = await execFileAsync('python3', args);
          return sendJson(res, 200, JSON.parse(stdout));
        }

        // --- Integrations: CrewAI & LangGraph ---
        if (pathname === '/api/integrations/crewai' && method === 'GET') {
          const { stdout } = await execFileAsync('python3', [join(ROOT_DIR, 'orchestration', 'bridge.py'), 'crewai-export']);
          return sendJson(res, 200, JSON.parse(stdout));
        }

        if (pathname === '/api/integrations/langgraph' && method === 'GET') {
          const { stdout } = await execFileAsync('python3', [join(ROOT_DIR, 'orchestration', 'bridge.py'), 'langgraph-export']);
          return sendJson(res, 200, JSON.parse(stdout));
        }

        // --- Self-Learning & Heuristics Evolution ---
        if (pathname === '/api/learning/evolve' && method === 'POST') {
          const body = await parseBody(req);
          const failureTrace = (body.failureTrace || '').trim();
          if (!failureTrace) return sendJson(res, 400, { error: 'Missing failureTrace' });
          const { stdout } = await execFileAsync('python3', [join(ROOT_DIR, 'orchestration', 'bridge.py'), 'learning-evolve', '--failure-trace', failureTrace]);
          return sendJson(res, 200, JSON.parse(stdout));
        }

        // --- n8n Workflow Webhook Ingestion ---
        if (pathname === '/api/webhooks/n8n' && method === 'POST') {
          const body = await parseBody(req);
          const { stdout } = await execFileAsync('python3', [join(ROOT_DIR, 'orchestration', 'bridge.py'), 'n8n-webhook', '--payload', JSON.stringify(body)]);
          const job = db.enqueueJob('n8n_workflow', body);
          db.logEvent('n8n.webhook_received', { jobId: job.id, workflowId: body.workflowId });
          return sendJson(res, 200, { received: true, jobId: job.id, parsed: JSON.parse(stdout) });
        }

        return sendJson(res, 404, { error: 'Endpoint not found', path: pathname });
      }

      // --- Static File Serving ---
      if (serveStatic(res, pathname)) {
        return;
      }

      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
    } catch (err: any) {
      console.error('Server error:', err);
      sendJson(res, 500, { error: 'Internal Server Error', message: err.message });
    }
  });

  return { server, db };
}

// Auto-run if executed directly
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const { server } = createAppServer();
  server.listen(PORT, HOST, () => {
    console.log(`\n🚀 Continuity OS Universal App running at: http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
    console.log(`📦 Database: ${DB_PATH}`);
    console.log(`📱 PWA Static Shell: ${PUBLIC_DIR}\n`);
  });

  const shutdown = () => {
    console.log('\nShutting down gracefully...');
    server.close(() => process.exit(0));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
