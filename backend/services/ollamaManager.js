/**
 * Ollama Manager Service
 * Automatically manages Ollama installation and startup
 * No user setup required!
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

class OllamaManager {
  constructor(config = {}) {
    this.config = {
      baseURL: config.baseURL || 'http://localhost:11434',
      model: config.model || 'llama3.2:1b',
      checkInterval: config.checkInterval || 5000, // 5 seconds
      startupTimeout: config.startupTimeout || 30000 // 30 seconds
    };
    
    this.ollamaProcess = null;
    this.isRunning = false;
    this.isInitialized = false;
    this.checkIntervalId = null;
    this.startupPromise = null;
  }

  /**
   * Initialize Ollama - check if running, start if needed, ensure model exists
   * @returns {Promise<boolean>} True if Ollama is ready
   */
  async initialize() {
    if (this.isInitialized) {
      return true;
    }

    try {
      console.log('🔄 Initializing Ollama...');
      
      // Check if Ollama is already running
      const isAlreadyRunning = await this.checkOllamaRunning();
      
      if (isAlreadyRunning) {
        console.log('✓ Ollama is already running');
        this.isRunning = true;
        this.isInitialized = true;
        await this.ensureModelExists();
        return true;
      }

      // Try to start Ollama
      console.log('🔄 Starting Ollama...');
      await this.startOllama();
      
      // Ensure model exists
      await this.ensureModelExists();
      
      // Start periodic health checks
      this.startHealthCheck();
      
      this.isInitialized = true;
      console.log('✓ Ollama initialized and ready');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize Ollama:', error.message);
      console.warn('⚠️  AI classification will use fallback mode');
      return false;
    }
  }

  /**
   * Check if Ollama API is responding
   * @returns {Promise<boolean>}
   */
  async checkOllamaRunning() {
    try {
      const response = await fetch(`${this.config.baseURL}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(2000) // 2 second timeout
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  /**
   * Start Ollama server process
   * @returns {Promise<void>}
   */
  async startOllama() {
    return new Promise(async (resolve, reject) => {
      try {
        // Check if ollama command exists
        const ollamaPath = await this.findOllamaBinary();
        
        if (!ollamaPath) {
          reject(new Error(
            'Ollama not found. Please install Ollama from https://ollama.ai\n' +
            'For automatic setup, you can bundle Ollama with your Electron app later.'
          ));
          return;
        }

        // Start ollama serve
        console.log(`🔄 Starting Ollama from: ${ollamaPath}`);
        
        this.ollamaProcess = spawn(ollamaPath, ['serve'], {
          detached: false,
          stdio: 'ignore' // Suppress output to keep console clean
        });

        this.ollamaProcess.on('error', (error) => {
          console.error('Failed to start Ollama:', error);
          reject(error);
        });

        this.ollamaProcess.on('exit', (code) => {
          if (code !== 0 && code !== null) {
            console.warn(`Ollama process exited with code ${code}`);
          }
          this.ollamaProcess = null;
          this.isRunning = false;
        });

        // Wait for Ollama to be ready
        const startTime = Date.now();
        const checkReady = setInterval(async () => {
          if (await this.checkOllamaRunning()) {
            clearInterval(checkReady);
            this.isRunning = true;
            console.log('✓ Ollama server is ready');
            resolve();
          } else if (Date.now() - startTime > this.config.startupTimeout) {
            clearInterval(checkReady);
            reject(new Error('Ollama failed to start within timeout'));
          }
        }, 1000); // Check every second

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Find Ollama binary in system PATH or common locations
   * @returns {Promise<string|null>}
   */
  async findOllamaBinary() {
    return new Promise((resolve) => {
      // Try to find ollama in PATH
      const command = process.platform === 'win32' ? 'where ollama' : 'which ollama';
      const { exec } = require('child_process');
      
      exec(command, (error, stdout) => {
        if (!error && stdout.trim()) {
          resolve(stdout.trim().split('\n')[0]);
          return;
        }
        
        // Check common installation locations
        const commonPaths = this.getCommonOllamaPaths();
        for (const commonPath of commonPaths) {
          if (fs.existsSync(commonPath)) {
            resolve(commonPath);
            return;
          }
        }
        
        resolve(null);
      });
    });
  }

  /**
   * Get common Ollama installation paths by platform
   * @returns {string[]}
   */
  getCommonOllamaPaths() {
    const platform = process.platform;
    const homeDir = os.homedir();

    if (platform === 'darwin') {
      // macOS
      return [
        '/usr/local/bin/ollama',
        '/opt/homebrew/bin/ollama',
        path.join(homeDir, '.local', 'bin', 'ollama')
      ];
    } else if (platform === 'win32') {
      // Windows
      const appData = process.env.APPDATA || path.join(homeDir, 'AppData', 'Roaming');
      return [
        path.join(appData, 'Ollama', 'ollama.exe'),
        'C:\\Program Files\\Ollama\\ollama.exe',
        'C:\\Program Files (x86)\\Ollama\\ollama.exe'
      ];
    } else {
      // Linux
      return [
        '/usr/local/bin/ollama',
        '/usr/bin/ollama',
        path.join(homeDir, '.local', 'bin', 'ollama')
      ];
    }
  }

  /**
   * Ensure the required model exists
   * @returns {Promise<void>}
   */
  async ensureModelExists() {
    try {
      console.log(`🔄 Checking for model: ${this.config.model}`);
      
      // Check if model exists
      const response = await fetch(`${this.config.baseURL}/api/tags`);
      if (!response.ok) {
        throw new Error('Failed to fetch models');
      }

      const data = await response.json();
      const models = data.models || [];
      const modelExists = models.some(m => m.name === this.config.model);

      if (modelExists) {
        console.log(`✓ Model ${this.config.model} is available`);
        return;
      }

      // Pull the model
      console.log(`📥 Pulling model ${this.config.model}...`);
      await this.pullModel(this.config.model);
      console.log(`✓ Model ${this.config.model} is ready`);
    } catch (error) {
      console.warn(`⚠️  Could not ensure model exists: ${error.message}`);
      // Don't fail initialization, model will be pulled on first use
    }
  }

  /**
   * Pull a model from Ollama
   * @param {string} modelName
   * @returns {Promise<void>}
   */
  async pullModel(modelName) {
    const response = await fetch(`${this.config.baseURL}/api/pull`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: modelName,
        stream: false
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to pull model: ${response.statusText}`);
    }

    // Wait for pull to complete (it's a stream, but we set stream: false)
    const data = await response.json();
    return data;
  }

  /**
   * Start periodic health check
   */
  startHealthCheck() {
    if (this.checkIntervalId) {
      return;
    }

    this.checkIntervalId = setInterval(async () => {
      const isRunning = await this.checkOllamaRunning();
      
      if (!isRunning && this.ollamaProcess) {
        // Process died, try to restart
        console.warn('⚠️  Ollama process appears to have stopped, attempting restart...');
        this.isRunning = false;
        try {
          await this.startOllama();
        } catch (error) {
          console.error('Failed to restart Ollama:', error.message);
        }
      }
    }, this.config.checkInterval);
  }

  /**
   * Stop Ollama process (if we started it)
   */
  stop() {
    if (this.checkIntervalId) {
      clearInterval(this.checkIntervalId);
      this.checkIntervalId = null;
    }

    if (this.ollamaProcess) {
      console.log('🛑 Stopping Ollama...');
      this.ollamaProcess.kill();
      this.ollamaProcess = null;
      this.isRunning = false;
    }
    
    this.isInitialized = false;
  }

  /**
   * Get Ollama status
   * @returns {Object}
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      isInitialized: this.isInitialized,
      baseURL: this.config.baseURL,
      model: this.config.model
    };
  }
}

module.exports = OllamaManager;
