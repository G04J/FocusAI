const Database = require('better-sqlite3');

/**
 * Creates a temporary in-memory database for testing
 */
class TestDatabase {
  constructor() {
    // Use in-memory database for faster tests
    this.db = new Database(':memory:');
    this.db.pragma('foreign_keys = ON');
    this.initTables();
  }

  initTables() {
    // Users table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_login DATETIME
      )
    `);

    // Focus sessions table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS focus_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        task_name TEXT NOT NULL,
        task_description TEXT,
        duration_minutes INTEGER NOT NULL,
        reference_type TEXT,
        reference_url TEXT,
        reference_file_path TEXT,
        reference_text TEXT,
        status TEXT DEFAULT 'planned',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        started_at DATETIME,
        ended_at DATETIME,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // User rules table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS user_rules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        rule_type TEXT NOT NULL,
        target TEXT NOT NULL,
        category TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
  }

  getConnection() {
    return this.db;
  }

  clear() {
    this.db.exec('DELETE FROM focus_sessions');
    this.db.exec('DELETE FROM user_rules');
    this.db.exec('DELETE FROM users');
  }

  close() {
    if (this.db) {
      this.db.close();
    }
  }
}

module.exports = TestDatabase;
