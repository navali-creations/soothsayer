import clsx from "clsx";
import {
  forwardRef,
  type ReactNode,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

export interface ModalHandle {
  open: () => void;
  close: () => void;
}

interface ModalProps {
  children: ReactNode;
  /** Additional classes for the modal-box container */
  className?: string;
  /** Whether clicking the backdrop closes the modal (default: true) */
  closeOnBackdrop?: boolean;
  /** Called when the modal is closed */
  onClose?: () => void;
  /** Size variant */
  size?: "sm" | "md" | "lg";
}

const sizeClasses: Record<string, string> = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-3xl",
};

const SCRIM_FADE_MS = 300;

const Modal = forwardRef<ModalHandle, ModalProps>(
  (
    { children, className, closeOnBackdrop = true, onClose, size = "md" },
    ref,
  ) => {
    const dialogRef = useRef<HTMLDialogElement>(null);
    const scrimTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
    const [isScrimMounted, setIsScrimMounted] = useState(false);
    const [isScrimVisible, setIsScrimVisible] = useState(false);

    const clearScrimTimer = useCallback(() => {
      if (!scrimTimerRef.current) {
        return;
      }

      clearTimeout(scrimTimerRef.current);
      scrimTimerRef.current = undefined;
    }, []);

    const showScrim = useCallback(() => {
      clearScrimTimer();
      setIsScrimMounted(true);
      setIsScrimVisible(true);
    }, [clearScrimTimer]);

    const hideScrim = useCallback(() => {
      clearScrimTimer();
      setIsScrimVisible(false);
      scrimTimerRef.current = setTimeout(() => {
        setIsScrimMounted(false);
        scrimTimerRef.current = undefined;
      }, SCRIM_FADE_MS);
    }, [clearScrimTimer]);

    useEffect(() => clearScrimTimer, [clearScrimTimer]);

    useImperativeHandle(
      ref,
      () => ({
        open: () => {
          showScrim();
          dialogRef.current?.showModal();
        },
        close: () => {
          hideScrim();
          dialogRef.current?.close();
        },
      }),
      [hideScrim, showScrim],
    );

    const handleClose = () => {
      hideScrim();
      onClose?.();
    };

    const scrim =
      isScrimMounted && typeof document !== "undefined"
        ? createPortal(
            <div
              aria-hidden="true"
              data-testid="modal-scrim"
              className={clsx(
                "pointer-events-none fixed inset-0 z-40 bg-base-300/45 backdrop-blur-sm transition-opacity duration-300",
                isScrimVisible ? "opacity-100" : "opacity-0",
              )}
            />,
            document.body,
          )
        : null;

    return (
      <>
        {scrim}
        <dialog
          ref={dialogRef}
          className="modal modal-bottom !bg-transparent sm:modal-middle"
          onClose={handleClose}
        >
          {closeOnBackdrop && (
            <form
              method="dialog"
              className="col-start-1 row-start-1 grid place-self-stretch text-transparent"
            >
              <button type="submit" className="cursor-pointer">
                close
              </button>
            </form>
          )}
          <div
            className={clsx(
              "modal-box border border-base-300 bg-base-300 shadow-[0px_0px_18px_0px_var(--tw-shadow-color,_rgba(0,0,0,0.50))]",
              sizeClasses[size],
              className,
            )}
          >
            {children}
          </div>
        </dialog>
      </>
    );
  },
);

Modal.displayName = "Modal";

export default Modal;
