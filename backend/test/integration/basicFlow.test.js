const TestDatabase = require('../helpers/testDb');
const UserRepository = require('../../database/repositories/userRepository');
const SessionRepository = require('../../database/repositories/sessionRepository');
const AuthService = require('../../services/authService');
const SessionService = require('../../services/sessionService');

/**
 * Integration tests for basic user flows
 * Tests that core services work together correctly
 */
describe('Basic Flow Integration Tests', () => {
  let testDb;
  let db;
  let userRepo;
  let sessionRepo;
  let authService;
  let sessionService;
  let mockSessionMonitor;

  beforeEach(() => {
    testDb = new TestDatabase();
    db = testDb.getConnection();
    userRepo = new UserRepository(db);
    sessionRepo = new SessionRepository(db);
    authService = new AuthService(userRepo);
    
    // Create a mock sessionMonitor to prevent warnings
    // Track monitoring state to simulate real behavior
    const monitorState = { isMonitoring: false };
    mockSessionMonitor = {
      start: jest.fn().mockImplementation(() => {
        monitorState.isMonitoring = true;
        return Promise.resolve(undefined);
      }),
      stop: jest.fn().mockImplementation(() => {
        monitorState.isMonitoring = false;
      }),
      pause: jest.fn().mockImplementation(() => {
        // Monitoring is paused but still considered "monitoring"
        // isMonitoring stays true
      }),
      resume: jest.fn().mockImplementation(() => {
        // Resume doesn't change isMonitoring, it's already true
      }),
      getState: jest.fn().mockImplementation(() => ({
        isMonitoring: monitorState.isMonitoring,
        sessionId: monitorState.isMonitoring ? 1 : null,
        currentState: 'GREEN',
        overlayStatus: { visible: false },
        screenshotStatus: null,
        lastWindow: null
      }))
    };
    
    sessionService = new SessionService(sessionRepo, null, mockSessionMonitor);
  });

  afterEach(() => {
    if (testDb) {
      testDb.close();
    }
  });

  describe('User Signup and Session Creation Flow', () => {
    test('should complete full signup to session creation flow', async () => {
      // Step 1: User signs up
      const signupResult = await authService.signup(
        'testuser',
        'test@example.com',
        'password123'
      );

      expect(signupResult.success).toBe(true);
      expect(signupResult.userId).toBeDefined();
      expect(signupResult.token).toBeDefined();

      const userId = signupResult.userId;

      // Step 2: User creates a session
      const sessionResult = sessionService.createSession(userId, {
        taskName: 'Test Task',
        taskDescription: 'Testing integration',
        durationMinutes: 30
      });

      expect(sessionResult.success).toBe(true);
      expect(sessionResult.session).toBeDefined();
      expect(sessionResult.session.user_id).toBe(userId);
      expect(sessionResult.session.status).toBe('planned');
    });

    test('should allow user to login and access their sessions', async () => {
      // Setup: Create user
      const signupResult = await authService.signup(
        'testuser',
        'test@example.com',
        'password123'
      );
      const userId = signupResult.userId;

      // Create some sessions
      sessionService.createSession(userId, {
        taskName: 'Task 1',
        durationMinutes: 30
      });
      sessionService.createSession(userId, {
        taskName: 'Task 2',
        durationMinutes: 60
      });

      // User logs in
      const loginResult = await authService.login('testuser', 'password123');

      expect(loginResult.success).toBe(true);
      expect(loginResult.userId).toBe(userId);

      // User gets their sessions
      const sessionsResult = sessionService.getUserSessions(userId);

      expect(sessionsResult.success).toBe(true);
      expect(sessionsResult.sessions).toHaveLength(2);
    });
  });

  describe('Session Lifecycle Flow', () => {
    let userId;
    let sessionId;

    beforeEach(async () => {
      const signupResult = await authService.signup(
        'testuser',
        'test@example.com',
        'password123'
      );
      userId = signupResult.userId;

      const sessionResult = sessionService.createSession(userId, {
        taskName: 'Test Task',
        durationMinutes: 30
      });
      sessionId = sessionResult.session.id;
    });

    test('should complete full session lifecycle: create -> start -> pause -> resume -> stop', () => {
      // 1. Session is created (planned)
      let session = sessionService.getSession(sessionId);
      expect(session.success).toBe(true);
      expect(session.session.status).toBe('planned');

      // 2. Start session
      let result = sessionService.startSession(sessionId);
      expect(result.success).toBe(true);
      expect(result.session.status).toBe('active');
      expect(result.session.started_at).toBeDefined();

      // 3. Pause session
      result = sessionService.pauseSession(sessionId);
      expect(result.success).toBe(true);
      expect(result.session.status).toBe('paused');

      // 4. Resume session
      result = sessionService.resumeSession(sessionId);
      expect(result.success).toBe(true);
      expect(result.session.status).toBe('active');

      // 5. Stop session
      result = sessionService.stopSession(sessionId);
      expect(result.success).toBe(true);
      expect(result.session.status).toBe('stopped');
      expect(result.session.ended_at).toBeDefined();
    });

    test('should allow restarting a stopped session', () => {
      // Start and stop session
      sessionService.startSession(sessionId);
      sessionService.stopSession(sessionId);

      // Restart
      const result = sessionService.restartSession(sessionId);
      expect(result.success).toBe(true);
      expect(result.session.status).toBe('active');
    });

    test('should complete session when duration is reached', () => {
      sessionService.startSession(sessionId);
      
      const result = sessionService.completeSession(sessionId);
      expect(result.success).toBe(true);
      expect(result.session.status).toBe('completed');
      expect(result.session.ended_at).toBeDefined();
    });
  });

  describe('Session Management Flow', () => {
    let userId;

    beforeEach(async () => {
      const signupResult = await authService.signup(
        'testuser',
        'test@example.com',
        'password123'
      );
      userId = signupResult.userId;
    });

    test('should allow user to create multiple sessions', () => {
      const session1 = sessionService.createSession(userId, {
        taskName: 'Task 1',
        durationMinutes: 30
      });
      const session2 = sessionService.createSession(userId, {
        taskName: 'Task 2',
        durationMinutes: 60
      });
      const session3 = sessionService.createSession(userId, {
        taskName: 'Task 3',
        durationMinutes: 45
      });

      expect(session1.success).toBe(true);
      expect(session2.success).toBe(true);
      expect(session3.success).toBe(true);

      const allSessions = sessionService.getUserSessions(userId);
      expect(allSessions.sessions).toHaveLength(3);
    });

    test('should allow user to update session details', () => {
      const sessionResult = sessionService.createSession(userId, {
        taskName: 'Old Task',
        durationMinutes: 30
      });
      const sessionId = sessionResult.session.id;

      const updateResult = sessionService.updateSession(sessionId, {
        task_name: 'New Task',
        duration_minutes: 60
      });

      expect(updateResult.success).toBe(true);
      expect(updateResult.session.task_name).toBe('New Task');
      expect(updateResult.session.duration_minutes).toBe(60);
    });

    test('should allow user to delete a session', () => {
      const sessionResult = sessionService.createSession(userId, {
        taskName: 'Task to Delete',
        durationMinutes: 30
      });
      const sessionId = sessionResult.session.id;

      const deleteResult = sessionService.deleteSession(sessionId);
      expect(deleteResult.success).toBe(true);

      const getResult = sessionService.getSession(sessionId);
      expect(getResult.success).toBe(false);
    });

    test('should filter sessions by status', () => {
      // Create multiple sessions
      const session1 = sessionService.createSession(userId, {
        taskName: 'Planned Task',
        durationMinutes: 30
      });
      const session2 = sessionService.createSession(userId, {
        taskName: 'Active Task',
        durationMinutes: 60
      });
      const session3 = sessionService.createSession(userId, {
        taskName: 'Completed Task',
        durationMinutes: 45
      });

      // Set different statuses
      // Start and complete session3 first (so it can be completed)
      const startResult3 = sessionService.startSession(session3.session.id);
      expect(startResult3.success).toBe(true);
      const completeResult = sessionService.completeSession(session3.session.id);
      expect(completeResult.success).toBe(true);
      expect(completeResult.session.status).toBe('completed');
      
      // Now start session2 (session3 is completed, so no conflict)
      const startResult2 = sessionService.startSession(session2.session.id);
      expect(startResult2.success).toBe(true);
      expect(startResult2.session.status).toBe('active');

      // Filter by status
      const plannedSessions = sessionService.getUserSessions(userId, 'planned');
      const activeSessions = sessionService.getUserSessions(userId, 'active');
      const completedSessions = sessionService.getUserSessions(userId, 'completed');

      expect(plannedSessions.sessions).toHaveLength(1);
      expect(activeSessions.sessions).toHaveLength(1);
      expect(completedSessions.sessions).toHaveLength(1);
    });
  });

  describe('Statistics Flow', () => {
    let userId;

    beforeEach(async () => {
      const signupResult = await authService.signup(
        'testuser',
        'test@example.com',
        'password123'
      );
      userId = signupResult.userId;
    });

    test('should calculate user statistics correctly', () => {
      // Create and complete some sessions
      const session1 = sessionService.createSession(userId, {
        taskName: 'Task 1',
        durationMinutes: 30
      });
      const session2 = sessionService.createSession(userId, {
        taskName: 'Task 2',
        durationMinutes: 60
      });
      const session3 = sessionService.createSession(userId, {
        taskName: 'Task 3',
        durationMinutes: 45
      });

      // Complete two sessions
      sessionService.startSession(session1.session.id);
      sessionService.completeSession(session1.session.id);
      sessionService.startSession(session2.session.id);
      sessionService.completeSession(session2.session.id);

      // Get statistics
      const statsResult = sessionService.getUserStats(userId);

      expect(statsResult.success).toBe(true);
      expect(statsResult.stats.totalSessions).toBe(3);
      expect(statsResult.stats.completedSessions).toBe(2);
      expect(statsResult.stats.totalFocusMinutes).toBe(90); // 30 + 60
    });
  });

  describe('Error Handling Flow', () => {
    let userId;

    beforeEach(async () => {
      const signupResult = await authService.signup(
        'testuser',
        'test@example.com',
        'password123'
      );
      userId = signupResult.userId;
    });

    test('should prevent starting multiple active sessions', () => {
      const session1 = sessionService.createSession(userId, {
        taskName: 'Task 1',
        durationMinutes: 30
      });
      const session2 = sessionService.createSession(userId, {
        taskName: 'Task 2',
        durationMinutes: 60
      });

      sessionService.startSession(session1.session.id);

      const result = sessionService.startSession(session2.session.id);
      expect(result.success).toBe(false);
      expect(result.error).toContain('already active');
    });

    test('should prevent invalid operations on sessions', () => {
      const sessionResult = sessionService.createSession(userId, {
        taskName: 'Test Task',
        durationMinutes: 30
      });
      const sessionId = sessionResult.session.id;

      // Try to pause a non-active session
      const pauseResult = sessionService.pauseSession(sessionId);
      expect(pauseResult.success).toBe(false);

      // Try to resume a non-paused session
      const resumeResult = sessionService.resumeSession(sessionId);
      expect(resumeResult.success).toBe(false);

      // Try to stop a non-active session
      const stopResult = sessionService.stopSession(sessionId);
      expect(stopResult.success).toBe(false);
    });
  });
});
