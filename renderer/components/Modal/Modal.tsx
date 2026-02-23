import clsx from "clsx";
import { forwardRef, type ReactNode, useImperativeHandle, useRef } from "react";

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

const Modal = forwardRef<ModalHandle, ModalProps>(
  (
    { children, className, closeOnBackdrop = true, onClose, size = "md" },
    ref,
  ) => {
    const dialogRef = useRef<HTMLDialogElement>(null);

    useImperativeHandle(ref, () => ({
      open: () => {
        dialogRef.current?.showModal();
      },
      close: () => {
        dialogRef.current?.close();
      },
    }));

    const handleClose = () => {
      onClose?.();
    };

    return (
      <dialog
        ref={dialogRef}
        className="modal modal-bottom sm:modal-middle backdrop-blur-xs"
        onClose={handleClose}
      >
        <div
          className={clsx(
            "modal-box border border-base-300 bg-base-300",
            sizeClasses[size],
            className,
          )}
        >
          {children}
        </div>
        {closeOnBackdrop && (
          <form method="dialog" className="modal-backdrop">
            <button type="submit">close</button>
          </form>
        )}
      </dialog>
    );
  },
);

Modal.displayName = "Modal";

export default Modal;
