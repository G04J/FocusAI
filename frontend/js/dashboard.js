/**
 * Dashboard main entry point
 * Coordinates initialization and event listeners for the dashboard
 */

// #region agent log
console.log('[DEBUG] dashboard.js: Module imports starting');
fetch('http://127.0.0.1:7242/ingest/cd85e294-0bef-430a-902e-994341727018',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'dashboard.js:7',message:'Module imports starting',data:{timestamp:Date.now()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
// #endregion

// Import modules
import { checkAuthentication, logout, currentUser as authCurrentUser } from './modules/auth.js';
import { loadStats } from './modules/stats.js';
import { loadActiveSession, expandActiveSession, pauseSession, resumeSession } from './modules/activeSession.js';
import { loadRecentSessions, loadAllSessions } from './modules/sessionsList.js';
import { startSession, stopSession, deleteSession, restartSession } from './modules/sessionActions.js';
import { openViewSessionModal, closeViewSessionModal, enterEditMode, startSessionFromView, pauseSessionFromView, resumeSessionFromView, stopSessionFromView, restartSessionFromView, deleteSessionFromView } from './modules/sessionModal.js';
import { initializeCreateSession, closeSessionModal, openSessionModal, removeUrl, removeFile } from './modules/createSession.js';
import { saveSessionEdits, loadExistingReferences, removeEditUrl, removeEditFile } from './modules/editSession.js';
import { showAlert } from './modules/utils.js';
import { initTheme, setupThemeToggle, getCurrentTheme, setTheme, setupSettingsPageToggle } from './modules/theme.js';

// #region agent log
console.log('[DEBUG] dashboard.js: Module imports completed', {hasCheckAuth: typeof checkAuthentication, hasLoadStats: typeof loadStats, hasShowAlert: typeof showAlert});
fetch('http://127.0.0.1:7242/ingest/cd85e294-0bef-430a-902e-994341727018',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'dashboard.js:20',message:'Module imports completed',data:{hasCheckAuth:typeof checkAuthentication,hasLoadStats:typeof loadStats,hasShowAlert:typeof showAlert},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
// #endregion

// Shared state
let currentFilter = 'all';

// ==================== Initialization ====================
/**
 * Initializes the dashboard on page load
 */
  // #region agent log
console.log('[DEBUG] dashboard.js: DOMContentLoaded listener registered', {readyState: document.readyState});
fetch('http://127.0.0.1:7242/ingest/cd85e294-0bef-430a-902e-994341727018',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'dashboard.js:27',message:'DOMContentLoaded listener registered',data:{readyState:document.readyState},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
  // #endregion
  
window.addEventListener('DOMContentLoaded', async () => {
  // #region agent log
  console.log('[DEBUG] dashboard.js: DOMContentLoaded FIRED!', {readyState: document.readyState});
  fetch('http://127.0.0.1:7242/ingest/cd85e294-0bef-430a-902e-994341727018',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'dashboard.js:30',message:'DOMContentLoaded fired',data:{readyState:document.readyState},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
  // #endregion
  
  // Initialize theme system first (before any rendering)
  initTheme();
  
  try {
    console.log('Dashboard initializing...');
  // #region agent log
    console.log('[DEBUG] dashboard.js: Before checkAuthentication', {hasCheckAuth: typeof checkAuthentication});
    fetch('http://127.0.0.1:7242/ingest/cd85e294-0bef-430a-902e-994341727018',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'dashboard.js:34',message:'Before checkAuthentication',data:{hasCheckAuth:typeof checkAuthentication},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
  // #endregion
    const authenticated = await checkAuthentication();
    // #region agent log
    console.log('[DEBUG] dashboard.js: After checkAuthentication', {authenticated});
    fetch('http://127.0.0.1:7242/ingest/cd85e294-0bef-430a-902e-994341727018',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'dashboard.js:38',message:'After checkAuthentication',data:{authenticated},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    if (!authenticated) {
      console.log('Not authenticated, redirecting...');
      return; // User will be redirected to auth page
    }
    
    console.log('Authentication successful, loading dashboard...');
    await loadDashboard();
    // #region agent log
    console.log('[DEBUG] dashboard.js: Before setupEventListeners');
    fetch('http://127.0.0.1:7242/ingest/cd85e294-0bef-430a-902e-994341727018',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'dashboard.js:48',message:'Before setupEventListeners',data:{timestamp:Date.now()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    setupEventListeners();
    // #region agent log
    console.log('[DEBUG] dashboard.js: After setupEventListeners - DONE!');
    fetch('http://127.0.0.1:7242/ingest/cd85e294-0bef-430a-902e-994341727018',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'dashboard.js:52',message:'After setupEventListeners',data:{timestamp:Date.now()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    console.log('Dashboard initialized successfully');
  } catch (error) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/cd85e294-0bef-430a-902e-994341727018',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'dashboard.js:56',message:'Dashboard init error',data:{error:error.message,stack:error.stack},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
    // #endregion
    console.error('Dashboard initialization error:', error);
    alert('Failed to initialize dashboard. Check console for details.');
  }
});

/**
 * Loads all dashboard data
 */
async function loadDashboard() {
  try {
    await loadStats();
    await loadActiveSession();
      await loadRecentSessions();
  } catch (error) {
    console.error('Dashboard load error:', error);
    showAlert('Failed to load dashboard', 'error');
  }
}

// ==================== Navigation ====================
/**
 * Navigates to a specific page
 * @param {string} page - The page name to navigate to
 */
function navigateToPage(page) {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.remove('active');
    if (item.dataset.page === page) {
      item.classList.add('active');
    }
  });
  
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const pageElement = document.getElementById(`page-${page}`);
  if (pageElement) {
    pageElement.classList.add('active');
  }
  
  if (page === 'sessions') {
    loadAllSessions(currentFilter === 'all' ? null : currentFilter);
  } else if (page === 'settings') {
    // Setup settings toggle when navigating to settings page
    setupSettingsPageToggle();
  }
}


// ==================== Event Listeners ====================
/**
 * Sets up all event listeners for the dashboard
 */
function setupEventListeners() {
  // #region agent log
  console.log('[DEBUG] setupEventListeners: Entry', {navItemsCount: document.querySelectorAll('.nav-item').length, hasCreateBtn: !!document.getElementById('create-session-btn')});
  fetch('http://127.0.0.1:7242/ingest/cd85e294-0bef-430a-902e-994341727018',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'dashboard.js:85',message:'setupEventListeners entry',data:{navItemsCount:document.querySelectorAll('.nav-item').length,hasCreateBtn:!!document.getElementById('create-session-btn')},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
  // #endregion
  // Navigation
  const navItems = document.querySelectorAll('.nav-item');
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/cd85e294-0bef-430a-902e-994341727018',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'dashboard.js:122',message:'Attaching nav listeners',data:{navItemsCount:navItems.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
  // #endregion
  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/cd85e294-0bef-430a-902e-994341727018',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'dashboard.js:127',message:'Nav item clicked',data:{page:item.dataset.page},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      e.preventDefault();
      const page = item.dataset.page;
      navigateToPage(page);
    });
  });
  
  // Logout
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', logout);
  }
  
  // Collapse/Expand Active Session
  const collapseBtn = document.getElementById('collapse-session-btn');
  if (collapseBtn) {
    collapseBtn.addEventListener('click', () => {
      const container = document.getElementById('active-session-container');
      if (container) {
      container.classList.toggle('collapsed');
      }
    });
  }
  
  // Create Session Modal
  const createSessionBtn = document.getElementById('create-session-btn');
  const closeModalBtn = document.getElementById('close-modal');
  const cancelSessionBtn = document.getElementById('cancel-session-btn');
  const sessionModal = document.getElementById('session-modal');
  
  if (createSessionBtn) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/cd85e294-0bef-430a-902e-994341727018',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'dashboard.js:154',message:'Attaching createSessionBtn listener',data:{timestamp:Date.now()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    createSessionBtn.addEventListener('click', () => {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/cd85e294-0bef-430a-902e-994341727018',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'dashboard.js:157',message:'Create session btn clicked',data:{hasOpenSessionModal:typeof openSessionModal},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      openSessionModal();
      initializeCreateSession();
    });
  }
  if (closeModalBtn) {
    closeModalBtn.addEventListener('click', closeSessionModal);
  }
  if (cancelSessionBtn) {
    cancelSessionBtn.addEventListener('click', closeSessionModal);
  }
  if (sessionModal) {
    sessionModal.addEventListener('click', (e) => {
    if (e.target.id === 'session-modal') {
      closeSessionModal();
    }
  });
  }
  
  // View Session Modal
  const closeViewModal = document.getElementById('close-view-modal');
  const cancelViewBtn = document.getElementById('cancel-view-btn');
  const viewModal = document.getElementById('view-session-modal');
  
  if (closeViewModal) {
    closeViewModal.addEventListener('click', closeViewSessionModal);
  }
  if (cancelViewBtn) {
    cancelViewBtn.addEventListener('click', closeViewSessionModal);
  }
  if (viewModal) {
    viewModal.addEventListener('click', (e) => {
      if (e.target.id === 'view-session-modal') {
        closeViewSessionModal();
      }
    });
  }
  
  // Edit toggle
  const editToggleBtn = document.getElementById('edit-toggle-btn');
  if (editToggleBtn) {
    editToggleBtn.addEventListener('click', () => enterEditMode());
  }
  
  const saveEditBtn = document.getElementById('save-edit-btn');
  if (saveEditBtn) {
    saveEditBtn.addEventListener('click', saveSessionEdits);
  }
  
  // Session card click to open view modal (delegated)
  document.addEventListener('click', (e) => {
    const clickableArea = e.target.closest('.session-card-clickable-area');
    if (clickableArea) {
      const card = clickableArea.closest('.session-card');
      if (card) {
        const sessionId = parseInt(card.dataset.sessionId);
        if (sessionId) {
          openViewSessionModal(sessionId);
        }
      }
    }
  });
  
  // Session Actions (delegated)
  document.addEventListener('click', async (e) => {
    const target = e.target.closest('button');
    if (!target) return;
    
    if (target.classList.contains('btn-start-session')) {
      e.stopPropagation();
      const sessionId = parseInt(target.dataset.sessionId);
      if (sessionId) {
      await startSession(sessionId);
      }
    } else if (target.classList.contains('btn-stop-session')) {
      e.stopPropagation();
      const sessionId = parseInt(target.dataset.sessionId);
      if (sessionId) {
      await stopSession(sessionId);
      }
    } else if (target.classList.contains('btn-resume-session')) {
      e.stopPropagation();
      const sessionId = parseInt(target.dataset.sessionId);
      if (sessionId) {
      await resumeSession(sessionId);
      }
    } else if (target.classList.contains('btn-pause-session')) {
      e.stopPropagation();
      const sessionId = parseInt(target.dataset.sessionId);
      if (sessionId) {
        await pauseSession(sessionId);
      }
    } else if (target.classList.contains('btn-restart-session')) {
      e.stopPropagation();
      const sessionId = parseInt(target.dataset.sessionId);
      if (sessionId) {
      await restartSession(sessionId);
      }
    } else if (target.classList.contains('btn-delete-session')) {
      e.stopPropagation();
      const sessionId = parseInt(target.dataset.sessionId);
      if (sessionId) {
      await deleteSession(sessionId);
      }
    }
  });
  
  // Stop session button in active session card
  const stopBtn = document.getElementById('stop-session-btn');
  if (stopBtn) {
    stopBtn.addEventListener('click', async () => {
      try {
        const result = await window.electronAPI.getActiveOrPausedSession(authCurrentUser?.userId);
        if (result?.success && result.session) {
        await stopSession(result.session.id);
        }
      } catch (error) {
        console.error('Error getting active session:', error);
      }
    });
  }
  
  // Session filters
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      const filter = btn.dataset.filter;
      currentFilter = filter;
      loadAllSessions(filter === 'all' ? null : filter);
    });
  });
}

// ==================== Expose Functions to Window ====================
// Expose functions for onclick handlers in HTML if needed
window.expandActiveSession = expandActiveSession;
window.startSessionFromView = startSessionFromView;
window.pauseSessionFromView = pauseSessionFromView;
window.resumeSessionFromView = resumeSessionFromView;
window.stopSessionFromView = stopSessionFromView;
window.restartSessionFromView = restartSessionFromView;
window.deleteSessionFromView = deleteSessionFromView;
window.removeUrl = removeUrl;
window.removeFile = removeFile;
window.removeEditUrl = removeEditUrl;
window.removeEditFile = removeEditFile;

// Export for use by other modules if needed
export { navigateToPage, currentFilter };
