/**
 * Task Context Service
 * Load and provide task context from processed references for AI decision-making
 */
class TaskContextService {
  constructor(referenceRepository, sessionRepository) {
    this.referenceRepo = referenceRepository;
    this.sessionRepo = sessionRepository;
    // Cache for task context
    this.contextCache = new Map();
  }

  /**
   * Get comprehensive task context for a session
   * @param {number} sessionId - Session ID
   * @returns {Object} Task context object
   */
  getTaskContext(sessionId) {
    // Check cache first
    if (this.contextCache.has(sessionId)) {
      return this.contextCache.get(sessionId);
    }

    // Load session data
    const session = this.sessionRepo.findById(sessionId);
    if (!session) {
      return null;
    }

    // Load processed reference content
    const references = this.referenceRepo.getSessionReferences(sessionId);

    // Combine all processed content
    const pdfSummaries = references
      .filter(ref => ref.type === 'pdf')
      .map(ref => ({
        source: ref.source,
        summary: ref.summary,
        keywords: ref.keywords
      }));

    const urlSummaries = references
      .filter(ref => ref.type === 'url')
      .map(ref => ({
        url: ref.source,
        title: ref.title || ref.source,
        summary: ref.summary,
        keywords: ref.keywords
      }));

    const textReferences = references
      .filter(ref => ref.type === 'text')
      .map(ref => ({
        text: ref.processedContent.substring(0, 500), // Limit text
        keywords: ref.keywords
      }));

    // Extract keywords from all references
    const allKeywords = this.extractKeywords(references);

    // Combine all reference content for AI
    const processedReferenceContent = {
      pdfs: pdfSummaries,
      urls: urlSummaries,
      texts: textReferences
    };

    // Create context summary
    const contextSummary = this.createContextSummary(
      session,
      processedReferenceContent,
      allKeywords
    );

    const context = {
      taskName: session.task_name,
      taskDescription: session.task_description || '',
      referenceContent: processedReferenceContent,
      keywords: allKeywords,
      domain: this.extractDomain(allKeywords, urlSummaries),
      contextSummary: contextSummary
    };

    // Cache for 5 minutes
    this.contextCache.set(sessionId, context);
    setTimeout(() => this.contextCache.delete(sessionId), 5 * 60 * 1000);

    return context;
  }

  /**
   * Extract keywords from references
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

  /**
   * Extract domain from keywords and URLs
   * @param {Array<string>} keywords - Keywords
   * @param {Array<Object>} urlSummaries - URL summaries
   * @returns {string} Domain name
   */
  extractDomain(keywords, urlSummaries) {
    // Try to extract domain from URLs
    if (urlSummaries.length > 0) {
      const firstUrl = urlSummaries[0].url;
      try {
        const urlObj = new URL(firstUrl);
        return urlObj.hostname.replace('www.', '');
      } catch (e) {
        // Invalid URL, skip
      }
    }

    // Try to infer domain from keywords (heuristic)
    const domainKeywords = keywords.filter(kw => 
      kw.includes('programming') || kw.includes('javascript') || 
      kw.includes('python') || kw.includes('web') || kw.includes('development')
    );

    if (domainKeywords.length > 0) {
      return 'development'; // Generic domain
    }

    return 'general';
  }

  /**
   * Create context summary for AI
   * @param {Object} session - Session object
   * @param {Object} referenceContent - Processed reference content
   * @param {Array<string>} keywords - Keywords
   * @returns {string} Context summary
   */
  createContextSummary(session, referenceContent, keywords) {
    let summary = `Task: ${session.task_name}\n`;
    
    if (session.task_description) {
      summary += `Description: ${session.task_description}\n`;
    }

    if (referenceContent.pdfs.length > 0) {
      summary += `\nReference PDFs (${referenceContent.pdfs.length}):\n`;
      referenceContent.pdfs.forEach((pdf, idx) => {
        summary += `${idx + 1}. ${pdf.summary}\n`;
      });
    }

    if (referenceContent.urls.length > 0) {
      summary += `\nReference URLs (${referenceContent.urls.length}):\n`;
      referenceContent.urls.forEach((url, idx) => {
        summary += `${idx + 1}. ${url.title}: ${url.summary}\n`;
      });
    }

    if (referenceContent.texts.length > 0) {
      summary += `\nReference Texts (${referenceContent.texts.length}):\n`;
      referenceContent.texts.forEach((text, idx) => {
        summary += `${idx + 1}. ${text.text}\n`;
      });
    }

    if (keywords.length > 0) {
      summary += `\nKey Concepts: ${keywords.slice(0, 20).join(', ')}\n`;
    }

    return summary;
  }

  /**
   * Clear cache for a session
   * @param {number} sessionId - Session ID
   */
  clearCache(sessionId) {
    this.contextCache.delete(sessionId);
  }
}

module.exports = TaskContextService;
