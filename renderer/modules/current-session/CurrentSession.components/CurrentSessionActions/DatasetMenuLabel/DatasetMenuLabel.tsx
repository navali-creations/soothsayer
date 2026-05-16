interface DatasetMenuLabelProps {
  label: string;
  hint: string;
}

export function DatasetMenuLabel({ label, hint }: DatasetMenuLabelProps) {
  return (
    <span className="border-b border-dotted border-b-current" title={hint}>
      {label} <sup>?</sup>
    </span>
  );
}
