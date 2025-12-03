import { useCallback, useEffect, useState } from "react";

export const useAppControls = () => {
  const [isMaximized, setIsMaximized] = useState(false);

  // Get initial state
  useEffect(() => {
    window.electron?.app.isMaximized().then(setIsMaximized);
  }, []);

  const minimize = useCallback(() => {
    window.electron?.app.minimize();
  }, []);

  const maximize = useCallback(async () => {
    await window.electron?.app.maximize();
    const newState = await window.electron?.app.isMaximized();
    setIsMaximized(newState);
  }, []);

  const unmaximize = useCallback(async () => {
    await window.electron?.app.unmaximize();
    const newState = await window.electron?.app.isMaximized();
    setIsMaximized(newState);
  }, []);

  const close = useCallback(() => {
    window.electron?.app.close();
  }, []);

  return { minimize, maximize, unmaximize, close, isMaximized };
};
