/**
 * Activity Repository
 * Manages session activity logging
 */
class ActivityRepository {
  constructor(db) {
    this.db = db;
    this.writeQueue = [];
    this.flushInterval = null;
    this.startBatchWrites();
  }

  /**
   * Start batch write processing
   */
  startBatchWrites() {
    // Flush queue every 5 seconds
    this.flushInterval = setInterval(() => {
      this.flushQueue();
    }, 5000);
  }

  /**
   * Stop batch write processing
   */
  stopBatchWrites() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    // Flush remaining items
    this.flushQueue();
  }

  /**
   * Flush write queue
   */
  flushQueue() {
    if (this.writeQueue.length === 0) return;

    const transaction = this.db.transaction(() => {
      const stmt = this.db.prepare(`
        INSERT INTO session_activities 
        (session_id, activity_type, state, previous_state, app_name, window_title,
         detected_domain, detected_url, ocr_confidence, ocr_text, is_distraction,
         is_blocked, block_duration_seconds, detection_method, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      while (this.writeQueue.length > 0) {
        const activity = this.writeQueue.shift();
        try {
          stmt.run(
            activity.sessionId,
            activity.activityType,
            activity.state || null,
            activity.previousState || null,
            activity.appName || null,
            activity.windowTitle || null,
            activity.detectedDomain || null,
            activity.detectedUrl || null,
            activity.ocrConfidence || null,
            activity.ocrText || null,
            activity.isDistraction ? 1 : 0,
            activity.isBlocked ? 1 : 0,
            activity.blockDurationSeconds || null,
            activity.detectionMethod || null,
            activity.metadata ? JSON.stringify(activity.metadata) : null
          );
        } catch (error) {
          console.error('Error logging activity:', error);
          // Retry later
          this.writeQueue.push(activity);
        }
      }
    });

    try {
      transaction();
    } catch (error) {
      console.error('Error flushing activity queue:', error);
    }
  }

  /**
   * Log activity (queued for batch write)
   * @param {Object} activity - Activity object
   */
  logActivity(activity) {
    // Add to queue for batch writing
    this.writeQueue.push(activity);

    // Immediate flush if queue is getting large
    if (this.writeQueue.length > 50) {
      this.flushQueue();
    }
  }

  /**
   * Get session activities
   * @param {number} sessionId - Session ID
   * @param {Object} filters - Filter options
   * @returns {Array<Object>} Activities
   */
  getSessionActivities(sessionId, filters = {}) {
    let query = `
      SELECT * FROM session_activities
      WHERE session_id = ?
    `;
    const params = [sessionId];

    if (filters.activityType) {
      query += ' AND activity_type = ?';
      params.push(filters.activityType);
    }

    if (filters.state) {
      query += ' AND state = ?';
      params.push(filters.state);
    }

    if (filters.startDate) {
      query += ' AND timestamp >= ?';
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      query += ' AND timestamp <= ?';
      params.push(filters.endDate);
    }

    query += ' ORDER BY timestamp DESC';

    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    }

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params);

    return rows.map(row => ({
      id: row.id,
      sessionId: row.session_id,
      timestamp: row.timestamp,
      activityType: row.activity_type,
      state: row.state,
      previousState: row.previous_state,
      appName: row.app_name,
      windowTitle: row.window_title,
      detectedDomain: row.detected_domain,
      detectedUrl: row.detected_url,
      ocrConfidence: row.ocr_confidence,
      ocrText: row.ocr_text,
      isDistraction: row.is_distraction === 1,
      isBlocked: row.is_blocked === 1,
      blockDurationSeconds: row.block_duration_seconds,
      detectionMethod: row.detection_method,
      metadata: row.metadata ? JSON.parse(row.metadata) : null
    }));
  }

  /**
   * Get distractions for a session
   * @param {number} sessionId - Session ID
   * @returns {Array<Object>} Distractions
   */
  getDistractions(sessionId) {
    return this.getSessionActivities(sessionId, {
      activityType: 'distraction_detected',
      isDistraction: true
    });
  }

  /**
   * Get state transitions for a session
   * @param {number} sessionId - Session ID
   * @returns {Array<Object>} State transitions
   */
  getStateTransitions(sessionId) {
    return this.getSessionActivities(sessionId, {
      activityType: 'state_change'
    });
  }

  /**
   * Cleanup old activities (optional)
   * @param {number} daysOld - Days old to delete
   */
  cleanupOldActivities(daysOld = 30) {
    const stmt = this.db.prepare(`
      DELETE FROM session_activities
      WHERE timestamp < datetime('now', '-' || ? || ' days')
    `);
    stmt.run(daysOld);
  }
}

module.exports = ActivityRepository;
