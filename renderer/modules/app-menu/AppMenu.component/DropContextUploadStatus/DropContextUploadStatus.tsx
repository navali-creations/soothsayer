import { FiClock, FiUploadCloud } from "react-icons/fi";

import { useCommunityUploadShallow } from "~/renderer/store";

const DropContextUploadStatus = () => {
  const { pendingEvents, isUploading } = useCommunityUploadShallow(
    (communityUpload) => communityUpload.dropContextUploadStatus,
  );

  if (pendingEvents === 0) return null;

  return (
    <div
      className="flex items-center justify-center gap-2 px-4 py-1.5 mt-px bg-info/10 border-b border-info/20 text-xs text-base-content/70"
      role="status"
      aria-live="polite"
    >
      {isUploading ? (
        <FiUploadCloud className="w-3.5 h-3.5 text-info shrink-0" />
      ) : (
        <FiClock className="w-3.5 h-3.5 text-info shrink-0" />
      )}
      <span>
        {isUploading
          ? "Uploading card history:"
          : "Card history upload queued:"}{" "}
        {pendingEvents.toLocaleString()} remaining
      </span>
      {isUploading && (
        <span className="loading loading-spinner loading-xs text-info" />
      )}
    </div>
  );
};

export default DropContextUploadStatus;
