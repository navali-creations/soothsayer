import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const PROCESS_QUERY_MAX_BUFFER = 10 * 1024 * 1024;

export interface ProcessInfo {
  pid: number;
  parentPid: number;
  command: string;
}

interface WindowsProcessRecord {
  ProcessId: number;
  ParentProcessId: number;
  Name?: string | null;
  ExecutablePath?: string | null;
  CommandLine?: string | null;
}

function normalizeWindowsRecord(record: WindowsProcessRecord): ProcessInfo {
  return {
    pid: record.ProcessId,
    parentPid: record.ParentProcessId,
    command: record.CommandLine ?? record.ExecutablePath ?? record.Name ?? "",
  };
}

async function listWindowsProcesses(): Promise<ProcessInfo[]> {
  const command = [
    "$ErrorActionPreference='Stop';",
    "Get-CimInstance Win32_Process |",
    "Select-Object ProcessId,ParentProcessId,Name,ExecutablePath,CommandLine |",
    "ConvertTo-Json -Compress",
  ].join(" ");

  const { stdout } = await execFileAsync(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-Command", command],
    { maxBuffer: PROCESS_QUERY_MAX_BUFFER },
  );

  const text = stdout.trim();
  if (!text) return [];

  const records = JSON.parse(text) as
    | WindowsProcessRecord
    | WindowsProcessRecord[];

  return (Array.isArray(records) ? records : [records]).map(
    normalizeWindowsRecord,
  );
}

async function listPosixProcesses(): Promise<ProcessInfo[]> {
  const { stdout } = await execFileAsync(
    "ps",
    ["-axo", "pid=,ppid=,comm=,args="],
    { maxBuffer: PROCESS_QUERY_MAX_BUFFER },
  );

  return stdout
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*(\d+)\s+(\d+)\s+(\S+)\s*(.*)$/))
    .filter((match): match is RegExpMatchArray => match !== null)
    .map((match) => ({
      pid: Number(match[1]),
      parentPid: Number(match[2]),
      command: match[4] || match[3],
    }));
}

export async function listProcesses(): Promise<ProcessInfo[]> {
  return process.platform === "win32"
    ? listWindowsProcesses()
    : listPosixProcesses();
}

export async function getProcessTree(rootPid: number): Promise<ProcessInfo[]> {
  const processes = await listProcesses();
  const byParentPid = new Map<number, ProcessInfo[]>();

  for (const processInfo of processes) {
    const siblings = byParentPid.get(processInfo.parentPid) ?? [];
    siblings.push(processInfo);
    byParentPid.set(processInfo.parentPid, siblings);
  }

  const root = processes.find((processInfo) => processInfo.pid === rootPid);
  const tree: ProcessInfo[] = root ? [root] : [];
  const queue = [rootPid];

  while (queue.length > 0) {
    const parentPid = queue.shift();
    if (parentPid === undefined) continue;

    for (const child of byParentPid.get(parentPid) ?? []) {
      tree.push(child);
      queue.push(child.pid);
    }
  }

  return tree;
}

export async function waitForProcessesToExit(
  pids: Iterable<number>,
  options: { timeoutMs?: number; pollIntervalMs?: number } = {},
): Promise<ProcessInfo[]> {
  const timeoutMs = options.timeoutMs ?? 10_000;
  const pollIntervalMs = options.pollIntervalMs ?? 250;
  const targetPids = new Set(pids);
  const deadline = Date.now() + timeoutMs;

  let liveProcesses: ProcessInfo[] = [];

  while (Date.now() < deadline) {
    const processes = await listProcesses();
    liveProcesses = processes.filter((processInfo) =>
      targetPids.has(processInfo.pid),
    );

    if (liveProcesses.length === 0) {
      return [];
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  return liveProcesses;
}

export function formatProcessList(processes: ProcessInfo[]): string {
  if (processes.length === 0) return "(none)";

  return processes
    .map(
      (processInfo) =>
        `pid=${processInfo.pid} ppid=${processInfo.parentPid} ${processInfo.command}`,
    )
    .join("\n");
}
