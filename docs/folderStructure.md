# FocusAI Folder Structure

This document describes the folder structure of the FocusAI application.

## Root Directory

- `main.js` - Main Electron application entry point
- `preload.js` - Preload script for Electron security bridge
- `package.json` - Node.js package configuration
- `README.md` - Project overview and documentation
- `Reference.md` - Reference documentation
- `folderStructure.md` - This file (folder structure documentation)
- `explain.md` - Detailed explanation of files and modules

## Frontend (`frontend/`)

### Pages (`frontend/pages/`)
- `auth.html` - Authentication page (login/signup)
- `dashboard.html` - Main dashboard page

### JavaScript (`frontend/js/`)
- `auth.js` - Authentication handling (login/signup forms)
- `dashboard.js` - Main dashboard logic and initialization

### Modules (`frontend/js/modules/`)
- `auth.js` - Authentication module (user state, token verification)
- `stats.js` - Statistics loading module
- `activeSession.js` - Active session management
- `sessionsList.js` - Sessions list display
- `sessionActions.js` - Session actions (start/stop/pause/resume)
- `createSession.js` - Session creation module
- `editSession.js` - Session editing module (form initialization)
- `editSessionReferences.js` - Session reference editing (URLs, files, text)
- `editSessionSave.js` - Session save functionality
- `sessionModal.js` - Session modal/view module
- `theme.js` - Theme management (light/dark mode)
- `utils.js` - Utility functions (HTML escaping, file icons, alerts)

### CSS (`frontend/css/`)
- `global.css` - Global styles
- `auth.css` - Authentication page styles
- `dashboard.css` - Dashboard page styles
- `session-modal.css` - Session modal styles

### Assets (`frontend/assests/`)
- Static assets (images, icons, etc.)

### Logos (`frontend/logos/`)
- Application logos and branding assets

## Backend (`backend/`)

### Database (`backend/database/`)
- `connection.js` - Database connection and table initialization
- `repositories/`
  - `userRepository.js` - User data access layer
  - `sessionRepository.js` - Session data access layer

### Services (`backend/services/`)
- `authService.js` - Authentication business logic
- `sessionService.js` - Session management business logic
- `screenMonitor.js` - Screen capture functionality

### Utils (`backend/utils/`)
- `validators.js` - Input validation utilities

### Test (`backend/test/`)
- Test files

### Root Test Files
- `testAuth.js` - Authentication testing (root level)

## Data (`data/`)
- `focusai.db` - SQLite database file

## Uploads (`uploads/`)
- User-uploaded files organized by user ID
- Files stored as `uploads/{userId}/{filename_timestamp.ext}`

## AI Layer (`aiLayer/`)
- AI-related functionality (to be implemented)

## FocusAI (`FocusAI/`)
- `README.md` - Additional documentation

## Docs (`docs/`)
- `explain.md` - Detailed explanation of files and modules
- `folderStructure.md` - This file (folder structure documentation)
- `plan.md` - Project implementation plan
- `current.md` - Current project status
- `choices.md` - Architectural decisions and rationale

## Screenshots (`backend/screenshots/`)
- Screenshots captured by screenMonitor service
- Generated automatically when screen capture is used

---

*Last updated: 2024-12-26*
