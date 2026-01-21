// Active session module

import { currentUser } from './auth.js';
import { showAlert } from './utils.js';
import { loadRecentSessions } from './sessionsList.js';
import { loadStats } from './stats.js';

export let currentActiveSessionId = null;
let timerInterval = null;

export async function loadActiveSession() {
  try {
    if (!currentUser || !currentUser.userId) {
      console.error('User not authenticated');
      hideActiveSession();
      return;
    }
    
    const result = await window.electronAPI.getActiveOrPausedSession(currentUser.userId);
    
    if (result && result.success && result.session) {
      currentActiveSessionId = result.session.id;
      showActiveSession(result.session);
    } else {
      currentActiveSessionId = null;
      hideActiveSession();
    }
  } catch (error) {
    console.error('Active session load error:', error);
    hideActiveSession();
  }
}

function showActiveSession(session) {
  const container = document.getElementById('active-session-container');
  container.classList.remove('hidden');
  
  document.getElementById('active-task-name').textContent = session.task_name;
  document.getElementById('active-task-description').textContent = 
    session.task_description || 'No description';
  
  const statusLive = document.querySelector('.session-status-live');
  const pauseBtn = document.getElementById('pause-session-btn');
  
  if (session.status === 'active') {
    statusLive.textContent = 'LIVE';
    statusLive.classList.remove('paused');
    pauseBtn.textContent = 'Pause';
    pauseBtn.onclick = () => pauseSession(session.id);
    startSessionTimer(session.started_at, session.duration_minutes);
  } else if (session.status === 'paused') {
    statusLive.textContent = 'PAUSED';
    statusLive.classList.add('paused');
    pauseBtn.textContent = 'Resume';
    pauseBtn.onclick = () => resumeSession(session.id);
    stopSessionTimer();
    updateTimerDisplay(session.started_at, session.duration_minutes, true, session.paused_at);
  }
}

function hideActiveSession() {
  const container = document.getElementById('active-session-container');
  container.classList.add('hidden');
  container.classList.remove('collapsed');
  stopSessionTimer();
  currentActiveSessionId = null;
}

function startSessionTimer(startedAt, durationMinutes) {
  function updateTimer() {
    updateTimerDisplay(startedAt, durationMinutes, false);
  }
  
  updateTimer();
  timerInterval = setInterval(updateTimer, 1000);
}

function updateTimerDisplay(startedAt, durationMinutes, isPaused, pausedAt = null) {
  const startTime = new Date(startedAt).getTime();
  // For paused sessions, use pausedAt instead of current time
  const endTime = (isPaused && pausedAt) ? new Date(pausedAt).getTime() : Date.now();
  
  const elapsed = Math.floor((endTime - startTime) / 1000);
  const elapsedHours = Math.floor(elapsed / 3600);
  const elapsedMinutes = Math.floor((elapsed % 3600) / 60);
  const elapsedSeconds = elapsed % 60;
  
  const totalSeconds = durationMinutes * 60;
  const remainingSeconds = Math.max(0, totalSeconds - elapsed);
  const remainingHours = Math.floor(remainingSeconds / 3600);
  const remainingMinutes = Math.floor((remainingSeconds % 3600) / 60);
  const remainingSecs = remainingSeconds % 60;
  
  const elapsedDisplay = `${String(elapsedHours).padStart(2, '0')}:${String(elapsedMinutes).padStart(2, '0')}:${String(elapsedSeconds).padStart(2, '0')}`;
  const remainingDisplay = `${String(remainingHours).padStart(2, '0')}:${String(remainingMinutes).padStart(2, '0')}:${String(remainingSecs).padStart(2, '0')}`;
  
  document.getElementById('session-elapsed').textContent = elapsedDisplay;
  document.getElementById('session-remaining').textContent = remainingDisplay;
  
  const progress = Math.min(100, (elapsed / totalSeconds) * 100);
  document.getElementById('session-progress').style.width = progress + '%';
  
  if (!isPaused && remainingSeconds === 0 && timerInterval) {
    handleSessionComplete();
  }
}

function stopSessionTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

async function handleSessionComplete() {
  stopSessionTimer();
  
  if (!currentActiveSessionId) {
    return;
  }
  
  try {
    const result = await window.electronAPI.completeSession(currentActiveSessionId);
    
    if (result.success) {
      showAlert('🎉 Session completed! Great work!', 'success');
      currentActiveSessionId = null;
      await loadStats();
      await loadActiveSession();
      await loadRecentSessions();
    } else {
      showAlert(result.error || 'Failed to complete session', 'error');
    }
  } catch (error) {
    console.error('Complete session error:', error);
    showAlert('Failed to complete session', 'error');
  }
}

export async function pauseSession(sessionId) {
  try {
    const result = await window.electronAPI.pauseSession(sessionId);
    
    if (result.success) {
      showAlert('Session paused', 'success');
      await loadActiveSession();
      await loadRecentSessions();
    } else {
      showAlert(result.error, 'error');
    }
  } catch (error) {
    console.error('Pause session error:', error);
    showAlert('Failed to pause session', 'error');
  }
}

export async function resumeSession(sessionId) {
  try {
    const result = await window.electronAPI.resumeSession(sessionId);
    
    if (result.success) {
      showAlert('Session resumed', 'success');
      await loadActiveSession();
      await loadRecentSessions();
      
      const container = document.getElementById('active-session-container');
      container.classList.remove('collapsed');
    } else {
      showAlert(result.error, 'error');
    }
  } catch (error) {
    console.error('Resume session error:', error);
    showAlert('Failed to resume session', 'error');
  }
}

export function expandActiveSession() {
  const container = document.getElementById('active-session-container');
  if (!container.classList.contains('hidden')) {
    container.classList.remove('collapsed');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}