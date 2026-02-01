/**
 * Session Rules Repository
 * Manages session-level always-allowed and always-blocked lists
 */
class SessionRulesRepository {
  constructor(db) {
    this.db = db;
  }

  /**
   * Get all rules for a session
   * @param {number} sessionId - Session ID
   * @returns {Array<Object>} Session rules
   */
  getRules(sessionId) {
    const stmt = this.db.prepare(`
      SELECT * FROM session_rules
      WHERE session_id = ?
      ORDER BY rule_type, target
    `);

    return stmt.all(sessionId).map(row => ({
      id: row.id,
      sessionId: row.session_id,
      ruleType: row.rule_type,
      target: row.target,
      targetType: row.target_type,
      createdAt: row.created_at
    }));
  }

  /**
   * Get always-allowed rules for a session
   * @param {number} sessionId - Session ID
   * @returns {Array<Object>} Always-allowed rules
   */
  getAlwaysAllowed(sessionId) {
    const stmt = this.db.prepare(`
      SELECT target, target_type FROM session_rules
      WHERE session_id = ? AND rule_type = 'always_allowed'
    `);

    return stmt.all(sessionId).map(row => ({
      target: row.target,
      targetType: row.target_type
    }));
  }

  /**
   * Get always-blocked rules for a session
   * @param {number} sessionId - Session ID
   * @returns {Array<Object>} Always-blocked rules
   */
  getAlwaysBlocked(sessionId) {
    const stmt = this.db.prepare(`
      SELECT target, target_type FROM session_rules
      WHERE session_id = ? AND rule_type = 'always_blocked'
    `);

    return stmt.all(sessionId).map(row => ({
      target: row.target,
      targetType: row.target_type
    }));
  }

  /**
   * Add a rule to a session
   * @param {number} sessionId - Session ID
   * @param {string} ruleType - 'always_allowed' or 'always_blocked'
   * @param {string} target - App name, domain, or process identifier
   * @param {string} targetType - 'app', 'domain', or 'process'
   * @returns {number} Rule ID
   */
  addRule(sessionId, ruleType, target, targetType) {
    const stmt = this.db.prepare(`
      INSERT INTO session_rules (session_id, rule_type, target, target_type)
      VALUES (?, ?, ?, ?)
    `);

    const result = stmt.run(sessionId, ruleType, target, targetType);
    return result.lastInsertRowid;
  }

  /**
   * Remove a rule
   * @param {number} ruleId - Rule ID
   */
  removeRule(ruleId) {
    const stmt = this.db.prepare(`
      DELETE FROM session_rules WHERE id = ?
    `);
    stmt.run(ruleId);
  }

  /**
   * Update rules for a session (clear and set new rules)
   * @param {number} sessionId - Session ID
   * @param {Array<Object>} rules - Array of rule objects {ruleType, target, targetType}
   */
  updateRules(sessionId, rules) {
    const transaction = this.db.transaction(() => {
      // Clear existing rules
      const deleteStmt = this.db.prepare(`
        DELETE FROM session_rules WHERE session_id = ?
      `);
      deleteStmt.run(sessionId);

      // Insert new rules
      const insertStmt = this.db.prepare(`
        INSERT INTO session_rules (session_id, rule_type, target, target_type)
        VALUES (?, ?, ?, ?)
      `);

      rules.forEach(rule => {
        insertStmt.run(sessionId, rule.ruleType, rule.target, rule.targetType);
      });
    });

    transaction();
  }

  /**
   * Delete all rules for a session
   * @param {number} sessionId - Session ID
   */
  deleteSessionRules(sessionId) {
    const stmt = this.db.prepare(`
      DELETE FROM session_rules WHERE session_id = ?
    `);
    stmt.run(sessionId);
  }
}

module.exports = SessionRulesRepository;
