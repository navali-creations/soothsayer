import clsx from "clsx";

interface SessionCountValueProps {
  count: number;
  hidden?: boolean;
}

const SessionCountValue = ({
  count,
  hidden = false,
}: SessionCountValueProps) => {
  return (
    <div className={clsx("badge badge-soft", { "opacity-40": hidden })}>
      {count}
    </div>
  );
};

export default SessionCountValue;
