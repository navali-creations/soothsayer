import { MdBlock } from "react-icons/md";

interface DisabledIndicatorProps {
  isDisabled: boolean;
}

export const DisabledIndicator = ({ isDisabled }: DisabledIndicatorProps) => {
  if (!isDisabled) {
    return null;
  }

  return (
    <div
      className="absolute -top-5 -left-5 z-100 bg-base-300 rounded-full p-3"
      title="This card is drop-disabled and cannot currently be obtained"
    >
      <MdBlock className="w-8 h-8 text-error/70" />
    </div>
  );
};
