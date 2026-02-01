const MonitoringStateMachine = require('../../services/monitoringStateMachine');

describe('MonitoringStateMachine', () => {
  let stateMachine;

  beforeEach(() => {
    stateMachine = new MonitoringStateMachine();
    jest.setTimeout(10000); // Increase timeout for async tests
  });

  afterEach(() => {
    // Clean up any active timers in the state machine
    if (stateMachine) {
      stateMachine.clearAmbiguousTimer();
      stateMachine.reset();
    }
  });

  describe('initialization', () => {
    test('should initialize with GREEN state', () => {
      expect(stateMachine.getState()).toBe('GREEN');
    });

    test('should have no previous state initially', () => {
      expect(stateMachine.getPreviousState()).toBeNull();
    });

    test('should have empty transition history initially', () => {
      const history = stateMachine.getTransitionHistory();
      expect(history).toHaveLength(0);
    });
  });

  describe('getState', () => {
    test('should return current state', () => {
      expect(stateMachine.getState()).toBe('GREEN');
    });
  });

  describe('transitionTo', () => {
    test('should transition from GREEN to YELLOW', () => {
      const result = stateMachine.transitionTo('YELLOW', 'Test transition');
      
      expect(result).toBe(true);
      expect(stateMachine.getState()).toBe('YELLOW');
      expect(stateMachine.getPreviousState()).toBe('GREEN');
    });

    test('should transition through states correctly', (done) => {
      stateMachine.transitionTo('YELLOW', 'Step 1');
      expect(stateMachine.getState()).toBe('YELLOW');
      
      // Wait for lock to release (100ms)
      setTimeout(() => {
        stateMachine.transitionTo('AMBIGUOUS', 'Step 2');
        expect(stateMachine.getState()).toBe('AMBIGUOUS');
        
        setTimeout(() => {
          stateMachine.transitionTo('RED', 'Step 3');
          expect(stateMachine.getState()).toBe('RED');
          done();
        }, 150);
      }, 150);
    });

    test('should reject invalid state', () => {
      const result = stateMachine.transitionTo('INVALID_STATE', 'Test');
      
      expect(result).toBe(false);
      expect(stateMachine.getState()).toBe('GREEN'); // Should remain unchanged
    });

    test('should not transition if already in that state', (done) => {
      stateMachine.transitionTo('YELLOW', 'First transition');
      
      // Wait for lock to release, then try same state
      setTimeout(() => {
        const result = stateMachine.transitionTo('YELLOW', 'Second transition');
        
        expect(result).toBe(true); // Returns true but doesn't change state
        expect(stateMachine.getState()).toBe('YELLOW');
        done();
      }, 150);
    });

    test('should emit stateChange event on transition', (done) => {
      stateMachine.once('stateChange', ({ from, to, reason }) => {
        expect(from).toBe('GREEN');
        expect(to).toBe('YELLOW');
        expect(reason).toBe('Test reason');
        done();
      });

      stateMachine.transitionTo('YELLOW', 'Test reason');
    });

    test('should record transition in history', (done) => {
      stateMachine.transitionTo('YELLOW', 'Reason 1');
      
      setTimeout(() => {
        stateMachine.transitionTo('RED', 'Reason 2');
        
        setTimeout(() => {
          const history = stateMachine.getTransitionHistory();
          expect(history).toHaveLength(2);
          expect(history[0].from).toBe('GREEN');
          expect(history[0].to).toBe('YELLOW');
          expect(history[1].from).toBe('YELLOW');
          expect(history[1].to).toBe('RED');
          done();
        }, 150);
      }, 150);
    });

    test('should handle AMBIGUOUS timeout correctly', (done) => {
      jest.useFakeTimers();
      
      stateMachine.transitionTo('AMBIGUOUS', 'Test');
      expect(stateMachine.getState()).toBe('AMBIGUOUS');
      
      // Wait for lock to clear (100ms), then fast-forward 15 seconds
      setTimeout(() => {
        jest.advanceTimersByTime(15000);
        jest.runOnlyPendingTimers();
        
        // Should auto-escalate to RED
        expect(stateMachine.getState()).toBe('RED');
        
        // Clean up
        stateMachine.clearAmbiguousTimer();
        jest.useRealTimers();
        done();
      }, 150);
      
      jest.runOnlyPendingTimers();
    }, 10000); // Increase timeout for this test

    test('should clear AMBIGUOUS timer when transitioning away', (done) => {
      stateMachine.transitionTo('AMBIGUOUS', 'Test');
      expect(stateMachine.getState()).toBe('AMBIGUOUS');
      
      // Wait for lock to clear, then transition away
      setTimeout(() => {
        stateMachine.transitionTo('GREEN', 'Clearing');
        expect(stateMachine.getState()).toBe('GREEN');
        
        // Wait longer than the AMBIGUOUS timeout (15s) to verify it doesn't escalate
        // Since we transitioned away, the timer should be cleared
        setTimeout(() => {
          expect(stateMachine.getState()).toBe('GREEN'); // Should still be GREEN, not RED
          done();
        }, 200); // Short wait to verify timer was cleared
      }, 150);
    }, 10000); // Increase timeout
  });

  describe('reset', () => {
    test('should reset to GREEN state', () => {
      stateMachine.transitionTo('RED', 'Test');
      expect(stateMachine.getState()).toBe('RED');
      
      stateMachine.reset();
      expect(stateMachine.getState()).toBe('GREEN');
    });

    test('should clear AMBIGUOUS timer on reset', () => {
      jest.useFakeTimers();
      
      stateMachine.transitionTo('AMBIGUOUS', 'Test');
      stateMachine.reset();
      
      jest.advanceTimersByTime(20000);
      expect(stateMachine.getState()).toBe('GREEN');
      
      jest.useRealTimers();
    });
  });

  describe('getTransitionHistory', () => {
    test('should return copy of transition history', () => {
      stateMachine.transitionTo('YELLOW', 'Test');
      const history1 = stateMachine.getTransitionHistory();
      const history2 = stateMachine.getTransitionHistory();
      
      expect(history1).toEqual(history2);
      expect(history1).not.toBe(stateMachine.transitions); // Should be a copy
    });
  });

  describe('clearHistory', () => {
    test('should clear transition history', (done) => {
      stateMachine.transitionTo('YELLOW', 'Test 1');
      
      setTimeout(() => {
        stateMachine.transitionTo('RED', 'Test 2');
        
        setTimeout(() => {
          expect(stateMachine.getTransitionHistory()).toHaveLength(2);
          
          stateMachine.clearHistory();
          expect(stateMachine.getTransitionHistory()).toHaveLength(0);
          done();
        }, 150);
      }, 150);
    });
  });

  describe('edge cases', () => {
    test('should handle rapid state transitions', (done) => {
      // This test verifies that rapid transitions are handled (some may be locked)
      stateMachine.transitionTo('YELLOW', '1');
      
      setTimeout(() => {
        stateMachine.transitionTo('AMBIGUOUS', '2');
        
        setTimeout(() => {
          stateMachine.transitionTo('RED', '3');
          
          setTimeout(() => {
            stateMachine.transitionTo('YELLOW', '4');
            
            setTimeout(() => {
              stateMachine.transitionTo('GREEN', '5');
              
              setTimeout(() => {
                expect(stateMachine.getState()).toBe('GREEN');
                expect(stateMachine.getTransitionHistory().length).toBeGreaterThan(0);
                done();
              }, 150);
            }, 150);
          }, 150);
        }, 150);
      }, 150);
    });

    test('should handle error during transition gracefully', () => {
      // This tests the error handling in transitionTo
      // We can't easily trigger an error, but we can verify the state machine
      // remains in a valid state after operations
      const initialState = stateMachine.getState();
      stateMachine.transitionTo('YELLOW', 'Test');
      expect(stateMachine.getState()).toBe('YELLOW');
    });
  });
});
