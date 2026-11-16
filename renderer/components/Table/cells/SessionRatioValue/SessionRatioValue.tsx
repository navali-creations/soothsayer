import clsx from "clsx";

interface SessionRatioValueProps {
  ratio: number;
  hidden?: boolean;
}

const SessionRatioValue = ({
  ratio,
  hidden = false,
}: SessionRatioValueProps) => {
  return (
    <span className={clsx("tabular-nums", { "opacity-40": hidden })}>
      {ratio.toFixed(2)}%
    </span>
  );
};

export default SessionRatioValue;
