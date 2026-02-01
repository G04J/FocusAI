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
    const startTime = Date.now();
    try {
      // Timeout wrapper (10s)
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => {
          const elapsed = Date.now() - startTime;
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/cd85e294-0bef-430a-902e-994341727018',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ocrService.js:35',message:'OCR timeout triggered',data:{elapsed,region:region?`${region.width}x${region.height}`:'full',bufferSize:imageBuffer.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
          // #endregion
          console.error('[OCR] Timeout after 10s', {
            elapsed: `${elapsed}ms`,
            region: region ? `${region.width}x${region.height}` : 'full',
            bufferSize: imageBuffer.length
          });
          reject(new Error('OCR timeout'));
        }, 10000)
      );

      const ocrPromise = (async () => {
        try {
          // Extract region if specified
          let processedBuffer = imageBuffer;
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/cd85e294-0bef-430a-902e-994341727018',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ocrService.js:49',message:'Before region extraction',data:{hasRegion:!!region,region:region?{x:region.x,y:region.y,width:region.width,height:region.height}:null,originalBufferSize:imageBuffer.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
          // #endregion
          if (region) {
            try {
              processedBuffer = await sharp(imageBuffer)
                .extract({
                  left: region.x,
                  top: region.y,
                  width: region.width,
                  height: region.height
                })
                .png()
                .toBuffer();
              // #region agent log
              const extractedMetadata = await sharp(processedBuffer).metadata();
              fetch('http://127.0.0.1:7242/ingest/cd85e294-0bef-430a-902e-994341727018',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ocrService.js:60',message:'After region extraction',data:{extractedSize:{width:extractedMetadata.width,height:extractedMetadata.height},extractedBufferSize:processedBuffer.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
              // #endregion
            } catch (error) {
              console.error('[OCR] Failed to extract region', {
                error: error.message,
                region: { x: region.x, y: region.y, width: region.width, height: region.height },
                bufferSize: imageBuffer.length,
                stack: error.stack
              });
              throw error;
            }
          }

          // Downscale for better performance, but ensure minimum size for OCR
          let metadata;
          let downscaledBuffer;
          try {
            metadata = await sharp(processedBuffer).metadata();
            console.log(`[OCR] 📏 Image size before downscaling: ${metadata.width}x${metadata.height}`);
            
            // Only downscale if image is large enough (min 200px width for OCR)
            const minWidth = 200;
            let targetWidth, targetHeight;
            
            if (metadata.width > minWidth * 2) {
              // Downscale to 50% but ensure minimum size
              targetWidth = Math.max(Math.floor(metadata.width * 0.5), minWidth);
              targetHeight = Math.floor((targetWidth / metadata.width) * metadata.height);
              console.log(`[OCR] 🔽 Downscaling to: ${targetWidth}x${targetHeight}`);
            } else {
              // Image already small enough, use as-is
              targetWidth = metadata.width;
              targetHeight = metadata.height;
              console.log(`[OCR] ✅ Image size acceptable (${targetWidth}x${targetHeight}), skipping downscale`);
            }
            
            downscaledBuffer = await sharp(processedBuffer)
              .resize(targetWidth, targetHeight)
              .png()
              .toBuffer();
            // #region agent log
            const downscaledMetadata = await sharp(downscaledBuffer).metadata();
            fetch('http://127.0.0.1:7242/ingest/cd85e294-0bef-430a-902e-994341727018',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ocrService.js:83',message:'After downscaling',data:{afterDownscale:{width:downscaledMetadata.width,height:downscaledMetadata.height},downscaledBufferSize:downscaledBuffer.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
            // #endregion
          } catch (error) {
            console.error('[OCR] Failed to downscale image', {
              error: error.message,
              originalSize: metadata ? `${metadata.width}x${metadata.height}` : 'unknown',
              bufferSize: processedBuffer.length,
              stack: error.stack
            });
            throw error;
          }

          // Try native OCR first on macOS
          if (this.isMacOS) {
            try {
              // #region agent log
              fetch('http://127.0.0.1:7242/ingest/cd85e294-0bef-430a-902e-994341727018',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ocrService.js:96',message:'Attempting native OCR',data:{imageSize:{width:metadata.width,height:metadata.height},downscaledBufferSize:downscaledBuffer.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
              // #endregion
              const result = await this.ocrNative(downscaledBuffer);
              const elapsed = Date.now() - startTime;
              // #region agent log
              fetch('http://127.0.0.1:7242/ingest/cd85e294-0bef-430a-902e-994341727018',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ocrService.js:103',message:'Native OCR succeeded',data:{textLength:result.text?.length||0,confidence:result.confidence,elapsed},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
              // #endregion
              console.log('[OCR] Native OCR succeeded', {
                elapsed: `${elapsed}ms`,
                textLength: result.text?.length || 0,
                confidence: result.confidence
              });
              return result;
            } catch (error) {
              // #region agent log
              fetch('http://127.0.0.1:7242/ingest/cd85e294-0bef-430a-902e-994341727018',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ocrService.js:111',message:'Native OCR failed',data:{error:error.message,imageSize:{width:metadata.width,height:metadata.height}},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
              // #endregion
              console.warn('[OCR] Native OCR failed, falling back to Tesseract.js', {
                error: error.message,
                method: 'ocrNative',
                stack: error.stack,
                imageSize: `${metadata.width}x${metadata.height}`
              });
              // Fallback to Tesseract.js
            }
          }

          // Use Tesseract.js
          const result = await this.ocrTesseract(downscaledBuffer);
          const elapsed = Date.now() - startTime;
          console.log('[OCR] Tesseract.js OCR succeeded', {
            elapsed: `${elapsed}ms`,
            textLength: result.text?.length || 0,
            confidence: result.confidence
          });
          return result;
        } catch (error) {
          const elapsed = Date.now() - startTime;
          console.error('[OCR] Processing error in ocrPromise', {
            error: error.message,
            elapsed: `${elapsed}ms`,
            region: region ? `${region.width}x${region.height}` : 'full',
            stack: error.stack
          });
          throw error;
        }
      })();

      return await Promise.race([ocrPromise, timeoutPromise]);
    } catch (error) {
      const elapsed = Date.now() - startTime;
      console.error('[OCR] OCR operation failed', {
        error: error.message,
        errorType: error.constructor.name,
        elapsed: `${elapsed}ms`,
        region: region ? `${region.width}x${region.height} at (${region.x},${region.y})` : 'full',
        bufferSize: imageBuffer.length,
        isMacOS: this.isMacOS,
        stack: error.stack
      });
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
    const startTime = Date.now();
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/cd85e294-0bef-430a-902e-994341727018',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ocrService.js:163',message:'ocrUrlBar entry',data:{browser, bufferSize:imageBuffer.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    try {
      let metadata;
      try {
        metadata = await sharp(imageBuffer).metadata();
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/cd85e294-0bef-430a-902e-994341727018',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ocrService.js:169',message:'Image metadata extracted',data:{width:metadata.width,height:metadata.height,format:metadata.format},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
      } catch (error) {
        console.error('[OCR] Failed to read image metadata for URL bar', {
          error: error.message,
          browser: browser,
          bufferSize: imageBuffer.length,
          stack: error.stack
        });
        throw error;
      }

      const { width, height } = metadata;

      // Browser-specific regions
      const regions = {
        chrome: { x: 0, y: 0, width: width, height: 120 },
        firefox: { x: 0, y: 0, width: width, height: 110 },
        safari: { x: 0, y: 0, width: width, height: 100 },
        edge: { x: 0, y: 0, width: width, height: 120 }
      };

      const region = regions[browser.toLowerCase()] || regions.chrome;
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/cd85e294-0bef-430a-902e-994341727018',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ocrService.js:189',message:'Region calculated',data:{requestedRegion:{width:region.width,height:region.height},imageSize:{width,height},needsAdjustment:region.width>width||region.height>height},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      
      if (region.width > width || region.height > height) {
        console.warn('[OCR] URL bar region exceeds image dimensions', {
          browser: browser,
          region: `${region.width}x${region.height}`,
          imageSize: `${width}x${height}`,
          adjustedRegion: { width: Math.min(region.width, width), height: Math.min(region.height, height) }
        });
        region.width = Math.min(region.width, width);
        region.height = Math.min(region.height, height);
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/cd85e294-0bef-430a-902e-994341727018',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ocrService.js:199',message:'Region adjusted',data:{adjustedRegion:{width:region.width,height:region.height},originalRequest:{width:regions[browser.toLowerCase()]?.width||regions.chrome.width,height:regions[browser.toLowerCase()]?.height||regions.chrome.height}},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
      }

      console.log(`[OCR] 📸 Extracting text from URL bar region (browser: ${browser})...`);
      console.log(`[OCR]   Region: x=${region.x}, y=${region.y}, width=${region.width}, height=${region.height}`);
      console.log(`[OCR]   Image size: ${width}x${height}`);
      
      // Warn if image is too small for OCR
      if (region.width < 200 || region.height < 50) {
        console.warn(`[OCR] ⚠️ Warning: URL bar region is very small (${region.width}x${region.height}), OCR may fail`);
      }
      
      const result = await this.ocr(imageBuffer, region);
      const elapsed = Date.now() - startTime;
      
      console.log(`[OCR] ✅ URL bar OCR completed (${elapsed}ms):`);
      console.log(`[OCR]   Extracted text: "${result.text || ''}"`);
      console.log(`[OCR]   Text length: ${result.text?.length || 0} chars`);
      console.log(`[OCR]   Confidence: ${result.confidence?.toFixed(2) || 'N/A'}`);
      
      if (!result.text || result.text.length === 0) {
        console.warn(`[OCR] ⚠️ No text extracted - this may be due to small image size or OCR failure`);
      }
      
      return result;
    } catch (error) {
      const elapsed = Date.now() - startTime;
      console.error('[OCR] URL bar OCR error', {
        error: error.message,
        errorType: error.constructor.name,
        browser: browser,
        elapsed: `${elapsed}ms`,
        bufferSize: imageBuffer.length,
        stack: error.stack
      });
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
    const startTime = Date.now();
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
            const elapsed = Date.now() - startTime;
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/cd85e294-0bef-430a-902e-994341727018',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ocrService.js:255',message:'Python script closed',data:{exitCode:code,stderr:stderr||'empty',stdout:stdout||'empty',elapsed},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
            // #endregion
            // Cleanup temp file
            try {
              await fs.unlink(tempPath);
            } catch (e) {
              console.warn('[OCR] Failed to cleanup temp file', {
                tempPath: tempPath,
                error: e.message
              });
            }

            if (code !== 0) {
              console.error('[OCR] Python script exited with non-zero code', {
                exitCode: code,
                stderr: stderr || 'No stderr output',
                stdout: stdout || 'No stdout output',
                scriptPath: this.ocrScriptPath,
                tempPath: tempPath,
                elapsed: `${elapsed}ms`
              });
              reject(new Error(`Python script failed: ${stderr || 'Unknown error'}`));
              return;
            }

            try {
              if (!stdout || stdout.trim().length === 0) {
                console.error('[OCR] Python script returned empty output', {
                  scriptPath: this.ocrScriptPath,
                  tempPath: tempPath,
                  elapsed: `${elapsed}ms`
                });
                reject(new Error('Python script returned empty output'));
                return;
              }

              const result = JSON.parse(stdout);
              if (result.error) {
                console.error('[OCR] Python script returned error', {
                  error: result.error,
                  scriptPath: this.ocrScriptPath,
                  tempPath: tempPath,
                  elapsed: `${elapsed}ms`
                });
                reject(new Error(result.error));
              } else {
                console.log('[OCR] Native OCR completed successfully', {
                  textLength: result.text?.length || 0,
                  confidence: result.confidence,
                  elapsed: `${elapsed}ms`
                });
                resolve(result);
              }
            } catch (error) {
              console.error('[OCR] Failed to parse Python script output', {
                error: error.message,
                stdout: stdout.substring(0, 500), // Log first 500 chars
                scriptPath: this.ocrScriptPath,
                tempPath: tempPath,
                elapsed: `${elapsed}ms`,
                stack: error.stack
              });
              reject(new Error(`Failed to parse OCR result: ${error.message}`));
            }
          });

          python.on('error', async (error) => {
            const elapsed = Date.now() - startTime;
            // Cleanup temp file
            try {
              await fs.unlink(tempPath);
            } catch (e) {
              console.warn('[OCR] Failed to cleanup temp file after spawn error', {
                tempPath: tempPath,
                error: e.message
              });
            }
            console.error('[OCR] Failed to spawn Python process', {
              error: error.message,
              errorType: error.constructor.name,
              scriptPath: this.ocrScriptPath,
              tempPath: tempPath,
              bufferSize: imageBuffer.length,
              elapsed: `${elapsed}ms`,
              stack: error.stack
            });
            reject(new Error(`Failed to spawn Python process: ${error.message}`));
          });
        })
        .catch(async (error) => {
          const elapsed = Date.now() - startTime;
          // Cleanup temp file on write error
          try {
            await fs.unlink(tempPath);
          } catch (e) {
            console.warn('[OCR] Failed to cleanup temp file after write error', {
              tempPath: tempPath,
              error: e.message
            });
          }
          console.error('[OCR] Failed to write temp file for native OCR', {
            error: error.message,
            errorType: error.constructor.name,
            tempPath: tempPath,
            bufferSize: imageBuffer.length,
            elapsed: `${elapsed}ms`,
            stack: error.stack
          });
          reject(error);
        });
    });
  }

  /**
   * Use Tesseract.js OCR
   * @param {Buffer} imageBuffer - Image buffer
   * @returns {Promise<Object>} OCR result
   */
  async ocrTesseract(imageBuffer) {
    const startTime = Date.now();
    try {
      const { data } = await Tesseract.recognize(imageBuffer, 'eng', {
        logger: m => {
          // Log progress for debugging
          if (m.status === 'recognizing text' && m.progress) {
            console.log('[OCR] Tesseract progress', {
              status: m.status,
              progress: `${Math.round(m.progress * 100)}%`
            });
          }
          // Log errors from Tesseract
          if (m.status === 'error') {
            console.error('[OCR] Tesseract internal error', {
              error: m.message || 'Unknown error',
              status: m.status
            });
          }
        }
      });

      const elapsed = Date.now() - startTime;
      const result = {
        text: data.text || '',
        confidence: data.confidence ? data.confidence / 100 : 0.0
      };
      
      console.log('[OCR] Tesseract.js OCR completed', {
        textLength: result.text.length,
        confidence: result.confidence,
        elapsed: `${elapsed}ms`
      });

      return result;
    } catch (error) {
      const elapsed = Date.now() - startTime;
      console.error('[OCR] Tesseract.js OCR failed', {
        error: error.message,
        errorType: error.constructor.name,
        bufferSize: imageBuffer.length,
        elapsed: `${elapsed}ms`,
        stack: error.stack
      });
      throw new Error(`Tesseract.js OCR failed: ${error.message}`);
    }
  }

  /**
   * Extract domain from OCR text
   * @param {string} text - OCR text
   * @returns {Object} {domain, url, confidence}
   */
  extractDomain(text) {
    try {
      console.log(`[OCR] 🔍 Extracting domain from OCR text...`);
      console.log(`[OCR]   Input text: "${text || ''}"`);
      console.log(`[OCR]   Text length: ${text?.length || 0} chars`);
      
      if (!text) {
        console.log(`[OCR]   ⚠️ No text provided, returning empty result`);
        return { domain: null, url: null, confidence: 0.0 };
      }

      // Try to find URL in text
      const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9-]+\.[a-zA-Z]{2,})/gi;
      const matches = text.match(urlRegex);
      
      console.log(`[OCR]   Found ${matches?.length || 0} URL matches:`, matches || []);

      if (matches && matches.length > 0) {
        let url = matches[0];
        
        // Normalize URL
        if (!url.startsWith('http')) {
          url = 'https://' + url;
        }

        try {
          const urlObj = new URL(url);
          const domain = urlObj.hostname.replace('www.', '');
          console.log(`[OCR] ✅ Domain extracted successfully:`);
          console.log(`[OCR]   Domain: ${domain}`);
          console.log(`[OCR]   Full URL: ${urlObj.href}`);
          console.log(`[OCR]   Confidence: 0.9`);
          return {
            domain: domain,
            url: urlObj.href,
            confidence: 0.9
          };
        } catch (e) {
          // Invalid URL, try to extract domain directly
          const domainMatch = matches[0].replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
          console.warn('[OCR] ⚠️ Failed to parse URL, using domain match', {
            originalMatch: matches[0],
            extractedDomain: domainMatch,
            error: e.message
          });
          console.log(`[OCR]   Extracted domain: ${domainMatch}`);
          console.log(`[OCR]   Confidence: 0.7`);
          return {
            domain: domainMatch,
            url: matches[0],
            confidence: 0.7
          };
        }
      }

      // No URL found
      console.log(`[OCR] ⚠️ No URL found in OCR text`);
      return { domain: null, url: null, confidence: 0.0 };
    } catch (error) {
      console.error('[OCR] Error extracting domain from text', {
        error: error.message,
        textLength: text?.length || 0,
        textPreview: text?.substring(0, 100) || 'empty',
        stack: error.stack
      });
      return { domain: null, url: null, confidence: 0.0 };
    }
  }

  /**
   * Clear OCR cache
   */
  clearCache() {
    this.cache.clear();
  }
}

module.exports = OCRService;
