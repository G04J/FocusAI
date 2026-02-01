class UserRepository {
  constructor(db) {
    this.db = db;
  }

  create(username, email, passwordHash) {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO users (username, email, password_hash)
        VALUES (?, ?, ?)
      `);
      
      const result = stmt.run(username, email, passwordHash);
      
      return {
        success: true,
        userId: result.lastInsertRowid
      };
    } catch (error) {
      if (error.message.includes('UNIQUE constraint failed')) {
        if (error.message.includes('username')) {
          return { success: false, error: 'Username already exists' };
        }
        if (error.message.includes('email')) {
          return { success: false, error: 'Email already exists' };
        }
      }
      return { success: false, error: error.message };
    }
  }

  findByUsername(username) {
    const stmt = this.db.prepare('SELECT * FROM users WHERE username = ?');
    return stmt.get(username);
  }

  findByEmail(email) {
    const stmt = this.db.prepare('SELECT * FROM users WHERE email = ?');
    return stmt.get(email);
  }

  findById(userId) {
    const stmt = this.db.prepare(`
      SELECT id, username, email, created_at, last_login 
      FROM users 
      WHERE id = ?
    `);
    return stmt.get(userId);
  }

  updateLastLogin(userId) {
    const stmt = this.db.prepare(`
      UPDATE users 
      SET last_login = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);
    stmt.run(userId);
  }

  existsByUsername(username) {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM users WHERE username = ?');
    const result = stmt.get(username);
    return result.count > 0;
  }

  existsByEmail(email) {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM users WHERE email = ?');
    const result = stmt.get(email);
    return result.count > 0;
  }
}

module.exports = UserRepository;
