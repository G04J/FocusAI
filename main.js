const { app, BrowserWindow, ipcMain } = require('electron');
app.commandLine.appendSwitch('disable-features', 'Autofill')
const fs = require('fs');

const path = require('path');

// Import backend modules
const DatabaseConnection = require('./backend/database/connection');
const UserRepository = require('./backend/database/repositories/userRepository');
const SessionRepository = require('./backend/database/repositories/sessionRepository');
const AuthService = require('./backend/services/authService');
const SessionService = require('./backend/services/sessionService');

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
const OllamaManager = require('./backend/services/ollamaManager');

let mainWindow;
let database;
let userRepository;
let sessionRepository;
let authService;
let sessionService;
let sessionMonitor;
let ollamaManager;

function createWindow() {
  // In your BrowserWindow creation
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: true, // Keep this true
      allowRunningInsecureContent: false
    }
  });

  // Important: Load with proper protocol
  mainWindow.loadFile('frontend/pages/auth.html');
  mainWindow.webContents.openDevTools();
}

app.whenReady().then(async () => {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/cd85e294-0bef-430a-902e-994341727018',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'main.js:63',message:'app.whenReady started',data:{timestamp:Date.now()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  createWindow();
  
  // Initialize backend services
  console.log('Initializing backend...');
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/cd85e294-0bef-430a-902e-994341727018',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'main.js:68',message:'Before database init',data:{authServiceExists:typeof authService !== 'undefined'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
  // #endregion
  let db;
  try {
    database = new DatabaseConnection();
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/cd85e294-0bef-430a-902e-994341727018',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'main.js:70',message:'Database init succeeded',data:{databaseExists:typeof database !== 'undefined'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    db = database.getConnection();
    
    userRepository = new UserRepository(db);
    sessionRepository = new SessionRepository(db);
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/cd85e294-0bef-430a-902e-994341727018',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'main.js:75',message:'Before authService creation',data:{userRepoExists:typeof userRepository !== 'undefined'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    
    authService = new AuthService(userRepository);
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/cd85e294-0bef-430a-902e-994341727018',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'main.js:78',message:'authService created',data:{authServiceExists:typeof authService !== 'undefined',hasSignup:typeof authService?.signup === 'function'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
  } catch (error) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/cd85e294-0bef-430a-902e-994341727018',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'main.js:80',message:'Database/authService init error',data:{error:error.message,stack:error.stack},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    console.error('Initialization error:', error);
    throw error;
  }
  
  // Initialize repositories
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/cd85e294-0bef-430a-902e-994341727018',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'main.js:99',message:'Before repositories init',data:{timestamp:Date.now()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
  // #endregion
  let referenceRepository, sessionRulesRepository, activityRepository, statisticsRepository;
  try {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/cd85e294-0bef-430a-902e-994341727018',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'main.js:105',message:'Creating ReferenceRepository',data:{timestamp:Date.now()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
    // #endregion
    referenceRepository = new ReferenceRepository(db);
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/cd85e294-0bef-430a-902e-994341727018',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'main.js:108',message:'Creating SessionRulesRepository',data:{timestamp:Date.now()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
    // #endregion
    sessionRulesRepository = new SessionRulesRepository(db);
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/cd85e294-0bef-430a-902e-994341727018',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'main.js:111',message:'Creating ActivityRepository',data:{timestamp:Date.now()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
    // #endregion
    activityRepository = new ActivityRepository(db);
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/cd85e294-0bef-430a-902e-994341727018',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'main.js:114',message:'Creating SessionStatisticsRepository',data:{timestamp:Date.now()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
    // #endregion
    statisticsRepository = new SessionStatisticsRepository(db);
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/cd85e294-0bef-430a-902e-994341727018',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'main.js:117',message:'All repositories created',data:{timestamp:Date.now()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
    // #endregion
  } catch (error) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/cd85e294-0bef-430a-902e-994341727018',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'main.js:120',message:'Repository creation error',data:{error:error.message,stack:error.stack},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
    // #endregion
    console.error('Repository initialization error:', error);
    throw error;
  }
  
  // Initialize services
  let referenceProcessingService, sessionRulesService, taskContextService;
  try {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/cd85e294-0bef-430a-902e-994341727018',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'main.js:128',message:'Before services init',data:{timestamp:Date.now()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
    // #endregion
    referenceProcessingService = new ReferenceProcessingService(referenceRepository);
    sessionRulesService = new SessionRulesService(sessionRulesRepository);
    taskContextService = new TaskContextService(referenceRepository, sessionRepository);
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/cd85e294-0bef-430a-902e-994341727018',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'main.js:133',message:'All services created',data:{timestamp:Date.now()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
    // #endregion
  } catch (error) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/cd85e294-0bef-430a-902e-994341727018',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'main.js:136',message:'Service creation error',data:{error:error.message,stack:error.stack},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
    // #endregion
    console.error('Service initialization error:', error);
    throw error;
  }
  
  // Initialize Ollama Manager (automatic setup)
  console.log('Initializing Ollama Manager...');
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/cd85e294-0bef-430a-902e-994341727018',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'main.js:112',message:'Before Ollama init',data:{timestamp:Date.now()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
  // #endregion
  ollamaManager = new OllamaManager({
    model: 'llama3.2:1b',
    baseURL: 'http://localhost:11434'
  });
  
  // Initialize Ollama in background (don't block app startup)
  ollamaManager.initialize().catch(error => {
    console.warn('Ollama initialization warning:', error.message);
    console.log('App will continue with fallback AI mode');
  });
  
  // Initialize monitoring services
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/cd85e294-0bef-430a-902e-994341727018',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'main.js:124',message:'Before monitoring services init',data:{timestamp:Date.now()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
  // #endregion
  const windowMonitor = new WindowMonitor();
  const stateMachine = new MonitoringStateMachine();
  const screenMonitor = new ScreenMonitor(stateMachine);
  const tileHashService = new TileHashService();
  const ocrService = new OCRService();
  const ruleService = new RuleService();
  
  // Configure AI service with Ollama
  const aiService = new AIClassificationService({
    provider: 'ollama',
    model: 'llama3.2:1b',
    baseURL: 'http://localhost:11434'
  });
  
  // Alternative: Use OpenAI if you prefer (requires API key)
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
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/cd85e294-0bef-430a-902e-994341727018',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'main.js:156',message:'Before sessionMonitor creation',data:{timestamp:Date.now()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
  // #endregion
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
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/cd85e294-0bef-430a-902e-994341727018',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'main.js:167',message:'sessionMonitor created',data:{sessionMonitorExists:typeof sessionMonitor !== 'undefined'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
  // #endregion
  
  // Update session service with monitoring
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/cd85e294-0bef-430a-902e-994341727018',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'main.js:169',message:'Before sessionService creation',data:{sessionRepoExists:typeof sessionRepository !== 'undefined',refProcExists:typeof referenceProcessingService !== 'undefined',sessionMonitorExists:typeof sessionMonitor !== 'undefined'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
  // #endregion
  try {
    sessionService = new SessionService(
      sessionRepository,
      referenceProcessingService,
      sessionMonitor
    );
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/cd85e294-0bef-430a-902e-994341727018',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'main.js:175',message:'sessionService created',data:{sessionServiceExists:typeof sessionService !== 'undefined',hasResumeSession:typeof sessionService?.resumeSession === 'function'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
    // #endregion
  } catch (error) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/cd85e294-0bef-430a-902e-994341727018',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'main.js:179',message:'sessionService creation error',data:{error:error.message,stack:error.stack},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
    // #endregion
    console.error('sessionService initialization error:', error);
    throw error;
  }
  
  console.log('✓ FocusAI ready');
  console.log('✓ All services initialized');
  console.log('✓ Ollama Manager: Automatic setup enabled');
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/cd85e294-0bef-430a-902e-994341727018',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'main.js:155',message:'app.whenReady completed',data:{authServiceExists:typeof authService !== 'undefined',hasSignup:typeof authService?.signup === 'function'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
});

// ==================== Auth IPC Handlers ====================
ipcMain.handle('auth-signup', async (event, username, email, password) => {
  console.log('IPC: auth-signup called', { username, email });
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/cd85e294-0bef-430a-902e-994341727018',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'main.js:161',message:'auth-signup handler entry',data:{authServiceExists:typeof authService !== 'undefined',authServiceType:typeof authService,hasSignup:typeof authService?.signup === 'function'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  try {
    const result = await authService.signup(username, email, password);
    console.log('IPC: auth-signup result', result);
    return result;
  } catch (error) {
    console.error('IPC: auth-signup error', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('auth-login', async (event, usernameOrEmail, password) => {
  console.log('IPC: auth-login called', { usernameOrEmail });
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/cd85e294-0bef-430a-902e-994341727018',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'main.js:173',message:'auth-login handler entry',data:{authServiceExists:typeof authService !== 'undefined',authServiceType:typeof authService,hasLogin:typeof authService?.login === 'function'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  try {
    const result = await authService.login(usernameOrEmail, password);
    console.log('IPC: auth-login result', result);
    return result;
  } catch (error) {
    console.error('IPC: auth-login error', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('auth-verify-token', async (event, token) => {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/cd85e294-0bef-430a-902e-994341727018',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'main.js:184',message:'auth-verify-token handler entry',data:{authServiceExists:typeof authService !== 'undefined',authServiceType:typeof authService,hasVerifyToken:typeof authService?.verifyToken === 'function'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  try {
    const result = authService.verifyToken(token);
    return result;
  } catch (error) {
    console.error('IPC: auth-verify-token error', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('auth-get-profile', async (event, userId) => {
  try {
    const result = authService.getUserProfile(userId);
    return result;
  } catch (error) {
    console.error('IPC: auth-get-profile error', error);
    return { success: false, error: error.message };
  }
});

// ==================== Session IPC Handlers ====================
ipcMain.handle('session-create', async (event, userId, sessionData) => {
  console.log('IPC: session-create called', { userId, sessionData });
  if (!sessionService) {
    return { success: false, error: 'Session service not initialized yet. Please wait a moment and try again.' };
  }
  try {
    const result = sessionService.createSession(userId, sessionData);
    console.log('IPC: session-create result', result);
    return result;
  } catch (error) {
    console.error('IPC: session-create error', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('session-get-all', async (event, userId, status) => {
  if (!sessionService) {
    return { success: false, error: 'Session service not initialized yet. Please wait a moment and try again.' };
  }
  try {
    const result = sessionService.getUserSessions(userId, status);
    return result;
  } catch (error) {
    console.error('IPC: session-get-all error', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('session-get', async (event, sessionId) => {
  if (!sessionService) {
    return { success: false, error: 'Session service not initialized yet. Please wait a moment and try again.' };
  }
  try {
    const result = sessionService.getSession(sessionId);
    return result;
  } catch (error) {
    console.error('IPC: session-get error', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('session-start', async (event, sessionId) => {
  console.log('IPC: session-start called', { sessionId });
  if (!sessionService) {
    return { success: false, error: 'Session service not initialized yet. Please wait a moment and try again.' };
  }
  try {
    const result = sessionService.startSession(sessionId);
    console.log('IPC: session-start result', result);
    return result;
  } catch (error) {
    console.error('IPC: session-start error', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('session-stop', async (event, sessionId) => {
  console.log('IPC: session-stop called', { sessionId });
  if (!sessionService) {
    return { success: false, error: 'Session service not initialized yet. Please wait a moment and try again.' };
  }
  try {
    const result = sessionService.stopSession(sessionId);
    return result;
  } catch (error) {
    console.error('IPC: session-stop error', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('session-pause', async (event, sessionId) => {
  console.log('IPC: session-pause called', { sessionId });
  if (!sessionService) {
    return { success: false, error: 'Session service not initialized yet. Please wait a moment and try again.' };
  }
  try {
    const result = sessionService.pauseSession(sessionId);
    console.log('IPC: session-pause result', result);
    return result;
  } catch (error) {
    console.error('IPC: session-pause error', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('session-resume', async (event, sessionId) => {
  console.log('IPC: session-resume called', { sessionId });
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/cd85e294-0bef-430a-902e-994341727018',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'main.js:308',message:'session-resume handler entry',data:{sessionServiceExists:typeof sessionService !== 'undefined',sessionServiceType:typeof sessionService,hasResumeSession:typeof sessionService?.resumeSession === 'function'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
  // #endregion
  if (!sessionService) {
    return { success: false, error: 'Session service not initialized yet. Please wait a moment and try again.' };
  }
  try {
    const result = sessionService.resumeSession(sessionId);
    console.log('IPC: session-resume result', result);
    return result;
  } catch (error) {
    console.error('IPC: session-resume error', error);
    return { success: false, error: error.message };
  }
});



ipcMain.handle('session-delete', async (event, sessionId) => {
  if (!sessionService) {
    return { success: false, error: 'Session service not initialized yet. Please wait a moment and try again.' };
  }
  try {
    const result = sessionService.deleteSession(sessionId);
    return result;
  } catch (error) {
    console.error('IPC: session-delete error', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('session-update', async (event, sessionId, updates) => {
  if (!sessionService) {
    return { success: false, error: 'Session service not initialized yet. Please wait a moment and try again.' };
  }
  try {
    const result = sessionService.updateSession(sessionId, updates);
    return result;
  } catch (error) {
    console.error('IPC: session-update error', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('session-get-stats', async (event, userId) => {
  if (!sessionService) {
    return { success: false, error: 'Session service not initialized yet. Please wait a moment and try again.' };
  }
  try {
    const result = sessionService.getUserStats(userId);
    return result;
  } catch (error) {
    console.error('IPC: session-get-stats error', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('session-get-active', async (event, userId) => {
  if (!sessionService) {
    return { success: false, error: 'Session service not initialized yet. Please wait a moment and try again.' };
  }
  try {
    const result = sessionService.getActiveSession(userId);
    return result;
  } catch (error) {
    console.error('IPC: session-get-active error', error);
    return { success: false, error: error.message };
  }
});


// File upload handler
ipcMain.handle('upload-file', async (event, fileData) => {
  try {
    const { fileName, fileBuffer, userId } = fileData;
    
    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(__dirname, 'uploads', String(userId));
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    
    // Generate unique filename
    const timestamp = Date.now();
    const ext = path.extname(fileName);
    const baseName = path.basename(fileName, ext);
    const uniqueFileName = `${baseName}_${timestamp}${ext}`;
    const filePath = path.join(uploadsDir, uniqueFileName);
    
    // Write file
    fs.writeFileSync(filePath, Buffer.from(fileBuffer));
    
    console.log('File uploaded:', filePath);
    
    return {
      success: true,
      filePath: filePath,
      fileName: uniqueFileName
    };
  } catch (error) {
    console.error('File upload error:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

ipcMain.handle('session-restart', async (event, sessionId) => {
  console.log('IPC: session-restart called', { sessionId });
  if (!sessionService) {
    return { success: false, error: 'Session service not initialized yet. Please wait a moment and try again.' };
  }
  try {
    const result = sessionService.restartSession(sessionId);
    console.log('IPC: session-restart result', result);
    return result;
  } catch (error) {
    console.error('IPC: session-restart error', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('session-get-active-or-paused', async (event, userId) => {
  try {
    const session = sessionRepository.getActiveOrPausedSession(userId);
    if (!session) {
      return { success: true, session: null };
    }
    return { success: true, session: session };
  } catch (error) {
    console.error('IPC: session-get-active-or-paused error', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('session-complete', async (event, sessionId) => {
  console.log('IPC: session-complete called', { sessionId });
  if (!sessionService) {
    return { success: false, error: 'Session service not initialized yet. Please wait a moment and try again.' };
  }
  try {
    const result = sessionService.completeSession(sessionId);
    console.log('IPC: session-complete result', result);
    return result;
  } catch (error) {
    console.error('IPC: session-complete error', error);
    return { success: false, error: error.message };
  }
});

// ==================== Monitoring IPC Handlers ====================
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

app.on('window-all-closed', async () => {
  // Pause any active sessions before closing
  if (sessionService && sessionRepository) {
    try {
      // Find all active sessions and pause them
      const allSessions = sessionRepository.db.prepare('SELECT * FROM focus_sessions WHERE status = ?').all('active');
      
      for (const session of allSessions) {
        await sessionService.pauseSession(session.id);
      }
    } catch (error) {
      console.error('Error pausing sessions on app close:', error);
    }
  }
  
  // Stop Ollama if we started it
  if (ollamaManager) {
    ollamaManager.stop();
  }
  
  // Stop monitoring if active
  if (sessionMonitor) {
    sessionMonitor.stop();
  }
  
  if (database) {
    database.close();
  }
  
  if (process.platform !== 'darwin') {
    app.quit();
  }
});



app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
