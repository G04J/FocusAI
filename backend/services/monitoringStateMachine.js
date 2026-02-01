const EventEmitter = require('events');

/**
 * Monitoring State Machine
 * Manages state transitions: GREEN, YELLOW, AMBIGUOUS, RED
 */
class MonitoringStateMachine extends EventEmitter {
  constructor(stateRepository = null) {
    super();
    this.currentState = 'GREEN';
    this.previousState = null;
    this.stateLock = false;
    this.stateRepository = stateRepository;
    this.ambiguousTimer = null;
    this.ambiguousTimeout = 15000; // 15 seconds

    // State transition history
    this.transitions = [];

    // Load persisted state if available
    if (this.stateRepository) {
      this.loadPersistedState();
    }
  }

  /**
   * Get current state
   * @returns {string} Current state
   */
  getState() {
    return this.currentState;
  }

  /**
   * Get previous state
   * @returns {string|null} Previous state
   */
  getPreviousState() {
    return this.previousState;
  }

  /**
   * Transition to new state
   * @param {string} newState - New state (GREEN, YELLOW, AMBIGUOUS, RED)
   * @param {string} reason - Reason for transition
   * @returns {boolean} Success
   */
  transitionTo(newState, reason = '') {
    // Validate state
    const validStates = ['GREEN', 'YELLOW', 'AMBIGUOUS', 'RED'];
    if (!validStates.includes(newState)) {
      console.error(`Invalid state: ${newState}`);
      return false;
    }

    // Prevent race conditions
    if (this.stateLock) {
      console.warn('State transition locked, skipping');
      return false;
    }

    // Same state, no transition needed
    if (this.currentState === newState) {
      return true;
    }

    // Lock state during transition
    this.stateLock = true;

    try {
      // Store previous state
      this.previousState = this.currentState;

      // Clear AMBIGUOUS timer if transitioning away
      if (this.currentState === 'AMBIGUOUS' && newState !== 'AMBIGUOUS') {
        this.clearAmbiguousTimer();
      }

      // Update state
      this.currentState = newState;

      // Handle AMBIGUOUS timeout
      if (newState === 'AMBIGUOUS') {
        this.startAmbiguousTimer();
      }

      // Log transition
      const transition = {
        from: this.previousState,
        to: newState,
        reason: reason,
        timestamp: new Date().toISOString()
      };
      this.transitions.push(transition);

      // Emit event
      this.emit('stateChange', {
        from: this.previousState,
        to: newState,
        reason: reason
      });

      // Persist state
      if (this.stateRepository) {
        this.persistState();
      }

      // Unlock after short delay
      setTimeout(() => {
        this.stateLock = false;
      }, 100);

      return true;
    } catch (error) {
      console.error('Error during state transition:', error);
      this.stateLock = false;
      // Reset to GREEN on error
      if (this.currentState !== 'GREEN') {
        this.currentState = 'GREEN';
        this.previousState = null;
      }
      return false;
    }
  }

  /**
   * Start AMBIGUOUS timer (auto-escalate to RED after timeout)
   */
  startAmbiguousTimer() {
    this.clearAmbiguousTimer();

    this.ambiguousTimer = setTimeout(() => {
      if (this.currentState === 'AMBIGUOUS') {
        console.log('AMBIGUOUS state timeout, escalating to RED');
        this.transitionTo('RED', 'AMBIGUOUS timeout (15s)');
      }
    }, this.ambiguousTimeout);
  }

  /**
   * Clear AMBIGUOUS timer
   */
  clearAmbiguousTimer() {
    if (this.ambiguousTimer) {
      clearTimeout(this.ambiguousTimer);
      this.ambiguousTimer = null;
    }
  }

  /**
   * Persist state to repository
   */
  persistState() {
    if (!this.stateRepository) return;

    try {
      // This would be implemented in the repository
      // For now, just log
      console.log(`State persisted: ${this.currentState}`);
    } catch (error) {
      console.error('Error persisting state:', error);
    }
  }

  /**
   * Load persisted state from repository
   */
  loadPersistedState() {
    if (!this.stateRepository) return;

    try {
      // This would be implemented in the repository
      // For now, default to GREEN
      this.currentState = 'GREEN';
    } catch (error) {
      console.error('Error loading persisted state:', error);
      this.currentState = 'GREEN';
    }
  }

  /**
   * Reset state to GREEN
   */
  reset() {
    this.clearAmbiguousTimer();
    this.previousState = this.currentState;
    this.currentState = 'GREEN';
    this.stateLock = false;

    if (this.stateRepository) {
      this.persistState();
    }
  }

  /**
   * Get transition history
   * @returns {Array<Object>} Transition history
   */
  getTransitionHistory() {
    return [...this.transitions];
  }

  /**
   * Clear transition history
   */
  clearHistory() {
    this.transitions = [];
  }
}

module.exports = MonitoringStateMachine;
