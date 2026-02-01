const { BrowserWindow } = require('electron');
const path = require('path');

/**
 * Overlay Service
 * Creates transparent Electron window for zone-based blocking
 */
class OverlayService {
  constructor() {
    this.overlayWindow = null;
    this.isVisible = false;
    this.currentZones = [];
    this.positionUpdateTimer = null;
  }

  /**
   * Create overlay window (lazy creation)
   * @param {Object} bounds - Window bounds {x, y, width, height}
   * @returns {BrowserWindow} Overlay window
   */
  createOverlay(bounds) {
    try {
      // Reuse existing window if available
      if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
        return this.overlayWindow;
      }

      // Create new overlay window
      this.overlayWindow = new BrowserWindow({
        width: bounds.width || 1920,
        height: bounds.height || 1080,
        x: bounds.x || 0,
        y: bounds.y || 0,
        transparent: true,
        frame: false,
        alwaysOnTop: true,
        skipTaskbar: true,
        focusable: false,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true
        }
      });

      // Set click-through by default
      this.overlayWindow.setIgnoreMouseEvents(true, { forward: true });

      // Load HTML content
      this.overlayWindow.loadFile(path.join(__dirname, '../overlay/overlay.html'));

      // Handle window close
      this.overlayWindow.on('closed', () => {
        this.overlayWindow = null;
        this.isVisible = false;
      });

      return this.overlayWindow;
    } catch (error) {
      console.error('Error creating overlay:', error);
      // Retry once
      try {
        this.overlayWindow = null;
        return this.createOverlay(bounds);
      } catch (retryError) {
        console.error('Error retrying overlay creation:', retryError);
        return null;
      }
    }
  }

  /**
   * Update overlay zones
   * @param {Array<Object>} zones - Array of zone objects {x, y, w, h, reason}
   */
  updateZones(zones) {
    if (!this.overlayWindow || this.overlayWindow.isDestroyed()) {
      return;
    }

    this.currentZones = zones || [];

    // Send zones to renderer process
    this.overlayWindow.webContents.send('update-zones', zones);
  }

  /**
   * Show overlay with zones
   * @param {Array<Object>} zones - Array of zone objects
   * @param {Object} bounds - Window bounds
   */
  show(zones = [], bounds = null) {
    try {
      // Create overlay if needed
      if (!this.overlayWindow || this.overlayWindow.isDestroyed()) {
        if (!bounds) {
          bounds = { x: 0, y: 0, width: 1920, height: 1080 };
        }
        this.createOverlay(bounds);
      }

      if (!this.overlayWindow) {
        console.error('Failed to create overlay window');
        return;
      }

      // Update zones
      this.updateZones(zones);

      // Position overlay
      if (bounds) {
        this.updatePosition(bounds);
      }

      // Show overlay
      if (!this.isVisible) {
        this.overlayWindow.show();
        this.isVisible = true;
      }
    } catch (error) {
      console.error('Error showing overlay:', error);
    }
  }

  /**
   * Hide overlay
   */
  hide() {
    if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
      this.overlayWindow.hide();
      this.isVisible = false;
    }
  }

  /**
   * Update overlay position
   * @param {Object} bounds - Window bounds {x, y, width, height}
   */
  updatePosition(bounds) {
    if (!this.overlayWindow || this.overlayWindow.isDestroyed()) {
      return;
    }

    // Debounce position updates (1s max frequency)
    if (this.positionUpdateTimer) {
      clearTimeout(this.positionUpdateTimer);
    }

    this.positionUpdateTimer = setTimeout(() => {
      try {
        this.overlayWindow.setBounds({
          x: bounds.x || 0,
          y: bounds.y || 0,
          width: bounds.width || 1920,
          height: bounds.height || 1080
        });
      } catch (error) {
        console.error('Error updating overlay position:', error);
      }
      this.positionUpdateTimer = null;
    }, 1000);
  }

  /**
   * Destroy overlay
   */
  destroy() {
    if (this.positionUpdateTimer) {
      clearTimeout(this.positionUpdateTimer);
      this.positionUpdateTimer = null;
    }

    if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
      this.overlayWindow.close();
      this.overlayWindow = null;
    }

    this.isVisible = false;
    this.currentZones = [];
  }

  /**
   * Get overlay status
   * @returns {Object} Overlay status
   */
  getStatus() {
    return {
      isVisible: this.isVisible,
      isCreated: this.overlayWindow !== null && !this.overlayWindow.isDestroyed(),
      zoneCount: this.currentZones.length
    };
  }
}

module.exports = OverlayService;
