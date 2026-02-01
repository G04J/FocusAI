/**
 * Rule Service
 * Optional safety net blocklist for obvious distractions
 */
class RuleService {
  constructor() {
    // Hardcoded blocklist for obvious distractions
    this.blocklist = [
      'youtube.com',
      'youtu.be',
      'instagram.com',
      'facebook.com',
      'twitter.com',
      'x.com',
      'tiktok.com',
      'reddit.com',
      'netflix.com',
      'hulu.com',
      'disneyplus.com',
      'amazon.com',
      'ebay.com',
      'shopping',
      'games',
      'gaming'
    ];

    // Domain patterns to match
    this.domainPatterns = this.blocklist.map(domain => ({
      pattern: new RegExp(domain.replace(/\./g, '\\.'), 'i'),
      domain: domain
    }));
  }

  /**
   * Check if domain is in blocklist
   * @param {string} domain - Domain name
   * @returns {boolean} True if blocked
   */
  isInBlocklist(domain) {
    if (!domain) return false;

    const lowerDomain = domain.toLowerCase();

    // Check exact match
    if (this.blocklist.includes(lowerDomain)) {
      return true;
    }

    // Check pattern match
    for (const { pattern, domain: blockDomain } of this.domainPatterns) {
      if (pattern.test(lowerDomain)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get blocklist
   * @returns {Array<string>} Blocklist
   */
  getBlocklist() {
    return [...this.blocklist];
  }

  /**
   * Add domain to blocklist
   * @param {string} domain - Domain to add
   */
  addToBlocklist(domain) {
    if (domain && !this.blocklist.includes(domain.toLowerCase())) {
      this.blocklist.push(domain.toLowerCase());
      // Rebuild patterns
      this.domainPatterns = this.blocklist.map(domain => ({
        pattern: new RegExp(domain.replace(/\./g, '\\.'), 'i'),
        domain: domain
      }));
    }
  }
}

module.exports = RuleService;
