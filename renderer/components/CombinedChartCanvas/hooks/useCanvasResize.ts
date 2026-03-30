import { useLayoutEffect, useRef, useState } from "react";

import { DPR } from "../canvas-chart-utils";

/**
 * Manages a ResizeObserver on a container element and keeps a companion
 * canvas element sized to match (accounting for devicePixelRatio).
 *
 * Returns refs for the container and canvas, plus the current logical size.
 */
export function useCanvasResize() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  // Resize observer
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setCanvasSize({ width, height });
      }
    });
    observer.observe(container);

    // Initial size
    const rect = container.getBoundingClientRect();
    setCanvasSize({ width: rect.width, height: rect.height });

    return () => observer.disconnect();
  }, []);

  // Canvas DPI sync
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = DPR();
    canvas.width = canvasSize.width * dpr;
    canvas.height = canvasSize.height * dpr;
    canvas.style.width = `${canvasSize.width}px`;
    canvas.style.height = `${canvasSize.height}px`;
  }, [canvasSize]);

  return { containerRef, canvasRef, canvasSize };
}
