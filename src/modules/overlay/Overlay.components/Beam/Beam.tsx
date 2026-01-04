import clsx from "clsx";
import type React from "react";
import "./beam.css";

type BeamProps = {
  className?: string;
  color?: string; // optional override (css color)
};

function Beam({ className, color }: BeamProps) {
  return (
    <div
      className={clsx("lootBeam", className)}
      style={
        color
          ? ({ ["--beam" as any]: color } as React.CSSProperties)
          : undefined
      }
      aria-hidden="true"
    >
      <span className="lootBeam__streak" />
      <span className="lootBeam__cap" />
    </div>
  );
}

export default Beam;
