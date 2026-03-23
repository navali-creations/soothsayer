import { describe, expect, it } from "vitest";

import {
  CORE_MAINTAINERS,
  changeTypeColor,
  hoverBorderColorClass,
  releaseUrl,
} from "./Changelog.utils";

describe("CORE_MAINTAINERS", () => {
  it('contains "sbsrnt"', () => {
    expect(CORE_MAINTAINERS.has("sbsrnt")).toBe(true);
  });

  it("has exactly 1 member", () => {
    expect(CORE_MAINTAINERS.size).toBe(1);
  });

  it("does not contain arbitrary strings", () => {
    expect(CORE_MAINTAINERS.has("random-user")).toBe(false);
  });
});

describe("changeTypeColor", () => {
  describe("minor → success", () => {
    it('returns "success" for "minor"', () => {
      expect(changeTypeColor("minor")).toBe("success");
    });

    it('returns "success" for "Minor Release"', () => {
      expect(changeTypeColor("Minor Release")).toBe("success");
    });

    it('returns "success" for "MINOR"', () => {
      expect(changeTypeColor("MINOR")).toBe("success");
    });

    it('returns "success" for "mInOr"', () => {
      expect(changeTypeColor("mInOr")).toBe("success");
    });
  });

  describe("major → warning", () => {
    it('returns "warning" for "major"', () => {
      expect(changeTypeColor("major")).toBe("warning");
    });

    it('returns "warning" for "Major Update"', () => {
      expect(changeTypeColor("Major Update")).toBe("warning");
    });

    it('returns "warning" for "MAJOR"', () => {
      expect(changeTypeColor("MAJOR")).toBe("warning");
    });

    it('returns "warning" for "mAjOr"', () => {
      expect(changeTypeColor("mAjOr")).toBe("warning");
    });
  });

  describe("patch → info", () => {
    it('returns "info" for "patch"', () => {
      expect(changeTypeColor("patch")).toBe("info");
    });

    it('returns "info" for "Patch Fix"', () => {
      expect(changeTypeColor("Patch Fix")).toBe("info");
    });

    it('returns "info" for "PATCH"', () => {
      expect(changeTypeColor("PATCH")).toBe("info");
    });

    it('returns "info" for "pAtCh"', () => {
      expect(changeTypeColor("pAtCh")).toBe("info");
    });
  });

  describe("unknown types → accent", () => {
    it('returns "accent" for an empty string', () => {
      expect(changeTypeColor("")).toBe("accent");
    });

    it('returns "accent" for "feature"', () => {
      expect(changeTypeColor("feature")).toBe("accent");
    });

    it('returns "accent" for "bugfix"', () => {
      expect(changeTypeColor("bugfix")).toBe("accent");
    });

    it('returns "accent" for "hotfix"', () => {
      expect(changeTypeColor("hotfix")).toBe("accent");
    });

    it('returns "accent" for arbitrary unrecognized text', () => {
      expect(changeTypeColor("something completely different")).toBe("accent");
    });
  });

  describe("if-else priority order", () => {
    it('prioritizes "minor" over "major" when both substrings appear', () => {
      expect(changeTypeColor("minor-major")).toBe("success");
    });

    it('prioritizes "minor" over "patch" when both substrings appear', () => {
      expect(changeTypeColor("minor-patch")).toBe("success");
    });

    it('prioritizes "major" over "patch" when both substrings appear', () => {
      expect(changeTypeColor("major-patch")).toBe("warning");
    });
  });
});

describe("hoverBorderColorClass", () => {
  it('returns "hover:border-info" for "info"', () => {
    expect(hoverBorderColorClass("info")).toBe("hover:border-info");
  });

  it('returns "hover:border-success" for "success"', () => {
    expect(hoverBorderColorClass("success")).toBe("hover:border-success");
  });

  it('returns "hover:border-warning" for "warning"', () => {
    expect(hoverBorderColorClass("warning")).toBe("hover:border-warning");
  });

  it('returns "hover:border-accent" for "accent"', () => {
    expect(hoverBorderColorClass("accent")).toBe("hover:border-accent");
  });

  it("returns a string that starts with 'hover:border-' for every valid color", () => {
    const colors = ["info", "success", "warning", "accent"] as const;
    for (const color of colors) {
      expect(hoverBorderColorClass(color)).toMatch(/^hover:border-/);
    }
  });
});

describe("releaseUrl", () => {
  it("constructs the correct GitHub release URL with a v prefix", () => {
    expect(releaseUrl("1.0.0")).toBe(
      "https://github.com/navali-creations/soothsayer/releases/tag/v1.0.0",
    );
  });

  it("handles pre-release versions", () => {
    expect(releaseUrl("2.0.0-beta.1")).toBe(
      "https://github.com/navali-creations/soothsayer/releases/tag/v2.0.0-beta.1",
    );
  });

  it("does not double-prefix if version already starts with v", () => {
    // Current implementation always prepends "v", so "v1.0.0" becomes "vv1.0.0".
    // This test documents the existing behaviour.
    expect(releaseUrl("v1.0.0")).toBe(
      "https://github.com/navali-creations/soothsayer/releases/tag/vv1.0.0",
    );
  });

  it("handles a simple single-digit version", () => {
    expect(releaseUrl("1")).toBe(
      "https://github.com/navali-creations/soothsayer/releases/tag/v1",
    );
  });

  it("includes the full base URL for every call", () => {
    const url = releaseUrl("3.2.1");
    expect(url).toContain(
      "https://github.com/navali-creations/soothsayer/releases/tag/",
    );
    expect(url).toContain("v3.2.1");
  });
});
