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

let mainWindow;
let database;
let userRepository;
let sessionRepository;
let authService;
let sessionService;

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

app.whenReady().then(() => {
  createWindow();
  
  // Initialize backend services
  console.log('Initializing backend...');
  database = new DatabaseConnection();
  const db = database.getConnection();
  
  userRepository = new UserRepository(db);
  sessionRepository = new SessionRepository(db);
  
  authService = new AuthService(userRepository);
  sessionService = new SessionService(sessionRepository);
  
  console.log('✓ FocusAI ready');
  console.log('✓ All services initialized');
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

app.on('window-all-closed', () => {
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
