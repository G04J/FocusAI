
# The general idea 

- An AI based focus and disciplane enforcing app. 

- blocks out distractions and stops user from deviating from the given task 

# How? 

3 parts 

- Frontend 

-> simple frontend layout for the app 
-> from the app - sessions can be created. each session can have information regarding the task(s) that need to be completed in the session or some additional iinformation (like some website that should always be available irrespective)
-> the sessions are saved on your focusSessions Page
-> Upon starting any session, the screen monitoring begins 

- AI logic 

- Backend 

-> login info 
-> stores all sessison information 
-> stores user's activity for a final report 

# Procedure 

-> tasks mentioned by the user to accomplish. 
-> focus session started 
-> live screen recording (using python library)
-> AI analysis of the screen 
-> Realtime block of distractions and if the user starts doing something else (i.e. gets distracted) - a warning is given and the distraction is blocked out. 


# how does the block occurs?

-> Blocking applications on a system level demands dealing with the operating system which can be quite unsafe and taxing to implement so we will have to think of a workaround for that. 

-> maybe an inaccssisble blur screen. 


# Things to be cautious of

-> AI analysis needs to be fast 
-> make sure user data is secure - try to store it locally 
-> blocking is difficult - a translucent screen overlay 

# brainstorming ideas 

### Idea 1 

what if I divide the screen into grids - then I do analysis of the screen to fetch data on what all is on the screen - and then I label each grid with the information its giving out - and then I block out any grid that is unrelated to the focus session. 

### idea 2 
screen captured (lets say every 3 seconds) screen alalysied if all focus - nothing to be done if distraction - split screen into grid and blur out zones marked as distraction

### ideas to make it fast 

1. skip zones that haven’t changed (hash comparison) → reduces unnecessary processing 
2. Downscale screenshot immediately




#### notes 

now that I am doing screen capture, the next step is to analyse the screenshots produced. 
lets do it in layers - first a quick less through scan 
1. if the scan comes clear - move ahead 
2. if ambigious or flagged as a potential distraction - a more descriptive analysis 
3. if green - go ahead 
4. if red - then we move to the blurring 


### 

1. screen capture --- done 
2. user details 
3. os api to detect currently focused app or window 
4. then run ocr 
5. for further development - run an image classifier 

s


### implementating order for user session info

Step 1: Database Schema for Sessions
  ↓
Step 2: Session Repository (data access)
  ↓
Step 3: Session Service (business logic)
  ↓
Step 4: IPC Handlers in main.js
  ↓
Step 5: Update preload.js
  ↓
Step 6: Session Creation UI
  ↓
Step 7: Sessions List UI
  ↓
Step 8: Start Session Flow (placeholder for now)

### frontend completed till now 

✅ Completed Features

Authentication System

Login/Register
Token-based auth
User persistence


Session Management

Create sessions with task name, description, duration
Multiple reference types (URLs, Files, Text, Mixed)
Start/Stop/Pause/Resume sessions
Real-time timer with elapsed/remaining time
Progress bar
Session status tracking (planned, active, paused, stopped, completed)
View/Edit sessions (with full reference material support)
Delete sessions
Restart completed sessions
Filter sessions by status


Dashboard

Stats display (total sessions, focus time, completed)
Active session card with collapse/expand
Recent sessions list
All sessions page with filters


File Management

Multiple file uploads
File size validation (50MB limit)
File type restrictions




Now your codebase is:
- ✅ **Modular** - Each concern has its own file
- ✅ **Maintainable** - Easy to find and fix bugs
- ✅ **Organized** - Clear separation of concerns
- ✅ **No Duplicates** - All duplicate code removed
- ✅ **ES6 Modules** - Using modern import/export

**File Structure:**
```
frontend/js/
├── dashboard.js (200 lines - main entry point)
├── modules/
│   ├── auth.js (40 lines)
│   ├── stats.js (20 lines)
│   ├── activeSession.js (180 lines)
│   ├── sessionsList.js (120 lines)
│   ├── sessionActions.js (120 lines)
│   ├── createSession.js (300 lines)
│   ├── sessionModal.js (250 lines)
│   ├── editSession.js (350 lines)
│   └── utils.js (40 lines)

1) User Authentication
   └─> `authService` (signup/login, JWT)

2) Session Setup
   └─> Create/edit session (task + references)
       └─> `sessionService` + repositories
           └─> `referenceProcessingService`
               (PDF/URL/Text → summaries + keywords → stored)

3) Start Session
   └─> `sessionService.startSession`
       └─> `SessionMonitor.start`
           ├─> `WindowMonitor.startMonitoring` (active app/window)
           ├─> `ScreenMonitor.start` (adaptive screenshots)
           └─> `SessionStatisticsRepository.initialize`

4) Monitoring Loop (every few seconds)
   ├─> `WindowMonitor.getActiveWindow`
   ├─> `ScreenMonitor.getLastScreenshot`
   ├─> `TileHashService.computeTileHashes` (change detection)
   └─> `DistractionDetector.detectDistraction`
        ├─> `SessionRulesService` (always allow/block)
        ├─> `RuleService` (safety net blocklist)
        ├─> `OCRService.ocrUrlBar` (if browser)
        ├─> `TaskContextService.getTaskContext`
        └─> `AIClassificationService.classifyContent` (via Ollama/OpenAI)

5) State & Blocking
   ├─> `MonitoringStateMachine.transitionTo` (GREEN/YELLOW/AMBIGUOUS/RED)
   ├─> `OverlayService.show/hide` (block distracting zones when RED)
   ├─> Activity log repository (events, distractions)
   └─> `SessionStatisticsRepository.updateStats`

6) Session End (stop / complete / pause)
   └─> `sessionService` (stop/pause/complete)
       └─> `SessionMonitor.stop/pause`
           ├─> stop window/screen monitors
           ├─> hide overlay
           └─> finalize stats

7) Review & Reports (future)
   └─> Dashboard reads sessions + `session_statistics`
       (activity reports, distraction frequency, focus analytics)
=======
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
>>>>>>> phase4
