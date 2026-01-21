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
    this.cacheTTL = 500; // 500ms cache
    this.debounceDelay = 500; // 500ms debounce
    this.windowChangeTimer = null;
    this.isMonitoring = false;
    this.monitorInterval = null;
    this._windowsModule = null; // Cache for ESM module
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
    try {
      // Check cache
      const now = Date.now();
      if (this.lastWindow && (now - this.lastWindowTime) < this.cacheTTL) {
        return this.lastWindow;
      }

      // Get windows with retry (using ESM import)
      let windows;
      let retries = 3;
      const windowsModule = await this.getWindowsModule();
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/cd85e294-0bef-430a-902e-994341727018',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'backend/services/windowMonitor.js:56',message:'Calling openWindows()',data:{retries,hasOpenWindows:typeof windowsModule?.openWindows==='function'},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      while (retries > 0) {
        try {
          // Use openWindows() to get all windows, then filter for active one
          const allWindows = await windowsModule.openWindows();
          // The first window is typically the active one
          windows = allWindows;
          break;
        } catch (error) {
          retries--;
          if (retries === 0) {
            // Fallback to last known window
            if (this.lastWindow) {
              console.warn('Window detection failed, using last known window');
              return this.lastWindow;
            }
            throw error;
          }
          // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, 100 * (4 - retries)));
        }
      }

      if (!windows || windows.length === 0) {
        // Fallback to last known window
        if (this.lastWindow) {
          return this.lastWindow;
        }
        return null;
      }

      // Find active window (first window is usually the active one)
      // windows from openWindows() are ordered front to back
      const activeWindow = windows.find(w => (w.owner || w.appName) && w.title) || windows[0];
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/cd85e294-0bef-430a-902e-994341727018',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'backend/services/windowMonitor.js:90',message:'Selected active window candidate',data:{windowsCount:windows?.length||0,hasActive:!!activeWindow,title:activeWindow?.title||'',ownerType:typeof activeWindow?.owner,hasAppName:!!activeWindow?.appName},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'B'})}).catch(()=>{});
      // #endregion

      if (!activeWindow) {
        if (this.lastWindow) {
          return this.lastWindow;
        }
        return null;
      }

      // Validate window bounds
      const bounds = activeWindow.bounds || { x: 0, y: 0, width: 0, height: 0 };
      if (!this.isValidBounds(bounds)) {
        if (this.lastWindow) {
          return this.lastWindow;
        }
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

      // Update cache
      const prevWindow = this.lastWindow;
      this.lastWindow = windowInfo;
      this.lastWindowTime = now;

      // Check if window changed
      if (prevWindow && (
        prevWindow.appName !== windowInfo.appName ||
        prevWindow.windowTitle !== windowInfo.windowTitle
      )) {
        console.log(`[WindowMonitor] Window changed: "${prevWindow.appName}" → "${windowInfo.appName}"`);
        console.log(`[WindowMonitor] Title: "${prevWindow.windowTitle}" → "${windowInfo.windowTitle}"`);
        this.debounceWindowChange(windowInfo);
      } else if (!prevWindow) {
        // First window detection
        console.log(`[WindowMonitor] ✓ Detected active window: "${windowInfo.appName}" - "${windowInfo.windowTitle}"`);
      }

      return windowInfo;
    } catch (error) {
      console.error('Error getting active window:', error);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/cd85e294-0bef-430a-902e-994341727018',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'backend/services/windowMonitor.js:151',message:'getActiveWindow threw error',data:{name:error?.name,message:error?.message},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      // Fallback to last known window
      if (this.lastWindow) {
        return this.lastWindow;
      }
      // Graceful degradation - return safe state
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
    if (!bounds) return false;
    const { width, height } = bounds;
    return width > 0 && height > 0 && width < 10000 && height < 10000;
  }

  /**
   * Debounce window changes
   * @param {Object} windowInfo - New window info
   */
  debounceWindowChange(windowInfo) {
    // Clear existing timer
    if (this.windowChangeTimer) {
      clearTimeout(this.windowChangeTimer);
    }

    // Set new timer
    this.windowChangeTimer = setTimeout(() => {
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
      return;
    }

    console.log(`[WindowMonitor] ✓ Starting window monitoring (checking every ${interval}ms)`);
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/cd85e294-0bef-430a-902e-994341727018',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'backend/services/windowMonitor.js:204',message:'startMonitoring called',data:{interval},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    this.isMonitoring = true;
    this.monitorInterval = setInterval(async () => {
      try {
        await this.getActiveWindow();
      } catch (error) {
        console.error('[WindowMonitor] Error in window monitoring:', error);
      }
    }, interval);
  }

  /**
   * Stop monitoring
   */
  stopMonitoring() {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
    if (this.windowChangeTimer) {
      clearTimeout(this.windowChangeTimer);
      this.windowChangeTimer = null;
    }
    if (this.isMonitoring) {
      console.log('[WindowMonitor] ✓ Stopped window monitoring');
    }
    this.isMonitoring = false;
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.lastWindow = null;
    this.lastWindowTime = 0;
  }
}

module.exports = WindowMonitor;
