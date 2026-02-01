/**
 * Theme management module
 * Handles light/dark theme switching and persistence
 */

const THEME_KEY = 'focusai-theme';
const THEME_LIGHT = 'light';
const THEME_DARK = 'dark';

/**
 * Initializes the theme system
 * Loads saved theme preference or defaults to light mode
 */
export function initTheme() {
  const savedTheme = localStorage.getItem(THEME_KEY) || THEME_LIGHT;
  setTheme(savedTheme);
  updateThemeToggleIcon(savedTheme);
}

/**
 * Sets the theme for the application
 * @param {string} theme - 'light' or 'dark'
 */
export function setTheme(theme) {
  const root = document.documentElement;
  
  if (theme === THEME_DARK) {
    root.setAttribute('data-theme', THEME_DARK);
  } else {
    root.setAttribute('data-theme', THEME_LIGHT);
  }
  
  localStorage.setItem(THEME_KEY, theme);
  updateThemeToggleIcon(theme);
}

/**
 * Toggles between light and dark theme
 */
export function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme') || THEME_LIGHT;
  const newTheme = currentTheme === THEME_DARK ? THEME_LIGHT : THEME_DARK;
  setTheme(newTheme);
}

/**
 * Updates the theme toggle button icon
 * @param {string} theme - Current theme
 */
function updateThemeToggleIcon(theme) {
  const toggleBtn = document.getElementById('theme-toggle');
  if (!toggleBtn) return;
  
  const icon = toggleBtn.querySelector('.theme-toggle-icon');
  if (icon) {
    icon.textContent = theme === THEME_DARK ? '☀️' : '🌙';
  }
  
  // Update settings page toggle if it exists
  const settingsToggle = document.getElementById('settings-theme-toggle');
  if (settingsToggle) {
    settingsToggle.checked = theme === THEME_DARK;
  }
}

/**
 * Gets the current theme
 * @returns {string} Current theme ('light' or 'dark')
 */
export function getCurrentTheme() {
  return document.documentElement.getAttribute('data-theme') || THEME_LIGHT;
}

/**
 * Sets up the theme toggle button event listener
 */
export function setupThemeToggle() {
  const toggleBtn = document.getElementById('theme-toggle');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', toggleTheme);
  }
  
  // Setup settings page toggle - will be set up when navigating to settings
  setupSettingsPageToggle();
}

/**
 * Sets up the settings page theme toggle
 */
export function setupSettingsPageToggle() {
  const settingsToggle = document.getElementById('settings-theme-toggle');
  if (!settingsToggle) return;
  
  // Remove existing listeners by cloning
  const newToggle = settingsToggle.cloneNode(true);
  settingsToggle.parentNode.replaceChild(newToggle, settingsToggle);
  
  // Set initial state
  const currentTheme = getCurrentTheme();
  newToggle.checked = currentTheme === THEME_DARK;
  
  // Add event listener
  newToggle.addEventListener('change', (e) => {
    const newTheme = e.target.checked ? THEME_DARK : THEME_LIGHT;
    setTheme(newTheme);
  });
}