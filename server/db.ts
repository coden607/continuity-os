import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

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

export class AppDatabase {
  private db: DatabaseSync;

  constructor(dbPath: string = ':memory:') {
    if (dbPath !== ':memory:') {
      mkdirSync(dirname(dbPath), { recursive: true });
    }
    this.db = new DatabaseSync(dbPath);
    this.initSchema();
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS records (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        data TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_records_type ON records(type);
      CREATE INDEX IF NOT EXISTS idx_records_status ON records(status);

      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_events_created ON events(created_at);
    `);
  }

  // --- Settings (Key / Value) ---
  setSetting(key: string, value: any): void {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO settings (key, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `).run(key, serialized, now);
  }

  getSetting(key: string): any {
    const row = this.db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
    if (!row) return null;
    try {
      return JSON.parse(row.value);
    } catch {
      return row.value;
    }
  }

  listSettings(): Record<string, any> {
    const rows = this.db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
    const result: Record<string, any> = {};
    for (const r of rows) {
      try {
        result[r.key] = JSON.parse(r.value);
      } catch {
        result[r.key] = r.value;
      }
    }
    return result;
  }

  // --- Generic Records ---
  saveRecord(id: string, type: string, data: Record<string, any>, status: string = 'active'): AppRecord {
    const now = new Date().toISOString();
    const existing = this.getRecord(id);
    const createdAt = existing ? existing.createdAt : now;
    const serializedData = JSON.stringify(data);

    this.db.prepare(`
      INSERT INTO records (id, type, data, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        type = excluded.type,
        data = excluded.data,
        status = excluded.status,
        updated_at = excluded.updated_at
    `).run(id, type, serializedData, status, createdAt, now);

    this.logEvent('record.saved', { id, type, status });

    return {
      id,
      type,
      data,
      status,
      createdAt,
      updatedAt: now,
    };
  }

  getRecord(id: string): AppRecord | null {
    const row = this.db.prepare('SELECT * FROM records WHERE id = ?').get(id) as {
      id: string;
      type: string;
      data: string;
      status: string;
      created_at: string;
      updated_at: string;
    } | undefined;

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
    const record = this.getRecord(id);
    if (!record) return false;
    this.db.prepare('DELETE FROM records WHERE id = ?').run(id);
    this.logEvent('record.deleted', { id, type: record.type });
    return true;
  }

  // --- Events (Audit / Activity Feed) ---
  logEvent(type: string, payload: Record<string, any>): number {
    const now = new Date().toISOString();
    const result = this.db.prepare(`
      INSERT INTO events (type, payload, created_at)
      VALUES (?, ?, ?)
    `).run(type, JSON.stringify(payload), now);

    return Number(result.lastInsertRowid);
  }

  listEvents(limit: number = 20): AppEvent[] {
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

  // --- Statistics & Health ---
  getStats(): { records: number; events: number; settings: number; types: string[]; recordsCount: number; eventsCount: number } {
    const recordCount = (this.db.prepare('SELECT COUNT(*) as c FROM records').get() as { c: number }).c;
    const eventCount = (this.db.prepare('SELECT COUNT(*) as c FROM events').get() as { c: number }).c;
    const settingCount = (this.db.prepare('SELECT COUNT(*) as c FROM settings').get() as { c: number }).c;
    const typeRows = this.db.prepare('SELECT DISTINCT type FROM records').all() as { type: string }[];

    return {
      records: recordCount,
      events: eventCount,
      settings: settingCount,
      types: typeRows.map(r => r.type),
      recordsCount: recordCount,
      eventsCount: eventCount,
    };
  }

  close(): void {
    this.db.close();
  }
}
