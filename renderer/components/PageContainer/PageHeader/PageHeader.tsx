import { motion, type Variants } from "motion/react";
import type { ReactNode } from "react";

import { Flex } from "../..";
import { PAGE_ANIMATION_SCHEDULE } from "../PageContainer.utils";

type PageHeaderProps = {
  title: string;
  titleClassName?: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  animationKey?: string;
};

const headerTitleVariants: Variants = {
  hidden: {
    opacity: 0,
    x: -20,
  },
  visible: (delay = 0) => ({
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.4,
      delay,
      ease: [0.4, 0, 0.2, 1],
    },
  }),
};

const headerActionsVariants: Variants = {
  hidden: {
    opacity: 0,
    y: -10,
  },
  visible: (delay = 0) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      delay,
      ease: [0.4, 0, 0.2, 1],
    },
  }),
};

const PageHeader = ({
  title,
  titleClassName,
  subtitle,
  actions,
  animationKey,
}: PageHeaderProps) => {
  return (
    <Flex className="justify-between items-baseline">
      <motion.div
        key={animationKey ? `title-${animationKey}` : undefined}
        variants={headerTitleVariants}
        custom={animationKey ? PAGE_ANIMATION_SCHEDULE.title : undefined}
        initial={animationKey ? "hidden" : undefined}
        animate={animationKey ? "visible" : undefined}
      >
        <Flex className="flex-col">
          <h1 className={`text-3xl font-bold ${titleClassName ?? ""}`}>
            {title}
          </h1>
          {subtitle && <div className="text-base-content/70">{subtitle}</div>}
        </Flex>
      </motion.div>
      {actions && (
        <motion.div
          variants={headerActionsVariants}
          custom={PAGE_ANIMATION_SCHEDULE.actions}
        >
          <Flex>{actions}</Flex>
        </motion.div>
      )}
    </Flex>
  );
};

export default PageHeader;
