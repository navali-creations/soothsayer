import { type PopoverComponentProps, ReperePopover } from "@repere/react";
import type { ReactNode } from "react";

import { Button } from "~/renderer/components";
import { trackEvent } from "~/renderer/modules/umami";

type PopoverProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
} & PopoverComponentProps;

const Popover = ({
  title,
  subtitle,
  children,
  className,
  ...props
}: PopoverProps) => {
  const handleAcknowledge = () => {
    trackEvent("onboarding-step-acknowledged", {
      beaconId: props.beaconId,
    });
  };

  return (
    <ReperePopover
      {...props}
      className={`w-[400px] p-3 rounded-2xl shadow-lg shadow-primary/50 border-2 border-primary [background:color-mix(in_oklab,var(--color-accent)_30%,black)] ${
        className ?? ""
      }`}
    >
      <ReperePopover.Title>
        <span className="text-lg font-bold text-primary">{title}</span>
      </ReperePopover.Title>
      <ReperePopover.Content className="text-sm">
        {subtitle && <p className="text-base-content">{subtitle}</p>}
        {children && (
          <>
            <div className="divider divider-primary mt-2 mb-1" />
            {children}
          </>
        )}
      </ReperePopover.Content>
      <ReperePopover.Footer className="mt-3">
        <ReperePopover.AcknowledgeButton
          as={Button}
          variant="primary"
          className="h-8"
          block
          onClick={handleAcknowledge}
        >
          Got it
        </ReperePopover.AcknowledgeButton>
      </ReperePopover.Footer>
    </ReperePopover>
  );
};

export default Popover;
