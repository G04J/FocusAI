# FocusAI

**An AI-powered desktop app that enforces focus by monitoring your screen and blocking distractions during focus sessions.**

FocusAI addresses the problem of staying on task when working on a computer. Instead of blocking apps at the system level (which is complex and brittle), it runs a focus session: you set a task and optional reference material (URLs, files, or notes), and the app captures the screen periodically, analyzes what is visible (using OCR and optional AI), and overlays or blurs regions it classifies as distracting. A state machine (e.g. green / yellow / red) decides when to show the overlay. Everything runs locally; user data and session history stay on your machine.

---

## What It Does

- **Focus sessions**: Task name, description, duration, and reference material (URLs, uploaded files, or text). Sessions can be planned, active, paused, stopped, or completed.
- **Screen monitoring**: Periodic screenshots with tile-based change detection (hashing) so only changed regions are analyzed.
- **Distraction detection**: Rule-based allow/block lists, OCR (e.g. browser URL bar), and optional AI classification (Ollama or OpenAI-compatible API) to label content as on-task or distracting.
- **Blocking**: Translucent overlay over distracting zones; state machine controls when the overlay is shown or hidden.
- **Dashboard**: Session stats (total sessions, focus time, completed count), active session card with timer, recent sessions, and filters by status.
- **Auth and storage**: Signup/login with token-based auth and local SQLite for users, sessions, references, rules, and activity.

---

## Architecture and Design

- **Electron**: Main process owns windows and IPC; a preload script exposes a minimal API to the renderer (context isolation, node integration disabled).
- **Backend**: Repository layer for data access; service layer for business logic; shared validators. No ORM; direct SQLite via Better-SQLite3.
- **Frontend**: Vanilla JS with ES6 modules (auth, stats, sessions, theme, utils), one concern per module, no framework.
- **Security**: Hashed passwords, stateless token auth, validation on client and server, file upload checks, local-only data.

Rationale for stack and patterns: **[docs/choices.md](docs/choices.md)**. Phases and status: **[docs/plan.md](docs/plan.md)**, **[docs/current.md](docs/current.md)**.

---

## How It Works

When you start a focus session, the app begins capturing the screen at intervals. Each frame is split into tiles and hashed; only tiles whose content changed since the last run are sent for analysis. That keeps processing fast. For each changed region, the pipeline checks your session rules (always allowed or blocked URLs/apps), then runs OCR on text (e.g. the browser URL bar) and optionally sends content to an AI classifier (Ollama or OpenAI-compatible) to decide if it matches your task or counts as a distraction. The result drives a small state machine (e.g. green for on-task, yellow for unclear, red for distraction). When the state is red, the overlay is shown over the distracting zone; when it returns to green, the overlay is hidden. Session stats and activity are written to the local database so you can review focus time and distraction events later.

---

## Tech Stack

| Area | Technologies |
|------|--------------|
| Desktop | Electron |
| Backend | Node.js, Better-SQLite3 |
| Auth | JWT (jsonwebtoken), bcrypt |
| Frontend | Vanilla JavaScript (ES6 modules), HTML, CSS |
| Screen and media | screenshot-desktop, Sharp, Tesseract.js |
| AI (optional) | Ollama, OpenAI-compatible API |
| Testing | Jest (unit and integration) |

---

## Project Structure

```
FocusAI/
├── main.js                 # Electron main: windows, IPC, service wiring
├── preload.js              # Secure IPC bridge for renderer
├── frontend/
│   ├── pages/              # auth, dashboard
│   ├── js/                 # dashboard entry + modules
│   └── css/
├── backend/
│   ├── database/          # connection, repositories
│   ├── services/           # auth, session, monitoring, overlay, OCR, AI, rules
│   ├── overlay/            # Overlay UI
│   ├── scripts/            # Platform helpers (e.g. macOS OCR)
│   └── test/               # Jest tests
├── docs/                   # explain, plan, current, choices, folderStructure
└── data/                   # SQLite DB, uploads (gitignored)
```

---

## Getting Started

**Prerequisites:** Node.js (v18+), npm.

```bash
git clone https://github.com/G04J/FocusAI.git
cd FocusAI
npm install
npm start
```

For AI-based distraction classification, run [Ollama](https://ollama.ai) locally or point the app at an OpenAI-compatible endpoint.

---

## Scripts

| Command | Description |
|--------|-------------|
| `npm start` | Launch the Electron app |
| `npm test` | Run Jest tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage |

---

## Documentation

- **[docs/explain.md](docs/explain.md)**: File-by-file module overview.
- **[docs/plan.md](docs/plan.md)**: Implementation phases and roadmap.
- **[docs/current.md](docs/current.md)**: Current status and completed vs in-progress work.
- **[docs/choices.md](docs/choices.md)**: Architectural and technology choices.
- **[docs/folderStructure.md](docs/folderStructure.md)**: Folder structure reference.

---

## License

ISC
