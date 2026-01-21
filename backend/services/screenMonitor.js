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
      this.currentFrequency = newFrequency;
      // Restart timer with new frequency if monitoring
      if (this.screenshotTimer) {
        this.start(this.currentFrequency);
      }
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
            const sources = await desktopCapturer.getSources({ types: ['screen'] });
            if (!sources || sources.length === 0) {
              throw new Error('No screen sources available');
            }

            const primaryScreen = sources[0];
            let imageBuffer = primaryScreen.thumbnail.toPNG();

            // Downscale immediately (before any processing)
            if (sharp) {
              const metadata = await sharp(imageBuffer).metadata();
              const newWidth = Math.floor(metadata.width * this.downscaleFactor);
              const newHeight = Math.floor(metadata.height * this.downscaleFactor);

              imageBuffer = await sharp(imageBuffer)
                .resize(newWidth, newHeight)
                .png()
                .toBuffer();
            }

            // Update buffer
            this.lastScreenshot = imageBuffer;
            this.lastScreenshotTime = Date.now();

            // Add to buffer (limit size)
            this.screenshotBuffer.push({
              buffer: imageBuffer,
              timestamp: this.lastScreenshotTime
            });
            if (this.screenshotBuffer.length > this.maxBufferSize) {
              this.screenshotBuffer.shift();
            }

            // Emit event
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
          console.warn('Screenshot capture failed, using previous screenshot');
          this.isCapturing = false;
          return this.lastScreenshot;
        }

        throw lastError;
      })();

      return await Promise.race([capturePromise, timeoutPromise]);
    } catch (error) {
      console.error('Error capturing screen:', error);
      this.isCapturing = false;

      // Fallback to previous screenshot
      if (this.lastScreenshot) {
        return this.lastScreenshot;
      }

      // Continue with reduced frequency if failures persist
      if (!this.lastScreenshot) {
        this.currentFrequency = Math.min(this.currentFrequency * 2, 60000); // Max 1 minute
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

    this.screenshotTimer = setInterval(async () => {
      try {
        await this.captureScreen();
      } catch (error) {
        console.error('Error in screenshot interval:', error);
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

