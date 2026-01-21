/**
 * AI Classification Service
 * Uses LLM to determine if content is task-related or distraction
 */
class AIClassificationService {
  constructor(config = {}) {
    this.config = {
      provider: config.provider || 'ollama', // 'ollama' or 'openai'
      model: config.model || 'llama3.2:1b',
      baseURL: config.baseURL || 'http://localhost:11434',
      apiKey: config.apiKey || null,
      timeout: config.timeout || 30000, // 30s
      maxRetries: config.maxRetries || 2
    };
    
    this.circuitBreaker = {
      failures: 0,
      threshold: 5,
      retryAfter: 60000, // 1 minute
      isOpen: false,
      lastFailure: 0
    };

    this.decisionCache = new Map(); // Cache decisions (5s TTL)
  }

  /**
   * Classify content as distraction or task-related
   * @param {Object} detectedContent - Detected content {domain, url, windowTitle, ocrText}
   * @param {Object} taskContext - Task context {taskName, taskDescription, referenceContent, keywords}
   * @returns {Promise<Object>} Classification result {isDistraction, confidence, reason}
   */
  async classifyContent(detectedContent, taskContext) {
    try {
      // Check cache (5s TTL)
      const cacheKey = `${detectedContent.domain || ''}_${detectedContent.windowTitle || ''}`;
      const cached = this.decisionCache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp) < 5000) {
        return cached.result;
      }

      // Check circuit breaker
      if (this.circuitBreaker.isOpen) {
        const timeSinceLastFailure = Date.now() - this.circuitBreaker.lastFailure;
        if (timeSinceLastFailure < this.circuitBreaker.retryAfter) {
          // Circuit breaker is open, use default
          return this.getDefaultDecision();
        } else {
          // Try again
          this.circuitBreaker.isOpen = false;
          this.circuitBreaker.failures = 0;
        }
      }

      // Timeout wrapper
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('AI classification timeout')), this.config.timeout)
      );

      const classificationPromise = this.performClassification(detectedContent, taskContext);

      const result = await Promise.race([classificationPromise, timeoutPromise]);

      // Reset circuit breaker on success
      this.circuitBreaker.failures = 0;
      this.circuitBreaker.isOpen = false;

      // Cache result
      this.decisionCache.set(cacheKey, {
        result: result,
        timestamp: Date.now()
      });

      return result;
    } catch (error) {
      console.error('AI classification error:', error);
      
      // Increment circuit breaker failures
      this.circuitBreaker.failures++;
      this.circuitBreaker.lastFailure = Date.now();
      
      if (this.circuitBreaker.failures >= this.circuitBreaker.threshold) {
        this.circuitBreaker.isOpen = true;
        console.warn('Circuit breaker opened due to consecutive failures');
      }

      // Fallback to default decision
      return this.getDefaultDecision();
    }
  }

  /**
   * Perform classification with retry logic
   * @param {Object} detectedContent - Detected content
   * @param {Object} taskContext - Task context
   * @returns {Promise<Object>} Classification result
   */
  async performClassification(detectedContent, taskContext) {
    let lastError;
    let retries = this.config.maxRetries;

    while (retries >= 0) {
      try {
        if (this.config.provider === 'ollama') {
          return await this.classifyWithOllama(detectedContent, taskContext);
        } else if (this.config.provider === 'openai') {
          return await this.classifyWithOpenAI(detectedContent, taskContext);
        } else {
          throw new Error(`Unknown provider: ${this.config.provider}`);
        }
      } catch (error) {
        lastError = error;
        retries--;
        if (retries >= 0) {
          // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, 100 * (this.config.maxRetries - retries + 1)));
        }
      }
    }

    throw lastError;
  }

  /**
   * Classify using Ollama
   * @param {Object} detectedContent - Detected content
   * @param {Object} taskContext - Task context
   * @returns {Promise<Object>} Classification result
   */
  async classifyWithOllama(detectedContent, taskContext) {
    const prompt = this.buildPrompt(detectedContent, taskContext);

    const response = await fetch(`${this.config.baseURL}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.config.model,
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.7,
          max_tokens: 200
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }

    const data = await response.json();
    const text = data.response || '';

    return this.parseResponse(text);
  }

  /**
   * Classify using OpenAI
   * @param {Object} detectedContent - Detected content
   * @param {Object} taskContext - Task context
   * @returns {Promise<Object>} Classification result
   */
  async classifyWithOpenAI(detectedContent, taskContext) {
    const prompt = this.buildPrompt(detectedContent, taskContext);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`
      },
      body: JSON.stringify({
        model: this.config.model || 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a focus assistant. Respond with JSON: {"isDistraction": boolean, "confidence": number, "reason": string}'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 200
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    const text = data.choices[0]?.message?.content || '';

    return this.parseResponse(text);
  }

  /**
   * Build classification prompt
   * @param {Object} detectedContent - Detected content
   * @param {Object} taskContext - Task context
   * @returns {string} Prompt
   */
  buildPrompt(detectedContent, taskContext) {
    let prompt = `You are a focus assistant helping a user stay focused on their task.

TASK: ${taskContext.taskName}
DESCRIPTION: ${taskContext.taskDescription || 'No description'}

REFERENCE MATERIALS (for context understanding):
`;

    // Add PDF summaries
    if (taskContext.referenceContent?.pdfs) {
      prompt += 'PDFs:\n';
      taskContext.referenceContent.pdfs.forEach((pdf, idx) => {
        prompt += `${idx + 1}. ${pdf.summary}\n`;
      });
    }

    // Add URL summaries
    if (taskContext.referenceContent?.urls) {
      prompt += '\nURLs:\n';
      taskContext.referenceContent.urls.forEach((url, idx) => {
        prompt += `${idx + 1}. ${url.title}: ${url.summary}\n`;
      });
    }

    // Add text references
    if (taskContext.referenceContent?.texts) {
      prompt += '\nTexts:\n';
      taskContext.referenceContent.texts.forEach((text, idx) => {
        prompt += `${idx + 1}. ${text.text}\n`;
      });
    }

    // Add keywords
    if (taskContext.keywords && taskContext.keywords.length > 0) {
      prompt += `\nKEY CONCEPTS/KEYWORDS: ${taskContext.keywords.slice(0, 20).join(', ')}\n`;
    }

    // Add current content
    prompt += `\nCURRENT CONTENT:
- Domain: ${detectedContent.domain || 'Unknown'}
- URL: ${detectedContent.url || 'Unknown'}
- Title: ${detectedContent.windowTitle || 'Unknown'}
- Visible Text: ${(detectedContent.ocrText || '').substring(0, 200)}

Question: Is this current content related to the task or a distraction?

Consider:
- Does it relate to the reference materials provided?
- Does it help with the task described?
- Is it educational/productive content related to the task domain?
- Or is it entertainment/social media/shopping/off-task content?

Respond with JSON format:
{
  "isDistraction": true/false,
  "confidence": 0.0-1.0,
  "reason": "brief explanation"
}`;

    // Truncate if too long (max 4000 tokens ≈ 3000 chars)
    if (prompt.length > 3000) {
      prompt = prompt.substring(0, 3000) + '...';
    }

    return prompt;
  }

  /**
   * Parse AI response
   * @param {string} text - Response text
   * @returns {Object} Parsed result
   */
  parseResponse(text) {
    try {
      // Try to extract JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          isDistraction: parsed.isDistraction === true || parsed.isDistraction === 'true',
          confidence: Math.max(0, Math.min(1, parseFloat(parsed.confidence) || 0.7)),
          reason: parsed.reason || 'AI classification'
        };
      }

      // Fallback: try to infer from text
      const lowerText = text.toLowerCase();
      const isDistraction = lowerText.includes('yes') || lowerText.includes('distraction') || 
                           lowerText.includes('block') || lowerText.includes('blocked');
      
      return {
        isDistraction: isDistraction,
        confidence: 0.6,
        reason: 'AI classification (parsed from text)'
      };
    } catch (error) {
      console.error('Error parsing AI response:', error);
      // Default to distraction if can't parse
      return {
        isDistraction: true,
        confidence: 0.5,
        reason: 'AI classification failed, defaulting to distraction'
      };
    }
  }

  /**
   * Get default decision (fallback)
   * @returns {Object} Default decision
   */
  getDefaultDecision() {
    return {
      isDistraction: true, // Safe default
      confidence: 0.5,
      reason: 'AI unavailable, defaulting to distraction'
    };
  }

  /**
   * Clear decision cache
   */
  clearCache() {
    this.decisionCache.clear();
  }
}

module.exports = AIClassificationService;
