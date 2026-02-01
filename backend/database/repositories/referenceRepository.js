/**
 * Reference Repository
 * Manages storage and retrieval of processed reference content
 */
class ReferenceRepository {
  constructor(db) {
    this.db = db;
  }

  /**
   * Store processed reference content
   * @param {number} sessionId - Session ID
   * @param {Object} reference - Processed reference object
   * @returns {Promise<number>} Reference content ID
   */
  async storeReferenceContent(sessionId, reference) {
    const stmt = this.db.prepare(`
      INSERT INTO session_reference_content 
      (session_id, reference_type, reference_source, processed_content, keywords, summary)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      sessionId,
      reference.type,
      reference.source,
      reference.extractedText,
      JSON.stringify(reference.keywords || []),
      reference.summary || ''
    );

    return result.lastInsertRowid;
  }

  /**
   * Get all processed reference content for a session
   * @param {number} sessionId - Session ID
   * @returns {Array<Object>} Processed references
   */
  getSessionReferences(sessionId) {
    const stmt = this.db.prepare(`
      SELECT * FROM session_reference_content
      WHERE session_id = ?
      ORDER BY processed_at ASC
    `);

    const rows = stmt.all(sessionId);
    return rows.map(row => ({
      id: row.id,
      type: row.reference_type,
      source: row.reference_source,
      processedContent: row.processed_content,
      keywords: JSON.parse(row.keywords || '[]'),
      summary: row.summary,
      processedAt: row.processed_at
    }));
  }

  /**
   * Delete all reference content for a session
   * @param {number} sessionId - Session ID
   */
  deleteSessionReferences(sessionId) {
    const stmt = this.db.prepare(`
      DELETE FROM session_reference_content
      WHERE session_id = ?
    `);
    stmt.run(sessionId);
  }

  /**
   * Update reference content (for reprocessing)
   * @param {number} referenceId - Reference content ID
   * @param {Object} reference - Updated reference object
   */
  updateReferenceContent(referenceId, reference) {
    const stmt = this.db.prepare(`
      UPDATE session_reference_content
      SET processed_content = ?, keywords = ?, summary = ?, processed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    stmt.run(
      reference.extractedText,
      JSON.stringify(reference.keywords || []),
      reference.summary || '',
      referenceId
    );
  }
}

module.exports = ReferenceRepository;
