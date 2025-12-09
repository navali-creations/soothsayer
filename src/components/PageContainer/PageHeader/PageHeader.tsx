import type { ReactNode } from "react";
import { Flex } from "../..";

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
};

const PageHeader = ({ title, subtitle, actions }: PageHeaderProps) => {
  return (
    <Flex className="justify-between">
      <Flex className="flex-col">
        <h1 className="text-3xl font-bold">{title}</h1>
        {subtitle && <p className="text-base-content/70">{subtitle}</p>}
      </Flex>
      {actions && <Flex>{actions}</Flex>}
    </Flex>
  );
};

export default PageHeader;
