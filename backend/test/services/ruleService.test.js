const RuleService = require('../../services/ruleService');

describe('RuleService', () => {
  let ruleService;

  beforeEach(() => {
    ruleService = new RuleService();
  });

  describe('isInBlocklist', () => {
    test('should block known distraction domains', () => {
      expect(ruleService.isInBlocklist('youtube.com')).toBe(true);
      expect(ruleService.isInBlocklist('instagram.com')).toBe(true);
      expect(ruleService.isInBlocklist('facebook.com')).toBe(true);
      expect(ruleService.isInBlocklist('twitter.com')).toBe(true);
      expect(ruleService.isInBlocklist('reddit.com')).toBe(true);
    });

    test('should block domain variations', () => {
      expect(ruleService.isInBlocklist('www.youtube.com')).toBe(true);
      expect(ruleService.isInBlocklist('m.youtube.com')).toBe(true);
      expect(ruleService.isInBlocklist('subdomain.instagram.com')).toBe(true);
    });

    test('should be case-insensitive', () => {
      expect(ruleService.isInBlocklist('YOUTUBE.COM')).toBe(true);
      expect(ruleService.isInBlocklist('YouTube.com')).toBe(true);
      expect(ruleService.isInBlocklist('yOuTuBe.CoM')).toBe(true);
    });

    test('should allow non-blocked domains', () => {
      expect(ruleService.isInBlocklist('github.com')).toBe(false);
      expect(ruleService.isInBlocklist('stackoverflow.com')).toBe(false);
      expect(ruleService.isInBlocklist('example.com')).toBe(false);
      expect(ruleService.isInBlocklist('work-related-site.com')).toBe(false);
    });

    test('should handle null/undefined gracefully', () => {
      expect(ruleService.isInBlocklist(null)).toBe(false);
      expect(ruleService.isInBlocklist(undefined)).toBe(false);
      expect(ruleService.isInBlocklist('')).toBe(false);
    });

    test('should block shopping-related domains', () => {
      expect(ruleService.isInBlocklist('amazon.com')).toBe(true);
      expect(ruleService.isInBlocklist('ebay.com')).toBe(true);
    });

    test('should block streaming services', () => {
      expect(ruleService.isInBlocklist('netflix.com')).toBe(true);
      expect(ruleService.isInBlocklist('hulu.com')).toBe(true);
      expect(ruleService.isInBlocklist('disneyplus.com')).toBe(true);
    });

    test('should block gaming-related domains', () => {
      // Note: The blocklist includes 'games' and 'gaming' as patterns
      expect(ruleService.isInBlocklist('games.com')).toBe(true);
      expect(ruleService.isInBlocklist('gaming-site.com')).toBe(true);
    });
  });

  describe('getBlocklist', () => {
    test('should return a copy of the blocklist', () => {
      const blocklist = ruleService.getBlocklist();
      
      expect(Array.isArray(blocklist)).toBe(true);
      expect(blocklist.length).toBeGreaterThan(0);
      expect(blocklist).toContain('youtube.com');
    });

    test('should return a new array (not reference)', () => {
      const blocklist1 = ruleService.getBlocklist();
      const blocklist2 = ruleService.getBlocklist();
      
      expect(blocklist1).toEqual(blocklist2);
      expect(blocklist1).not.toBe(blocklist2); // Different references
    });
  });

  describe('addToBlocklist', () => {
    test('should add new domain to blocklist', () => {
      const initialLength = ruleService.getBlocklist().length;
      
      ruleService.addToBlocklist('newsite.com');
      
      const blocklist = ruleService.getBlocklist();
      expect(blocklist.length).toBe(initialLength + 1);
      expect(ruleService.isInBlocklist('newsite.com')).toBe(true);
    });

    test('should not add duplicate domains', () => {
      const initialLength = ruleService.getBlocklist().length;
      
      ruleService.addToBlocklist('newsite.com');
      ruleService.addToBlocklist('newsite.com');
      
      const blocklist = ruleService.getBlocklist();
      expect(blocklist.length).toBe(initialLength + 1);
    });

    test('should be case-insensitive when adding', () => {
      ruleService.addToBlocklist('Newsite.com');
      ruleService.addToBlocklist('NEWSITE.COM');
      
      const blocklist = ruleService.getBlocklist();
      const lowercased = blocklist.map(d => d.toLowerCase());
      expect(lowercased.filter(d => d === 'newsite.com').length).toBe(1);
    });

    test('should handle null/undefined gracefully', () => {
      const initialLength = ruleService.getBlocklist().length;
      
      ruleService.addToBlocklist(null);
      ruleService.addToBlocklist(undefined);
      
      expect(ruleService.getBlocklist().length).toBe(initialLength);
    });

    test('should rebuild patterns after adding', () => {
      ruleService.addToBlocklist('testdomain.com');
      
      // Should match variations
      expect(ruleService.isInBlocklist('www.testdomain.com')).toBe(true);
      expect(ruleService.isInBlocklist('sub.testdomain.com')).toBe(true);
    });
  });

  describe('edge cases', () => {
    test('should handle very long domain names', () => {
      const longDomain = 'a'.repeat(100) + '.com';
      expect(() => ruleService.isInBlocklist(longDomain)).not.toThrow();
    });

    test('should handle special characters in domain', () => {
      // Domains shouldn't have special chars, but test robustness
      expect(() => ruleService.isInBlocklist('test@domain.com')).not.toThrow();
    });

    test('should handle domains with paths', () => {
      // Should still match base domain
      expect(ruleService.isInBlocklist('youtube.com/watch?v=123')).toBe(true);
    });
  });
});
