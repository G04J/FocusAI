# Next Steps: Activating the Monitoring System

All code has been implemented! Here's what you need to do to get it running:

## Step 1: Install Dependencies

First, install all required npm packages:

```bash
npm install get-windows xxhash tesseract.js pdf-parse cheerio sharp
```

**Optional (for macOS OCR):**
```bash
pip3 install pyobjc
```

## Step 2: Choose Your AI Provider

You have two options:

### Option A: Ollama (Local, Free, Recommended for Privacy)
1. Install Ollama: https://ollama.ai
2. Pull a model: `ollama pull llama3.2:1b`
3. Make sure Ollama is running: `ollama serve`

### Option B: OpenAI (Cloud, Paid, Faster)
1. Get API key from https://platform.openai.com
2. Set environment variable: `export OPENAI_API_KEY=your-key-here`

## Step 3: Initialize Monitoring Services in main.js

You need to add the monitoring service initialization. Add this to `main.js` in the `app.whenReady()` section, after line 52:

```javascript
// Import monitoring services
const ReferenceRepository = require('./backend/database/repositories/referenceRepository');
const SessionRulesRepository = require('./backend/database/repositories/sessionRulesRepository');
const ActivityRepository = require('./backend/database/repositories/activityRepository');
const SessionStatisticsRepository = require('./backend/database/repositories/sessionStatisticsRepository');

const ReferenceProcessingService = require('./backend/services/referenceProcessingService');
const SessionRulesService = require('./backend/services/sessionRulesService');
const TaskContextService = require('./backend/services/taskContextService');
const WindowMonitor = require('./backend/services/windowMonitor');
const MonitoringStateMachine = require('./backend/services/monitoringStateMachine');
const ScreenMonitor = require('./backend/services/screenMonitor').ScreenMonitor;
const TileHashService = require('./backend/services/tileHashService');
const OCRService = require('./backend/services/ocrService');
const RuleService = require('./backend/services/ruleService');
const AIClassificationService = require('./backend/services/aiClassificationService');
const DistractionDetector = require('./backend/services/distractionDetector');
const OverlayService = require('./backend/services/overlayService');
const SessionMonitor = require('./backend/services/sessionMonitor');

// ... existing code ...

let sessionMonitor;

app.whenReady().then(() => {
  createWindow();
  
  // Initialize backend services
  console.log('Initializing backend...');
  database = new DatabaseConnection();
  const db = database.getConnection();
  
  userRepository = new UserRepository(db);
  sessionRepository = new SessionRepository(db);
  
  // Initialize repositories
  const referenceRepository = new ReferenceRepository(db);
  const sessionRulesRepository = new SessionRulesRepository(db);
  const activityRepository = new ActivityRepository(db);
  const statisticsRepository = new SessionStatisticsRepository(db);
  
  // Initialize services
  const referenceProcessingService = new ReferenceProcessingService(referenceRepository);
  const sessionRulesService = new SessionRulesService(sessionRulesRepository);
  const taskContextService = new TaskContextService(referenceRepository, sessionRepository);
  
  // Initialize monitoring services
  const windowMonitor = new WindowMonitor();
  const stateMachine = new MonitoringStateMachine();
  const screenMonitor = new ScreenMonitor(stateMachine);
  const tileHashService = new TileHashService();
  const ocrService = new OCRService();
  const ruleService = new RuleService();
  
  // Configure AI service (choose one)
  // Option A: Ollama (default)
  const aiService = new AIClassificationService({
    provider: 'ollama',
    model: 'llama3.2:1b',
    baseURL: 'http://localhost:11434'
  });
  
  // Option B: OpenAI (uncomment and set API key)
  // const aiService = new AIClassificationService({
  //   provider: 'openai',
  //   model: 'gpt-4o-mini',
  //   apiKey: process.env.OPENAI_API_KEY
  // });
  
  const distractionDetector = new DistractionDetector(
    sessionRulesService,
    ruleService,
    ocrService,
    aiService,
    taskContextService
  );
  
  const overlayService = new OverlayService();
  
  // Create session monitor
  sessionMonitor = new SessionMonitor(
    windowMonitor,
    screenMonitor,
    tileHashService,
    ocrService,
    distractionDetector,
    overlayService,
    stateMachine,
    activityRepository,
    statisticsRepository
  );
  
  // Update session service with monitoring
  sessionService = new SessionService(
    sessionRepository,
    referenceProcessingService,
    sessionMonitor
  );
  
  authService = new AuthService(userRepository);
  
  console.log('✓ FocusAI ready');
  console.log('✓ All services initialized');
});
```

## Step 4: Update IPC Handlers

Replace the TODO handlers in `main.js` with actual implementations:

```javascript
ipcMain.handle('monitoring-start', async (event, sessionId) => {
  console.log('IPC: monitoring-start called', { sessionId });
  try {
    if (!sessionMonitor) {
      return { success: false, error: 'Monitoring service not initialized' };
    }
    await sessionMonitor.start(sessionId);
    return { success: true, message: 'Monitoring started' };
  } catch (error) {
    console.error('IPC: monitoring-start error', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('monitoring-stop', async (event) => {
  console.log('IPC: monitoring-stop called');
  try {
    if (!sessionMonitor) {
      return { success: false, error: 'Monitoring service not initialized' };
    }
    sessionMonitor.stop();
    return { success: true, message: 'Monitoring stopped' };
  } catch (error) {
    console.error('IPC: monitoring-stop error', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('monitoring-get-state', async (event) => {
  try {
    if (!sessionMonitor) {
      return { success: false, error: 'Monitoring service not initialized' };
    }
    const state = sessionMonitor.getState();
    return { success: true, state: state };
  } catch (error) {
    console.error('IPC: monitoring-get-state error', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('monitoring-get-activity', async (event, sessionId) => {
  try {
    if (!sessionMonitor) {
      return { success: false, error: 'Monitoring service not initialized' };
    }
    const activity = sessionMonitor.getActivity(sessionId);
    return { success: true, activity: activity };
  } catch (error) {
    console.error('IPC: monitoring-get-activity error', error);
    return { success: false, error: error.message };
  }
});
```

## Step 5: Test the System

1. **Start the app:**
   ```bash
   npm start
   ```

2. **Grant permissions (macOS):**
   - Screen Recording permission (System Preferences → Security & Privacy)
   - Accessibility permission (if needed for window detection)

3. **Test basic flow:**
   - Create a session with reference materials
   - Start the session
   - Monitor should automatically start
   - Check console logs for any errors

## Step 6: Verify Everything Works

Check the console for:
- ✓ "Database connected"
- ✓ "All services initialized"
- ✓ "Monitoring started" (when you start a session)

Test features:
- ✅ Window detection works
- ✅ Screenshots are captured
- ✅ OCR extracts URLs
- ✅ Distraction detection triggers
- ✅ Overlay appears when distraction detected

## Common Issues & Fixes

### Issue: "Monitoring service not initialized"
**Fix:** Make sure you completed Step 3 and initialized `sessionMonitor`

### Issue: OCR not working
**Fix:** 
- Install PyObjC: `pip3 install pyobjc`
- Or make sure Tesseract.js works (fallback)

### Issue: AI classification fails
**Fix:**
- Check Ollama is running: `ollama serve`
- Or set OpenAI API key correctly
- Check console for specific error messages

### Issue: Window detection fails
**Fix:**
- Install get-windows: `npm install get-windows`
- Check permissions on macOS
- Try running with admin/sudo (not recommended for production)

## Next: Integration Testing

Once basic functionality works:
1. Test with different apps (browsers, VSCode, etc.)
2. Test with different reference materials
3. Verify overlay blocking works
4. Check activity logs in database
5. Review statistics in database

## Important Notes

- **Database**: Tables will be auto-created on first run
- **Performance**: First OCR/AI calls may be slow (cache improves this)
- **Privacy**: All processing is local (except if using OpenAI)
- **Permissions**: macOS requires explicit permissions for screen capture

---

**Ready to proceed?** Start with Step 1 (install dependencies) and work through each step systematically!
