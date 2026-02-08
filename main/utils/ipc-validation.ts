/**
 * IPC Input Validation Utilities
 *
 * Runtime validation for IPC handler parameters coming from the renderer process.
 * TypeScript types are erased at runtime, so we need explicit checks to ensure
 * the renderer (which could be compromised) sends well-formed data.
 */

export class IpcValidationError extends Error {
  constructor(
    public readonly channel: string,
    public readonly detail: string,
  ) {
    super(`[IPC Validation] ${channel}: ${detail}`);
    this.name = "IpcValidationError";
  }
}

// ─── Primitive Validators ────────────────────────────────────────────────────

export function assertString(
  value: unknown,
  paramName: string,
  channel: string,
): asserts value is string {
  if (typeof value !== "string") {
    throw new IpcValidationError(
      channel,
      `Expected "${paramName}" to be a string, got ${typeof value}`,
    );
  }
}

export function assertNumber(
  value: unknown,
  paramName: string,
  channel: string,
): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new IpcValidationError(
      channel,
      `Expected "${paramName}" to be a finite number, got ${
        typeof value === "number" ? value : typeof value
      }`,
    );
  }
}

export function assertBoolean(
  value: unknown,
  paramName: string,
  channel: string,
): asserts value is boolean {
  if (typeof value !== "boolean") {
    throw new IpcValidationError(
      channel,
      `Expected "${paramName}" to be a boolean, got ${typeof value}`,
    );
  }
}

export function assertEnum<T extends string>(
  value: unknown,
  paramName: string,
  channel: string,
  allowed: readonly T[],
): asserts value is T {
  assertString(value, paramName, channel);
  if (!(allowed as readonly string[]).includes(value)) {
    throw new IpcValidationError(
      channel,
      `Expected "${paramName}" to be one of [${allowed.join(
        ", ",
      )}], got "${value}"`,
    );
  }
}

export function assertInteger(
  value: unknown,
  paramName: string,
  channel: string,
  opts?: { min?: number; max?: number },
): asserts value is number {
  assertNumber(value, paramName, channel);
  if (!Number.isInteger(value)) {
    throw new IpcValidationError(
      channel,
      `Expected "${paramName}" to be an integer, got ${value}`,
    );
  }
  if (opts?.min !== undefined && value < opts.min) {
    throw new IpcValidationError(
      channel,
      `Expected "${paramName}" to be >= ${opts.min}, got ${value}`,
    );
  }
  if (opts?.max !== undefined && value > opts.max) {
    throw new IpcValidationError(
      channel,
      `Expected "${paramName}" to be <= ${opts.max}, got ${value}`,
    );
  }
}

// ─── Bounded String ──────────────────────────────────────────────────────────

/**
 * Validates a string with a maximum length to prevent memory exhaustion attacks.
 */
export function assertBoundedString(
  value: unknown,
  paramName: string,
  channel: string,
  maxLength: number = 1024,
): asserts value is string {
  assertString(value, paramName, channel);
  if (value.length > maxLength) {
    throw new IpcValidationError(
      channel,
      `"${paramName}" exceeds max length of ${maxLength} (got ${value.length})`,
    );
  }
}

// ─── Array Validators ────────────────────────────────────────────────────────

export function assertArray(
  value: unknown,
  paramName: string,
  channel: string,
  opts?: { maxLength?: number },
): asserts value is unknown[] {
  if (!Array.isArray(value)) {
    throw new IpcValidationError(
      channel,
      `Expected "${paramName}" to be an array, got ${typeof value}`,
    );
  }
  if (opts?.maxLength !== undefined && value.length > opts.maxLength) {
    throw new IpcValidationError(
      channel,
      `"${paramName}" array exceeds max length of ${opts.maxLength} (got ${value.length})`,
    );
  }
}

export function assertStringArray(
  value: unknown,
  paramName: string,
  channel: string,
  opts?: { maxLength?: number; maxItemLength?: number },
): asserts value is string[] {
  assertArray(value, paramName, channel, { maxLength: opts?.maxLength });
  const arr = value as unknown[];
  for (let i = 0; i < arr.length; i++) {
    if (typeof arr[i] !== "string") {
      throw new IpcValidationError(
        channel,
        `Expected "${paramName}[${i}]" to be a string, got ${typeof arr[i]}`,
      );
    }
    if (
      opts?.maxItemLength !== undefined &&
      (arr[i] as string).length > opts.maxItemLength
    ) {
      throw new IpcValidationError(
        channel,
        `"${paramName}[${i}]" exceeds max length of ${opts.maxItemLength}`,
      );
    }
  }
}

export function assertEnumArray<T extends string>(
  value: unknown,
  paramName: string,
  channel: string,
  allowed: readonly T[],
  opts?: { maxLength?: number },
): asserts value is T[] {
  assertArray(value, paramName, channel, { maxLength: opts?.maxLength });
  const arr = value as unknown[];
  for (let i = 0; i < arr.length; i++) {
    assertEnum(arr[i], `${paramName}[${i}]`, channel, allowed);
  }
}

// ─── Optional Variants ──────────────────────────────────────────────────────

export function assertOptionalString(
  value: unknown,
  paramName: string,
  channel: string,
  maxLength: number = 1024,
): asserts value is string | undefined | null {
  if (value === undefined || value === null) return;
  assertBoundedString(value, paramName, channel, maxLength);
}

export function assertOptionalNumber(
  value: unknown,
  paramName: string,
  channel: string,
): asserts value is number | undefined | null {
  if (value === undefined || value === null) return;
  assertNumber(value, paramName, channel);
}

export function assertOptionalInteger(
  value: unknown,
  paramName: string,
  channel: string,
  opts?: { min?: number; max?: number },
): asserts value is number | undefined | null {
  if (value === undefined || value === null) return;
  assertInteger(value, paramName, channel, opts);
}

// ─── Domain-Specific Validators ──────────────────────────────────────────────

const VALID_GAMES = ["poe1", "poe2"] as const;
const VALID_PRICE_SOURCES = ["exchange", "stash"] as const;
const VALID_EXIT_BEHAVIORS = ["exit", "minimize"] as const;
const VALID_SETUP_STEPS = [0, 1, 2, 3] as const;

export function assertGameType(
  value: unknown,
  channel: string,
): asserts value is "poe1" | "poe2" {
  assertEnum(value, "game", channel, VALID_GAMES);
}

export function assertPriceSource(
  value: unknown,
  channel: string,
): asserts value is "exchange" | "stash" {
  assertEnum(value, "priceSource", channel, VALID_PRICE_SOURCES);
}

export function assertExitBehavior(
  value: unknown,
  channel: string,
): asserts value is "exit" | "minimize" {
  assertEnum(value, "exitBehavior", channel, VALID_EXIT_BEHAVIORS);
}

export function assertSetupStep(
  value: unknown,
  channel: string,
): asserts value is 0 | 1 | 2 | 3 {
  assertNumber(value, "step", channel);
  if (!(VALID_SETUP_STEPS as readonly number[]).includes(value)) {
    throw new IpcValidationError(
      channel,
      `Expected "step" to be one of [${VALID_SETUP_STEPS.join(
        ", ",
      )}], got ${value}`,
    );
  }
}

export function assertInstalledGames(
  value: unknown,
  channel: string,
): asserts value is ("poe1" | "poe2")[] {
  assertEnumArray(value, "games", channel, VALID_GAMES, { maxLength: 2 });
}

export function assertLeagueId(
  value: unknown,
  channel: string,
): asserts value is string {
  assertBoundedString(value, "leagueId", channel, 256);
}

export function assertSessionId(
  value: unknown,
  channel: string,
): asserts value is string {
  assertBoundedString(value, "sessionId", channel, 256);
}

export function assertCardName(
  value: unknown,
  channel: string,
): asserts value is string {
  assertBoundedString(value, "cardName", channel, 256);
}

/**
 * Validates a file path string:
 * - Must be a string
 * - Must not contain null bytes (path traversal via null byte injection)
 * - Bounded length
 */
export function assertFilePath(
  value: unknown,
  paramName: string,
  channel: string,
): asserts value is string {
  assertBoundedString(value, paramName, channel, 4096);
  if ((value as string).includes("\0")) {
    throw new IpcValidationError(channel, `"${paramName}" contains null bytes`);
  }
}

// ─── Pagination Validators ───────────────────────────────────────────────────

export function assertPage(value: unknown, channel: string): number {
  if (value === undefined || value === null) return 1;
  assertInteger(value, "page", channel, { min: 1, max: 100_000 });
  return value;
}

export function assertPageSize(value: unknown, channel: string): number {
  if (value === undefined || value === null) return 20;
  assertInteger(value, "pageSize", channel, { min: 1, max: 200 });
  return value;
}

export function assertLimit(value: unknown, channel: string): number {
  if (value === undefined || value === null) return 10;
  assertInteger(value, "limit", channel, { min: 1, max: 1000 });
  return value;
}

// ─── select-file Validator ───────────────────────────────────────────────────

/**
 * Allowed `properties` values for `dialog.showOpenDialog`.
 * This prevents the renderer from passing dangerous/unexpected properties.
 */
const ALLOWED_DIALOG_PROPERTIES = [
  "openFile",
  "openDirectory",
  "multiSelections",
  "showHiddenFiles",
] as const;

type AllowedDialogProperty = (typeof ALLOWED_DIALOG_PROPERTIES)[number];

export interface ValidatedFileDialogOptions {
  title: string;
  filters: Array<{ name: string; extensions: string[] }>;
  properties: AllowedDialogProperty[];
}

/**
 * Validates and sanitizes options passed to `dialog.showOpenDialog`.
 * Only allows a strict allowlist of fields — ignores everything else
 * (e.g. `defaultPath`, `buttonLabel`, `message`, `securityScopedBookmarks`).
 */
export function validateFileDialogOptions(
  raw: unknown,
  channel: string,
): ValidatedFileDialogOptions {
  if (typeof raw !== "object" || raw === null) {
    // Return safe defaults
    return {
      title: "Select File",
      filters: [],
      properties: ["openFile"],
    };
  }

  const obj = raw as Record<string, unknown>;

  // Title
  let title = "Select File";
  if (obj.title !== undefined) {
    assertBoundedString(obj.title, "title", channel, 200);
    title = obj.title;
  }

  // Filters
  let filters: Array<{ name: string; extensions: string[] }> = [];
  if (obj.filters !== undefined) {
    assertArray(obj.filters, "filters", channel, { maxLength: 20 });
    filters = (obj.filters as unknown[]).map((f, i) => {
      if (typeof f !== "object" || f === null) {
        throw new IpcValidationError(
          channel,
          `"filters[${i}]" must be an object with {name, extensions}`,
        );
      }
      const filter = f as Record<string, unknown>;

      assertBoundedString(filter.name, `filters[${i}].name`, channel, 100);
      assertStringArray(
        filter.extensions,
        `filters[${i}].extensions`,
        channel,
        {
          maxLength: 50,
          maxItemLength: 20,
        },
      );

      // Only return allowed fields
      return {
        name: filter.name,
        extensions: filter.extensions as string[],
      };
    });
  }

  // Properties
  let properties: AllowedDialogProperty[] = ["openFile"];
  if (obj.properties !== undefined) {
    assertArray(obj.properties, "properties", channel, { maxLength: 10 });
    const requested = obj.properties as unknown[];
    const validated: AllowedDialogProperty[] = [];

    for (let i = 0; i < requested.length; i++) {
      const prop = requested[i];
      if (typeof prop !== "string") {
        throw new IpcValidationError(
          channel,
          `"properties[${i}]" must be a string, got ${typeof prop}`,
        );
      }
      if ((ALLOWED_DIALOG_PROPERTIES as readonly string[]).includes(prop)) {
        validated.push(prop as AllowedDialogProperty);
      } else {
        console.warn(
          `[IPC Validation] ${channel}: Ignoring disallowed dialog property "${prop}"`,
        );
      }
    }

    properties = validated.length > 0 ? validated : ["openFile"];
  }

  return { title, filters, properties };
}

// ─── Handler Wrapper ─────────────────────────────────────────────────────────

/**
 * Wraps an IPC validation error into a safe error response.
 * Use this in catch blocks of IPC handlers.
 *
 * @example
 * ```
 * ipcMain.handle(channel, async (_event, game: unknown) => {
 *   try {
 *     assertGameType(game, channel);
 *     return await doSomething(game);
 *   } catch (error) {
 *     return handleValidationError(error, channel);
 *   }
 * });
 * ```
 */
export function handleValidationError(
  error: unknown,
  _channel: string,
): { success: false; error: string } | never {
  if (error instanceof IpcValidationError) {
    console.warn(`[Security] ${error.message}`);
    return { success: false, error: `Invalid input: ${error.detail}` };
  }
  // Re-throw non-validation errors
  throw error;
}
