const TestDatabase = require('../helpers/testDb');
const UserRepository = require('../../database/repositories/userRepository');

describe('UserRepository', () => {
  let testDb;
  let db;
  let userRepo;

  beforeEach(() => {
    try {
      testDb = new TestDatabase();
      db = testDb.getConnection();
      userRepo = new UserRepository(db);
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
    test('should create a new user successfully', () => {
      const result = userRepo.create('testuser', 'test@example.com', 'hashedpassword');
      
      expect(result.success).toBe(true);
      expect(result.userId).toBeDefined();
      expect(typeof result.userId).toBe('number');
    });

    test('should return error when username already exists', () => {
      userRepo.create('testuser', 'test1@example.com', 'hashedpassword');
      const result = userRepo.create('testuser', 'test2@example.com', 'hashedpassword');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Username');
    });

    test('should return error when email already exists', () => {
      userRepo.create('user1', 'test@example.com', 'hashedpassword');
      const result = userRepo.create('user2', 'test@example.com', 'hashedpassword');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Email');
    });
  });

  describe('findByUsername', () => {
    test('should find user by username', () => {
      const createResult = userRepo.create('testuser', 'test@example.com', 'hashedpassword');
      const user = userRepo.findByUsername('testuser');
      
      expect(user).toBeDefined();
      expect(user.username).toBe('testuser');
      expect(user.email).toBe('test@example.com');
      expect(user.password_hash).toBe('hashedpassword');
    });

    test('should return undefined for non-existent username', () => {
      const user = userRepo.findByUsername('nonexistent');
      expect(user).toBeUndefined();
    });
  });

  describe('findByEmail', () => {
    test('should find user by email', () => {
      userRepo.create('testuser', 'test@example.com', 'hashedpassword');
      const user = userRepo.findByEmail('test@example.com');
      
      expect(user).toBeDefined();
      expect(user.email).toBe('test@example.com');
      expect(user.username).toBe('testuser');
    });

    test('should return undefined for non-existent email', () => {
      const user = userRepo.findByEmail('nonexistent@example.com');
      expect(user).toBeUndefined();
    });
  });

  describe('findById', () => {
    test('should find user by id', () => {
      const createResult = userRepo.create('testuser', 'test@example.com', 'hashedpassword');
      const user = userRepo.findById(createResult.userId);
      
      expect(user).toBeDefined();
      expect(user.id).toBe(createResult.userId);
      expect(user.username).toBe('testuser');
      expect(user.email).toBe('test@example.com');
      expect(user.password_hash).toBeUndefined(); // Should not include password_hash
    });

    test('should return undefined for non-existent id', () => {
      const user = userRepo.findById(999);
      expect(user).toBeUndefined();
    });
  });

  describe('updateLastLogin', () => {
    test('should update last login timestamp', () => {
      const createResult = userRepo.create('testuser', 'test@example.com', 'hashedpassword');
      userRepo.updateLastLogin(createResult.userId);
      
      const user = userRepo.findByUsername('testuser');
      expect(user.last_login).toBeDefined();
      expect(user.last_login).not.toBeNull();
    });
  });

  describe('existsByUsername', () => {
    test('should return true if username exists', () => {
      userRepo.create('testuser', 'test@example.com', 'hashedpassword');
      expect(userRepo.existsByUsername('testuser')).toBe(true);
    });

    test('should return false if username does not exist', () => {
      expect(userRepo.existsByUsername('nonexistent')).toBe(false);
    });
  });

  describe('existsByEmail', () => {
    test('should return true if email exists', () => {
      userRepo.create('testuser', 'test@example.com', 'hashedpassword');
      expect(userRepo.existsByEmail('test@example.com')).toBe(true);
    });

    test('should return false if email does not exist', () => {
      expect(userRepo.existsByEmail('nonexistent@example.com')).toBe(false);
    });
  });
});
