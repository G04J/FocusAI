const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const Tesseract = require('tesseract.js');
const sharp = require('sharp');
const os = require('os');

/**
 * OCR Service (Hybrid)
 * Uses Apple Vision on macOS, falls back to Tesseract.js
 */
class OCRService {
  constructor() {
    this.isMacOS = os.platform() === 'darwin';
    this.ocrScriptPath = path.join(__dirname, '../scripts/macos_ocr.py');
    this.cache = new Map(); // Cache OCR results per window
    this.maxConcurrentOCR = 2;
    this.ocrQueue = [];
    this.activeOCRCount = 0;
    this.cacheTimeout = 3600000; // 1 hour
  }

  /**
   * Perform OCR on image
   * @param {Buffer} imageBuffer - Image buffer
   * @param {Object} region - Optional region {x, y, width, height}
   * @returns {Promise<Object>} OCR result {text, confidence}
   */
  async ocr(imageBuffer, region = null) {
    try {
      // Timeout wrapper (10s)
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('OCR timeout')), 10000)
      );

      const ocrPromise = (async () => {
        // Extract region if specified
        let processedBuffer = imageBuffer;
        if (region) {
          processedBuffer = await sharp(imageBuffer)
            .extract({
              left: region.x,
              top: region.y,
              width: region.width,
              height: region.height
            })
            .png()
            .toBuffer();
        }

        // Downscale for better performance (50% size)
        const metadata = await sharp(processedBuffer).metadata();
        const downscaledBuffer = await sharp(processedBuffer)
          .resize(
            Math.floor(metadata.width * 0.5),
            Math.floor(metadata.height * 0.5)
          )
          .png()
          .toBuffer();

        // Try native OCR first on macOS
        if (this.isMacOS) {
          try {
            return await this.ocrNative(downscaledBuffer);
          } catch (error) {
            console.warn('Native OCR failed, falling back to Tesseract.js:', error.message);
            // Fallback to Tesseract.js
          }
        }

        // Use Tesseract.js
        return await this.ocrTesseract(downscaledBuffer);
      })();

      return await Promise.race([ocrPromise, timeoutPromise]);
    } catch (error) {
      console.error('OCR error:', error);
      // Return empty result with low confidence
      return {
        text: '',
        confidence: 0.0,
        error: error.message
      };
    }
  }

  /**
   * Perform OCR on URL bar region
   * @param {Buffer} imageBuffer - Image buffer
   * @param {string} browser - Browser type (chrome, firefox, safari)
   * @returns {Promise<Object>} OCR result
   */
  async ocrUrlBar(imageBuffer, browser = 'chrome') {
    try {
      const metadata = await sharp(imageBuffer).metadata();
      const { width, height } = metadata;

      // Browser-specific regions
      const regions = {
        chrome: { x: 0, y: 0, width: width, height: 120 },
        firefox: { x: 0, y: 0, width: width, height: 110 },
        safari: { x: 0, y: 0, width: width, height: 100 },
        edge: { x: 0, y: 0, width: width, height: 120 }
      };

      const region = regions[browser.toLowerCase()] || regions.chrome;
      return await this.ocr(imageBuffer, region);
    } catch (error) {
      console.error('URL bar OCR error:', error);
      return {
        text: '',
        confidence: 0.0,
        error: error.message
      };
    }
  }

  /**
   * Use native macOS OCR (Apple Vision)
   * @param {Buffer} imageBuffer - Image buffer
   * @returns {Promise<Object>} OCR result
   */
  async ocrNative(imageBuffer) {
    return new Promise((resolve, reject) => {
      // Save buffer to temp file
      const tempPath = path.join(os.tmpdir(), `ocr_${Date.now()}.png`);
      
      fs.writeFile(tempPath, imageBuffer)
        .then(() => {
          // Call Python script
          const python = spawn('python3', [this.ocrScriptPath, tempPath]);
          let stdout = '';
          let stderr = '';

          python.stdout.on('data', (data) => {
            stdout += data.toString();
          });

          python.stderr.on('data', (data) => {
            stderr += data.toString();
          });

          python.on('close', async (code) => {
            // Cleanup temp file
            try {
              await fs.unlink(tempPath);
            } catch (e) {
              // Ignore cleanup errors
            }

            if (code !== 0) {
              reject(new Error(`Python script failed: ${stderr || 'Unknown error'}`));
              return;
            }

            try {
              const result = JSON.parse(stdout);
              if (result.error) {
                reject(new Error(result.error));
              } else {
                resolve(result);
              }
            } catch (error) {
              reject(new Error(`Failed to parse OCR result: ${error.message}`));
            }
          });

          python.on('error', async (error) => {
            // Cleanup temp file
            try {
              await fs.unlink(tempPath);
            } catch (e) {
              // Ignore cleanup errors
            }
            reject(new Error(`Failed to spawn Python process: ${error.message}`));
          });
        })
        .catch(reject);
    });
  }

  /**
   * Use Tesseract.js OCR
   * @param {Buffer} imageBuffer - Image buffer
   * @returns {Promise<Object>} OCR result
   */
  async ocrTesseract(imageBuffer) {
    try {
      const { data } = await Tesseract.recognize(imageBuffer, 'eng', {
        logger: m => {
          // Suppress verbose logging
          if (m.status === 'recognizing text') {
            // Progress updates can be logged if needed
          }
        }
      });

      return {
        text: data.text || '',
        confidence: data.confidence ? data.confidence / 100 : 0.0
      };
    } catch (error) {
      throw new Error(`Tesseract.js OCR failed: ${error.message}`);
    }
  }

  /**
   * Extract domain from OCR text
   * @param {string} text - OCR text
   * @returns {Object} {domain, url, confidence}
   */
  extractDomain(text) {
    if (!text) {
      return { domain: null, url: null, confidence: 0.0 };
    }

    // Try to find URL in text
    const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9-]+\.[a-zA-Z]{2,})/gi;
    const matches = text.match(urlRegex);

    if (matches && matches.length > 0) {
      let url = matches[0];
      
      // Normalize URL
      if (!url.startsWith('http')) {
        url = 'https://' + url;
      }

      try {
        const urlObj = new URL(url);
        const domain = urlObj.hostname.replace('www.', '');
        return {
          domain: domain,
          url: urlObj.href,
          confidence: 0.9
        };
      } catch (e) {
        // Invalid URL, try to extract domain directly
        const domainMatch = matches[0].replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
        return {
          domain: domainMatch,
          url: matches[0],
          confidence: 0.7
        };
      }
    }

    // No URL found
    return { domain: null, url: null, confidence: 0.0 };
  }

  /**
   * Clear OCR cache
   */
  clearCache() {
    this.cache.clear();
  }
}

module.exports = OCRService;
