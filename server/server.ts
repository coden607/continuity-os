import { createServer, IncomingMessage, ServerResponse, Server } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
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
            db.setSetting(k, v);
          }
          return sendJson(res, 200, { settings: db.listSettings() });
        }

        // --- AI Dispatch Bridge ---
        if (pathname === '/api/dispatch' && method === 'POST') {
          const body = await parseBody(req);
          const duty = (body.duty || body.task || '').trim();
          if (!duty) {
            return sendJson(res, 400, { error: 'Missing duty parameter' });
          }

          const dispatchScript = join(ROOT_DIR, 'orchestration', 'dispatch.py');
          if (existsSync(dispatchScript)) {
            try {
              const { stdout } = await execFileAsync('python3', [dispatchScript, '--duty', duty]);
              const plan = JSON.parse(stdout.trim());
              db.logEvent('ai.dispatch', { duty, tier: plan.tier, route: plan.route });
              return sendJson(res, 200, { plan });
            } catch (err: any) {
              return sendJson(res, 500, { error: 'Dispatch script execution failed', details: err.message });
            }
          } else {
            return sendJson(res, 501, { error: 'orchestration/dispatch.py not found on host' });
          }
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
