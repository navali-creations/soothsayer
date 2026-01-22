import clsx from "clsx";
import type { ReactNode, HTMLAttributes } from "react";

type GroupedStatsDirection = "horizontal" | "vertical";

interface GroupedStatsProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
  direction?: GroupedStatsDirection;
  className?: string;
}

interface StatProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
  className?: string;
}

interface StatPartProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
  className?: string;
}

const GroupedStats = ({
  children,
  direction,
  className,
  ...props
}: GroupedStatsProps) => {
  return (
    <div
      className={clsx(
        "stats",
        direction === "vertical" && "stats-vertical",
        direction === "horizontal" && "stats-horizontal",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
};

const Stat = ({ children, className, ...props }: StatProps) => {
  return (
    <div className={clsx("stat", className)} {...props}>
      {children}
    </div>
  );
};

const StatTitle = ({ children, className, ...props }: StatPartProps) => {
  return (
    <div className={clsx("stat-title", className)} {...props}>
      {children}
    </div>
  );
};

const StatValue = ({ children, className, ...props }: StatPartProps) => {
  return (
    <div className={clsx("stat-value", className)} {...props}>
      {children}
    </div>
  );
};

const StatDesc = ({ children, className, ...props }: StatPartProps) => {
  return (
    <div className={clsx("stat-desc", className)} {...props}>
      {children}
    </div>
  );
};

const StatFigure = ({ children, className, ...props }: StatPartProps) => {
  return (
    <div className={clsx("stat-figure", className)} {...props}>
      {children}
    </div>
  );
};

const StatActions = ({ children, className, ...props }: StatPartProps) => {
  return (
    <div className={clsx("stat-actions", className)} {...props}>
      {children}
    </div>
  );
};

// Attach sub-components to Stat
Stat.Title = StatTitle;
Stat.Value = StatValue;
Stat.Desc = StatDesc;
Stat.Figure = StatFigure;
Stat.Actions = StatActions;

export { GroupedStats, Stat };
