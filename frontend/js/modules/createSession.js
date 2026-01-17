// Create session module

import { currentUser } from './auth.js';
import { showAlert, getFileIcon, formatFileSize, escapeHtml } from './utils.js';
import { loadStats } from './stats.js';
import { loadRecentSessions, loadAllSessions } from './sessionsList.js';

let selectedUrls = [];
let selectedFiles = [];
let activeReferenceSections = new Set();

let formInitialized = false;

export function initializeCreateSession() {
  if (formInitialized) {
    return; // Already initialized, avoid duplicate listeners
  }
  
  initializeUrlHandling();
  initializeFileHandling();
  initializeReferenceToggles();
  
  const form = document.getElementById('create-session-form');
  if (form) {
    form.addEventListener('submit', handleCreateSession);
    formInitialized = true;
  }
}

function initializeUrlHandling() {
  const addUrlBtn = document.getElementById('add-url-btn');
  const urlInput = document.getElementById('reference-url-input');
  
  if (addUrlBtn) {
    addUrlBtn.addEventListener('click', () => {
      const url = urlInput.value.trim();
      
      if (!url) {
        showAlert('Please enter a URL', 'error');
        return;
      }
      
      try {
        new URL(url);
      } catch (e) {
        showAlert('Please enter a valid URL', 'error');
        return;
      }
      
      if (selectedUrls.includes(url)) {
        showAlert('This URL has already been added', 'error');
        return;
      }
      
      selectedUrls.push(url);
      urlInput.value = '';
      displaySelectedUrls();
    });
  }
  
  if (urlInput) {
    urlInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addUrlBtn.click();
      }
    });
  }
}

function displaySelectedUrls() {
  const container = document.getElementById('urls-list');
  if (!container) return;
  
  if (selectedUrls.length === 0) {
    container.innerHTML = '';
    return;
  }
  
  container.innerHTML = selectedUrls.map((url, index) => `
    <div class="url-item">
      <span class="url-icon">URL</span>
      <div class="url-text">${escapeHtml(url)}</div>
      <button type="button" class="url-remove-btn" onclick="window.removeUrl(${index})">×</button>
    </div>
  `).join('');
}

export function removeUrl(index) {
  selectedUrls.splice(index, 1);
  displaySelectedUrls();
}

function initializeFileHandling() {
  const fileInput = document.getElementById('reference-file');
  
  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      const files = Array.from(e.target.files);
      
      for (const file of files) {
        if (file.size > 50 * 1024 * 1024) {
          showAlert(`${file.name} is too large. Max 50MB per file.`, 'error');
          continue;
        }
        
        if (selectedFiles.find(f => f.name === file.name && f.size === file.size)) {
          showAlert(`${file.name} is already added`, 'error');
          continue;
        }
        
        selectedFiles.push(file);
      }
      
      e.target.value = '';
      displaySelectedFiles();
    });
  }
}

function displaySelectedFiles() {
  const container = document.getElementById('files-list');
  if (!container) return;
  
  if (selectedFiles.length === 0) {
    container.innerHTML = '';
    return;
  }
  
  container.innerHTML = selectedFiles.map((file, index) => `
    <div class="file-item">
      <div class="file-info">
        <span class="file-icon">${getFileIcon(file.name)}</span>
        <div class="file-details">
          <div class="file-name">${escapeHtml(file.name)}</div>
          <div class="file-size">${formatFileSize(file.size)}</div>
        </div>
      </div>
      <button type="button" class="file-remove-btn" onclick="window.removeFile(${index})">×</button>
    </div>
  `).join('');
}

export function removeFile(index) {
  selectedFiles.splice(index, 1);
  displaySelectedFiles();
}

function initializeReferenceToggles() {
  const multiButtons = document.querySelectorAll('.reference-type-btn-multi');
  multiButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const type = btn.dataset.type;
      
      let sectionId;
      if (type === 'url') sectionId = 'urls-section';
      else if (type === 'file') sectionId = 'files-section';
      else if (type === 'text') sectionId = 'text-section';
      
      const section = document.getElementById(sectionId);
      if (!section) {
        console.error('Section not found:', sectionId);
        return;
      }
      
      if (btn.classList.contains('active')) {
        btn.classList.remove('active');
        section.classList.remove('active');
        activeReferenceSections.delete(type);
      } else {
        btn.classList.add('active');
        section.classList.add('active');
        activeReferenceSections.add(type);
      }
    });
  });
}

function clearAllReferences() {
  selectedUrls = [];
  selectedFiles = [];
  activeReferenceSections.clear();
  
  displaySelectedUrls();
  displaySelectedFiles();
  
  const textArea = document.getElementById('reference-text');
  if (textArea) textArea.value = '';
  
  document.querySelectorAll('.reference-type-btn-multi').forEach(btn => {
    btn.classList.remove('active');
  });
  document.querySelectorAll('.reference-group').forEach(section => {
    section.classList.remove('active');
  });
}

export function openSessionModal() {
  document.getElementById('session-modal').classList.add('show');
  clearAllReferences();
}

export function closeSessionModal() {
  document.getElementById('session-modal').classList.remove('show');
  document.getElementById('create-session-form').reset();
  clearAllReferences();
}

async function handleCreateSession(e) {
  e.preventDefault();
  
  const spinner = document.getElementById('create-spinner');
  spinner.classList.remove('hidden');
  
  const taskName = document.getElementById('task-name').value.trim();
  const taskDescription = document.getElementById('task-description').value.trim();
  const duration = parseInt(document.getElementById('duration').value);
  const textValue = document.getElementById('reference-text').value.trim();
  
  try {
    let referenceType = null;
    let referenceUrl = null;
    let referenceText = null;
    let referenceFilePath = null;
    
    const hasUrls = selectedUrls.length > 0;
    const hasFiles = selectedFiles.length > 0;
    const hasText = textValue.length > 0;
    
    const referenceCount = [hasUrls, hasFiles, hasText].filter(Boolean).length;
    
    if (referenceCount === 0) {
      referenceType = null;
    } else if (referenceCount === 1) {
      if (hasUrls) {
        referenceType = 'url';
        referenceUrl = JSON.stringify(selectedUrls);
      } else if (hasFiles) {
        referenceType = 'file';
        showAlert(`Uploading ${selectedFiles.length} file(s)...`, 'success');
        
        const uploadedPaths = [];
        for (const file of selectedFiles) {
          const fileBuffer = await file.arrayBuffer();
          const uploadResult = await window.electronAPI.uploadFile({
            fileName: file.name,
            fileBuffer: Array.from(new Uint8Array(fileBuffer)),
            userId: currentUser.userId
          });
          
          if (!uploadResult.success) {
            throw new Error(`Failed to upload ${file.name}`);
          }
          
          uploadedPaths.push(uploadResult.filePath);
        }
        referenceFilePath = JSON.stringify(uploadedPaths);
      } else if (hasText) {
        referenceType = 'text';
        referenceText = textValue;
      }
    } else {
      referenceType = 'mixed';
      
      const mixedData = {};
      
      if (hasUrls) {
        mixedData.urls = selectedUrls;
      }
      
      if (hasFiles) {
        showAlert(`Uploading ${selectedFiles.length} file(s)...`, 'success');
        const uploadedPaths = [];
        for (const file of selectedFiles) {
          const fileBuffer = await file.arrayBuffer();
          const uploadResult = await window.electronAPI.uploadFile({
            fileName: file.name,
            fileBuffer: Array.from(new Uint8Array(fileBuffer)),
            userId: currentUser.userId
          });
          
          if (!uploadResult.success) {
            throw new Error(`Failed to upload ${file.name}`);
          }
          
          uploadedPaths.push(uploadResult.filePath);
        }
        mixedData.files = uploadedPaths;
      }
      
      if (hasText) {
        mixedData.text = textValue;
      }
      
      referenceUrl = JSON.stringify(mixedData);
    }
    
    const sessionData = {
      taskName,
      taskDescription,
      durationMinutes: duration,
      referenceType,
      referenceUrl,
      referenceText,
      referenceFilePath
    };
    
    const result = await window.electronAPI.createSession(currentUser.userId, sessionData);
    
    spinner.classList.add('hidden');
    
    if (result.success) {
      showAlert('Session created successfully!', 'success');
      closeSessionModal();
      
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
    spinner.classList.add('hidden');
    console.error('Create session error:', error);
    showAlert('Failed to create session: ' + error.message, 'error');
  }
}