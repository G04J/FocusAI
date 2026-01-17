/**
 * Utility functions module
 * Provides common helper functions used across the application
 */

/**
 * Escapes HTML special characters to prevent XSS attacks
 * @param {string} text - The text to escape
 * @returns {string} The escaped HTML string
 */
export function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Gets an appropriate file type label for a file based on its extension
 * @param {string} filename - The filename with extension
 * @returns {string} The file type label
 */
export function getFileIcon(filename) {
  if (!filename) return 'File';
  const ext = filename.split('.').pop().toLowerCase();
  const types = {
    pdf: 'PDF',
    doc: 'DOC',
    docx: 'DOC',
    txt: 'TXT',
    png: 'IMG',
    jpg: 'IMG',
    jpeg: 'IMG',
    zip: 'ZIP',
    rar: 'RAR'
  };
  return types[ext] || ext.toUpperCase() || 'File';
}

/**
 * Formats file size in bytes to human-readable format
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted file size (e.g., "1.5 MB")
 */
export function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Shows an alert message to the user
 * @param {string} message - The message to display
 * @param {string} type - The alert type ('error', 'success', 'warning')
 */
export function showAlert(message, type = 'error') {
  const alert = document.getElementById('dashboard-alert');
  if (!alert) {
    console.warn('Alert element not found');
    return;
  }
  alert.textContent = message;
  alert.className = `alert alert-${type} show`;
  
  setTimeout(() => {
    if (alert) {
      alert.className = 'alert';
    }
  }, 5000);
}