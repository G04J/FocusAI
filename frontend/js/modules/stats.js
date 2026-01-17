/**
 * Stats module
 * Handles loading and displaying session statistics
 */

import { currentUser } from './auth.js';
import { showAlert } from './utils.js';

/**
 * Loads and displays session statistics on the dashboard
 */
export async function loadStats() {
  try {
    if (!currentUser || !currentUser.userId) {
      console.error('User not authenticated');
      return;
    }
    
    const result = await window.electronAPI.getSessionStats(currentUser.userId);
    
    if (result && result.success && result.stats) {
      const stats = result.stats;
      const totalSessionsEl = document.getElementById('stat-total-sessions');
      const focusTimeEl = document.getElementById('stat-focus-time');
      const completedEl = document.getElementById('stat-completed');
      
      if (totalSessionsEl) totalSessionsEl.textContent = stats.totalSessions || 0;
      if (focusTimeEl) focusTimeEl.textContent = `${stats.totalFocusHours || 0}h`;
      if (completedEl) completedEl.textContent = stats.completedSessions || 0;
    }
  } catch (error) {
    console.error('Stats load error:', error);
    showAlert('Failed to load statistics', 'error');
  }
}