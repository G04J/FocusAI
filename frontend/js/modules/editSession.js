// Edit session module

import { currentUser } from './auth.js';
import { showAlert, escapeHtml, getFileIcon, formatFileSize } from './utils.js';
import { loadRecentSessions, loadAllSessions } from './sessionsList.js';
import { loadSessionDetails, exitEditMode } from './sessionModal.js';

let editSelectedUrls = [];
let editSelectedFiles = [];

export function initializeEditReferences() {
  console.log('Initializing edit references...');
  
  const refTypeBtns = document.querySelectorAll('.reference-type-btn-edit');
  console.log('Found', refTypeBtns.length, 'reference type buttons');
  
  refTypeBtns.forEach(btn => {
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    
    newBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const type = newBtn.dataset.type;
      console.log('Reference type button clicked:', type);
      
      document.querySelectorAll('#edit-reference-section .reference-input-group').forEach(group => {
        group.classList.add('hidden');
      });
      
      if (type === 'url') {
        const urlGroup = document.getElementById('edit-ref-url-group');
        if (urlGroup) {
          urlGroup.classList.remove('hidden');
          setTimeout(() => attachEditUrlListener(), 10);
        } else {
          console.error('URL group not found!');
        }
      } else if (type === 'file') {
        const fileGroup = document.getElementById('edit-ref-file-group');
        if (fileGroup) {
          fileGroup.classList.remove('hidden');
          setTimeout(() => attachEditFileListener(), 10);
        } else {
          console.error('File group not found!');
        }
      } else if (type === 'text') {
        const textGroup = document.getElementById('edit-ref-text-group');
        if (textGroup) {
          textGroup.classList.remove('hidden');
        } else {
          console.error('Text group not found!');
        }
      }
    });
  });
  
  loadExistingReferences();
}

function attachEditUrlListener() {
  const editAddUrlBtn = document.getElementById('edit-add-url-btn');
  const editUrlInput = document.getElementById('edit-reference-url-input');
  
  if (!editAddUrlBtn || !editUrlInput) {
    console.error('URL elements not found');
    return;
  }
  
  console.log('Attaching URL button listener');
  
  editAddUrlBtn.removeEventListener('click', handleEditUrlAdd);
  editAddUrlBtn.addEventListener('click', handleEditUrlAdd);
  
  editUrlInput.removeEventListener('keypress', handleEditUrlKeypress);
  editUrlInput.addEventListener('keypress', handleEditUrlKeypress);
}

function handleEditUrlAdd(e) {
  e.preventDefault();
  e.stopPropagation();
  console.log('URL Add button clicked!');
  
  const editUrlInput = document.getElementById('edit-reference-url-input');
  const url = editUrlInput.value.trim();
  
  // #region agent log
  const logEntry1 = {location:'editSession.js:78',message:'handleEditUrlAdd ENTRY',data:{url,current_urls_count:editSelectedUrls.length,current_urls:editSelectedUrls},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H'};
  fetch('http://127.0.0.1:7242/ingest/cd85e294-0bef-430a-902e-994341727018',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logEntry1)}).catch(()=>{});
  // #endregion
  
  console.log('URL value:', url);
  
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
  
  // #region agent log
  const logEntry2 = {location:'editSession.js:107',message:'URL added to editSelectedUrls',data:{added_url:url,new_urls_count:editSelectedUrls.length,all_urls:editSelectedUrls},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H'};
  fetch('http://127.0.0.1:7242/ingest/cd85e294-0bef-430a-902e-994341727018',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logEntry2)}).catch(()=>{});
  // #endregion
  
  console.log('URL added successfully:', url);
  console.log('Total URLs:', editSelectedUrls.length);
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
  
  console.log('Attaching file input listener');
  
  editFileInput.removeEventListener('change', handleEditFileChange);
  editFileInput.addEventListener('change', handleEditFileChange);
}

function handleEditFileChange(e) {
  console.log('=== FILE CHANGE EVENT ===');
  console.log('File input changed');
  const files = Array.from(e.target.files);
  console.log('Files selected:', files.length);
  
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
    console.log('File added:', file.name);
  }
  
  e.target.value = '';
  displayEditFiles();
  console.log('Total files:', editSelectedFiles.length);
}

function displayEditUrls() {
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
  
  console.log('Displayed', editSelectedUrls.length, 'URLs');
}

export function removeEditUrl(index) {
  editSelectedUrls.splice(index, 1);
  displayEditUrls();
}

function displayEditFiles() {
  console.log('=== displayEditFiles CALLED ===');
  const container = document.getElementById('edit-files-list');
  console.log('Container:', container);
  console.log('Files count:', editSelectedFiles.length);
  
  if (!container) {
    console.error('Files list container not found');
    return;
  }
  
  const label = document.getElementById('edit-file-upload-label');
  console.log('Label element:', label);
  
  if (label) {
    label.style.display = 'flex';
    console.log('Label set to display: flex');
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
  
  console.log('Displayed', editSelectedFiles.length, 'files');
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

export async function loadExistingReferences() {
  // #region agent log
  const logEntry3 = {location:'editSession.js:241',message:'loadExistingReferences ENTRY',data:{timestamp:Date.now()},sessionId:'debug-session',runId:'run1',hypothesisId:'A'};
  fetch('http://127.0.0.1:7242/ingest/cd85e294-0bef-430a-902e-994341727018',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logEntry3)}).catch(()=>{});
  // #endregion
  
  const sessionIdEl = document.getElementById('edit-session-id');
  if (!sessionIdEl || !sessionIdEl.value) return;
  
  const sessionId = parseInt(sessionIdEl.value);
  const result = await window.electronAPI.getSession(sessionId);
  
  // #region agent log
  const logData = {
    location: 'editSession.js:249',
    message: 'getSession result',
    data: {
      success: result?.success,
      reference_type: result?.session?.reference_type,
      has_reference_url: !!result?.session?.reference_url,
      has_reference_file_path: !!result?.session?.reference_file_path
    },
    timestamp: Date.now(),
    sessionId: 'debug-session',
    runId: 'run1',
    hypothesisId: 'A'
  };
  fetch('http://127.0.0.1:7242/ingest/cd85e294-0bef-430a-902e-994341727018',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logData)}).catch(()=>{});
  // #endregion
  
  if (!result || !result.success) return;
  
  const session = result.session;
  // Clear arrays first
  editSelectedUrls = [];
  editSelectedFiles = [];
  
  // #region agent log
  const logTextCheck = {location:'editSession.js:288',message:'Checking session for text reference',data:{reference_type:session.reference_type,has_reference_text:!!session.reference_text,reference_text_length:session.reference_text?.length||0},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'};
  fetch('http://127.0.0.1:7242/ingest/cd85e294-0bef-430a-902e-994341727018',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logTextCheck)}).catch(()=>{});
  // #endregion
  
  if (session.reference_type === 'url' && session.reference_url) {
    try {
      editSelectedUrls = JSON.parse(session.reference_url);
      if (Array.isArray(editSelectedUrls)) {
        displayEditUrls();
      } else {
        editSelectedUrls = [session.reference_url];
        displayEditUrls();
      }
      const urlGroup = document.getElementById('edit-ref-url-group');
      if (urlGroup) {
        urlGroup.classList.remove('hidden');
        setTimeout(() => attachEditUrlListener(), 10);
      }
    } catch (e) {
      editSelectedUrls = [session.reference_url];
      displayEditUrls();
    }
  } else if (session.reference_type === 'file' && session.reference_file_path) {
    // Files are already uploaded, we can't reload File objects
    // But we can show existing file paths if needed
    // For now, just clear since we can't restore File objects
    editSelectedFiles = [];
    displayEditFiles();
  } else if (session.reference_type === 'mixed' && session.reference_url) {
    try {
      const mixedData = JSON.parse(session.reference_url);
      // #region agent log
      const logEntry4 = {location:'editSession.js:279',message:'Parsed mixed data BEFORE loading',data:{has_urls:!!mixedData.urls,url_count:mixedData.urls?.length,has_files:!!mixedData.files,file_count:mixedData.files?.length,mixedData},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'};
      fetch('http://127.0.0.1:7242/ingest/cd85e294-0bef-430a-902e-994341727018',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logEntry4)}).catch(()=>{});
      // #endregion
      
      if (mixedData.urls && Array.isArray(mixedData.urls)) {
        editSelectedUrls = mixedData.urls;
        displayEditUrls();
        // #region agent log
        const logEntry5 = {location:'editSession.js:284',message:'Loaded URLs into editSelectedUrls',data:{url_count:editSelectedUrls.length,urls:editSelectedUrls},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'};
        fetch('http://127.0.0.1:7242/ingest/cd85e294-0bef-430a-902e-994341727018',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logEntry5)}).catch(()=>{});
        // #endregion
      }
      // Files can't be restored as File objects, so we clear them
      editSelectedFiles = [];
      displayEditFiles();
      // #region agent log
      const logEntry6 = {location:'editSession.js:287',message:'Cleared editSelectedFiles (File objects cannot be restored)',data:{existing_files_in_mixed:mixedData.files,file_count_in_db:mixedData.files?.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'};
      fetch('http://127.0.0.1:7242/ingest/cd85e294-0bef-430a-902e-994341727018',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logEntry6)}).catch(()=>{});
      // #endregion
    } catch (e) {
      console.error('Failed to parse mixed reference data:', e);
    }
  }
  
  // Handle text references (can be text-only or in mixed)
  const editTextArea = document.getElementById('edit-reference-text');
  if (session.reference_type === 'text' && session.reference_text) {
    if (editTextArea) {
      editTextArea.value = session.reference_text;
      const textGroup = document.getElementById('edit-ref-text-group');
      if (textGroup) {
        textGroup.classList.remove('hidden');
      }
      // #region agent log
      const logTextLoad = {location:'editSession.js:341',message:'Loaded text reference',data:{text_length:session.reference_text.length,hasTextArea:!!editTextArea},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'};
      fetch('http://127.0.0.1:7242/ingest/cd85e294-0bef-430a-902e-994341727018',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logTextLoad)}).catch(()=>{});
      // #endregion
    }
  } else if (session.reference_type === 'mixed' && session.reference_url) {
    try {
      const mixedData = JSON.parse(session.reference_url);
      if (mixedData.text && editTextArea) {
        editTextArea.value = mixedData.text;
        const textGroup = document.getElementById('edit-ref-text-group');
        if (textGroup) {
          textGroup.classList.remove('hidden');
        }
        // #region agent log
        const logMixedTextLoad = {location:'editSession.js:354',message:'Loaded text from mixed reference',data:{text_length:mixedData.text.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'};
        fetch('http://127.0.0.1:7242/ingest/cd85e294-0bef-430a-902e-994341727018',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logMixedTextLoad)}).catch(()=>{});
        // #endregion
      }
    } catch (e) {}
  } else {
    // No references - ensure arrays are empty
    displayEditUrls();
    displayEditFiles();
  }
}

export async function saveSessionEdits() {
  const sessionId = parseInt(document.getElementById('edit-session-id').value);
  const spinner = document.getElementById('edit-spinner');
  spinner.classList.remove('hidden');
  
  // #region agent log
  const editTextArea = document.getElementById('edit-reference-text');
  const editTextValue = editTextArea ? editTextArea.value.trim() : '';
  const logEntry7 = {location:'editSession.js:347',message:'saveSessionEdits ENTRY',data:{sessionId,editSelectedUrls_count:editSelectedUrls.length,editSelectedUrls,editSelectedFiles_count:editSelectedFiles.length,editTextValue_length:editTextValue.length,hasEditTextArea:!!editTextArea},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'};
  fetch('http://127.0.0.1:7242/ingest/cd85e294-0bef-430a-902e-994341727018',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logEntry7)}).catch(()=>{});
  // #endregion
  
  console.log('=== SAVE SESSION EDITS ===');
  console.log('Session ID:', sessionId);
  console.log('editSelectedUrls:', editSelectedUrls);
  console.log('editSelectedFiles:', editSelectedFiles);
  
  const updates = {
    task_name: document.getElementById('edit-task-name').value.trim(),
    task_description: document.getElementById('edit-task-description').value.trim(),
    duration_minutes: parseInt(document.getElementById('edit-duration').value)
  };
  
  console.log('Base updates:', updates);
  
  try {
    const hasUrls = editSelectedUrls.length > 0;
    const hasFiles = editSelectedFiles.length > 0;
    const editTextArea = document.getElementById('edit-reference-text');
    const hasText = editTextArea && editTextArea.value.trim().length > 0;
    const referenceCount = [hasUrls, hasFiles, hasText].filter(Boolean).length;
    
    // #region agent log
    const logEntry7b = {location:'editSession.js:373',message:'Reference counts calculated',data:{hasUrls,hasFiles,hasText,referenceCount,textValue_length:editTextArea?.value.trim().length||0},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'};
    fetch('http://127.0.0.1:7242/ingest/cd85e294-0bef-430a-902e-994341727018',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logEntry7b)}).catch(()=>{});
    // #endregion
    
    console.log('Has URLs:', hasUrls);
    console.log('Has Files:', hasFiles);
    console.log('Reference Count:', referenceCount);
    
    // Handle mixed references (URLs + Files together)
    if (referenceCount > 1) {
      console.log('Processing MIXED references');
      const mixedData = {};
      
      // #region agent log
      const logEntry8 = {location:'editSession.js:327',message:'Processing MIXED references',data:{hasUrls,hasFiles,editSelectedUrls_count:editSelectedUrls.length,editSelectedFiles_count:editSelectedFiles.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'};
      fetch('http://127.0.0.1:7242/ingest/cd85e294-0bef-430a-902e-994341727018',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logEntry8)}).catch(()=>{});
      // #endregion
      
      // Load current session to preserve existing references
      const currentSession = await window.electronAPI.getSession(sessionId);
      
      if (hasUrls) {
        mixedData.urls = editSelectedUrls;
        // #region agent log
        const logEntry9 = {location:'editSession.js:332',message:'Setting mixedData.urls',data:{urls:mixedData.urls,url_count:mixedData.urls.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'};
        fetch('http://127.0.0.1:7242/ingest/cd85e294-0bef-430a-902e-994341727018',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logEntry9)}).catch(()=>{});
        // #endregion
      } else if (currentSession.success && currentSession.session.reference_type === 'mixed' && currentSession.session.reference_url) {
        // Preserve existing URLs from mixed data even if no new URLs added
        try {
          const existingMixedData = JSON.parse(currentSession.session.reference_url);
          if (existingMixedData.urls && Array.isArray(existingMixedData.urls)) {
            mixedData.urls = existingMixedData.urls;
            // #region agent log
            const logEntry10 = {location:'editSession.js:340',message:'Preserved existing URLs from mixed (no new URLs)',data:{preserved_urls_count:mixedData.urls.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'G'};
            fetch('http://127.0.0.1:7242/ingest/cd85e294-0bef-430a-902e-994341727018',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logEntry10)}).catch(()=>{});
            // #endregion
          }
        } catch (e) {}
      }
      
      if (hasFiles) {
        showAlert(`Uploading ${editSelectedFiles.length} file(s)...`, 'success');
        
        const uploadedPaths = [];
        // #region agent log
        const logEntry11 = {location:'editSession.js:340',message:'Loaded currentSession for file merge',data:{success:currentSession.success,reference_type:currentSession.session?.reference_type,has_reference_file_path:!!currentSession.session?.reference_file_path,has_reference_url:!!currentSession.session?.reference_url},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'};
        fetch('http://127.0.0.1:7242/ingest/cd85e294-0bef-430a-902e-994341727018',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logEntry11)}).catch(()=>{});
        // #endregion
        
        if (currentSession.success && currentSession.session.reference_file_path) {
          try {
            const existingFiles = JSON.parse(currentSession.session.reference_file_path);
            uploadedPaths.push(...existingFiles);
            // #region agent log
            const logEntry12 = {location:'editSession.js:345',message:'Added existing files from reference_file_path',data:{existing_files_count:existingFiles.length,uploadedPaths_count:uploadedPaths.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'};
            fetch('http://127.0.0.1:7242/ingest/cd85e294-0bef-430a-902e-994341727018',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logEntry12)}).catch(()=>{});
            // #endregion
          } catch (e) {}
        } else if (currentSession.success && currentSession.session.reference_type === 'mixed' && currentSession.session.reference_url) {
          try {
            const existingMixedData = JSON.parse(currentSession.session.reference_url);
            if (existingMixedData.files && Array.isArray(existingMixedData.files)) {
              uploadedPaths.push(...existingMixedData.files);
              // #region agent log
              const logEntry13 = {location:'editSession.js:353',message:'Added existing files from mixed reference_url',data:{existing_files_in_mixed:existingMixedData.files.length,uploadedPaths_count:uploadedPaths.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'};
              fetch('http://127.0.0.1:7242/ingest/cd85e294-0bef-430a-902e-994341727018',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logEntry13)}).catch(()=>{});
              // #endregion
            }
          } catch (e) {}
        }
        
        console.log('Starting to upload', editSelectedFiles.length, 'files for MIXED');
        for (const file of editSelectedFiles) {
          console.log('Uploading file:', file.name);
          const fileBuffer = await file.arrayBuffer();
          const uploadResult = await window.electronAPI.uploadFile({
            fileName: file.name,
            fileBuffer: Array.from(new Uint8Array(fileBuffer)),
            userId: currentUser.userId
          });
          
          if (!uploadResult.success) {
            throw new Error(`Failed to upload ${file.name}`);
          }
          
          console.log('Upload result:', uploadResult);
          uploadedPaths.push(uploadResult.filePath);
          console.log('uploadedPaths now has', uploadedPaths.length, 'files');
        }
        
        console.log('All files uploaded for MIXED. Total paths:', uploadedPaths);
        mixedData.files = uploadedPaths;
        console.log('mixedData.files:', mixedData.files);
        // #region agent log
        const logEntry14 = {location:'editSession.js:368',message:'Final mixedData.files set',data:{file_count:mixedData.files.length,files:mixedData.files},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'};
        fetch('http://127.0.0.1:7242/ingest/cd85e294-0bef-430a-902e-994341727018',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logEntry14)}).catch(()=>{});
        // #endregion
      } else if (currentSession.success && currentSession.session.reference_type === 'mixed' && currentSession.session.reference_url) {
        // Preserve existing files from mixed data even if no new files added
        try {
          const existingMixedData = JSON.parse(currentSession.session.reference_url);
          if (existingMixedData.files && Array.isArray(existingMixedData.files)) {
            mixedData.files = existingMixedData.files;
            // #region agent log
            const logEntry15 = {location:'editSession.js:525',message:'Preserved existing files from mixed (no new files)',data:{preserved_files_count:mixedData.files.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'G'};
            fetch('http://127.0.0.1:7242/ingest/cd85e294-0bef-430a-902e-994341727018',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logEntry15)}).catch(()=>{});
            // #endregion
          }
        } catch (e) {}
      }
      
      // Handle text in mixed references
      if (hasText) {
        const editTextArea = document.getElementById('edit-reference-text');
        if (editTextArea) {
          mixedData.text = editTextArea.value.trim();
        }
      } else if (currentSession.success && currentSession.session.reference_type === 'mixed' && currentSession.session.reference_url) {
        // Preserve existing text from mixed data even if no new text added
        try {
          const existingMixedData = JSON.parse(currentSession.session.reference_url);
          if (existingMixedData.text) {
            mixedData.text = existingMixedData.text;
          }
        } catch (e) {}
      } else if (currentSession.success && currentSession.session.reference_text) {
        // Preserve text if it was text-only before
        mixedData.text = currentSession.session.reference_text;
      }
      
      updates.reference_type = 'mixed';
      updates.reference_url = JSON.stringify(mixedData);
      // #region agent log
      const logEntry16 = {location:'editSession.js:382',message:'Final mixed updates prepared',data:{mixedData,reference_url:updates.reference_url},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'};
      fetch('http://127.0.0.1:7242/ingest/cd85e294-0bef-430a-902e-994341727018',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logEntry16)}).catch(()=>{});
      // #endregion
      console.log('Mixed updates:', { reference_type: updates.reference_type, reference_url: updates.reference_url });
    }
    // Handle single reference type (only URLs)
    else if (hasUrls) {
      console.log('Processing URL-only references');
      
      // Check if we need to preserve existing files when converting from mixed/file to url-only
      const currentSession = await window.electronAPI.getSession(sessionId);
      // #region agent log
      const logEntry17 = {location:'editSession.js:377',message:'URL-only save: checking current session',data:{success:currentSession.success,current_reference_type:currentSession.session?.reference_type,has_files:!!currentSession.session?.reference_file_path},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'I'};
      fetch('http://127.0.0.1:7242/ingest/cd85e294-0bef-430a-902e-994341727018',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logEntry17)}).catch(()=>{});
      // #endregion
      
      updates.reference_type = 'url';
      updates.reference_url = JSON.stringify(editSelectedUrls);
      // #region agent log
      const logEntry18 = {location:'editSession.js:381',message:'URL-only updates prepared',data:{urls:editSelectedUrls,url_count:editSelectedUrls.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'I'};
      fetch('http://127.0.0.1:7242/ingest/cd85e294-0bef-430a-902e-994341727018',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logEntry18)}).catch(()=>{});
      // #endregion
      console.log('URL updates:', { reference_type: updates.reference_type, reference_url: updates.reference_url });
    }
    // Handle single reference type (only Files) - including when no new files but existing files need preservation
    else if (hasFiles) {
      console.log('Processing FILE-only references');
      showAlert(`Uploading ${editSelectedFiles.length} file(s)...`, 'success');
      
      const uploadedPaths = [];
      
      const currentSession = await window.electronAPI.getSession(sessionId);
      // #region agent log
      const logFileOnly = {location:'editSession.js:575',message:'FILE-only save: checking current session',data:{success:currentSession.success,current_reference_type:currentSession.session?.reference_type,has_reference_file_path:!!currentSession.session?.reference_file_path,new_files_count:editSelectedFiles.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'};
      fetch('http://127.0.0.1:7242/ingest/cd85e294-0bef-430a-902e-994341727018',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logFileOnly)}).catch(()=>{});
      // #endregion
      if (currentSession.success && currentSession.session.reference_file_path) {
        try {
          const existingFiles = JSON.parse(currentSession.session.reference_file_path);
          uploadedPaths.push(...existingFiles);
          // #region agent log
          const logExistingFiles = {location:'editSession.js:582',message:'Preserved existing files in file-only case',data:{existing_files_count:existingFiles.length,uploadedPaths_count:uploadedPaths.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'};
          fetch('http://127.0.0.1:7242/ingest/cd85e294-0bef-430a-902e-994341727018',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logExistingFiles)}).catch(()=>{});
          // #endregion
          console.log('Found existing files:', existingFiles);
        } catch (e) {
          console.log('No existing files or parse error');
        }
      }
      
      console.log('Starting to upload', editSelectedFiles.length, 'files');
      for (const file of editSelectedFiles) {
        console.log('Uploading file:', file.name);
        const fileBuffer = await file.arrayBuffer();
        const uploadResult = await window.electronAPI.uploadFile({
          fileName: file.name,
          fileBuffer: Array.from(new Uint8Array(fileBuffer)),
          userId: currentUser.userId
        });
        
        if (!uploadResult.success) {
          throw new Error(`Failed to upload ${file.name}`);
        }
        
        console.log('Upload result:', uploadResult);
        uploadedPaths.push(uploadResult.filePath);
        console.log('uploadedPaths now has', uploadedPaths.length, 'files');
      }

      console.log('All files uploaded. Total paths:', uploadedPaths);
      
      updates.reference_type = 'file';
      updates.reference_file_path = JSON.stringify(uploadedPaths);
      console.log('File updates:', { 
        reference_type: updates.reference_type, 
        reference_file_path: updates.reference_file_path 
      });
    }
    // Handle case where no new references added but session has files - preserve them
    else if (referenceCount === 0) {
      const currentSession = await window.electronAPI.getSession(sessionId);
      // #region agent log
      const logEmptyCheck = {location:'editSession.js:616',message:'referenceCount is 0 - checking for existing refs',data:{current_reference_type:currentSession.session?.reference_type,has_reference_file_path:!!currentSession.session?.reference_file_path,has_reference_text:!!currentSession.session?.reference_text},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'};
      fetch('http://127.0.0.1:7242/ingest/cd85e294-0bef-430a-902e-994341727018',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logEmptyCheck)}).catch(()=>{});
      // #endregion
      
      // If session has files but no new files added, preserve them
      if (currentSession.success && currentSession.session.reference_type === 'file' && currentSession.session.reference_file_path) {
        // #region agent log
        const logPreserveFiles = {location:'editSession.js:622',message:'No new files but preserving existing files',data:{current_reference_type:currentSession.session.reference_type},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'};
        fetch('http://127.0.0.1:7242/ingest/cd85e294-0bef-430a-902e-994341727018',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logPreserveFiles)}).catch(()=>{});
        // #endregion
        try {
          const existingFiles = JSON.parse(currentSession.session.reference_file_path);
          updates.reference_type = 'file';
          updates.reference_file_path = JSON.stringify(existingFiles);
          // #region agent log
          const logPreserved = {location:'editSession.js:628',message:'Preserved existing files (no new files)',data:{preserved_files_count:existingFiles.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'};
          fetch('http://127.0.0.1:7242/ingest/cd85e294-0bef-430a-902e-994341727018',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logPreserved)}).catch(()=>{});
          // #endregion
        } catch (e) {
          // If no files to preserve, clear all references
          updates.reference_type = null;
          updates.reference_url = null;
          updates.reference_file_path = null;
          updates.reference_text = null;
          console.log('Clearing all references');
        }
      } else {
        // No references to preserve - clear them
        updates.reference_type = null;
        updates.reference_url = null;
        updates.reference_file_path = null;
        updates.reference_text = null;
        console.log('Clearing all references');
      }
    }
    // Handle single reference type (only Text)
    else if (hasText) {
      console.log('Processing TEXT-only references');
      const editTextArea = document.getElementById('edit-reference-text');
      if (editTextArea) {
        updates.reference_type = 'text';
        updates.reference_text = editTextArea.value.trim();
        // #region agent log
        const logTextOnly = {location:'editSession.js:640',message:'TEXT-only updates prepared',data:{text_length:updates.reference_text.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'};
        fetch('http://127.0.0.1:7242/ingest/cd85e294-0bef-430a-902e-994341727018',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logTextOnly)}).catch(()=>{});
        // #endregion
        console.log('Text updates:', { reference_type: updates.reference_type, reference_text: updates.reference_text });
      }
    }
    
    console.log('Final updates object:', updates);
    console.log('Calling updateSession...');
    
    const result = await window.electronAPI.updateSession(sessionId, updates);
    
    console.log('Update result:', result);
    
    spinner.classList.add('hidden');
    
    if (result.success) {
      showAlert('Session updated successfully!', 'success');
      
      // Clear edit state
      clearEditReferences();
      
      // Get sessionId before clearing
      const sessionIdEl = document.getElementById('edit-session-id');
      const savedSessionId = sessionIdEl ? parseInt(sessionIdEl.value) : null;
      
      // Exit edit mode to show read-only view
      exitEditMode();
      
      // Reload session details to show updated references
      if (savedSessionId) {
        await loadSessionDetails(savedSessionId);
      }
      
      // Refresh lists
      await loadRecentSessions();
      if (document.getElementById('page-sessions').classList.contains('active')) {
        const filterBtn = document.querySelector('.filter-btn.active');
        const filter = filterBtn ? filterBtn.dataset.filter : 'all';
        await loadAllSessions(filter === 'all' ? null : filter);
      }
      
      return true;
    } else {
      showAlert(result.error, 'error');
      return false;
    }
  } catch (error) {
    spinner.classList.add('hidden');
    console.error('Save edits error:', error);
    showAlert('Failed to save changes: ' + error.message, 'error');
    return false;
  }
}