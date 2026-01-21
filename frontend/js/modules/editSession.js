// Edit session module
// Main coordination module for editing sessions

import { initializeEditReferences, displayEditUrls, displayEditFiles, setEditSelectedUrls, setEditSelectedFiles, clearEditReferences } from './editSessionReferences.js';
import { saveSessionEdits } from './editSessionSave.js';

export { initializeEditReferences, clearEditReferences, saveSessionEdits };
export { removeEditUrl, removeEditFile } from './editSessionReferences.js';

export async function loadExistingReferences() {
  const sessionIdEl = document.getElementById('edit-session-id');
  if (!sessionIdEl || !sessionIdEl.value) return;
  
  const sessionId = parseInt(sessionIdEl.value);
  const result = await window.electronAPI.getSession(sessionId);
  
  if (!result || !result.success) return;
  
  const session = result.session;
  // Clear arrays first
  setEditSelectedUrls([]);
  setEditSelectedFiles([]);
  
  if (session.reference_type === 'url' && session.reference_url) {
    try {
      const urls = JSON.parse(session.reference_url);
      if (Array.isArray(urls)) {
        setEditSelectedUrls(urls);
        displayEditUrls();
      } else {
        setEditSelectedUrls([session.reference_url]);
        displayEditUrls();
      }
      const urlGroup = document.getElementById('edit-ref-url-group');
      if (urlGroup) {
        urlGroup.classList.remove('hidden');
        urlGroup.classList.remove('collapsed'); // Ensure section is expanded when shown
        // Re-initialize to attach listeners
        setTimeout(() => initializeEditReferences(), 10);
      }
    } catch (e) {
      setEditSelectedUrls([session.reference_url]);
      displayEditUrls();
    }
  } else if (session.reference_type === 'file' && session.reference_file_path) {
    // Files are already uploaded, we can't reload File objects
    // But we can show existing file paths if needed
    // For now, just clear since we can't restore File objects
    setEditSelectedFiles([]);
    displayEditFiles();
  } else if (session.reference_type === 'mixed' && session.reference_url) {
    try {
      const mixedData = JSON.parse(session.reference_url);
      
      if (mixedData.urls && Array.isArray(mixedData.urls)) {
        setEditSelectedUrls(mixedData.urls);
        displayEditUrls();
        const urlGroup = document.getElementById('edit-ref-url-group');
        if (urlGroup) {
          urlGroup.classList.remove('hidden');
          urlGroup.classList.remove('collapsed'); // Ensure section is expanded when shown
          // Re-initialize to attach listeners
          setTimeout(() => initializeEditReferences(), 10);
        }
      }
      // Files can't be restored as File objects, so we clear them
      setEditSelectedFiles([]);
      displayEditFiles();
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
        textGroup.classList.remove('collapsed'); // Ensure section is expanded when shown
      }
    }
  } else if (session.reference_type === 'mixed' && session.reference_url) {
    try {
      const mixedData = JSON.parse(session.reference_url);
      if (mixedData.text && editTextArea) {
        editTextArea.value = mixedData.text;
        const textGroup = document.getElementById('edit-ref-text-group');
        if (textGroup) {
          textGroup.classList.remove('hidden');
          textGroup.classList.remove('collapsed'); // Ensure section is expanded when shown
        }
      }
    } catch (e) {}
  } else {
    // No references - ensure arrays are empty
    displayEditUrls();
    displayEditFiles();
  }
}
