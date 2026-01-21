/**
 * Session Statistics Repository
 * Manages session statistics with incremental updates
 */
class SessionStatisticsRepository {
  constructor(db) {
    this.db = db;
  }

  /**
   * Initialize statistics for a session
   * @param {number} sessionId - Session ID
   */
  initialize(sessionId) {
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO session_statistics 
      (session_id) VALUES (?)
    `);
    stmt.run(sessionId);
  }

  /**
   * Update statistics incrementally
   * @param {number} sessionId - Session ID
   * @param {Object} updates - Update object
   */
  updateStats(sessionId, updates) {
    this.initialize(sessionId);

    // Build update query dynamically
    const fields = [];
    const values = [];

    if (updates.totalMonitoringSeconds !== undefined) {
      fields.push('total_monitoring_seconds = total_monitoring_seconds + ?');
      values.push(updates.totalMonitoringSeconds);
    }

    if (updates.timeInGreenState !== undefined) {
      fields.push('time_in_green_state = time_in_green_state + ?');
      values.push(updates.timeInGreenState);
    }

    if (updates.timeInYellowState !== undefined) {
      fields.push('time_in_yellow_state = time_in_yellow_state + ?');
      values.push(updates.timeInYellowState);
    }

    if (updates.timeInAmbiguousState !== undefined) {
      fields.push('time_in_ambiguous_state = time_in_ambiguous_state + ?');
      values.push(updates.timeInAmbiguousState);
    }

    if (updates.timeInRedState !== undefined) {
      fields.push('time_in_red_state = time_in_red_state + ?');
      values.push(updates.timeInRedState);
    }

    if (updates.totalDistractionsDetected !== undefined) {
      fields.push('total_distractions_detected = total_distractions_detected + ?');
      values.push(updates.totalDistractionsDetected);
    }

    if (updates.totalBlocksApplied !== undefined) {
      fields.push('total_blocks_applied = total_blocks_applied + ?');
      values.push(updates.totalBlocksApplied);
    }

    if (updates.totalBlockDurationSeconds !== undefined) {
      fields.push('total_block_duration_seconds = total_block_duration_seconds + ?');
      values.push(updates.totalBlockDurationSeconds);
    }

    if (updates.distractingApps !== undefined) {
      fields.push('distracting_apps = ?');
      values.push(updates.distractingApps);
    }

    if (updates.distractingDomains !== undefined) {
      fields.push('distracting_domains = ?');
      values.push(updates.distractingDomains);
    }

    if (updates.mostBlockedDomain !== undefined) {
      fields.push('most_blocked_domain = ?');
      values.push(updates.mostBlockedDomain);
    }

    if (updates.mostBlockedApp !== undefined) {
      fields.push('most_blocked_app = ?');
      values.push(updates.mostBlockedApp);
    }

    if (updates.avgOcrTimeMs !== undefined) {
      fields.push('avg_ocr_time_ms = ?');
      values.push(updates.avgOcrTimeMs);
    }

    if (updates.avgDetectionTimeMs !== undefined) {
      fields.push('avg_detection_time_ms = ?');
      values.push(updates.avgDetectionTimeMs);
    }

    if (updates.totalScreenshotsTaken !== undefined) {
      fields.push('total_screenshots_taken = total_screenshots_taken + ?');
      values.push(updates.totalScreenshotsTaken);
    }

    if (updates.firstDistractionAt !== undefined) {
      fields.push('first_distraction_at = COALESCE(first_distraction_at, ?)');
      values.push(updates.firstDistractionAt);
    }

    if (updates.lastDistractionAt !== undefined) {
      fields.push('last_distraction_at = ?');
      values.push(updates.lastDistractionAt);
    }

    if (fields.length === 0) {
      return;
    }

    // Add updated_at
    fields.push('updated_at = CURRENT_TIMESTAMP');

    const query = `
      UPDATE session_statistics
      SET ${fields.join(', ')}
      WHERE session_id = ?
    `;

    values.push(sessionId);

    const stmt = this.db.prepare(query);
    stmt.run(...values);
  }

  /**
   * Get statistics for a session
   * @param {number} sessionId - Session ID
   * @returns {Object|null} Statistics
   */
  getStats(sessionId) {
    const stmt = this.db.prepare(`
      SELECT * FROM session_statistics
      WHERE session_id = ?
    `);

    const row = stmt.get(sessionId);
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      sessionId: row.session_id,
      totalMonitoringSeconds: row.total_monitoring_seconds || 0,
      timeInGreenState: row.time_in_green_state || 0,
      timeInYellowState: row.time_in_yellow_state || 0,
      timeInAmbiguousState: row.time_in_ambiguous_state || 0,
      timeInRedState: row.time_in_red_state || 0,
      totalDistractionsDetected: row.total_distractions_detected || 0,
      totalBlocksApplied: row.total_blocks_applied || 0,
      totalBlockDurationSeconds: row.total_block_duration_seconds || 0,
      distractingApps: row.distracting_apps,
      distractingDomains: row.distracting_domains,
      mostBlockedDomain: row.most_blocked_domain,
      mostBlockedApp: row.most_blocked_app,
      avgOcrTimeMs: row.avg_ocr_time_ms,
      avgDetectionTimeMs: row.avg_detection_time_ms,
      totalScreenshotsTaken: row.total_screenshots_taken || 0,
      firstDistractionAt: row.first_distraction_at,
      lastDistractionAt: row.last_distraction_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

module.exports = SessionStatisticsRepository;
