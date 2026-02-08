import { execFile } from "node:child_process";

export async function isProcessRunning(processName: string): Promise<boolean> {
  const args = (() => {
    switch (process.platform) {
      case "win32":
        return { cmd: "tasklist", args: [] as string[] };
      case "darwin":
        return { cmd: "ps", args: ["-ax"] };
      case "linux":
        return { cmd: "ps", args: ["-A"] };
      default:
        return false;
    }
  })();

  if (!args) {
    return false;
  }

  return new Promise((resolve) => {
    execFile(args.cmd, args.args, (err: Error | null, stdout: string) => {
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
    });
  });
}
