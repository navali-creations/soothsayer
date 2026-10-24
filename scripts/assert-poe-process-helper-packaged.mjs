import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(scriptDir, "..");
const helperDir = resolve(rootDir, "helpers/poe-process-helper");
const helperManifest = JSON.parse(
  readFileSync(resolve(helperDir, "helper-manifest.json"), "utf8"),
);
const executableName =
  process.platform === "win32"
    ? `${helperManifest.executableName}.exe`
    : helperManifest.executableName;
const expectedSuffix = join(
  "resources",
  helperManifest.resourceDirectory,
  executableName,
);
const outDir = resolve(rootDir, process.argv[2] ?? "out");

const pending = [outDir];
let packagedHelper = null;
while (pending.length > 0 && packagedHelper === null) {
  const directory = pending.pop();
  if (!directory || !existsSync(directory)) continue;

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      pending.push(entryPath);
    } else if (entryPath.endsWith(expectedSuffix)) {
      packagedHelper = entryPath;
      break;
    }
  }
}

if (packagedHelper === null) {
  console.error(
    `PoE process helper was not packaged under ${join("resources", helperManifest.resourceDirectory)}`,
  );
  process.exit(1);
}

if (
  process.platform !== "win32" &&
  (statSync(packagedHelper).mode & 0o111) === 0
) {
  console.error(
    `Packaged PoE process helper is not executable: ${packagedHelper}`,
  );
  process.exit(1);
}

console.log(`PoE process helper packaged at ${packagedHelper}`);
