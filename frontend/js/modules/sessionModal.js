// Session modal (view/edit) module

import { escapeHtml, getFileIcon, showAlert } from './utils.js';
import { startSession, stopSession, deleteSession, restartSession } from './sessionActions.js';
import { initializeEditReferences, saveSessionEdits, loadExistingReferences, clearEditReferences } from './editSession.js';

let currentViewingSession = null;
let isEditMode = false;

export function openViewSessionModal(sessionId) {
  currentViewingSession = sessionId;
  isEditMode = false;
  
  const modal = document.getElementById('view-session-modal');
  if (!modal) {
    console.error('View session modal not found');
    return;
  }
  
  loadSessionDetails(sessionId);
  modal.classList.add('show');
}

export function closeViewSessionModal() {
  document.getElementById('view-session-modal').classList.remove('show');
  currentViewingSession = null;
  isEditMode = false;
  exitEditMode();
}

export async function loadSessionDetails(sessionId) {
  try {
    const result = await window.electronAPI.getSession(sessionId);
    
    if (result.success) {
      displaySessionDetails(result.session);
    } else {
      showAlert('Failed to load session details', 'error');
      closeViewSessionModal();
    }
  } catch (error) {
    console.error('Load session details error:', error);
    showAlert('Failed to load session details', 'error');
    closeViewSessionModal();
  }
}

function displaySessionDetails(session) {
  document.getElementById('edit-session-id').value = session.id;
  
  const statusBanner = document.getElementById('session-status-banner');
  statusBanner.className = `session-status-banner ${session.status}`;
  
  const statusBadge = document.getElementById('view-status-badge');
  statusBadge.textContent = session.status.toUpperCase();
  
  const statusMessage = document.getElementById('view-status-message');
  const timeInfo = document.getElementById('view-time-info');
  
  switch(session.status) {
    case 'planned':
      statusMessage.textContent = 'This session is ready to start';
      timeInfo.classList.add('hidden');
      break;
    case 'active':
      statusMessage.textContent = 'Session is currently running';
      const activeElapsed = Math.floor((Date.now() - new Date(session.started_at).getTime()) / 1000);
      const activeHours = Math.floor(activeElapsed / 3600);
      const activeMinutes = Math.floor((activeElapsed % 3600) / 60);
      timeInfo.textContent = `${activeHours}h ${activeMinutes}m elapsed`;
      timeInfo.classList.remove('hidden');
      break;
    case 'paused':
      statusMessage.textContent = 'Session is paused';
      const pausedElapsed = Math.floor((Date.now() - new Date(session.started_at).getTime()) / 1000);
      const pausedHours = Math.floor(pausedElapsed / 3600);
      const pausedMinutes = Math.floor((pausedElapsed % 3600) / 60);
      timeInfo.textContent = `${pausedHours}h ${pausedMinutes}m elapsed (paused)`;
      timeInfo.classList.remove('hidden');
      break;
    case 'stopped':
      statusMessage.textContent = 'Session was stopped manually';
      timeInfo.classList.add('hidden');
      break;
    case 'completed':
      statusMessage.textContent = 'Session completed successfully!';
      timeInfo.classList.add('hidden');
      break;
  }
  
  document.getElementById('edit-task-name').value = session.task_name;
  document.getElementById('edit-task-description').value = session.task_description || '';
  document.getElementById('edit-duration').value = session.duration_minutes;
  
  displayReferenceInfo(session);
  
  document.getElementById('view-created-at').textContent = 
    new Date(session.created_at).toLocaleString();
  
  if (session.started_at) {
    document.getElementById('view-started-container').classList.remove('hidden');
    document.getElementById('view-started-at').textContent = 
      new Date(session.started_at).toLocaleString();
  } else {
    document.getElementById('view-started-container').classList.add('hidden');
  }
  
  if (session.ended_at) {
    document.getElementById('view-ended-container').classList.remove('hidden');
    document.getElementById('view-ended-at').textContent = 
      new Date(session.ended_at).toLocaleString();
  } else {
    document.getElementById('view-ended-container').classList.add('hidden');
  }
  
  displaySessionActionButtons(session);
  
  const editBtn = document.getElementById('edit-toggle-btn');
  if (session.status === 'active' || session.status === 'paused') {
    editBtn.classList.add('hidden');
  } else {
    editBtn.classList.remove('hidden');
  }
}

function displayReferenceInfo(session) {
  const refDisplay = document.getElementById('edit-reference-display');
  
  if (!session.reference_type) {
    refDisplay.innerHTML = '<p class="text-muted">No reference material attached</p>';
    return;
  }
  
  let content = '';
  
  if (session.reference_type === 'mixed') {
    try {
      const mixedData = JSON.parse(session.reference_url);
      
      if (mixedData.urls && mixedData.urls.length > 0) {
        content += '<div class="ref-type">URLs</div>';
        content += '<div class="ref-files">';
        mixedData.urls.forEach(url => {
          content += `
            <div class="ref-file-item">
              <span>URL</span>
              <a href="${escapeHtml(url)}" target="_blank" style="color: var(--primary); text-decoration: none;">
                ${escapeHtml(url)}
              </a>
            </div>
          `;
        });
        content += '</div>';
      }
      
      if (mixedData.files && mixedData.files.length > 0) {
        content += '<div class="ref-type" style="margin-top: 16px;">Files</div>';
        content += '<div class="ref-files">';
        mixedData.files.forEach(filepath => {
          const filename = filepath.split('/').pop();
          content += `
            <div class="ref-file-item">
              <span>${getFileIcon(filename)}</span>
              <span>${escapeHtml(filename)}</span>
            </div>
          `;
        });
        content += '</div>';
      }
      
      if (mixedData.text) {
        content += '<div class="ref-type" style="margin-top: 16px;">Text Notes</div>';
        content += `<div class="ref-content">${escapeHtml(mixedData.text)}</div>`;
      }
    } catch (e) {
      content = '<p class="text-muted">Error loading reference materials</p>';
    }
  } else if (session.reference_type === 'url' && session.reference_url) {
    content += '<div class="ref-type">URL</div>';
    try {
      const urls = JSON.parse(session.reference_url);
      content += '<div class="ref-files">';
      urls.forEach(url => {
        content += `
          <div class="ref-file-item">
            <span>URL</span>
            <a href="${escapeHtml(url)}" target="_blank" style="color: var(--primary); text-decoration: none;">
              ${escapeHtml(url)}
            </a>
          </div>
        `;
      });
      content += '</div>';
    } catch (e) {
      content += `
        <div class="ref-content">
          <a href="${escapeHtml(session.reference_url)}" target="_blank">
            ${escapeHtml(session.reference_url)}
          </a>
        </div>
      `;
    }
  } else if (session.reference_type === 'text' && session.reference_text) {
    content += '<div class="ref-type">Text Notes</div>';
    content += `<div class="ref-content">${escapeHtml(session.reference_text)}</div>`;
  } else if (session.reference_type === 'file' && session.reference_file_path) {
    content += '<div class="ref-type">Files</div>';
    try {
      const files = JSON.parse(session.reference_file_path);
      content += '<div class="ref-files">';
      files.forEach(filepath => {
        const filename = filepath.split('/').pop();
        content += `
          <div class="ref-file-item">
            <span>${getFileIcon(filename)}</span>
            <span>${escapeHtml(filename)}</span>
          </div>
        `;
      });
      content += '</div>';
    } catch (e) {
      content += `<div class="ref-content">${escapeHtml(session.reference_file_path)}</div>`;
    }
  }
  
  refDisplay.innerHTML = content || '<p class="text-muted">No reference material attached</p>';
}

function displaySessionActionButtons(session) {
  const container = document.getElementById('view-action-buttons');
  let buttons = '';
  
  if (session.status === 'planned') {
    buttons = `
      <button type="button" class="btn btn-primary" onclick="window.startSessionFromView(${session.id})">
        Start Session
      </button>
      <button type="button" class="btn btn-delete" onclick="window.deleteSessionFromView(${session.id})">
        Delete
      </button>
    `;
  } else if (session.status === 'active') {
    buttons = `
      <button type="button" class="btn btn-secondary" onclick="window.pauseSessionFromView(${session.id})">
        Pause
      </button>
      <button type="button" class="btn btn-primary" onclick="window.stopSessionFromView(${session.id})">
        Stop
      </button>
    `;
  } else if (session.status === 'paused') {
    buttons = `
      <button type="button" class="btn btn-primary" onclick="window.resumeSessionFromView(${session.id})">
        Resume
      </button>
      <button type="button" class="btn btn-delete" onclick="window.deleteSessionFromView(${session.id})">
        Delete
      </button>
    `;
  } else if (session.status === 'stopped' || session.status === 'completed') {
    buttons = `
      <button type="button" class="btn btn-secondary" onclick="window.restartSessionFromView(${session.id})">
        Restart
      </button>
      <button type="button" class="btn btn-delete" onclick="window.deleteSessionFromView(${session.id})">
        Delete
      </button>
    `;
  }
  
  container.innerHTML = buttons;
}

export function enterEditMode() {
  isEditMode = true;
  const form = document.getElementById('edit-session-form');
  if (!form) return;
  
  form.classList.add('edit-mode');
  
  const taskNameEl = document.getElementById('edit-task-name');
  const taskDescEl = document.getElementById('edit-task-description');
  const durationEl = document.getElementById('edit-duration');
  const refSectionEl = document.getElementById('edit-reference-section');
  const editToggleBtn = document.getElementById('edit-toggle-btn');
  const saveEditBtn = document.getElementById('save-edit-btn');
  const viewActionsEl = document.getElementById('view-action-buttons');
  
  if (taskNameEl) taskNameEl.removeAttribute('readonly');
  if (taskDescEl) taskDescEl.removeAttribute('readonly');
  if (durationEl) durationEl.removeAttribute('readonly');
  if (refSectionEl) refSectionEl.classList.remove('hidden');
  if (editToggleBtn) editToggleBtn.classList.add('hidden');
  if (saveEditBtn) saveEditBtn.classList.remove('hidden');
  if (viewActionsEl) viewActionsEl.classList.add('hidden');
  
  initializeEditReferences();
  loadExistingReferences();
}

export function exitEditMode() {
  isEditMode = false;
  const form = document.getElementById('edit-session-form');
  if (!form) return;
  
  form.classList.remove('edit-mode');
  
  const taskNameEl = document.getElementById('edit-task-name');
  const taskDescEl = document.getElementById('edit-task-description');
  const durationEl = document.getElementById('edit-duration');
  const refSectionEl = document.getElementById('edit-reference-section');
  const editToggleBtn = document.getElementById('edit-toggle-btn');
  const saveEditBtn = document.getElementById('save-edit-btn');
  const viewActionsEl = document.getElementById('view-action-buttons');
  
  if (taskNameEl) taskNameEl.setAttribute('readonly', 'readonly');
  if (taskDescEl) taskDescEl.setAttribute('readonly', 'readonly');
  if (durationEl) durationEl.setAttribute('readonly', 'readonly');
  if (refSectionEl) refSectionEl.classList.add('hidden');
  if (editToggleBtn) editToggleBtn.classList.remove('hidden');
  if (saveEditBtn) saveEditBtn.classList.add('hidden');
  if (viewActionsEl) viewActionsEl.classList.remove('hidden');
  
  // Clear edit arrays when exiting edit mode
  clearEditReferences();
}

// Wrapper functions for HTML onclick attributes
export async function startSessionFromView(sessionId) {
  await startSession(sessionId);
  closeViewSessionModal();
}

export async function pauseSessionFromView(sessionId) {
  const result = await window.electronAPI.pauseSession(sessionId);
  if (result.success) {
    showAlert('Session paused', 'success');
    await loadSessionDetails(currentViewingSession);
  } else {
    showAlert(result.error, 'error');
  }
}

export async function resumeSessionFromView(sessionId) {
  const result = await window.electronAPI.resumeSession(sessionId);
  if (result.success) {
    showAlert('Session resumed', 'success');
    closeViewSessionModal();
  } else {
    showAlert(result.error, 'error');
  }
}

export async function stopSessionFromView(sessionId) {
  await stopSession(sessionId);
  closeViewSessionModal();
}

export async function restartSessionFromView(sessionId) {
  await restartSession(sessionId);
  closeViewSessionModal();
}

export async function deleteSessionFromView(sessionId) {
  await deleteSession(sessionId);
  closeViewSessionModal();
}

export async function saveSessionEditsWrapper() {
  await saveSessionEdits();
  closeViewSessionModal();
}