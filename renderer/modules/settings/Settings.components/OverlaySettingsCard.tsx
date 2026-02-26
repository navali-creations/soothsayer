import { useCallback, useEffect, useRef, useState } from "react";
import { FiMaximize, FiMonitor, FiType } from "react-icons/fi";
import { LuMoveHorizontal, LuMoveVertical } from "react-icons/lu";

import { Button } from "~/renderer/components";
import { trackEvent } from "~/renderer/modules/umami";
import { useBoundStore } from "~/renderer/store";

const FONT_SIZE_MIN = 0.5;
const FONT_SIZE_MAX = 2.0;
const FONT_SIZE_STEP = 0.1;

const OVERLAY_WIDTH_MIN = 200;
const OVERLAY_WIDTH_MAX = 600;
const OVERLAY_WIDTH_STEP = 10;
const OVERLAY_WIDTH_DEFAULT = 250;

const OVERLAY_HEIGHT_MIN = 130;
const OVERLAY_HEIGHT_MAX = 500;
const OVERLAY_HEIGHT_STEP = 5;
const OVERLAY_HEIGHT_DEFAULT = 175;

const FONT_SIZE_DEFAULT = 1.0;
const TOOLBAR_FONT_SIZE_DEFAULT = 1.0;

const OverlaySettingsCard = () => {
  const {
    settings: {
      overlayFontSize,
      overlayToolbarFontSize,
      overlayBounds,
      updateSetting,
    },
  } = useBoundStore();

  const [overlayWidth, setOverlayWidth] = useState(
    overlayBounds?.width ?? OVERLAY_WIDTH_DEFAULT,
  );
  const [overlayHeight, setOverlayHeight] = useState(
    overlayBounds?.height ?? OVERLAY_HEIGHT_DEFAULT,
  );

  // Refs for the latest dimensions so debounced callbacks never use stale values
  const overlayWidthRef = useRef(overlayWidth);
  const overlayHeightRef = useRef(overlayHeight);
  overlayWidthRef.current = overlayWidth;
  overlayHeightRef.current = overlayHeight;

  // Fallback timer for persisting bounds when overlay isn't open
  const fallbackSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  // Fetch fresh bounds from the API on mount — the store's overlayBounds may be
  // stale because the overlay service writes bounds directly to the DB without
  // updating the Zustand store.
  useEffect(() => {
    window.electron.settings
      .get("overlayBounds")
      .then((bounds) => {
        if (bounds) {
          setOverlayWidth(bounds.width ?? OVERLAY_WIDTH_DEFAULT);
          setOverlayHeight(bounds.height ?? OVERLAY_HEIGHT_DEFAULT);
        }
      })
      .catch(() => {});
  }, []);

  // Sync local state when overlayBounds changes externally (e.g. after restore defaults)
  useEffect(() => {
    setOverlayWidth(overlayBounds?.width ?? OVERLAY_WIDTH_DEFAULT);
    setOverlayHeight(overlayBounds?.height ?? OVERLAY_HEIGHT_DEFAULT);
  }, [overlayBounds]);

  // Cleanup fallback timer on unmount
  useEffect(() => {
    return () => {
      if (fallbackSaveTimerRef.current) {
        clearTimeout(fallbackSaveTimerRef.current);
      }
    };
  }, []);

  const fontSizePercent = Math.round(overlayFontSize * 100);
  const toolbarFontSizePercent = Math.round(overlayToolbarFontSize * 100);

  /**
   * Resize the overlay immediately via IPC (fire-and-forget — no await).
   * The main process debounces the DB save so SQLite isn't thrashed.
   * If the overlay isn't open, we debounce a fallback settings write so
   * the dimensions are still persisted for next open.
   */
  const resizeOverlay = useCallback((width: number, height: number) => {
    // Fire-and-forget: send the resize command without awaiting
    window.electron.overlay.setSize(width, height).catch(() => {
      // Overlay not open — debounce a fallback save to persist bounds
      if (fallbackSaveTimerRef.current) {
        clearTimeout(fallbackSaveTimerRef.current);
      }
      fallbackSaveTimerRef.current = setTimeout(async () => {
        const current = await window.electron.overlay
          .getBounds()
          .catch(() => null);
        const bounds = current
          ? { ...current, width, height }
          : { x: 20, y: 20, width, height };
        await window.electron.settings
          .set("overlayBounds", bounds)
          .catch(() => {});
      }, 300);
    });
  }, []);

  const handleFontSizeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = parseFloat(e.target.value);
      updateSetting("overlayFontSize", value);
      trackEvent("settings-change", {
        setting: "overlayFontSize",
        value,
      });
    },
    [updateSetting],
  );

  const handleToolbarFontSizeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = parseFloat(e.target.value);
      updateSetting("overlayToolbarFontSize", value);
      trackEvent("settings-change", {
        setting: "overlayToolbarFontSize",
        value,
      });
    },
    [updateSetting],
  );

  const handleWidthChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const width = parseInt(e.target.value, 10);
      setOverlayWidth(width);
      resizeOverlay(width, overlayHeightRef.current);
    },
    [resizeOverlay],
  );

  const handleHeightChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const height = parseInt(e.target.value, 10);
      setOverlayHeight(height);
      resizeOverlay(overlayWidthRef.current, height);
    },
    [resizeOverlay],
  );

  const handleRestoreDefaults = useCallback(async () => {
    // Cancel any pending fallback save
    if (fallbackSaveTimerRef.current) {
      clearTimeout(fallbackSaveTimerRef.current);
      fallbackSaveTimerRef.current = null;
    }

    // Reset position and size
    await window.electron.overlay.restoreDefaults();
    setOverlayWidth(OVERLAY_WIDTH_DEFAULT);
    setOverlayHeight(OVERLAY_HEIGHT_DEFAULT);

    // Reset font sizes to defaults
    await updateSetting("overlayFontSize", FONT_SIZE_DEFAULT);
    await updateSetting("overlayToolbarFontSize", TOOLBAR_FONT_SIZE_DEFAULT);

    trackEvent("settings-change", {
      setting: "overlay",
      value: "restore-defaults",
    });
  }, [updateSetting]);

  return (
    <div className="card bg-base-100 shadow-xl">
      <div className="card-body">
        <h2 className="card-title">Overlay</h2>
        <p className="text-sm text-base-content/60">
          Customize the overlay appearance and position
        </p>

        <div className="space-y-4 mt-4">
          {/* Width Slider */}
          <div className="form-control">
            <div className="flex items-center gap-3">
              <LuMoveHorizontal className="w-4 h-4 text-base-content/70 shrink-0" />
              <span className="text-sm text-base-content/70 min-w-17">
                Width
              </span>
              <input
                type="range"
                className="range range-primary range-xs flex-1"
                min={OVERLAY_WIDTH_MIN}
                max={OVERLAY_WIDTH_MAX}
                step={OVERLAY_WIDTH_STEP}
                value={overlayWidth}
                onChange={handleWidthChange}
              />
              <span className="text-sm font-mono text-base-content/70 min-w-11 text-right tabular-nums">
                {overlayWidth}px
              </span>
            </div>
          </div>

          {/* Height Slider */}
          <div className="form-control">
            <div className="flex items-center gap-3">
              <LuMoveVertical className="w-4 h-4 text-base-content/70 shrink-0" />
              <span className="text-sm text-base-content/70 min-w-17">
                Height
              </span>
              <input
                type="range"
                className="range range-primary range-xs flex-1"
                min={OVERLAY_HEIGHT_MIN}
                max={OVERLAY_HEIGHT_MAX}
                step={OVERLAY_HEIGHT_STEP}
                value={overlayHeight}
                onChange={handleHeightChange}
              />
              <span className="text-sm font-mono text-base-content/70 min-w-11 text-right tabular-nums">
                {overlayHeight}px
              </span>
            </div>
          </div>

          <div className="divider my-0" />

          {/* Content Font Size Slider */}
          <div className="form-control">
            <div className="flex items-center gap-3">
              <FiMaximize className="w-4 h-4 text-base-content/70 shrink-0" />
              <span className="text-sm text-base-content/70 min-w-17">
                Drop size
              </span>
              <input
                type="range"
                className="range range-primary range-xs flex-1"
                min={FONT_SIZE_MIN}
                max={FONT_SIZE_MAX}
                step={FONT_SIZE_STEP}
                value={overlayFontSize}
                onChange={handleFontSizeChange}
              />
              <span className="text-sm font-mono text-base-content/70 min-w-11 text-right tabular-nums">
                {fontSizePercent}%
              </span>
            </div>
            <p className="text-xs text-base-content/40 mt-1 ml-7">
              Scales the drop row text and height (50% – 200%)
            </p>
          </div>

          {/* Toolbar Font Size Slider */}
          <div className="form-control">
            <div className="flex items-center gap-3">
              <FiType className="w-4 h-4 text-base-content/70 shrink-0" />
              <span className="text-sm text-base-content/70 min-w-17">
                Toolbar
              </span>
              <input
                type="range"
                className="range range-primary range-xs flex-1"
                min={FONT_SIZE_MIN}
                max={FONT_SIZE_MAX}
                step={FONT_SIZE_STEP}
                value={overlayToolbarFontSize}
                onChange={handleToolbarFontSizeChange}
              />
              <span className="text-sm font-mono text-base-content/70 min-w-11 text-right tabular-nums">
                {toolbarFontSizePercent}%
              </span>
            </div>
            <p className="text-xs text-base-content/40 mt-1 ml-7">
              Scales the tab labels, lock and close icons (50% – 200%)
            </p>
          </div>

          <div className="divider my-0" />

          {/* Restore Defaults */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FiMonitor className="w-4 h-4 text-base-content/70 shrink-0" />
              <div>
                <span className="text-sm text-base-content/70">
                  Restore defaults
                </span>
                <p className="text-xs text-base-content/40">
                  Reset position, size, and font sizes to defaults
                </p>
              </div>
            </div>
            <Button
              size="sm"
              outline
              onClick={handleRestoreDefaults}
              className="gap-1.5"
            >
              Restore defaults
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OverlaySettingsCard;
