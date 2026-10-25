import clsx from "clsx";
import type { ReactNode } from "react";

interface LoadingOverlayProps {
  isLoading: boolean;
  children: ReactNode;
  className?: string;
}

/** Keeps existing content visible while a card-details section refreshes. */
const LoadingOverlay = ({
  isLoading,
  children,
  className,
}: LoadingOverlayProps) => {
  return (
    <div
      className={clsx("relative", className)}
      aria-busy={isLoading || undefined}
    >
      {isLoading && (
        <div className="absolute inset-0 z-10 bg-base-200/60 backdrop-blur-[2px] rounded-xl flex items-center justify-center">
          <span
            className="loading loading-spinner loading-sm text-primary"
            role="status"
            aria-label="Loading updated card details"
          />
        </div>
      )}
      <div
        className={clsx(isLoading && "pointer-events-none")}
        inert={isLoading || undefined}
      >
        {children}
      </div>
    </div>
  );
};

export default LoadingOverlay;
