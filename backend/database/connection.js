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
        paused_at DATETIME,
        ended_at DATETIME,
        
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Add paused_at column if it doesn't exist (for existing databases)
    try {
      this.db.exec(`ALTER TABLE focus_sessions ADD COLUMN paused_at DATETIME;`);
    } catch (error) {
      // Column already exists, ignore error
      if (!error.message.includes('duplicate column')) {
        console.warn('Could not add paused_at column:', error.message);
      }
    }

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

    // Session reference content (processed references for AI context)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS session_reference_content (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER NOT NULL,
        reference_type TEXT NOT NULL, -- 'pdf', 'url', 'text'
        reference_source TEXT, -- file path, URL, or 'text'
        processed_content TEXT, -- extracted text content
        keywords TEXT, -- JSON array of keywords
        summary TEXT, -- brief summary
        processed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES focus_sessions(id) ON DELETE CASCADE
      )
    `);

    // Session rules (always-allowed/blocked lists per session)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS session_rules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER NOT NULL,
        rule_type TEXT NOT NULL, -- 'always_allowed' or 'always_blocked'
        target TEXT NOT NULL, -- App name, domain, or process identifier
        target_type TEXT NOT NULL, -- 'app', 'domain', 'process'
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES focus_sessions(id) ON DELETE CASCADE
      )
    `);

    // Session activities (monitoring events)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS session_activities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        activity_type TEXT NOT NULL, -- 'state_change', 'distraction_detected', 'block_applied', 'ocr_result'
        state TEXT, -- 'GREEN', 'YELLOW', 'AMBIGUOUS', 'RED'
        previous_state TEXT, -- For state_change events
        app_name TEXT,
        window_title TEXT,
        detected_domain TEXT,
        detected_url TEXT,
        ocr_confidence REAL,
        ocr_text TEXT,
        is_distraction BOOLEAN DEFAULT 0,
        is_blocked BOOLEAN DEFAULT 0,
        block_duration_seconds INTEGER,
        detection_method TEXT,
        metadata TEXT, -- JSON string for additional data (flexible)
        FOREIGN KEY (session_id) REFERENCES focus_sessions(id) ON DELETE CASCADE
      )
    `);

    // Session statistics (aggregated monitoring stats)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS session_statistics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER UNIQUE NOT NULL,
        total_monitoring_seconds INTEGER DEFAULT 0,
        time_in_green_state INTEGER DEFAULT 0,
        time_in_yellow_state INTEGER DEFAULT 0,
        time_in_ambiguous_state INTEGER DEFAULT 0,
        time_in_red_state INTEGER DEFAULT 0,
        total_distractions_detected INTEGER DEFAULT 0,
        total_blocks_applied INTEGER DEFAULT 0,
        total_block_duration_seconds INTEGER DEFAULT 0,
        distracting_apps TEXT,
        distracting_domains TEXT,
        most_blocked_domain TEXT,
        most_blocked_app TEXT,
        avg_ocr_time_ms REAL,
        avg_detection_time_ms REAL,
        total_screenshots_taken INTEGER DEFAULT 0,
        first_distraction_at DATETIME,
        last_distraction_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES focus_sessions(id) ON DELETE CASCADE
      )
    `);

    // Create indexes for performance
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_session_rules_session_id ON session_rules(session_id);
      CREATE INDEX IF NOT EXISTS idx_session_rules_type ON session_rules(rule_type);
      CREATE INDEX IF NOT EXISTS idx_session_reference_content_session_id ON session_reference_content(session_id);
      CREATE INDEX IF NOT EXISTS idx_session_activities_session_id ON session_activities(session_id);
      CREATE INDEX IF NOT EXISTS idx_session_activities_timestamp ON session_activities(timestamp);
      CREATE INDEX IF NOT EXISTS idx_session_activities_type ON session_activities(activity_type);
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
