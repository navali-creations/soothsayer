import clsx from "clsx";
import type { ReactNode } from "react";

interface AccordionProps {
  /** The title shown in the always-visible header */
  title: ReactNode;
  /** Content revealed when the accordion is expanded */
  children: ReactNode;
  /** Optional icon to show before the title */
  icon?: ReactNode;
  /** Additional class names for the outer container */
  className?: string;
  /** Additional class names for the content area */
  contentClassName?: string;
  /** Whether the accordion starts open. Defaults to false. */
  defaultOpen?: boolean;
  /** Optional right-aligned content in the header (e.g. a badge or summary) */
  headerRight?: ReactNode;
}

const Accordion = ({
  title,
  children,
  icon,
  className,
  contentClassName,
  defaultOpen = false,
  headerRight,
}: AccordionProps) => {
  return (
    <div
      className={clsx(
        "collapse collapse-arrow bg-base-200/50 rounded-lg",
        className,
      )}
    >
      <input type="checkbox" className="peer" defaultChecked={defaultOpen} />
      <div className="collapse-title flex items-center gap-2 min-h-0 py-2 pr-10 text-sm font-medium">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {icon && (
            <span className="text-base-content/60 shrink-0">{icon}</span>
          )}
          <span className="truncate">{title}</span>
        </div>
        {headerRight && (
          <span className="shrink-0 text-xs text-base-content/50">
            {headerRight}
          </span>
        )}
      </div>
      <div
        className={clsx("collapse-content pb-2 pt-0 text-sm", contentClassName)}
      >
        {children}
      </div>
    </div>
  );
};

export default Accordion;
