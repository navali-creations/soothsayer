import * as Sentry from "@sentry/electron/main";
import { app } from "electron";

import { maskPath } from "~/main/utils/mask-path";

import pkgJson from "../../../package.json" with { type: "json" };

const PATH_ANCHORS = [
  "soothsayer",
  "Soothsayer",
  "Path of Exile",
  "Path of Exile 2",
];

// Regex to find Windows/Unix absolute paths in arbitrary strings.
//
// Windows: C:\segment\segment\...  (drive letter + :\ + first segment, then \segment repeats)
// Unix:    /home/segment/...  or  /Users/segment/...  or  /tmp/segment/...
//
// A "segment" is one or more word/dot/hyphen/paren characters. Multi-word
// directory names like "Path of Exile" are supported by allowing
// `( <word>)+` ONLY when followed by a path separator (\ or /). This
// prevents the regex from greedily consuming inter-path prose like
// " and " or " loading ".
//
// segment      = [\w.\-()]+ (no spaces — base segment)
// spaced-name  = segment( segment)+ only when followed by [\/\\]
// full-segment = spaced-name | segment
const PATH_SEGMENT = /[\w.\-()]+(?:(?: [\w.\-()]+)+(?=[/\\]))?/;
const PATH_REGEX = new RegExp(
  // Windows paths: C:\first-segment\more-segments...
  `(?:[A-Z]:\\\\${PATH_SEGMENT.source}(?:\\\\${PATH_SEGMENT.source})*)` +
    `|` +
    // Unix paths: /home/..., /Users/..., /tmp/...
    `(?:\\/(?:home|Users|tmp)(?:\\/${PATH_SEGMENT.source})+)`,
  "gi",
);

function scrubPaths(text: string): string {
  return text.replace(PATH_REGEX, (match) => maskPath(match, PATH_ANCHORS));
}

function scrubBreadcrumbData(
  data: Record<string, unknown>,
): Record<string, unknown> {
  const scrubbed: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(data)) {
    if (typeof val === "string") {
      scrubbed[key] = scrubPaths(val);
    } else if (Array.isArray(val)) {
      scrubbed[key] = val.map((v) =>
        typeof v === "string" ? scrubPaths(v) : v,
      );
    } else {
      scrubbed[key] = val;
    }
  }
  return scrubbed;
}

class SentryService {
  private static _instance: SentryService;
  private initialized = false;
  private disabled = false;

  static getInstance() {
    if (!SentryService._instance) {
      SentryService._instance = new SentryService();
    }

    return SentryService._instance;
  }

  public initialize() {
    if (this.initialized) {
      return;
    }

    Sentry.init({
      dsn: import.meta.env.VITE_SENTRY_DSN,
      release: `soothsayer@${pkgJson.version}`,
      environment: app.isPackaged ? "production" : "development",
      sendDefaultPii: false,

      beforeSend(event) {
        // Scrub exception messages and stack frame paths
        if (event.exception?.values) {
          for (const ex of event.exception.values) {
            if (ex.value) ex.value = scrubPaths(ex.value);

            if (ex.stacktrace?.frames) {
              for (const frame of ex.stacktrace.frames) {
                if (frame.filename) frame.filename = scrubPaths(frame.filename);
                if (frame.abs_path) frame.abs_path = scrubPaths(frame.abs_path);
              }
            }
          }
        }

        // Scrub breadcrumbs attached to the event
        if (event.breadcrumbs) {
          for (const bc of event.breadcrumbs) {
            if (bc.message) bc.message = scrubPaths(bc.message);
            if (bc.data) {
              bc.data = scrubBreadcrumbData(bc.data as Record<string, unknown>);
            }
          }
        }

        return event;
      },

      beforeBreadcrumb(breadcrumb) {
        if (breadcrumb.message) {
          breadcrumb.message = scrubPaths(breadcrumb.message);
        }
        if (breadcrumb.data) {
          breadcrumb.data = scrubBreadcrumbData(
            breadcrumb.data as Record<string, unknown>,
          );
        }
        return breadcrumb;
      },
    });

    this.initialized = true;
  }

  public isInitialized(): boolean {
    return this.initialized;
  }

  public isDisabled(): boolean {
    return this.disabled;
  }

  /**
   * Disable Sentry after it was eagerly initialized.
   * Called when settings load and the user has opted out of crash reporting.
   * Full teardown happens via Sentry.close(); a restart is needed to re-enable.
   */
  public async disable(): Promise<void> {
    if (!this.initialized || this.disabled) {
      return;
    }

    await Sentry.close(2000);
    this.disabled = true;
    console.log("[SentryService] Crash reporting disabled by user preference");
  }
}

// Exported for unit testing only
export { SentryService, scrubBreadcrumbData, scrubPaths };
