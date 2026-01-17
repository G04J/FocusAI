class SessionRepository {
  constructor(db) {
    this.db = db;
  }

  create(sessionData) {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO focus_sessions (
          user_id, task_name, task_description, duration_minutes,
          reference_type, reference_url, reference_file_path, reference_text
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        sessionData.userId || sessionData.user_id,  // ← ACCEPT BOTH FORMATS
        sessionData.taskName || sessionData.task_name,  // ← ACCEPT BOTH FORMATS
        sessionData.taskDescription || sessionData.task_description || null,  // ← ACCEPT BOTH FORMATS
        sessionData.durationMinutes || sessionData.duration_minutes,  // ← ACCEPT BOTH FORMATS
        sessionData.referenceType || sessionData.reference_type || null,  // ← ACCEPT BOTH FORMATS
        sessionData.referenceUrl || sessionData.reference_url || null,  // ← ACCEPT BOTH FORMATS
        sessionData.referenceFilePath || sessionData.reference_file_path || null,  // ← ACCEPT BOTH FORMATS
        sessionData.referenceText || sessionData.reference_text || null  // ← ACCEPT BOTH FORMATS
      );

      return {
        success: true,
        sessionId: result.lastInsertRowid
      };
    } catch (error) {
      console.error('Session creation error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  findById(sessionId) {
    const stmt = this.db.prepare('SELECT * FROM focus_sessions WHERE id = ?');
    return stmt.get(sessionId);
  }

  findByUserId(userId, status = null) {
    let query = 'SELECT * FROM focus_sessions WHERE user_id = ?';
    const params = [userId];

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC';

    const stmt = this.db.prepare(query);
    return stmt.all(...params);
  }

  updateStatus(sessionId, status, timestamp = null) {
    try {
      let query = 'UPDATE focus_sessions SET status = ?';
      const params = [status, sessionId];

      // Update timestamps based on status
      if (status === 'active' && timestamp) {
        query = 'UPDATE focus_sessions SET status = ?, started_at = ? WHERE id = ?';
        params.splice(1, 0, timestamp);
      } else if (status === 'completed' && timestamp) {
        query = 'UPDATE focus_sessions SET status = ?, ended_at = ? WHERE id = ?';
        params.splice(1, 0, timestamp);
      } else {
        query += ' WHERE id = ?';
      }

      const stmt = this.db.prepare(query);
      stmt.run(...params);

      return { success: true };
    } catch (error) {
      console.error('Status update error:', error);
      return { success: false, error: error.message };
    }
  }

  update(sessionId, updates) {
    try {
      const fields = [];
      const values = [];

      for (const [key, value] of Object.entries(updates)) {
        fields.push(`${key} = ?`);
        values.push(value);
      }

      values.push(sessionId);

      const stmt = this.db.prepare(`
        UPDATE focus_sessions 
        SET ${fields.join(', ')} 
        WHERE id = ?
      `);

      stmt.run(...values);
      return { success: true };
    } catch (error) {
      console.error('Session update error:', error);
      return { success: false, error: error.message };
    }
  }

  delete(sessionId) {
    try {
      const stmt = this.db.prepare('DELETE FROM focus_sessions WHERE id = ?');
      stmt.run(sessionId);
      return { success: true };
    } catch (error) {
      console.error('Session deletion error:', error);
      return { success: false, error: error.message };
    }
  }

    getActiveSession(userId) {
    const stmt = this.db.prepare(`
        SELECT * FROM focus_sessions 
        WHERE user_id = ? AND status = 'active'
        LIMIT 1
    `);
    return stmt.get(userId);
    }

  // Statistics
  getUserStats(userId) {
    const stmt = this.db.prepare(`
      SELECT 
        COUNT(*) as total_sessions,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_sessions,
        SUM(CASE WHEN status = 'completed' THEN duration_minutes ELSE 0 END) as total_focus_minutes
      FROM focus_sessions 
      WHERE user_id = ?
    `);
    return stmt.get(userId);
  }

    getActiveOrPausedSession(userId) {
    const stmt = this.db.prepare(`
        SELECT * FROM focus_sessions 
        WHERE user_id = ? AND (status = 'active' OR status = 'paused')
        ORDER BY started_at DESC
        LIMIT 1
    `);
    return stmt.get(userId);
    }
}

module.exports = SessionRepository;
