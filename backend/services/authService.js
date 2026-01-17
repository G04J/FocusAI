const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const Validators = require('../utils/validators');

class AuthService {
  constructor(userRepository) {
    this.userRepo = userRepository;
    this.jwtSecret = 'focusai-secret-key-change-in-production';
    this.saltRounds = 10;
  }

  async signup(username, email, password) {
    try {
      // Validate username
      const usernameValidation = Validators.validateUsername(username);
      if (!usernameValidation.isValid) {
        return { success: false, error: usernameValidation.message };
      }

      // Validate email
      const emailValidation = Validators.validateEmail(email);
      if (!emailValidation.isValid) {
        return { success: false, error: emailValidation.message };
      }

      // Validate password
      const passwordValidation = Validators.validatePassword(password);
      if (!passwordValidation.isValid) {
        return { success: false, error: passwordValidation.message };
      }

      // Check if username exists
      if (this.userRepo.existsByUsername(username)) {
        return { success: false, error: 'Username already taken' };
      }

      // Check if email exists
      if (this.userRepo.existsByEmail(email)) {
        return { success: false, error: 'Email already registered' };
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, this.saltRounds);

      // Create user
      const result = this.userRepo.create(username, email, passwordHash);

      if (!result.success) {
        return result;
      }

      // Generate token
      const token = this.generateToken(result.userId, username);

      return {
        success: true,
        userId: result.userId,
        username: username,
        email: email,
        token: token
      };

    } catch (error) {
      console.error('Signup error:', error);
      return { success: false, error: 'Signup failed' };
    }
  }

  async login(usernameOrEmail, password) {
    try {
      // Find user
      let user = this.userRepo.findByUsername(usernameOrEmail);
      if (!user) {
        user = this.userRepo.findByEmail(usernameOrEmail);
      }

      if (!user) {
        return { success: false, error: 'Invalid credentials' };
      }

      // Verify password
      const isValid = await bcrypt.compare(password, user.password_hash);

      if (!isValid) {
        return { success: false, error: 'Invalid credentials' };
      }

      // Update last login
      this.userRepo.updateLastLogin(user.id);

      // Generate token
      const token = this.generateToken(user.id, user.username);

      return {
        success: true,
        userId: user.id,
        username: user.username,
        email: user.email,
        token: token
      };

    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'Login failed' };
    }
  }

  generateToken(userId, username) {
    return jwt.sign(
      { userId, username },
      this.jwtSecret,
      { expiresIn: '7d' }
    );
  }

  verifyToken(token) {
    try {
      const decoded = jwt.verify(token, this.jwtSecret);
      return {
        success: true,
        userId: decoded.userId,
        username: decoded.username
      };
    } catch (error) {
      return { success: false, error: 'Invalid token' };
    }
  }

  getUserProfile(userId) {
    const user = this.userRepo.findById(userId);
    if (!user) {
      return { success: false, error: 'User not found' };
    }

    return {
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        createdAt: user.created_at,
        lastLogin: user.last_login
      }
    };
  }
}

module.exports = AuthService;
