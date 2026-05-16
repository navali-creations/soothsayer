import { useCallback, useEffect, useRef, useState } from "react";
import { FiMaximize, FiType } from "react-icons/fi";
import { LuMoveHorizontal, LuMoveVertical } from "react-icons/lu";

import { trackEvent } from "~/renderer/modules/umami";
import { useSettings } from "~/renderer/store";

import { OverlayRangeControl } from "./OverlayRangeControl/OverlayRangeControl";
import { OverlayRestoreDefaultsRow } from "./OverlayRestoreDefaultsRow/OverlayRestoreDefaultsRow";

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
    overlayFontSize,
    overlayToolbarFontSize,
    overlayBounds,
    updateSetting,
  } = useSettings();

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
    <section className="space-y-3">
      <p className="sr-only">Customize the overlay appearance and position</p>

      <div className="grid gap-x-8 gap-y-5 lg:grid-cols-2">
        <OverlayRangeControl
          icon={
            <LuMoveHorizontal className="w-4 h-4 text-base-content/70 shrink-0" />
          }
          label="Width"
          value={overlayWidth}
          displayValue={`${overlayWidth}px`}
          min={OVERLAY_WIDTH_MIN}
          max={OVERLAY_WIDTH_MAX}
          step={OVERLAY_WIDTH_STEP}
          onChange={handleWidthChange}
        />

        <OverlayRangeControl
          icon={
            <LuMoveVertical className="w-4 h-4 text-base-content/70 shrink-0" />
          }
          label="Height"
          value={overlayHeight}
          displayValue={`${overlayHeight}px`}
          min={OVERLAY_HEIGHT_MIN}
          max={OVERLAY_HEIGHT_MAX}
          step={OVERLAY_HEIGHT_STEP}
          onChange={handleHeightChange}
        />

        <OverlayRangeControl
          icon={
            <FiMaximize className="w-4 h-4 text-base-content/70 shrink-0" />
          }
          label="Drop size"
          value={overlayFontSize}
          displayValue={`${fontSizePercent}%`}
          min={FONT_SIZE_MIN}
          max={FONT_SIZE_MAX}
          step={FONT_SIZE_STEP}
          onChange={handleFontSizeChange}
          description="Scales the drop row text and height (50% - 200%)"
        />

        <OverlayRangeControl
          icon={<FiType className="w-4 h-4 text-base-content/70 shrink-0" />}
          label="Toolbar"
          value={overlayToolbarFontSize}
          displayValue={`${toolbarFontSizePercent}%`}
          min={FONT_SIZE_MIN}
          max={FONT_SIZE_MAX}
          step={FONT_SIZE_STEP}
          onChange={handleToolbarFontSizeChange}
          description="Scales the tab labels, lock and close icons (50% - 200%)"
        />

        <OverlayRestoreDefaultsRow onRestoreDefaults={handleRestoreDefaults} />
      </div>
    </section>
  );
};

export default OverlaySettingsCard;
