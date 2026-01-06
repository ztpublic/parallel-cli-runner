/**
 * TerminalBatchManager - Batches terminal output updates for improved performance.
 *
 * Uses requestAnimationFrame-based batching to reduce main thread blocking from
 * frequent small writes. Each terminal session has its own batch buffer.
 */

type BatchEntry = {
  chunks: string[];
  totalSize: number;
  rafId: number | null;
};

export type BatchMetrics = {
  batchSize: number;
  chunkCount: number;
};

const MAX_BATCH_SIZE = 64 * 1024; // 64KB max batch
const MIN_BATCH_SIZE = 512; // Only batch if at least 512 bytes

type FlushCallback = (sessionId: string, data: string, metrics: BatchMetrics) => void;

export class TerminalBatchManager {
  private batches = new Map<string, BatchEntry>();
  private flushCallback: FlushCallback;

  constructor(flushCallback: FlushCallback) {
    this.flushCallback = flushCallback;
  }

  /**
   * Queue data for batched writing to a terminal session.
   * @param sessionId - The terminal session ID
   * @param data - The data to write
   * @param flushImmediately - If true, flush immediately without batching
   */
  queueWrite(sessionId: string, data: string, flushImmediately = false): void {
    const entry = this.batches.get(sessionId);

    if (!entry) {
      // First chunk for this session - create new batch entry
      const newEntry: BatchEntry = {
        chunks: [data],
        totalSize: data.length,
        rafId: null,
      };
      this.batches.set(sessionId, newEntry);

      // If data is large enough or immediate flush requested, flush now
      if (flushImmediately || data.length >= MAX_BATCH_SIZE) {
        this.flush(sessionId);
      } else {
        this.scheduleFlush(sessionId);
      }
      return;
    }

    // Add chunk to existing batch
    entry.chunks.push(data);
    entry.totalSize += data.length;

    // Flush immediately if:
    // 1. Explicit immediate flush requested (user input)
    // 2. Batch size exceeds MAX_BATCH_SIZE
    // 3. Single large chunk (>= MAX_BATCH_SIZE)
    if (flushImmediately || entry.totalSize >= MAX_BATCH_SIZE || data.length >= MAX_BATCH_SIZE) {
      // Cancel any pending RAF
      if (entry.rafId !== null) {
        cancelAnimationFrame(entry.rafId);
        entry.rafId = null;
      }
      this.flush(sessionId);
    } else if (entry.rafId === null) {
      // No flush scheduled, schedule one
      this.scheduleFlush(sessionId);
    }
    // If RAF is already scheduled, just let it run - the new chunk will be included
  }

  /**
   * Immediately flush all pending data for a session.
   * Called on user input or when a terminal is disposed.
   */
  flush(sessionId: string): void {
    const entry = this.batches.get(sessionId);
    if (!entry) return;

    // Cancel any pending RAF
    if (entry.rafId !== null) {
      cancelAnimationFrame(entry.rafId);
      entry.rafId = null;
    }

    // Only flush if we have data
    if (entry.chunks.length === 0) return;

    // Combine all chunks
    const combinedData = entry.chunks.join('');
    const metrics: BatchMetrics = {
      batchSize: entry.totalSize,
      chunkCount: entry.chunks.length,
    };

    // Reset entry
    entry.chunks = [];
    entry.totalSize = 0;

    // Call flush callback
    this.flushCallback(sessionId, combinedData, metrics);

    // Remove entry if empty (no pending data)
    if (entry.chunks.length === 0 && entry.rafId === null) {
      this.batches.delete(sessionId);
    }
  }

  /**
   * Flush all pending batches for all sessions.
   */
  flushAll(): void {
    const sessionIds = Array.from(this.batches.keys());
    for (const sessionId of sessionIds) {
      this.flush(sessionId);
    }
  }

  /**
   * Schedule a flush for the next animation frame.
   */
  private scheduleFlush(sessionId: string): void {
    const entry = this.batches.get(sessionId);
    if (!entry || entry.rafId !== null) return;

    entry.rafId = requestAnimationFrame(() => {
      entry.rafId = null;
      // Only flush if we have enough data or enough time has passed
      if (entry.totalSize >= MIN_BATCH_SIZE) {
        this.flush(sessionId);
      } else if (entry.chunks.length > 0) {
        // Small batch - flush anyway to avoid stale data
        this.flush(sessionId);
      }
    });
  }

  /**
   * Clean up resources for a session.
   * Call this when a terminal is disposed.
   */
  dispose(sessionId: string): void {
    const entry = this.batches.get(sessionId);
    if (entry) {
      // Flush any pending data
      this.flush(sessionId);
      // Cancel any pending RAF
      if (entry.rafId !== null) {
        cancelAnimationFrame(entry.rafId);
      }
      this.batches.delete(sessionId);
    }
  }

  /**
   * Get pending batch info for a session.
   */
  getPendingInfo(sessionId: string): { size: number; chunkCount: number } | null {
    const entry = this.batches.get(sessionId);
    if (!entry) return null;
    return { size: entry.totalSize, chunkCount: entry.chunks.length };
  }

  /**
   * Dispose all batches.
   */
  disposeAll(): void {
    // Flush all pending data
    this.flushAll();
    // Cancel all RAFs
    for (const entry of this.batches.values()) {
      if (entry.rafId !== null) {
        cancelAnimationFrame(entry.rafId);
      }
    }
    this.batches.clear();
  }
}
