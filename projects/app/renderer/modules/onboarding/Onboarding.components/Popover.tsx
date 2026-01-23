import { type PopoverComponentProps, ReperePopover } from "@repere/react";
import type { ReactNode } from "react";
import { Button } from "~/renderer/components";

type PopoverProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
} & PopoverComponentProps;

const Popover = ({ title, subtitle, children, ...props }: PopoverProps) => {
  return (
    <ReperePopover
      {...props}
      className="w-[400px] p-3 rounded-2xl shadow-lg shadow-primary/50 border-2 border-primary [background:color-mix(in_oklab,var(--color-accent)_50%,black)]"
    >
      <ReperePopover.Title className="text-lg font-bold text-primary">
        {title}
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
        >
          Got it
        </ReperePopover.AcknowledgeButton>
      </ReperePopover.Footer>
    </ReperePopover>
  );
};

export default Popover;
