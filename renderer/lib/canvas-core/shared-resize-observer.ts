/**
 * Shared ResizeObserver singleton.
 *
 * Instead of each component creating its own ResizeObserver (which is
 * expensive when 20+ sparklines are on screen), this module maintains a
 * single lazily-created observer and a map of element → callbacks.
 *
 * Usage:
 *   const cleanup = observeResize(element, (entry) => { ... });
 *   // later:
 *   cleanup();            // or: unobserveResize(element, callback);
 */

export type ResizeCallback = (entry: ResizeObserverEntry) => void;

// ── Module-scoped singleton state ──────────────────────────────────────────

let observer: ResizeObserver | null = null;
const listeners = new Map<Element, Set<ResizeCallback>>();

/**
 * Returns the singleton ResizeObserver, creating it lazily on first use.
 */
function getObserver(): ResizeObserver {
  if (!observer) {
    observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const cbs = listeners.get(entry.target);
        if (cbs) {
          for (const cb of cbs) {
            cb(entry);
          }
        }
      }
    });
  }
  return observer;
}

/**
 * Start observing `element` for resize events. The `callback` is invoked
 * with each `ResizeObserverEntry` that targets the element.
 *
 * Returns a cleanup function that removes this specific callback
 * (equivalent to calling `unobserveResize(element, callback)`).
 */
export function observeResize(
  element: Element,
  callback: ResizeCallback,
): () => void {
  let cbs = listeners.get(element);
  const isNewElement = !cbs;

  if (!cbs) {
    cbs = new Set();
    listeners.set(element, cbs);
  }

  cbs.add(callback);

  // Only call observer.observe() the first time we see this element.
  if (isNewElement) {
    getObserver().observe(element);
  }

  return () => unobserveResize(element, callback);
}

/**
 * Remove a specific `callback` for `element`. When the last callback for
 * an element is removed the element is unobserved. When no elements remain
 * the observer is disconnected and released so it can be garbage-collected.
 */
export function unobserveResize(
  element: Element,
  callback: ResizeCallback,
): void {
  const cbs = listeners.get(element);
  if (!cbs) return;

  cbs.delete(callback);

  if (cbs.size === 0) {
    listeners.delete(element);
    observer?.unobserve(element);

    // Disconnect entirely when nothing is being watched so the observer
    // can be garbage-collected if the module is still in memory.
    if (listeners.size === 0 && observer) {
      observer.disconnect();
      observer = null;
    }
  }
}
