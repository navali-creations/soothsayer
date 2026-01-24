import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode } from "react";

import { useBoundStore } from "~/renderer/store";

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
  exit: {
    opacity: 0,
    transition: {
      duration: 0.2,
    },
  },
};

const PageContainer = ({ children, className = "" }: PageContainerProps) => {
  // Get the active game from the store to trigger re-animation on game change
  const {
    settings: { getSelectedGame },
  } = useBoundStore();

  const activeGame = getSelectedGame();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={`page-${activeGame}`} // Automatically re-animate when game changes
        className={`h-full flex flex-col bg-base-300 p-6 pr-4 ${className}`}
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
      >
        <div className="mx-auto w-full flex flex-col h-full space-y-6">
          {children}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

PageContainer.Header = PageHeader;
PageContainer.Content = PageContent;

export default PageContainer;
