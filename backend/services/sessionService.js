const Validators = require('../utils/validators');

class SessionService {
  constructor(sessionRepository, referenceProcessingService = null, sessionMonitor = null) {
    this.sessionRepo = sessionRepository;
    this.referenceProcessingService = referenceProcessingService;
    this.sessionMonitor = sessionMonitor;
  }

  createSession(userId, sessionData) {
    // Validate input using Validators class
    const validation = Validators.validateSessionData(sessionData);
    
    if (!validation.isValid) {
      return {
        success: false,
        error: validation.errors.join(', ')
      };
    }

    // Create session
    const session = {
      user_id: userId,
      task_name: sessionData.taskName.trim(),
      task_description: sessionData.taskDescription ? sessionData.taskDescription.trim() : null,
      duration_minutes: sessionData.durationMinutes,
      reference_type: sessionData.referenceType || null,
      reference_url: sessionData.referenceUrl || null,
      reference_file_path: sessionData.referenceFilePath || null,
      reference_text: sessionData.referenceText || null
    };

    const result = this.sessionRepo.create(session);

    if (result.success) {
      const createdSession = this.sessionRepo.findById(result.sessionId);
      
      // Process references asynchronously (don't block session creation)
      if (this.referenceProcessingService && createdSession) {
        this.referenceProcessingService.processSessionReferences(result.sessionId, createdSession)
          .catch(error => {
            console.error('Error processing references:', error);
          });
      }
      
      // Return the full session with the ID
      return {
        success: true,
        session: createdSession
      };
    }

    return {
      success: false,
      error: 'Failed to create session'
    };
  }

  getUserSessions(userId, status = null) {
    const sessions = this.sessionRepo.findByUserId(userId, status);
    return {
      success: true,
      sessions: sessions
    };
  }

  getSession(sessionId) {
    const session = this.sessionRepo.findById(sessionId);
    if (!session) {
      return { success: false, error: 'Session not found' };
    }
    return {
      success: true,
      session: session
    };
  }

  startSession(sessionId) {
    const session = this.sessionRepo.findById(sessionId);
    
    if (!session) {
      return { success: false, error: 'Session not found' };
    }

    if (session.status === 'active') {
      return { success: false, error: 'Session already active' };
    }

    if (session.status === 'completed') {
      return { success: false, error: 'Cannot start completed session' };
    }

    // Check if user has another active session
    const activeSession = this.sessionRepo.getActiveSession(session.user_id);
    if (activeSession) {
      return { 
        success: false, 
        error: 'Another session is already active. Please stop it first.' 
      };
    }

    // Update status to active
    const now = new Date().toISOString();
    const result = this.sessionRepo.updateStatus(sessionId, 'active', now);

    if (result.success) {
      // Start monitoring if available
      console.log(`[SessionService] Checking sessionMonitor availability:`, {
        hasSessionMonitor: !!this.sessionMonitor,
        sessionMonitorType: typeof this.sessionMonitor,
        sessionId: sessionId
      });
      
      if (this.sessionMonitor) {
        console.log(`[SessionService] Starting monitoring for session ${sessionId}`);
        this.sessionMonitor.start(sessionId)
          .then(() => {
            console.log(`[SessionService] ✅ Monitoring successfully started for session ${sessionId}`);
          })
          .catch(error => {
            console.error(`[SessionService] ❌ Error starting monitoring for session ${sessionId}:`, error);
            console.error(`[SessionService] Error stack:`, error.stack);
            // Don't fail the session start, but log the error
          });
      } else {
        console.warn(`[SessionService] ⚠️ sessionMonitor not available for session ${sessionId}`);
        console.warn(`[SessionService] Monitoring will not be active for this session`);
      }
      
      return {
        success: true,
        message: 'Session started',
        session: this.sessionRepo.findById(sessionId)
      };
    }

    return result;
  }

  stopSession(sessionId) {
    const session = this.sessionRepo.findById(sessionId);
    
    if (!session) {
      return { success: false, error: 'Session not found' };
    }

    if (session.status !== 'active' && session.status !== 'paused') {
      return { success: false, error: 'Session is not active or paused' };
    }

    // Update status to stopped (user manually ended it)
    const now = new Date().toISOString();
    const result = this.sessionRepo.updateStatus(sessionId, 'stopped', now);

    if (result.success) {
      // Stop monitoring if available
      if (this.sessionMonitor) {
        this.sessionMonitor.stop();
      }
      
      return {
        success: true,
        message: 'Session stopped',
        session: this.sessionRepo.findById(sessionId)
      };
    }

    return result;
  }

  completeSession(sessionId) {
    // New method for when session naturally completes (timer runs out)
    const session = this.sessionRepo.findById(sessionId);
    
    if (!session) {
      return { success: false, error: 'Session not found' };
    }

    if (session.status !== 'active') {
      return { success: false, error: 'Session is not active' };
    }

    const now = new Date().toISOString();
    const result = this.sessionRepo.updateStatus(sessionId, 'completed', now);

    if (result.success) {
      return {
        success: true,
        message: 'Session completed',
        session: this.sessionRepo.findById(sessionId)
      };
    }

    return result;
  }

  pauseSession(sessionId) {
    const session = this.sessionRepo.findById(sessionId);
    
    if (!session) {
      return { success: false, error: 'Session not found' };
    }

    if (session.status !== 'active') {
      return { success: false, error: 'Session is not active' };
    }

    // Store the pause timestamp
    const now = new Date().toISOString();
    const result = this.sessionRepo.updateStatus(sessionId, 'paused', now);
    
    if (result.success) {
      // Pause monitoring if available
      if (this.sessionMonitor) {
        this.sessionMonitor.pause();
      }
      
      return {
        success: true,
        message: 'Session paused',
        session: this.sessionRepo.findById(sessionId)
      };
    }

    return result;
  }

  resumeSession(sessionId) {
    const session = this.sessionRepo.findById(sessionId);
    
    if (!session) {
      return { success: false, error: 'Session not found' };
    }

    if (session.status !== 'paused') {
      return { success: false, error: 'Session is not paused' };
    }

    // Check if user has a DIFFERENT active session
    const activeSession = this.sessionRepo.getActiveSession(session.user_id);
    if (activeSession && activeSession.id !== sessionId) {
      return { 
        success: false, 
        error: 'Another session is already active. Please stop it first.' 
      };
    }

    // Calculate elapsed time at pause
    if (session.paused_at && session.started_at) {
      const startTime = new Date(session.started_at).getTime();
      const pauseTime = new Date(session.paused_at).getTime();
      const elapsedAtPause = pauseTime - startTime; // milliseconds
      
      // Adjust started_at so timer continues from where it paused
      // New started_at = current_time - elapsed_at_pause
      const now = Date.now();
      const adjustedStartTime = new Date(now - elapsedAtPause).toISOString();
      
      // Update status to active and adjust started_at
      const result = this.sessionRepo.update(sessionId, {
        status: 'active',
        started_at: adjustedStartTime,
        paused_at: null
      });
      
      if (result.success) {
        // Start or resume monitoring if available
        if (this.sessionMonitor) {
          const monitorState = this.sessionMonitor.getState();
          if (monitorState && monitorState.isMonitoring) {
            console.log(`[SessionService] Resuming monitoring for session ${sessionId}`);
            this.sessionMonitor.resume();
          } else {
            console.log(`[SessionService] Starting monitoring for resumed session ${sessionId}`);
            this.sessionMonitor.start(sessionId)
              .then(() => {
                console.log(`[SessionService] ✅ Monitoring successfully started for resumed session ${sessionId}`);
              })
              .catch(error => {
                console.error(`[SessionService] ❌ Error starting monitoring on resume:`, error);
                console.error(`[SessionService] Error stack:`, error.stack);
              });
          }
        } else {
          console.warn(`[SessionService] ⚠️ sessionMonitor not available for session ${sessionId}`);
          console.warn(`[SessionService] Monitoring will not be active for this session`);
        }
        
        return {
          success: true,
          message: 'Session resumed',
          session: this.sessionRepo.findById(sessionId)
        };
      }
      
      return result;
    } else {
      // Fallback if paused_at is missing (shouldn't happen, but handle gracefully)
      const result = this.sessionRepo.updateStatus(sessionId, 'active');
      
      if (result.success) {
        if (this.sessionMonitor) {
          const monitorState = this.sessionMonitor.getState();
          if (monitorState && monitorState.isMonitoring) {
            console.log(`[SessionService] Resuming monitoring for session ${sessionId} (fallback)`);
            this.sessionMonitor.resume();
          } else {
            console.log(`[SessionService] Starting monitoring for resumed session ${sessionId} (fallback)`);
            this.sessionMonitor.start(sessionId)
              .then(() => {
                console.log(`[SessionService] ✅ Monitoring successfully started for resumed session ${sessionId} (fallback)`);
              })
              .catch(error => {
                console.error(`[SessionService] ❌ Error starting monitoring on resume (fallback):`, error);
                console.error(`[SessionService] Error stack:`, error.stack);
              });
          }
        } else {
          console.warn(`[SessionService] ⚠️ sessionMonitor not available for session ${sessionId} (fallback)`);
          console.warn(`[SessionService] Monitoring will not be active for this session`);
        }
        
        return {
          success: true,
          message: 'Session resumed',
          session: this.sessionRepo.findById(sessionId)
        };
      }
      
      return result;
    }
  }
  
  deleteSession(sessionId) {
    const session = this.sessionRepo.findById(sessionId);
    
    if (!session) {
      return { success: false, error: 'Session not found' };
    }

    if (session.status === 'active') {
      return { 
        success: false, 
        error: 'Cannot delete active session. Please stop it first.' 
      };
    }

    return this.sessionRepo.delete(sessionId);
  }

  updateSession(sessionId, updates) {
    const session = this.sessionRepo.findById(sessionId);
    
    if (!session) {
      return { success: false, error: 'Session not found' };
    }

    if (session.status === 'active') {
      return { 
        success: false, 
        error: 'Cannot update active session' 
      };
    }

    // Only allow updating certain fields
    const allowedFields = [
      'task_name', 'task_description', 'duration_minutes',
      'reference_type', 'reference_url', 'reference_file_path', 'reference_text'
    ];

    const filteredUpdates = {};
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        filteredUpdates[key] = value;
      }
    }

    if (Object.keys(filteredUpdates).length === 0) {
      return { success: false, error: 'No valid fields to update' };
    }

    const result = this.sessionRepo.update(sessionId, filteredUpdates);
    
    if (result.success) {
      return {
        success: true,
        message: 'Session updated',
        session: this.sessionRepo.findById(sessionId)
      };
    }

    return result;
  }

  restartSession(sessionId) {
    const session = this.sessionRepo.findById(sessionId);
    
    if (!session) {
      return { success: false, error: 'Session not found' };
    }

    if (session.status === 'active') {
      return { success: false, error: 'Session is already active' };
    }

    // Check if user has another active session
    const activeSession = this.sessionRepo.getActiveSession(session.user_id);
    if (activeSession) {
      return { 
        success: false, 
        error: 'Another session is already active. Please stop it first.' 
      };
    }

    // Reset session to active state
    const now = new Date().toISOString();
    const result = this.sessionRepo.update(sessionId, {
      status: 'active',
      started_at: now,
      ended_at: null
    });

    if (result.success) {
      // Start monitoring if available
      if (this.sessionMonitor) {
        console.log(`[SessionService] Starting monitoring for restarted session ${sessionId}`);
        this.sessionMonitor.start(sessionId)
          .then(() => {
            console.log(`[SessionService] ✅ Monitoring successfully started for restarted session ${sessionId}`);
          })
          .catch(error => {
            console.error(`[SessionService] ❌ Error starting monitoring for restarted session ${sessionId}:`, error);
            console.error(`[SessionService] Error stack:`, error.stack);
          });
      } else {
        console.warn(`[SessionService] ⚠️ sessionMonitor not available for restarted session ${sessionId}`);
        console.warn(`[SessionService] Monitoring will not be active for this session`);
      }
      
      return {
        success: true,
        message: 'Session restarted',
        session: this.sessionRepo.findById(sessionId)
      };
    }

    return result;
  }

  getUserStats(userId) {
    const stats = this.sessionRepo.getUserStats(userId);
    return {
      success: true,
      stats: {
        totalSessions: stats.total_sessions || 0,
        completedSessions: stats.completed_sessions || 0,
        totalFocusMinutes: stats.total_focus_minutes || 0,
        totalFocusHours: Math.floor((stats.total_focus_minutes || 0) / 60)
      }
    };
  }

  getActiveSession(userId) {
    const session = this.sessionRepo.getActiveSession(userId);
    if (!session) {
      return { success: true, session: null };
    }
    return { success: true, session: session };
  }
}

module.exports = SessionService;
