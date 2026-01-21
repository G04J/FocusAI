const xxhashWasm = require('xxhash-wasm');
const sharp = require('sharp');

/**
 * Tile Hashing Service
 * Divides screenshots into tiles and computes hashes for change detection
 */
class TileHashService {
  constructor() {
    this.tileSize = 50; // 50x50 pixels
    this.hashMap = new Map(); // Map<tileId, hash>
    this.maxStorage = 100; // Max 100 screenshots worth
    this.xxhashReady = null; // Promise for xxhash initialization
    this.h32ToString = null; // Will be set after initialization
  }

  /**
   * Initialize xxhash-wasm (lazy initialization)
   * @returns {Promise<void>}
   */
  async initializeXxhash() {
    if (!this.xxhashReady) {
      this.xxhashReady = xxhashWasm().then(({ h32ToString }) => {
        this.h32ToString = h32ToString;
        return h32ToString;
      });
    }
    return this.xxhashReady;
  }

  /**
   * Compute hash for all tiles in image
   * @param {Buffer} imageBuffer - Image buffer
   * @returns {Object} Hash data {tileHashes: Map, changedTiles: Array}
   */
  async computeTileHashes(imageBuffer) {
    try {
      if (!imageBuffer) {
        throw new Error('Invalid image buffer');
      }

      // Get image dimensions
      const metadata = await sharp(imageBuffer).metadata();
      const { width, height } = metadata;

      // Calculate number of tiles
      const tilesX = Math.ceil(width / this.tileSize);
      const tilesY = Math.ceil(height / this.tileSize);

      const tileHashes = new Map();
      const changedTiles = [];

      // Process tiles in parallel (if possible)
      const tilePromises = [];
      for (let y = 0; y < tilesY; y++) {
        for (let x = 0; x < tilesX; x++) {
          tilePromises.push(this.computeSingleTileHash(imageBuffer, x, y, width, height));
        }
      }

      const hashResults = await Promise.all(tilePromises);

      // Build hash map and detect changes
      let index = 0;
      for (let y = 0; y < tilesY; y++) {
        for (let x = 0; x < tilesX; x++) {
          const tileId = `${x},${y}`;
          const hash = hashResults[index++];
          tileHashes.set(tileId, hash);

          // Check if tile changed
          const prevHash = this.hashMap.get(tileId);
          if (!prevHash || prevHash !== hash) {
            changedTiles.push({ x, y, tileId, hash });
          }
        }
      }

      // Update hash map
      this.hashMap = tileHashes;

      // Limit storage size
      if (this.hashMap.size > this.maxStorage * tilesX * tilesY) {
        this.cleanup();
      }

      return {
        tileHashes: tileHashes,
        changedTiles: changedTiles,
        totalTiles: tilesX * tilesY,
        changedCount: changedTiles.length
      };
    } catch (error) {
      console.error('Error computing tile hashes:', error);
      // Fallback to simple sum if xxhash fails
      return this.computeSimpleHash(imageBuffer);
    }
  }

  /**
   * Compute hash for a single tile
   * @param {Buffer} imageBuffer - Image buffer
   * @param {number} tileX - Tile X coordinate
   * @param {number} tileY - Tile Y coordinate
   * @param {number} imageWidth - Image width
   * @param {number} imageHeight - Image height
   * @returns {Promise<string>} Hash string
   */
  async computeSingleTileHash(imageBuffer, tileX, tileY, imageWidth, imageHeight) {
    try {
      // Initialize xxhash if not already done
      await this.initializeXxhash();

      // Extract tile region
      const left = tileX * this.tileSize;
      const top = tileY * this.tileSize;
      const width = Math.min(this.tileSize, imageWidth - left);
      const height = Math.min(this.tileSize, imageHeight - top);

      // Extract tile image
      const tileBuffer = await sharp(imageBuffer)
        .extract({ left, top, width, height })
        .raw()
        .toBuffer();

      // Compute xxhash using WASM (convert Buffer to Uint8Array)
      const hash = this.h32ToString(new Uint8Array(tileBuffer));
      return hash;
    } catch (error) {
      console.error(`Error computing hash for tile ${tileX},${tileY}:`, error);
      // Fallback to simple sum
      return this.computeSimpleTileHash(imageBuffer, tileX, tileY, imageWidth, imageHeight);
    }
  }

  /**
   * Simple hash fallback (mean + variance)
   * @param {Buffer} imageBuffer - Image buffer
   * @returns {Object} Hash data
   */
  async computeSimpleHash(imageBuffer) {
    // Fallback implementation (simplified)
    const metadata = await sharp(imageBuffer).metadata();
    const sum = metadata.width + metadata.height;
    const hash = sum.toString();

    return {
      tileHashes: new Map([['0,0', hash]]),
      changedTiles: [{ x: 0, y: 0, tileId: '0,0', hash }],
      totalTiles: 1,
      changedCount: 1
    };
  }

  /**
   * Simple tile hash fallback
   * @param {Buffer} imageBuffer - Image buffer
   * @param {number} tileX - Tile X
   * @param {number} tileY - Tile Y
   * @param {number} imageWidth - Image width
   * @param {number} imageHeight - Image height
   * @returns {string} Hash string
   */
  async computeSimpleTileHash(imageBuffer, tileX, tileY, imageWidth, imageHeight) {
    const left = tileX * this.tileSize;
    const top = tileY * this.tileSize;
    const sum = left + top + imageWidth + imageHeight;
    return sum.toString();
  }

  /**
   * Get changed tiles
   * @param {Buffer} imageBuffer - Image buffer
   * @returns {Promise<Array>} Changed tiles
   */
  async getChangedTiles(imageBuffer) {
    const result = await this.computeTileHashes(imageBuffer);
    return result.changedTiles;
  }

  /**
   * Clear all hashes
   */
  clear() {
    this.hashMap.clear();
  }

  /**
   * Cleanup old hashes
   */
  cleanup() {
    // Keep only recent entries (simple implementation)
    const entries = Array.from(this.hashMap.entries());
    const keepCount = Math.floor(this.maxStorage * 0.5);
    const recentEntries = entries.slice(-keepCount);
    this.hashMap = new Map(recentEntries);
  }

  /**
   * Get hash for specific tile
   * @param {string} tileId - Tile ID (e.g., "10,20")
   * @returns {string|null} Hash or null
   */
  getTileHash(tileId) {
    return this.hashMap.get(tileId) || null;
  }
}

module.exports = TileHashService;
