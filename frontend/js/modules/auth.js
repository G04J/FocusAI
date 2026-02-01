/**
 * Authentication module
 * Handles user authentication state and checks
 */

export let currentUser = null;

/**
 * Checks if user is authenticated and loads user data
 * Redirects to auth page if authentication fails
 * @returns {Promise<boolean>} True if authenticated, false otherwise
 */
export async function checkAuthentication() {
  try {
    const token = localStorage.getItem('focusai_token');
    const userDataStr = localStorage.getItem('focusai_user');
    
    if (!token || !userDataStr) {
      window.location.href = 'auth.html';
      return false;
    }
    
    const verification = await window.electronAPI.verifyToken(token);
    if (!verification || !verification.success) {
      localStorage.clear();
      window.location.href = 'auth.html';
      return false;
    }
    
    try {
      currentUser = JSON.parse(userDataStr);
    } catch (parseError) {
      console.error('Failed to parse user data:', parseError);
      localStorage.clear();
      window.location.href = 'auth.html';
      return false;
    }
    
    const userNameEl = document.getElementById('user-name');
    const userEmailEl = document.getElementById('user-email');
    if (userNameEl && currentUser.username) userNameEl.textContent = currentUser.username;
    if (userEmailEl && currentUser.email) userEmailEl.textContent = currentUser.email;
    
    return true;
  } catch (error) {
    console.error('Authentication check error:', error);
    localStorage.clear();
    window.location.href = 'auth.html';
    return false;
  }
}

/**
 * Logs out the current user and redirects to auth page
 */
export function logout() {
  if (confirm('Are you sure you want to logout?')) {
    localStorage.clear();
    window.location.href = 'auth.html';
  }
}