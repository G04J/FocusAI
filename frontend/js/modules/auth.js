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
  // #region agent log
  console.log('[DEBUG] auth.js: checkAuthentication entry');
  fetch('http://127.0.0.1:7242/ingest/cd85e294-0bef-430a-902e-994341727018',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth.js:14',message:'checkAuthentication entry',data:{timestamp:Date.now()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
  // #endregion
  try {
    const token = localStorage.getItem('focusai_token');
    const userDataStr = localStorage.getItem('focusai_user');
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/cd85e294-0bef-430a-902e-994341727018',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth.js:18',message:'Token check',data:{hasToken:!!token,hasUserData:!!userDataStr},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    
    if (!token || !userDataStr) {
      window.location.href = 'auth.html';
      return false;
    }
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/cd85e294-0bef-430a-902e-994341727018',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth.js:26',message:'Before verifyToken',data:{hasElectronAPI:!!window.electronAPI},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    const verification = await window.electronAPI.verifyToken(token);
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/cd85e294-0bef-430a-902e-994341727018',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth.js:30',message:'After verifyToken',data:{success:verification?.success},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
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
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/cd85e294-0bef-430a-902e-994341727018',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth.js:45',message:'checkAuthentication success',data:{userId:currentUser?.userId,username:currentUser?.username},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
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