#!/usr/bin/env python3
"""
Continuity OS Universal App Scaffolder & Transformer.
Transforms this barebones fullstack template into any application archetype in seconds.
"""

import sys
import json
import sqlite3
import argparse
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DB_PATH = BASE_DIR / "data" / "app.db"

PRESETS = {
    "crm": {
        "title": "Continuity OS · Enterprise CRM & Deal Pipeline",
        "description": "B2B sales and contact pipeline with deal stages, activity tracking, and client logs.",
        "records": [
            {"id": "deal_001", "type": "deal", "status": "active", "data": {"name": "Acme Enterprise License", "value": 45000, "stage": "proposal", "contact": "Alice Smith"}},
            {"id": "deal_002", "type": "deal", "status": "active", "data": {"name": "Broome County Healthcare Pilot", "value": 18000, "stage": "qualified", "contact": "Dr. Marcus"}},
            {"id": "contact_001", "type": "contact", "status": "active", "data": {"name": "Alice Smith", "company": "Acme Corp", "email": "alice@acme.com", "phone": "607-555-0142"}},
            {"id": "task_001", "type": "task", "status": "pending", "data": {"title": "Send updated proposal to Acme", "dueDate": "Tomorrow 10:00 AM", "priority": "high"}}
        ],
        "settings": {
            "app.name": "Continuity OS · Enterprise CRM",
            "crm.pipeline_stages": "lead,qualified,proposal,negotiation,closed_won,closed_lost",
            "crm.default_currency": "USD"
        }
    },
    "voice": {
        "title": "Continuity OS · Voice & Missed-Call Recovery Hub",
        "description": "Carrier-level busy forward recovery, Twilio webhooks, SMS callback, and TCPA/DNC safety.",
        "records": [
            {"id": "call_001", "type": "call_log", "status": "completed", "data": {"caller": "+16075550199", "status": "busy_forwarded", "smsSent": True, "durationSec": 35}},
            {"id": "prospect_cortese", "type": "prospect", "status": "qualified", "data": {"name": "Cortese Restaurant", "phone": "(607) 723-6477", "offer": "Free 2-Week Pilot", "status": "ready-to-send"}}
        ],
        "settings": {
            "app.name": "Continuity OS · Voice & Recovery Hub",
            "outreach.campaign": "607-busy-phone-recovery",
            "outreach.pilot_duration_days": "14",
            "outreach.demo_url": "https://cortese-digital-xwbq.vercel.app"
        }
    },
    "agent": {
        "title": "Continuity OS · Autonomous Agent Runner",
        "description": "Background worker loops, Jev decision gating, step logging, and 8-tier model routing.",
        "records": [
            {"id": "task_sec_001", "type": "agent_task", "status": "queued", "data": {"title": "Repository dependency & vulnerability scan", "tier": "code", "maxTokens": 4000}},
            {"id": "task_triage_002", "type": "agent_task", "status": "running", "data": {"title": "Customer support triage and sentiment scoring", "tier": "simple", "maxTokens": 500}}
        ],
        "settings": {
            "app.name": "Continuity OS · Autonomous Agent Runner",
            "agent.worker_concurrency": "4",
            "agent.eval_sample_rate": "0.10",
            "agent.auto_retry_max": "3"
        }
    },
    "rag": {
        "title": "Continuity OS · Semantic Knowledge Base & RAG",
        "description": "Vector embeddings store with zero-dependency cosine similarity search and doc synthesis.",
        "records": [
            {"id": "kb_doc_001", "type": "article", "status": "published", "data": {"title": "Software Factory Autonomy Levels", "tags": ["factory", "autonomy", "specs"]}},
            {"id": "kb_doc_002", "type": "article", "status": "published", "data": {"title": "Token Optimization & Prompt Caching", "tags": ["tokens", "pricing", "latency"]}}
        ],
        "settings": {
            "app.name": "Continuity OS · Semantic Knowledge Hub",
            "rag.similarity_threshold": "0.75",
            "rag.top_k": "5"
        }
    },
    "chat": {
        "title": "Continuity OS · Realtime Team & Agent Chat",
        "description": "Server-Sent Events (SSE) live message stream, multi-channel rooms, and AI bot responder.",
        "records": [
            {"id": "msg_001", "type": "message", "status": "active", "data": {"channel": "general", "author": "System", "text": "Realtime SSE live broadcast channel initialized."}},
            {"id": "msg_002", "type": "message", "status": "active", "data": {"channel": "general", "author": "Agent-Alpha", "text": "Standing by for operator duties."}}
        ],
        "settings": {
            "app.name": "Continuity OS · Realtime Chat Engine",
            "chat.default_channel": "general",
            "chat.sse_stream_enabled": "true"
        }
    },
    "ecommerce": {
        "title": "Continuity OS · Digital Storefront & Payments",
        "description": "Product catalog, order records, inventory tracker, and Stripe webhook payment seam.",
        "records": [
            {"id": "sku_001", "type": "product", "status": "active", "data": {"title": "Continuity OS Pro License", "price": 99.00, "inventory": 1000, "sku": "CTY-PRO"}},
            {"id": "sku_002", "type": "product", "status": "active", "data": {"title": "AI Telephony 2-Week Pilot Setup", "price": 0.00, "inventory": 50, "sku": "PILOT-14D"}}
        ],
        "settings": {
            "app.name": "Continuity OS · Digital Storefront",
            "shop.currency": "USD",
            "shop.tax_rate": "0.08"
        }
    },
    "pwa": {
        "title": "Continuity OS · Local-First Offline Field PWA",
        "description": "Offline service worker caching, background sync queue, mobile layout, and local notes.",
        "records": [
            {"id": "field_note_001", "type": "note", "status": "synced", "data": {"title": "Inspection Report #104", "location": "Site B - Binghamton", "notes": "Hardware operational."}},
            {"id": "field_note_002", "type": "note", "status": "pending_sync", "data": {"title": "Customer meter reading", "meterId": "M-8841", "reading": 412.8}}
        ],
        "settings": {
            "app.name": "Continuity OS · Offline Field PWA",
            "pwa.offline_mode": "true",
            "pwa.cache_version": "v1.2"
        }
    }
}

def transform_app(preset_name: str, custom_name: str = None):
    preset = PRESETS.get(preset_name.lower())
    if not preset:
        print(f"Error: Unknown preset '{preset_name}'. Available: {', '.join(PRESETS.keys())}", file=sys.stderr)
        return 1

    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))

    with conn:
        app_name = custom_name or preset["title"]
        conn.execute("INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('app.name', ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))", (app_name,))
        conn.execute("INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('app.preset', ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))", (preset_name,))

        for k, v in preset["settings"].items():
            conn.execute("INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))", (k, str(v)))

        for r in preset["records"]:
            conn.execute("""
                INSERT OR REPLACE INTO records (id, type, data, status, updated_at)
                VALUES (?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
            """, (r["id"], r["type"], json.dumps(r["data"]), r["status"]))

        conn.execute("""
            INSERT INTO events (type, payload)
            VALUES ('app.transformed', ?)
        """, (json.dumps({"preset": preset_name, "appName": app_name, "recordsCount": len(preset["records"])}),))

    conn.close()
    print(f"✨ Successfully transformed app to archetype: [{preset_name.upper()}]")
    print(f"🏷️  App Title:   {app_name}")
    print(f"📝 Description: {preset['description']}")
    print(f"📦 Seeded:      {len(preset['records'])} domain records & {len(preset['settings'])} settings")
    return 0

def main():
    parser = argparse.ArgumentParser(description="Transform Continuity OS into any application")
    parser.add_argument("preset", choices=list(PRESETS.keys()), help="Target archetype preset")
    parser.add_argument("--name", help="Custom application title")
    args = parser.parse_args()
    return transform_app(args.preset, args.name)

if __name__ == "__main__":
    sys.exit(main() or 0)
