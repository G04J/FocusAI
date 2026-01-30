const EventEmitter = require('events');

/**
 * Window Monitor Service
 * Detects active app/window and tracks changes
 */
class WindowMonitor extends EventEmitter {
  constructor() {
    super();
    this.lastWindow = null;
    this.lastWindowTime = 0;
    this.cacheTTL = 2000; // 2 second cache (increased to reduce calls)
    this.debounceDelay = 500; // 500ms debounce
    this.windowChangeTimer = null;
    this.isMonitoring = false;
    this.monitorInterval = null;
    this._windowsModule = null; // Cache for ESM module
    this.lastWarningTime = 0;
    this.warningInterval = 60000; // Only log warning once per minute
    this.lastError = null; // Track last error for debugging
    this.activeCall = null; // Track active openWindows() call to prevent concurrent calls
    this.callQueue = []; // Queue for pending calls
  }

  /**
   * Get the get-windows module (ESM import)
   * @returns {Promise<Object>} Module with activeWindow, openWindows functions
   */
  async getWindowsModule() {
    if (!this._windowsModule) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/cd85e294-0bef-430a-902e-994341727018',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'backend/services/windowMonitor.js:27',message:'Loading get-windows ESM module',data:{hasCachedModule:!!this._windowsModule},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      console.log('[WindowMonitor] Initializing get-windows module...');
      this._windowsModule = await import('get-windows');
      console.log('[WindowMonitor] ✓ get-windows module loaded successfully');
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/cd85e294-0bef-430a-902e-994341727018',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'backend/services/windowMonitor.js:32',message:'get-windows module loaded',data:{exports:Object.keys(this._windowsModule||{})},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
    }
    return this._windowsModule;
  }

  /**
   * Get active window
   * @returns {Promise<Object>} Window info {appName, windowTitle, bounds, timestamp}
   */
  async getActiveWindow() {
    const startTime = Date.now();
    try {
      // Check cache
      const now = Date.now();
      if (this.lastWindow && (now - this.lastWindowTime) < this.cacheTTL) {
        const cacheAge = now - this.lastWindowTime;
        // Only log cache hits occasionally to reduce noise (every 10th time)
        if (Math.random() < 0.1) {
          console.log(`[WindowMonitor] Cache hit (age: ${cacheAge}ms < ${this.cacheTTL}ms): "${this.lastWindow.appName}" - "${this.lastWindow.windowTitle}"`);
        }
        return this.lastWindow;
      }
      
      if (this.lastWindow) {
        const cacheAge = now - this.lastWindowTime;
        console.log(`[WindowMonitor] Cache miss (age: ${cacheAge}ms >= ${this.cacheTTL}ms), fetching new window data...`);
      } else {
        console.log('[WindowMonitor] No cached window, fetching window data...');
      }

      // Prevent concurrent calls - if there's an active call, wait for it or use cache
      if (this.activeCall) {
        console.log(`[WindowMonitor] Another openWindows() call is in progress, waiting for it...`);
        try {
          // Wait for the active call to complete (with timeout)
          const windows = await Promise.race([
            this.activeCall,
            new Promise((_, reject) => setTimeout(() => reject(new Error('Waiting for active call timeout')), 4000))
          ]);
          console.log(`[WindowMonitor] ✓ Reused result from active call: Found ${windows?.length || 0} windows`);
          // Update cache with the result
          if (windows && windows.length > 0) {
            const activeWindow = windows.find(w => (w.owner || w.appName) && w.title) || windows[0];
            if (activeWindow) {
              const appName = activeWindow.owner?.name || activeWindow.appName || activeWindow.owner || 'Unknown';
              const bounds = activeWindow.bounds || { x: 0, y: 0, width: 0, height: 0 };
              const windowInfo = {
                appName: appName,
                windowTitle: activeWindow.title || '',
                bounds: {
                  x: bounds.x || 0,
                  y: bounds.y || 0,
                  width: bounds.width || 0,
                  height: bounds.height || 0
                },
                timestamp: Date.now()
              };
              this.lastWindow = windowInfo;
              this.lastWindowTime = Date.now();
              return windowInfo;
            }
          }
        } catch (error) {
          // If waiting failed, use cache if available
          if (this.lastWindow) {
            console.log(`[WindowMonitor] Active call failed, using cached window: "${this.lastWindow.appName}"`);
            return this.lastWindow;
          }
          // Otherwise proceed with new call
          console.log(`[WindowMonitor] Active call failed and no cache, proceeding with new call...`);
        }
      }

      // Get windows with retry (using ESM import)
      let windows;
      let retries = 3;
      const initialRetries = retries;
      const windowsModule = await this.getWindowsModule();
      console.log(`[WindowMonitor] Attempting to get windows (${retries} retries available)...`);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/cd85e294-0bef-430a-902e-994341727018',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'backend/services/windowMonitor.js:56',message:'Calling openWindows()',data:{retries,hasOpenWindows:typeof windowsModule?.openWindows==='function'},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'B'})}).catch(()=>{});
      // #endregion

      // Add timeout wrapper for openWindows call
      const TIMEOUT_MS = 3000; // 3 second timeout (reduced from 5s)
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('openWindows() timeout after 3 seconds')), TIMEOUT_MS);
      });

      // Create the call promise and store it
      const callPromise = (async () => {
        while (retries > 0) {
          const attemptNumber = initialRetries - retries + 1;
          const attemptStartTime = Date.now();
          try {
            console.log(`[WindowMonitor] Attempt ${attemptNumber}/${initialRetries}: Calling openWindows()...`);
            // Use openWindows() with timeout protection
            const allWindows = await Promise.race([
              windowsModule.openWindows(),
              timeoutPromise
            ]);
            const attemptDuration = Date.now() - attemptStartTime;
            // The first window is usually the active one
            windows = allWindows;
            console.log(`[WindowMonitor] ✓ openWindows() succeeded (${attemptDuration}ms): Found ${windows?.length || 0} windows`);
            break;
          } catch (error) {
            const attemptDuration = Date.now() - attemptStartTime;
            this.lastError = error;
            retries--;
            
            // Check if it's a timeout error
            const isTimeout = error.message && error.message.includes('timeout');
            if (isTimeout) {
              console.warn(`[WindowMonitor] Attempt ${attemptNumber}/${initialRetries} timed out after ${TIMEOUT_MS}ms (${attemptDuration}ms elapsed)`);
            } else {
              console.error(`[WindowMonitor] Attempt ${attemptNumber}/${initialRetries} failed (${attemptDuration}ms): ${error.message || error.name}${error.stack ? `\n${error.stack}` : ''}`);
            }
            
            if (retries === 0) {
              // Fallback to last known window
              if (this.lastWindow) {
                // Rate limit warnings to avoid spam
                const now = Date.now();
                if (now - this.lastWarningTime > this.warningInterval) {
                  console.warn(`[WindowMonitor] ✗ All ${initialRetries} attempts failed. Last error: ${error.message || error.name}. Using last known window. This warning will be suppressed for 60 seconds.`);
                  this.lastWarningTime = now;
                } else {
                  console.log(`[WindowMonitor] All attempts failed, using cached window (warning suppressed)`);
                }
                return this.lastWindow;
              }
              console.error(`[WindowMonitor] ✗ All attempts failed and no cached window available. Throwing error.`);
              throw error;
            }
            // Exponential backoff
            const backoffDelay = 100 * (4 - retries);
            console.log(`[WindowMonitor] Retrying in ${backoffDelay}ms... (${retries} attempts remaining)`);
            await new Promise(resolve => setTimeout(resolve, backoffDelay));
          }
        }
        return windows;
      })();

      // Store as active call
      this.activeCall = callPromise;
      
      try {
        windows = await callPromise;
      } finally {
        // Clear active call after completion
        this.activeCall = null;
      }

      if (!windows || windows.length === 0) {
        console.warn(`[WindowMonitor] No windows returned (windows: ${windows}, length: ${windows?.length})`);
        // Fallback to last known window
        if (this.lastWindow) {
          console.log(`[WindowMonitor] Falling back to last known window: "${this.lastWindow.appName}"`);
          return this.lastWindow;
        }
        console.warn(`[WindowMonitor] No windows found and no cached window available`);
        return null;
      }

      // Find active window (first window is usually the active one)
      // windows from openWindows() are ordered front to back
      console.log(`[WindowMonitor] Searching ${windows.length} windows for active window...`);
      const activeWindow = windows.find(w => (w.owner || w.appName) && w.title) || windows[0];
      
      if (activeWindow) {
        console.log(`[WindowMonitor] Active window candidate found:`, {
          title: activeWindow.title || '(no title)',
          appName: activeWindow.appName || activeWindow.owner?.name || activeWindow.owner || '(unknown)',
          hasBounds: !!activeWindow.bounds,
          bounds: activeWindow.bounds || '(no bounds)',
          hasOwner: !!activeWindow.owner,
          ownerType: typeof activeWindow.owner
        });
      } else {
        console.warn(`[WindowMonitor] No active window candidate found in ${windows.length} windows`);
      }
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/cd85e294-0bef-430a-902e-994341727018',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'backend/services/windowMonitor.js:90',message:'Selected active window candidate',data:{windowsCount:windows?.length||0,hasActive:!!activeWindow,title:activeWindow?.title||'',ownerType:typeof activeWindow?.owner,hasAppName:!!activeWindow?.appName},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'B'})}).catch(()=>{});
      // #endregion

      if (!activeWindow) {
        if (this.lastWindow) {
          console.log(`[WindowMonitor] No active window found, using cached window: "${this.lastWindow.appName}"`);
          return this.lastWindow;
        }
        console.warn(`[WindowMonitor] No active window found and no cached window available`);
        return null;
      }

      // Validate window bounds
      const bounds = activeWindow.bounds || { x: 0, y: 0, width: 0, height: 0 };
      const boundsValid = this.isValidBounds(bounds);
      console.log(`[WindowMonitor] Validating bounds:`, {
        bounds: bounds,
        valid: boundsValid,
        width: bounds.width,
        height: bounds.height
      });
      
      if (!boundsValid) {
        console.warn(`[WindowMonitor] Invalid bounds detected:`, bounds);
        if (this.lastWindow) {
          console.log(`[WindowMonitor] Using cached window due to invalid bounds: "${this.lastWindow.appName}"`);
          return this.lastWindow;
        }
        console.warn(`[WindowMonitor] Invalid bounds and no cached window available`);
        return null;
      }

      // Handle both owner (old API) and appName (new API) fields
      const appName = activeWindow.owner?.name || activeWindow.appName || activeWindow.owner || 'Unknown';
      
      const windowInfo = {
        appName: appName,
        windowTitle: activeWindow.title || '',
        bounds: {
          x: bounds.x || 0,
          y: bounds.y || 0,
          width: bounds.width || 0,
          height: bounds.height || 0
        },
        timestamp: now
      };

      console.log(`[WindowMonitor] Constructed window info:`, {
        appName: windowInfo.appName,
        windowTitle: windowInfo.windowTitle,
        bounds: windowInfo.bounds,
        timestamp: new Date(windowInfo.timestamp).toISOString()
      });

      // Update cache
      const prevWindow = this.lastWindow;
      this.lastWindow = windowInfo;
      this.lastWindowTime = now;
      
      const totalDuration = Date.now() - startTime;
      console.log(`[WindowMonitor] Window detection completed in ${totalDuration}ms`);

      // Reset warning state on successful detection
      if (this.lastError) {
        console.log(`[WindowMonitor] ✓ Window detection recovered after error: "${windowInfo.appName}" - "${windowInfo.windowTitle}"`);
        this.lastError = null;
      }

      // Check if window changed
      if (prevWindow && (
        prevWindow.appName !== windowInfo.appName ||
        prevWindow.windowTitle !== windowInfo.windowTitle
      )) {
        console.log(`[WindowMonitor] 🔄 ========== WINDOW SWITCH DETECTED ==========`);
        console.log(`[WindowMonitor]   Previous App: "${prevWindow.appName}"`);
        console.log(`[WindowMonitor]   Previous Title: "${prevWindow.windowTitle}"`);
        console.log(`[WindowMonitor]   ────────────────────────────────────────────`);
        console.log(`[WindowMonitor]   New App: "${windowInfo.appName}"`);
        console.log(`[WindowMonitor]   New Title: "${windowInfo.windowTitle}"`);
        console.log(`[WindowMonitor] ===============================================`);
        this.debounceWindowChange(windowInfo);
      } else if (!prevWindow) {
        // First window detection
        console.log(`[WindowMonitor] ✓ First window detection: "${windowInfo.appName}" - "${windowInfo.windowTitle}"`);
      } else {
        // Only log unchanged windows occasionally to reduce noise (every 10th check)
        if (Math.random() < 0.1) {
          console.log(`[WindowMonitor] Window unchanged: "${windowInfo.appName}" - "${windowInfo.windowTitle}"`);
        }
      }

      return windowInfo;
    } catch (error) {
      const totalDuration = Date.now() - startTime;
      console.error(`[WindowMonitor] ✗ Error getting active window (${totalDuration}ms):`, {
        name: error.name,
        message: error.message,
        stack: error.stack,
        lastWindow: this.lastWindow ? `${this.lastWindow.appName} - ${this.lastWindow.windowTitle}` : 'none'
      });
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/cd85e294-0bef-430a-902e-994341727018',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'backend/services/windowMonitor.js:151',message:'getActiveWindow threw error',data:{name:error?.name,message:error?.message},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      // Fallback to last known window
      if (this.lastWindow) {
        console.log(`[WindowMonitor] Falling back to cached window after error: "${this.lastWindow.appName}"`);
        return this.lastWindow;
      }
      // Graceful degradation - return safe state
      console.warn(`[WindowMonitor] No cached window available, returning safe fallback state`);
      return {
        appName: 'Unknown',
        windowTitle: '',
        bounds: { x: 0, y: 0, width: 0, height: 0 },
        timestamp: Date.now()
      };
    }
  }

  /**
   * Validate window bounds
   * @param {Object} bounds - Window bounds
   * @returns {boolean} True if valid
   */
  isValidBounds(bounds) {
    if (!bounds) {
      console.log(`[WindowMonitor] isValidBounds: false (no bounds object)`);
      return false;
    }
    const { width, height } = bounds;
    const valid = width > 0 && height > 0 && width < 10000 && height < 10000;
    if (!valid) {
      console.log(`[WindowMonitor] isValidBounds: false (width: ${width}, height: ${height})`);
    }
    return valid;
  }

  /**
   * Debounce window changes
   * @param {Object} windowInfo - New window info
   */
  debounceWindowChange(windowInfo) {
    // Clear existing timer
    if (this.windowChangeTimer) {
      console.log(`[WindowMonitor] Clearing existing debounce timer (window changed again before debounce completed)`);
      clearTimeout(this.windowChangeTimer);
    }

    // Set new timer
    console.log(`[WindowMonitor] Setting debounce timer (${this.debounceDelay}ms) for window change event`);
    this.windowChangeTimer = setTimeout(() => {
      console.log(`[WindowMonitor] 📢 Emitting windowChange event:`);
      console.log(`[WindowMonitor]   App: "${windowInfo.appName}"`);
      console.log(`[WindowMonitor]   Title: "${windowInfo.windowTitle}"`);
      this.emit('windowChange', windowInfo);
      this.windowChangeTimer = null;
    }, this.debounceDelay);
  }

  /**
   * Start monitoring window changes
   * @param {number} interval - Check interval in ms
   */
  startMonitoring(interval = 1000) {
    if (this.isMonitoring) {
      console.log(`[WindowMonitor] Monitoring already active, ignoring startMonitoring call`);
      return;
    }

    console.log(`[WindowMonitor] ✓ Starting window monitoring (checking every ${interval}ms)`);
    console.log(`[WindowMonitor] Configuration:`, {
      cacheTTL: this.cacheTTL,
      debounceDelay: this.debounceDelay,
      warningInterval: this.warningInterval,
      hasCachedWindow: !!this.lastWindow
    });
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/cd85e294-0bef-430a-902e-994341727018',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'backend/services/windowMonitor.js:204',message:'startMonitoring called',data:{interval},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    this.isMonitoring = true;
    let cycleCount = 0;
    this.monitorInterval = setInterval(async () => {
      cycleCount++;
      const cycleStartTime = Date.now();
      try {
        console.log(`[WindowMonitor] Monitoring cycle #${cycleCount} started`);
        await this.getActiveWindow();
        const cycleDuration = Date.now() - cycleStartTime;
        console.log(`[WindowMonitor] Monitoring cycle #${cycleCount} completed (${cycleDuration}ms)`);
      } catch (error) {
        const cycleDuration = Date.now() - cycleStartTime;
        console.error(`[WindowMonitor] ✗ Error in monitoring cycle #${cycleCount} (${cycleDuration}ms):`, {
          name: error.name,
          message: error.message,
          stack: error.stack
        });
      }
    }, interval);
  }

  /**
   * Stop monitoring
   */
  stopMonitoring() {
    console.log(`[WindowMonitor] stopMonitoring() called (isMonitoring: ${this.isMonitoring})`);
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
      console.log(`[WindowMonitor] Cleared monitoring interval`);
    }
    if (this.windowChangeTimer) {
      clearTimeout(this.windowChangeTimer);
      this.windowChangeTimer = null;
      console.log(`[WindowMonitor] Cleared window change debounce timer`);
    }
    if (this.isMonitoring) {
      console.log('[WindowMonitor] ✓ Stopped window monitoring');
    } else {
      console.log('[WindowMonitor] Monitoring was not active');
    }
    this.isMonitoring = false;
  }

  /**
   * Clear cache
   */
  clearCache() {
    const hadCache = !!this.lastWindow;
    const cacheInfo = hadCache ? `"${this.lastWindow.appName}" - "${this.lastWindow.windowTitle}"` : 'none';
    console.log(`[WindowMonitor] Clearing cache (previous cache: ${cacheInfo})`);
    this.lastWindow = null;
    this.lastWindowTime = 0;
    console.log(`[WindowMonitor] ✓ Cache cleared`);
  }
}

module.exports = WindowMonitor;
