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
  createWindow();
  
  // Initialize backend services
  console.log('Initializing backend...');
  database = new DatabaseConnection();
  const db = database.getConnection();
  
  userRepository = new UserRepository(db);
  sessionRepository = new SessionRepository(db);
  
  authService = new AuthService(userRepository);
  
  // Initialize repositories
  const referenceRepository = new ReferenceRepository(db);
  const sessionRulesRepository = new SessionRulesRepository(db);
  const activityRepository = new ActivityRepository(db);
  const statisticsRepository = new SessionStatisticsRepository(db);
  
  // Initialize services
  const referenceProcessingService = new ReferenceProcessingService(referenceRepository);
  const sessionRulesService = new SessionRulesService(sessionRulesRepository);
  const taskContextService = new TaskContextService(referenceRepository, sessionRepository);
  
  // Initialize Ollama Manager (automatic setup)
  console.log('Initializing Ollama Manager...');
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
  
  console.log('✓ FocusAI ready');
  console.log('✓ All services initialized');
  console.log('✓ Ollama Manager: Automatic setup enabled');
});

// ==================== Auth IPC Handlers ====================
ipcMain.handle('auth-signup', async (event, username, email, password) => {
  console.log('IPC: auth-signup called', { username, email });
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
  try {
    const result = sessionService.getUserSessions(userId, status);
    return result;
  } catch (error) {
    console.error('IPC: session-get-all error', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('session-get', async (event, sessionId) => {
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
  try {
    const result = sessionService.deleteSession(sessionId);
    return result;
  } catch (error) {
    console.error('IPC: session-delete error', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('session-update', async (event, sessionId, updates) => {
  try {
    const result = sessionService.updateSession(sessionId, updates);
    return result;
  } catch (error) {
    console.error('IPC: session-update error', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('session-get-stats', async (event, userId) => {
  try {
    const result = sessionService.getUserStats(userId);
    return result;
  } catch (error) {
    console.error('IPC: session-get-stats error', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('session-get-active', async (event, userId) => {
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
