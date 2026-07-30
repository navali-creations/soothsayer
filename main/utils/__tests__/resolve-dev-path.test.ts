import { existsSync } from "node:fs";
import { join, parse, resolve } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
}));

import { resolveDevFile } from "../resolve-dev-path";

describe("resolveDevFile", () => {
  beforeEach(() => {
    vi.mocked(existsSync).mockReset();
  });

  it("returns a directly available file", () => {
    vi.mocked(existsSync).mockReturnValue(true);
    const start = resolve("project");

    expect(resolveDevFile(start, "CHANGELOG.md")).toBe(
      join(start, "CHANGELOG.md"),
    );
  });

  it("walks parent directories until it finds the file", () => {
    const project = resolve("project");
    const start = join(project, ".vite", "build");
    const expected = join(project, "CHANGELOG.md");
    vi.mocked(existsSync).mockImplementation((path) => path === expected);

    expect(resolveDevFile(start, "CHANGELOG.md")).toBe(expected);
  });

  it("returns the direct fallback after reaching the filesystem root", () => {
    vi.mocked(existsSync).mockReturnValue(false);
    const root = parse(resolve("project")).root;

    expect(resolveDevFile(root, "missing.txt")).toBe(join(root, "missing.txt"));
  });

  it("returns the direct fallback after the maximum walk depth", () => {
    vi.mocked(existsSync).mockReturnValue(false);
    const start = resolve("a", "b", "c", "d", "e", "f", "g");

    expect(resolveDevFile(start, "missing.txt")).toBe(
      join(start, "missing.txt"),
    );
    expect(existsSync).toHaveBeenCalledTimes(6);
  });
});
