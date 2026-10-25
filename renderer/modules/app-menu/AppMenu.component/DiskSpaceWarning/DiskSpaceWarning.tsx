import { useNavigate } from "@tanstack/react-router";
import { TbDatabaseExclamation } from "react-icons/tb";

import { Button } from "~/renderer/components";
import Tooltip from "~/renderer/components/Tooltip/Tooltip";
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
    <Tooltip as="div" content={tooltip} describeChild>
      <Button
        onClick={() => navigate({ to: "/settings" })}
        variant="ghost"
        size="sm"
        className="text-warning"
      >
        <TbDatabaseExclamation size={16} />
      </Button>
    </Tooltip>
  );
};

export default DiskSpaceWarning;
