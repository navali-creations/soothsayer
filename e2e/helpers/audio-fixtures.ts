/**
 * Audio Fixture Helpers for E2E Tests
 *
 * Seeds and cleans up dummy `.mp3` files in the PoE custom sounds directory
 * so that audio settings tests can exercise the full scan → select → preview
 * → reset flow with real files on disk.
 *
 * The PoE sounds directory is `Documents/My Games/Path of Exile` — the same
 * path that `SettingsStoreService.getPoeSoundsDirectory()` resolves to.
 * We discover the documents path via `app.evaluate()` so it is always
 * consistent with what the main process sees, then perform all file
 * operations in the test (Node.js) process using standard `node:fs` and
 * `node:path` APIs.
 *
 * @module e2e/helpers/audio-fixtures
 */

import fs from "node:fs";
import path from "node:path";

import type { ElectronApplication } from "@playwright/test";

/**
 * Well-known fixture sound filenames.
 * Tests can reference these by name when asserting dropdown options.
 */
export const FIXTURE_SOUNDS = [
  "e2e-alert-one.mp3",
  "e2e-alert-two.mp3",
  "e2e-chime.mp3",
] as const;

export type FixtureSoundName = (typeof FIXTURE_SOUNDS)[number];

/**
 * A minimal valid MP3 frame (MPEG1 Layer 3, 128 kbps, 44100 Hz, mono).
 *
 * This is a single silent MPEG audio frame — just enough bytes for the
 * file to be recognised as `.mp3` by any code that checks the extension
 * or tries to read it as audio. It won't produce audible output.
 *
 * Header bytes: 0xFF 0xFB 0x90 0x00
 *   - Sync word:      0xFFF (11 bits)
 *   - MPEG version:   1 (MPEG1)
 *   - Layer:          3 (Layer III)
 *   - Bitrate index:  1001 → 128 kbps
 *   - Sample rate:    00 → 44100 Hz
 *   - Padding:        0
 *   - Channel mode:   00 → Stereo
 *
 * The rest of the 417-byte frame is zero-filled (silence).
 */
function createMinimalMp3Buffer(): Buffer {
  const FRAME_SIZE = 417; // bytes for 128 kbps / 44100 Hz MPEG1 Layer 3
  const buf = Buffer.alloc(FRAME_SIZE, 0);
  // MP3 sync word + header
  buf[0] = 0xff;
  buf[1] = 0xfb;
  buf[2] = 0x90;
  buf[3] = 0x00;
  return buf;
}

/**
 * Resolves the PoE custom sounds directory from the running Electron main
 * process. This guarantees we write to the exact same path the app reads from.
 */
export async function getSoundsDirectory(
  app: ElectronApplication,
): Promise<string> {
  const documentsPath = await app.evaluate(({ app: electronApp }) =>
    electronApp.getPath("documents"),
  );
  return path.join(documentsPath, "My Games", "Path of Exile");
}

/**
 * Seeds dummy `.mp3` fixture files into the PoE sounds directory.
 *
 * Creates the directory if it doesn't exist, then writes a minimal
 * silent MP3 frame for each fixture filename.
 *
 * @returns The absolute path to the sounds directory (for assertions).
 */
export async function seedAudioFixtures(
  app: ElectronApplication,
): Promise<string> {
  const soundsDir = await getSoundsDirectory(app);
  const mp3Buffer = createMinimalMp3Buffer();

  // Create directory tree if missing
  fs.mkdirSync(soundsDir, { recursive: true });

  for (const filename of FIXTURE_SOUNDS) {
    const filePath = path.join(soundsDir, filename);
    // Only write if it doesn't already exist (idempotent)
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, mp3Buffer);
    }
  }

  return soundsDir;
}

/**
 * Removes the dummy fixture `.mp3` files from the PoE sounds directory.
 *
 * Only deletes files whose names match `FIXTURE_SOUNDS` — never touches
 * real user sound files. Silently ignores files that don't exist.
 */
export async function cleanupAudioFixtures(
  app: ElectronApplication,
): Promise<void> {
  const soundsDir = await getSoundsDirectory(app);

  for (const filename of FIXTURE_SOUNDS) {
    const filePath = path.join(soundsDir, filename);
    try {
      fs.unlinkSync(filePath);
    } catch {
      // File doesn't exist or is locked — ignore
    }
  }
}
