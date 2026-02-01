// Edit session save module
// Handles saving session edits and reference data transformation

import { currentUser } from './auth.js';
import { showAlert } from './utils.js';
import { loadRecentSessions, loadAllSessions } from './sessionsList.js';
import { loadSessionDetails, exitEditMode } from './sessionModal.js';
import { clearEditReferences, getEditSelectedUrls, getEditSelectedFiles } from './editSessionReferences.js';

export async function saveSessionEdits() {
  const sessionId = parseInt(document.getElementById('edit-session-id').value);
  const spinner = document.getElementById('edit-spinner');
  spinner.classList.remove('hidden');
  
  const editSelectedUrls = getEditSelectedUrls();
  const editSelectedFiles = getEditSelectedFiles();
  
  const updates = {
    task_name: document.getElementById('edit-task-name').value.trim(),
    task_description: document.getElementById('edit-task-description').value.trim(),
    duration_minutes: parseInt(document.getElementById('edit-duration').value)
  };
  
  try {
    const hasUrls = editSelectedUrls.length > 0;
    const hasFiles = editSelectedFiles.length > 0;
    const editTextArea = document.getElementById('edit-reference-text');
    const hasText = editTextArea && editTextArea.value.trim().length > 0;
    const referenceCount = [hasUrls, hasFiles, hasText].filter(Boolean).length;
    
    // Handle mixed references (URLs + Files together)
    if (referenceCount > 1) {
      const mixedData = {};
      
      // Load current session to preserve existing references
      const currentSession = await window.electronAPI.getSession(sessionId);
      
      if (hasUrls) {
        mixedData.urls = editSelectedUrls;
      } else if (currentSession.success && currentSession.session.reference_type === 'mixed' && currentSession.session.reference_url) {
        // Preserve existing URLs from mixed data even if no new URLs added
        try {
          const existingMixedData = JSON.parse(currentSession.session.reference_url);
          if (existingMixedData.urls && Array.isArray(existingMixedData.urls)) {
            mixedData.urls = existingMixedData.urls;
          }
        } catch (e) {}
      }
      
      if (hasFiles) {
        showAlert(`Uploading ${editSelectedFiles.length} file(s)...`, 'success');
        
        const uploadedPaths = [];
        
        if (currentSession.success && currentSession.session.reference_file_path) {
          try {
            const existingFiles = JSON.parse(currentSession.session.reference_file_path);
            uploadedPaths.push(...existingFiles);
          } catch (e) {}
        } else if (currentSession.success && currentSession.session.reference_type === 'mixed' && currentSession.session.reference_url) {
          try {
            const existingMixedData = JSON.parse(currentSession.session.reference_url);
            if (existingMixedData.files && Array.isArray(existingMixedData.files)) {
              uploadedPaths.push(...existingMixedData.files);
            }
          } catch (e) {}
        }
        
        for (const file of editSelectedFiles) {
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
      } else if (currentSession.success && currentSession.session.reference_type === 'mixed' && currentSession.session.reference_url) {
        // Preserve existing files from mixed data even if no new files added
        try {
          const existingMixedData = JSON.parse(currentSession.session.reference_url);
          if (existingMixedData.files && Array.isArray(existingMixedData.files)) {
            mixedData.files = existingMixedData.files;
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
    }
    // Handle single reference type (only URLs)
    else if (hasUrls) {
      updates.reference_type = 'url';
      updates.reference_url = JSON.stringify(editSelectedUrls);
    }
    // Handle single reference type (only Files)
    else if (hasFiles) {
      showAlert(`Uploading ${editSelectedFiles.length} file(s)...`, 'success');
      
      const uploadedPaths = [];
      
      const currentSession = await window.electronAPI.getSession(sessionId);
      if (currentSession.success && currentSession.session.reference_file_path) {
        try {
          const existingFiles = JSON.parse(currentSession.session.reference_file_path);
          uploadedPaths.push(...existingFiles);
        } catch (e) {}
      }
      
      for (const file of editSelectedFiles) {
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
      
      updates.reference_type = 'file';
      updates.reference_file_path = JSON.stringify(uploadedPaths);
    }
    // Handle case where no new references added but session has files - preserve them
    else if (referenceCount === 0) {
      const currentSession = await window.electronAPI.getSession(sessionId);
      
      // If session has files but no new files added, preserve them
      if (currentSession.success && currentSession.session.reference_type === 'file' && currentSession.session.reference_file_path) {
        try {
          const existingFiles = JSON.parse(currentSession.session.reference_file_path);
          updates.reference_type = 'file';
          updates.reference_file_path = JSON.stringify(existingFiles);
        } catch (e) {
          // If no files to preserve, clear all references
          updates.reference_type = null;
          updates.reference_url = null;
          updates.reference_file_path = null;
          updates.reference_text = null;
        }
      } else {
        // No references to preserve - clear them
        updates.reference_type = null;
        updates.reference_url = null;
        updates.reference_file_path = null;
        updates.reference_text = null;
      }
    }
    // Handle single reference type (only Text)
    else if (hasText) {
      const editTextArea = document.getElementById('edit-reference-text');
      if (editTextArea) {
        updates.reference_type = 'text';
        updates.reference_text = editTextArea.value.trim();
      }
    }
    
    const result = await window.electronAPI.updateSession(sessionId, updates);
    
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
