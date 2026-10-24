import type { IpcMainInvokeEvent, WebContents } from "electron";
import { describe, expect, it, vi } from "vitest";

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
  assertOptionalEnum,
  assertOptionalInteger,
  assertOptionalNumber,
  assertOptionalString,
  assertPage,
  assertPageSize,
  assertSessionId,
  assertSetupStep,
  assertString,
  assertStringArray,
  assertTrustedSender,
  handleValidationError,
  IpcValidationError,
  registerTrustedWebContents,
  validateFileDialogOptions,
} from "../ipc-validation";

const CHANNEL = "test:channel";

function expectValidationError(action: () => unknown, detail: string): void {
  expect(action).toThrowError(IpcValidationError);
  expect(action).toThrowError(detail);
}

describe("IPC validation", () => {
  it("accepts the registered sender and rejects another renderer", () => {
    expectValidationError(
      () =>
        assertTrustedSender(
          { sender: { id: 42 } } as unknown as IpcMainInvokeEvent,
          CHANNEL,
        ),
      "Trusted webContents not registered",
    );

    registerTrustedWebContents({ id: 42 } as WebContents);

    expect(() =>
      assertTrustedSender(
        { sender: { id: 42 } } as unknown as IpcMainInvokeEvent,
        CHANNEL,
      ),
    ).not.toThrow();
    expectValidationError(
      () =>
        assertTrustedSender(
          { sender: { id: 7 } } as unknown as IpcMainInvokeEvent,
          CHANNEL,
        ),
      "untrusted webContents",
    );
  });

  it("validates primitive values and reports their runtime types", () => {
    expect(() => assertString("value", "name", CHANNEL)).not.toThrow();
    expectValidationError(
      () => assertString(1, "name", CHANNEL),
      'Expected "name" to be a string',
    );

    expect(() => assertNumber(1.5, "count", CHANNEL)).not.toThrow();
    expectValidationError(
      () => assertNumber("1", "count", CHANNEL),
      "got string",
    );
    expectValidationError(
      () => assertNumber(Number.POSITIVE_INFINITY, "count", CHANNEL),
      "got Infinity",
    );

    expect(() => assertBoolean(true, "enabled", CHANNEL)).not.toThrow();
    expectValidationError(
      () => assertBoolean(1, "enabled", CHANNEL),
      'Expected "enabled" to be a boolean',
    );
  });

  it("validates required and optional enums", () => {
    const allowed = ["one", "two"] as const;

    expect(() => assertEnum("one", "value", CHANNEL, allowed)).not.toThrow();
    expectValidationError(
      () => assertEnum("three", "value", CHANNEL, allowed),
      "to be one of [one, two]",
    );
    expectValidationError(
      () => assertEnum(1, "value", CHANNEL, allowed),
      "to be a string",
    );

    expect(() =>
      assertOptionalEnum(undefined, "value", CHANNEL, allowed),
    ).not.toThrow();
    expect(() =>
      assertOptionalEnum(null, "value", CHANNEL, allowed),
    ).not.toThrow();
    expect(() =>
      assertOptionalEnum("two", "value", CHANNEL, allowed),
    ).not.toThrow();
    expectValidationError(
      () => assertOptionalEnum(1, "value", CHANNEL, allowed),
      "must be a string",
    );
    expectValidationError(
      () => assertOptionalEnum("three", "value", CHANNEL, allowed),
      "must be one of [one, two]",
    );
  });

  it("validates bounded integers and strings", () => {
    expect(() => assertInteger(2, "value", CHANNEL)).not.toThrow();
    expect(() =>
      assertInteger(2, "value", CHANNEL, { min: 1, max: 3 }),
    ).not.toThrow();
    expectValidationError(
      () => assertInteger(1.5, "value", CHANNEL),
      "to be an integer",
    );
    expectValidationError(
      () => assertInteger(0, "value", CHANNEL, { min: 1 }),
      "to be >= 1",
    );
    expectValidationError(
      () => assertInteger(4, "value", CHANNEL, { max: 3 }),
      "to be <= 3",
    );

    expect(() => assertBoundedString("short", "value", CHANNEL)).not.toThrow();
    expect(() =>
      assertBoundedString("short", "value", CHANNEL, 5),
    ).not.toThrow();
    expectValidationError(
      () => assertBoundedString("long", "value", CHANNEL, 3),
      "exceeds max length of 3",
    );
  });

  it("validates arrays, strings arrays, and enum arrays", () => {
    expect(() => assertArray([], "items", CHANNEL)).not.toThrow();
    expect(() =>
      assertArray([1], "items", CHANNEL, { maxLength: 1 }),
    ).not.toThrow();
    expectValidationError(
      () => assertArray({}, "items", CHANNEL),
      "to be an array",
    );
    expectValidationError(
      () => assertArray([1, 2], "items", CHANNEL, { maxLength: 1 }),
      "array exceeds max length",
    );

    expect(() => assertStringArray(["a"], "items", CHANNEL)).not.toThrow();
    expect(() =>
      assertStringArray(["a"], "items", CHANNEL, {
        maxLength: 1,
        maxItemLength: 1,
      }),
    ).not.toThrow();
    expectValidationError(
      () => assertStringArray([1], "items", CHANNEL),
      'Expected "items[0]" to be a string',
    );
    expectValidationError(
      () => assertStringArray(["ab"], "items", CHANNEL, { maxItemLength: 1 }),
      '"items[0]" exceeds max length',
    );

    expect(() =>
      assertEnumArray(["one"], "items", CHANNEL, ["one", "two"]),
    ).not.toThrow();
    expectValidationError(
      () => assertEnumArray(["three"], "items", CHANNEL, ["one", "two"]),
      "to be one of [one, two]",
    );
  });

  it("accepts absent optional values and validates present values", () => {
    expect(() =>
      assertOptionalString(undefined, "value", CHANNEL),
    ).not.toThrow();
    expect(() => assertOptionalString(null, "value", CHANNEL)).not.toThrow();
    expect(() => assertOptionalString("ok", "value", CHANNEL, 2)).not.toThrow();
    expectValidationError(
      () => assertOptionalString("long", "value", CHANNEL, 2),
      "exceeds max length",
    );

    expect(() =>
      assertOptionalNumber(undefined, "value", CHANNEL),
    ).not.toThrow();
    expect(() => assertOptionalNumber(null, "value", CHANNEL)).not.toThrow();
    expect(() => assertOptionalNumber(1, "value", CHANNEL)).not.toThrow();
    expectValidationError(
      () => assertOptionalNumber(Number.NaN, "value", CHANNEL),
      "finite number",
    );

    expect(() =>
      assertOptionalInteger(undefined, "value", CHANNEL),
    ).not.toThrow();
    expect(() => assertOptionalInteger(null, "value", CHANNEL)).not.toThrow();
    expect(() =>
      assertOptionalInteger(2, "value", CHANNEL, { min: 1, max: 3 }),
    ).not.toThrow();
    expectValidationError(
      () => assertOptionalInteger(0, "value", CHANNEL, { min: 1 }),
      "to be >= 1",
    );
  });

  it("validates domain-specific values", () => {
    expect(() => assertGameType("poe1", CHANNEL)).not.toThrow();
    expectValidationError(
      () => assertGameType("other", CHANNEL),
      "to be one of [poe1, poe2]",
    );
    expect(() => assertExitBehavior("exit", CHANNEL)).not.toThrow();
    expectValidationError(
      () => assertExitBehavior("close", CHANNEL),
      "to be one of [exit, minimize]",
    );
    expect(() => assertSetupStep(4, CHANNEL)).not.toThrow();
    expectValidationError(
      () => assertSetupStep(5, CHANNEL),
      'Expected "step" to be one of [0, 1, 2, 3, 4]',
    );
    expect(() => assertInstalledGames(["poe1", "poe2"], CHANNEL)).not.toThrow();
    expectValidationError(
      () => assertInstalledGames(["poe1", "poe2", "poe1"], CHANNEL),
      "array exceeds max length",
    );

    expect(() => assertLeagueId("league", CHANNEL)).not.toThrow();
    expect(() => assertSessionId("session", CHANNEL)).not.toThrow();
    expect(() => assertCardName("card", CHANNEL)).not.toThrow();
  });

  it("validates file paths and rejects null-byte injection", () => {
    expect(() =>
      assertFilePath("C:\\safe\\file.txt", "path", CHANNEL),
    ).not.toThrow();
    expectValidationError(
      () => assertFilePath("safe\0unsafe", "path", CHANNEL),
      "contains null bytes",
    );
  });

  it("defaults and bounds pagination values", () => {
    expect(assertPage(undefined, CHANNEL)).toBe(1);
    expect(assertPage(null, CHANNEL)).toBe(1);
    expect(assertPage(2, CHANNEL)).toBe(2);
    expectValidationError(() => assertPage(0, CHANNEL), "to be >= 1");

    expect(assertPageSize(undefined, CHANNEL)).toBe(20);
    expect(assertPageSize(null, CHANNEL)).toBe(20);
    expect(assertPageSize(50, CHANNEL)).toBe(50);
    expectValidationError(() => assertPageSize(201, CHANNEL), "to be <= 200");

    expect(assertLimit(undefined, CHANNEL)).toBe(10);
    expect(assertLimit(null, CHANNEL)).toBe(10);
    expect(assertLimit(100, CHANNEL)).toBe(100);
    expectValidationError(() => assertLimit(1001, CHANNEL), "to be <= 1000");
  });

  it("returns safe file-dialog defaults for invalid input", () => {
    expect(validateFileDialogOptions(null, CHANNEL)).toEqual({
      title: "Select File",
      filters: [],
      properties: ["openFile"],
    });
    expect(validateFileDialogOptions("invalid", CHANNEL)).toEqual({
      title: "Select File",
      filters: [],
      properties: ["openFile"],
    });
    expect(validateFileDialogOptions({}, CHANNEL)).toEqual({
      title: "Select File",
      filters: [],
      properties: ["openFile"],
    });
  });

  it("sanitizes file-dialog options to the allowed fields", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    expect(
      validateFileDialogOptions(
        {
          buttonLabel: "ignored",
          defaultPath: "ignored",
          filters: [{ extensions: ["png", "jpg"], name: "Images" }],
          properties: ["openFile", "createDirectory"],
          title: "Choose an image",
        },
        CHANNEL,
      ),
    ).toEqual({
      filters: [{ extensions: ["png", "jpg"], name: "Images" }],
      properties: ["openFile"],
      title: "Choose an image",
    });
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("createDirectory"),
    );

    expect(
      validateFileDialogOptions({ properties: ["not-allowed"] }, CHANNEL),
    ).toMatchObject({ properties: ["openFile"] });
    warn.mockRestore();
  });

  it("rejects malformed file-dialog filters and properties", () => {
    expectValidationError(
      () => validateFileDialogOptions({ filters: [null] }, CHANNEL),
      '"filters[0]" must be an object',
    );
    expectValidationError(
      () => validateFileDialogOptions({ filters: ["bad"] }, CHANNEL),
      '"filters[0]" must be an object',
    );
    expectValidationError(
      () => validateFileDialogOptions({ properties: [1] }, CHANNEL),
      '"properties[0]" must be a string',
    );
  });

  it("converts validation failures to safe responses and rethrows other errors", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const error = new IpcValidationError(CHANNEL, "bad input");

    expect(error.name).toBe("IpcValidationError");
    expect(error.channel).toBe(CHANNEL);
    expect(handleValidationError(error, CHANNEL)).toEqual({
      error: "Invalid input: bad input",
      success: false,
    });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("bad input"));

    const unexpected = new Error("unexpected");
    expect(() => handleValidationError(unexpected, CHANNEL)).toThrow(
      unexpected,
    );
    warn.mockRestore();
  });
});
