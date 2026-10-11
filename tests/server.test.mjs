import test, { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { AppDatabase } from '../server/db.ts';
import { createAppServer } from '../server/server.ts';

// Helper for making HTTP requests in tests
function request(port, path, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path,
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers || {}),
        },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          let json = null;
          try {
            json = JSON.parse(body);
          } catch {
            json = body;
          }
          resolve({ status: res.statusCode, headers: res.headers, body: json });
        });
      }
    );
    req.on('error', reject);
    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

describe('Continuity OS · AppDatabase (Native SQLite)', () => {
  let db;

  before(() => {
    // In-memory SQLite for testing
    db = new AppDatabase(':memory:');
  });

  after(() => {
    db.close();
  });

  it('initializes schema and tables correctly', () => {
    const stats = db.getStats();
    assert.equal(stats.recordsCount, 0);
    assert.equal(stats.eventsCount, 0);
  });

  it('manages settings key-value pairs', () => {
    db.setSetting('test.key', 'sample_value');
    assert.equal(db.getSetting('test.key'), 'sample_value');

    const allSettings = db.listSettings();
    assert.equal(allSettings['test.key'], 'sample_value');
  });

  it('manages records CRUD lifecycle', () => {
    const payload = { title: 'Test Task', priority: 1 };
    const saved = db.saveRecord('rec_test_1', 'task', payload, 'active');
    assert.equal(saved.id, 'rec_test_1');
    assert.equal(saved.type, 'task');
    assert.deepEqual(saved.data, payload);

    const retrieved = db.getRecord('rec_test_1');
    assert.ok(retrieved);
    assert.equal(retrieved.id, 'rec_test_1');
    assert.deepEqual(retrieved.data, payload);

    const list = db.listRecords('task');
    assert.equal(list.length, 1);
    assert.equal(list[0].id, 'rec_test_1');

    const deleted = db.deleteRecord('rec_test_1');
    assert.equal(deleted, true);
    assert.equal(db.getRecord('rec_test_1'), null);
  });

  it('records audit events and retrieves them in reverse chronological order', () => {
    db.logEvent('auth.login', { user: 'alice' });
    db.logEvent('auth.logout', { user: 'alice' });

    const events = db.listEvents(10);
    assert.ok(events.length >= 2);
    assert.equal(events[0].type, 'auth.logout');
    assert.equal(events[1].type, 'auth.login');
  });
});

describe('Continuity OS · Universal HTTP Server', () => {
  let serverInstance;
  let testPort;
  let db;

  before(async () => {
    db = new AppDatabase(':memory:');
    const app = createAppServer(db);
    serverInstance = app.server;

    await new Promise((resolve) => {
      // Listen on ephemeral port (0)
      serverInstance.listen(0, '127.0.0.1', () => {
        testPort = serverInstance.address().port;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise((resolve) => serverInstance.close(resolve));
    db.close();
  });

  it('GET /api/health returns 200 with system telemetry', async () => {
    const res = await request(testPort, '/api/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'ok');
    assert.ok(typeof res.body.uptime === 'number');
    assert.ok(res.body.nodeVersion.startsWith('v'));
  });

  it('GET /api/stats returns counts', async () => {
    const res = await request(testPort, '/api/stats');
    assert.equal(res.status, 200);
    assert.ok(typeof res.body.recordsCount === 'number');
    assert.ok(typeof res.body.eventsCount === 'number');
  });

  it('POST /api/records creates a new entity and GET /api/records lists it', async () => {
    const createRes = await request(testPort, '/api/records', {
      method: 'POST',
      body: {
        id: 'user_001',
        type: 'user',
        data: { name: 'Bob', email: 'bob@example.com' },
        status: 'active',
      },
    });
    assert.equal(createRes.status, 201);
    assert.equal(createRes.body.record.id, 'user_001');

    const getRes = await request(testPort, '/api/records/user_001');
    assert.equal(getRes.status, 200);
    assert.equal(getRes.body.record.data.name, 'Bob');

    const listRes = await request(testPort, '/api/records?type=user');
    assert.equal(listRes.status, 200);
    assert.ok(listRes.body.records.some((r) => r.id === 'user_001'));
  });

  it('DELETE /api/records/:id deletes an entity', async () => {
    const delRes = await request(testPort, '/api/records/user_001', { method: 'DELETE' });
    assert.equal(delRes.status, 200);
    assert.equal(delRes.body.deleted, true);

    const getAfter = await request(testPort, '/api/records/user_001');
    assert.equal(getAfter.status, 404);
  });

  it('POST & GET /api/settings manages configuration', async () => {
    const saveRes = await request(testPort, '/api/settings', {
      method: 'POST',
      body: { 'site.theme': 'nord', 'features.pwa': 'enabled' },
    });
    assert.equal(saveRes.status, 200);
    assert.equal(saveRes.body.settings['site.theme'], 'nord');

    const getRes = await request(testPort, '/api/settings');
    assert.equal(getRes.status, 200);
    assert.equal(getRes.body.settings['site.theme'], 'nord');
  });

  it('POST /api/dispatch routes task to Continuity OS dispatch.py', async () => {
    const res = await request(testPort, '/api/dispatch', {
      method: 'POST',
      body: { duty: 'Write unit tests for database schema' },
    });
    assert.equal(res.status, 200);
    assert.ok(res.body.plan);
    assert.ok(res.body.plan.tier);
    assert.ok(res.body.plan.route);
  });

  it('serves static PWA shell (index.html, styles.css, manifest.json)', async () => {
    const htmlRes = await request(testPort, '/');
    assert.equal(htmlRes.status, 200);
    assert.ok(htmlRes.headers['content-type'].includes('text/html'));

    const manifestRes = await request(testPort, '/manifest.json');
    assert.equal(manifestRes.status, 200);
    assert.ok(manifestRes.headers['content-type'].includes('application/json'));

    const cssRes = await request(testPort, '/styles.css');
    assert.equal(cssRes.status, 200);
    assert.ok(cssRes.headers['content-type'].includes('text/css'));
  });

  it('GET /api/skills lists all installed canonical skills', async () => {
    const res = await request(testPort, '/api/skills');
    assert.equal(res.status, 200);
    assert.ok(res.body.total >= 50);
    assert.ok(res.body.skills.some((s) => s.name === 'plan-create-prd'));
    assert.ok(res.body.skills.some((s) => s.name === 'compress-token-spend'));
    assert.ok(res.body.skills.some((s) => s.name === 'opportunity-scan'));

    const singleRes = await request(testPort, '/api/skills/plan-create-prd');
    assert.equal(singleRes.status, 200);
    assert.ok(singleRes.body.content.includes('plan-create-prd'));
  });

  it('GET /api/prds and POST /api/prds/generate manages PRD planning documents', async () => {
    const listRes = await request(testPort, '/api/prds');
    assert.equal(listRes.status, 200);
    assert.ok(Array.isArray(listRes.body.prds));
    assert.ok(listRes.body.prds.some((p) => p.filename.includes('BUSY-PHONE')));

    const genRes = await request(testPort, '/api/prds/generate', {
      method: 'POST',
      body: {
        product: 'AI Tutor App',
        problem: 'Students lack personalized instant feedback on homework',
        hypothesis: 'Instant interactive hints improve test scores by 20%',
        audience: 'High school students',
      },
    });
    assert.equal(genRes.status, 200);
    assert.ok(genRes.body.markdown.includes('AI Tutor App'));
    assert.ok(genRes.body.markdown.includes('Problem Statement'));
  });

  it('POST /api/tokens/analyze analyzes prompt tokens and calculates spend discipline', async () => {
    const res = await request(testPort, '/api/tokens/analyze', {
      method: 'POST',
      body: { prompt: 'You are an engineer. Write a function to calculate Fibonacci sequence.' },
    });
    assert.equal(res.status, 200);
    assert.ok(res.body.analysis);
    assert.ok(typeof res.body.analysis.input_tokens === 'number');
    assert.ok(res.body.analysis.savings_percentage.fast_vs_frontier > 90);
    assert.ok(Array.isArray(res.body.analysis.recommendations));
  });

  it('POST /api/jev evaluates state using Jev decision gate', async () => {
    const res = await request(testPort, '/api/jev', {
      method: 'POST',
      body: {
        task: 'Delete production database tables and flush redis cache',
        bank: 'act-gate',
      },
    });
    assert.equal(res.status, 200);
    assert.ok(res.body.result);
    assert.ok(res.body.result.policy);
    assert.ok(res.body.result.answers);
  });
});
