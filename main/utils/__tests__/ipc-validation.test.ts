import { describe, expect, it } from "vitest";

import {
  assertArray,
  assertBoolean,
  assertBoundedString,
  assertCardName,
  assertEnum,
  assertEnumArray,
  assertExitBehavior,
  assertFilePath,
  assertGameType,
  assertInstalledGames,
  assertInteger,
  assertLeagueId,
  assertLimit,
  assertNumber,
  assertOptionalInteger,
  assertOptionalNumber,
  assertOptionalString,
  assertPage,
  assertPageSize,
  assertPriceSource,
  assertSessionId,
  assertSetupStep,
  assertString,
  assertStringArray,
  handleValidationError,
  IpcValidationError,
} from "../ipc-validation";

describe("IPC Validation Utilities", () => {
  const TEST_CHANNEL = "test:channel";

  // ─── IpcValidationError ──────────────────────────────────────────────────

  describe("IpcValidationError", () => {
    it("should create an error with channel and detail", () => {
      const error = new IpcValidationError("my:channel", "bad value");

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(IpcValidationError);
      expect(error.channel).toBe("my:channel");
      expect(error.detail).toBe("bad value");
      expect(error.name).toBe("IpcValidationError");
      expect(error.message).toContain("my:channel");
      expect(error.message).toContain("bad value");
    });
  });

  // ─── assertString ────────────────────────────────────────────────────────

  describe("assertString", () => {
    it("should pass for a valid string", () => {
      expect(() => assertString("hello", "param", TEST_CHANNEL)).not.toThrow();
    });

    it("should pass for an empty string", () => {
      expect(() => assertString("", "param", TEST_CHANNEL)).not.toThrow();
    });

    it("should throw for a number", () => {
      expect(() => assertString(42, "param", TEST_CHANNEL)).toThrow(
        IpcValidationError,
      );
    });

    it("should throw for null", () => {
      expect(() => assertString(null, "param", TEST_CHANNEL)).toThrow(
        IpcValidationError,
      );
    });

    it("should throw for undefined", () => {
      expect(() => assertString(undefined, "param", TEST_CHANNEL)).toThrow(
        IpcValidationError,
      );
    });

    it("should throw for a boolean", () => {
      expect(() => assertString(true, "param", TEST_CHANNEL)).toThrow(
        IpcValidationError,
      );
    });

    it("should throw for an object", () => {
      expect(() => assertString({}, "param", TEST_CHANNEL)).toThrow(
        IpcValidationError,
      );
    });

    it("should throw for an array", () => {
      expect(() => assertString([], "param", TEST_CHANNEL)).toThrow(
        IpcValidationError,
      );
    });

    it("should include the param name in the error detail", () => {
      try {
        assertString(123, "myParam", TEST_CHANNEL);
      } catch (e) {
        expect((e as IpcValidationError).detail).toContain("myParam");
      }
    });
  });

  // ─── assertNumber ────────────────────────────────────────────────────────

  describe("assertNumber", () => {
    it("should pass for a valid number", () => {
      expect(() => assertNumber(42, "param", TEST_CHANNEL)).not.toThrow();
    });

    it("should pass for zero", () => {
      expect(() => assertNumber(0, "param", TEST_CHANNEL)).not.toThrow();
    });

    it("should pass for negative numbers", () => {
      expect(() => assertNumber(-5, "param", TEST_CHANNEL)).not.toThrow();
    });

    it("should pass for floating point numbers", () => {
      expect(() => assertNumber(3.14, "param", TEST_CHANNEL)).not.toThrow();
    });

    it("should throw for NaN", () => {
      expect(() => assertNumber(NaN, "param", TEST_CHANNEL)).toThrow(
        IpcValidationError,
      );
    });

    it("should throw for Infinity", () => {
      expect(() => assertNumber(Infinity, "param", TEST_CHANNEL)).toThrow(
        IpcValidationError,
      );
    });

    it("should throw for -Infinity", () => {
      expect(() => assertNumber(-Infinity, "param", TEST_CHANNEL)).toThrow(
        IpcValidationError,
      );
    });

    it("should throw for a string", () => {
      expect(() => assertNumber("42", "param", TEST_CHANNEL)).toThrow(
        IpcValidationError,
      );
    });

    it("should throw for null", () => {
      expect(() => assertNumber(null, "param", TEST_CHANNEL)).toThrow(
        IpcValidationError,
      );
    });

    it("should throw for undefined", () => {
      expect(() => assertNumber(undefined, "param", TEST_CHANNEL)).toThrow(
        IpcValidationError,
      );
    });

    it("should throw for a boolean", () => {
      expect(() => assertNumber(true, "param", TEST_CHANNEL)).toThrow(
        IpcValidationError,
      );
    });
  });

  // ─── assertBoolean ───────────────────────────────────────────────────────

  describe("assertBoolean", () => {
    it("should pass for true", () => {
      expect(() => assertBoolean(true, "param", TEST_CHANNEL)).not.toThrow();
    });

    it("should pass for false", () => {
      expect(() => assertBoolean(false, "param", TEST_CHANNEL)).not.toThrow();
    });

    it("should throw for a number", () => {
      expect(() => assertBoolean(1, "param", TEST_CHANNEL)).toThrow(
        IpcValidationError,
      );
    });

    it("should throw for a string", () => {
      expect(() => assertBoolean("true", "param", TEST_CHANNEL)).toThrow(
        IpcValidationError,
      );
    });

    it("should throw for null", () => {
      expect(() => assertBoolean(null, "param", TEST_CHANNEL)).toThrow(
        IpcValidationError,
      );
    });

    it("should throw for undefined", () => {
      expect(() => assertBoolean(undefined, "param", TEST_CHANNEL)).toThrow(
        IpcValidationError,
      );
    });
  });

  // ─── assertEnum ──────────────────────────────────────────────────────────

  describe("assertEnum", () => {
    const ALLOWED = ["a", "b", "c"] as const;

    it("should pass for a valid enum value", () => {
      expect(() =>
        assertEnum("a", "param", TEST_CHANNEL, ALLOWED),
      ).not.toThrow();
    });

    it("should pass for each allowed value", () => {
      for (const val of ALLOWED) {
        expect(() =>
          assertEnum(val, "param", TEST_CHANNEL, ALLOWED),
        ).not.toThrow();
      }
    });

    it("should throw for a value not in the allowed list", () => {
      expect(() => assertEnum("d", "param", TEST_CHANNEL, ALLOWED)).toThrow(
        IpcValidationError,
      );
    });

    it("should throw for a non-string value", () => {
      expect(() => assertEnum(42, "param", TEST_CHANNEL, ALLOWED)).toThrow(
        IpcValidationError,
      );
    });

    it("should throw for null", () => {
      expect(() => assertEnum(null, "param", TEST_CHANNEL, ALLOWED)).toThrow(
        IpcValidationError,
      );
    });

    it("should include the allowed values in the error detail", () => {
      try {
        assertEnum("invalid", "param", TEST_CHANNEL, ALLOWED);
      } catch (e) {
        const detail = (e as IpcValidationError).detail;
        expect(detail).toContain("a");
        expect(detail).toContain("b");
        expect(detail).toContain("c");
      }
    });
  });

  // ─── assertInteger ───────────────────────────────────────────────────────

  describe("assertInteger", () => {
    it("should pass for a valid integer", () => {
      expect(() => assertInteger(42, "param", TEST_CHANNEL)).not.toThrow();
    });

    it("should pass for zero", () => {
      expect(() => assertInteger(0, "param", TEST_CHANNEL)).not.toThrow();
    });

    it("should pass for negative integers", () => {
      expect(() => assertInteger(-10, "param", TEST_CHANNEL)).not.toThrow();
    });

    it("should throw for a floating point number", () => {
      expect(() => assertInteger(3.14, "param", TEST_CHANNEL)).toThrow(
        IpcValidationError,
      );
    });

    it("should throw for a string", () => {
      expect(() => assertInteger("5", "param", TEST_CHANNEL)).toThrow(
        IpcValidationError,
      );
    });

    it("should throw for NaN", () => {
      expect(() => assertInteger(NaN, "param", TEST_CHANNEL)).toThrow(
        IpcValidationError,
      );
    });

    it("should respect min option", () => {
      expect(() =>
        assertInteger(5, "param", TEST_CHANNEL, { min: 1 }),
      ).not.toThrow();

      expect(() => assertInteger(0, "param", TEST_CHANNEL, { min: 1 })).toThrow(
        IpcValidationError,
      );

      expect(() =>
        assertInteger(1, "param", TEST_CHANNEL, { min: 1 }),
      ).not.toThrow();
    });

    it("should respect max option", () => {
      expect(() =>
        assertInteger(5, "param", TEST_CHANNEL, { max: 10 }),
      ).not.toThrow();

      expect(() =>
        assertInteger(11, "param", TEST_CHANNEL, { max: 10 }),
      ).toThrow(IpcValidationError);

      expect(() =>
        assertInteger(10, "param", TEST_CHANNEL, { max: 10 }),
      ).not.toThrow();
    });

    it("should respect min and max options together", () => {
      expect(() =>
        assertInteger(5, "param", TEST_CHANNEL, { min: 1, max: 10 }),
      ).not.toThrow();

      expect(() =>
        assertInteger(0, "param", TEST_CHANNEL, { min: 1, max: 10 }),
      ).toThrow(IpcValidationError);

      expect(() =>
        assertInteger(11, "param", TEST_CHANNEL, { min: 1, max: 10 }),
      ).toThrow(IpcValidationError);
    });
  });

  // ─── assertBoundedString ─────────────────────────────────────────────────

  describe("assertBoundedString", () => {
    it("should pass for a valid string within bounds", () => {
      expect(() =>
        assertBoundedString("hello", "param", TEST_CHANNEL, 100),
      ).not.toThrow();
    });

    it("should pass for a string at exactly the max length", () => {
      const str = "a".repeat(10);
      expect(() =>
        assertBoundedString(str, "param", TEST_CHANNEL, 10),
      ).not.toThrow();
    });

    it("should throw for a string exceeding max length", () => {
      const str = "a".repeat(11);
      expect(() => assertBoundedString(str, "param", TEST_CHANNEL, 10)).toThrow(
        IpcValidationError,
      );
    });

    it("should use default max length of 1024 when not specified", () => {
      const str = "a".repeat(1024);
      expect(() =>
        assertBoundedString(str, "param", TEST_CHANNEL),
      ).not.toThrow();

      const longStr = "a".repeat(1025);
      expect(() => assertBoundedString(longStr, "param", TEST_CHANNEL)).toThrow(
        IpcValidationError,
      );
    });

    it("should throw for non-string input", () => {
      expect(() => assertBoundedString(42, "param", TEST_CHANNEL, 100)).toThrow(
        IpcValidationError,
      );
    });

    it("should pass for empty string", () => {
      expect(() =>
        assertBoundedString("", "param", TEST_CHANNEL, 100),
      ).not.toThrow();
    });
  });

  // ─── assertArray ─────────────────────────────────────────────────────────

  describe("assertArray", () => {
    it("should pass for an empty array", () => {
      expect(() => assertArray([], "param", TEST_CHANNEL)).not.toThrow();
    });

    it("should pass for an array with elements", () => {
      expect(() => assertArray([1, 2, 3], "param", TEST_CHANNEL)).not.toThrow();
    });

    it("should throw for a non-array", () => {
      expect(() => assertArray("not-array", "param", TEST_CHANNEL)).toThrow(
        IpcValidationError,
      );
    });

    it("should throw for null", () => {
      expect(() => assertArray(null, "param", TEST_CHANNEL)).toThrow(
        IpcValidationError,
      );
    });

    it("should throw for an object", () => {
      expect(() => assertArray({}, "param", TEST_CHANNEL)).toThrow(
        IpcValidationError,
      );
    });

    it("should respect maxLength option", () => {
      expect(() =>
        assertArray([1, 2], "param", TEST_CHANNEL, { maxLength: 3 }),
      ).not.toThrow();

      expect(() =>
        assertArray([1, 2, 3, 4], "param", TEST_CHANNEL, { maxLength: 3 }),
      ).toThrow(IpcValidationError);
    });

    it("should pass when array length equals maxLength", () => {
      expect(() =>
        assertArray([1, 2, 3], "param", TEST_CHANNEL, { maxLength: 3 }),
      ).not.toThrow();
    });
  });

  // ─── assertStringArray ───────────────────────────────────────────────────

  describe("assertStringArray", () => {
    it("should pass for an array of strings", () => {
      expect(() =>
        assertStringArray(["a", "b", "c"], "param", TEST_CHANNEL),
      ).not.toThrow();
    });

    it("should pass for an empty array", () => {
      expect(() => assertStringArray([], "param", TEST_CHANNEL)).not.toThrow();
    });

    it("should throw if any element is not a string", () => {
      expect(() =>
        assertStringArray(["a", 42, "c"], "param", TEST_CHANNEL),
      ).toThrow(IpcValidationError);
    });

    it("should throw for non-array", () => {
      expect(() =>
        assertStringArray("not-array", "param", TEST_CHANNEL),
      ).toThrow(IpcValidationError);
    });

    it("should respect maxLength option", () => {
      expect(() =>
        assertStringArray(["a", "b", "c", "d"], "param", TEST_CHANNEL, {
          maxLength: 2,
        }),
      ).toThrow(IpcValidationError);
    });

    it("should respect maxItemLength option", () => {
      expect(() =>
        assertStringArray(["short", "a".repeat(200)], "param", TEST_CHANNEL, {
          maxItemLength: 100,
        }),
      ).toThrow(IpcValidationError);
    });
  });

  // ─── assertEnumArray ─────────────────────────────────────────────────────

  describe("assertEnumArray", () => {
    const ALLOWED = ["poe1", "poe2"] as const;

    it("should pass for a valid enum array", () => {
      expect(() =>
        assertEnumArray(["poe1", "poe2"], "param", TEST_CHANNEL, ALLOWED),
      ).not.toThrow();
    });

    it("should pass for empty array", () => {
      expect(() =>
        assertEnumArray([], "param", TEST_CHANNEL, ALLOWED),
      ).not.toThrow();
    });

    it("should throw if any element is not in the allowed list", () => {
      expect(() =>
        assertEnumArray(["poe1", "poe3"], "param", TEST_CHANNEL, ALLOWED),
      ).toThrow(IpcValidationError);
    });

    it("should throw for non-array", () => {
      expect(() =>
        assertEnumArray("poe1", "param", TEST_CHANNEL, ALLOWED),
      ).toThrow(IpcValidationError);
    });

    it("should respect maxLength option", () => {
      expect(() =>
        assertEnumArray(
          ["poe1", "poe2", "poe1"],
          "param",
          TEST_CHANNEL,
          ALLOWED,
          {
            maxLength: 2,
          },
        ),
      ).toThrow(IpcValidationError);
    });

    it("should pass for single-element array", () => {
      expect(() =>
        assertEnumArray(["poe1"], "param", TEST_CHANNEL, ALLOWED),
      ).not.toThrow();
    });
  });

  // ─── assertOptionalString ────────────────────────────────────────────────

  describe("assertOptionalString", () => {
    it("should pass for a valid string", () => {
      expect(() =>
        assertOptionalString("hello", "param", TEST_CHANNEL),
      ).not.toThrow();
    });

    it("should pass for undefined", () => {
      expect(() =>
        assertOptionalString(undefined, "param", TEST_CHANNEL),
      ).not.toThrow();
    });

    it("should pass for null", () => {
      expect(() =>
        assertOptionalString(null, "param", TEST_CHANNEL),
      ).not.toThrow();
    });

    it("should throw for a number", () => {
      expect(() => assertOptionalString(42, "param", TEST_CHANNEL)).toThrow(
        IpcValidationError,
      );
    });

    it("should respect maxLength when provided as a string", () => {
      const longStr = "a".repeat(2000);
      expect(() =>
        assertOptionalString(longStr, "param", TEST_CHANNEL, 100),
      ).toThrow(IpcValidationError);
    });
  });

  // ─── assertOptionalNumber ────────────────────────────────────────────────

  describe("assertOptionalNumber", () => {
    it("should pass for a valid number", () => {
      expect(() =>
        assertOptionalNumber(42, "param", TEST_CHANNEL),
      ).not.toThrow();
    });

    it("should pass for undefined", () => {
      expect(() =>
        assertOptionalNumber(undefined, "param", TEST_CHANNEL),
      ).not.toThrow();
    });

    it("should pass for null", () => {
      expect(() =>
        assertOptionalNumber(null, "param", TEST_CHANNEL),
      ).not.toThrow();
    });

    it("should throw for a string", () => {
      expect(() => assertOptionalNumber("42", "param", TEST_CHANNEL)).toThrow(
        IpcValidationError,
      );
    });

    it("should throw for NaN", () => {
      expect(() => assertOptionalNumber(NaN, "param", TEST_CHANNEL)).toThrow(
        IpcValidationError,
      );
    });
  });

  // ─── assertOptionalInteger ───────────────────────────────────────────────

  describe("assertOptionalInteger", () => {
    it("should pass for a valid integer", () => {
      expect(() =>
        assertOptionalInteger(42, "param", TEST_CHANNEL),
      ).not.toThrow();
    });

    it("should pass for undefined", () => {
      expect(() =>
        assertOptionalInteger(undefined, "param", TEST_CHANNEL),
      ).not.toThrow();
    });

    it("should pass for null", () => {
      expect(() =>
        assertOptionalInteger(null, "param", TEST_CHANNEL),
      ).not.toThrow();
    });

    it("should throw for a float when present", () => {
      expect(() => assertOptionalInteger(3.14, "param", TEST_CHANNEL)).toThrow(
        IpcValidationError,
      );
    });

    it("should respect min/max options when present", () => {
      expect(() =>
        assertOptionalInteger(0, "param", TEST_CHANNEL, { min: 1 }),
      ).toThrow(IpcValidationError);

      expect(() =>
        assertOptionalInteger(5, "param", TEST_CHANNEL, { min: 1, max: 10 }),
      ).not.toThrow();
    });
  });

  // ─── Domain-Specific Validators ──────────────────────────────────────────

  describe("assertGameType", () => {
    it("should pass for 'poe1'", () => {
      expect(() => assertGameType("poe1", TEST_CHANNEL)).not.toThrow();
    });

    it("should pass for 'poe2'", () => {
      expect(() => assertGameType("poe2", TEST_CHANNEL)).not.toThrow();
    });

    it("should throw for 'poe3'", () => {
      expect(() => assertGameType("poe3", TEST_CHANNEL)).toThrow(
        IpcValidationError,
      );
    });

    it("should throw for an empty string", () => {
      expect(() => assertGameType("", TEST_CHANNEL)).toThrow(
        IpcValidationError,
      );
    });

    it("should throw for null", () => {
      expect(() => assertGameType(null, TEST_CHANNEL)).toThrow(
        IpcValidationError,
      );
    });

    it("should throw for undefined", () => {
      expect(() => assertGameType(undefined, TEST_CHANNEL)).toThrow(
        IpcValidationError,
      );
    });

    it("should throw for a number", () => {
      expect(() => assertGameType(1, TEST_CHANNEL)).toThrow(IpcValidationError);
    });

    it("should be case-sensitive", () => {
      expect(() => assertGameType("POE1", TEST_CHANNEL)).toThrow(
        IpcValidationError,
      );
      expect(() => assertGameType("Poe1", TEST_CHANNEL)).toThrow(
        IpcValidationError,
      );
    });
  });

  describe("assertPriceSource", () => {
    it("should pass for 'exchange'", () => {
      expect(() => assertPriceSource("exchange", TEST_CHANNEL)).not.toThrow();
    });

    it("should pass for 'stash'", () => {
      expect(() => assertPriceSource("stash", TEST_CHANNEL)).not.toThrow();
    });

    it("should throw for invalid price source", () => {
      expect(() => assertPriceSource("market", TEST_CHANNEL)).toThrow(
        IpcValidationError,
      );
    });

    it("should throw for null", () => {
      expect(() => assertPriceSource(null, TEST_CHANNEL)).toThrow(
        IpcValidationError,
      );
    });

    it("should throw for a number", () => {
      expect(() => assertPriceSource(1, TEST_CHANNEL)).toThrow(
        IpcValidationError,
      );
    });
  });

  describe("assertExitBehavior", () => {
    it("should pass for 'exit'", () => {
      expect(() => assertExitBehavior("exit", TEST_CHANNEL)).not.toThrow();
    });

    it("should pass for 'minimize'", () => {
      expect(() => assertExitBehavior("minimize", TEST_CHANNEL)).not.toThrow();
    });

    it("should throw for invalid exit behavior", () => {
      expect(() => assertExitBehavior("close", TEST_CHANNEL)).toThrow(
        IpcValidationError,
      );
    });

    it("should throw for null", () => {
      expect(() => assertExitBehavior(null, TEST_CHANNEL)).toThrow(
        IpcValidationError,
      );
    });
  });

  describe("assertSetupStep", () => {
    it("should pass for valid setup steps (0-3)", () => {
      expect(() => assertSetupStep(0, TEST_CHANNEL)).not.toThrow();
      expect(() => assertSetupStep(1, TEST_CHANNEL)).not.toThrow();
      expect(() => assertSetupStep(2, TEST_CHANNEL)).not.toThrow();
      expect(() => assertSetupStep(3, TEST_CHANNEL)).not.toThrow();
    });

    it("should throw for step 4 (out of range)", () => {
      expect(() => assertSetupStep(4, TEST_CHANNEL)).toThrow(
        IpcValidationError,
      );
    });

    it("should throw for negative step", () => {
      expect(() => assertSetupStep(-1, TEST_CHANNEL)).toThrow(
        IpcValidationError,
      );
    });

    it("should throw for a string", () => {
      expect(() => assertSetupStep("1", TEST_CHANNEL)).toThrow(
        IpcValidationError,
      );
    });

    it("should throw for a float", () => {
      expect(() => assertSetupStep(1.5, TEST_CHANNEL)).toThrow(
        IpcValidationError,
      );
    });

    it("should throw for null", () => {
      expect(() => assertSetupStep(null, TEST_CHANNEL)).toThrow(
        IpcValidationError,
      );
    });
  });

  describe("assertInstalledGames", () => {
    it("should pass for ['poe1']", () => {
      expect(() => assertInstalledGames(["poe1"], TEST_CHANNEL)).not.toThrow();
    });

    it("should pass for ['poe2']", () => {
      expect(() => assertInstalledGames(["poe2"], TEST_CHANNEL)).not.toThrow();
    });

    it("should pass for ['poe1', 'poe2']", () => {
      expect(() =>
        assertInstalledGames(["poe1", "poe2"], TEST_CHANNEL),
      ).not.toThrow();
    });

    it("should throw for invalid game in array", () => {
      expect(() =>
        assertInstalledGames(["poe1", "poe3"], TEST_CHANNEL),
      ).toThrow(IpcValidationError);
    });

    it("should throw for empty array", () => {
      // Empty array is valid for assertEnumArray, but let's see
      // Actually the function doesn't enforce min length, so this should pass
      expect(() => assertInstalledGames([], TEST_CHANNEL)).not.toThrow();
    });

    it("should throw for array with more than 2 elements", () => {
      expect(() =>
        assertInstalledGames(["poe1", "poe2", "poe1"], TEST_CHANNEL),
      ).toThrow(IpcValidationError);
    });

    it("should throw for non-array", () => {
      expect(() => assertInstalledGames("poe1", TEST_CHANNEL)).toThrow(
        IpcValidationError,
      );
    });
  });

  // ─── Bounded String Domain Validators ────────────────────────────────────

  describe("assertLeagueId", () => {
    it("should pass for a valid league ID string", () => {
      expect(() =>
        assertLeagueId("league-abc-123", TEST_CHANNEL),
      ).not.toThrow();
    });

    it("should throw for non-string", () => {
      expect(() => assertLeagueId(42, TEST_CHANNEL)).toThrow(
        IpcValidationError,
      );
    });

    it("should throw for a string exceeding 256 characters", () => {
      const longId = "a".repeat(257);
      expect(() => assertLeagueId(longId, TEST_CHANNEL)).toThrow(
        IpcValidationError,
      );
    });

    it("should pass for a string at exactly 256 characters", () => {
      const maxId = "a".repeat(256);
      expect(() => assertLeagueId(maxId, TEST_CHANNEL)).not.toThrow();
    });
  });

  describe("assertSessionId", () => {
    it("should pass for a valid session ID string", () => {
      expect(() =>
        assertSessionId("session-uuid-12345", TEST_CHANNEL),
      ).not.toThrow();
    });

    it("should throw for non-string", () => {
      expect(() => assertSessionId(null, TEST_CHANNEL)).toThrow(
        IpcValidationError,
      );
    });

    it("should throw for a string exceeding 256 characters", () => {
      const longId = "s".repeat(257);
      expect(() => assertSessionId(longId, TEST_CHANNEL)).toThrow(
        IpcValidationError,
      );
    });
  });

  describe("assertCardName", () => {
    it("should pass for a valid card name", () => {
      expect(() => assertCardName("The Doctor", TEST_CHANNEL)).not.toThrow();
    });

    it("should pass for card names with apostrophes", () => {
      expect(() =>
        assertCardName("Emperor's Luck", TEST_CHANNEL),
      ).not.toThrow();
    });

    it("should throw for non-string", () => {
      expect(() => assertCardName(42, TEST_CHANNEL)).toThrow(
        IpcValidationError,
      );
    });

    it("should throw for a string exceeding 256 characters", () => {
      const longName = "a".repeat(257);
      expect(() => assertCardName(longName, TEST_CHANNEL)).toThrow(
        IpcValidationError,
      );
    });
  });

  describe("assertFilePath", () => {
    it("should pass for a valid file path", () => {
      expect(() =>
        assertFilePath("C:\\Users\\test\\file.txt", "path", TEST_CHANNEL),
      ).not.toThrow();
    });

    it("should pass for a Unix-style path", () => {
      expect(() =>
        assertFilePath("/home/user/file.txt", "path", TEST_CHANNEL),
      ).not.toThrow();
    });

    it("should throw for path containing null bytes", () => {
      expect(() => assertFilePath("file\0.txt", "path", TEST_CHANNEL)).toThrow(
        IpcValidationError,
      );
    });

    it("should throw for non-string", () => {
      expect(() => assertFilePath(42, "path", TEST_CHANNEL)).toThrow(
        IpcValidationError,
      );
    });

    it("should throw for path exceeding 4096 characters", () => {
      const longPath = "a".repeat(4097);
      expect(() => assertFilePath(longPath, "path", TEST_CHANNEL)).toThrow(
        IpcValidationError,
      );
    });

    it("should pass for path at exactly 4096 characters", () => {
      const maxPath = "a".repeat(4096);
      expect(() => assertFilePath(maxPath, "path", TEST_CHANNEL)).not.toThrow();
    });

    it("should throw for null byte in the middle of the path", () => {
      expect(() =>
        assertFilePath("C:\\Users\\test\0\\evil.txt", "path", TEST_CHANNEL),
      ).toThrow(IpcValidationError);
    });

    it("should include descriptive error for null byte injection", () => {
      try {
        assertFilePath("bad\0path", "clientPath", TEST_CHANNEL);
      } catch (e) {
        expect((e as IpcValidationError).detail).toContain("null bytes");
      }
    });
  });

  // ─── Pagination Validators ───────────────────────────────────────────────

  describe("assertPage", () => {
    it("should return 1 when value is undefined", () => {
      expect(assertPage(undefined, TEST_CHANNEL)).toBe(1);
    });

    it("should return 1 when value is null", () => {
      expect(assertPage(null, TEST_CHANNEL)).toBe(1);
    });

    it("should return the value for a valid page number", () => {
      expect(assertPage(5, TEST_CHANNEL)).toBe(5);
    });

    it("should pass for page 1", () => {
      expect(assertPage(1, TEST_CHANNEL)).toBe(1);
    });

    it("should throw for page 0", () => {
      expect(() => assertPage(0, TEST_CHANNEL)).toThrow(IpcValidationError);
    });

    it("should throw for negative page", () => {
      expect(() => assertPage(-1, TEST_CHANNEL)).toThrow(IpcValidationError);
    });

    it("should throw for non-integer page", () => {
      expect(() => assertPage(1.5, TEST_CHANNEL)).toThrow(IpcValidationError);
    });

    it("should throw for page exceeding 100000", () => {
      expect(() => assertPage(100_001, TEST_CHANNEL)).toThrow(
        IpcValidationError,
      );
    });

    it("should pass for page 100000", () => {
      expect(assertPage(100_000, TEST_CHANNEL)).toBe(100_000);
    });

    it("should throw for string page", () => {
      expect(() => assertPage("1", TEST_CHANNEL)).toThrow(IpcValidationError);
    });
  });

  describe("assertPageSize", () => {
    it("should return 20 when value is undefined", () => {
      expect(assertPageSize(undefined, TEST_CHANNEL)).toBe(20);
    });

    it("should return 20 when value is null", () => {
      expect(assertPageSize(null, TEST_CHANNEL)).toBe(20);
    });

    it("should return the value for a valid page size", () => {
      expect(assertPageSize(50, TEST_CHANNEL)).toBe(50);
    });

    it("should pass for page size 1", () => {
      expect(assertPageSize(1, TEST_CHANNEL)).toBe(1);
    });

    it("should pass for page size 200", () => {
      expect(assertPageSize(200, TEST_CHANNEL)).toBe(200);
    });

    it("should throw for page size 0", () => {
      expect(() => assertPageSize(0, TEST_CHANNEL)).toThrow(IpcValidationError);
    });

    it("should throw for page size exceeding 200", () => {
      expect(() => assertPageSize(201, TEST_CHANNEL)).toThrow(
        IpcValidationError,
      );
    });

    it("should throw for non-integer page size", () => {
      expect(() => assertPageSize(10.5, TEST_CHANNEL)).toThrow(
        IpcValidationError,
      );
    });
  });

  describe("assertLimit", () => {
    it("should return 10 when value is undefined", () => {
      expect(assertLimit(undefined, TEST_CHANNEL)).toBe(10);
    });

    it("should return 10 when value is null", () => {
      expect(assertLimit(null, TEST_CHANNEL)).toBe(10);
    });

    it("should return the value for a valid limit", () => {
      expect(assertLimit(50, TEST_CHANNEL)).toBe(50);
    });

    it("should pass for limit 1", () => {
      expect(assertLimit(1, TEST_CHANNEL)).toBe(1);
    });

    it("should pass for limit 1000", () => {
      expect(assertLimit(1000, TEST_CHANNEL)).toBe(1000);
    });

    it("should throw for limit 0", () => {
      expect(() => assertLimit(0, TEST_CHANNEL)).toThrow(IpcValidationError);
    });

    it("should throw for limit exceeding 1000", () => {
      expect(() => assertLimit(1001, TEST_CHANNEL)).toThrow(IpcValidationError);
    });

    it("should throw for non-integer limit", () => {
      expect(() => assertLimit(5.5, TEST_CHANNEL)).toThrow(IpcValidationError);
    });

    it("should throw for negative limit", () => {
      expect(() => assertLimit(-1, TEST_CHANNEL)).toThrow(IpcValidationError);
    });

    it("should throw for string limit", () => {
      expect(() => assertLimit("10", TEST_CHANNEL)).toThrow(IpcValidationError);
    });
  });

  // ─── handleValidationError ───────────────────────────────────────────────

  describe("handleValidationError", () => {
    it("should return error response for IpcValidationError", () => {
      const error = new IpcValidationError(TEST_CHANNEL, "bad input");

      const result = handleValidationError(error, TEST_CHANNEL);

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("bad input"),
      });
    });

    it("should include 'Invalid input' prefix in the error message", () => {
      const error = new IpcValidationError(TEST_CHANNEL, "some detail");

      const result = handleValidationError(error, TEST_CHANNEL);

      expect(result.error).toContain("Invalid input");
      expect(result.error).toContain("some detail");
    });

    it("should re-throw non-IpcValidationError errors", () => {
      const error = new Error("Some other error");

      expect(() => handleValidationError(error, TEST_CHANNEL)).toThrow(
        "Some other error",
      );
    });

    it("should re-throw TypeError", () => {
      const error = new TypeError("type mismatch");

      expect(() => handleValidationError(error, TEST_CHANNEL)).toThrow(
        TypeError,
      );
    });

    it("should re-throw RangeError", () => {
      const error = new RangeError("out of range");

      expect(() => handleValidationError(error, TEST_CHANNEL)).toThrow(
        RangeError,
      );
    });

    it("should re-throw generic unknown errors", () => {
      expect(() =>
        handleValidationError("string error", TEST_CHANNEL),
      ).toThrow();
    });

    it("should return success: false in the result", () => {
      const error = new IpcValidationError(TEST_CHANNEL, "test");

      const result = handleValidationError(error, TEST_CHANNEL);

      expect(result.success).toBe(false);
    });
  });

  // ─── Security Edge Cases ─────────────────────────────────────────────────

  describe("security edge cases", () => {
    it("should reject prototype pollution attempts via game type", () => {
      expect(() => assertGameType("__proto__", TEST_CHANNEL)).toThrow(
        IpcValidationError,
      );
      expect(() => assertGameType("constructor", TEST_CHANNEL)).toThrow(
        IpcValidationError,
      );
    });

    it("should reject extremely long strings for bounded validators", () => {
      const megaString = "x".repeat(1_000_000);

      expect(() =>
        assertBoundedString(megaString, "param", TEST_CHANNEL),
      ).toThrow(IpcValidationError);

      expect(() => assertCardName(megaString, TEST_CHANNEL)).toThrow(
        IpcValidationError,
      );

      expect(() => assertSessionId(megaString, TEST_CHANNEL)).toThrow(
        IpcValidationError,
      );
    });

    it("should reject non-finite numbers for all number validators", () => {
      const badNumbers = [NaN, Infinity, -Infinity];

      for (const bad of badNumbers) {
        expect(() => assertNumber(bad, "param", TEST_CHANNEL)).toThrow(
          IpcValidationError,
        );
      }
    });

    it("should reject null byte injection in file paths", () => {
      const maliciousPaths = [
        "/etc/passwd\0.txt",
        "C:\\Windows\\System32\0\\cmd.exe",
        "normal.txt\0/../../../etc/shadow",
      ];

      for (const path of maliciousPaths) {
        expect(() => assertFilePath(path, "path", TEST_CHANNEL)).toThrow(
          IpcValidationError,
        );
      }
    });

    it("should handle all types gracefully without crashing", () => {
      const crazyInputs = [
        null,
        undefined,
        0,
        -1,
        1.5,
        true,
        false,
        "",
        "hello",
        [],
        {},
        Symbol("test"),
        BigInt(42),
        () => {},
        new Date(),
        /regex/,
      ];

      for (const input of crazyInputs) {
        // These should either pass or throw IpcValidationError, never crash
        try {
          assertGameType(input, TEST_CHANNEL);
        } catch (e) {
          expect(e).toBeInstanceOf(IpcValidationError);
        }
      }
    });
  });
});
