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
      // Log input content being classified
      console.log(`[AIClassification] 🔍 Starting classification:`);
      console.log(`[AIClassification]   Detected Content:`);
      console.log(`[AIClassification]     - Domain: ${detectedContent.domain || 'N/A'}`);
      console.log(`[AIClassification]     - URL: ${detectedContent.url || 'N/A'}`);
      console.log(`[AIClassification]     - Window Title: ${detectedContent.windowTitle || 'N/A'}`);
      console.log(`[AIClassification]     - OCR Text: ${(detectedContent.ocrText || '').substring(0, 100)}${(detectedContent.ocrText || '').length > 100 ? '...' : ''}`);
      
      console.log(`[AIClassification]   Task Context:`);
      console.log(`[AIClassification]     - Task Name: ${taskContext.taskName || 'N/A'}`);
      console.log(`[AIClassification]     - Task Description: ${(taskContext.taskDescription || 'N/A').substring(0, 100)}${(taskContext.taskDescription || '').length > 100 ? '...' : ''}`);
      console.log(`[AIClassification]     - Keywords: ${(taskContext.keywords || []).slice(0, 10).join(', ')}${(taskContext.keywords || []).length > 10 ? '...' : ''}`);
      
      // Check cache (5s TTL)
      const cacheKey = `${detectedContent.domain || ''}_${detectedContent.windowTitle || ''}`;
      const cached = this.decisionCache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp) < 5000) {
        console.log(`[AIClassification] ✅ Using cached result (cache key: ${cacheKey})`);
        console.log(`[AIClassification]   Result: isDistraction=${cached.result.isDistraction}, confidence=${cached.result.confidence}, reason="${cached.result.reason}"`);
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
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          console.error(`[AIClassification] ⏰ TIMEOUT: Classification request exceeded ${this.config.timeout}ms timeout`);
          reject(new Error(`AI classification timeout after ${this.config.timeout}ms`));
        }, this.config.timeout);
      });

      const classificationPromise = this.performClassification(detectedContent, taskContext);

      console.log(`[AIClassification] 📤 Sending classification request to ${this.config.provider} (model: ${this.config.model})...`);
      console.log(`[AIClassification]   Timeout: ${this.config.timeout}ms`);
      const startTime = Date.now();
      
      let result;
      try {
        result = await Promise.race([classificationPromise, timeoutPromise]);
        const classificationTime = Date.now() - startTime;
        console.log(`[AIClassification] ⏱️ Classification promise resolved (${classificationTime}ms)`);
      } catch (error) {
        const classificationTime = Date.now() - startTime;
        console.error(`[AIClassification] ❌ Classification promise rejected after ${classificationTime}ms:`);
        console.error(`[AIClassification]   Error: ${error.message}`);
        console.error(`[AIClassification]   Stack: ${error.stack}`);
        throw error;
      }
      
      const classificationTime = Date.now() - startTime;

      // Reset circuit breaker on success
      this.circuitBreaker.failures = 0;
      this.circuitBreaker.isOpen = false;

      // Log AI classification result
      console.log(`[AIClassification] ✅ Classification complete (${classificationTime}ms):`);
      console.log(`[AIClassification]   Result: isDistraction=${result.isDistraction}`);
      console.log(`[AIClassification]   Confidence: ${result.confidence.toFixed(2)}`);
      console.log(`[AIClassification]   Reason: "${result.reason}"`);
      console.log(`[AIClassification]   Decision: ${result.isDistraction ? '🚫 DISTRACTION' : '✅ TASK-RELATED'}`);

      // Cache result
      this.decisionCache.set(cacheKey, {
        result: result,
        timestamp: Date.now()
      });

      return result;
    } catch (error) {
      console.error(`[AIClassification] ❌ AI classification error:`);
      console.error(`[AIClassification]   Error message: ${error.message}`);
      console.error(`[AIClassification]   Error type: ${error.constructor.name}`);
      if (error.stack) {
        console.error(`[AIClassification]   Stack trace:`, error.stack);
      }
      
      // Check if it's a connection/timeout error
      if (error.message.includes('timeout') || error.message.includes('ECONNREFUSED') || error.message.includes('fetch failed')) {
        console.error(`[AIClassification] ⚠️ Connection issue detected - is Ollama running at ${this.config.baseURL}?`);
      }
      
      // Increment circuit breaker failures
      this.circuitBreaker.failures++;
      this.circuitBreaker.lastFailure = Date.now();
      
      if (this.circuitBreaker.failures >= this.circuitBreaker.threshold) {
        this.circuitBreaker.isOpen = true;
        console.warn(`[AIClassification] 🔴 Circuit breaker opened due to ${this.circuitBreaker.failures} consecutive failures`);
      }

      // Fallback to default decision
      const defaultDecision = this.getDefaultDecision();
      console.log(`[AIClassification] 🔄 Using default decision:`, defaultDecision);
      return defaultDecision;
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

    console.log(`[AIClassification] 🔄 Starting classification with ${retries + 1} attempts...`);

    while (retries >= 0) {
      const attemptNumber = this.config.maxRetries - retries + 1;
      try {
        console.log(`[AIClassification]   Attempt ${attemptNumber}/${this.config.maxRetries + 1}...`);
        
        if (this.config.provider === 'ollama') {
          return await this.classifyWithOllama(detectedContent, taskContext);
        } else if (this.config.provider === 'openai') {
          return await this.classifyWithOpenAI(detectedContent, taskContext);
        } else {
          throw new Error(`Unknown provider: ${this.config.provider}`);
        }
      } catch (error) {
        lastError = error;
        console.error(`[AIClassification]   Attempt ${attemptNumber} failed: ${error.message}`);
        
        retries--;
        if (retries >= 0) {
          const backoffMs = 100 * (this.config.maxRetries - retries + 1);
          console.log(`[AIClassification]   Retrying in ${backoffMs}ms... (${retries} attempts remaining)`);
          // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, backoffMs));
        } else {
          console.error(`[AIClassification] ❌ All ${this.config.maxRetries + 1} attempts failed`);
        }
      }
    }

    console.error(`[AIClassification] ❌ Classification failed after all retries. Last error:`, lastError?.message);
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

    console.log(`[AIClassification] 🌐 Calling Ollama API: ${this.config.baseURL}/api/generate`);
    const requestStartTime = Date.now();
    
    try {
      // Quick connectivity check (optional, but helpful for debugging)
      const testUrl = `${this.config.baseURL}/api/tags`;
      try {
        const testResponse = await fetch(testUrl, { method: 'GET', signal: AbortSignal.timeout(2000) }).catch(() => null);
        if (!testResponse || !testResponse.ok) {
          console.warn(`[AIClassification] ⚠️ Ollama connectivity check failed - Ollama may not be running at ${this.config.baseURL}`);
        }
      } catch (testError) {
        // Ignore connectivity check errors, proceed with request
      }
      
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

      const requestTime = Date.now() - requestStartTime;
      console.log(`[AIClassification] 📡 Fetch completed (${requestTime}ms), status: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unable to read error response');
        console.error(`[AIClassification] ❌ Ollama API error: ${response.status} ${response.statusText}`);
        console.error(`[AIClassification]   Error details: ${errorText.substring(0, 200)}`);
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const text = data.response || '';

      console.log(`[AIClassification] 📥 Received response from Ollama (${text.length} chars)`);
      console.log(`[AIClassification]   Raw response preview: ${text.substring(0, 150)}${text.length > 150 ? '...' : ''}`);
      console.log(`[AIClassification]   Full response data keys:`, Object.keys(data));

      const parsedResult = this.parseResponse(text);
      console.log(`[AIClassification] 🔄 Parsed response:`, JSON.stringify(parsedResult, null, 2));

      return parsedResult;
    } catch (error) {
      const requestTime = Date.now() - requestStartTime;
      console.error(`[AIClassification] ❌ Error during Ollama API call (${requestTime}ms):`, error.message);
      console.error(`[AIClassification]   Error stack:`, error.stack);
      throw error;
    }
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
    console.log(`[AIClassification] 📝 Building classification prompt...`);
    
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
      console.log(`[AIClassification] ⚠️ Prompt truncated to 3000 characters`);
    }

    console.log(`[AIClassification] 📋 Prompt built (${prompt.length} chars)`);
    console.log(`[AIClassification]   Prompt preview: ${prompt.substring(0, 200)}...`);

    return prompt;
  }

  /**
   * Parse AI response
   * @param {string} text - Response text
   * @returns {Object} Parsed result
   */
  parseResponse(text) {
    try {
      console.log(`[AIClassification] 🔧 Parsing AI response...`);
      
      // Try to extract JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        console.log(`[AIClassification]   Found JSON in response`);
        const parsed = JSON.parse(jsonMatch[0]);
        const result = {
          isDistraction: parsed.isDistraction === true || parsed.isDistraction === 'true',
          confidence: Math.max(0, Math.min(1, parseFloat(parsed.confidence) || 0.7)),
          reason: parsed.reason || 'AI classification'
        };
        console.log(`[AIClassification]   Parsed JSON:`, JSON.stringify(result, null, 2));
        return result;
      }

      // Fallback: try to infer from text
      console.log(`[AIClassification]   No JSON found, inferring from text content`);
      const lowerText = text.toLowerCase();
      const isDistraction = lowerText.includes('yes') || lowerText.includes('distraction') || 
                           lowerText.includes('block') || lowerText.includes('blocked');
      
      const result = {
        isDistraction: isDistraction,
        confidence: 0.6,
        reason: 'AI classification (parsed from text)'
      };
      console.log(`[AIClassification]   Inferred result:`, result);
      return result;
    } catch (error) {
      console.error('[AIClassification] ❌ Error parsing AI response:', error);
      // Default to distraction if can't parse
      const fallbackResult = {
        isDistraction: true,
        confidence: 0.5,
        reason: 'AI classification failed, defaulting to distraction'
      };
      console.log(`[AIClassification]   Using fallback result:`, fallbackResult);
      return fallbackResult;
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
