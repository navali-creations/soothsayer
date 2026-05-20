import { FiDownload } from "react-icons/fi";

import { BackButton, Button, Flex } from "~/renderer/components";

interface SessionDetailsActionsProps {
  onExportCsv?: () => void;
}

const SessionDetailsActions = ({ onExportCsv }: SessionDetailsActionsProps) => {
  return (
    <Flex className="gap-2 items-center">
      <BackButton fallback="/sessions" />

      {onExportCsv && (
        <Button variant="primary" onClick={onExportCsv} size="sm">
          Export CSV <FiDownload />
        </Button>
      )}
    </Flex>
  );
};

export default SessionDetailsActions;
