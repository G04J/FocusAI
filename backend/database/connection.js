const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

class DatabaseConnection {
  constructor() {
    // Create database directory
    const dbDir = path.join(__dirname, '../../data');
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    // Initialize database
    const dbPath = path.join(dbDir, 'focusai.db');
    this.db = new Database(dbPath);
    this.db.pragma('foreign_keys = ON');
    
    console.log('✓ Database connected:', dbPath);
    this.initTables();
  }

  /**
   * Initializes database tables if they don't exist
   */
  initTables() {
    try {
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
        
        -- Reference materials (can be combined)
        reference_type TEXT, -- 'url', 'file', 'text', 'mixed', or null
        reference_url TEXT, -- JSON array of URLs or JSON object for mixed
        reference_file_path TEXT, -- JSON array of file paths
        reference_text TEXT,
        
        -- Session status
        status TEXT DEFAULT 'planned', -- 'planned', 'active', 'paused', 'stopped', 'completed'
        
        -- Timestamps
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        started_at DATETIME,
        ended_at DATETIME,
        
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    // User rules (always blocked/allowed) - for later
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS user_rules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        rule_type TEXT NOT NULL, -- 'always_blocked' or 'always_allowed'
        target TEXT NOT NULL, -- URL, domain, or app name
        category TEXT, -- 'website', 'app', 'domain'
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

      console.log('✓ Database tables initialized');
    } catch (error) {
      console.error('Error initializing database tables:', error);
      throw error;
    }
  }

  /**
   * Gets the database connection instance
   * @returns {Database} The SQLite database instance
   */
  getConnection() {
    return this.db;
  }

  /**
   * Closes the database connection
   */
  close() {
    try {
      if (this.db) {
        this.db.close();
        console.log('✓ Database connection closed');
      }
    } catch (error) {
      console.error('Error closing database connection:', error);
    }
  }
}


module.exports = DatabaseConnection;
