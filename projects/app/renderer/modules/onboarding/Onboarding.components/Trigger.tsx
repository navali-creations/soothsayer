import { RepereTrigger } from "@repere/react";
import { TiInfoLargeOutline } from "react-icons/ti";

import { Button } from "~/renderer/components";

const Trigger = () => {
  return (
    <RepereTrigger
      as={Button}
      circle
      size="xs"
      className="bg-[color-mix(in_oklab,var(--color-accent)_70%,black)]  hover:bg-[color-mix(in_oklab,var(--color-primary)_60%,black)] hover:text-accent-content/80 animate-pulse-ring border-2 border-primary"
    >
      <TiInfoLargeOutline size={18} />
    </RepereTrigger>
  );
};

export default Trigger;
