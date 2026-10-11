#!/usr/bin/env python3
"""
Continuity OS Universal App Manager CLI
Unified developer and operations utility.
"""

import sys
import os
import json
import argparse
import sqlite3
import subprocess
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "data" / "app.db"
DISPATCH_PATH = BASE_DIR / "orchestration" / "dispatch.py"

def get_db():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    with conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
            );
            CREATE TABLE IF NOT EXISTS records (
                id TEXT PRIMARY KEY,
                type TEXT NOT NULL,
                data TEXT NOT NULL DEFAULT '{}',
                status TEXT NOT NULL DEFAULT 'active',
                created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
                updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
            );
            CREATE TABLE IF NOT EXISTS events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                type TEXT NOT NULL,
                payload TEXT NOT NULL DEFAULT '{}',
                created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
            );
        """)
    return conn


def cmd_status(args):
    print("========================================")
    print("🧠 Continuity OS Universal App Status")
    print("========================================")
    print(f"Directory:       {BASE_DIR}")
    print(f"Database File:   {DB_PATH} ({'Exists' if DB_PATH.exists() else 'Not initialized yet'})")
    print(f"Dispatch Script: {DISPATCH_PATH} ({'Ready' if DISPATCH_PATH.exists() else 'Missing'})")
    
    # Check DB stats
    if DB_PATH.exists():
        try:
            conn = get_db()
            records_cnt = conn.execute("SELECT COUNT(*) FROM records").fetchone()[0]
            events_cnt = conn.execute("SELECT COUNT(*) FROM events").fetchone()[0]
            settings_cnt = conn.execute("SELECT COUNT(*) FROM settings").fetchone()[0]
            conn.close()
            print(f"DB Records:      {records_cnt}")
            print(f"DB Events:       {events_cnt}")
            print(f"DB Settings:     {settings_cnt}")
        except Exception as e:
            print(f"DB Error:        {e}")
    else:
        print("DB Records:      0 (Will auto-create on first server run)")

    # Check node version
    try:
        node_ver = subprocess.check_output(["node", "-v"], text=True).strip()
        print(f"Node.js Runtime: {node_ver}")
    except Exception:
        print("Node.js Runtime: Not found")

    print("========================================")

def cmd_db_stats(args):
    if not DB_PATH.exists():
        print(f"Database {DB_PATH} does not exist yet. Run the server to initialize it.")
        return 0
    conn = get_db()
    records = conn.execute("SELECT type, count(*) as count FROM records GROUP BY type").fetchall()
    print("Records by Type:")
    if records:
        for r in records:
            print(f" - {r['type']}: {r['count']}")
    else:
        print(" (No records)")

    events = conn.execute("SELECT type, count(*) as count FROM events GROUP BY type").fetchall()
    print("\nAudit Events by Type:")
    if events:
        for ev in events:
            print(f" - {ev['type']}: {ev['count']}")
    else:
        print(" (No events)")
    conn.close()

def cmd_add_record(args):
    payload = {}
    if args.data:
        try:
            payload = json.loads(args.data)
        except Exception as e:
            print(f"Error parsing data JSON: {e}", file=sys.stderr)
            return 1

    import time
    import random
    record_id = args.id or f"rec_{int(time.time())}_{random.randint(100, 999)}"
    record_type = args.type or "generic"
    status = args.status or "active"

    conn = get_db()
    with conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS records (
                id TEXT PRIMARY KEY,
                type TEXT NOT NULL,
                data TEXT NOT NULL DEFAULT '{}',
                status TEXT NOT NULL DEFAULT 'active',
                created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
                updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
            )
        """)
        conn.execute("""
            INSERT OR REPLACE INTO records (id, type, data, status, updated_at)
            VALUES (?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        """, (record_id, record_type, json.dumps(payload), status))
    conn.close()
    print(f"✓ Record created: {record_id} [{record_type}] ({status})")
    return 0

def cmd_dispatch(args):
    if not DISPATCH_PATH.exists():
        print(f"Error: {DISPATCH_PATH} not found", file=sys.stderr)
        return 1
    
    cmd = [sys.executable, str(DISPATCH_PATH), "--duty", args.duty]
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        print(f"Dispatch failed:\n{res.stderr}", file=sys.stderr)
        return res.returncode
    
    try:
        plan = json.loads(res.stdout)
        print(json.dumps(plan, indent=2))
    except Exception:
        print(res.stdout)
    return 0

def cmd_tokens(args):
    opt_script = BASE_DIR / "orchestration" / "optimizer.py"
    cmd = [sys.executable, str(opt_script), args.text, "--output-tokens", str(args.output_tokens)]
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        print(f"Error: {res.stderr}", file=sys.stderr)
        return res.returncode
    try:
        data = json.loads(res.stdout)
        print(json.dumps(data, indent=2))
    except Exception:
        print(res.stdout)
    return 0

def cmd_jev(args):
    jev_script = BASE_DIR / "skills" / "jev-gate" / "scripts" / "decide.py"
    cmd = [sys.executable, str(jev_script), "--state", args.state, "--bank", args.bank, "--floor", str(args.floor)]
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        print(f"Error: {res.stderr}", file=sys.stderr)
        return res.returncode
    try:
        data = json.loads(res.stdout)
        print(json.dumps(data, indent=2))
    except Exception:
        print(res.stdout)
    return 0

def cmd_prds(args):
    prd_dir = BASE_DIR / "factory" / "prd"
    if not prd_dir.exists():
        print("No PRD directory found.")
        return 0
    files = list(prd_dir.glob("*.md"))
    print(f"Found {len(files)} PRD document(s):")
    for f in sorted(files):
        print(f" - {f.name} ({f.stat().st_size} bytes)")
    return 0

def cmd_serve(args):
    env = os.environ.copy()
    if args.port:
        env["PORT"] = str(args.port)
    print(f"Starting server on port {args.port or 3000}...")
    subprocess.run(["node", "--experimental-strip-types", "server/server.ts"], cwd=str(BASE_DIR), env=env)

def cmd_test(args):
    cmd = ["node", "--experimental-strip-types", "--test", "tests/server.test.mjs"]
    return subprocess.run(cmd, cwd=str(BASE_DIR)).returncode

def main():
    parser = argparse.ArgumentParser(description="Continuity OS Universal App CLI")
    subparsers = parser.add_subparsers(dest="command", required=True)

    # status
    p_status = subparsers.add_parser("status", help="Show system and database status")
    p_status.set_defaults(func=cmd_status)

    # db-stats
    p_db = subparsers.add_parser("db-stats", help="Display SQLite table counts")
    p_db.set_defaults(func=cmd_db_stats)

    # add-record
    p_rec = subparsers.add_parser("add-record", help="Insert a record directly into SQLite")
    p_rec.add_argument("--type", default="generic", help="Record type")
    p_rec.add_argument("--id", default=None, help="Record ID (auto-generated if omitted)")
    p_rec.add_argument("--status", default="active", help="Status (active, pending, etc.)")
    p_rec.add_argument("--data", default="{}", help="JSON payload")
    p_rec.set_defaults(func=cmd_add_record)

    # dispatch
    p_disp = subparsers.add_parser("dispatch", help="Test AI model router dispatch")
    p_disp.add_argument("--duty", required=True, help="Task / duty prompt to route")
    p_disp.set_defaults(func=cmd_dispatch)

    # tokens
    p_tok = subparsers.add_parser("tokens", help="Analyze prompt tokens and calculate spend savings")
    p_tok.add_argument("text", help="Prompt text to analyze")
    p_tok.add_argument("--output-tokens", type=int, default=500, help="Expected output tokens")
    p_tok.set_defaults(func=cmd_tokens)

    # jev
    p_jev = subparsers.add_parser("jev", help="Run Jev system-one decision gate")
    p_jev.add_argument("--state", required=True, help="State or action description to evaluate")
    p_jev.add_argument("--bank", default="act-gate", help="Question bank (act-gate, mode-router, retry-stop, legal-risk)")
    p_jev.add_argument("--floor", type=float, default=0.72, help="Policy floor threshold")
    p_jev.set_defaults(func=cmd_jev)

    # prds
    p_prds = subparsers.add_parser("prds", help="List PRD documents")
    p_prds.set_defaults(func=cmd_prds)

    # scaffold
    p_scaf = subparsers.add_parser("scaffold", help="Transform app into an archetype (crm, voice, agent, rag, chat, ecommerce, pwa)")
    p_scaf.add_argument("preset", choices=["crm", "voice", "agent", "rag", "chat", "ecommerce", "pwa"], help="Target archetype preset")
    p_scaf.add_argument("--name", help="Custom application title")
    p_scaf.set_defaults(func=lambda args: __import__("orchestration.scaffold", fromlist=["transform_app"]).transform_app(args.preset, args.name))

    # serve
    p_serve = subparsers.add_parser("serve", help="Start the Node.js server")
    p_serve.add_argument("--port", type=int, default=3000, help="Port to listen on")
    p_serve.set_defaults(func=cmd_serve)

    # test
    p_test = subparsers.add_parser("test", help="Run automated test suite")
    p_test.set_defaults(func=cmd_test)

    args = parser.parse_args()
    return args.func(args)

if __name__ == "__main__":
    sys.exit(main() or 0)
