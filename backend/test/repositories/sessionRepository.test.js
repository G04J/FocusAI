const TestDatabase = require('../helpers/testDb');
const SessionRepository = require('../../database/repositories/sessionRepository');
const UserRepository = require('../../database/repositories/userRepository');

describe('SessionRepository', () => {
  let testDb;
  let db;
  let sessionRepo;
  let userRepo;
  let userId;

  beforeEach(() => {
    try {
      testDb = new TestDatabase();
      db = testDb.getConnection();
      sessionRepo = new SessionRepository(db);
      userRepo = new UserRepository(db);
      
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

  describe('create', () => {
    test('should create a new session successfully', () => {
      const sessionData = {
        user_id: userId,
        task_name: 'Test Task',
        task_description: 'Test Description',
        duration_minutes: 30
      };
      
      const result = sessionRepo.create(sessionData);
      
      expect(result.success).toBe(true);
      expect(result.sessionId).toBeDefined();
      expect(typeof result.sessionId).toBe('number');
    });

    test('should create session with all optional fields', () => {
      const sessionData = {
        user_id: userId,
        task_name: 'Test Task',
        task_description: 'Test Description',
        duration_minutes: 60,
        reference_type: 'url',
        reference_url: 'https://example.com',
        reference_file_path: '/path/to/file',
        reference_text: 'Reference text'
      };
      
      const result = sessionRepo.create(sessionData);
      expect(result.success).toBe(true);
      
      const session = sessionRepo.findById(result.sessionId);
      expect(session.reference_type).toBe('url');
      expect(session.reference_url).toBe('https://example.com');
    });

    test('should accept both camelCase and snake_case formats', () => {
      const sessionData = {
        userId: userId,
        taskName: 'Test Task',
        taskDescription: 'Test Description',
        durationMinutes: 30
      };
      
      const result = sessionRepo.create(sessionData);
      expect(result.success).toBe(true);
      
      const session = sessionRepo.findById(result.sessionId);
      expect(session.task_name).toBe('Test Task');
    });
  });

  describe('findById', () => {
    test('should find session by id', () => {
      const sessionData = {
        user_id: userId,
        task_name: 'Test Task',
        duration_minutes: 30
      };
      const createResult = sessionRepo.create(sessionData);
      const session = sessionRepo.findById(createResult.sessionId);
      
      expect(session).toBeDefined();
      expect(session.id).toBe(createResult.sessionId);
      expect(session.task_name).toBe('Test Task');
      expect(session.user_id).toBe(userId);
    });

    test('should return undefined for non-existent session', () => {
      const session = sessionRepo.findById(999);
      expect(session).toBeUndefined();
    });
  });

  describe('findByUserId', () => {
    test('should find all sessions for a user', () => {
      sessionRepo.create({
        user_id: userId,
        task_name: 'Task 1',
        duration_minutes: 30
      });
      sessionRepo.create({
        user_id: userId,
        task_name: 'Task 2',
        duration_minutes: 60
      });
      
      const sessions = sessionRepo.findByUserId(userId);
      expect(sessions).toHaveLength(2);
    });

    test('should filter sessions by status', () => {
      const result1 = sessionRepo.create({
        user_id: userId,
        task_name: 'Active Task',
        duration_minutes: 30
      });
      const result2 = sessionRepo.create({
        user_id: userId,
        task_name: 'Completed Task',
        duration_minutes: 60
      });
      
      sessionRepo.updateStatus(result1.sessionId, 'active');
      sessionRepo.updateStatus(result2.sessionId, 'completed');
      
      const activeSessions = sessionRepo.findByUserId(userId, 'active');
      expect(activeSessions).toHaveLength(1);
      expect(activeSessions[0].status).toBe('active');
    });

    test('should return empty array for user with no sessions', () => {
      const newUserResult = userRepo.create('newuser', 'new@example.com', 'password');
      const sessions = sessionRepo.findByUserId(newUserResult.userId);
      expect(sessions).toHaveLength(0);
    });
  });

  describe('updateStatus', () => {
    test('should update session status to active', () => {
      const result = sessionRepo.create({
        user_id: userId,
        task_name: 'Test Task',
        duration_minutes: 30
      });
      
      const updateResult = sessionRepo.updateStatus(result.sessionId, 'active', new Date().toISOString());
      expect(updateResult.success).toBe(true);
      
      const session = sessionRepo.findById(result.sessionId);
      expect(session.status).toBe('active');
      expect(session.started_at).toBeDefined();
    });

    test('should update session status to completed', () => {
      const result = sessionRepo.create({
        user_id: userId,
        task_name: 'Test Task',
        duration_minutes: 30
      });
      
      const updateResult = sessionRepo.updateStatus(result.sessionId, 'completed', new Date().toISOString());
      expect(updateResult.success).toBe(true);
      
      const session = sessionRepo.findById(result.sessionId);
      expect(session.status).toBe('completed');
      expect(session.ended_at).toBeDefined();
    });

    test('should update session status to paused', () => {
      const result = sessionRepo.create({
        user_id: userId,
        task_name: 'Test Task',
        duration_minutes: 30
      });
      
      const updateResult = sessionRepo.updateStatus(result.sessionId, 'paused');
      expect(updateResult.success).toBe(true);
      
      const session = sessionRepo.findById(result.sessionId);
      expect(session.status).toBe('paused');
    });
  });

  describe('update', () => {
    test('should update session fields', () => {
      const result = sessionRepo.create({
        user_id: userId,
        task_name: 'Old Task',
        duration_minutes: 30
      });
      
      const updateResult = sessionRepo.update(result.sessionId, {
        task_name: 'New Task',
        duration_minutes: 60
      });
      
      expect(updateResult.success).toBe(true);
      
      const session = sessionRepo.findById(result.sessionId);
      expect(session.task_name).toBe('New Task');
      expect(session.duration_minutes).toBe(60);
    });

    test('should reject invalid field names', () => {
      const result = sessionRepo.create({
        user_id: userId,
        task_name: 'Test Task',
        duration_minutes: 30
      });
      
      const updateResult = sessionRepo.update(result.sessionId, {
        invalid_field: 'value'
      });
      
      expect(updateResult.success).toBe(false);
      expect(updateResult.error).toContain('Invalid field');
    });

    test('should return error for empty updates', () => {
      const result = sessionRepo.create({
        user_id: userId,
        task_name: 'Test Task',
        duration_minutes: 30
      });
      
      const updateResult = sessionRepo.update(result.sessionId, {});
      expect(updateResult.success).toBe(false);
      expect(updateResult.error).toContain('No valid fields');
    });
  });

  describe('delete', () => {
    test('should delete session successfully', () => {
      const result = sessionRepo.create({
        user_id: userId,
        task_name: 'Test Task',
        duration_minutes: 30
      });
      
      const deleteResult = sessionRepo.delete(result.sessionId);
      expect(deleteResult.success).toBe(true);
      
      const session = sessionRepo.findById(result.sessionId);
      expect(session).toBeUndefined();
    });
  });

  describe('getActiveSession', () => {
    test('should return active session for user', () => {
      const result = sessionRepo.create({
        user_id: userId,
        task_name: 'Active Task',
        duration_minutes: 30
      });
      
      sessionRepo.updateStatus(result.sessionId, 'active');
      
      const activeSession = sessionRepo.getActiveSession(userId);
      expect(activeSession).toBeDefined();
      expect(activeSession.status).toBe('active');
    });

    test('should return undefined when no active session', () => {
      sessionRepo.create({
        user_id: userId,
        task_name: 'Test Task',
        duration_minutes: 30
      });
      
      const activeSession = sessionRepo.getActiveSession(userId);
      expect(activeSession).toBeUndefined();
    });
  });

  describe('getUserStats', () => {
    test('should calculate user statistics correctly', () => {
      // Create completed sessions
      const result1 = sessionRepo.create({
        user_id: userId,
        task_name: 'Task 1',
        duration_minutes: 30
      });
      const result2 = sessionRepo.create({
        user_id: userId,
        task_name: 'Task 2',
        duration_minutes: 60
      });
      
      sessionRepo.updateStatus(result1.sessionId, 'completed');
      sessionRepo.updateStatus(result2.sessionId, 'completed');
      
      const stats = sessionRepo.getUserStats(userId);
      expect(stats.total_sessions).toBe(2);
      expect(stats.completed_sessions).toBe(2);
      expect(stats.total_focus_minutes).toBe(90);
    });

    test('should handle user with no sessions', () => {
      const newUserResult = userRepo.create('newuser', 'new@example.com', 'password');
      const stats = sessionRepo.getUserStats(newUserResult.userId);
      expect(stats.total_sessions).toBe(0);
      expect(stats.completed_sessions).toBe(0);
      expect(stats.total_focus_minutes).toBe(0);
    });
  });
});
