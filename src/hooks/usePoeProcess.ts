import { useEffect, useState } from "react";

export const usePoeProcess = () => {
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    // Get initial state
    window.electron?.poeProcess?.getState().then((state) => {
      setIsRunning(state?.isRunning || false);
    });

    // Listen for state changes
    const cleanup = window.electron?.poeProcess?.onState?.((state) => {
      setIsRunning(state?.isRunning || false);
    });

    return cleanup;
  }, []);

  return { isRunning };
};
