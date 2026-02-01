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
    this._stateTestTimers = [];

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
      console.warn(`[SessionMonitor] ⚠️ Monitoring already active for session ${this.currentSessionId}`);
      console.warn(`[SessionMonitor] Current session: ${this.currentSessionId}, requested session: ${sessionId}`);
      // If it's a different session, stop the current one first
      if (this.currentSessionId !== sessionId) {
        console.log(`[SessionMonitor] Stopping current monitoring for session ${this.currentSessionId} to start new session ${sessionId}`);
        this.stop();
      } else {
        return; // Same session, already monitoring
      }
    }

    try {
      console.log(`[SessionMonitor] 🚀 Starting monitoring for session ${sessionId}...`);
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
        console.log(`[SessionMonitor] Initializing statistics for session ${sessionId}`);
        this.statsRepo.initialize(sessionId);
      } else {
        console.warn(`[SessionMonitor] ⚠️ Statistics repository not available`);
      }

      // Start window monitoring
      console.log(`[SessionMonitor] Starting window monitoring...`);
      this.windowMonitor.startMonitoring(1000);
      console.log(`[SessionMonitor] ✓ Window monitoring started`);

      // Start screenshot service
      console.log(`[SessionMonitor] Starting screen monitor...`);
      this.screenMonitor.start();
      console.log(`[SessionMonitor] ✓ Screen monitor started`);

      // Start monitoring loop
      console.log(`[SessionMonitor] Starting monitoring loop (5 second intervals)...`);
      this.startMonitoringLoop();

      // Optional: deterministic state-machine test mode (for validating transitions + screenshot frequency changes)
      // Enable with: FOCUSAI_STATE_MACHINE_TEST=1
      if (process.env.FOCUSAI_STATE_MACHINE_TEST === '1') {
        console.log('[SessionMonitor] 🧪 State machine test mode enabled (FOCUSAI_STATE_MACHINE_TEST=1)');
        this._startStateMachineTestSequence();
      }

      console.log(`[SessionMonitor] ✅ Monitoring fully started for session ${sessionId}`);

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
      console.error(`[SessionMonitor] ❌ Error starting monitoring for session ${sessionId}:`, error);
      console.error(`[SessionMonitor] Error details:`, {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
      // Reset state on error
      this.isMonitoring = false;
      this.currentSessionId = null;
      this.stop();
      throw error; // Re-throw so caller knows it failed
    }
  }

  /**
   * Stop monitoring
   */
  stop() {
    if (!this.isMonitoring) {
      console.log(`[SessionMonitor] Monitoring already stopped`);
      return;
    }

    console.log(`[SessionMonitor] 🛑 Stopping monitoring for session ${this.currentSessionId}...`);
    this.isMonitoring = false;

    if (this.monitoringLoop) {
      clearInterval(this.monitoringLoop);
      this.monitoringLoop = null;
      console.log(`[SessionMonitor] ✓ Monitoring loop stopped`);
    }

    // Stop window monitoring
    console.log(`[SessionMonitor] Stopping window monitoring...`);
    this.windowMonitor.stopMonitoring();
    console.log(`[SessionMonitor] ✓ Window monitoring stopped`);

    // Stop screenshot service
    console.log(`[SessionMonitor] Stopping screen monitor...`);
    this.screenMonitor.stop();
    console.log(`[SessionMonitor] ✓ Screen monitor stopped`);

    const sessionId = this.currentSessionId;
    console.log(`[SessionMonitor] ✅ Monitoring fully stopped for session ${sessionId}`);

    // Hide overlay
    this.overlayService.hide();

    // Reset state
    this.stateMachine.reset();
    this.tileHashService.clear();
    this._stopStateMachineTestSequence();

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
    if (!this.isMonitoring) {
      console.warn(`[SessionMonitor] ⚠️ Cannot pause: monitoring is not active`);
      return;
    }

    console.log(`[SessionMonitor] ⏸️ Pausing monitoring for session ${this.currentSessionId}...`);

    // Pause screenshot service
    this.screenMonitor.stop();
    console.log(`[SessionMonitor] ✓ Screen monitor paused`);

    // Hide overlay
    this.overlayService.hide();
    console.log(`[SessionMonitor] ✓ Overlay hidden`);

    // Pause test sequencing if enabled
    this._stopStateMachineTestSequence();

    this.emit('paused', this.currentSessionId);
    console.log(`[SessionMonitor] ✅ Monitoring paused for session ${this.currentSessionId}`);
  }

  /**
   * Resume monitoring
   */
  resume() {
    if (!this.isMonitoring) {
      console.warn(`[SessionMonitor] ⚠️ Cannot resume: monitoring is not active. Use start() instead.`);
      return;
    }

    console.log(`[SessionMonitor] 🔄 Resuming monitoring for session ${this.currentSessionId}...`);
    
    // Resume screenshot service
    this.screenMonitor.start();
    console.log(`[SessionMonitor] ✓ Screen monitor resumed`);

    // Resume test sequencing if enabled
    if (process.env.FOCUSAI_STATE_MACHINE_TEST === '1') {
      this._startStateMachineTestSequence();
    }

    this.emit('resumed', this.currentSessionId);
    console.log(`[SessionMonitor] ✅ Monitoring resumed for session ${this.currentSessionId}`);
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
   * Start a deterministic transition sequence to validate:
   * - MonitoringStateMachine.transitionTo behavior
   * - ScreenMonitor adaptive frequency changes via stateChange events
   *
   * Sequence: GREEN → YELLOW → AMBIGUOUS → RED → GREEN
   */
  _startStateMachineTestSequence() {
    this._stopStateMachineTestSequence();
    const schedule = [
      { delayMs: 3000, state: 'YELLOW', reason: 'TEST: force transition' },
      { delayMs: 6000, state: 'AMBIGUOUS', reason: 'TEST: force transition' },
      { delayMs: 9000, state: 'RED', reason: 'TEST: force transition' },
      { delayMs: 15000, state: 'GREEN', reason: 'TEST: force transition' }
    ];

    for (const step of schedule) {
      const t = setTimeout(() => {
        if (!this.isMonitoring) return;
        console.log(`[SessionMonitor] 🧪 Forcing state transition to ${step.state}`);
        this.stateMachine.transitionTo(step.state, step.reason);
      }, step.delayMs);
      this._stateTestTimers.push(t);
    }
  }

  _stopStateMachineTestSequence() {
    if (!this._stateTestTimers || this._stateTestTimers.length === 0) return;
    for (const t of this._stateTestTimers) clearTimeout(t);
    this._stateTestTimers = [];
  }

  /**
   * Monitoring cycle
   */
  async monitoringCycle() {
    if (!this.isMonitoring || !this.currentSessionId) {
      console.warn(`[SessionMonitor] ⚠️ Monitoring cycle called but monitoring is not active (isMonitoring: ${this.isMonitoring}, sessionId: ${this.currentSessionId})`);
      return;
    }

    const now = Date.now();
    let windowInfo = null;
    
    try {
      // Get current window
      windowInfo = await this.windowMonitor.getActiveWindow();
      if (!windowInfo) {
        console.warn(`[SessionMonitor] ⚠️ No window info available, skipping cycle`);
        return;
      }

      // Log periodic verification (every 25 seconds)
      const timeSinceLastCheck = (now - this.lastCheckTime) / 1000;
      if (timeSinceLastCheck > 20 || this.lastCheckTime === 0) {
        console.log(`[SessionMonitor] ✓ Monitoring active - Current window: "${windowInfo.appName}" - "${windowInfo.windowTitle}"`);
      }
    } catch (error) {
      console.error(`[SessionMonitor] ✗ Error getting window info in monitoring cycle:`, error);
      console.error(`[SessionMonitor] Error stack:`, error.stack);
      return;
    }

    try {
      // Get current screenshot
      const screenshot = this.screenMonitor.getLastScreenshot();
      if (!screenshot) {
        console.log(`[SessionMonitor] No screenshot available yet, skipping cycle`);
        this.lastCheckTime = now;
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
        console.log(`[SessionMonitor] 🔄 State transition: ${currentState} → ${newState} (${detectionResult.isDistraction ? 'Distraction' : 'Safe'})`);
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
    } catch (error) {
      console.error(`[SessionMonitor] ✗ Error in monitoring cycle (after window detection):`, error);
      console.error(`[SessionMonitor] Error stack:`, error.stack);
      // Don't throw - let the loop continue
    }
  }

  /**
   * Handle window change
   * @param {Object} windowInfo - Window info
   */
  async handleWindowChange(windowInfo) {
    if (!this.isMonitoring || !this.currentSessionId) {
      return;
    }

    console.log(`[SessionMonitor] 🔄 Window changed detected:`);
    console.log(`[SessionMonitor]   App: "${windowInfo.appName}"`);
    console.log(`[SessionMonitor]   Title: "${windowInfo.windowTitle}"`);
    console.log(`[SessionMonitor]   Bounds: x=${windowInfo.bounds.x}, y=${windowInfo.bounds.y}, w=${windowInfo.bounds.width}, h=${windowInfo.bounds.height}`);
    
    // Immediate check on window change
    console.log(`[SessionMonitor] Triggering immediate monitoring cycle...`);
    setTimeout(() => {
      this.monitoringCycle().catch(error => {
        console.error(`[SessionMonitor] Error in monitoring cycle after window change:`, error);
      });
    }, 100);
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
    console.log(`[SessionMonitor] Screenshot event received`, {
      byteLength: imageBuffer?.byteLength || imageBuffer?.length || 0
    });

    // Process tile hashing (async, non-blocking) for change detection
    try {
      const hashResult = await this.tileHashService.computeTileHashes(imageBuffer);
      console.log(`[SessionMonitor] Tile hashing completed from screenshot event`, {
        totalTiles: hashResult.totalTiles,
        changedCount: hashResult.changedCount
      });
    } catch (error) {
      console.error('[SessionMonitor] Error computing tile hashes from screenshot event:', error);
    }
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
