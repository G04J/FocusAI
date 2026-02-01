# FocusAI

**An AI-powered desktop app that enforces focus by monitoring your screen and blocking distractions during focus sessions.**

You define a task and duration, start a session, and the app captures the screen, detects off-task content (via OCR and optional AI), and can blur or block distracting regions in real time. All data is stored locally.

---

## What It Does

- **Focus sessions**: Create sessions with task name, description, duration, and reference material (URLs, uploaded files, or text).
- **Screen monitoring**: Periodic screenshots with **tile-based change detection** (hashing) to skip unchanged regions and keep analysis fast.
- **Distraction detection**: Rule-based allow/block lists, **OCR** (e.g. browser URL bar), and optional **AI classification** (Ollama/OpenAI) to decide if content is on-task or distracting.
- **Blocking**: **Overlay** (translucent/blur) over distracting zones instead of system-level app blocking; **state machine** (e.g. GREEN / YELLOW / RED) drives when to show or hide the overlay.
- **Dashboard**: Stats (total sessions, focus time, completed), active session card with timer, recent sessions, and filters (planned / active / paused / completed).
- **Auth & data**: Signup/login, **JWT** auth, **bcrypt** password hashing, and **SQLite** (Better-SQLite3) for users, sessions, references, rules, and activity.

---

## Architecture & Design

- **Electron**: Main process handles window lifecycle, **IPC** for frontend-backend communication; **preload** script exposes a minimal, secure API (context isolation, node integration off).
- **Layered backend**: **Repository pattern** (e.g. `userRepository`, `sessionRepository`, `sessionStatisticsRepository`) for data access; **service layer** (auth, session, monitoring, overlay, OCR, AI, rules) for business logic; **validators** shared across frontend and backend.
- **Modular frontend**: Vanilla JS with **ES6 modules** (auth, stats, activeSession, sessionsList, createSession, editSession, sessionModal, theme, utils); single-responsibility modules, no framework.
- **Security**: Passwords hashed with bcrypt; JWT for auth; input validation on both client and server; file upload checks (size, type); user data stays local.

Detailed rationale for stack and patterns is in **[docs/choices.md](docs/choices.md)**; implementation phases and status in **[docs/plan.md](docs/plan.md)** and **[docs/current.md](docs/current.md)**.

---

## Tech Stack

| Area | Technologies |
|------|--------------|
| **Desktop** | Electron |
| **Backend** | Node.js, Better-SQLite3 |
| **Auth** | JWT (jsonwebtoken), bcrypt |
| **Frontend** | Vanilla JavaScript (ES6 modules), HTML, CSS |
| **Screen & media** | screenshot-desktop, Sharp, Tesseract.js (OCR) |
| **AI (optional)** | Ollama, OpenAI-compatible API |
| **Testing** | Jest (unit + integration) |

---

## Skills This Project Demonstrates

- **Full-stack**: Electron app with Node backend and HTML/CSS/JS frontend.
- **Databases**: SQLite schema design, repository pattern, CRUD, and session/activity storage.
- **Auth & security**: JWT, bcrypt, validation, and secure IPC/preload in Electron.
- **Architecture**: Clear separation of data (repositories), business logic (services), and UI; state machine for monitoring/blocking flow.
- **Integrations**: Screen capture, OCR (Tesseract), image processing (Sharp), optional LLM (Ollama/OpenAI).
- **Testing**: Jest for services, repositories, and integration flows (see `backend/test/`).
- **Documentation**: In-repo docs for architecture, plan, current status, and folder structure (`docs/`).

---

## Project Structure

```
FocusAI/
├── main.js                 # Electron main: windows, IPC, service wiring
├── preload.js              # Secure IPC bridge for renderer
├── frontend/
│   ├── pages/              # auth.html, dashboard.html
│   ├── js/                 # dashboard.js + modules/ (auth, stats, sessions, theme, utils)
│   └── css/                # global, auth, dashboard, session-modal
├── backend/
│   ├── database/           # connection.js, repositories/ (user, session, rules, stats, activity, reference)
│   ├── services/           # auth, session, screenMonitor, windowMonitor, sessionMonitor,
│   │                        # overlayService, ocrService, aiClassificationService, distractionDetector,
│   │                        # tileHashService, ruleService, sessionRulesService, taskContextService, etc.
│   ├── overlay/            # Overlay UI (e.g. blur)
│   ├── scripts/            # Helpers (e.g. macOS OCR)
│   └── test/               # Jest tests (unit + integration)
├── docs/                   # explain, plan, current, choices, folderStructure
└── data/                  # SQLite DB, uploads (gitignored)
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

For **AI-based distraction classification**, run [Ollama](https://ollama.ai) locally (or configure an OpenAI-compatible endpoint) as used by the app.

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

- **[docs/explain.md](docs/explain.md)**: File-by-file explanation of modules.
- **[docs/plan.md](docs/plan.md)**: Implementation phases and roadmap.
- **[docs/current.md](docs/current.md)**: Current status and completed vs in-progress features.
- **[docs/choices.md](docs/choices.md)**: Architectural and technology choices and rationale.
- **[docs/folderStructure.md](docs/folderStructure.md)**: Folder structure reference.

---

## License

ISC
