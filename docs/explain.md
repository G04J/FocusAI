# FocusAI - File Explanations

This document explains what each file and module does in the FocusAI application.

## Main Application Files

### `main.js`
Main Electron application entry point. Handles:
- Window creation and management
- IPC (Inter-Process Communication) handlers for frontend-backend communication
- Service initialization (database, repositories, services)
- File upload handling
- Application lifecycle (window close, activate)

### `preload.js`
Electron preload script that safely exposes IPC methods to the renderer process. Bridges the gap between the frontend and backend while maintaining security (context isolation, node integration disabled).

## Frontend Files

### `frontend/pages/auth.html`
Authentication page HTML template with login and signup forms.

### `frontend/pages/dashboard.html`
Main dashboard HTML template with:
- Sidebar navigation
- Stats cards
- Active session display
- Sessions list
- Session modal

### `frontend/js/auth.js`
Authentication page JavaScript:
- Tab switching (login/signup)
- Form validation
- Login/signup API calls
- Token storage
- Redirect to dashboard

### `frontend/js/dashboard.js`
Main dashboard JavaScript (1666 lines):
- User authentication check
- Dashboard initialization
- Stats loading
- Active session management
- Session list display
- Session actions (start/stop/pause/resume/delete)
- Session modal/view/edit functionality
- Timer management
- Navigation between pages

**Note**: This file is large (1666 lines) and may need to be split into smaller modules per project rules.

### Frontend Modules (`frontend/js/modules/`)

#### `auth.js`
Authentication module:
- `currentUser` - Current user state
- `checkAuthentication()` - Verifies token and loads user data
- `logout()` - Logs out user

#### `stats.js`
Statistics module:
- `loadStats()` - Loads and displays session statistics (total sessions, focus time, completed)

#### `activeSession.js`
Active session management:
- Displays current active/paused session
- Timer functionality
- Session status updates

#### `sessionsList.js`
Sessions list display:
- Renders session cards
- Handles session filtering
- Displays session metadata

#### `sessionActions.js`
Session action handlers:
- Start session
- Stop session
- Pause session
- Resume session
- Delete session
- Restart session

#### `createSession.js`
Session creation module:
- Session creation form handling
- Reference material handling (URLs, files, text, mixed)
- File upload management
- Form validation

#### `editSession.js`
Session editing module:
- Edit session form initialization
- Form field management
- Edit mode entry/exit

#### `editSessionReferences.js`
Session reference editing module:
- URL reference management for editing
- File reference management for editing
- Text reference handling
- Reference display and removal
- Collapsible reference sections

#### `editSessionSave.js`
Session save functionality:
- Saves edited session data
- Handles mixed reference types (URLs + Files + Text)
- Preserves existing references when updating
- File upload during edit
- Session update API calls

#### `sessionModal.js`
Session view/edit modal:
- Display session details
- Reference material display
- Action buttons (start/stop/edit/delete)
- Modal open/close handling

#### `theme.js`
Theme management module:
- Light/dark theme switching
- Theme persistence in localStorage
- Theme toggle button management
- Settings page theme control

#### `utils.js`
Utility functions:
- `escapeHtml()` - Escapes HTML to prevent XSS
- `getFileIcon()` - Returns icon emoji for file type
- `formatFileSize()` - Formats bytes to human-readable size
- `showAlert()` - Displays alert messages to user

## Backend Files

### Database Layer

#### `backend/database/connection.js`
Database connection class:
- Initializes SQLite database connection
- Creates database directory if needed
- Initializes tables (users, focus_sessions, user_rules)
- Provides connection getter and close method

#### `backend/database/repositories/userRepository.js`
User data access layer:
- User CRUD operations
- Find by username/email
- Check if user exists
- Update last login

#### `backend/database/repositories/sessionRepository.js`
Session data access layer:
- Session CRUD operations
- Find by user ID and status
- Get active session
- Update session status
- Session timestamps management

### Services Layer

#### `backend/services/authService.js`
Authentication business logic:
- User signup with validation
- User login with password verification
- JWT token generation and verification
- User profile retrieval
- Uses validators for input validation

#### `backend/services/sessionService.js`
Session management business logic:
- Session creation with validation
- Session status management (start/stop/pause/resume)
- User statistics calculation
- Active session checks
- Session updates and deletion
- Session restart functionality

#### `backend/services/screenMonitor.js`
Screen monitoring service:
- Captures screenshots using Electron's desktopCapturer
- Saves screenshots to disk in `screenshots/` folder
- Returns screenshot file path
- Uses primary screen source
- Generates timestamped screenshot files

### Utilities

#### `backend/utils/validators.js`
Input validation utilities:
- `validateEmail()` - Email format validation
- `validateUsername()` - Username format validation
- `validatePassword()` - Password strength validation
- `validateSessionData()` - Session data validation

## Configuration Files

### `package.json`
Node.js package configuration:
- Dependencies: electron, bcrypt, better-sqlite3, electron-store, jsonwebtoken, screenshot-desktop
- Scripts: start (electron app)
- Metadata: name, version, description

## Data Files

### `data/focusai.db`
SQLite database file storing:
- User accounts
- Focus sessions
- User rules (for future use)

## Directory Structure Notes

- Files should not exceed ~500 lines of code (except when impossible to split further)
- All functions should include JSDoc comments
- This documentation should be updated when new files are added

---

## Additional Notes

### Module Organization
- Frontend modules are organized by functionality (auth, sessions, stats, etc.)
- Each module has a single responsibility
- Modules use ES6 import/export for better code organization
- Utility functions are centralized in `utils.js`

### Database Schema
- Users table: Stores user accounts with authentication
- Focus sessions table: Stores session data with flexible reference types
- User rules table: Prepared for future blocking/allowing functionality

### Security
- Context isolation enabled in Electron
- Node integration disabled in renderer
- Preload script bridges IPC communication securely
- Passwords hashed with bcrypt
- JWT tokens for authentication

### File Upload
- Files stored in `uploads/{userId}/` directory
- Unique filenames with timestamps
- 50MB file size limit per file
- File validation on frontend and backend

---

*Last updated: 2024-12-26*
