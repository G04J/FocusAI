/**
 * Distraction Detector
 * Orchestrates 4-tier decision logic:
 * Tier 1: Always-blocked list
 * Tier 2: Always-allowed list
 * Tier 3: Safety net blocklist
 * Tier 4: AI classification with task context
 */
class DistractionDetector {
  constructor(sessionRulesService, ruleService, ocrService, aiService, taskContextService) {
    this.sessionRulesService = sessionRulesService;
    this.ruleService = ruleService;
    this.ocrService = ocrService;
    this.aiService = aiService;
    this.taskContextService = taskContextService;

    // Cache for task context (don't reload every check)
    this.taskContextCache = new Map();
  }

  /**
   * Detect if current content is a distraction
   * @param {number} sessionId - Session ID
   * @param {Object} windowInfo - Window info {appName, windowTitle, bounds}
   * @param {Buffer} screenshotBuffer - Screenshot buffer (optional)
   * @returns {Promise<Object>} Detection result {isDistraction, confidence, detectedDomain, reason, detectionMethod}
   */
  async detectDistraction(sessionId, windowInfo, screenshotBuffer = null) {
    try {
      const startTime = Date.now();

      // Early exit: Check if app is safe (e.g., VSCode, Terminal)
      const safeApps = ['Code', 'Terminal', 'iTerm2', 'Alacritty', 'Visual Studio Code'];
      const appName = windowInfo.appName || '';
      if (safeApps.some(safe => appName.toLowerCase().includes(safe.toLowerCase()))) {
        return {
          isDistraction: false,
          confidence: 1.0,
          detectedDomain: null,
          reason: 'Safe application detected',
          detectionMethod: 'app_name',
          detectionTime: Date.now() - startTime
        };
      }

      // Extract domain/URL via OCR if browser
      let detectedDomain = null;
      let detectedUrl = null;
      let ocrText = '';
      let ocrResult = null;

      const isBrowser = this.isBrowserApp(appName);
      if (isBrowser && screenshotBuffer) {
        try {
          // OCR URL bar
          ocrResult = await this.ocrService.ocrUrlBar(screenshotBuffer, this.getBrowserType(appName));
          ocrText = ocrResult.text || '';
          
          // Extract domain
          const domainResult = this.ocrService.extractDomain(ocrText);
          detectedDomain = domainResult.domain;
          detectedUrl = domainResult.url;
        } catch (error) {
          console.warn('OCR failed, using app name only:', error.message);
          // Fallback to app name
        }
      }

      // Tier 1: Check always-blocked list (fast, explicit block)
      const isAlwaysBlocked = this.sessionRulesService.isAlwaysBlocked(
        sessionId,
        appName,
        detectedDomain
      );

      if (isAlwaysBlocked) {
        return {
          isDistraction: true,
          confidence: 1.0,
          detectedDomain: detectedDomain,
          detectedUrl: detectedUrl,
          reason: 'Always-blocked list',
          detectionMethod: 'always_blocked',
          detectionTime: Date.now() - startTime
        };
      }

      // Tier 2: Check always-allowed list (fast, explicit allow)
      const isAlwaysAllowed = this.sessionRulesService.isAlwaysAllowed(
        sessionId,
        appName,
        detectedDomain
      );

      if (isAlwaysAllowed) {
        return {
          isDistraction: false,
          confidence: 1.0,
          detectedDomain: detectedDomain,
          detectedUrl: detectedUrl,
          reason: 'Always-allowed list',
          detectionMethod: 'always_allowed',
          detectionTime: Date.now() - startTime
        };
      }

      // Tier 3: Safety net blocklist (fast filtering of obvious distractions)
      if (detectedDomain && this.ruleService.isInBlocklist(detectedDomain)) {
        return {
          isDistraction: true,
          confidence: 0.95,
          detectedDomain: detectedDomain,
          detectedUrl: detectedUrl,
          reason: 'Safety net blocklist',
          detectionMethod: 'safety_net',
          detectionTime: Date.now() - startTime
        };
      }

      // Tier 4: AI classification with task context (primary decision method)
      // Load task context (cached)
      let taskContext = this.taskContextCache.get(sessionId);
      if (!taskContext) {
        taskContext = this.taskContextService.getTaskContext(sessionId);
        if (taskContext) {
          // Cache for 5 minutes
          this.taskContextCache.set(sessionId, taskContext);
          setTimeout(() => this.taskContextCache.delete(sessionId), 5 * 60 * 1000);
        }
      }

      if (taskContext) {
        const detectedContent = {
          domain: detectedDomain,
          url: detectedUrl,
          windowTitle: windowInfo.windowTitle || '',
          ocrText: ocrText
        };

        const aiResult = await this.aiService.classifyContent(detectedContent, taskContext);

        // Default to DISTRACTION if confidence < 0.7
        const isDistraction = aiResult.isDistraction && aiResult.confidence >= 0.7;

        return {
          isDistraction: isDistraction,
          confidence: aiResult.confidence,
          detectedDomain: detectedDomain,
          detectedUrl: detectedUrl,
          reason: aiResult.reason,
          detectionMethod: 'ai_classification',
          detectionTime: Date.now() - startTime
        };
      }

      // Fallback: Default to distraction if no task context
      return {
        isDistraction: true,
        confidence: 0.5,
        detectedDomain: detectedDomain,
        detectedUrl: detectedUrl,
        reason: 'No task context available, defaulting to distraction',
        detectionMethod: 'default',
        detectionTime: Date.now() - startTime
      };
    } catch (error) {
      console.error('Error detecting distraction:', error);
      // Safe default: treat as distraction
      return {
        isDistraction: true,
        confidence: 0.5,
        detectedDomain: null,
        reason: `Error: ${error.message}`,
        detectionMethod: 'error',
        detectionTime: 0
      };
    }
  }

  /**
   * Check if app is a browser
   * @param {string} appName - App name
   * @returns {boolean} True if browser
   */
  isBrowserApp(appName) {
    const browsers = ['Chrome', 'Firefox', 'Safari', 'Edge', 'Brave', 'Opera', 'Chromium'];
    return browsers.some(browser => appName.toLowerCase().includes(browser.toLowerCase()));
  }

  /**
   * Get browser type
   * @param {string} appName - App name
   * @returns {string} Browser type
   */
  getBrowserType(appName) {
    const lowerName = appName.toLowerCase();
    if (lowerName.includes('firefox')) return 'firefox';
    if (lowerName.includes('safari')) return 'safari';
    if (lowerName.includes('edge')) return 'edge';
    return 'chrome'; // Default
  }

  /**
   * Clear cache for session
   * @param {number} sessionId - Session ID
   */
  clearCache(sessionId) {
    this.taskContextCache.delete(sessionId);
  }
}

module.exports = DistractionDetector;
