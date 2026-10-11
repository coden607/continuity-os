# Continuity OS · Universal App Adaptation Guide

This repository contains a **zero-dependency, production-grade universal fullstack template** built on top of Continuity OS. It is engineered to serve as a clean foundation that can be quickly adapted into virtually any application type:
- **B2B SaaS / CRM / Project Trackers**
- **Autonomous AI Agent Runners & Task Pipelines**
- **Telephony / Voice AI Systems (Twilio / WebRTC)**
- **Local-first Progressive Web Apps (Offline PWA / Mobile)**
- **IoT & Hardware Telemetry Dashboards**

---

## 1. System Architecture

```
continuity-os/
├── public/                  # Frontend PWA Shell (Zero build step, vanilla JS/CSS)
│   ├── index.html           # Accessible responsive dashboard with modular tabs
│   ├── styles.css           # Design system (light/dark themes, cards, tables, badges)
│   ├── app.js               # Reactive client controller (state, CRUD, API tester)
│   ├── sw.js                # Service Worker (offline caching, network-first API)
│   ├── manifest.json        # PWA Web App Manifest (installable on desktop/mobile)
│   └── icons/icon.svg       # Scalable SVG application icon
├── server/                  # Backend Engine (Node.js 24 + Native SQLite)
│   ├── db.ts                # AppDatabase: Native node:sqlite storage engine
│   └── server.ts            # Native HTTP REST API server + Static file server
├── orchestration/           # AI Routing & Agent Orchestration
│   └── dispatch.py          # Duty classifier & cheapest capable model router
├── tests/                   # Automated Test Suite
│   └── server.test.mjs      # node:test unit & integration tests
├── manage.py                # Unified Python CLI (status, db, dispatch, serve)
├── Dockerfile               # Production container definition (Node 24 + Python 3)
├── vercel.json              # Vercel static & SPA routing configuration
└── .github/workflows/ci.yml # Automated CI pipeline
```

### Key Advantages:
1. **Zero External Dependencies at Runtime**: Powered entirely by Node 24 native capabilities:
   - `node:sqlite` (`DatabaseSync`) with WAL mode for ACID-compliant relational & vector persistence.
   - `node --experimental-strip-types` for direct TypeScript execution without compilation steps.
   - Native `node:http`, `node:crypto` (scrypt password hashing & API keys), and `node:test`.
2. **Realtime Broadcast (SSE)**: Built-in `GET /api/stream` Server-Sent Events push live database and agent events directly to browser clients.
3. **Semantic Vector Store**: Zero-dependency cosine similarity search engine in SQLite (`POST /api/vectors/search`, `POST /api/vectors/upsert`).
4. **Background Job Queue**: Multi-worker asynchronous task queue with retry logic (`POST /api/jobs`, `POST /api/jobs/process-next`).
5. **Universal 1-Click Transformation**: Instantly transform the barebones app into any target archetype via CLI (`python3 manage.py scaffold <preset>`) or browser UI modal.
6. **PRD Planning & Token Discipline**: Integrated PRD studio (`/api/prds`), Token Optimizer (`/api/tokens/analyze`), Jev Decision Gate (`/api/jev`), and all 51 canonical skills.

---

## 2. Quick Start

```bash
# 1. Run automated test suite (19/19 passing)
npm test

# 2. Typecheck TypeScript definitions
npm run typecheck

# 3. Transform app into your target archetype in 1 click:
# Presets: crm, voice, agent, rag, chat, ecommerce, pwa
python3 manage.py scaffold crm

# 4. Start development / production server (default: http://localhost:3000)
npm start

# 5. Inspect system status via CLI
python3 manage.py status

# 6. Analyze prompt token spend & calculate 90%+ cost savings
python3 manage.py tokens "Refactor database authentication function"

# 7. Evaluate action through Jev system-one policy gate
python3 manage.py jev --state "Perform database migration" --bank act-gate
```

---

## 3. How to Convert into Specific App Types

### Example A: Converting into a SaaS CRM / Contact Manager
1. **Update Entity Types**:
   - Use `type = "contact"` for people and `type = "deal"` for pipelines.
   - Insert records via `POST /api/records`:
     ```json
     {
       "type": "contact",
       "data": { "name": "Jane Doe", "company": "Acme Corp", "phone": "+14155552671" },
       "status": "active"
     }
     ```
2. **Add Custom Endpoints in [`server/server.ts`](file:///root/Projects/continuity-os/server/server.ts)**:
   ```ts
   if (pathname === '/api/contacts' && method === 'GET') {
     return sendJson(res, 200, { contacts: db.listRecords('contact') });
   }
   ```
3. **Customize Dashboard UI**:
   - Rename tabs in [`public/index.html`](file:///root/Projects/continuity-os/public/index.html) from "Records" to "Contacts" or "Pipelines".

---

### Example B: Converting into an AI Voice / Telephony Agent App
1. **Add Webhook Endpoints in [`server/server.ts`](file:///root/Projects/continuity-os/server/server.ts)**:
   - Handle Twilio or Telnyx voice webhooks:
   ```ts
   if (pathname === '/api/webhooks/voice' && method === 'POST') {
     const body = await parseBody(req);
     db.logEvent('call.incoming', body);
     const plan = await execDispatch(`Handle call from ${body.From}`);
     // Return TwiML response
     res.writeHead(200, { 'Content-Type': 'text/xml' });
     return res.end('<Response><Say>Connecting you to our assistant.</Say></Response>');
   }
   ```
2. **Store Call Logs**:
   - Save completed calls as `type = "call_log"` in the `records` table.
3. **Trigger AI Summary**:
   - On call completion, post transcript to `/api/dispatch` to summarize and store key points in `second-brain/memory/`.

---

### Example C: Converting into an Autonomous AI Agent Task Pipeline
1. **Define Task States**:
   - Status transitions: `queued` → `running` → `completed` | `failed`.
2. **Process Tasks with Workers**:
   - Fetch active tasks: `db.listRecords('task')`.
   - Dispatch task prompt via `POST /api/dispatch`.
   - Log execution step in `db.logEvent('agent.step', stepData)`.
   - Update record status to `completed` upon finishing.

---

### Example D: Converting into a Local-First Offline PWA
1. **Offline Sync**:
   - The included [`public/sw.js`](file:///root/Projects/continuity-os/public/sw.js) caches all assets in the `'continuity-v1'` cache.
   - In [`public/app.js`](file:///root/Projects/continuity-os/public/app.js), catch offline API calls and save them into `indexedDB` or `localStorage`.
   - Register a `sync` event in the Service Worker to replay pending records when the device reconnects to the network.

---

## 4. Customization & Rebranding Guide

| Goal | Target File | Action |
|---|---|---|
| **App Title & Header** | [`public/index.html`](file:///root/Projects/continuity-os/public/index.html) | Change `<title>` and `.brand-title` / `.brand-badge` |
| **Color Scheme & Themes** | [`public/styles.css`](file:///root/Projects/continuity-os/public/styles.css) | Modify CSS variables in `:root` and `body.light-theme` |
| **App Icon & Splash** | [`public/icons/icon.svg`](file:///root/Projects/continuity-os/public/icons/icon.svg) | Replace with your company or project SVG/PNG |
| **PWA Name & Manifest** | [`public/manifest.json`](file:///root/Projects/continuity-os/public/manifest.json) | Update `name`, `short_name`, and `theme_color` |
| **Database Schema** | [`server/db.ts`](file:///root/Projects/continuity-os/server/db.ts) | Add custom SQLite tables or indexes in `initSchema()` |
| **API Endpoints** | [`server/server.ts`](file:///root/Projects/continuity-os/server/server.ts) | Add route handlers under `if (pathname.startsWith('/api/'))` |
| **Python CLI Commands** | [`manage.py`](file:///root/Projects/continuity-os/manage.py) | Add subcommands in `subparsers.add_parser()` |

---

## 5. Deployment Options

### A. Docker Single-Container
```bash
docker build -t my-app .
docker run -d -p 3000:3000 -v $(pwd)/data:/app/data --name my-app my-app
```

### B. Vercel Static + Serverless
The repository is pre-configured with [`vercel.json`](file:///root/Projects/continuity-os/vercel.json).
Deploy directly via GitHub or run:
```bash
vercel --prod
```

### C. Systemd Service (Linux VPS)
Create `/etc/systemd/system/universal-app.service`:
```ini
[Unit]
Description=Continuity OS Universal App
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/root/Projects/continuity-os
ExecStart=/usr/bin/node --experimental-strip-types server/server.ts
Restart=always
Environment=NODE_ENV=production PORT=3000

[Install]
WantedBy=multi-user.target
```
Enable and start:
```bash
systemctl daemon-reload
systemctl enable --now universal-app
```

---

## 6. Testing & Quality Assurance
- **Automated Tests**: Run `npm test` (or `python3 manage.py test`).
- **Type Checking**: Run `npm run typecheck`.
- **System Health**: Run `npm run status` (or `bash scripts/status.sh`).
