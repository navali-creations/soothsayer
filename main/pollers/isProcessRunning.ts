export async function isProcessRunning(processName: string): Promise<boolean> {
  const cmd = (() => {
    switch (process.platform) {
      case "win32":
        return "tasklist";
      case "darwin":
        return `ps -ax | grep ${processName}`;
      case "linux":
        return "ps -A";
      default:
        return false;
    }
  })();

  if (!cmd) {
    return false;
  }

  return new Promise((resolve) => {
    require("node:child_process").exec(
      cmd,
      (err: Error | null, stdout: string) => {
        if (err) {
          // Handle errors gracefully (e.g., quota violations during sleep/hibernation)
          // Instead of crashing, assume process is not running
          console.warn(
            `[isProcessRunning] Failed to check process "${processName}":`,
            err.message,
          );
          resolve(false);
          return;
        }

        resolve(stdout.toLowerCase().indexOf(processName.toLowerCase()) > -1);
      },
    );
  });
}
