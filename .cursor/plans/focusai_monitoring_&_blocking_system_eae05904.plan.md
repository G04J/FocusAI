---
name: FocusAI Monitoring & Blocking System
overview: ""
todos:
  - id: install-deps
    content: "Install dependencies: get-windows, xxhash, tesseract.js, pdf-parse, cheerio via npm"
    status: in_progress
  - id: window-monitor
    content: Create windowMonitor.js service with get-windows integration for active app/window detection
    status: pending
    dependencies:
      - install-deps
  - id: state-machine
    content: Create monitoringStateMachine.js with GREEN/YELLOW/AMBIGUOUS/RED states and transition logic
    status: pending
  - id: enhance-screenshot
    content: Enhance screenMonitor.js with adaptive frequency (25s/10s/5s/2.5s) and downscaling
    status: pending
    dependencies:
      - state-machine
  - id: tile-hashing
    content: Create tileHashService.js with xxhash for 50x50 tile change detection
    status: pending
    dependencies:
      - install-deps
      - enhance-screenshot
  - id: macos-ocr
    content: Create macos_ocr.py Python script using Apple Vision framework via PyObjC
    status: pending
  - id: ocr-service
    content: Create ocrService.js with hybrid approach (Apple Vision on macOS, Tesseract.js fallback)
    status: pending
    dependencies:
      - macos-ocr
  - id: reference-processing
    content: Create referenceProcessingService.js to extract text from PDFs, fetch/parse URLs, and process text references for AI context
    status: pending
  - id: reference-storage
    content: Add processed reference content storage (new table or session metadata field) to connection.js
    status: pending
    dependencies:
      - reference-processing
  - id: task-context-service
    content: Create taskContextService.js to load and provide processed task context (references + task details) for AI
    status: pending
    dependencies:
      - reference-storage
  - id: rule-service
    content: Create ruleService.js for optional safety net blocklist (obvious distractions only)
    status: pending
  - id: ai-setup
    content: Set up AI classification (Ollama local or OpenAI API) for distraction detection
    status: pending
  - id: ai-service
    content: Create aiClassificationService.js to classify content as distraction using LLM with task context from processed references
    status: pending
    dependencies:
      - ai-setup
      - task-context-service
  - id: distraction-detector
    content: Create distractionDetector.js orchestrating 4-tier decision (always-blocked → always-allowed → safety net → AI with task context)
    status: pending
    dependencies:
      - session-rules-service
      - rule-service
      - ocr-service
      - ai-service
      - task-context-service
  - id: overlay-service
    content: Create overlayService.js for Electron transparent window with zone-based blocking
    status: pending
    dependencies:
      - window-monitor
  - id: database-schema
    content: Add session_activities and session_statistics tables to connection.js
    status: pending
  - id: activity-repo
    content: Create activityRepository.js for logging monitoring events and state transitions
    status: pending
    dependencies:
      - database-schema
  - id: statistics-repo
    content: Create sessionStatisticsRepository.js for incremental session statistics updates
    status: pending
    dependencies:
      - database-schema
  - id: session-monitor
    content: Create sessionMonitor.js orchestrator coordinating all monitoring services
    status: pending
    dependencies:
      - window-monitor
      - tile-hashing
      - distraction-detector
      - overlay-service
      - activity-repo
  - id: session-integration
    content: Integrate monitoring into sessionService.js (process references on create, start/stop/pause/resume hooks)
    status: pending
    dependencies:
      - session-monitor
      - reference-processing
  - id: ipc-handlers
    content: Add monitoring IPC handlers to main.js (start, stop, get-state, get-activity)
    status: pending
    dependencies:
      - session-integration
  - id: preload-api
    content: Expose monitoring APIs in preload.js for frontend access
    status: pending
    dependencies:
      - ipc-handlers
  - id: testing-optimization
    content: Test all components, optimize performance, handle errors, add documentation
    status: pending
    dependencies:
      - preload-api
---

# FocusAI: AI-Powered Distraction Detection & Blocking System

## Project Overview

Implement a complete monitoring and blocking system that detects distractions during focus sessions using window detection, OCR, and AI classification, then applies zone-based overlay blocking when distractions are detected.

### Key Principle: Task Context Understanding

**Important**: The user provides:

- **Task details**: Task name and description (what they want to accomplish)
- **Reference materials**: PDFs, URLs, and text references related to the task

These references are **NOT an allowlist** - they are materials to help the AI **understand the task context** so it can make better decisions about what content is related to the task versus what is a distraction.

The AI uses processed reference content (extracted text from PDFs, web page content from URLs, and provided text) to understand the task domain and context, enabling context-aware distraction detection.

## Architecture

```
Session Creation
  ↓
Reference Processing (PDFs, URLs, Text) → Store processed content
  ↓
Session Start
  ↓
Window Monitor (continuous)
  ↓
Screenshot Service (adaptive frequency)
  ↓
Tile Hashing (change detection)
  ↓
OCR Service (text extraction)
  ↓
Distraction Detector (AI with task context from processed references)
  ↓
State Machine (GREEN/YELLOW/AMBIGUOUS/RED)
  ↓
Overlay Service (zone-based blocking)
  ↓
Activity Repository (data storage)
```

### Decision Flow

1. **User provides**: Task name, description, reference materials (PDFs, URLs, text)
2. **User optionally provides**: Always-allowed list (e.g., Settings, Spotify, iMessage) and Always-blocked list (e.g., Reddit)
3. **Reference Processing**: Extract and process reference content for AI context
4. **During Monitoring**: Multi-tier decision:

   - **Tier 1**: Check session always-blocked list (fast, explicit block)
   - **Tier 2**: Check session always-allowed list (fast, explicit allow)
   - **Tier 3**: AI uses processed references + task details to determine if current content is task-related or distraction

5. **Decision**: Always-blocked → Always-allowed → AI task context → Default behavior

---

## Phase 0: Reference Material Processing (Day 1)

### 0.1 Install Reference Processing Dependencies

- Install PDF processing: `npm install pdf-parse`
- Install web scraping: `npm install cheerio` (or `jsdom` for DOM parsing)
- Install fetch: Use built-in `fetch` (Node 18+) or `node-fetch` if needed

### 0.2 Reference Processing Service

Create `backend/services/referenceProcessingService.js`:

**Purpose**: Extract and process reference materials (PDFs, URLs, text) to create task context for AI.

**Methods**:

1. **Process PDF References**:

   - Read PDF files from `reference_file_path` (JSON array of file paths)
   - Extract text using `pdf-parse`
   - Extract key concepts, keywords, and summaries
   - Store processed content: `{ type: 'pdf', path, extractedText, keywords, summary }`
   - **Error Handling**: Try-catch around PDF parsing, skip corrupted files, timeout (30s per PDF), handle file not found

2. **Process URL References**:

   - Fetch web pages from `reference_url` (JSON array of URLs)
   - Extract text content using `cheerio` or `jsdom`
   - Remove HTML tags, extract main content
   - Extract key information (title, main text, concepts)
   - Store processed content: `{ type: 'url', url, title, extractedText, keywords, summary }`
   - **Error Handling**: Timeout wrapper (60s per URL), retry failed fetches (max 1 retry), handle network errors, validate URLs (only http/https), skip failed URLs but continue with others

3. **Process Text References**:

   - Use `reference_text` directly (already stored)
   - Extract keywords and key concepts
   - Store processed content: `{ type: 'text', text, keywords, summary }`
   - **Error Handling**: Handle empty/null text, validate text length (max 100KB)

4. **Combine All References**:

   - Aggregate all processed reference content
   - Create unified task context summary
   - Extract domain-specific keywords and concepts
   - Return: `{ taskContext, keywords, referenceSummaries, domain }`
   - **Error Handling**: Handle partial failures (use successful references only), validate combined content

**Performance**:

- Process references in parallel (Promise.all for URLs)
- Limit concurrent URL fetches (max 5 at once)
- Cache processed content (don't re-process unless changed)
- Store results immediately (don't wait for all to complete)

**Storage**:

- Store processed reference content in session metadata or new table
- Cache processed content (don't re-process on every check)
- Update processed content when session references change
- Mark incomplete processing (retry later if needed)

### 0.3 Reference Content Storage

Add to `backend/database/connection.js`:

**Option A**: Add field to `focus_sessions` table:

```sql
ALTER TABLE focus_sessions ADD COLUMN processed_references TEXT;
-- JSON string with processed reference content
```

**Option B**: Create new table `session_reference_content`:

```sql
CREATE TABLE IF NOT EXISTS session_reference_content (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL,
  reference_type TEXT NOT NULL, -- 'pdf', 'url', 'text'
  reference_source TEXT, -- file path, URL, or 'text'
  processed_content TEXT, -- extracted text content
  keywords TEXT, -- JSON array of keywords
  summary TEXT, -- brief summary
  processed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES focus_sessions(id) ON DELETE CASCADE
);
```

### 0.4 Session-Level Always-Allowed/Blocked Lists Storage

Add to `backend/database/connection.js`:

**Option A**: Add fields to `focus_sessions` table:

```sql
ALTER TABLE focus_sessions ADD COLUMN always_allowed TEXT;
-- JSON array: ["Settings", "Spotify", "iMessage", "com.apple.systempreferences"]
ALTER TABLE focus_sessions ADD COLUMN always_blocked TEXT;
-- JSON array: ["Reddit", "reddit.com", "com.reddit"]
```

**Option B**: Create new table `session_rules` (recommended for flexibility):

```sql
CREATE TABLE IF NOT EXISTS session_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL,
  rule_type TEXT NOT NULL, -- 'always_allowed' or 'always_blocked'
  target TEXT NOT NULL, -- App name, domain, or process identifier
  target_type TEXT NOT NULL, -- 'app', 'domain', 'process'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES focus_sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_session_rules_session_id ON session_rules(session_id);
CREATE INDEX IF NOT EXISTS idx_session_rules_type ON session_rules(rule_type);
```

**Examples**:

- Always-allowed: System Settings (`com.apple.systempreferences`), Spotify, iMessage, Calculator
- Always-blocked: Reddit (`reddit.com` or `com.reddit`), Twitter/X, Instagram

**Note**: These work alongside user-level rules from `user_rules` table (if implemented).

### 0.5 Session Rules Repository

Create `backend/database/repositories/sessionRulesRepository.js`:

- Methods: `getRules(sessionId)`, `addRule(sessionId, ruleType, target, targetType)`, `removeRule(ruleId)`, `updateRules(sessionId, rules)`
- Support CRUD operations for session-level rules
- Methods: `getAlwaysAllowed(sessionId)`, `getAlwaysBlocked(sessionId)`

### 0.6 Integration with Session Creation

Modify `backend/services/sessionService.js`:

- After session creation, trigger reference processing
- Store processed reference content
- Initialize session rules (always-allowed/blocked lists)
- Make processed content and rules available to distraction detector

**Testing**: PDFs extract text correctly, URLs fetch and parse content, text references processed, content stored correctly, session rules stored and retrieved correctly.

---

## Phase 1: Foundation & Window Monitoring (Days 1-2)

### 1.1 Install Dependencies

- Install `get-windows`: `npm install get-windows`
- Install `xxhash`: `npm install xxhash`
- Install `tesseract.js`: `npm install tesseract.js`

### 1.2 Window Monitor Service

Create `backend/services/windowMonitor.js`:

- Use `get-windows` to detect active app/window
- Get window bounds (x, y, width, height)
- Detect window focus changes
- Return: `{ appName, windowTitle, bounds, timestamp }`
- Expose: `getActiveWindow()`, `onWindowChange(callback)`

**Error Handling**:

- Try-catch around `get-windows` calls
- Retry with exponential backoff (max 3 retries)
- Fallback to last known window if detection fails
- Validate window bounds (not null, reasonable size)
- Handle permission denied gracefully
- Log errors but continue monitoring

**Performance**:

- Cache window detection result (500ms TTL)
- Debounce rapid window changes (500ms)
- Early return if window unchanged

### 1.3 State Machine

Create `backend/services/monitoringStateMachine.js`:

- States: GREEN, YELLOW, AMBIGUOUS, RED
- State transitions based on decision results
- State persistence (in-memory, cleared on app restart)
- Methods: `getState()`, `transitionTo(newState)`, `getPreviousState()`

**Error Handling**:

- Validate state before transition (must be valid state)
- Use state lock during transition (prevent race conditions)
- Timeout for AMBIGUOUS state (auto-escalate to RED after 15s)
- Reset to GREEN if state corrupted
- Log all state transitions for debugging

**State Persistence**:

- Save state to database on every transition
- Load state from database on app restart
- Clear stale states (> 1 hour old)
- Handle database errors gracefully (continue with in-memory state)

**Performance**:

- In-memory state (fast access)
- Batch database writes (don't write every transition immediately)

### 1.4 Enhanced Screenshot Service

Modify `backend/services/screenMonitor.js`:

- Add adaptive frequency scheduler (25s, 10s, 5s, 2.5s based on state)
- Add screenshot downscaling (reduce to 50% immediately)
- State-based frequency switching
- Keep existing `captureScreen()` method
- Return image buffer, not just file path

**Error Handling**:

- Try-catch around `desktopCapturer` calls
- Retry on failure (max 2 retries)
- Timeout wrapper (5s max per screenshot)
- Fallback to previous screenshot if new capture fails
- Handle permission denied (user-friendly error)
- Continue monitoring with reduced frequency if failures persist

**Performance**:

- Downscale immediately (before any processing)
- Use image buffer (no file I/O unless debugging)
- Limit screenshot buffer (keep last 5 only)
- Skip screenshot if state hasn't changed (GREEN state)
- Async screenshot capture (don't block main thread)

**Optimization**:

- Cache screenshot for 500ms (avoid redundant captures)
- Process screenshots in queue (one at a time)
- Cancel stale screenshots if state changes

### 1.5 Event System

- Window focus change → immediate check
- App switch → immediate screenshot
- State change → log transition
- Use EventEmitter pattern for notifications

**Testing**: Verify window detection, state transitions, and screenshot frequency changes work correctly.

---

## Phase 2: Change Detection & Tile Hashing (Day 2-3)

### 2.1 Tile Hashing Service

Create `backend/services/tileHashService.js`:

- Divide screenshot into 50×50 pixel tiles
- Compute xxhash per tile (or simple mean+variance fallback)
- Store hashes in memory: `Map<tileId, hash>`
- Compare current vs previous hashes
- Track changed tiles
- Clear hashes on GREEN transition

**Error Handling**:

- Try-catch around hashing operations
- Handle invalid image buffer gracefully
- Fallback to simple sum if xxhash fails
- Validate tile count before processing
- Skip hashing if screenshot is null/undefined

**Performance**:

- Use xxhash (fast, ~1-5μs per tile)
- Parallel hashing for multiple tiles (if possible)
- Early exit if no tiles changed (quick comparison)
- Limit hash storage (max 100 screenshots worth)
- Clear hashes immediately on state change

**Optimization**:

- Only hash changed regions (if window bounds known)
- Skip hashing if window unchanged (from window monitor)
- Cache hash computation (avoid re-hashing same tiles)

### 2.2 Hash Management

- Limit memory (max 100 screenshots worth)
- Efficient cleanup on state change
- Performance optimization (< 5ms per screenshot)

### 2.3 Integration

- Integrate with screenshot service
- Pass changed tiles to distraction detector
- Skip unchanged tiles from OCR

**Testing**: Verify changed tile detection, memory usage reasonable, hash clearing works.

---

## Phase 3: OCR & Text Extraction (Day 3-4)

### 3.1 macOS OCR Bridge Setup

Create `backend/scripts/macos_ocr.py`:

- Use Apple Vision framework via PyObjC
- Accept image path as argument
- Return JSON: `{ text, confidence }`
- Install: `pip3 install pyobjc`

### 3.2 OCR Service (Hybrid)

Create `backend/services/ocrService.js`:

- Detect platform (macOS vs others)
- Use Apple Vision on macOS (Python bridge)
- Fallback to Tesseract.js for cross-platform
- Measure performance for both paths
- Methods: `ocr(imageBuffer, region)`, `ocrUrlBar(imageBuffer, browser)`

**Error Handling**:

- Try native OCR first, catch and fallback to Tesseract.js
- Timeout wrapper (10s max per OCR operation)
- Handle Python process failures (Python not installed, PyObjC missing)
- Handle Tesseract.js failures (WASM loading, memory issues)
- Return empty result with low confidence if all OCR fails
- Continue monitoring without OCR if both methods fail
- Cache OCR results temporarily (avoid redundant processing)

**Performance**:

- Downscale image before OCR (50% size)
- Only OCR changed tiles (from tile hashing)
- Limit concurrent OCR operations (max 2 at once)
- Queue OCR requests (don't block monitoring loop)
- Cancel stale OCR if window changes

**Optimization**:

- Skip OCR if not in browser app (use app name only)
- Skip OCR in GREEN state (not needed)
- Cache OCR results per window (avoid re-OCR same content)

### 3.3 URL Bar Detection

- Browser-specific regions:
  - Chrome/Edge: Top 120px × full width
  - Firefox: Top 110px × full width
  - Safari: Top 100px × full width
- Extract region from screenshot
- Handle fullscreen mode (fallback)

### 3.4 Domain Extraction

- Parse OCR text for URLs
- Extract domain (handle edge cases)
- Normalize domains (www, https, etc.)
- Return: `{ domain, url, confidence }`

**Testing**: OCR extracts URLs correctly (>90% accuracy), domain parsing works, performance < 200ms (native) or < 1000ms (Tesseract).

---

## Phase 4: Distraction Detection (Day 4-5)

### 4.1 Session Rules Service

Create `backend/services/sessionRulesService.js`:

**Purpose**: Load and manage session-level always-allowed and always-blocked lists.

**Methods**:

- `getSessionRules(sessionId)`:
  - Load always-allowed and always-blocked lists from database
  - Return: `{ alwaysAllowed: [app/domain list], alwaysBlocked: [app/domain list] }`

- `isAlwaysAllowed(sessionId, appName, domain)`:
  - Check if app or domain is in always-allowed list
  - Match by app name, domain, or process identifier
  - Return: `true/false`

- `isAlwaysBlocked(sessionId, appName, domain)`:
  - Check if app or domain is in always-blocked list
  - Match by app name, domain, or process identifier
  - Return: `true/false`

**Note**: These rules take priority over AI decisions - explicit user preferences.

### 4.2 Context Service (Revised)

Create `backend/services/taskContextService.js`:

**Purpose**: Load and provide task context from processed references for AI decision-making.

**Methods**:

- `getTaskContext(sessionId)`:
  - Load processed reference content from storage
  - Combine with task name, description
  - Create comprehensive task context summary
  - Return: `{ taskName, taskDescription, referenceContent, keywords, domain, contextSummary }`

- `extractKeywords(references)`:
  - Extract domain-specific keywords from all references
  - Identify key concepts related to the task
  - Return array of relevant keywords/concepts

**Note**: This provides context for AI - references are for understanding task, not explicit allowlist.

### 4.2 Safety Net Blocklist (Optional)

Create `backend/services/ruleService.js`:

- Hardcoded blocklist for obvious distractions (YouTube, Instagram, Facebook, etc.)
- Methods: `isInBlocklist(domain)`
- **Purpose**: Fast filtering of obvious distractions before AI check
- **Note**: This is optional - AI can handle most cases, but blocklist provides speed optimization

### 4.2 AI Classification Setup

- **Option A (Recommended)**: Set up Ollama locally
  - Install Ollama
  - Download lightweight model (`llama3.2:1b`)
  - Create API client in Node.js
- **Option B**: Use OpenAI API
  - Set up API key in environment
  - Use `gpt-4o-mini` model

### 4.3 AI Service

Create `backend/services/aiClassificationService.js`:

**Purpose**: Use AI to determine if content is task-related or distraction, using processed reference materials for context.

**Methods**:

- `classifyContent(detectedContent, taskContext)`:
  - Build comprehensive prompt including:
    - Task name and description
    - **Processed reference content** (extracted text from PDFs, URLs, provided text)
    - Keywords and concepts from references
    - Detected content (domain, URL, window title, OCR text)
  - Call LLM (Ollama or OpenAI)
  - Parse response: `{ isDistraction, confidence, reason }`
  - Handle errors gracefully (fallback to default)

**Error Handling**:

- Timeout wrapper (30s max per AI call)
- Retry logic with exponential backoff (max 2 retries)
- Handle network errors (API unavailable, connection lost)
- Handle API errors (rate limit, invalid key, quota exceeded)
- Validate response format before using
- Fallback to default decision if AI fails (treat as DISTRACTION for safety)
- Circuit breaker: Skip AI if failures > 5 consecutive (wait 1 min before retry)

**Performance**:

- Limit concurrent AI calls (max 1 at a time, queue others)
- Cancel stale AI calls if state/window changes
- Cache AI decisions for identical content (5s TTL)
- Truncate prompt if too long (max 4000 tokens)
- Use streaming for faster responses (if supported)

**Optimization**:

- Only call AI if not decided by rules (Tier 1/2/3)
- Skip AI in GREEN state (not needed)
- Batch similar requests if possible

**Prompt Structure**:

```
You are a focus assistant helping a user stay focused on their task.

TASK: {taskName}
DESCRIPTION: {taskDescription}

REFERENCE MATERIALS (for context understanding):
{processedReferenceContent}
- PDFs: {pdfSummaries}
- URLs: {urlSummaries}  
- Text: {textReferences}

KEY CONCEPTS/KEYWORDS: {keywords}

CURRENT CONTENT:
- Domain: {detectedDomain}
- URL: {detectedUrl}
- Title: {windowTitle}
- Visible Text: {ocrText}

Question: Is this current content related to the task or a distraction?

Consider:
- Does it relate to the reference materials provided?
- Does it help with the task described?
- Is it educational/productive content related to the task domain?
- Or is it entertainment/social media/shopping/off-task content?

Answer: YES (distraction) or NO (not distraction, task-related)
Confidence: 0.0-1.0
Reason: Brief explanation
```

**Key Improvement**: AI now has full task context from processed references, enabling better understanding of what's task-related vs distraction.

### 4.4 Distraction Detector

Create `backend/services/distractionDetector.js`:

- Orchestrate: window → screenshot → OCR → decision
- **Tier 1**: Check session always-blocked list (fast, explicit block)
  - If app/domain in always-blocked → **DISTRACTION** (no AI needed)
- **Tier 2**: Check session always-allowed list (fast, explicit allow)
  - If app/domain in always-allowed → **NOT DISTRACTION** (no AI needed)
- **Tier 3**: Optional safety net blocklist (fast filtering of obvious distractions)
  - If obvious distraction (YouTube, Instagram) → **DISTRACTION**
- **Tier 4**: AI classification with task context (primary decision method)
  - Load task context (task details + processed reference content)
  - Build comprehensive context for AI
  - Use AI to determine if content is task-related or distraction
- Return: `{ isDistraction, confidence, detectedDomain, reason, detectionMethod }`

**Error Handling**:

- Try-catch around entire detection flow
- Handle missing OCR results gracefully (fallback to app name only)
- Handle AI failures (timeout, error, invalid response)
- Default to DISTRACTION if all methods fail (safe default)
- Log errors for debugging but continue monitoring
- Circuit breaker pattern: Skip AI if failures > 5 consecutive

**Performance**:

- Early exit after Tier 1/2 (no AI needed if decided)
- Cache task context (don't reload from DB every check)
- Cache session rules (load once, update on change)
- Limit AI calls (one at a time, queue others)
- Cancel stale AI calls if state/window changes

**Decision Flow**:

1. Detect active window/app
2. Extract URL/content via OCR
3. **Check always-blocked list** → If in list, block immediately
4. **Check always-allowed list** → If in list, allow immediately
5. Optional: Check if obvious distraction (safety net blocklist)
6. **Primary**: Load task context from processed references
7. Use AI classification with full task context
8. Make decision based on AI understanding of task relevance

**Key Features**:

- User has explicit control via always-allowed/blocked lists
- AI provides context-aware decisions for everything else
- Priority: Always-blocked > Always-allowed > Safety net > AI context

**Examples**:

- Settings app → Always-allowed → Allowed immediately
- Spotify → Always-allowed → Allowed immediately (user preference)
- iMessage → Always-allowed → Allowed immediately (user preference)
- Reddit → Always-blocked → Blocked immediately (user preference)
- Random website → AI checks task context → Decision based on AI understanding

**Testing**: Detects distractions correctly, AI classification works, performance acceptable.

---

## Phase 5: Overlay Blocking System (Day 5-6)

### 5.1 Overlay Service

Create `backend/services/overlayService.js`:

- Create Electron BrowserWindow (transparent, frameless, alwaysOnTop)
- Position overlay over active window bounds
- Click-through by default (`setIgnoreMouseEvents(true)`)
- Manage lifecycle (create/show/hide/destroy)

**Error Handling**:

- Try-catch around window creation
- Retry overlay creation (max 2 attempts)
- Handle permission denied (screen recording not allowed)
- Detect overlay destruction (window close event)
- Recreate overlay automatically if destroyed unexpectedly
- Fallback to logging-only mode if overlay creation fails persistently

**Performance**:

- Create overlay once, reuse (show/hide, don't recreate)
- Debounce overlay position updates (1s max frequency)
- Batch zone updates (update all zones at once)
- Use CSS transitions (smooth, hardware accelerated)
- Cancel position updates if window changes

**Optimization**:

- Lazy overlay creation (create on first RED state)
- Destroy overlay when not needed (GREEN state for 30+ seconds)
- Optimize overlay rendering (minimal DOM, simple rectangles)

### 5.2 Zone Rendering

- Render dark semi-transparent rectangles (`rgba(0, 0, 0, 0.7)`)
- Support multiple zones per overlay
- Update zones dynamically (DOM manipulation)
- Browser: Block content area only (keep URL bar clickable)
- Other apps: Block entire window

### 5.3 Overlay-State Integration

- Show overlay on RED state
- Hide overlay on YELLOW/GREEN
- Update zones when distraction changes
- Smooth transitions (fade in/out ~100ms)

### 5.4 Window Tracking

- Track overlay position when window moves
- Update overlay bounds periodically (every 1s)
- Handle multiple windows (one overlay per distracting window)

**Testing**: Overlay appears correctly, zones block clicks, URL bar remains clickable, overlay hides when distraction removed.

---

## Phase 6: Data Storage (Day 6)

### 6.1 Database Schema Updates

Modify `backend/database/connection.js`:

- Add `session_activities` table with indexes
- Add `session_statistics` table
- Include all required fields (see detailed schema in plan)

### 6.2 Activity Repository

Create `backend/database/repositories/activityRepository.js`:

- Methods: `logActivity()`, `getSessionActivities()`, `getDistractions()`, `getStateTransitions()`
- Support filtering by type, state, date range
- Cleanup old activities (optional)

### 6.3 Statistics Repository

Create `backend/database/repositories/sessionStatisticsRepository.js`:

- Methods: `initialize()`, `updateStats()`, `getStats()`
- Incremental updates (not recalculated)
- Track time in states, distraction counts, etc.

**Testing**: Activities logged correctly, statistics updated incrementally, queries perform well.

---

## Phase 7: Monitoring Orchestrator (Day 7)

### 7.1 Session Monitor

Create `backend/services/sessionMonitor.js`:

- Orchestrates all services (window monitor, screenshot, OCR, detector, overlay)
- Manages monitoring lifecycle
- Handles state changes
- Coordinates all components

**Error Handling**:

- Wrap entire monitoring loop in try-catch
- Restart monitoring loop on crash (max 3 restarts)
- Use process.on('uncaughtException') for safety net
- Log crash details for debugging
- Graceful shutdown: Stop monitoring, cleanup resources on error
- Handle service initialization failures gracefully

**Performance**:

- Async/await for all I/O operations
- Don't block main thread with synchronous operations
- Use event-driven architecture (EventEmitter pattern)
- Queue operations to prevent overload
- Cancel stale operations when state changes

**Lifecycle Management**:

- Start monitoring on session start
- Stop monitoring on session stop/pause
- Resume monitoring on session resume
- Cleanup all resources on session end
- Handle app shutdown gracefully

### 7.2 Session Integration

Modify `backend/services/sessionService.js`:

- Hook `startSession()` → initialize monitoring
- Hook `stopSession()` → stop monitoring
- Hook `pauseSession()` → pause monitoring
- Hook `resumeSession()` → resume monitoring

### 7.3 IPC Handlers

Modify `main.js`:

- Add `monitoring-start` handler (takes sessionId)
- Add `monitoring-stop` handler
- Add `monitoring-get-state` handler
- Add `monitoring-get-activity` handler

### 7.4 Preload API

Modify `preload.js`:

- Expose `startMonitoring(sessionId)`
- Expose `stopMonitoring()`
- Expose `getMonitoringState()`
- Expose `getMonitoringActivity(sessionId)`

**Testing**: Monitoring starts/stops with session, IPC handlers work, frontend can access APIs.

---

## Phase 8: Error Handling, Crash Recovery & Real-Time Optimization (Day 8)

### 8.1 Comprehensive Error Handling

#### 8.1.1 Window Monitor Error Handling

**Error Scenarios**:

- `get-windows` fails (permission denied, API unavailable)
- Window detection returns null/undefined
- Window bounds are invalid

**Handling**:

- Implement try-catch around window detection calls
- Fallback to last known window if detection fails
- Retry logic with exponential backoff (max 3 retries)
- Log errors but continue monitoring
- Graceful degradation: Assume safe state if detection consistently fails

#### 8.1.2 Screenshot Service Error Handling

**Error Scenarios**:

- `desktopCapturer` fails (permission denied, no sources)
- Screenshot capture times out (> 5s)
- Image processing fails

**Handling**:

- Implement try-catch with retry logic (max 2 retries)
- Timeout wrapper (5s max per screenshot)
- Fallback to previous screenshot if new capture fails
- Continue monitoring with reduced frequency if failures persist
- Clear permission errors with user-friendly messages

#### 8.1.3 OCR Service Error Handling

**Error Scenarios**:

- Python bridge process fails (Python not installed, PyObjC missing)
- Tesseract.js fails (WASM loading error, memory issues)
- OCR times out (> 10s)
- OCR returns empty/invalid text

**Handling**:

- Try native OCR first, catch and fallback to Tesseract.js
- Timeout wrapper (10s max per OCR)
- Return empty result with low confidence if OCR fails
- Continue monitoring without OCR if both methods fail
- Cache OCR results temporarily to avoid redundant processing

#### 8.1.4 AI Classification Error Handling

**Error Scenarios**:

- Ollama API unavailable (process not running, port not available)
- OpenAI API fails (network error, rate limit, API key invalid)
- AI response timeout (> 30s)
- Invalid/malformed AI response
- AI returns ambiguous result

**Handling**:

- Timeout wrapper (30s max per AI call)
- Retry logic with exponential backoff (max 2 retries)
- Fallback to default decision if AI fails (treat as DISTRACTION for safety)
- Validate AI response format before using
- Log AI failures for debugging
- Circuit breaker pattern: Skip AI if failures > 5 consecutive

#### 8.1.5 Overlay Service Error Handling

**Error Scenarios**:

- BrowserWindow creation fails (OS window limit, memory)
- Overlay positioning fails (invalid bounds)
- Overlay window crashes/destroys unexpectedly
- Permission denied (screen recording not allowed)

**Handling**:

- Try-catch around window creation
- Retry overlay creation (max 2 attempts)
- Fallback to logging-only mode if overlay fails
- Recreate overlay on crash (listener for window close event)
- Graceful degradation: Continue monitoring without overlay

#### 8.1.6 Reference Processing Error Handling

**Error Scenarios**:

- PDF parsing fails (corrupted file, unsupported format)
- URL fetch fails (network error, timeout, 404)
- Cheerio parsing fails (malformed HTML)
- Processing timeout (> 60s per URL)

**Handling**:

- Try-catch around each reference type
- Timeout wrapper (60s per URL, 30s per PDF)
- Skip failed references, continue with successful ones
- Retry URL fetches (max 1 retry)
- Store partial results (mark as incomplete)
- Continue monitoring even if some references fail

#### 8.1.7 Database Error Handling

**Error Scenarios**:

- Database locked (concurrent writes)
- Connection lost
- Disk full
- Invalid SQL

**Handling**:

- Implement connection pooling/queue for writes
- Retry database operations with exponential backoff
- Batch writes to reduce lock contention
- Validate data before database operations
- Graceful degradation: Continue monitoring, queue writes for later
- Periodic retry of failed writes

### 8.2 Crash Recovery & State Persistence

#### 8.2.1 Session State Persistence

**Scenarios**:

- App crashes during active session
- System shutdown/restart
- Electron process killed

**Recovery**:

- Persist monitoring state to database on state changes
- Store active session ID, current state, last check timestamp
- On app restart, check for active sessions in database
- Resume monitoring if session was active
- Clear stale states (> 1 hour old)

#### 8.2.2 Overlay Recovery

**Scenarios**:

- Overlay window destroyed unexpectedly
- Overlay position desynchronized

**Recovery**:

- Detect overlay destruction (window close event)
- Recreate overlay immediately if session still active
- Re-sync overlay position with window bounds on recreation
- Periodic position validation (every 5s)

#### 8.2.3 Monitoring Loop Recovery

**Scenarios**:

- Monitoring loop crashes (unhandled exception)
- Timer/interval stops

**Recovery**:

- Wrap monitoring loop in try-catch
- Restart monitoring loop on crash (max 3 restarts)
- Use process.on('uncaughtException') for safety net
- Log crash details for debugging
- Graceful shutdown: Stop monitoring, cleanup resources

### 8.3 Real-Time Performance Optimization

#### 8.3.1 Async Operations

**Optimizations**:

- Make all I/O operations async (screenshots, OCR, AI, DB)
- Use Promise.all for parallel operations where possible
- Don't block main thread with synchronous operations
- Use worker threads for heavy OCR/AI processing (if needed)

#### 8.3.2 Caching & Memoization

**Caching Strategy**:

- Cache processed reference content (don't re-process)
- Cache task context (don't reload from DB every check)
- Cache session rules (load once, update on change)
- Cache window detection results (short TTL: 500ms)
- Cache AI decisions for identical content (short TTL: 5s)

#### 8.3.3 Request Debouncing & Throttling

**Optimizations**:

- Debounce window focus changes (500ms delay)
- Throttle screenshot frequency (max 1 per state interval)
- Debounce overlay position updates (1s max frequency)
- Batch database writes (queue, flush every 5s)

#### 8.3.4 Early Exit Strategies

**Optimizations**:

- Check always-blocked/allowed lists BEFORE OCR/AI
- Skip OCR if not in browser app (use app name only)
- Skip tile hashing if window unchanged
- Skip AI if already decided by rules
- Early return on GREEN state (skip expensive checks)

#### 8.3.5 Resource Management

**Optimizations**:

- Limit concurrent OCR operations (max 2 at once)
- Limit concurrent AI calls (max 1 at once, queue others)
- Limit screenshot buffer size (keep last 5 only)
- Cleanup old tile hashes periodically
- Close overlay when not needed (not just hide)

#### 8.3.6 Performance Monitoring

**Metrics to Track**:

- Window detection latency (target < 10ms)
- Screenshot capture latency (target < 100ms)
- OCR latency (target < 200ms native, < 1000ms Tesseract)
- AI classification latency (target < 500ms)
- Total decision time (target < 1s YELLOW, < 500ms RED)

**Implementation**:

- Add timing logs for each operation
- Track performance in statistics table
- Alert if performance degrades significantly

### 8.4 Edge Cases & Loopholes

#### 8.4.1 Window Detection Edge Cases

**Cases**:

- Fullscreen apps (games, videos) - window bounds may be wrong
- Multiple monitors - overlay on wrong screen
- Minimized windows - don't block
- Window switches rapidly - debounce detection

**Handling**:

- Validate window bounds (not off-screen, reasonable size)
- Detect fullscreen mode (fullscreen API or bounds = screen)
- Check monitor bounds before overlay positioning
- Skip detection for minimized windows
- Debounce rapid window switches

#### 8.4.2 OCR Edge Cases

**Cases**:

- URL bar not visible (fullscreen browser)
- URL bar scrolled out of view
- Multiple browser tabs - wrong tab detected
- Dark mode/light mode - OCR accuracy varies

**Handling**:

- Fallback to window title if URL bar OCR fails
- Try content area OCR if URL bar fails
- Detect browser tab context (if possible)
- Normalize image contrast before OCR
- Cache OCR results per window

#### 8.4.3 AI Classification Edge Cases

**Cases**:

- AI returns low confidence - what to do?
- AI response malformed - can't parse
- Network timeout during AI call
- Rate limiting from API

**Handling**:

- Default to DISTRACTION if confidence < 0.7
- Validate response format before using
- Fallback to safety net blocklist if AI timeout
- Implement rate limiting client-side
- Queue AI requests if rate limited

#### 8.4.4 Overlay Edge Cases

**Cases**:

- Overlay appears behind target window (z-order)
- Overlay doesn't cover entire window (multi-monitor)
- User switches monitors - overlay on wrong screen
- Overlay flickers (rapid show/hide)

**Handling**:

- Ensure alwaysOnTop: true, skipTaskbar: true
- Track all monitors, position overlay correctly
- Re-position overlay on monitor change event
- Debounce overlay show/hide transitions

#### 8.4.5 State Machine Edge Cases

**Cases**:

- State transition happens during AI call
- State gets corrupted (invalid state value)
- State machine stuck in AMBIGUOUS

**Handling**:

- Use state lock during transition
- Validate state before transition
- Timeout for AMBIGUOUS state (auto-escalate after 15s)
- Reset state to GREEN on corruption

#### 8.4.6 Race Conditions

**Potential Issues**:

- Multiple screenshots processed simultaneously
- Overlay updated while window moves
- State changed while decision in progress

**Handling**:

- Queue screenshot processing (one at a time)
- Lock overlay updates during position change
- Use atomic state transitions
- Cancel stale AI calls when state changes

### 8.5 Permission & Security Handling

#### 8.5.1 macOS Permissions

**Required Permissions**:

- Screen Recording (for screenshots)
- Accessibility (for window detection, potentially)
- Network (for URL fetching, AI API)

**Handling**:

- Check permissions on startup
- Request permissions gracefully
- Show user-friendly error if denied
- Degrade gracefully (disable monitoring if no permission)
- Periodic permission check (retry if user grants)

#### 8.5.2 Security Considerations

**Safeguards**:

- Sanitize all user inputs (URLs, app names)
- Validate file paths (prevent directory traversal)
- Limit reference URL fetching (whitelist protocols: http, https)
- Timeout all external requests
- Rate limit AI API calls
- Don't log sensitive data (URLs with auth tokens)

### 8.6 Resource Cleanup

#### 8.6.1 Memory Management

**Cleanup**:

- Clear tile hashes on state change to GREEN
- Limit screenshot buffer (max 5 screenshots)
- Clear OCR cache after 1 hour
- Cleanup old database entries (30+ days)
- Release overlay window on session end

#### 8.6.2 Process Cleanup

**Cleanup**:

- Stop all timers on session stop
- Close overlay window on session end
- Clear event listeners on cleanup
- Release database connections
- Kill OCR Python processes on shutdown

### 8.7 Testing & Validation

#### 8.7.1 Error Scenario Testing

- Test with no screen recording permission
- Test with Python not installed
- Test with AI API down
- Test with database locked
- Test with corrupted PDF files
- Test with invalid URLs
- Test with overlay creation failure

#### 8.7.2 Performance Testing

- Test with rapid window switching
- Test with multiple concurrent sessions (shouldn't happen, but handle)
- Test with large PDF files (50MB+)
- Test with many reference URLs (20+)
- Test with slow AI responses (> 5s)

#### 8.7.3 Edge Case Testing

- Fullscreen apps
- Minimized windows
- Multiple monitors
- Dark mode/light mode
- Rapid state changes
- App crash during monitoring

**Testing**: System handles all errors gracefully, recovers from crashes, performs efficiently in real-time.

---

## System Design Optimizations for Real-Time Performance

### Design Principles

1. **Fast-First Architecture**: Check fastest methods first (always-blocked → always-allowed → blocklist → AI)
2. **Early Exit Strategies**: Skip expensive operations if decision already made
3. **Async Everything**: All I/O operations async, don't block main thread
4. **Caching**: Cache everything that doesn't change frequently
5. **Debouncing/Throttling**: Prevent rapid-fire operations
6. **Resource Limits**: Limit concurrent operations, memory usage
7. **Graceful Degradation**: System continues working even if some components fail

### Performance Architecture

```
Decision Flow (Optimized):
1. Window detection (< 10ms) → Early exit if app safe
2. Always-blocked check (< 1ms) → Fast block
3. Always-allowed check (< 1ms) → Fast allow
4. Safety net blocklist (< 1ms) → Fast block
5. OCR only if needed (< 200ms native) → Extract content
6. AI only if ambiguous (< 500ms) → Final decision

Total: < 10ms (most cases), < 1s (with AI)
```

### Resource Management

- **Memory**: Limit tile hashes (max 100 screenshots), screenshot buffer (max 5), OCR cache (clear after 1h)
- **CPU**: Limit concurrent OCR (max 2), AI calls (max 1), parallel processing where safe
- **Network**: Limit concurrent URL fetches (max 5), timeout all requests (30-60s)
- **Database**: Batch writes (queue, flush every 5s), use prepared statements, index properly

### Configuration Options

Add configuration for fine-tuning:

```javascript
// config/monitoringConfig.js
{
  // Screenshot frequencies (seconds)
  screenshotFrequencies: {
    GREEN: 25,
    YELLOW: 10,
    AMBIGUOUS: 5,
    RED: 2.5
  },
  
  // Timeouts (milliseconds)
  timeouts: {
    screenshot: 5000,
    ocr: 10000,
    ai: 30000,
    urlFetch: 60000,
    pdfProcessing: 30000
  },
  
  // Retry attempts
  retries: {
    screenshot: 2,
    ocr: 1,
    ai: 2,
    urlFetch: 1
  },
  
  // Limits
  limits: {
    maxConcurrentOCR: 2,
    maxConcurrentAI: 1,
    maxConcurrentURLs: 5,
    maxTileHashStorage: 100,
    maxScreenshotBuffer: 5,
    maxOCRCacheTime: 3600000 // 1 hour
  },
  
  // Circuit breakers
  circuitBreaker: {
    aiFailureThreshold: 5,
    aiRetryAfter: 60000 // 1 minute
  }
}
```

### Monitoring & Alerting

**Health Checks**:

- Monitor monitoring loop health (check every 10s)
- Alert if loop crashes > 3 times in 1 minute
- Monitor overlay status (detect if destroyed)
- Monitor AI service health (success rate, latency)
- Monitor database connectivity

**Performance Metrics**:

- Track average decision time per state
- Track OCR accuracy (compare with expected)
- Track AI response time
- Track error rates per component
- Alert if performance degrades significantly

### Additional Safeguards

**Race Condition Prevention**:

- Use state locks during transitions
- Queue screenshot processing (one at a time)
- Lock overlay updates during position changes
- Atomic database operations
- Cancel stale operations when state changes

**Data Validation**:

- Validate all user inputs (URLs, app names, file paths)
- Sanitize URLs (only http/https, no file://)
- Validate file paths (prevent directory traversal)
- Validate database data before storing
- Validate AI responses before using

**Security**:

- Don't log sensitive data (URLs with auth tokens, passwords)
- Sanitize OCR text before logging
- Rate limit external requests
- Timeout all external requests
- Validate all external inputs

---

## File Structure

### New Files

```
backend/services/
├── referenceProcessingService.js (NEW - Phase 0)
├── sessionRulesService.js (NEW - Phase 4)
├── taskContextService.js (NEW - Phase 4)
├── windowMonitor.js
├── monitoringStateMachine.js
├── tileHashService.js
├── ocrService.js
├── ruleService.js (optional safety net blocklist)
├── aiClassificationService.js
├── distractionDetector.js
├── overlayService.js
└── sessionMonitor.js

backend/database/repositories/
├── sessionRulesRepository.js (NEW - Phase 4)
├── activityRepository.js
└── sessionStatisticsRepository.js

backend/scripts/
└── macos_ocr.py

backend/database/repositories/
├── activityRepository.js
└── sessionStatisticsRepository.js
```

### Modified Files

```
backend/services/
├── screenMonitor.js (enhanced)
└── sessionService.js (add monitoring hooks)

backend/database/
└── connection.js (add tables)

main.js (add IPC handlers)
preload.js (expose APIs)
package.json (add dependencies)
```

---

## Dependencies

### NPM Packages

```json
{
  "dependencies": {
    "get-windows": "^4.0.0",
    "xxhash": "^0.4.4",
    "tesseract.js": "^4.1.1",
    "pdf-parse": "^1.1.1",
    "cheerio": "^1.0.0-rc.12"
  }
}
```

### Python (macOS OCR)

```bash
pip3 install pyobjc
```

### Optional (AI)

- Ollama (local LLM) OR
- OpenAI API key (cloud LLM)

---

## Success Metrics

### Performance Targets

- **Detection Time**: < 1s (YELLOW), < 500ms (RED), < 10ms (GREEN with early exit)
- **OCR Accuracy**: > 90% for URL bars
- **OCR Latency**: < 200ms (native), < 1000ms (Tesseract fallback)
- **AI Latency**: < 500ms (local), < 1000ms (cloud)
- **CPU Usage**: < 5% when idle (GREEN), < 15% during monitoring (RED)
- **Memory Usage**: < 200MB total, < 50MB for tile hashes
- **False Positives**: < 5%
- **False Negatives**: < 10%

### Reliability Targets

- **Error Rate**: < 1% per monitoring cycle
- **Crash Recovery**: < 5s recovery time
- **Uptime**: > 99% during active sessions
- **State Consistency**: 100% (no corrupted states)

### Operational Targets

- **Screenshot Success Rate**: > 95%
- **OCR Success Rate**: > 90%
- **AI Success Rate**: > 85%
- **Overlay Success Rate**: > 98%

---

## Implementation Checklist

### Pre-Implementation

- [ ] Review all dependencies (versions, compatibility)
- [ ] Set up development environment
- [ ] Test Python OCR bridge on target macOS
- [ ] Test get-windows on target macOS
- [ ] Set up AI service (Ollama or OpenAI)

### Phase-by-Phase Testing

- [ ] Phase 0: Test PDF parsing, URL fetching, text processing
- [ ] Phase 1: Test window detection, state machine, screenshot service
- [ ] Phase 2: Test tile hashing, change detection
- [ ] Phase 3: Test OCR (native and fallback), domain extraction
- [ ] Phase 4: Test rule checking, AI classification, distraction detection
- [ ] Phase 5: Test overlay creation, positioning, blocking
- [ ] Phase 6: Test data storage, activity logging, statistics
- [ ] Phase 7: Test session integration, IPC handlers, preload APIs
- [ ] Phase 8: Test error handling, crash recovery, performance

### Final Validation

- [ ] End-to-end test (session creation → monitoring → blocking → storage)
- [ ] Error scenario testing (all error paths)
- [ ] Performance testing (under load)
- [ ] Edge case testing (all identified edge cases)
- [ ] Security testing (input validation, sanitization)
- [ ] Documentation review (all services documented)

---

## Plan Summary & Key Improvements

### ✅ Error Handling Coverage

**Every service now has**:

- Try-catch blocks around critical operations
- Retry logic with exponential backoff
- Timeout wrappers for all async operations
- Fallback mechanisms when failures occur
- Graceful degradation (continue monitoring even if component fails)
- Error logging for debugging

**Critical Paths Protected**:

- Window detection failures → Fallback to last known window
- Screenshot failures → Retry, fallback to previous screenshot
- OCR failures → Fallback between native and Tesseract.js
- AI failures → Circuit breaker, default to safe decision
- Overlay failures → Log-only mode, recreate on crash
- Database failures → Queue writes, retry later
- Reference processing failures → Use successful references only

### ✅ Crash Recovery & State Persistence

**Recovery Mechanisms**:

- Session state persisted to database on every transition
- Active session recovery on app restart
- Overlay recreation on unexpected destruction
- Monitoring loop restart on crash (max 3 restarts)
- Cleanup of stale states (> 1 hour old)

**State Management**:

- State locks to prevent race conditions
- State validation before transitions
- Timeout for AMBIGUOUS state (auto-escalate after 15s)
- State corruption detection and recovery

### ✅ Real-Time Performance Optimizations

**Fast-First Architecture**:

- Tier 1: Always-blocked check (< 1ms) → Fast block
- Tier 2: Always-allowed check (< 1ms) → Fast allow
- Tier 3: Safety net blocklist (< 1ms) → Fast block
- Tier 4: AI classification (< 500ms) → Context-aware decision

**Early Exit Strategies**:

- Skip OCR if not in browser app
- Skip tile hashing if window unchanged
- Skip AI if already decided by rules
- Skip expensive checks in GREEN state

**Caching & Memoization**:

- Cache window detection (500ms TTL)
- Cache task context (don't reload from DB)
- Cache session rules (load once, update on change)
- Cache OCR results (per window)
- Cache AI decisions (5s TTL for identical content)

**Async Operations**:

- All I/O operations are async
- Promise.all for parallel operations
- Worker threads for heavy processing (if needed)
- Don't block main thread

**Resource Management**:

- Limit concurrent OCR (max 2)
- Limit concurrent AI calls (max 1, queue others)
- Limit URL fetches (max 5 parallel)
- Limit screenshot buffer (max 5)
- Limit tile hash storage (max 100 screenshots)

### ✅ Edge Cases Covered

**Window Detection**:

- Fullscreen apps (validate bounds, detect fullscreen mode)
- Multiple monitors (check monitor bounds)
- Minimized windows (skip detection)
- Rapid window switching (debounce 500ms)

**OCR**:

- URL bar not visible (fallback to window title)
- Multiple browser tabs (use window title as backup)
- Dark mode/light mode (normalize contrast)
- OCR timeout (10s max)

**AI Classification**:

- Low confidence (< 0.7) → Default to DISTRACTION
- Invalid response → Validate format before using
- Network timeout → Fallback to safety net blocklist
- Rate limiting → Queue requests, retry later

**Overlay**:

- Z-order issues (ensure alwaysOnTop: true)
- Multi-monitor (track all monitors, position correctly)
- Window movement (debounce position updates)
- Overlay flicker (debounce show/hide transitions)

### ✅ Security & Validation

**Input Validation**:

- Sanitize all user inputs (URLs, app names, file paths)
- Validate URLs (only http/https, no file://)
- Validate file paths (prevent directory traversal)
- Validate database data before storing

**Data Security**:

- Don't log sensitive data (auth tokens in URLs)
- Sanitize OCR text before logging
- Rate limit external requests
- Timeout all external requests

### ✅ Performance Targets

**Detection Times**:

- GREEN state (early exit): < 10ms
- YELLOW state (with OCR): < 1s
- RED state (with AI): < 500ms

**Resource Usage**:

- CPU: < 5% idle (GREEN), < 15% active (RED)
- Memory: < 200MB total
- Database: Batched writes (queue, flush every 5s)

**Reliability**:

- Error rate: < 1% per monitoring cycle
- Crash recovery: < 5s
- Uptime: > 99% during active sessions

### ✅ Missing Dependencies Identified

**Additional NPM Packages Needed**:

- Consider adding `node-fetch` if Node < 18 (for fetch API)
- Consider adding `sharp` for image processing optimization
- Consider adding `p-limit` for concurrency control

**Python Dependencies**:

- `pyobjc` for macOS OCR (required)
- Python 3.7+ required

**Optional Dependencies**:

- `ollama` package for local LLM (if using Ollama)
- `openai` package for cloud LLM (if using OpenAI)

### ✅ Implementation Readiness

**Plan is now complete with**:

- ✅ Comprehensive error handling for all services
- ✅ Crash recovery mechanisms
- ✅ State persistence
- ✅ Real-time performance optimizations
- ✅ Edge case coverage
- ✅ Security safeguards
- ✅ Resource management
- ✅ Testing strategies
- ✅ Performance targets
- ✅ Configuration options

**Ready for implementation** - All phases include error handling, performance optimization, and edge case coverage.

---

## Notes

- This plan prioritizes **real-time performance** with fast-first architecture
- All services have **comprehensive error handling** and graceful degradation
- System **recovers from crashes** and persists state
- **Edge cases** are identified and handled
- **Security** and **validation** are built-in
- Plan is **optimized for production** use