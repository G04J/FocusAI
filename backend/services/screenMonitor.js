// screenMonitor.js
const { desktopCapturer } = require('electron');
const sharp = require('sharp');
const EventEmitter = require('events');

/**
 * Enhanced Screenshot Service
 * Captures screenshots with adaptive frequency and downscaling
 */
class ScreenMonitor extends EventEmitter {
  constructor(stateMachine) {
    super();
    this.stateMachine = stateMachine;
    this.frequencies = {
      GREEN: 25000,    // 25 seconds
      YELLOW: 10000,   // 10 seconds
      AMBIGUOUS: 5000, // 5 seconds
      RED: 2500        // 2.5 seconds
    };
    this.currentFrequency = this.frequencies.GREEN;
    this.screenshotTimer = null;
    this.isCapturing = false;
    this.lastScreenshot = null;
    this.lastScreenshotTime = 0;
    this.screenshotBuffer = [];
    this.maxBufferSize = 5;
    this.downscaleFactor = 0.5; // 50% size

    // Listen to state changes
    if (this.stateMachine) {
      this.stateMachine.on('stateChange', ({ to }) => {
        this.updateFrequency(to);
      });
    }
  }

  /**
   * Update screenshot frequency based on state
   * @param {string} state - Current state
   */
  updateFrequency(state) {
    const newFrequency = this.frequencies[state] || this.frequencies.GREEN;
    if (newFrequency !== this.currentFrequency) {
      console.log(`[ScreenMonitor] State changed to ${state}, updating screenshot frequency from ${this.currentFrequency}ms to ${newFrequency}ms`);
      this.currentFrequency = newFrequency;
      // Restart timer with new frequency if monitoring
      if (this.screenshotTimer) {
        this.start(this.currentFrequency);
      }
    } else {
      console.log(`[ScreenMonitor] State changed to ${state}, frequency unchanged at ${this.currentFrequency}ms`);
    }
  }

  /**
   * Capture screenshot with downscaling
   * @returns {Promise<Buffer>} Image buffer
   */
  async captureScreen() {
    // Prevent concurrent captures
    if (this.isCapturing) {
      return this.lastScreenshot;
    }

    this.isCapturing = true;

    try {
      // Timeout wrapper (5s)
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Screenshot timeout')), 5000)
      );

      const capturePromise = (async () => {
        // Retry logic (max 2 retries)
        let retries = 2;
        let lastError;

        while (retries >= 0) {
          try {
            console.log(`[ScreenMonitor] 🔍 Attempting to capture screenshot (${2 - retries + 1}/3)...`);
            
            // Get screenshots with larger thumbnail size for better OCR
            // Use screen dimensions or at least 1920x1080 for better quality
            console.log(`[ScreenMonitor]   Calling desktopCapturer.getSources()...`);
            const sources = await desktopCapturer.getSources({ 
              types: ['screen'],
              thumbnailSize: { width: 1920, height: 1080 } // Larger thumbnails for OCR
            });
            
            console.log(`[ScreenMonitor]   Found ${sources?.length || 0} screen sources`);
            
            if (!sources || sources.length === 0) {
              throw new Error('No screen sources available');
            }

            const primaryScreen = sources[0];
            console.log(`[ScreenMonitor]   Using primary screen: ${primaryScreen.name || 'unknown'}`);
            
            let imageBuffer = primaryScreen.thumbnail.toPNG();
            console.log(`[ScreenMonitor]   Thumbnail converted to PNG: ${imageBuffer?.length || 0} bytes`);

            // Log original screenshot size
            const originalMetadata = await sharp(imageBuffer).metadata();
            console.log(`[ScreenMonitor] 📸 Screenshot captured: ${originalMetadata.width}x${originalMetadata.height}`);

            // Downscale only if image is large enough (min 400px width for OCR)
            if (sharp && originalMetadata.width > 400) {
              const metadata = originalMetadata;
              const newWidth = Math.floor(metadata.width * this.downscaleFactor);
              const newHeight = Math.floor(metadata.height * this.downscaleFactor);

              // Ensure minimum size for OCR (at least 300px width)
              const minWidth = 300;
              const finalWidth = Math.max(newWidth, minWidth);
              const finalHeight = Math.floor((finalWidth / newWidth) * newHeight);

              console.log(`[ScreenMonitor] 🔽 Downscaling: ${metadata.width}x${metadata.height} → ${finalWidth}x${finalHeight}`);

              imageBuffer = await sharp(imageBuffer)
                .resize(finalWidth, finalHeight)
                .png()
                .toBuffer();
            } else {
              console.log(`[ScreenMonitor] ⚠️ Screenshot too small (${originalMetadata.width}x${originalMetadata.height}), skipping downscale`);
            }

            // Update buffer
            this.lastScreenshot = imageBuffer;
            this.lastScreenshotTime = Date.now();
            
            console.log(`[ScreenMonitor] 💾 Screenshot stored: ${originalMetadata.width}x${originalMetadata.height}, buffer size: ${imageBuffer.length} bytes`);

            // Add to buffer (limit size)
            this.screenshotBuffer.push({
              buffer: imageBuffer,
              timestamp: this.lastScreenshotTime
            });
            if (this.screenshotBuffer.length > this.maxBufferSize) {
              this.screenshotBuffer.shift();
            }

            // Emit event
            console.log(`[ScreenMonitor] 📤 Emitting screenshot event`);
            this.emit('screenshot', imageBuffer);

            this.isCapturing = false;
            return imageBuffer;
          } catch (error) {
            lastError = error;
            retries--;
            if (retries >= 0) {
              // Exponential backoff
              await new Promise(resolve => setTimeout(resolve, 100 * (3 - retries)));
            }
          }
        }

        // All retries failed, fallback to previous screenshot
        if (this.lastScreenshot) {
          console.warn(`[ScreenMonitor] ⚠️ Screenshot capture failed after ${2 - retries} retries, using previous screenshot`);
          console.warn(`[ScreenMonitor]   Last error: ${lastError?.message || 'Unknown error'}`);
          this.isCapturing = false;
          return this.lastScreenshot;
        }

        console.error(`[ScreenMonitor] ❌ Screenshot capture failed completely, no previous screenshot available`);
        console.error(`[ScreenMonitor]   Error: ${lastError?.message || 'Unknown error'}`);
        throw lastError;
      })();

      const result = await Promise.race([capturePromise, timeoutPromise]);
      return result;
    } catch (error) {
      console.error(`[ScreenMonitor] ❌ Error capturing screen:`, error.message);
      console.error(`[ScreenMonitor]   Error type: ${error.constructor.name}`);
      console.error(`[ScreenMonitor]   Stack:`, error.stack);
      this.isCapturing = false;

      // Fallback to previous screenshot
      if (this.lastScreenshot) {
        console.log(`[ScreenMonitor] 🔄 Using previous screenshot as fallback`);
        return this.lastScreenshot;
      }

      // Continue with reduced frequency if failures persist
      if (!this.lastScreenshot) {
        const oldFreq = this.currentFrequency;
        this.currentFrequency = Math.min(this.currentFrequency * 2, 60000); // Max 1 minute
        console.warn(`[ScreenMonitor] ⚠️ No screenshots available, reducing frequency: ${oldFreq}ms → ${this.currentFrequency}ms`);
      }

      throw error;
    }
  }

  /**
   * Start adaptive screenshot capture
   * @param {number} initialFrequency - Initial frequency in ms (optional)
   */
  start(initialFrequency = null) {
    if (this.screenshotTimer) {
      this.stop();
    }

    if (initialFrequency) {
      this.currentFrequency = initialFrequency;
    } else {
      const currentState = this.stateMachine ? this.stateMachine.getState() : 'GREEN';
      this.currentFrequency = this.frequencies[currentState] || this.frequencies.GREEN;
    }

    // Skip if GREEN state and state hasn't changed (optimization)
    if (this.stateMachine && this.stateMachine.getState() === 'GREEN') {
      // Still capture, but less frequently
    }

    console.log(`[ScreenMonitor] Starting screenshot capture every ${this.currentFrequency}ms (state: ${this.stateMachine ? this.stateMachine.getState() : 'UNKNOWN'})`);

    // Capture initial screenshot immediately
    console.log(`[ScreenMonitor] 📸 Capturing initial screenshot...`);
    this.captureScreen().then(screenshot => {
      if (screenshot) {
        console.log(`[ScreenMonitor] ✅ Initial screenshot captured successfully`);
      } else {
        console.warn(`[ScreenMonitor] ⚠️ Initial screenshot capture returned null`);
      }
    }).catch(error => {
      console.error(`[ScreenMonitor] ❌ Initial screenshot capture failed:`, error.message);
    });

    this.screenshotTimer = setInterval(async () => {
      try {
        console.log(`[ScreenMonitor] 📸 Screenshot timer triggered (interval: ${this.currentFrequency}ms)`);
        const screenshot = await this.captureScreen();
        if (screenshot) {
          const metadata = await sharp(screenshot).metadata().catch(() => null);
          console.log(`[ScreenMonitor] ✅ Screenshot captured successfully: ${metadata ? `${metadata.width}x${metadata.height}` : 'unknown size'}`);
        } else {
          console.warn(`[ScreenMonitor] ⚠️ Screenshot capture returned null/undefined`);
        }
      } catch (error) {
        console.error(`[ScreenMonitor] ❌ Error in screenshot interval:`, error.message);
        console.error(`[ScreenMonitor]   Stack:`, error.stack);
      }
    }, this.currentFrequency);
  }

  /**
   * Stop screenshot capture
   */
  stop() {
    if (this.screenshotTimer) {
      clearInterval(this.screenshotTimer);
      this.screenshotTimer = null;
    }
  }

  /**
   * Get last screenshot
   * @returns {Buffer|null} Last screenshot buffer
   */
  getLastScreenshot() {
    const hasScreenshot = !!this.lastScreenshot;
    const age = this.lastScreenshotTime ? Date.now() - this.lastScreenshotTime : null;
    
    if (!hasScreenshot) {
      console.log(`[ScreenMonitor] 📭 getLastScreenshot() called: No screenshot available`);
    } else {
      console.log(`[ScreenMonitor] 📸 getLastScreenshot() called: Screenshot available (age: ${age ? `${Math.floor(age / 1000)}s` : 'unknown'})`);
    }
    
    return this.lastScreenshot;
  }

  /**
   * Clear screenshot buffer
   */
  clearBuffer() {
    this.screenshotBuffer = [];
    this.lastScreenshot = null;
    this.lastScreenshotTime = 0;
  }
}

// Keep backward compatibility
async function captureScreen() {
  const monitor = new ScreenMonitor(null);
  return await monitor.captureScreen();
}

module.exports = { captureScreen, ScreenMonitor };

