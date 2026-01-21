// Edit session references module
// Handles URL, file, and text reference management for editing sessions

import { showAlert, escapeHtml, getFileIcon, formatFileSize } from './utils.js';

let editSelectedUrls = [];
let editSelectedFiles = [];

export function getEditSelectedUrls() {
  return editSelectedUrls;
}

export function getEditSelectedFiles() {
  return editSelectedFiles;
}

export function setEditSelectedUrls(urls) {
  editSelectedUrls = urls;
}

export function setEditSelectedFiles(files) {
  editSelectedFiles = files;
}

export function initializeEditReferences() {
  // Initialize collapse functionality for edit sections
  initializeEditReferenceCollapse();
  
  const refTypeBtns = document.querySelectorAll('.reference-type-btn-edit');
  
  refTypeBtns.forEach(btn => {
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    
    newBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const type = newBtn.dataset.type;
      
      document.querySelectorAll('#edit-reference-section .reference-input-group').forEach(group => {
        group.classList.add('hidden');
      });
      
      if (type === 'url') {
        const urlGroup = document.getElementById('edit-ref-url-group');
        if (urlGroup) {
          urlGroup.classList.remove('hidden');
          urlGroup.classList.remove('collapsed'); // Ensure section is expanded when shown
          setTimeout(() => attachEditUrlListener(), 10);
        } else {
          console.error('URL group not found!');
        }
      } else if (type === 'file') {
        const fileGroup = document.getElementById('edit-ref-file-group');
        if (fileGroup) {
          fileGroup.classList.remove('hidden');
          fileGroup.classList.remove('collapsed'); // Ensure section is expanded when shown
          setTimeout(() => attachEditFileListener(), 10);
        } else {
          console.error('File group not found!');
        }
      } else if (type === 'text') {
        const textGroup = document.getElementById('edit-ref-text-group');
        if (textGroup) {
          textGroup.classList.remove('hidden');
          textGroup.classList.remove('collapsed'); // Ensure section is expanded when shown
        } else {
          console.error('Text group not found!');
        }
      }
    });
  });
}

function attachEditUrlListener() {
  const editAddUrlBtn = document.getElementById('edit-add-url-btn');
  const editUrlInput = document.getElementById('edit-reference-url-input');
  
  if (!editAddUrlBtn || !editUrlInput) {
    console.error('URL elements not found');
    return;
  }
  
  editAddUrlBtn.removeEventListener('click', handleEditUrlAdd);
  editAddUrlBtn.addEventListener('click', handleEditUrlAdd);
  
  editUrlInput.removeEventListener('keypress', handleEditUrlKeypress);
  editUrlInput.addEventListener('keypress', handleEditUrlKeypress);
}

function handleEditUrlAdd(e) {
  e.preventDefault();
  e.stopPropagation();
  
  const editUrlInput = document.getElementById('edit-reference-url-input');
  const url = editUrlInput.value.trim();
  
  if (!url) {
    showAlert('Please enter a URL', 'error');
    return;
  }
  
  try {
    new URL(url);
  } catch (err) {
    showAlert('Please enter a valid URL', 'error');
    return;
  }
  
  if (editSelectedUrls.includes(url)) {
    showAlert('This URL has already been added', 'error');
    return;
  }
  
  editSelectedUrls.push(url);
  editUrlInput.value = '';
  displayEditUrls();
}

function handleEditUrlKeypress(e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    handleEditUrlAdd(e);
  }
}

function attachEditFileListener() {
  const editFileInput = document.getElementById('edit-reference-file');
  
  if (!editFileInput) {
    console.error('File input not found');
    return;
  }
  
  editFileInput.removeEventListener('change', handleEditFileChange);
  editFileInput.addEventListener('change', handleEditFileChange);
}

function handleEditFileChange(e) {
  const files = Array.from(e.target.files);
  
  for (const file of files) {
    if (file.size > 50 * 1024 * 1024) {
      showAlert(`${file.name} is too large. Max 50MB per file.`, 'error');
      continue;
    }
    
    if (editSelectedFiles.find(f => f.name === file.name && f.size === file.size)) {
      showAlert(`${file.name} is already added`, 'error');
      continue;
    }
    
    editSelectedFiles.push(file);
  }
  
  e.target.value = '';
  displayEditFiles();
}

export function displayEditUrls() {
  const container = document.getElementById('edit-urls-list');
  if (!container) {
    console.error('URLs list container not found');
    return;
  }
  
  if (editSelectedUrls.length === 0) {
    container.innerHTML = '';
    return;
  }
  
  container.innerHTML = editSelectedUrls.map((url, index) => `
    <div class="url-item">
      <span class="url-icon">URL</span>
      <div class="url-text">${escapeHtml(url)}</div>
      <button type="button" class="url-remove-btn" onclick="window.removeEditUrl(${index})">×</button>
    </div>
  `).join('');
}

export function removeEditUrl(index) {
  editSelectedUrls.splice(index, 1);
  displayEditUrls();
}

export function displayEditFiles() {
  const container = document.getElementById('edit-files-list');
  
  if (!container) {
    console.error('Files list container not found');
    return;
  }
  
  const label = document.getElementById('edit-file-upload-label');
  if (label) {
    label.style.display = 'flex';
  }
  
  if (editSelectedFiles.length === 0) {
    container.innerHTML = '';
    return;
  }
  
  container.innerHTML = editSelectedFiles.map((file, index) => `
    <div class="file-item">
      <div class="file-info">
        <span class="file-icon">${getFileIcon(file.name)}</span>
        <div class="file-details">
          <div class="file-name">${escapeHtml(file.name)}</div>
          <div class="file-size">${formatFileSize(file.size)}</div>
        </div>
      </div>
      <button type="button" class="file-remove-btn" onclick="window.removeEditFile(${index})">×</button>
    </div>
  `).join('');
}

export function removeEditFile(index) {
  editSelectedFiles.splice(index, 1);
  displayEditFiles();
}

/**
 * Clears all edit reference arrays
 */
export function clearEditReferences() {
  editSelectedUrls = [];
  editSelectedFiles = [];
  displayEditUrls();
  displayEditFiles();
}

function initializeEditReferenceCollapse() {
  // Use event delegation since sections may be hidden initially
  const editReferenceSection = document.getElementById('edit-reference-section');
  if (editReferenceSection) {
    editReferenceSection.addEventListener('click', function(e) {
      const header = e.target.closest('.reference-group-header');
      if (header) {
        e.stopPropagation();
        const section = header.closest('.reference-input-group');
        if (section) {
          section.classList.toggle('collapsed');
        }
      }
    });
  }
}
