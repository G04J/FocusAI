# FocusAI - Architectural Choices

This document explains the key architectural and design decisions made during the development of FocusAI and the rationale behind them.

## Technology Stack Choices

### Electron Framework
**Choice**: Use Electron for desktop application
**Rationale**:
- Cross-platform support (Windows, macOS, Linux)
- Native desktop capabilities (screen capture, file system access)
- Web technologies (HTML/CSS/JS) for rapid UI development
- Single codebase for all platforms

### SQLite Database
**Choice**: Use SQLite (better-sqlite3) for data storage
**Rationale**:
- Local storage keeps user data secure and private
- No external database server required
- Lightweight and fast for single-user application
- ACID compliance for data integrity
- Better-sqlite3 provides synchronous API which is simpler for our use case

### JWT Authentication
**Choice**: Use JSON Web Tokens for authentication
**Rationale**:
- Stateless authentication (no server-side session storage needed)
- Secure token-based system
- Easy to verify and validate
- Standard industry practice

### bcrypt for Password Hashing
**Choice**: Use bcrypt for password hashing
**Rationale**:
- Industry standard for password hashing
- Built-in salting
- Computationally expensive (slows down brute force attacks)
- Well-tested and secure

## Architecture Decisions

### Modular Frontend Structure
**Choice**: Split frontend code into separate modules
**Rationale**:
- Better code organization and maintainability
- Single responsibility principle
- Easier to test and debug
- Reusable components
- Files stay under ~500 lines (project rule)

**Modules Created**:
- `auth.js` - Authentication state
- `stats.js` - Statistics loading
- `activeSession.js` - Active session management
- `sessionsList.js` - Session list display
- `sessionActions.js` - Session control actions
- `createSession.js` - Session creation
- `editSession.js` - Session editing
- `editSessionReferences.js` - Reference management
- `editSessionSave.js` - Save functionality
- `sessionModal.js` - Modal display
- `theme.js` - Theme management
- `utils.js` - Shared utilities

### Repository Pattern
**Choice**: Use repository pattern for data access
**Rationale**:
- Separation of concerns (data access vs business logic)
- Easier to test (can mock repositories)
- Centralized database queries
- Easy to swap database implementation if needed

**Repositories**:
- `userRepository.js` - User data operations
- `sessionRepository.js` - Session data operations

### Service Layer
**Choice**: Implement service layer for business logic
**Rationale**:
- Business logic separated from data access
- Can add validation, transformations, etc.
- Easier to test business logic independently
- Single point for complex operations

**Services**:
- `authService.js` - Authentication logic
- `sessionService.js` - Session management logic
- `screenMonitor.js` - Screen capture logic

### IPC Communication
**Choice**: Use Electron IPC for frontend-backend communication
**Rationale**:
- Secure communication channel
- Context isolation maintained
- Preload script bridges the gap safely
- Standard Electron pattern

### Reference Type Flexibility
**Choice**: Support multiple reference types (URL, File, Text, Mixed)
**Rationale**:
- Users have different needs for reference materials
- Flexible schema allows future expansion
- Mixed type allows combining all reference types
- JSON storage for complex data structures

**Implementation**:
- `reference_type` column stores the type
- `reference_url` stores URLs or mixed data (JSON)
- `reference_file_path` stores file paths (JSON array)
- `reference_text` stores plain text

### File Upload System
**Choice**: Store files in `uploads/{userId}/` directory
**Rationale**:
- Organized by user for easy management
- Unique filenames with timestamps prevent conflicts
- Easy to implement per-user file quotas
- Simple file path storage in database

### Session Status Management
**Choice**: Use status field with specific states
**Rationale**:
- Clear state machine for session lifecycle
- Easy to query sessions by status
- Prevents invalid state transitions
- Statuses: planned, active, paused, stopped, completed

### Timer Implementation
**Choice**: Client-side timer with periodic updates
**Rationale**:
- Real-time updates without constant server calls
- Better user experience (smooth updates)
- Server stores actual start/end times for accuracy
- Client calculates elapsed time from server timestamps

### Theme System
**Choice**: CSS custom properties with data-theme attribute
**Rationale**:
- Simple and performant
- Easy to switch themes
- Persistent in localStorage
- No framework dependencies

## Security Choices

### Context Isolation
**Choice**: Enable context isolation, disable node integration
**Rationale**:
- Prevents renderer from accessing Node.js APIs directly
- Reduces attack surface
- Electron security best practice
- Preload script provides controlled API exposure

### Input Validation
**Choice**: Validate inputs on both frontend and backend
**Rationale**:
- Frontend validation for better UX (immediate feedback)
- Backend validation for security (never trust client)
- Centralized validators for consistency

### Password Security
**Choice**: Hash passwords with bcrypt, never store plaintext
**Rationale**:
- Industry standard security practice
- Even if database is compromised, passwords are protected
- bcrypt is computationally expensive (slows brute force)

## Future Design Considerations

### AI Analysis Approach
**Planned Choice**: Layered analysis (quick scan → detailed analysis)
**Rationale**:
- Performance optimization (fast path for clear cases)
- Only do expensive analysis when needed
- Better user experience (faster response)

### Blocking Mechanism
**Planned Choice**: Overlay system instead of system-level blocking
**Rationale**:
- System-level blocking is complex and potentially unsafe
- Overlay is easier to implement and maintain
- Can be disabled if needed
- Cross-platform compatible

### Grid-Based Analysis
**Planned Choice**: Divide screen into grids for targeted blocking
**Rationale**:
- More granular control
- Can block specific zones instead of entire screen
- Better user experience (partial blocking)
- Allows focused work while blocking distractions

## Trade-offs Made

### Synchronous Database Operations
**Trade-off**: Using better-sqlite3 synchronous API
**Pros**: Simpler code, no async/await complexity
**Cons**: Blocks event loop (acceptable for our use case with small database)

### Local Storage Only
**Trade-off**: No cloud sync initially
**Pros**: Privacy, security, simplicity, no server costs
**Cons**: No backup, no multi-device sync (can be added later)

### Vanilla JavaScript
**Trade-off**: No frontend framework (React, Vue, etc.)
**Pros**: Lightweight, no build step, simple
**Cons**: More manual DOM manipulation (acceptable for our app size)

---

*Last updated: 2024-12-26*
