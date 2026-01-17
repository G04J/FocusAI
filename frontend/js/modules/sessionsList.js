// Sessions list module

import { currentUser } from './auth.js';
import { currentActiveSessionId } from './activeSession.js';
import { escapeHtml } from './utils.js';

export async function loadRecentSessions() {
  try {
    if (!currentUser || !currentUser.userId) {
      console.error('User not authenticated');
      return;
    }
    
    const result = await window.electronAPI.getSessions(currentUser.userId, null);
    
    if (result && result.success) {
      displaySessions(result.sessions.slice(0, 5), 'recent-sessions-list');
    }
  } catch (error) {
    console.error('Sessions load error:', error);
  }
}

export async function loadAllSessions(status = null) {
  try {
    if (!currentUser || !currentUser.userId) {
      console.error('User not authenticated');
      return;
    }
    
    const result = await window.electronAPI.getSessions(currentUser.userId, status);
    
    if (result && result.success) {
      displaySessions(result.sessions, 'all-sessions-list');
    }
  } catch (error) {
    console.error('Sessions load error:', error);
  }
}

function displaySessions(sessions, containerId) {
  const container = document.getElementById(containerId);
  
  if (sessions.length === 0) {
    container.innerHTML = '<p class="empty-state">No sessions found.</p>';
    return;
  }
  
  container.innerHTML = sessions.map(session => createSessionCard(session)).join('');
}

function createSessionCard(session) {
  const createdDate = new Date(session.created_at).toLocaleDateString();
  const status = session.status;
  const isCurrentActiveSession = currentActiveSessionId === session.id;
  
  let timeDisplay = '';
  if ((status === 'active' || status === 'paused') && session.started_at) {
    const elapsed = Math.floor((Date.now() - new Date(session.started_at).getTime()) / 1000);
    const hours = Math.floor(elapsed / 3600);
    const minutes = Math.floor((elapsed % 3600) / 60);
    timeDisplay = `<span>${hours}h ${minutes}m elapsed</span>`;
  }
  
  return `
    <div class="session-card session-card-clickable" data-session-id="${session.id}">
      <div class="session-card-header session-card-clickable-area">
        <div class="session-card-title">
          <h3>${escapeHtml(session.task_name)}</h3>
          ${session.task_description ? `<p>${escapeHtml(session.task_description)}</p>` : ''}
        </div>
        <span class="session-status-badge ${status}">${status.toUpperCase()}</span>
      </div>
      
      <div class="session-card-meta session-card-clickable-area">
        <span>${session.duration_minutes} min</span>
        <span>${createdDate}</span>
        ${session.reference_type ? `<span>${session.reference_type}</span>` : ''}
        ${timeDisplay}
      </div>
      
      <div class="session-card-actions">
        ${getSessionActionButtons(session, isCurrentActiveSession)}
      </div>
    </div>
  `;
}

function getSessionActionButtons(session, isCurrentActiveSession) {
  const status = session.status;
  
  if (isCurrentActiveSession) {
    return `
      <button class="btn btn-primary btn-view-active" onclick="window.expandActiveSession(); event.stopPropagation();">
        View Active Session
      </button>
    `;
  }
  
  if (status === 'planned') {
    return `
      <button class="btn btn-start btn-start-session" data-session-id="${session.id}">
        Start
      </button>
      <button class="btn btn-delete btn-delete-session" data-session-id="${session.id}">
        Delete
      </button>
    `;
  } else if (status === 'active') {
    return `
      <button class="btn btn-primary btn-stop-session" data-session-id="${session.id}">
        Stop
      </button>
    `;
  } else if (status === 'paused') {
    return `
      <button class="btn btn-primary btn-resume-session" data-session-id="${session.id}">
        Resume
      </button>
      <button class="btn btn-delete btn-delete-session" data-session-id="${session.id}">
        Delete
      </button>
    `;
  } else if (status === 'stopped' || status === 'completed') {
    return `
      <button class="btn btn-secondary btn-restart-session" data-session-id="${session.id}">
        Restart
      </button>
      <button class="btn btn-delete btn-delete-session" data-session-id="${session.id}">
        Delete
      </button>
    `;
  }
  
  return `
    <button class="btn btn-delete btn-delete-session" data-session-id="${session.id}">
      Delete
    </button>
  `;
}