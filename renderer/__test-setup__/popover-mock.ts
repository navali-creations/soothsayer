/**
 * Creates a mock factory for `~/renderer/hooks/usePopover/usePopover`.
 *
 * The mock is identical across 6+ test files:
 *
 * ```ts
 * vi.mock("~/renderer/hooks/usePopover/usePopover", () => ({
 *   usePopover: () => ({
 *     triggerRef: { current: null },
 *     popoverRef: { current: null },
 *   }),
 * }));
 * ```
 *
 * Usage (inside a test file – `vi.mock` is hoisted, but the factory runs at
 * mock-resolution time so the import is fine):
 *
 * ```ts
 * import { createPopoverMock } from "~/renderer/__test-setup__/popover-mock";
 *
 * vi.mock(
 *   "~/renderer/hooks/usePopover/usePopover",
 *   () => createPopoverMock(),
 * );
 * ```
 *
 * If a test needs to override individual ref values it can do so after import:
 *
 * ```ts
 * import { createPopoverMock } from "~/renderer/__test-setup__/popover-mock";
 *
 * const popoverMock = createPopoverMock({
 *   triggerRef: { current: document.createElement("button") },
 * });
 * vi.mock(
 *   "~/renderer/hooks/usePopover/usePopover",
 *   () => popoverMock,
 * );
 * ```
 */

export interface PopoverMockRefs {
  triggerRef: { current: HTMLElement | null };
  popoverRef: { current: HTMLElement | null };
}

export function createPopoverMock(overrides: Partial<PopoverMockRefs> = {}): {
  usePopover: () => PopoverMockRefs;
} {
  const refs: PopoverMockRefs = {
    triggerRef: overrides.triggerRef ?? { current: null },
    popoverRef: overrides.popoverRef ?? { current: null },
  };

  return {
    usePopover: () => refs,
  };
}
