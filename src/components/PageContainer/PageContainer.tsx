import { motion } from "framer-motion";
import type { ReactNode } from "react";
import PageContent from "./PageContent/PageContent";
import PageHeader from "./PageHeader/PageHeader";

type PageContainerProps = {
  children: ReactNode;
  className?: string;
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.05,
    },
  },
};

const PageContainer = ({ children, className = "" }: PageContainerProps) => {
  return (
    <motion.div
      className={`h-full flex flex-col bg-base-300 p-6 pr-4 ${className}`}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <div className="mx-auto w-full flex flex-col h-full space-y-6">
        {children}
      </div>
    </motion.div>
  );
};

PageContainer.Header = PageHeader;
PageContainer.Content = PageContent;

export default PageContainer;
