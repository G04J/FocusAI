const bcrypt = require('bcrypt');
const AuthService = require('../../services/authService');
const UserRepository = require('../../database/repositories/userRepository');
const TestDatabase = require('../helpers/testDb');

describe('AuthService', () => {
  let testDb;
  let db;
  let userRepo;
  let authService;

  beforeEach(() => {
    try {
      testDb = new TestDatabase();
      db = testDb.getConnection();
      userRepo = new UserRepository(db);
      authService = new AuthService(userRepo);
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

  describe('signup', () => {
    test('should sign up a new user successfully', async () => {
      const result = await authService.signup('testuser', 'test@example.com', 'password123');
      
      expect(result.success).toBe(true);
      expect(result.userId).toBeDefined();
      expect(result.username).toBe('testuser');
      expect(result.email).toBe('test@example.com');
      expect(result.token).toBeDefined();
    });

    test('should reject invalid username', async () => {
      const result = await authService.signup('ab', 'test@example.com', 'password123');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Username');
    });

    test('should reject invalid email', async () => {
      const result = await authService.signup('testuser', 'invalid-email', 'password123');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('email');
    });

    test('should reject short password', async () => {
      const result = await authService.signup('testuser', 'test@example.com', 'short');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Password');
    });

    test('should reject duplicate username', async () => {
      await authService.signup('testuser', 'test1@example.com', 'password123');
      const result = await authService.signup('testuser', 'test2@example.com', 'password123');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Username already taken');
    });

    test('should reject duplicate email', async () => {
      await authService.signup('user1', 'test@example.com', 'password123');
      const result = await authService.signup('user2', 'test@example.com', 'password123');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Email already registered');
    });

    test('should hash password before storing', async () => {
      await authService.signup('testuser', 'test@example.com', 'password123');
      const user = userRepo.findByUsername('testuser');
      
      expect(user.password_hash).not.toBe('password123');
      expect(user.password_hash).toMatch(/^\$2[ayb]\$.{56}$/); // bcrypt hash format
    });
  });

  describe('login', () => {
    beforeEach(async () => {
      await authService.signup('testuser', 'test@example.com', 'password123');
    });

    test('should login with correct username and password', async () => {
      const result = await authService.login('testuser', 'password123');
      
      expect(result.success).toBe(true);
      expect(result.userId).toBeDefined();
      expect(result.username).toBe('testuser');
      expect(result.token).toBeDefined();
    });

    test('should login with correct email and password', async () => {
      const result = await authService.login('test@example.com', 'password123');
      
      expect(result.success).toBe(true);
      expect(result.username).toBe('testuser');
      expect(result.token).toBeDefined();
    });

    test('should reject incorrect password', async () => {
      const result = await authService.login('testuser', 'wrongpassword');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid credentials');
    });

    test('should reject non-existent user', async () => {
      const result = await authService.login('nonexistent', 'password123');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid credentials');
    });

    test('should update last login on successful login', async () => {
      const result = await authService.login('testuser', 'password123');
      const user = userRepo.findByUsername('testuser');
      
      expect(user.last_login).toBeDefined();
      expect(user.last_login).not.toBeNull();
    });
  });

  describe('generateToken', () => {
    test('should generate a valid JWT token', () => {
      const token = authService.generateToken(1, 'testuser');
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    test('should generate different tokens for different users', () => {
      const token1 = authService.generateToken(1, 'user1');
      const token2 = authService.generateToken(2, 'user2');
      
      expect(token1).not.toBe(token2);
    });
  });

  describe('verifyToken', () => {
    test('should verify a valid token', () => {
      const token = authService.generateToken(1, 'testuser');
      const result = authService.verifyToken(token);
      
      expect(result.success).toBe(true);
      expect(result.userId).toBe(1);
      expect(result.username).toBe('testuser');
    });

    test('should reject an invalid token', () => {
      const result = authService.verifyToken('invalid.token.here');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid token');
    });

    test('should reject a malformed token', () => {
      const result = authService.verifyToken('not.a.token');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid token');
    });
  });

  describe('getUserProfile', () => {
    beforeEach(async () => {
      await authService.signup('testuser', 'test@example.com', 'password123');
    });

    test('should return user profile for valid user id', async () => {
      const signupResult = await authService.signup('testuser2', 'test2@example.com', 'password123');
      const result = authService.getUserProfile(signupResult.userId);
      
      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.user.id).toBe(signupResult.userId);
      expect(result.user.username).toBe('testuser2');
      expect(result.user.email).toBe('test2@example.com');
      expect(result.user.password_hash).toBeUndefined();
    });

    test('should return error for non-existent user', () => {
      const result = authService.getUserProfile(999);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('User not found');
    });

    test('should not include password hash in profile', async () => {
      const signupResult = await authService.signup('testuser3', 'test3@example.com', 'password123');
      const result = authService.getUserProfile(signupResult.userId);
      
      expect(result.user.password_hash).toBeUndefined();
    });
  });
});
