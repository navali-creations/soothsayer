import { motion, AnimatePresence, type Variants } from "framer-motion";
import { useBoundStore } from "../../../store/store";
import { SessionCard } from "./SessionsCard";

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
};

const itemVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 20,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.3,
      ease: [0.4, 0, 0.2, 1],
    },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: {
      duration: 0.2,
      ease: [0.4, 0, 1, 1],
    },
  },
};

export const SessionsGrid = () => {
  const {
    sessions: { getFilteredSessions, getSelectedLeague },
  } = useBoundStore();

  const filteredSessions = getFilteredSessions();
  const selectedLeague = getSelectedLeague();

  if (filteredSessions.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-center py-12 text-base-content/50"
      >
        <p className="text-lg">No sessions found</p>
        <p className="text-sm">
          {selectedLeague === "all"
            ? "Start a session from the Current Session page to begin tracking"
            : `No sessions found for ${selectedLeague} league`}
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="grid grid-cols-4 gap-4"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <AnimatePresence mode="popLayout">
        {filteredSessions.map((session) => (
          <motion.div key={session.sessionId} variants={itemVariants} layout>
            <SessionCard session={session} />
          </motion.div>
        ))}
      </AnimatePresence>
    </motion.div>
  );
};
