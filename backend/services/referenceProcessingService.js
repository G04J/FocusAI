const fs = require('fs').promises;
const path = require('path');
const pdfParse = require('pdf-parse');
const cheerio = require('cheerio');

/**
 * Reference Processing Service
 * Extracts and processes reference materials (PDFs, URLs, text) to create task context for AI.
 */
class ReferenceProcessingService {
  constructor(referenceRepository) {
    this.referenceRepo = referenceRepository;
  }

  /**
   * Process all references for a session
   * @param {number} sessionId - Session ID
   * @param {Object} sessionData - Session data with reference fields
   * @returns {Promise<Object>} Processed reference content
   */
  async processSessionReferences(sessionId, sessionData) {
    const results = {
      pdfs: [],
      urls: [],
      texts: [],
      keywords: [],
      summaries: []
    };

    try {
      // Process PDFs in parallel
      if (sessionData.reference_file_path) {
        const pdfPaths = JSON.parse(sessionData.reference_file_path || '[]');
        const pdfPromises = pdfPaths.map(pdfPath => 
          this.processPDFReference(sessionId, pdfPath)
            .catch(err => {
              console.error(`Error processing PDF ${pdfPath}:`, err);
              return null;
            })
        );
        const pdfResults = await Promise.all(pdfPromises);
        results.pdfs = pdfResults.filter(r => r !== null);
      }

      // Process URLs in parallel (limited to 5 concurrent)
      if (sessionData.reference_url) {
        const urls = JSON.parse(sessionData.reference_url || '[]');
        // Process in batches of 5
        const batchSize = 5;
        for (let i = 0; i < urls.length; i += batchSize) {
          const batch = urls.slice(i, i + batchSize);
          const urlPromises = batch.map(url =>
            this.processURLReference(sessionId, url)
              .catch(err => {
                console.error(`Error processing URL ${url}:`, err);
                return null;
              })
          );
          const urlResults = await Promise.all(urlPromises);
          results.urls.push(...urlResults.filter(r => r !== null));
        }
      }

      // Process text references
      if (sessionData.reference_text) {
        const textResult = await this.processTextReference(sessionId, sessionData.reference_text);
        if (textResult) {
          results.texts.push(textResult);
        }
      }

      // Extract keywords and create summary
      const allContent = [
        ...results.pdfs,
        ...results.urls,
        ...results.texts
      ];

      results.keywords = this.extractKeywords(allContent);
      results.summaries = allContent.map(ref => ref.summary || '').filter(s => s);

      return results;
    } catch (error) {
      console.error('Error processing session references:', error);
      // Return partial results
      return results;
    }
  }

  /**
   * Process a PDF reference
   * @param {number} sessionId - Session ID
   * @param {string} pdfPath - Path to PDF file
   * @returns {Promise<Object>} Processed PDF content
   */
  async processPDFReference(sessionId, pdfPath) {
    try {
      // Timeout wrapper (30s)
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('PDF processing timeout')), 30000)
      );

      const processPromise = (async () => {
        // Validate file path (prevent directory traversal)
        const safePath = path.resolve(pdfPath);
        if (!fs.access) {
          await fs.access(safePath).catch(() => {
            throw new Error('PDF file not found');
          });
        }

        // Read and parse PDF
        const dataBuffer = await fs.readFile(safePath);
        const pdfData = await pdfParse(dataBuffer);

        // Extract text
        const extractedText = pdfData.text || '';

        // Validate text length (max 100KB)
        if (extractedText.length > 100000) {
          throw new Error('PDF text too long (max 100KB)');
        }

        // Extract keywords and create summary
        const keywords = this.extractKeywordsFromText(extractedText);
        const summary = this.createSummary(extractedText);

        const result = {
          type: 'pdf',
          source: pdfPath,
          extractedText: extractedText.substring(0, 50000), // Limit stored text
          keywords: keywords.slice(0, 50), // Limit keywords
          summary: summary
        };

        // Store in database
        await this.referenceRepo.storeReferenceContent(sessionId, result);

        return result;
      })();

      return await Promise.race([processPromise, timeoutPromise]);
    } catch (error) {
      console.error(`Error processing PDF ${pdfPath}:`, error);
      throw error;
    }
  }

  /**
   * Process a URL reference
   * @param {number} sessionId - Session ID
   * @param {string} url - URL to fetch
   * @returns {Promise<Object>} Processed URL content
   */
  async processURLReference(sessionId, url) {
    try {
      // Validate URL (only http/https)
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        throw new Error('Invalid URL protocol (only http/https allowed)');
      }

      // Timeout wrapper (60s)
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('URL fetch timeout')), 60000)
      );

      const fetchPromise = (async () => {
        // Fetch URL with retry (max 1 retry)
        let response;
        try {
          response = await fetch(url, {
            headers: {
              'User-Agent': 'FocusAI/1.0'
            },
            signal: AbortSignal.timeout(55000) // 55s to allow timeout wrapper to catch it
          });
        } catch (err) {
          // Retry once
          try {
            response = await fetch(url, {
              headers: {
                'User-Agent': 'FocusAI/1.0'
              },
              signal: AbortSignal.timeout(55000)
            });
          } catch (retryErr) {
            throw new Error(`Failed to fetch URL: ${retryErr.message}`);
          }
        }

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const html = await response.text();
        
        // Parse HTML with cheerio
        const $ = cheerio.load(html);
        
        // Extract title
        const title = $('title').text() || url;

        // Extract main content (remove scripts, styles)
        $('script, style, noscript').remove();
        const mainText = $('body').text().replace(/\s+/g, ' ').trim();

        // Limit text length (max 100KB)
        const extractedText = mainText.substring(0, 100000);

        // Extract keywords and create summary
        const keywords = this.extractKeywordsFromText(extractedText);
        const summary = this.createSummary(extractedText);

        const result = {
          type: 'url',
          source: url,
          title: title,
          extractedText: extractedText,
          keywords: keywords.slice(0, 50), // Limit keywords
          summary: summary
        };

        // Store in database
        await this.referenceRepo.storeReferenceContent(sessionId, result);

        return result;
      })();

      return await Promise.race([fetchPromise, timeoutPromise]);
    } catch (error) {
      console.error(`Error processing URL ${url}:`, error);
      throw error;
    }
  }

  /**
   * Process a text reference
   * @param {number} sessionId - Session ID
   * @param {string} text - Text content
   * @returns {Promise<Object>} Processed text content
   */
  async processTextReference(sessionId, text) {
    try {
      // Validate text
      if (!text || typeof text !== 'string') {
        return null;
      }

      // Validate text length (max 100KB)
      if (text.length > 100000) {
        throw new Error('Text too long (max 100KB)');
      }

      // Extract keywords and create summary
      const keywords = this.extractKeywordsFromText(text);
      const summary = this.createSummary(text);

      const result = {
        type: 'text',
        source: 'text',
        extractedText: text,
        keywords: keywords.slice(0, 50), // Limit keywords
        summary: summary
      };

      // Store in database
      await this.referenceRepo.storeReferenceContent(sessionId, result);

      return result;
    } catch (error) {
      console.error('Error processing text reference:', error);
      return null;
    }
  }

  /**
   * Extract keywords from text
   * @param {string} text - Text content
   * @returns {Array<string>} Extracted keywords
   */
  extractKeywordsFromText(text) {
    if (!text) return [];

    // Simple keyword extraction (can be enhanced with NLP)
    const words = text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 4); // Filter short words

    // Count word frequency
    const wordFreq = {};
    words.forEach(word => {
      wordFreq[word] = (wordFreq[word] || 0) + 1;
    });

    // Get top keywords (by frequency)
    return Object.entries(wordFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 50)
      .map(([word]) => word);
  }

  /**
   * Create a summary from text
   * @param {string} text - Text content
   * @returns {string} Summary (first 200 chars)
   */
  createSummary(text) {
    if (!text) return '';
    return text.substring(0, 200).replace(/\s+/g, ' ').trim() + '...';
  }

  /**
   * Extract keywords from all references
   * @param {Array<Object>} references - Processed references
   * @returns {Array<string>} Combined keywords
   */
  extractKeywords(references) {
    const allKeywords = [];
    references.forEach(ref => {
      if (ref.keywords && Array.isArray(ref.keywords)) {
        allKeywords.push(...ref.keywords);
      }
    });

    // Deduplicate and return top keywords
    const uniqueKeywords = [...new Set(allKeywords)];
    return uniqueKeywords.slice(0, 100);
  }
}

module.exports = ReferenceProcessingService;
