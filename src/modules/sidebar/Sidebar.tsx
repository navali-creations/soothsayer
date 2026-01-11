import { AnimatePresence, motion } from "motion/react";
import { useBoundStore } from "../../store/store";
import Navigation from "./Sidebar.components/Nav";
import SessionStatus from "./Sidebar.components/SessionStatus";

const SESSION_STATUS_HEIGHT = 132;

const Sidebar = () => {
  const {
    currentSession: { getIsCurrentSessionActive },
  } = useBoundStore();

  const isActive = getIsCurrentSessionActive();
  return (
    <aside className="w-[160px] flex flex-col h-screen border-r border-base-100 shadow-[0_0_10px_black] relative z-10 ">
      <AnimatePresence initial={false}>
        <motion.div
          className="relative"
          initial={{ y: -SESSION_STATUS_HEIGHT }}
          animate={{ y: isActive ? 0 : -SESSION_STATUS_HEIGHT }}
          exit={{ y: -SESSION_STATUS_HEIGHT }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
        >
          <SessionStatus />
        </motion.div>
      </AnimatePresence>

      <motion.div
        initial={{ y: 0 }}
        animate={{ y: isActive ? 0 : -SESSION_STATUS_HEIGHT }}
        exit={{ y: 0 }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className="h-full"
      >
        <Navigation />
      </motion.div>
    </aside>
  );
};

export default Sidebar;
