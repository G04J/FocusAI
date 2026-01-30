const DistractionDetector = require('../../services/distractionDetector');
const SessionRulesService = require('../../services/sessionRulesService');
const RuleService = require('../../services/ruleService');
const OCRService = require('../../services/ocrService');
const AIClassificationService = require('../../services/aiClassificationService');
const TaskContextService = require('../../services/taskContextService');

// Mock dependencies
jest.mock('../../services/ocrService');
jest.mock('../../services/aiClassificationService');
jest.mock('../../services/taskContextService');

describe('DistractionDetector', () => {
  let distractionDetector;
  let mockSessionRulesService;
  let mockRuleService;
  let mockOCRService;
  let mockAIService;
  let mockTaskContextService;

  beforeEach(() => {
    // Create mock services
    mockSessionRulesService = {
      isAlwaysBlocked: jest.fn(),
      isAlwaysAllowed: jest.fn()
    };

    mockRuleService = {
      isInBlocklist: jest.fn()
    };

    mockOCRService = {
      ocrUrlBar: jest.fn(),
      extractDomain: jest.fn()
    };

    mockAIService = {
      classifyContent: jest.fn()
    };

    mockTaskContextService = {
      getTaskContext: jest.fn()
    };

    distractionDetector = new DistractionDetector(
      mockSessionRulesService,
      mockRuleService,
      mockOCRService,
      mockAIService,
      mockTaskContextService
    );
  });

  afterEach(() => {
    // Reset all mocks between tests to prevent interference
    jest.clearAllMocks();
  });

  describe('detectDistraction - Safe Apps', () => {
    test('should allow safe apps like VSCode', async () => {
      const windowInfo = {
        appName: 'Code',
        windowTitle: 'test.js',
        bounds: { x: 0, y: 0, width: 1920, height: 1080 }
      };

      const result = await distractionDetector.detectDistraction(1, windowInfo);

      expect(result.isDistraction).toBe(false);
      expect(result.confidence).toBe(1.0);
      expect(result.detectionMethod).toBe('app_name');
      expect(result.reason).toBe('Safe application detected');
    });

    test('should allow Terminal apps', async () => {
      const windowInfo = {
        appName: 'Terminal',
        windowTitle: 'bash',
        bounds: { x: 0, y: 0, width: 1920, height: 1080 }
      };

      const result = await distractionDetector.detectDistraction(1, windowInfo);

      expect(result.isDistraction).toBe(false);
      expect(result.detectionMethod).toBe('app_name');
    });

    test('should allow iTerm2', async () => {
      const windowInfo = {
        appName: 'iTerm2',
        windowTitle: 'zsh',
        bounds: { x: 0, y: 0, width: 1920, height: 1080 }
      };

      const result = await distractionDetector.detectDistraction(1, windowInfo);

      expect(result.isDistraction).toBe(false);
    });
  });

  describe('detectDistraction - Always Blocked List', () => {
    test('should block if in always-blocked list', async () => {
      mockSessionRulesService.isAlwaysBlocked.mockReturnValue(true);

      const windowInfo = {
        appName: 'Chrome',
        windowTitle: 'Test',
        bounds: { x: 0, y: 0, width: 1920, height: 1080 }
      };

      const result = await distractionDetector.detectDistraction(1, windowInfo);

      expect(result.isDistraction).toBe(true);
      expect(result.confidence).toBe(1.0);
      expect(result.detectionMethod).toBe('always_blocked');
      expect(mockSessionRulesService.isAlwaysBlocked).toHaveBeenCalledWith(1, 'Chrome', null);
    });
  });

  describe('detectDistraction - Always Allowed List', () => {
    test('should allow if in always-allowed list', async () => {
      mockSessionRulesService.isAlwaysBlocked.mockReturnValue(false);
      mockSessionRulesService.isAlwaysAllowed.mockReturnValue(true);

      const windowInfo = {
        appName: 'Chrome',
        windowTitle: 'Work Site',
        bounds: { x: 0, y: 0, width: 1920, height: 1080 }
      };

      const result = await distractionDetector.detectDistraction(1, windowInfo);

      expect(result.isDistraction).toBe(false);
      expect(result.confidence).toBe(1.0);
      expect(result.detectionMethod).toBe('always_allowed');
    });
  });

  describe('detectDistraction - Safety Net Blocklist', () => {
    test('should block if in safety net blocklist', async () => {
      mockSessionRulesService.isAlwaysBlocked.mockReturnValue(false);
      mockSessionRulesService.isAlwaysAllowed.mockReturnValue(false);
      mockRuleService.isInBlocklist.mockReturnValue(true);
      
      // Mock OCR to return text, then extractDomain will be called on that text
      mockOCRService.ocrUrlBar.mockResolvedValue({
        text: 'https://youtube.com',
        confidence: 0.9
      });
      // Mock extractDomain to return domain when called with any text
      mockOCRService.extractDomain.mockImplementation((text) => {
        if (text && text.includes('youtube.com')) {
          return { domain: 'youtube.com', url: 'https://youtube.com' };
        }
        return { domain: null, url: null };
      });
      
      // Make sure task context returns null so it doesn't go to AI classification
      mockTaskContextService.getTaskContext.mockReturnValue(null);

      const windowInfo = {
        appName: 'Chrome',
        windowTitle: 'YouTube',
        bounds: { x: 0, y: 0, width: 1920, height: 1080 }
      };

      const screenshotBuffer = Buffer.from('fake screenshot');

      const result = await distractionDetector.detectDistraction(1, windowInfo, screenshotBuffer);

      expect(result.isDistraction).toBe(true);
      expect(result.confidence).toBe(0.95);
      expect(result.detectionMethod).toBe('safety_net');
      expect(result.detectedDomain).toBe('youtube.com');
    });
  });

  describe('detectDistraction - AI Classification', () => {
    test('should use AI classification when no fast rules match', async () => {
      mockSessionRulesService.isAlwaysBlocked.mockReturnValue(false);
      mockSessionRulesService.isAlwaysAllowed.mockReturnValue(false);
      mockRuleService.isInBlocklist.mockReturnValue(false);
      
      mockTaskContextService.getTaskContext.mockReturnValue({
        taskName: 'Test Task',
        keywords: ['test', 'work']
      });

      mockAIService.classifyContent.mockResolvedValue({
        isDistraction: false,
        confidence: 0.85,
        reason: 'Task-related content'
      });

      mockOCRService.ocrUrlBar.mockResolvedValue({
        text: 'https://example.com',
        confidence: 0.9
      });

      mockOCRService.extractDomain.mockReturnValue({
        domain: 'example.com',
        url: 'https://example.com'
      });

      const windowInfo = {
        appName: 'Chrome',
        windowTitle: 'Example',
        bounds: { x: 0, y: 0, width: 1920, height: 1080 }
      };

      const screenshotBuffer = Buffer.from('fake screenshot');

      const result = await distractionDetector.detectDistraction(1, windowInfo, screenshotBuffer);

      expect(result.isDistraction).toBe(false);
      expect(result.detectionMethod).toBe('ai_classification');
      expect(mockAIService.classifyContent).toHaveBeenCalled();
    });

    test('should default to distraction if AI confidence is low', async () => {
      mockSessionRulesService.isAlwaysBlocked.mockReturnValue(false);
      mockSessionRulesService.isAlwaysAllowed.mockReturnValue(false);
      mockRuleService.isInBlocklist.mockReturnValue(false);
      
      mockTaskContextService.getTaskContext.mockReturnValue({
        taskName: 'Test Task',
        keywords: ['test']
      });

      mockAIService.classifyContent.mockResolvedValue({
        isDistraction: true,
        confidence: 0.6, // Below 0.7 threshold
        reason: 'Uncertain'
      });

      mockOCRService.ocrUrlBar.mockResolvedValue({
        text: 'https://example.com',
        confidence: 0.9
      });

      mockOCRService.extractDomain.mockReturnValue({
        domain: 'example.com',
        url: 'https://example.com'
      });

      const windowInfo = {
        appName: 'Chrome',
        windowTitle: 'Example',
        bounds: { x: 0, y: 0, width: 1920, height: 1080 }
      };

      const screenshotBuffer = Buffer.from('fake screenshot');

      const result = await distractionDetector.detectDistraction(1, windowInfo, screenshotBuffer);

      expect(result.isDistraction).toBe(false); // Low confidence means not distraction
    });
  });

  describe('detectDistraction - Fallback', () => {
    test('should default to distraction if no task context available', async () => {
      mockSessionRulesService.isAlwaysBlocked.mockReturnValue(false);
      mockSessionRulesService.isAlwaysAllowed.mockReturnValue(false);
      mockRuleService.isInBlocklist.mockReturnValue(false);
      mockTaskContextService.getTaskContext.mockReturnValue(null);

      const windowInfo = {
        appName: 'Chrome',
        windowTitle: 'Test',
        bounds: { x: 0, y: 0, width: 1920, height: 1080 }
      };

      const result = await distractionDetector.detectDistraction(1, windowInfo);

      expect(result.isDistraction).toBe(true);
      expect(result.confidence).toBe(0.5);
      expect(result.detectionMethod).toBe('default');
    });
  });

  describe('isBrowserApp', () => {
    test('should identify Chrome as browser', () => {
      expect(distractionDetector.isBrowserApp('Google Chrome')).toBe(true);
      expect(distractionDetector.isBrowserApp('Chrome')).toBe(true);
    });

    test('should identify Firefox as browser', () => {
      expect(distractionDetector.isBrowserApp('Firefox')).toBe(true);
    });

    test('should identify Safari as browser', () => {
      expect(distractionDetector.isBrowserApp('Safari')).toBe(true);
    });

    test('should not identify non-browser apps', () => {
      expect(distractionDetector.isBrowserApp('Code')).toBe(false);
      expect(distractionDetector.isBrowserApp('Terminal')).toBe(false);
    });
  });

  describe('getBrowserType', () => {
    test('should return correct browser type', () => {
      expect(distractionDetector.getBrowserType('Firefox')).toBe('firefox');
      expect(distractionDetector.getBrowserType('Safari')).toBe('safari');
      expect(distractionDetector.getBrowserType('Edge')).toBe('edge');
      expect(distractionDetector.getBrowserType('Chrome')).toBe('chrome');
      expect(distractionDetector.getBrowserType('Unknown')).toBe('chrome'); // Default
    });
  });

  describe('clearCache', () => {
    test('should clear task context cache', async () => {
      // Set up all necessary mocks
      mockSessionRulesService.isAlwaysBlocked.mockReturnValue(false);
      mockSessionRulesService.isAlwaysAllowed.mockReturnValue(false);
      mockRuleService.isInBlocklist.mockReturnValue(false);
      
      const taskContext = {
        taskName: 'Test',
        keywords: ['test']
      };
      mockTaskContextService.getTaskContext.mockReturnValue(taskContext);
      
      // Mock AI service to return valid result for both calls
      const validAIResult = {
        isDistraction: false,
        confidence: 0.8,
        reason: 'Task-related content'
      };
      mockAIService.classifyContent.mockResolvedValue(validAIResult);

      const windowInfo = {
        appName: 'Chrome',
        windowTitle: 'Test',
        bounds: { x: 0, y: 0, width: 1920, height: 1080 }
      };

      // First call should cache the task context
      const result1 = await distractionDetector.detectDistraction(1, windowInfo);
      expect(result1).toBeDefined();
      expect(mockTaskContextService.getTaskContext).toHaveBeenCalledTimes(1);
      expect(mockAIService.classifyContent).toHaveBeenCalledTimes(1);
      
      // Clear cache
      distractionDetector.clearCache(1);
      
      // Second call should fetch task context again (cache was cleared)
      const result2 = await distractionDetector.detectDistraction(1, windowInfo);
      expect(result2).toBeDefined();
      
      // Should be called twice (once before cache, once after clear)
      expect(mockTaskContextService.getTaskContext).toHaveBeenCalledTimes(2);
      expect(mockAIService.classifyContent).toHaveBeenCalledTimes(2);
    });
  });

  describe('error handling', () => {
    test('should handle OCR errors gracefully', async () => {
      mockSessionRulesService.isAlwaysBlocked.mockReturnValue(false);
      mockSessionRulesService.isAlwaysAllowed.mockReturnValue(false);
      mockRuleService.isInBlocklist.mockReturnValue(false);
      // Don't provide task context so AI classification isn't attempted
      mockTaskContextService.getTaskContext.mockReturnValue(null);
      mockOCRService.ocrUrlBar.mockRejectedValue(new Error('OCR failed'));

      const windowInfo = {
        appName: 'Chrome',
        windowTitle: 'Test',
        bounds: { x: 0, y: 0, width: 1920, height: 1080 }
      };

      const screenshotBuffer = Buffer.from('fake screenshot');

      const result = await distractionDetector.detectDistraction(1, windowInfo, screenshotBuffer);

      // Should continue with detection despite OCR error and fall through to default
      expect(result).toBeDefined();
      expect(result.detectionTime).toBeDefined();
      expect(result.detectionMethod).toBe('default');
    });

    test('should handle AI service errors gracefully', async () => {
      mockSessionRulesService.isAlwaysBlocked.mockReturnValue(false);
      mockSessionRulesService.isAlwaysAllowed.mockReturnValue(false);
      mockRuleService.isInBlocklist.mockReturnValue(false);
      mockTaskContextService.getTaskContext.mockReturnValue({ taskName: 'Test' });
      mockAIService.classifyContent.mockRejectedValue(new Error('AI service error'));

      const windowInfo = {
        appName: 'Chrome',
        windowTitle: 'Test',
        bounds: { x: 0, y: 0, width: 1920, height: 1080 }
      };

      const result = await distractionDetector.detectDistraction(1, windowInfo);

      // Should fall through to default distraction response when AI fails
      expect(result.isDistraction).toBe(true);
      expect(result.confidence).toBe(0.5);
      expect(result.detectionMethod).toBe('default');
    });
  });
});
