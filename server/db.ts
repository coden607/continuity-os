import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';

export interface AppRecord {
  id: string;
  type: string;
  data: Record<string, any>;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface AppEvent {
  id: number;
  type: string;
  payload: Record<string, any>;
  createdAt: string;
}

export interface AppJob {
  id: string;
  queue: string;
  payload: Record<string, any>;
  status: 'pending' | 'running' | 'completed' | 'failed';
  attempts: number;
  maxAttempts: number;
  runAt: string;
  lockedAt?: string | null;
  error?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AppUser {
  id: string;
  email: string;
  role: string;
  createdAt: string;
}

export interface VectorMatch {
  id: string;
  collection: string;
  text: string;
  score: number;
  metadata: Record<string, any>;
}

export class AppDatabase {
  private db: DatabaseSync;
  private eventListeners: Set<(event: AppEvent) => void> = new Set();

  constructor(dbPath: string = ':memory:') {
    if (dbPath !== ':memory:') {
      mkdirSync(dirname(dbPath), { recursive: true });
    }
    this.db = new DatabaseSync(dbPath);
    this.initSchema();
  }

  private initSchema(): void {
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;

      -- Key-value settings
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      -- Generic entity records (CRM, products, tasks, notes, etc.)
      CREATE TABLE IF NOT EXISTS records (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        data TEXT NOT NULL DEFAULT '{}',
        status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_records_type ON records(type);
      CREATE INDEX IF NOT EXISTS idx_records_status ON records(status);

      -- Realtime & audit events
      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        payload TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_events_created ON events(created_at);

      -- Background job queue
      CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY,
        queue TEXT NOT NULL DEFAULT 'default',
        payload TEXT NOT NULL DEFAULT '{}',
        status TEXT NOT NULL DEFAULT 'pending',
        attempts INTEGER NOT NULL DEFAULT 0,
        max_attempts INTEGER NOT NULL DEFAULT 3,
        run_at TEXT NOT NULL,
        locked_at TEXT,
        error TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status, run_at);

      -- Authentication: Users
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        salt TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user',
        created_at TEXT NOT NULL
      );

      -- Authentication: API Keys
      CREATE TABLE IF NOT EXISTS api_keys (
        key TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        user_id TEXT,
        permissions TEXT NOT NULL DEFAULT 'read,write',
        created_at TEXT NOT NULL,
        last_used_at TEXT
      );

      -- Vector search & semantic embeddings
      CREATE TABLE IF NOT EXISTS vectors (
        id TEXT PRIMARY KEY,
        collection TEXT NOT NULL DEFAULT 'default',
        text TEXT NOT NULL,
        embedding TEXT NOT NULL, -- JSON array of floats
        metadata TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_vectors_col ON vectors(collection);
    `);
  }

  // --- Realtime Event Subscriptions (SSE) ---
  onEvent(listener: (event: AppEvent) => void): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  private emitEvent(event: AppEvent): void {
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch (err) {
        console.error('Event listener error:', err);
      }
    }
  }

  // --- Settings ---
  getSetting(key: string): string | null {
    const row = this.db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
    return row ? row.value : null;
  }

  setSetting(key: string, value: string): void {
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO settings (key, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `).run(key, value, now);
  }

  listSettings(): Record<string, string> {
    const rows = this.db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
    const out: Record<string, string> = {};
    for (const r of rows) out[r.key] = r.value;
    return out;
  }

  // --- Generic Records (Universal Entities) ---
  saveRecord(id: string, type: string, data: Record<string, any>, status: string = 'active'): AppRecord {
    const now = new Date().toISOString();
    const dataStr = JSON.stringify(data);

    this.db.prepare(`
      INSERT INTO records (id, type, data, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        type = excluded.type,
        data = excluded.data,
        status = excluded.status,
        updated_at = excluded.updated_at
    `).run(id, type, dataStr, status, now, now);

    this.logEvent('record.saved', { id, type, status });

    return { id, type, data, status, createdAt: now, updatedAt: now };
  }

  getRecord(id: string): AppRecord | null {
    const row = this.db.prepare('SELECT * FROM records WHERE id = ?').get(id) as any;
    if (!row) return null;
    return {
      id: row.id,
      type: row.type,
      data: JSON.parse(row.data),
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  listRecords(type?: string, limit: number = 50): AppRecord[] {
    let rows: any[];
    if (type) {
      rows = this.db.prepare('SELECT * FROM records WHERE type = ? ORDER BY updated_at DESC LIMIT ?').all(type, limit);
    } else {
      rows = this.db.prepare('SELECT * FROM records ORDER BY updated_at DESC LIMIT ?').all(limit);
    }

    return rows.map(r => ({
      id: r.id,
      type: r.type,
      data: JSON.parse(r.data),
      status: r.status,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  deleteRecord(id: string): boolean {
    const rec = this.getRecord(id);
    const result = this.db.prepare('DELETE FROM records WHERE id = ?').run(id);
    const deleted = result.changes > 0;
    if (deleted && rec) {
      this.logEvent('record.deleted', { id, type: rec.type });
    }
    return deleted;
  }

  // --- Realtime Audit Events ---
  logEvent(type: string, payload: Record<string, any>): number {
    const now = new Date().toISOString();
    const result = this.db.prepare(`
      INSERT INTO events (type, payload, created_at)
      VALUES (?, ?, ?)
    `).run(type, JSON.stringify(payload), now);

    const eventId = Number(result.lastInsertRowid);
    const eventObj: AppEvent = { id: eventId, type, payload, createdAt: now };
    this.emitEvent(eventObj);
    return eventId;
  }

  listEvents(limit: number = 25): AppEvent[] {
    const rows = this.db.prepare('SELECT * FROM events ORDER BY id DESC LIMIT ?').all(limit) as {
      id: number;
      type: string;
      payload: string;
      created_at: string;
    }[];

    return rows.map(r => ({
      id: r.id,
      type: r.type,
      payload: JSON.parse(r.payload),
      createdAt: r.created_at,
    }));
  }

  // --- Background Job Queue ---
  enqueueJob(queue: string, payload: Record<string, any>, delayMs: number = 0, maxAttempts: number = 3): AppJob {
    const id = 'job_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const now = new Date();
    const runAt = new Date(now.getTime() + delayMs).toISOString();
    const nowStr = now.toISOString();
    const payloadStr = JSON.stringify(payload);

    this.db.prepare(`
      INSERT INTO jobs (id, queue, payload, status, attempts, max_attempts, run_at, created_at, updated_at)
      VALUES (?, ?, ?, 'pending', 0, ?, ?, ?, ?)
    `).run(id, queue, payloadStr, maxAttempts, runAt, nowStr, nowStr);

    this.logEvent('job.enqueued', { id, queue, runAt });

    return {
      id,
      queue,
      payload,
      status: 'pending',
      attempts: 0,
      maxAttempts,
      runAt,
      createdAt: nowStr,
      updatedAt: nowStr
    };
  }

  claimNextJob(queue?: string): AppJob | null {
    const nowStr = new Date().toISOString();
    let row: any;

    if (queue) {
      row = this.db.prepare(`
        SELECT * FROM jobs
        WHERE status = 'pending' AND queue = ? AND run_at <= ?
        ORDER BY run_at ASC LIMIT 1
      `).get(queue, nowStr);
    } else {
      row = this.db.prepare(`
        SELECT * FROM jobs
        WHERE status = 'pending' AND run_at <= ?
        ORDER BY run_at ASC LIMIT 1
      `).get(nowStr);
    }

    if (!row) return null;

    const lockTime = new Date().toISOString();
    this.db.prepare(`
      UPDATE jobs
      SET status = 'running', attempts = attempts + 1, locked_at = ?, updated_at = ?
      WHERE id = ?
    `).run(lockTime, lockTime, row.id);

    return {
      id: row.id,
      queue: row.queue,
      payload: JSON.parse(row.payload),
      status: 'running',
      attempts: row.attempts + 1,
      maxAttempts: row.max_attempts,
      runAt: row.run_at,
      lockedAt: lockTime,
      error: row.error,
      createdAt: row.created_at,
      updatedAt: lockTime
    };
  }

  completeJob(id: string, resultData?: Record<string, any>): boolean {
    const now = new Date().toISOString();
    const res = this.db.prepare(`
      UPDATE jobs SET status = 'completed', locked_at = NULL, updated_at = ? WHERE id = ?
    `).run(now, id);
    if (res.changes > 0) {
      this.logEvent('job.completed', { id, result: resultData || {} });
      return true;
    }
    return false;
  }

  failJob(id: string, errorMessage: string): boolean {
    const now = new Date().toISOString();
    const row = this.db.prepare('SELECT attempts, max_attempts FROM jobs WHERE id = ?').get(id) as any;
    if (!row) return false;

    const isExhausted = row.attempts >= row.max_attempts;
    const nextStatus = isExhausted ? 'failed' : 'pending';

    this.db.prepare(`
      UPDATE jobs SET status = ?, error = ?, locked_at = NULL, updated_at = ? WHERE id = ?
    `).run(nextStatus, errorMessage, now, id);

    this.logEvent('job.failed', { id, error: errorMessage, exhausted: isExhausted });
    return true;
  }

  listJobs(status?: string, limit: number = 50): AppJob[] {
    let rows: any[];
    if (status) {
      rows = this.db.prepare('SELECT * FROM jobs WHERE status = ? ORDER BY created_at DESC LIMIT ?').all(status, limit);
    } else {
      rows = this.db.prepare('SELECT * FROM jobs ORDER BY created_at DESC LIMIT ?').all(limit);
    }

    return rows.map(r => ({
      id: r.id,
      queue: r.queue,
      payload: JSON.parse(r.payload),
      status: r.status,
      attempts: r.attempts,
      maxAttempts: r.max_attempts,
      runAt: r.run_at,
      lockedAt: r.locked_at,
      error: r.error,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));
  }

  // --- Auth & API Keys ---
  createUser(email: string, passwordPlain: string, role: string = 'user'): AppUser {
    const id = 'usr_' + Date.now().toString(36) + randomBytes(4).toString('hex');
    const salt = randomBytes(16).toString('hex');
    const hash = scryptSync(passwordPlain, salt, 64).toString('hex');
    const now = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO users (id, email, password_hash, salt, role, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, email.toLowerCase().trim(), hash, salt, role, now);

    this.logEvent('user.registered', { id, email, role });
    return { id, email, role, createdAt: now };
  }

  verifyUser(email: string, passwordPlain: string): AppUser | null {
    const row = this.db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim()) as any;
    if (!row) return null;

    const testHash = scryptSync(passwordPlain, row.salt, 64);
    const realHash = Buffer.from(row.password_hash, 'hex');

    if (timingSafeEqual(testHash, realHash)) {
      return { id: row.id, email: row.email, role: row.role, createdAt: row.created_at };
    }
    return null;
  }

  createApiKey(name: string, userId?: string, permissions: string = 'read,write'): string {
    const key = 'cty_' + randomBytes(24).toString('hex');
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO api_keys (key, name, user_id, permissions, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(key, name, userId || null, permissions, now);

    this.logEvent('apikey.created', { name, permissions });
    return key;
  }

  verifyApiKey(key: string): { name: string; permissions: string; userId?: string } | null {
    const row = this.db.prepare('SELECT * FROM api_keys WHERE key = ?').get(key) as any;
    if (!row) return null;

    const now = new Date().toISOString();
    this.db.prepare('UPDATE api_keys SET last_used_at = ? WHERE key = ?').run(now, key);

    return { name: row.name, permissions: row.permissions, userId: row.user_id };
  }

  listApiKeys(): { keyPreview: string; name: string; permissions: string; createdAt: string; lastUsedAt?: string }[] {
    const rows = this.db.prepare('SELECT key, name, permissions, created_at, last_used_at FROM api_keys ORDER BY created_at DESC').all() as any[];
    return rows.map(r => ({
      keyPreview: r.key.slice(0, 8) + '...' + r.key.slice(-4),
      name: r.name,
      permissions: r.permissions,
      createdAt: r.created_at,
      lastUsedAt: r.last_used_at,
    }));
  }

  // --- Vector Store & Cosine Similarity ---
  upsertVector(id: string, collection: string, text: string, embedding: number[], metadata: Record<string, any> = {}): void {
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO vectors (id, collection, text, embedding, metadata, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        collection = excluded.collection,
        text = excluded.text,
        embedding = excluded.embedding,
        metadata = excluded.metadata
    `).run(id, collection, text, JSON.stringify(embedding), JSON.stringify(metadata), now);
  }

  searchVectors(queryEmbedding: number[], collection: string = 'default', topK: number = 5): VectorMatch[] {
    const rows = this.db.prepare('SELECT * FROM vectors WHERE collection = ?').all(collection) as any[];
    if (!rows || rows.length === 0) return [];

    // Helper for cosine similarity
    function cosine(a: number[], b: number[]): number {
      let dot = 0;
      let normA = 0;
      let normB = 0;
      const len = Math.min(a.length, b.length);
      for (let i = 0; i < len; i++) {
        dot += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
      }
      if (normA === 0 || normB === 0) return 0;
      return dot / (Math.sqrt(normA) * Math.sqrt(normB));
    }

    const scored: VectorMatch[] = [];
    for (const r of rows) {
      try {
        const emb = JSON.parse(r.embedding);
        const score = cosine(queryEmbedding, emb);
        scored.push({
          id: r.id,
          collection: r.collection,
          text: r.text,
          score: Math.round(score * 10000) / 10000,
          metadata: JSON.parse(r.metadata),
        });
      } catch {}
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK);
  }

  // --- Statistics & Health ---
  getStats(): {
    records: number;
    events: number;
    settings: number;
    jobs: number;
    users: number;
    vectors: number;
    types: string[];
    recordsCount: number;
    eventsCount: number;
  } {
    const recordCount = (this.db.prepare('SELECT COUNT(*) as c FROM records').get() as { c: number }).c;
    const eventCount = (this.db.prepare('SELECT COUNT(*) as c FROM events').get() as { c: number }).c;
    const settingCount = (this.db.prepare('SELECT COUNT(*) as c FROM settings').get() as { c: number }).c;
    const jobCount = (this.db.prepare('SELECT COUNT(*) as c FROM jobs').get() as { c: number }).c;
    const userCount = (this.db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number }).c;
    const vectorCount = (this.db.prepare('SELECT COUNT(*) as c FROM vectors').get() as { c: number }).c;
    const typeRows = this.db.prepare('SELECT DISTINCT type FROM records').all() as { type: string }[];

    return {
      records: recordCount,
      events: eventCount,
      settings: settingCount,
      jobs: jobCount,
      users: userCount,
      vectors: vectorCount,
      types: typeRows.map(r => r.type),
      recordsCount: recordCount,
      eventsCount: eventCount,
    };
  }

  close(): void {
    this.db.close();
  }
}
