import { useEffect, useRef } from "react";
import { FiExternalLink, FiShield, FiX } from "react-icons/fi";

import { Button, Modal, type ModalHandle } from "~/renderer/components";
import { useCommunityUpload } from "~/renderer/store";

interface GggAccountLinkConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const GggAccountLinkConfirmModal = ({
  isOpen,
  onClose,
}: GggAccountLinkConfirmModalProps) => {
  const modalRef = useRef<ModalHandle>(null);
  const { authenticate, isAuthenticating } = useCommunityUpload();

  useEffect(() => {
    if (isOpen) {
      modalRef.current?.open();
    }
  }, [isOpen]);

  const handleConfirm = () => {
    onClose();
    void authenticate();
  };

  if (!isOpen) {
    return null;
  }

  return (
    <Modal ref={modalRef} onClose={onClose}>
      <div className="flex items-center gap-3 mb-4">
        <FiShield className="h-6 w-6 shrink-0 text-primary" />
        <h3 className="text-lg font-bold">Link GGG Account</h3>
      </div>

      <div className="space-y-4 text-sm">
        <p>This opens the official Path of Exile website.</p>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded border border-success/30 bg-success/5 p-3">
            <p className="font-semibold text-success">
              Soothsayer will only receive:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-base-content/75">
              <li>Your account name</li>
              <li>Your account ID</li>
            </ul>
          </div>

          <div className="rounded border border-base-content/15 bg-base-200/60 p-3">
            <p className="font-semibold">Soothsayer will not receive:</p>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-base-content/75">
              <li>Your password</li>
              <li>Your email</li>
              <li>Your characters</li>
              <li>Your stash tabs or items</li>
              <li>Your trade data</li>
            </ul>
          </div>
        </div>

        <p className="text-base-content/70">
          You can unlink at any time. Community uploads still work without
          linking.
        </p>
      </div>

      <div className="modal-action">
        <Button variant="ghost" size="sm" onClick={onClose}>
          <FiX />
          Cancel
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={handleConfirm}
          loading={isAuthenticating}
        >
          <FiExternalLink />
          Continue to Path of Exile
        </Button>
      </div>
    </Modal>
  );
};

export default GggAccountLinkConfirmModal;
