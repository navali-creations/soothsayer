import { useNavigate, useRouter } from "@tanstack/react-router";
import { useCallback } from "react";
import { FiArrowLeft } from "react-icons/fi";

import Button from "../Button/Button";

interface BackButtonProps {
  /**
   * Fallback route to navigate to when there's no history to go back to.
   * This ensures the button always has a sensible destination.
   *
   * @example "/sessions" — used on the session details page
   * @example "/cards" — used on the card details page
   */
  fallback: string;

  /** Optional label rendered next to the arrow icon. */
  label?: string;

  /** Button variant — defaults to "ghost" for a minimal look. */
  variant?: "ghost" | "primary" | "secondary" | "accent" | "link";

  /** Button size — defaults to "sm". */
  size?: "lg" | "md" | "sm" | "xs";

  /** Additional CSS classes. */
  className?: string;
}

/**
 * A common "go back" button that navigates to the previous page in the
 * browser history stack. If there is no prior history entry (e.g. the user
 * deep-linked or opened the page directly), it falls back to the provided
 * route so the button always does something useful.
 *
 * Uses the TanStack Router's underlying history object so it works correctly
 * with the hash-based history used in this Electron app.
 */
const BackButton = ({
  fallback,
  label,
  variant = "ghost",
  size = "sm",
  className,
}: BackButtonProps) => {
  const navigate = useNavigate();
  const router = useRouter();

  const handleClick = useCallback(() => {
    // `history.length` tells us how many entries exist in the session history.
    // A fresh tab / deep-link starts at 1 (or 2 in some browsers for the
    // initial blank page). If there's meaningful history we can go back;
    // otherwise we navigate to the fallback route.
    if (window.history.length > 1) {
      router.history.back();
    } else {
      navigate({ to: fallback });
    }
  }, [fallback, navigate, router]);

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={handleClick}
    >
      <FiArrowLeft />
      {label && <span>{label}</span>}
    </Button>
  );
};

export default BackButton;
