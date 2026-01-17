/**
 * Validation utilities class
 * Provides static methods for input validation
 */
class Validators {
  /**
   * Validates email format
   * @param {string} email - Email address to validate
   * @returns {{isValid: boolean, message: string|null}} Validation result
   */
  static validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return {
      isValid: emailRegex.test(email),
      message: emailRegex.test(email) ? null : 'Invalid email format'
    };
  }

  /**
   * Validates username format (3-20 characters, alphanumeric and underscore only)
   * @param {string} username - Username to validate
   * @returns {{isValid: boolean, message: string|null}} Validation result
   */
  static validateUsername(username) {
    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
    return {
      isValid: usernameRegex.test(username),
      message: usernameRegex.test(username) 
        ? null 
        : 'Username must be 3-20 characters (letters, numbers, underscore only)'
    };
  }

  /**
   * Validates password strength (minimum 6 characters)
   * @param {string} password - Password to validate
   * @returns {{isValid: boolean, message: string|null}} Validation result
   */
  static validatePassword(password) {
    const isValid = password.length >= 6;
    return {
      isValid: isValid,
      message: isValid ? null : 'Password must be at least 6 characters'
    };
  }

  /**
   * Validates session data (task name, duration, reference type)
   * @param {Object} data - Session data to validate
   * @param {string} data.taskName - Task name
   * @param {number} data.durationMinutes - Duration in minutes (1-480)
   * @param {string} [data.referenceType] - Reference type (optional)
   * @returns {{isValid: boolean, errors: string[]}} Validation result with error messages
   */
  static validateSessionData(data) {
    const errors = [];

    // Task name validation
    if (!data.taskName || typeof data.taskName !== 'string') {
      errors.push('Task name is required');
    } else if (data.taskName.trim().length === 0) {
      errors.push('Task name cannot be empty');
    }

    // Duration validation
    if (!data.durationMinutes || typeof data.durationMinutes !== 'number') {
      errors.push('Duration is required and must be a number');
    } else if (data.durationMinutes < 1 || data.durationMinutes > 480) {
      errors.push('Duration must be between 1 and 480 minutes');
    }

    // Reference type validation (if provided)
    if (data.referenceType) {
      const validTypes = ['url', 'file', 'text', 'mixed'];
      if (!validTypes.includes(data.referenceType)) {
        errors.push('Invalid reference type');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

module.exports = Validators;