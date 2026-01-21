const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');

function appendAgentDebugLog(payload) {
  try {
    const logPath = path.join(__dirname, '../../.cursor/debug.log');
    fs.appendFileSync(logPath, `${JSON.stringify(payload)}\n`, { encoding: 'utf8' });
  } catch (_) {
    // Swallow logging errors
  }
}

/**
 * Session Monitor
 * Orchestrates all monitoring services
 */
class SessionMonitor extends EventEmitter {
  constructor(
    windowMonitor,
    screenMonitor,
    tileHashService,
    ocrService,
    distractionDetector,
    overlayService,
    stateMachine,
    activityRepository,
    statisticsRepository
  ) {
    super();
    this.windowMonitor = windowMonitor;
    this.screenMonitor = screenMonitor;
    this.tileHashService = tileHashService;
    this.ocrService = ocrService;
    this.distractionDetector = distractionDetector;
    this.overlayService = overlayService;
    this.stateMachine = stateMachine;
    this.activityRepo = activityRepository;
    this.statsRepo = statisticsRepository;

    this.currentSessionId = null;
    this.isMonitoring = false;
    this.monitoringLoop = null;
    this.lastCheckTime = 0;
    this.lastStateTime = Date.now();
    this.crashCount = 0;
    this.maxCrashes = 3;

    // Setup event listeners
    this.setupEventListeners();
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Window change
    this.windowMonitor.on('windowChange', (windowInfo) => {
      if (this.isMonitoring) {
        this.handleWindowChange(windowInfo);
      }
    });

    // State change
    this.stateMachine.on('stateChange', ({ from, to, reason }) => {
      this.handleStateChange(from, to, reason);
    });

    // Screenshot captured
    this.screenMonitor.on('screenshot', (imageBuffer) => {
      if (this.isMonitoring) {
        this.handleScreenshot(imageBuffer);
      }
    });
  }

  /**
   * Start monitoring a session
   * @param {number} sessionId - Session ID
   */
  async start(sessionId) {
    if (this.isMonitoring) {
      console.warn('Monitoring already active');
      return;
    }

    try {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/cd85e294-0bef-430a-902e-994341727018',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'backend/services/sessionMonitor.js:80',message:'SessionMonitor.start called',data:{sessionId,wasMonitoring:this.isMonitoring},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      // #region agent log
      appendAgentDebugLog({location:'backend/services/sessionMonitor.js:88',message:'SessionMonitor.start entered (file log)',data:{sessionId},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'E'});
      // #endregion
      this.currentSessionId = sessionId;
      this.isMonitoring = true;
      this.crashCount = 0;
      this.lastCheckTime = Date.now();
      this.lastStateTime = Date.now();

      // Initialize statistics
      if (this.statsRepo) {
        this.statsRepo.initialize(sessionId);
      }

      // Start window monitoring
      this.windowMonitor.startMonitoring(1000);

      // Start screenshot service
      this.screenMonitor.start();

      // Start monitoring loop
      this.startMonitoringLoop();

      console.log(`[SessionMonitor] ✓ Monitoring started for session ${sessionId}`);

      // Log activity
      if (this.activityRepo) {
        this.activityRepo.logActivity({
          sessionId: sessionId,
          activityType: 'state_change',
          state: this.stateMachine.getState(),
          reason: 'Monitoring started'
        });
      }

      this.emit('started', sessionId);
    } catch (error) {
      console.error('Error starting monitoring:', error);
      this.stop();
      throw error;
    }
  }

  /**
   * Stop monitoring
   */
  stop() {
    this.isMonitoring = false;

    if (this.monitoringLoop) {
      clearInterval(this.monitoringLoop);
      this.monitoringLoop = null;
    }

    // Stop window monitoring
    this.windowMonitor.stopMonitoring();

    // Stop screenshot service
    this.screenMonitor.stop();

    const sessionId = this.currentSessionId;
    console.log(`[SessionMonitor] ✓ Monitoring stopped for session ${sessionId}`);

    // Hide overlay
    this.overlayService.hide();

    // Reset state
    this.stateMachine.reset();
    this.tileHashService.clear();

    this.currentSessionId = null;

    // Log activity
    if (this.activityRepo && sessionId) {
      this.activityRepo.logActivity({
        sessionId: sessionId,
        activityType: 'state_change',
        state: 'GREEN',
        reason: 'Monitoring stopped'
      });
    }

    this.emit('stopped', sessionId);
  }

  /**
   * Pause monitoring
   */
  pause() {
    if (!this.isMonitoring) return;

    // Pause screenshot service
    this.screenMonitor.stop();

    // Hide overlay
    this.overlayService.hide();

    this.emit('paused', this.currentSessionId);
  }

  /**
   * Resume monitoring
   */
  resume() {
    if (!this.isMonitoring) return;

    // Resume screenshot service
    this.screenMonitor.start();

    this.emit('resumed', this.currentSessionId);
  }

  /**
   * Start monitoring loop
   */
  startMonitoringLoop() {
    // Wrap loop in try-catch for crash recovery
    this.monitoringLoop = setInterval(async () => {
      try {
        await this.monitoringCycle();
        this.crashCount = 0; // Reset on success
      } catch (error) {
        console.error('Error in monitoring cycle:', error);
        this.crashCount++;
        
        if (this.crashCount >= this.maxCrashes) {
          console.error('Monitoring loop crashed too many times, stopping');
          this.stop();
          this.emit('error', error);
        }
      }
    }, 5000); // Check every 5 seconds
  }

  /**
   * Monitoring cycle
   */
  async monitoringCycle() {
    if (!this.isMonitoring || !this.currentSessionId) {
      return;
    }

    const now = Date.now();
    
    // Get current window
    const windowInfo = await this.windowMonitor.getActiveWindow();
    if (!windowInfo) {
      console.log('[SessionMonitor] No window info available, skipping cycle');
      return;
    }

    // Log periodic verification (every 25 seconds)
    const timeSinceLastCheck = (now - this.lastCheckTime) / 1000;
    if (timeSinceLastCheck > 20 || this.lastCheckTime === 0) {
      console.log(`[SessionMonitor] ✓ Monitoring active - Current window: "${windowInfo.appName}" - "${windowInfo.windowTitle}"`);
    }

    // Get current screenshot
    const screenshot = this.screenMonitor.getLastScreenshot();
    if (!screenshot) {
      return;
    }

    // Detect distraction
    const detectionResult = await this.distractionDetector.detectDistraction(
      this.currentSessionId,
      windowInfo,
      screenshot
    );

    // Update state based on detection
    const currentState = this.stateMachine.getState();
    let newState = currentState;

    if (detectionResult.isDistraction) {
      if (currentState === 'GREEN') {
        newState = 'YELLOW';
      } else if (currentState === 'YELLOW' && detectionResult.confidence >= 0.8) {
        newState = 'AMBIGUOUS';
      } else if (currentState === 'AMBIGUOUS' || detectionResult.confidence >= 0.9) {
        newState = 'RED';
      }
    } else {
      // Not a distraction, move towards GREEN
      if (currentState === 'RED') {
        newState = 'YELLOW';
      } else if (currentState === 'YELLOW' || currentState === 'AMBIGUOUS') {
        // Stay in YELLOW for a bit before going to GREEN
        const timeInState = now - this.lastStateTime;
        if (timeInState > 30000) { // 30 seconds
          newState = 'GREEN';
        }
      }
    }

    // Transition state if changed
    if (newState !== currentState) {
      this.stateMachine.transitionTo(
        newState,
        `Detection: ${detectionResult.isDistraction ? 'Distraction' : 'Safe'} (${detectionResult.detectionMethod})`
      );
    }

    // Update overlay based on state
    if (newState === 'RED' && detectionResult.isDistraction) {
      // Show overlay with blocking zones
      const zones = [{
        x: windowInfo.bounds.x + 100,
        y: windowInfo.bounds.y + 150,
        w: windowInfo.bounds.width - 200,
        h: windowInfo.bounds.height - 250,
        reason: detectionResult.detectedDomain || 'Distraction'
      }];

      this.overlayService.show(zones, windowInfo.bounds);
    } else {
      // Hide overlay
      this.overlayService.hide();
    }

    // Log activity
    if (this.activityRepo) {
      this.activityRepo.logActivity({
        sessionId: this.currentSessionId,
        activityType: detectionResult.isDistraction ? 'distraction_detected' : 'ocr_result',
        state: newState,
        appName: windowInfo.appName,
        windowTitle: windowInfo.windowTitle,
        detectedDomain: detectionResult.detectedDomain,
        detectedUrl: detectionResult.detectedUrl,
        isDistraction: detectionResult.isDistraction,
        isBlocked: newState === 'RED',
        detectionMethod: detectionResult.detectionMethod,
        metadata: {
          confidence: detectionResult.confidence,
          reason: detectionResult.reason
        }
      });
    }

    // Update statistics
    if (this.statsRepo) {
      const timeDelta = (now - this.lastCheckTime) / 1000;
      const stateDelta = (now - this.lastStateTime) / 1000;

      this.statsRepo.updateStats(this.currentSessionId, {
        totalMonitoringSeconds: Math.floor(timeDelta),
        [`timeIn${currentState}State`]: Math.floor(stateDelta),
        totalDistractionsDetected: detectionResult.isDistraction ? 1 : 0,
        totalBlocksApplied: newState === 'RED' ? 1 : 0,
        totalScreenshotsTaken: 1
      });

      if (newState !== currentState) {
        this.lastStateTime = now;
      }
    }

    this.lastCheckTime = now;
  }

  /**
   * Handle window change
   * @param {Object} windowInfo - Window info
   */
  async handleWindowChange(windowInfo) {
    // Immediate check on window change
    if (this.isMonitoring && this.currentSessionId) {
      // Trigger immediate detection
      setTimeout(() => {
        this.monitoringCycle().catch(console.error);
      }, 100);
    }
  }

  /**
   * Handle state change
   * @param {string} from - Previous state
   * @param {string} to - New state
   * @param {string} reason - Reason for change
   */
  handleStateChange(from, to, reason) {
    // Log state transition
    if (this.activityRepo && this.currentSessionId) {
      this.activityRepo.logActivity({
        sessionId: this.currentSessionId,
        activityType: 'state_change',
        state: to,
        previousState: from,
        metadata: { reason: reason }
      });
    }

    this.lastStateTime = Date.now();
    this.emit('stateChange', { from, to, reason });
  }

  /**
   * Handle screenshot
   * @param {Buffer} imageBuffer - Image buffer
   */
  async handleScreenshot(imageBuffer) {
    // Process tile hashing (async, non-blocking)
    this.tileHashService.computeTileHashes(imageBuffer).catch(console.error);
  }

  /**
   * Get current monitoring state
   * @returns {Object} Monitoring state
   */
  getState() {
    return {
      isMonitoring: this.isMonitoring,
      sessionId: this.currentSessionId,
      currentState: this.stateMachine.getState(),
      overlayStatus: this.overlayService.getStatus()
    };
  }

  /**
   * Get monitoring activity
   * @param {number} sessionId - Session ID
   * @returns {Object} Activity data
   */
  getActivity(sessionId) {
    if (!this.activityRepo) {
      return null;
    }

    const activities = this.activityRepo.getSessionActivities(sessionId, { limit: 100 });
    const distractions = this.activityRepo.getDistractions(sessionId);
    const transitions = this.activityRepo.getStateTransitions(sessionId);

    return {
      activities: activities,
      distractions: distractions,
      stateTransitions: transitions
    };
  }
}

module.exports = SessionMonitor;
