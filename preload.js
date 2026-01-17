const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Authentication
  signup: (username, email, password) => 
    ipcRenderer.invoke('auth-signup', username, email, password),
  login: (usernameOrEmail, password) => 
    ipcRenderer.invoke('auth-login', usernameOrEmail, password),
  verifyToken: (token) => 
    ipcRenderer.invoke('auth-verify-token', token),
  getProfile: (userId) => 
    ipcRenderer.invoke('auth-get-profile', userId),
  
  // Sessions
  createSession: (userId, sessionData) =>
    ipcRenderer.invoke('session-create', userId, sessionData),
  getSessions: (userId, status) =>
    ipcRenderer.invoke('session-get-all', userId, status),
  getSession: (sessionId) =>
    ipcRenderer.invoke('session-get', sessionId),
  startSession: (sessionId) =>
    ipcRenderer.invoke('session-start', sessionId),
  stopSession: (sessionId) =>
    ipcRenderer.invoke('session-stop', sessionId),
  pauseSession: (sessionId) =>
    ipcRenderer.invoke('session-pause', sessionId),
  resumeSession: (sessionId) =>
    ipcRenderer.invoke('session-resume', sessionId),
  restartSession: (sessionId) =>
    ipcRenderer.invoke('session-restart', sessionId),
  completeSession: (sessionId) =>
    ipcRenderer.invoke('session-complete', sessionId),
  deleteSession: (sessionId) =>
    ipcRenderer.invoke('session-delete', sessionId),
  updateSession: (sessionId, updates) =>
    ipcRenderer.invoke('session-update', sessionId, updates),
  getSessionStats: (userId) =>
    ipcRenderer.invoke('session-get-stats', userId),
  getActiveSession: (userId) =>
    ipcRenderer.invoke('session-get-active', userId),
  getActiveOrPausedSession: (userId) =>
    ipcRenderer.invoke('session-get-active-or-paused', userId),
  
  // File upload
  uploadFile: (fileData) =>
    ipcRenderer.invoke('upload-file', fileData)
});