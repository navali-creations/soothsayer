import { motion, type Variants } from "motion/react";
import type { ReactNode } from "react";

type PageContentProps = {
  children: ReactNode;
  className?: string;
};

const contentVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 20,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.2,
      ease: [0.4, 0, 0.2, 1],
    },
  },
  exit: {
    opacity: 0,
    y: -20,
    transition: {
      duration: 0.2,
      ease: [0.4, 0, 0.2, 1],
    },
  },
};

const PageContent = ({ children, className = "" }: PageContentProps) => {
  return (
    <motion.div
      className={`flex-1 overflow-y-auto space-y-6 pr-3 ${className} scroll-hint`}
      variants={contentVariants}
    >
      {children}
    </motion.div>
  );
};

export default PageContent;
