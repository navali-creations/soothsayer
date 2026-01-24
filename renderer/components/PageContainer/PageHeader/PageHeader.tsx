import { motion, type Variants } from "framer-motion";
import type { ReactNode } from "react";

import { Flex } from "../..";

type PageHeaderProps = {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
};

const headerTitleVariants: Variants = {
  hidden: {
    opacity: 0,
    x: -20,
  },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.4,
      ease: [0.4, 0, 0.2, 1],
    },
  },
};

const headerActionsVariants: Variants = {
  hidden: {
    opacity: 0,
    y: -10,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: [0.4, 0, 0.2, 1],
    },
  },
};

const PageHeader = ({ title, subtitle, actions }: PageHeaderProps) => {
  return (
    <Flex className="justify-between items-baseline">
      <motion.div variants={headerTitleVariants}>
        <Flex className="flex-col">
          <h1 className="text-3xl font-bold">{title}</h1>
          {subtitle && <p className="text-base-content/70">{subtitle}</p>}
        </Flex>
      </motion.div>
      {actions && (
        <motion.div variants={headerActionsVariants}>
          <Flex>{actions}</Flex>
        </motion.div>
      )}
    </Flex>
  );
};

export default PageHeader;
