// Auth page - Login/Signup functionality

let currentTab = 'login';

// ==================== Initialization ====================
window.addEventListener('DOMContentLoaded', () => {
  // Initialize theme system
  initTheme();
  setupEventListeners();
  checkIfAlreadyLoggedIn();
});

// ==================== Theme Management ====================
function initTheme() {
  const savedTheme = localStorage.getItem('focusai-theme') || 'light';
  const root = document.documentElement;
  root.setAttribute('data-theme', savedTheme);
}

function setTheme(theme) {
  const root = document.documentElement;
  root.setAttribute('data-theme', theme);
  localStorage.setItem('focusai-theme', theme);
}

async function checkIfAlreadyLoggedIn() {
  const token = localStorage.getItem('focusai_token');
  if (token) {
    const verification = await window.electronAPI.verifyToken(token);
    if (verification.success) {
      window.location.href = 'dashboard.html';
    }
  }
}

// ==================== Event Listeners ====================
function setupEventListeners() {
  // Tab switching
  document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      switchTab(tab.dataset.tab);
    });
  });

  // Form submissions
  document.getElementById('login-form').addEventListener('submit', handleLogin);
  document.getElementById('signup-form').addEventListener('submit', handleSignup);
}

// ==================== Tab Switching ====================
function switchTab(tab) {
  currentTab = tab;

  // Update active tab button
  document.querySelectorAll('.auth-tab').forEach(btn => {
    btn.classList.remove('active');
    if (btn.dataset.tab === tab) {
      btn.classList.add('active');
    }
  });

  // Update active form
  document.querySelectorAll('.auth-form').forEach(form => {
    form.classList.remove('active');
  });

  if (tab === 'login') {
    document.getElementById('login-form').classList.add('active');
  } else {
    document.getElementById('signup-form').classList.add('active');
  }

  // Clear alert
  hideAlert();
}

// ==================== Login ====================
async function handleLogin(e) {
  e.preventDefault();

  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;

  if (!username || !password) {
    showAlert('Please fill in all fields', 'error');
    return;
  }

  const spinner = document.getElementById('login-spinner');
  spinner.classList.remove('hidden');

  try {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/cd85e294-0bef-430a-902e-994341727018',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth.js:78',message:'Login attempt started',data:{username},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    const result = await window.electronAPI.login(username, password);

    // #region agent log
    console.log('[DEBUG] Login result:', result);
    fetch('http://127.0.0.1:7242/ingest/cd85e294-0bef-430a-902e-994341727018',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth.js:83',message:'Login result received',data:{success:result?.success,hasUserId:!!result?.userId,hasUser:!!result?.user,resultKeys:result?Object.keys(result):[],resultStr:JSON.stringify(result)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion

    spinner.classList.add('hidden');

    if (result && result.success) {
      // Store auth data
      localStorage.setItem('focusai_token', result.token);
      localStorage.setItem('focusai_user', JSON.stringify({
        userId: result.userId,
        username: result.username,
        email: result.email
      }));

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/cd85e294-0bef-430a-902e-994341727018',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth.js:95',message:'Login success - storing auth data',data:{userId:result.userId,username:result.username,email:result.email},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion

      showAlert('Login successful! Redirecting...', 'success');

      // Redirect to dashboard
      setTimeout(() => {
        window.location.href = 'dashboard.html';
      }, 500);
    } else {
      showAlert(result.error, 'error');
    }
  } catch (error) {
    spinner.classList.add('hidden');
    console.error('Login error:', error);
    showAlert('Login failed. Please try again.', 'error');
  }
}

// ==================== Signup ====================
async function handleSignup(e) {
  e.preventDefault();

  const username = document.getElementById('signup-username').value.trim();
  const email = document.getElementById('signup-email').value.trim();
  const password = document.getElementById('signup-password').value;
  const confirmPassword = document.getElementById('signup-confirm-password').value;

  // Validation
  if (!username || !email || !password || !confirmPassword) {
    showAlert('Please fill in all fields', 'error');
    return;
  }

  if (username.length < 3 || username.length > 20) {
    showAlert('Username must be between 3 and 20 characters', 'error');
    return;
  }

  if (password.length < 6) {
    showAlert('Password must be at least 6 characters', 'error');
    return;
  }

  if (password !== confirmPassword) {
    showAlert('Passwords do not match', 'error');
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    showAlert('Please enter a valid email address', 'error');
    return;
  }

  const spinner = document.getElementById('signup-spinner');
  spinner.classList.remove('hidden');

  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/cd85e294-0bef-430a-902e-994341727018',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth.js:146',message:'Signup attempt started',data:{username,email,hasRegister:typeof window.electronAPI?.register,hasSignup:typeof window.electronAPI?.signup},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion

  try {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/cd85e294-0bef-430a-902e-994341727018',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth.js:150',message:'Calling signup method',data:{method:'signup'},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    const result = await window.electronAPI.signup(username, email, password);

    // #region agent log
    console.log('[DEBUG] Signup result:', result);
    fetch('http://127.0.0.1:7242/ingest/cd85e294-0bef-430a-902e-994341727018',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth.js:156',message:'Signup result received',data:{success:result?.success,hasError:!!result?.error,error:result?.error,resultKeys:result?Object.keys(result):[],resultStr:JSON.stringify(result)},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'B'})}).catch(()=>{});
    // #endregion

    spinner.classList.add('hidden');

    if (result && result.success) {
      showAlert('Account created successfully! Please login.', 'success');

      // Clear form
      document.getElementById('signup-form').reset();

      // Switch to login tab after 1.5 seconds
      setTimeout(() => {
        switchTab('login');
        // Pre-fill login username
        document.getElementById('login-username').value = username;
      }, 1500);
    } else {
      showAlert(result.error, 'error');
    }
  } catch (error) {
    spinner.classList.add('hidden');
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/cd85e294-0bef-430a-902e-994341727018',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth.js:170',message:'Signup catch block',data:{errorType:error?.constructor?.name,errorMessage:error?.message,errorStack:error?.stack?.substring(0,200)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    console.error('Signup error:', error);
    showAlert('Registration failed. Please try again.', 'error');
  }
}

// ==================== Alert Helpers ====================
function showAlert(message, type = 'error') {
  const alert = document.getElementById('alert');
  alert.textContent = message;
  alert.className = `alert alert-${type} show`;
}

function hideAlert() {
  const alert = document.getElementById('alert');
  alert.className = 'alert';
}
