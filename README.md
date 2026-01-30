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