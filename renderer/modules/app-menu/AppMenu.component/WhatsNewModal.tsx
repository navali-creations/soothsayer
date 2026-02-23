import { useEffect, useRef } from "react";
import { MdOutlineNewReleases } from "react-icons/md";

import {
  Badge,
  MarkdownRenderer,
  Modal,
  type ModalHandle,
} from "~/renderer/components";
import { changeTypeColor } from "~/renderer/modules/changelog/Changelog.utils";
import { useBoundStore } from "~/renderer/store";

const WhatsNewModal = () => {
  const {
    appMenu: {
      isWhatsNewOpen,
      whatsNewRelease,
      whatsNewIsLoading,
      whatsNewError,
      closeWhatsNew,
    },
  } = useBoundStore();

  const modalRef = useRef<ModalHandle>(null);

  // Sync zustand state with the native <dialog> element
  useEffect(() => {
    if (isWhatsNewOpen) {
      modalRef.current?.open();
    } else {
      modalRef.current?.close();
    }
  }, [isWhatsNewOpen]);

  return (
    <Modal ref={modalRef} size="lg" onClose={closeWhatsNew}>
      <div className="flex items-center gap-3 mb-4">
        <MdOutlineNewReleases className="w-6 h-6 text-primary shrink-0" />
        <h3 className="font-bold text-lg">
          {whatsNewRelease ? whatsNewRelease.name : "What's New"}
        </h3>
        {whatsNewRelease && (
          <Badge
            variant={changeTypeColor(whatsNewRelease.changeType)}
            size="sm"
            outline
          >
            {whatsNewRelease.changeType}
          </Badge>
        )}
      </div>

      {whatsNewIsLoading && (
        <div className="flex items-center justify-center py-12">
          <span className="loading loading-spinner loading-lg text-primary" />
        </div>
      )}

      {whatsNewError && !whatsNewIsLoading && (
        <div className="alert alert-error text-sm">
          <span>{whatsNewError}</span>
        </div>
      )}

      {whatsNewRelease && !whatsNewIsLoading && (
        <>
          <div className="text-xs text-base-content/50 mb-4">
            {whatsNewRelease.publishedAt &&
              `Released ${new Date(
                whatsNewRelease.publishedAt,
              ).toLocaleDateString(undefined, {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}`}
          </div>

          <div className="overflow-y-auto overflow-x-hidden max-h-[60vh] pr-2">
            {whatsNewRelease.body ? (
              <MarkdownRenderer>{whatsNewRelease.body}</MarkdownRenderer>
            ) : (
              <p className="text-sm text-base-content/60">
                No detailed changes available for this release.
              </p>
            )}
          </div>
        </>
      )}

      <div className="modal-action">
        <button className="btn btn-ghost" type="button" onClick={closeWhatsNew}>
          Close
        </button>
      </div>
    </Modal>
  );
};

export default WhatsNewModal;
