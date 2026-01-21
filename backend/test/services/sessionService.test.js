const SessionService = require('../../services/sessionService');
const SessionRepository = require('../../database/repositories/sessionRepository');
const UserRepository = require('../../database/repositories/userRepository');
const TestDatabase = require('../helpers/testDb');

describe('SessionService', () => {
  let testDb;
  let db;
  let sessionRepo;
  let userRepo;
  let sessionService;
  let userId;

  beforeEach(() => {
    try {
      testDb = new TestDatabase();
      db = testDb.getConnection();
      sessionRepo = new SessionRepository(db);
      userRepo = new UserRepository(db);
      sessionService = new SessionService(sessionRepo);
      
      // Create a test user
      const userResult = userRepo.create('testuser', 'test@example.com', 'hashedpassword');
      userId = userResult.userId;
    } catch (error) {
      // If database initialization fails, skip the test
      testDb = null;
      throw error;
    }
  });

  afterEach(() => {
    if (testDb) {
      testDb.close();
    }
  });

  describe('createSession', () => {
    test('should create a session successfully', () => {
      const sessionData = {
        taskName: 'Test Task',
        durationMinutes: 30
      };
      
      const result = sessionService.createSession(userId, sessionData);
      
      expect(result.success).toBe(true);
      expect(result.session).toBeDefined();
      expect(result.session.task_name).toBe('Test Task');
      expect(result.session.duration_minutes).toBe(30);
      expect(result.session.user_id).toBe(userId);
    });

    test('should create session with all optional fields', () => {
      const sessionData = {
        taskName: 'Test Task',
        taskDescription: 'Test Description',
        durationMinutes: 60,
        referenceType: 'url',
        referenceUrl: 'https://example.com',
        referenceFilePath: '/path/to/file',
        referenceText: 'Reference text'
      };
      
      const result = sessionService.createSession(userId, sessionData);
      
      expect(result.success).toBe(true);
      expect(result.session.reference_type).toBe('url');
      expect(result.session.reference_url).toBe('https://example.com');
    });

    test('should reject invalid session data', () => {
      const sessionData = {
        taskName: '',
        durationMinutes: 500
      };
      
      const result = sessionService.createSession(userId, sessionData);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should trim task name and description', () => {
      const sessionData = {
        taskName: '  Test Task  ',
        taskDescription: '  Description  ',
        durationMinutes: 30
      };
      
      const result = sessionService.createSession(userId, sessionData);
      
      expect(result.success).toBe(true);
      expect(result.session.task_name).toBe('Test Task');
      expect(result.session.task_description).toBe('Description');
    });
  });

  describe('getSession', () => {
    test('should get session by id', () => {
      const sessionData = {
        taskName: 'Test Task',
        durationMinutes: 30
      };
      const createResult = sessionService.createSession(userId, sessionData);
      const sessionId = createResult.session.id;
      
      const result = sessionService.getSession(sessionId);
      
      expect(result.success).toBe(true);
      expect(result.session.id).toBe(sessionId);
      expect(result.session.task_name).toBe('Test Task');
    });

    test('should return error for non-existent session', () => {
      const result = sessionService.getSession(999);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Session not found');
    });
  });

  describe('getUserSessions', () => {
    test('should get all sessions for a user', () => {
      sessionService.createSession(userId, {
        taskName: 'Task 1',
        durationMinutes: 30
      });
      sessionService.createSession(userId, {
        taskName: 'Task 2',
        durationMinutes: 60
      });
      
      const result = sessionService.getUserSessions(userId);
      
      expect(result.success).toBe(true);
      expect(result.sessions).toHaveLength(2);
    });

    test('should filter sessions by status', () => {
      const session1 = sessionService.createSession(userId, {
        taskName: 'Task 1',
        durationMinutes: 30
      });
      sessionService.createSession(userId, {
        taskName: 'Task 2',
        durationMinutes: 60
      });
      
      sessionService.startSession(session1.session.id);
      
      const result = sessionService.getUserSessions(userId, 'active');
      
      expect(result.success).toBe(true);
      expect(result.sessions).toHaveLength(1);
      expect(result.sessions[0].status).toBe('active');
    });
  });

  describe('startSession', () => {
    test('should start a planned session', () => {
      const session = sessionService.createSession(userId, {
        taskName: 'Test Task',
        durationMinutes: 30
      });
      
      const result = sessionService.startSession(session.session.id);
      
      expect(result.success).toBe(true);
      expect(result.session.status).toBe('active');
      expect(result.session.started_at).toBeDefined();
    });

    test('should reject starting non-existent session', () => {
      const result = sessionService.startSession(999);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Session not found');
    });

    test('should reject starting already active session', () => {
      const session = sessionService.createSession(userId, {
        taskName: 'Test Task',
        durationMinutes: 30
      });
      
      sessionService.startSession(session.session.id);
      const result = sessionService.startSession(session.session.id);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Session already active');
    });

    test('should reject starting completed session', () => {
      const session = sessionService.createSession(userId, {
        taskName: 'Test Task',
        durationMinutes: 30
      });
      
      sessionService.startSession(session.session.id);
      sessionService.completeSession(session.session.id);
      
      const result = sessionService.startSession(session.session.id);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Cannot start completed session');
    });

    test('should reject starting when another session is active', () => {
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
  });

  describe('stopSession', () => {
    test('should stop an active session', () => {
      const session = sessionService.createSession(userId, {
        taskName: 'Test Task',
        durationMinutes: 30
      });
      
      sessionService.startSession(session.session.id);
      const result = sessionService.stopSession(session.session.id);
      
      expect(result.success).toBe(true);
      expect(result.session.status).toBe('stopped');
      expect(result.session.ended_at).toBeDefined();
    });

    test('should stop a paused session', () => {
      const session = sessionService.createSession(userId, {
        taskName: 'Test Task',
        durationMinutes: 30
      });
      
      sessionService.startSession(session.session.id);
      sessionService.pauseSession(session.session.id);
      const result = sessionService.stopSession(session.session.id);
      
      expect(result.success).toBe(true);
      expect(result.session.status).toBe('stopped');
    });

    test('should reject stopping non-active/paused session', () => {
      const session = sessionService.createSession(userId, {
        taskName: 'Test Task',
        durationMinutes: 30
      });
      
      const result = sessionService.stopSession(session.session.id);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('not active or paused');
    });
  });

  describe('completeSession', () => {
    test('should complete an active session', () => {
      const session = sessionService.createSession(userId, {
        taskName: 'Test Task',
        durationMinutes: 30
      });
      
      sessionService.startSession(session.session.id);
      const result = sessionService.completeSession(session.session.id);
      
      expect(result.success).toBe(true);
      expect(result.session.status).toBe('completed');
      expect(result.session.ended_at).toBeDefined();
    });

    test('should reject completing non-active session', () => {
      const session = sessionService.createSession(userId, {
        taskName: 'Test Task',
        durationMinutes: 30
      });
      
      const result = sessionService.completeSession(session.session.id);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Session is not active');
    });
  });

  describe('pauseSession', () => {
    test('should pause an active session', () => {
      const session = sessionService.createSession(userId, {
        taskName: 'Test Task',
        durationMinutes: 30
      });
      
      sessionService.startSession(session.session.id);
      const result = sessionService.pauseSession(session.session.id);
      
      expect(result.success).toBe(true);
      expect(result.session.status).toBe('paused');
    });

    test('should reject pausing non-active session', () => {
      const session = sessionService.createSession(userId, {
        taskName: 'Test Task',
        durationMinutes: 30
      });
      
      const result = sessionService.pauseSession(session.session.id);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Session is not active');
    });
  });

  describe('resumeSession', () => {
    test('should resume a paused session', () => {
      const session = sessionService.createSession(userId, {
        taskName: 'Test Task',
        durationMinutes: 30
      });
      
      sessionService.startSession(session.session.id);
      sessionService.pauseSession(session.session.id);
      const result = sessionService.resumeSession(session.session.id);
      
      expect(result.success).toBe(true);
      expect(result.session.status).toBe('active');
    });

    test('should reject resuming non-paused session', () => {
      const session = sessionService.createSession(userId, {
        taskName: 'Test Task',
        durationMinutes: 30
      });
      
      const result = sessionService.resumeSession(session.session.id);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Session is not paused');
    });

    test('should reject resuming when another session is active', () => {
      const session1 = sessionService.createSession(userId, {
        taskName: 'Task 1',
        durationMinutes: 30
      });
      const session2 = sessionService.createSession(userId, {
        taskName: 'Task 2',
        durationMinutes: 60
      });
      
      sessionService.startSession(session1.session.id);
      sessionService.pauseSession(session1.session.id);
      sessionService.startSession(session2.session.id);
      
      const result = sessionService.resumeSession(session1.session.id);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('already active');
    });
  });

  describe('deleteSession', () => {
    test('should delete a session', () => {
      const session = sessionService.createSession(userId, {
        taskName: 'Test Task',
        durationMinutes: 30
      });
      
      const result = sessionService.deleteSession(session.session.id);
      
      expect(result.success).toBe(true);
      
      const getResult = sessionService.getSession(session.session.id);
      expect(getResult.success).toBe(false);
    });

    test('should reject deleting active session', () => {
      const session = sessionService.createSession(userId, {
        taskName: 'Test Task',
        durationMinutes: 30
      });
      
      sessionService.startSession(session.session.id);
      const result = sessionService.deleteSession(session.session.id);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Cannot delete active session');
    });
  });

  describe('updateSession', () => {
    test('should update session fields', () => {
      const session = sessionService.createSession(userId, {
        taskName: 'Old Task',
        durationMinutes: 30
      });
      
      const result = sessionService.updateSession(session.session.id, {
        task_name: 'New Task',
        duration_minutes: 60
      });
      
      expect(result.success).toBe(true);
      expect(result.session.task_name).toBe('New Task');
      expect(result.session.duration_minutes).toBe(60);
    });

    test('should reject updating active session', () => {
      const session = sessionService.createSession(userId, {
        taskName: 'Test Task',
        durationMinutes: 30
      });
      
      sessionService.startSession(session.session.id);
      const result = sessionService.updateSession(session.session.id, {
        task_name: 'New Task'
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Cannot update active session');
    });

    test('should reject invalid field updates', () => {
      const session = sessionService.createSession(userId, {
        taskName: 'Test Task',
        durationMinutes: 30
      });
      
      const result = sessionService.updateSession(session.session.id, {
        invalid_field: 'value'
      });
      
      expect(result.success).toBe(false);
    });
  });

  describe('restartSession', () => {
    test('should restart a stopped session', () => {
      const session = sessionService.createSession(userId, {
        taskName: 'Test Task',
        durationMinutes: 30
      });
      
      sessionService.startSession(session.session.id);
      sessionService.stopSession(session.session.id);
      
      const result = sessionService.restartSession(session.session.id);
      
      expect(result.success).toBe(true);
      expect(result.session.status).toBe('active');
    });

    test('should reject restarting already active session', () => {
      const session = sessionService.createSession(userId, {
        taskName: 'Test Task',
        durationMinutes: 30
      });
      
      sessionService.startSession(session.session.id);
      const result = sessionService.restartSession(session.session.id);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Session is already active');
    });
  });

  describe('getUserStats', () => {
    test('should calculate user statistics', () => {
      const session1 = sessionService.createSession(userId, {
        taskName: 'Task 1',
        durationMinutes: 30
      });
      const session2 = sessionService.createSession(userId, {
        taskName: 'Task 2',
        durationMinutes: 60
      });
      
      sessionService.startSession(session1.session.id);
      sessionService.completeSession(session1.session.id);
      sessionService.startSession(session2.session.id);
      sessionService.completeSession(session2.session.id);
      
      const result = sessionService.getUserStats(userId);
      
      expect(result.success).toBe(true);
      expect(result.stats.totalSessions).toBe(2);
      expect(result.stats.completedSessions).toBe(2);
      expect(result.stats.totalFocusMinutes).toBe(90);
      expect(result.stats.totalFocusHours).toBe(1);
    });
  });

  describe('getActiveSession', () => {
    test('should return active session for user', () => {
      const session = sessionService.createSession(userId, {
        taskName: 'Test Task',
        durationMinutes: 30
      });
      
      sessionService.startSession(session.session.id);
      const result = sessionService.getActiveSession(userId);
      
      expect(result.success).toBe(true);
      expect(result.session).toBeDefined();
      expect(result.session.status).toBe('active');
    });

    test('should return null when no active session', () => {
      const result = sessionService.getActiveSession(userId);
      
      expect(result.success).toBe(true);
      expect(result.session).toBeNull();
    });
  });
});
