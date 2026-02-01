const UMAMI_SCRIPT_URL = "https://cloud.umami.is/script.js";
const WEBSITE_ID = "be4ac602-55bb-4958-96df-819d3dd33abe";
const APP_HOSTNAME = "soothsayer.app";

declare global {
  interface Window {
    umami?: {
      track: {
        (eventName: string, data?: Record<string, unknown>): void;
        (
          callback: (props: Record<string, unknown>) => Record<string, unknown>
        ): void;
      };
      identify: (sessionId?: string, data?: Record<string, unknown>) => void;
    };
  }
}

let initialized = false;

// UUID pattern to normalize dynamic route segments
const UUID_PATTERN =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

function normalizeUrl(url: string): string {
  return url.replace(UUID_PATTERN, ":id");
}

export function initUmami(): void {
  if (initialized) return;

  const script = document.createElement("script");
  script.src = UMAMI_SCRIPT_URL;
  script.defer = true;
  script.setAttribute("data-website-id", WEBSITE_ID);
  script.setAttribute("data-auto-track", "false");
  document.head.appendChild(script);

  initialized = true;
}

export function trackPageView(url: string, title?: string): void {
  if (!window.umami) return;

  const normalizedUrl = normalizeUrl(url);

  window.umami.track((props) => ({
    ...props,
    hostname: APP_HOSTNAME,
    url: normalizedUrl,
    title: title ?? document.title,
  }));
}

export function trackEvent(
  eventName: string,
  data?: Record<string, unknown>
): void {
  if (!window.umami) return;

  window.umami.track(eventName, { ...data, hostname: APP_HOSTNAME });
}
