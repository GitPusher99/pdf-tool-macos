import { logger } from "@shared/lib/logger";

const MAX_CONCURRENT = 2;

interface QueueItem {
  fn: () => Promise<void>;
  priority: number;
  resolve: () => void;
}

let running = 0;
const queue: QueueItem[] = [];

function runNext() {
  if (running >= MAX_CONCURRENT || queue.length === 0) return;

  // Sort by priority ascending (lower = higher priority)
  queue.sort((a, b) => a.priority - b.priority);

  const item = queue.shift()!;
  running++;

  logger.perf(`render start — priority=${item.priority}, running=${running}, queued=${queue.length}`);
  const t0 = performance.now();

  item
    .fn()
    .catch(() => {})
    .finally(() => {
      running--;
      logger.perf(`render done — priority=${item.priority}, took ${(performance.now() - t0).toFixed(1)}ms`);
      item.resolve();
      runNext();
    });
}

/**
 * Enqueue a render task with priority.
 * Lower priority number = executed first.
 * Main view pages: use |pageNum - currentPage| (0, 1, 2...)
 * Thumbnails: use 1000 + pageNum (always lower priority than main view)
 */
export function enqueueRender(
  fn: () => Promise<void>,
  priority: number,
): Promise<void> {
  return new Promise<void>((resolve) => {
    queue.push({ fn, priority, resolve });
    logger.debug(`enqueue — priority=${priority}, queued=${queue.length}, running=${running}`);
    runNext();
  });
}

/**
 * Clear all pending (not yet running) tasks from the queue.
 * Used when zoom changes to discard outdated render requests.
 */
export function clearRenderQueue() {
  const discarded = queue.length;
  for (const item of queue) {
    item.resolve();
  }
  queue.length = 0;
  if (discarded > 0) {
    logger.debug(`queue cleared — discarded ${discarded} pending tasks`);
  }
}
