// Session actions module

import { showAlert } from './utils.js';
import { loadStats } from './stats.js';
import { loadActiveSession } from './activeSession.js';
import { loadRecentSessions, loadAllSessions } from './sessionsList.js';
import { navigateToPage } from '../dashboard.js';

export async function startSession(sessionId) {
  try {
    const result = await window.electronAPI.startSession(sessionId);
    
    if (result.success) {
      showAlert('Session started!', 'success');
      await loadActiveSession();
      await loadRecentSessions();
      
      if (!document.getElementById('page-dashboard').classList.contains('active')) {
        navigateToPage('dashboard');
      }
      
      const container = document.getElementById('active-session-container');
      container.classList.remove('collapsed');
    } else {
      showAlert(result.error, 'error');
    }
  } catch (error) {
    console.error('Start session error:', error);
    showAlert('Failed to start session', 'error');
  }
}

export async function stopSession(sessionId) {
  if (!confirm('Are you sure you want to stop this session?')) {
    return;
  }
  
  try {
    const result = await window.electronAPI.stopSession(sessionId);
    
    if (result.success) {
      showAlert('Session stopped!', 'success');
      await loadStats();
      await loadActiveSession();
      await loadRecentSessions();
      
      if (document.getElementById('page-sessions').classList.contains('active')) {
        const filterBtn = document.querySelector('.filter-btn.active');
        const filter = filterBtn ? filterBtn.dataset.filter : 'all';
        await loadAllSessions(filter === 'all' ? null : filter);
      }
    } else {
      showAlert(result.error, 'error');
    }
  } catch (error) {
    console.error('Stop session error:', error);
    showAlert('Failed to stop session', 'error');
  }
}

export async function deleteSession(sessionId) {
  if (!confirm('Are you sure you want to delete this session?')) {
    return;
  }
  
  try {
    const result = await window.electronAPI.deleteSession(sessionId);
    
    if (result.success) {
      showAlert('Session deleted', 'success');
      await loadStats();
      await loadRecentSessions();
      
      if (document.getElementById('page-sessions').classList.contains('active')) {
        const filterBtn = document.querySelector('.filter-btn.active');
        const filter = filterBtn ? filterBtn.dataset.filter : 'all';
        await loadAllSessions(filter === 'all' ? null : filter);
      }
    } else {
      showAlert(result.error, 'error');
    }
  } catch (error) {
    console.error('Delete session error:', error);
    showAlert('Failed to delete session', 'error');
  }
}

export async function restartSession(sessionId) {
  if (!confirm('This will restart the session from the beginning. Continue?')) {
    return;
  }
  
  try {
    const result = await window.electronAPI.restartSession(sessionId);
    
    if (result.success) {
      showAlert('Session restarted!', 'success');
      await loadActiveSession();
      await loadRecentSessions();
      
      if (!document.getElementById('page-dashboard').classList.contains('active')) {
        navigateToPage('dashboard');
      }
      const container = document.getElementById('active-session-container');
      container.classList.remove('collapsed');
    } else {
      showAlert(result.error, 'error');
    }
  } catch (error) {
    console.error('Restart session error:', error);
    showAlert('Failed to restart session', 'error');
  }
}