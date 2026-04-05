import { useNavigate } from "@tanstack/react-router";
import { TbDatabaseExclamation } from "react-icons/tb";

import { Button } from "~/renderer/components";
import { formatBytes } from "~/renderer/modules/settings/Settings.components/storage/storage.utils/storage.utils";
import { useStorage } from "~/renderer/store";

const DiskSpaceWarning = () => {
  const { isDiskLow, info } = useStorage();
  const navigate = useNavigate();

  if (!isDiskLow) {
    return null;
  }

  const freeBytes = info?.diskFreeBytes ?? 0;
  const tooltip = `Low disk space — ${formatBytes(freeBytes)} free`;

  return (
    <div className="tooltip tooltip-bottom tooltip-warning" data-tip={tooltip}>
      <Button
        onClick={() => navigate({ to: "/settings" })}
        variant="ghost"
        size="sm"
        className="text-warning"
      >
        <TbDatabaseExclamation size={16} />
      </Button>
    </div>
  );
};

export default DiskSpaceWarning;
