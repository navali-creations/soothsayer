import clsx from "clsx";
import type React from "react";
import "./beam.css";

import { useBoundStore } from "~/renderer/store";

type BeamProps = {
  className?: string;
  color?: string; // optional override (css color)
};

function Beam({ className, color }: BeamProps) {
  const {
    overlay: { isLeftHalf },
  } = useBoundStore();
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
      <div
        className={`
          lootBeam__streak
          ${
            isLeftHalf
              ? "lootBeam__streak--leftHalf"
              : "lootBeam__streak--rightHalf"
          }`}
      />
      <div
        className={`
        lootBeam__cap
        ${isLeftHalf ? "lootBeam__cap--leftHalf" : "lootBeam__cap--rightHalf"}`}
      />
    </div>
  );
}

export default Beam;
