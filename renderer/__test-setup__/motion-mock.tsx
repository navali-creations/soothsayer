/**
 * Shared mock factory for `motion/react`.
 *
 * The `motion/react` mock is identical across 7+ test files. Instead of
 * copy-pasting, test files can delegate to this factory:
 *
 * ```ts
 * import { createMotionMock } from "~/renderer/__test-setup__/motion-mock";
 *
 * vi.mock("motion/react", () => createMotionMock());
 * ```
 *
 * For the rare case where `AnimatePresence` needs a wrapper element (e.g. for
 * querying in tests), pass `{ animatePresenceTestId: "animate-presence" }`.
 */

import React from "react";

export interface MotionMockOptions {
  /**
   * When set, `AnimatePresence` renders a `<div>` with this `data-testid`
   * instead of a bare fragment.
   */
  animatePresenceTestId?: string;

  /**
   * Extra motion-specific prop names to strip from `motion.div` before
   * spreading onto a real `<div>`. Defaults to the standard set
   * (`layout`, `initial`, `animate`, `exit`, `transition`).
   */
  stripProps?: string[];
}

const DEFAULT_STRIP_PROPS = [
  "layout",
  "initial",
  "animate",
  "exit",
  "transition",
];

export function createMotionMock(options: MotionMockOptions = {}) {
  const { animatePresenceTestId, stripProps = DEFAULT_STRIP_PROPS } = options;

  const AnimatePresence = animatePresenceTestId
    ? ({ children }: { children?: React.ReactNode }) =>
        React.createElement(
          "div",
          { "data-testid": animatePresenceTestId },
          children,
        )
    : ({ children }: { children?: React.ReactNode }) =>
        React.createElement(React.Fragment, null, children);

  const motionDiv = ({
    children,
    ...props
  }: React.HTMLAttributes<HTMLDivElement> & { children?: React.ReactNode }) => {
    const domProps = { ...props };
    for (const key of stripProps) {
      delete (domProps as Record<string, unknown>)[key];
    }
    return React.createElement("div", domProps, children);
  };

  return {
    AnimatePresence,
    motion: {
      div: motionDiv,
    },
  };
}
