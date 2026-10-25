import { motion, type Variants } from "motion/react";
import type { ReactNode } from "react";

import { PAGE_ANIMATION_SCHEDULE } from "../PageContainer.utils";

type PageContentProps = {
  children: ReactNode;
  className?: string;
  animationKey?: string;
};

const contentVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 20,
  },
  visible: (delay = 0) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.2,
      delay,
      ease: [0.4, 0, 0.2, 1],
    },
  }),
  exit: {
    opacity: 0,
    y: -20,
    transition: {
      duration: 0.2,
      ease: [0.4, 0, 0.2, 1],
    },
  },
};

const PageContent = ({
  children,
  className = "",
  animationKey,
}: PageContentProps) => {
  return (
    <motion.div
      key={animationKey}
      className={`flex-1 overflow-y-auto space-y-6 pr-3 ${className} scroll-hint`}
      variants={contentVariants}
      custom={animationKey ? PAGE_ANIMATION_SCHEDULE.content : undefined}
      initial={animationKey ? "hidden" : undefined}
      animate={animationKey ? "visible" : undefined}
    >
      {children}
    </motion.div>
  );
};

export default PageContent;
