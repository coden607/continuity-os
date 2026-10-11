#!/usr/bin/env python3
"""
Seed Continuity OS SQLite database with 607 Outreach Prospects, Settings, and Events.
"""

import sys
import json
import sqlite3
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DB_PATH = BASE_DIR / "data" / "app.db"

PROSPECTS = [
    {
        "id": "prospect_cortese",
        "name": "Cortese Restaurant",
        "contact": "Colleen",
        "location": "Binghamton, NY",
        "phone": "(607) 723-6477",
        "category": "Italian Dining & Takeout",
        "bottleneck": "Single phone ordering line during dinner rush; staff busy with dining room and register.",
        "demoUrl": "https://cortese-digital-xwbq.vercel.app/busy-call.html?biz=Cortese%20Restaurant&phone=6077236477",
        "offer": "Free 2-Week Pilot",
        "estLostWeeklyRevenue": 600,
        "status": "ready-to-send"
    },
    {
        "id": "prospect_brozzettis",
        "name": "Brozzetti's Pizza",
        "location": "Johnson City, NY",
        "phone": "(607) 797-9960",
        "category": "Pizzeria & Takeout",
        "bottleneck": "Strictly takeout only. Weekend dinner phone lines constantly engaged between 5-7 PM.",
        "demoUrl": "https://cortese-digital-xwbq.vercel.app/busy-call.html?biz=Brozzetti%27s%20Pizza&phone=6077979960",
        "offer": "Free 2-Week Pilot",
        "estLostWeeklyRevenue": 480,
        "status": "qualified"
    },
    {
        "id": "prospect_nirchis_front",
        "name": "Nirchi's Pizza (Upper Front)",
        "location": "Binghamton, NY",
        "phone": "(607) 722-6331",
        "category": "Pizzeria & Takeout",
        "bottleneck": "High-volume sheet pizza dinner order spikes overwhelm front desk call capacity.",
        "demoUrl": "https://cortese-digital-xwbq.vercel.app/busy-call.html?biz=Nirchi%27s%20Pizza&phone=6077226331",
        "offer": "Free 2-Week Pilot",
        "estLostWeeklyRevenue": 520,
        "status": "qualified"
    },
    {
        "id": "prospect_paul_and_sons",
        "name": "Paul & Sons Pizza",
        "location": "Binghamton, NY (Riverside Dr)",
        "phone": "(607) 296-7692",
        "category": "Artisanal Pizzeria",
        "bottleneck": "Cult artisanal pizza shop; sells out early; phones ring off the hook during prep.",
        "demoUrl": "https://cortese-digital-xwbq.vercel.app/busy-call.html?biz=Paul%20%26%20Sons%20Pizza&phone=6072967692",
        "offer": "Free 2-Week Pilot",
        "estLostWeeklyRevenue": 360,
        "status": "qualified"
    },
    {
        "id": "prospect_michelangelos",
        "name": "Michelangelo's Pizzeria",
        "location": "Binghamton, NY (Court St)",
        "phone": "(607) 724-4045",
        "category": "Italian Dining & Takeout",
        "bottleneck": "High-volume downtown Italian takeout & dining mix; identical setup to Cortese.",
        "demoUrl": "https://cortese-digital-xwbq.vercel.app/busy-call.html?biz=Michelangelo%27s%20Pizzeria&phone=6077244045",
        "offer": "Free 2-Week Pilot",
        "estLostWeeklyRevenue": 420,
        "status": "qualified"
    },
    {
        "id": "prospect_tonys_italian",
        "name": "Tony's Italian Grill",
        "location": "Endicott, NY",
        "phone": "(607) 785-3750",
        "category": "Italian Catering & Takeout",
        "bottleneck": "Takeout family trays and catering dinners by phone; dinner rush bottleneck.",
        "demoUrl": "https://cortese-digital-xwbq.vercel.app/busy-call.html?biz=Tony%27s%20Italian%20Grill&phone=6077853750",
        "offer": "Free 2-Week Pilot",
        "estLostWeeklyRevenue": 500,
        "status": "qualified"
    },
    {
        "id": "prospect_rossis",
        "name": "Rossi's Pizza",
        "location": "Johnson City, NY",
        "phone": "(607) 777-1313",
        "category": "Pizzeria & Delivery",
        "bottleneck": "Neighborhood favorite with continuous phone takeout and delivery traffic.",
        "demoUrl": "https://cortese-digital-xwbq.vercel.app/busy-call.html?biz=Rossi%27s%20Pizza&phone=6077771313",
        "offer": "Free 2-Week Pilot",
        "estLostWeeklyRevenue": 380,
        "status": "qualified"
    },
    {
        "id": "prospect_bellas",
        "name": "Bella's Pizzeria & Grill",
        "location": "Binghamton, NY",
        "phone": "(607) 217-4247",
        "category": "Pizzeria & Grill",
        "bottleneck": "High phone-to-walkin ratio; Friday peak surge call drops.",
        "demoUrl": "https://cortese-digital-xwbq.vercel.app/busy-call.html?biz=Bella%27s%20Pizzeria&phone=6072174247",
        "offer": "Free 2-Week Pilot",
        "estLostWeeklyRevenue": 340,
        "status": "qualified"
    },
    {
        "id": "prospect_guiseppes",
        "name": "Guiseppe's Restaurant",
        "location": "Binghamton, NY (Chenango Bridge)",
        "phone": "(607) 648-3535",
        "category": "Family Italian & Takeout",
        "bottleneck": "Phone takeout orders compete directly with active dining room seating.",
        "demoUrl": "https://cortese-digital-xwbq.vercel.app/busy-call.html?biz=Guiseppe%27s%20Restaurant&phone=6076483535",
        "offer": "Free 2-Week Pilot",
        "estLostWeeklyRevenue": 400,
        "status": "qualified"
    },
    {
        "id": "prospect_the_beef",
        "name": "The Beef Restaurant & Pub",
        "location": "Binghamton, NY (Leroy St)",
        "phone": "(607) 779-2333",
        "category": "Pub & Takeout",
        "bottleneck": "Bar and floor staff doubles as takeout phone order takers during dinner.",
        "demoUrl": "https://cortese-digital-xwbq.vercel.app/busy-call.html?biz=The%20Beef%20Restaurant&phone=6077792333",
        "offer": "Free 2-Week Pilot",
        "estLostWeeklyRevenue": 350,
        "status": "qualified"
    },
    {
        "id": "prospect_spiedie_rib_pit",
        "name": "Spiedie & Rib Pit",
        "location": "Binghamton, NY (Upper Front St)",
        "phone": "(607) 722-7628",
        "category": "Regional Takeout Icon",
        "bottleneck": "Intense lunch and dinner pickup phone queues; callers dial off if engaged.",
        "demoUrl": "https://cortese-digital-xwbq.vercel.app/busy-call.html?biz=Spiedie%20%26%20Rib%20Pit&phone=6077227628",
        "offer": "Free 2-Week Pilot",
        "estLostWeeklyRevenue": 460,
        "status": "qualified"
    },
    {
        "id": "prospect_joes_garage",
        "name": "Joe's Garage Towing & Auto",
        "location": "Binghamton, NY",
        "phone": "(607) 723-3520",
        "category": "Emergency Towing & Auto",
        "bottleneck": "Mechanics under lifts or drivers on road cannot answer urgent dispatch calls ($300-$800/ticket).",
        "demoUrl": "https://cortese-digital-xwbq.vercel.app/busy-call.html?biz=Joe%27s%20Garage%20Towing&phone=6077233520",
        "offer": "Free 2-Week Pilot",
        "estLostWeeklyRevenue": 1200,
        "status": "qualified"
    },
    {
        "id": "prospect_avery_auto",
        "name": "Avery Auto Service",
        "location": "Binghamton, NY",
        "phone": "(607) 238-7972",
        "category": "Automotive Repair",
        "bottleneck": "Service advisors juggling in-person customer dropoffs while phones ring.",
        "demoUrl": "https://cortese-digital-xwbq.vercel.app/busy-call.html?biz=Avery%20Auto%20Service&phone=6072387972",
        "offer": "Free 2-Week Pilot",
        "estLostWeeklyRevenue": 850,
        "status": "qualified"
    },
    {
        "id": "prospect_binghamton_plumbing",
        "name": "Binghamton Plumbing Co",
        "location": "Binghamton, NY",
        "phone": "(607) 260-9556",
        "category": "Emergency Plumbing",
        "bottleneck": "Emergency water leaks; callers immediately dial competitor on Google if line rings out.",
        "demoUrl": "https://cortese-digital-xwbq.vercel.app/busy-call.html?biz=Binghamton%20Plumbing&phone=6072609556",
        "offer": "Free 2-Week Pilot",
        "estLostWeeklyRevenue": 1500,
        "status": "qualified"
    },
    {
        "id": "prospect_bakers_hvac",
        "name": "Baker's Plumbing, Heating & Air",
        "location": "Endicott, NY",
        "phone": "(607) 754-6376",
        "category": "HVAC & Emergency Heating",
        "bottleneck": "Weather-related surge calls during heating/AC season overwhelm front office.",
        "demoUrl": "https://cortese-digital-xwbq.vercel.app/busy-call.html?biz=Baker%27s%20Plumbing%20%26%20HVAC&phone=6077546376",
        "offer": "Free 2-Week Pilot",
        "estLostWeeklyRevenue": 1400,
        "status": "qualified"
    }
]

def seed():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    with conn:
        # Tables
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

        # Settings
        settings = {
            "outreach.campaign": "607-busy-phone-recovery",
            "outreach.pilot_duration_days": "14",
            "outreach.public_demo_url": "https://cortese-digital-xwbq.vercel.app",
            "outreach.primary_contact": "Colleen @ Cortese Restaurant",
            "outreach.operator_email": "coden607@gmail.com",
            "outreach.active_market": "Broome County / Greater Binghamton (607)",
            "outreach.safety_gates_count": "11",
            "app.name": "Continuity OS · Telephony & Recovery Hub",
            "app.version": "1.0.0"
        }
        for k, v in settings.items():
            conn.execute("""
                INSERT OR REPLACE INTO settings (key, value, updated_at)
                VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
            """, (k, v))

        # Insert prospects into records table
        for p in PROSPECTS:
            record_id = p["id"]
            conn.execute("""
                INSERT OR REPLACE INTO records (id, type, data, status, updated_at)
                VALUES (?, 'prospect', ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
            """, (record_id, json.dumps(p), p["status"]))

        # Log audit event
        conn.execute("""
            INSERT INTO events (type, payload)
            VALUES ('outreach.seeded', ?)
        """, (json.dumps({"count": len(PROSPECTS), "campaign": "607-busy-phone-recovery"}),))

    conn.close()
    print(f"✓ Successfully seeded {len(PROSPECTS)} prospects into SQLite database at {DB_PATH}")

if __name__ == "__main__":
    seed()
