const Validators = require('../../utils/validators');

describe('Validators', () => {
  describe('validateEmail', () => {
    test('should validate correct email addresses', () => {
      expect(Validators.validateEmail('test@example.com').isValid).toBe(true);
      expect(Validators.validateEmail('user.name@domain.co.uk').isValid).toBe(true);
      expect(Validators.validateEmail('test+tag@example.com').isValid).toBe(true);
    });

    test('should reject invalid email addresses', () => {
      expect(Validators.validateEmail('invalid').isValid).toBe(false);
      expect(Validators.validateEmail('invalid@').isValid).toBe(false);
      expect(Validators.validateEmail('@example.com').isValid).toBe(false);
      expect(Validators.validateEmail('test@').isValid).toBe(false);
      expect(Validators.validateEmail('').isValid).toBe(false);
    });

    test('should return error message for invalid emails', () => {
      const result = Validators.validateEmail('invalid');
      expect(result.isValid).toBe(false);
      expect(result.message).toBe('Invalid email format');
    });
  });

  describe('validateUsername', () => {
    test('should validate correct usernames', () => {
      expect(Validators.validateUsername('user123').isValid).toBe(true);
      expect(Validators.validateUsername('test_user').isValid).toBe(true);
      expect(Validators.validateUsername('abc').isValid).toBe(true);
      expect(Validators.validateUsername('username123_').isValid).toBe(true);
    });

    test('should reject usernames that are too short', () => {
      expect(Validators.validateUsername('ab').isValid).toBe(false);
      expect(Validators.validateUsername('a').isValid).toBe(false);
      expect(Validators.validateUsername('').isValid).toBe(false);
    });

    test('should reject usernames that are too long', () => {
      expect(Validators.validateUsername('a'.repeat(21)).isValid).toBe(false);
    });

    test('should reject usernames with invalid characters', () => {
      expect(Validators.validateUsername('user-name').isValid).toBe(false);
      expect(Validators.validateUsername('user name').isValid).toBe(false);
      expect(Validators.validateUsername('user@name').isValid).toBe(false);
      expect(Validators.validateUsername('user.name').isValid).toBe(false);
    });

    test('should return error message for invalid usernames', () => {
      const result = Validators.validateUsername('ab');
      expect(result.isValid).toBe(false);
      expect(result.message).toContain('Username must be 3-20 characters');
    });
  });

  describe('validatePassword', () => {
    test('should validate passwords with 6 or more characters', () => {
      expect(Validators.validatePassword('password').isValid).toBe(true);
      expect(Validators.validatePassword('123456').isValid).toBe(true);
      expect(Validators.validatePassword('a'.repeat(10)).isValid).toBe(true);
    });

    test('should reject passwords with less than 6 characters', () => {
      expect(Validators.validatePassword('12345').isValid).toBe(false);
      expect(Validators.validatePassword('pass').isValid).toBe(false);
      expect(Validators.validatePassword('').isValid).toBe(false);
    });

    test('should return error message for invalid passwords', () => {
      const result = Validators.validatePassword('short');
      expect(result.isValid).toBe(false);
      expect(result.message).toBe('Password must be at least 6 characters');
    });
  });

  describe('validateSessionData', () => {
    test('should validate correct session data', () => {
      const data = {
        taskName: 'Test Task',
        durationMinutes: 30
      };
      const result = Validators.validateSessionData(data);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should validate session data with optional fields', () => {
      const data = {
        taskName: 'Test Task',
        durationMinutes: 60,
        referenceType: 'url'
      };
      const result = Validators.validateSessionData(data);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should reject missing task name', () => {
      const data = {
        durationMinutes: 30
      };
      const result = Validators.validateSessionData(data);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Task name is required');
    });

    test('should reject empty task name', () => {
      const data = {
        taskName: '   ',
        durationMinutes: 30
      };
      const result = Validators.validateSessionData(data);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Task name cannot be empty');
    });

    test('should reject missing duration', () => {
      const data = {
        taskName: 'Test Task'
      };
      const result = Validators.validateSessionData(data);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Duration is required and must be a number');
    });

    test('should reject duration less than 1 minute', () => {
      const data = {
        taskName: 'Test Task',
        durationMinutes: 0
      };
      const result = Validators.validateSessionData(data);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Duration must be between 1 and 480 minutes');
    });

    test('should reject duration greater than 480 minutes', () => {
      const data = {
        taskName: 'Test Task',
        durationMinutes: 481
      };
      const result = Validators.validateSessionData(data);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Duration must be between 1 and 480 minutes');
    });

    test('should reject invalid reference type', () => {
      const data = {
        taskName: 'Test Task',
        durationMinutes: 30,
        referenceType: 'invalid'
      };
      const result = Validators.validateSessionData(data);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid reference type');
    });

    test('should accept valid reference types', () => {
      const validTypes = ['url', 'file', 'text', 'mixed'];
      validTypes.forEach(type => {
        const data = {
          taskName: 'Test Task',
          durationMinutes: 30,
          referenceType: type
        };
        const result = Validators.validateSessionData(data);
        expect(result.isValid).toBe(true);
      });
    });

    test('should return multiple errors for multiple invalid fields', () => {
      const data = {
        taskName: '',
        durationMinutes: 500,
        referenceType: 'invalid'
      };
      const result = Validators.validateSessionData(data);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });
});
