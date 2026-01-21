/**
 * Session Rules Service
 * Load and manage session-level always-allowed and always-blocked lists
 */
class SessionRulesService {
  constructor(sessionRulesRepository) {
    this.rulesRepo = sessionRulesRepository;
    // Cache for rules (cleared on update)
    this.rulesCache = new Map();
  }

  /**
   * Get all session rules
   * @param {number} sessionId - Session ID
   * @returns {Object} Rules object with alwaysAllowed and alwaysBlocked arrays
   */
  getSessionRules(sessionId) {
    // Check cache first
    if (this.rulesCache.has(sessionId)) {
      return this.rulesCache.get(sessionId);
    }

    const alwaysAllowed = this.rulesRepo.getAlwaysAllowed(sessionId);
    const alwaysBlocked = this.rulesRepo.getAlwaysBlocked(sessionId);

    const rules = {
      alwaysAllowed: alwaysAllowed,
      alwaysBlocked: alwaysBlocked
    };

    // Cache for 5 minutes
    this.rulesCache.set(sessionId, rules);
    setTimeout(() => this.rulesCache.delete(sessionId), 5 * 60 * 1000);

    return rules;
  }

  /**
   * Check if app or domain is always-allowed
   * @param {number} sessionId - Session ID
   * @param {string} appName - App name
   * @param {string} domain - Domain name
   * @returns {boolean} True if always-allowed
   */
  isAlwaysAllowed(sessionId, appName, domain) {
    const rules = this.getSessionRules(sessionId);
    
    // Check app name
    if (appName) {
      const appAllowed = rules.alwaysAllowed.some(
        rule => rule.targetType === 'app' && 
                (rule.target.toLowerCase() === appName.toLowerCase() ||
                 appName.toLowerCase().includes(rule.target.toLowerCase()))
      );
      if (appAllowed) return true;
    }

    // Check domain
    if (domain) {
      const domainAllowed = rules.alwaysAllowed.some(
        rule => rule.targetType === 'domain' &&
                (rule.target.toLowerCase() === domain.toLowerCase() ||
                 domain.toLowerCase().includes(rule.target.toLowerCase()) ||
                 domain.toLowerCase().endsWith('.' + rule.target.toLowerCase()))
      );
      if (domainAllowed) return true;
    }

    // Check process identifier (if provided in appName)
    if (appName) {
      const processAllowed = rules.alwaysAllowed.some(
        rule => rule.targetType === 'process' &&
                rule.target.toLowerCase() === appName.toLowerCase()
      );
      if (processAllowed) return true;
    }

    return false;
  }

  /**
   * Check if app or domain is always-blocked
   * @param {number} sessionId - Session ID
   * @param {string} appName - App name
   * @param {string} domain - Domain name
   * @returns {boolean} True if always-blocked
   */
  isAlwaysBlocked(sessionId, appName, domain) {
    const rules = this.getSessionRules(sessionId);
    
    // Check app name
    if (appName) {
      const appBlocked = rules.alwaysBlocked.some(
        rule => rule.targetType === 'app' &&
                (rule.target.toLowerCase() === appName.toLowerCase() ||
                 appName.toLowerCase().includes(rule.target.toLowerCase()))
      );
      if (appBlocked) return true;
    }

    // Check domain
    if (domain) {
      const domainBlocked = rules.alwaysBlocked.some(
        rule => rule.targetType === 'domain' &&
                (rule.target.toLowerCase() === domain.toLowerCase() ||
                 domain.toLowerCase().includes(rule.target.toLowerCase()) ||
                 domain.toLowerCase().endsWith('.' + rule.target.toLowerCase()))
      );
      if (domainBlocked) return true;
    }

    // Check process identifier (if provided in appName)
    if (appName) {
      const processBlocked = rules.alwaysBlocked.some(
        rule => rule.targetType === 'process' &&
                rule.target.toLowerCase() === appName.toLowerCase()
      );
      if (processBlocked) return true;
    }

    return false;
  }

  /**
   * Clear cache for a session (call after updating rules)
   * @param {number} sessionId - Session ID
   */
  clearCache(sessionId) {
    this.rulesCache.delete(sessionId);
  }

  /**
   * Update session rules
   * @param {number} sessionId - Session ID
   * @param {Array<Object>} rules - Array of rule objects
   */
  updateRules(sessionId, rules) {
    this.rulesRepo.updateRules(sessionId, rules);
    this.clearCache(sessionId);
  }
}

module.exports = SessionRulesService;
