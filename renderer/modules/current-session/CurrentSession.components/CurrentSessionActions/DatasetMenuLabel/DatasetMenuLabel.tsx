import Tooltip from "~/renderer/components/Tooltip/Tooltip";

interface DatasetMenuLabelProps {
  label: string;
  hint: string;
}

export function DatasetMenuLabel({ label, hint }: DatasetMenuLabelProps) {
  return (
    <Tooltip className="border-b border-dotted border-b-current" content={hint}>
      {label} <sup>?</sup>
    </Tooltip>
  );
}
