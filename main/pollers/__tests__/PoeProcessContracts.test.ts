import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  HELPER_PROCESS_TITLE,
  HELPER_RESOURCE_DIR,
  LINUX_HELPER_EXECUTABLE_NAME,
  WINDOWS_HELPER_EXECUTABLE_NAME,
} from "../PoeProcessHelperPath";

function readRepoFile(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("PoE process helper contracts", () => {
  it("uses one manifest across runtime lookup, packaging, build, and CI", () => {
    const manifest = JSON.parse(
      readRepoFile("helpers/poe-process-helper/helper-manifest.json"),
    ) as {
      executableName: string;
      processTitle: string;
      resourceDirectory: string;
    };
    const forgeConfig = readRepoFile("forge.config.ts");
    const buildScript = readRepoFile("scripts/build-poe-process-helper.mjs");
    const ciWorkflow = readRepoFile(".github/workflows/ci.yml");
    const packagingAssertion = readRepoFile(
      "scripts/assert-poe-process-helper-packaged.mjs",
    );
    const helperSource = readRepoFile("helpers/poe-process-helper/src/main.rs");
    const protocolAssertion = readRepoFile(
      "scripts/validate-poe-process-helper-payload.mjs",
    );
    const publishWorkflow = readRepoFile(".github/workflows/publish.yml");

    expect(manifest).toEqual({
      executableName: LINUX_HELPER_EXECUTABLE_NAME,
      processTitle: HELPER_PROCESS_TITLE,
      resourceDirectory: HELPER_RESOURCE_DIR,
    });
    expect(WINDOWS_HELPER_EXECUTABLE_NAME).toBe(
      `${manifest.executableName}.exe`,
    );
    expect(forgeConfig).toContain("helper-manifest.json");
    expect(forgeConfig).toContain('process.platform === "linux"');
    expect(buildScript).toContain("helper-manifest.json");
    expect(packagingAssertion).toContain("helper-manifest.json");
    expect(helperSource).toContain(
      `const HELPER_TITLE: &str = "${manifest.processTitle}";`,
    );
    expect(protocolAssertion).toContain('state.game !== "poe1"');
    expect(ciWorkflow).toContain("os: [ubuntu-latest, windows-latest]");
    expect(ciWorkflow).toContain("scripts/run-msvc-cargo.mjs");
    expect(ciWorkflow).toContain("runner.os == 'Windows'");
    expect(ciWorkflow).toContain("runner.os == 'Linux'");
    expect(
      ciWorkflow.match(/validate-poe-process-helper-payload\.mjs/g),
    ).toHaveLength(2);
    expect(
      publishWorkflow.match(/assert-poe-process-helper-packaged\.mjs/g),
    ).toHaveLength(2);
    expect(
      existsSync(
        resolve(
          process.cwd(),
          ".github/scripts/assert-process-helper-packaged.ps1",
        ),
      ),
    ).toBe(false);
  });
});
