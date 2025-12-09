import type { ReactNode } from "react";
import PageContent from "./PageContent/PageContent";
import PageHeader from "./PageHeader/PageHeader";

type PageContainerProps = {
  children: ReactNode;
  className?: string;
};

const PageContainer = ({ children, className = "" }: PageContainerProps) => {
  return (
    <div className={`min-h-screen bg-base-200 p-6 ${className}`}>
      <div className="mx-auto space-y-6">{children}</div>
    </div>
  );
};

PageContainer.Header = PageHeader;
PageContainer.Content = PageContent;

export default PageContainer;
