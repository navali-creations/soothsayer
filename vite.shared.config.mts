import { resolve } from "node:path";

type ProjectDirectory = "enums" | "main" | "renderer" | "types";

const projectRoot = import.meta.dirname;
const mainDirectories = ["main", "types", "enums"] as const;
const rendererDirectories = ["renderer", ...mainDirectories] as const;

function getProjectAliases(
  directories: readonly ProjectDirectory[],
): Record<string, string> {
  return Object.fromEntries(
    directories.map((directory) => [
      `~/${directory}`,
      resolve(projectRoot, directory),
    ]),
  );
}

export function getMainAliases(): Record<string, string> {
  return getProjectAliases(mainDirectories);
}

export function getRendererAliases(): Record<string, string> {
  return getProjectAliases(rendererDirectories);
}
