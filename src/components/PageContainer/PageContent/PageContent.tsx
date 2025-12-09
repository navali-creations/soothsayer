import type { ReactNode } from "react";

type PageContentProps = {
  children: ReactNode;
  className?: string;
};

const PageContent = ({ children, className = "" }: PageContentProps) => {
  return <div className={`space-y-6 ${className}`}>{children}</div>;
};

export default PageContent;
