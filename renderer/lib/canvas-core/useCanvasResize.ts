import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { DPR } from "./canvas-primitives";
import { observeResize, type ResizeCallback } from "./shared-resize-observer";

/**
 * Manages a shared ResizeObserver on a container element and keeps a
 * companion canvas element sized to match (accounting for devicePixelRatio).
 *
 * Uses a callback ref for the container so the observer subscription is
 * (re-)attached whenever the DOM element mounts — even if the component
 * returns `null` on its first render and the element appears later.
 *
 * Internally delegates to a module-scoped singleton ResizeObserver
 * (see `shared-resize-observer.ts`) so that dozens of sparkline canvases
 * share a single observer instance instead of each creating their own.
 *
 * Returns:
 *   - `containerRef`    – callback ref, pass to `ref={containerRef}` on the div
 *   - `containerElRef`  – stable `RefObject` holding the current element,
 *                          safe to pass to hooks that expect `RefObject`
 *                          (e.g. `useScrollZoom`)
 *   - `canvasRef`       – regular ref for the `<canvas>` element
 *   - `canvasSize`      – current logical (CSS-pixel) size of the container
 */
export function useCanvasResize() {
  const containerElRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafIdRef = useRef<number | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  const containerRef = useCallback((node: HTMLDivElement | null) => {
    // Cancel any pending RAF from the previous element.
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }

    // Unsubscribe the previous element from the shared observer.
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }

    containerElRef.current = node;

    if (!node) {
      setCanvasSize({ width: 0, height: 0 });
      return;
    }

    // RAF-coalescing callback: batches rapid resize events into a single
    // state update per animation frame, matching the previous behaviour.
    const resizeCallback: ResizeCallback = (entry) => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = null;
        const { width, height } = entry.contentRect;
        setCanvasSize({ width, height });
      });
    };

    // Subscribe via the shared singleton and stash the cleanup handle.
    cleanupRef.current = observeResize(node, resizeCallback);

    // Seed the initial size synchronously so the canvas is correctly
    // sized before the first ResizeObserver callback fires.
    const rect = node.getBoundingClientRect();
    setCanvasSize({ width: rect.width, height: rect.height });
  }, []);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = DPR();
    canvas.width = canvasSize.width * dpr;
    canvas.height = canvasSize.height * dpr;
    canvas.style.width = `${canvasSize.width}px`;
    canvas.style.height = `${canvasSize.height}px`;
  }, [canvasSize]);

  // Defensive cleanup: unsubscribe on unmount in case the callback ref's
  // null-call is skipped (e.g. StrictMode edge cases).
  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
    };
  }, []);

  return { containerRef, containerElRef, canvasRef, canvasSize };
}
