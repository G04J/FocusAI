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
    const result = await window.electronAPI.login(username, password);

    spinner.classList.add('hidden');

    if (result && result.success) {
      // Store auth data
      localStorage.setItem('focusai_token', result.token);
      localStorage.setItem('focusai_user', JSON.stringify({
        userId: result.userId,
        username: result.username,
        email: result.email
      }));

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

  try {
    const result = await window.electronAPI.signup(username, email, password);

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
