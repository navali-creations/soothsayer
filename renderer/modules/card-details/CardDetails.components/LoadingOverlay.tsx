import type { ReactNode } from "react";

interface LoadingOverlayProps {
  /** Whether to show the loading overlay. */
  isLoading: boolean;
  /** The content to render underneath the overlay. */
  children: ReactNode;
}

/**
 * Wraps children in a relative container and renders a translucent
 * overlay with a spinner when `isLoading` is true.
 *
 * Used in the card details "Your Data" tab to indicate that personal
 * analytics / timeline / sessions are being refreshed (e.g. on league switch).
 */
const LoadingOverlay = ({ isLoading, children }: LoadingOverlayProps) => {
  return (
    <div className="relative">
      {isLoading && (
        <div className="absolute inset-0 z-10 bg-base-200/60 backdrop-blur-[2px] rounded-xl flex items-center justify-center">
          <span className="loading loading-spinner loading-sm text-primary" />
        </div>
      )}
      {children}
    </div>
  );
};

export default LoadingOverlay;
